import { prisma } from "@/lib/db";
import { DEFAULT_ASSUMPTIONS } from "@/lib/roi";

// All types here are JSON-safe (no BigInt, Date, or undefined).
// BigInt views are converted to number (safe for demo values < 2^53).
// Dates are converted to ISO strings.

export interface SyncStatusData {
  completedAt: string | null;
  startedAt: string;
  status: string;
  snapshotsInserted: number | null;
}

export interface MetricsData {
  totalViews: string;        // formatted: "61,650"
  avgEngagementRate: string; // formatted: "5.3%"
  topTopic: string;
  topFormat: string;
  videoCount: number;
}

export interface ContentRow {
  id: string;
  title: string;
  url: string;
  views: string;             // formatted: "21,400"
  likes: number;
  comments: number;
  publishedAt: string;       // "2026-06-01"
  topic: string | null;
  format: string | null;
  engagementRate: string;    // "5.3%"
}

export interface ChartPoint {
  date: string;              // "Jun 15"
  totalViews: number;
}

export interface RecommendationRow {
  id: string;
  topic: string;
  format: string;
  hook: string;
  angle: string;
  reasoning: string;
  confidenceScore: number;
  expectedOutcome: string | null;
  generatedAt: string;       // "2026-06-22"
}

export interface EventCount {
  eventType: string;
  count: number;
}

export interface ROIResult {
  events: EventCount[];
  estimatedPipeline: number;
  assumptions: typeof DEFAULT_ASSUMPTIONS;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardData(platformAccountId: string) {
  const [latestSync, items] = await Promise.all([
    prisma.syncRun.findFirst({
      where: { platformAccountId, status: "success" },
      orderBy: { startedAt: "desc" },
    }),
    prisma.contentItem.findMany({
      where: { platformAccountId },
      include: {
        metricSnapshots: { orderBy: { snapshotAt: "asc" } },
        classification: true,
      },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  const syncData: SyncStatusData | null = latestSync
    ? {
        completedAt: latestSync.completedAt?.toISOString() ?? null,
        startedAt: latestSync.startedAt.toISOString(),
        status: latestSync.status,
        snapshotsInserted: latestSync.snapshotsInserted,
      }
    : null;

  // Compute aggregate metrics from the latest snapshot per item.
  // topTopic and topFormat are determined by highest avg views (not frequency).
  let totalViewsNum = 0;
  const engagementRates: number[] = [];
  const topicViews: Record<string, { total: number; count: number }> = {};
  const formatViews: Record<string, { total: number; count: number }> = {};

  for (const item of items) {
    const latest = item.metricSnapshots[item.metricSnapshots.length - 1];
    if (!latest) continue;
    const v = Number(latest.views);
    totalViewsNum += v;
    if (v > 0) {
      engagementRates.push((latest.likes + latest.comments) / v);
    }
    const topic = item.classification?.topic;
    if (topic) {
      if (!topicViews[topic]) topicViews[topic] = { total: 0, count: 0 };
      topicViews[topic].total += v;
      topicViews[topic].count += 1;
    }
    const format = item.classification?.format;
    if (format) {
      if (!formatViews[format]) formatViews[format] = { total: 0, count: 0 };
      formatViews[format].total += v;
      formatViews[format].count += 1;
    }
  }

  const avgRate =
    engagementRates.length > 0
      ? engagementRates.reduce((a, b) => a + b, 0) / engagementRates.length
      : 0;

  const topTopic =
    Object.entries(topicViews)
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .map(([topic]) => topic)[0] ?? "—";

  const topFormat =
    Object.entries(formatViews)
      .sort((a, b) => b[1].total / b[1].count - a[1].total / a[1].count)
      .map(([format]) => format)[0] ?? "—";

  const metrics: MetricsData = {
    totalViews: totalViewsNum.toLocaleString(),
    avgEngagementRate: (avgRate * 100).toFixed(1) + "%",
    topTopic,
    topFormat,
    videoCount: items.length,
  };

  // Chart: total views aggregated per snapshot date
  const dateMap = new Map<string, number>();
  for (const item of items) {
    for (const s of item.metricSnapshots) {
      const iso = s.snapshotAt.toISOString().slice(0, 10);
      dateMap.set(iso, (dateMap.get(iso) ?? 0) + Number(s.views));
    }
  }
  const chartData: ChartPoint[] = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, totalViews]) => ({
      date: new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      totalViews,
    }));

  // Content table rows
  const contentRows: ContentRow[] = items.map((item) => {
    const latest = item.metricSnapshots[item.metricSnapshots.length - 1];
    const views = latest ? Number(latest.views) : 0;
    const likes = latest?.likes ?? 0;
    const comments = latest?.comments ?? 0;
    const rate = views > 0 ? ((likes + comments) / views) * 100 : 0;
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      views: views.toLocaleString(),
      likes,
      comments,
      publishedAt: item.publishedAt.toISOString().slice(0, 10),
      topic: item.classification?.topic ?? null,
      format: item.classification?.format ?? null,
      engagementRate: rate.toFixed(1) + "%",
    };
  });

  return { syncData, metrics, chartData, contentRows };
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export async function getRecommendationsData(
  platformAccountId: string
): Promise<RecommendationRow[]> {
  const recs = await prisma.recommendation.findMany({
    where: { platformAccountId, status: "active" },
    orderBy: { generatedAt: "desc" },
  });
  return recs.map((r) => ({
    id: r.id,
    topic: r.topic,
    format: r.format,
    hook: r.hook,
    angle: r.angle,
    reasoning: r.reasoning,
    confidenceScore: r.confidenceScore,
    expectedOutcome: r.expectedOutcome ?? null,
    generatedAt: r.generatedAt.toISOString().slice(0, 10),
  }));
}

// ─── ROI ─────────────────────────────────────────────────────────────────────

export async function getROIData(platformAccountId: string): Promise<ROIResult> {
  // Filter events via the content item's platform account
  const allEvents = await prisma.contentEvent.findMany({
    where: { contentItem: { platformAccountId } },
    select: { eventType: true },
  });

  const countMap: Record<string, number> = {};
  for (const e of allEvents) {
    countMap[e.eventType] = (countMap[e.eventType] ?? 0) + 1;
  }
  const events: EventCount[] = Object.entries(countMap).map(([eventType, count]) => ({
    eventType,
    count,
  }));

  const demoRequests = countMap["demo_request"] ?? 0;
  const { averageContractValue, demoToOpportunityRate, opportunityCloseRate } =
    DEFAULT_ASSUMPTIONS;
  const estimatedPipeline =
    demoRequests * demoToOpportunityRate * opportunityCloseRate * averageContractValue;

  return { events, estimatedPipeline, assumptions: DEFAULT_ASSUMPTIONS };
}