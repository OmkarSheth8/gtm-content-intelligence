import { prisma } from "@/lib/db";

export interface EngagementMetrics {
  totalViews: number;
  viewGrowth: number; // % change from first to latest snapshot; 0 if first snapshot has 0 views
  engagementRate: number; // (likes + comments) / views; 0 if views = 0
  likeRate: number;
  commentRate: number;
}

export type PatternDimension =
  | "topic"
  | "format"
  | "hook"
  | "angle"
  | "publishDay"
  | "publishHour";

export interface PatternAnalysis {
  dimension: PatternDimension;
  value: string;
  avgViews: number;
  avgEngagementRate: number;
  sampleSize: number;
}

export interface TopContent {
  id: string;
  title: string;
  url: string;
  views: number;
  topic: string | null;
  format: string | null;
  engagementRate: number;
}

export async function calculateEngagement(
  contentItemId: string
): Promise<EngagementMetrics> {
  const snapshots = await prisma.contentMetricSnapshot.findMany({
    where: { contentItemId },
    orderBy: { snapshotAt: "asc" },
  });

  if (snapshots.length === 0) {
    return {
      totalViews: 0,
      viewGrowth: 0,
      engagementRate: 0,
      likeRate: 0,
      commentRate: 0,
    };
  }

  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];

  const totalViews = Number(latest.views);
  const firstViews = Number(first.views);

  // If first snapshot has 0 views, viewGrowth is undefined — return 0 not Infinity
  const viewGrowth =
    firstViews > 0 ? ((totalViews - firstViews) / firstViews) * 100 : 0;

  const engagementRate =
    totalViews > 0 ? (latest.likes + latest.comments) / totalViews : 0;

  const likeRate = totalViews > 0 ? latest.likes / totalViews : 0;
  const commentRate = totalViews > 0 ? latest.comments / totalViews : 0;

  return { totalViews, viewGrowth, engagementRate, likeRate, commentRate };
}

// Returns the classification field value for classification-based dimensions,
// or derives the value from publishedAt for time-based dimensions.
// Returns null when the value is unknown — null items are excluded from pattern
// analysis so they don't inflate or misattribute averages.
function getDimensionValue(
  dimension: PatternDimension,
  publishedAt: Date,
  classification: { topic: string | null; format: string | null; hook: string | null; angle: string | null } | null
): string | null {
  switch (dimension) {
    case "publishDay":
      return publishedAt.toLocaleDateString("en-US", { weekday: "long" });
    case "publishHour":
      return publishedAt.getUTCHours().toString().padStart(2, "0") + ":00";
    case "topic":
      return classification?.topic ?? null;
    case "format":
      return classification?.format ?? null;
    case "hook":
      return classification?.hook ?? null;
    case "angle":
      return classification?.angle ?? null;
  }
}

export async function analyzePatterns(
  dimension: PatternDimension
): Promise<PatternAnalysis[]> {
  const items = await prisma.contentItem.findMany({
    include: {
      classification: true,
      metricSnapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
    },
  });

  const groups = new Map<string, { views: number[]; engRates: number[] }>();

  for (const item of items) {
    const latest = item.metricSnapshots[0];
    if (!latest) continue;

    const views = Number(latest.views);
    const engRate =
      views > 0 ? (latest.likes + latest.comments) / views : 0;

    const dimValue = getDimensionValue(
      dimension,
      item.publishedAt,
      item.classification
    );
    // Skip null — don't surface "Uncategorized" as a top-performing pattern
    if (!dimValue) continue;

    if (!groups.has(dimValue)) {
      groups.set(dimValue, { views: [], engRates: [] });
    }
    const g = groups.get(dimValue)!;
    g.views.push(views);
    g.engRates.push(engRate);
  }

  const results: PatternAnalysis[] = Array.from(groups.entries()).map(
    ([value, data]) => ({
      dimension,
      value,
      avgViews: data.views.reduce((a, b) => a + b, 0) / data.views.length,
      avgEngagementRate:
        data.engRates.reduce((a, b) => a + b, 0) / data.engRates.length,
      sampleSize: data.views.length,
    })
  );

  return results.sort((a, b) => b.avgViews - a.avgViews);
}

export async function getTopContent(limit = 10): Promise<TopContent[]> {
  const items = await prisma.contentItem.findMany({
    include: {
      classification: true,
      metricSnapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
    },
  });

  return items
    .filter((item) => item.metricSnapshots.length > 0)
    .map((item) => {
      const latest = item.metricSnapshots[0];
      const views = Number(latest.views);
      const engagementRate =
        views > 0 ? (latest.likes + latest.comments) / views : 0;
      return {
        id: item.id,
        title: item.title,
        url: item.url,
        views,
        topic: item.classification?.topic ?? null,
        format: item.classification?.format ?? null,
        engagementRate,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}