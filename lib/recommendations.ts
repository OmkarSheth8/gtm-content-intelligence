// Rule-based recommendation engine (Phase 6).
// Reads classification + metric + ROI data from the DB, scores patterns,
// and persists up to 3 "rules-v1" recommendations scoped to one platformAccountId.
// No LLM required.

import { PrismaClient } from "@/generated/prisma/client";

export interface Recommendation {
  topic: string;
  format: string;
  hook: string;
  angle: string;
  reasoning: string;
  confidenceScore: number;
  expectedOutcome: string;
  recommendationType: string;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface PatternGroup {
  value: string;
  avgViews: number;
  avgEngRate: number;
  sampleSize: number;
  demoRequests: number;
  titles: string[];
}

interface Acc {
  totalViews: number;
  totalEngRate: number;
  count: number;
  demoRequests: number;
  titles: string[];
}

type AccMap = Map<string, Acc>;

// topic → dim_value → { totalViews, count } for topic-scoped hook/angle lookup
type ScopedDimMap = Map<string, Map<string, { totalViews: number; count: number }>>;

// ─── Accumulator helpers ──────────────────────────────────────────────────────

function accAdd(
  map: AccMap,
  key: string | null | undefined,
  views: number,
  engRate: number,
  demoReqs: number,
  title: string
): void {
  if (!key) return;
  if (!map.has(key)) map.set(key, { totalViews: 0, totalEngRate: 0, count: 0, demoRequests: 0, titles: [] });
  const g = map.get(key)!;
  g.totalViews += views;
  g.totalEngRate += engRate;
  g.count += 1;
  g.demoRequests += demoReqs;
  g.titles.push(title);
}

function scopeAdd(
  scopedMap: ScopedDimMap,
  topic: string | null | undefined,
  dim: string | null | undefined,
  views: number
): void {
  if (!topic || !dim) return;
  if (!scopedMap.has(topic)) scopedMap.set(topic, new Map());
  const inner = scopedMap.get(topic)!;
  if (!inner.has(dim)) inner.set(dim, { totalViews: 0, count: 0 });
  const e = inner.get(dim)!;
  e.totalViews += views;
  e.count += 1;
}

function accToGroups(map: AccMap): PatternGroup[] {
  return Array.from(map.entries()).map(([value, g]) => ({
    value,
    avgViews: g.count > 0 ? g.totalViews / g.count : 0,
    avgEngRate: g.count > 0 ? g.totalEngRate / g.count : 0,
    sampleSize: g.count,
    demoRequests: g.demoRequests,
    titles: g.titles,
  }));
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function computeConfidence(
  p: PatternGroup,
  maxAvgViews: number,
  maxAvgEngRate: number
): number {
  const normViews = maxAvgViews > 0 ? p.avgViews / maxAvgViews : 0;
  const normEng = maxAvgEngRate > 0 ? p.avgEngRate / maxAvgEngRate : 0;
  const sampleScore = Math.min(p.sampleSize / 5, 1.0);
  const roiSignal = Math.min(p.demoRequests / 10, 1.0);

  const raw =
    0.40 * normViews +
    0.30 * normEng +
    0.15 * roiSignal +
    0.15 * sampleScore;

  const sampleMult =
    p.sampleSize < 2 ? 0.85 : p.sampleSize < 3 ? 0.92 : 1.0;

  return Math.min(Math.max(raw * sampleMult, 0.10), 0.95);
}

// ─── Topic-scoped hook / angle ────────────────────────────────────────────────

function getBestScopedDim(
  topic: string,
  scopedMap: ScopedDimMap,
  fallback: string
): string {
  const inner = scopedMap.get(topic);
  if (!inner || inner.size === 0) return fallback;

  let best = "";
  let bestAvg = -1;
  for (const [dim, data] of inner) {
    const avg = data.count > 0 ? data.totalViews / data.count : 0;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = dim;
    }
  }
  return best || fallback;
}

// ─── Format selection with topic+format dedup ─────────────────────────────────

function selectFormat(
  preferredFormats: PatternGroup[],
  topic: string,
  usedCombinations: Set<string>
): string {
  for (const fp of preferredFormats) {
    if (!usedCombinations.has(`${topic}::${fp.value}`)) return fp.value;
  }
  return preferredFormats[0]?.value ?? "tutorial";
}

// ─── Reasoning and outcome strings ────────────────────────────────────────────

function buildReasoning(
  type: string,
  p: PatternGroup,
  format: string,
  hook: string
): string {
  const views = Math.round(p.avgViews).toLocaleString();
  const eng = (p.avgEngRate * 100).toFixed(1);
  const n = p.sampleSize;
  const pieces = `${n} video${n !== 1 ? "s" : ""}`;

  let lead: string;
  if (type === "strongest-roi-signal") {
    lead = `${p.value} has generated ${p.demoRequests} demo request${p.demoRequests !== 1 ? "s" : ""} — your strongest downstream ROI signal. It averages ${views} views across ${pieces}.`;
  } else if (type === "top-topic-by-engagement") {
    lead = `${p.value} delivers ${eng}% engagement — your highest rate across ${pieces} with ${views} avg views.`;
  } else {
    lead = `${p.value} averages ${views} views across ${pieces} with ${eng}% engagement — your top performer by view volume.`;
  }

  const formatNote = ` The ${format} format is your strongest signal for this pattern.`;
  const hookNote = ` Use a ${hook} hook to replicate what's working.`;

  const support =
    p.titles.length > 0
      ? ` Evidence: "${p.titles.slice(0, 2).join('", "')}".`
      : "";

  return lead + formatNote + hookNote + support;
}

function buildExpectedOutcome(p: PatternGroup): string {
  const views = Math.round(p.avgViews).toLocaleString();
  const eng = (p.avgEngRate * 100).toFixed(1);
  const n = p.sampleSize;
  return `~${views} avg views, ${eng}% engagement based on ${n} similar piece${n !== 1 ? "s" : ""}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function generateAndPersistRecommendations(
  prisma: PrismaClient,
  platformAccountId: string
): Promise<Recommendation[]> {
  // ── 1. Fetch items for this account with latest snapshot + classification + ROI ──

  const items = await prisma.contentItem.findMany({
    where: { platformAccountId },
    include: {
      classification: true,
      metricSnapshots: { orderBy: { snapshotAt: "desc" }, take: 1 },
      events: {
        where: { eventType: "demo_request" },
        select: { id: true },
      },
    },
  });

  // ── 2. Build pattern accumulators ─────────────────────────────────────────

  const topicAcc: AccMap = new Map();
  const formatAcc: AccMap = new Map();
  const topicHookScope: ScopedDimMap = new Map();
  const topicAngleScope: ScopedDimMap = new Map();

  const topicFormatROI = new Map<string, Map<string, number>>();

  for (const item of items) {
    const latest = item.metricSnapshots[0];
    if (!latest) continue;

    const views = Number(latest.views);
    const engRate = views > 0 ? (latest.likes + latest.comments) / views : 0;
    const demoReqs = item.events.length;
    const c = item.classification;

    accAdd(topicAcc, c?.topic, views, engRate, demoReqs, item.title);
    accAdd(formatAcc, c?.format, views, engRate, demoReqs, item.title);

    scopeAdd(topicHookScope, c?.topic, c?.hook, views);
    scopeAdd(topicAngleScope, c?.topic, c?.angle, views);

    if (c?.topic && c?.format) {
      if (!topicFormatROI.has(c.topic)) topicFormatROI.set(c.topic, new Map());
      const fMap = topicFormatROI.get(c.topic)!;
      fMap.set(c.format, (fMap.get(c.format) ?? 0) + demoReqs);
    }
  }

  const topicGroups = accToGroups(topicAcc);
  const formatGroups = accToGroups(formatAcc);

  if (topicGroups.length === 0) return [];

  // ── 3. Normalization denominators ─────────────────────────────────────────

  const maxAvgViews = Math.max(...topicGroups.map((p) => p.avgViews));
  const maxAvgEngRate = Math.max(...topicGroups.map((p) => p.avgEngRate));

  // ── 4. Sorted topic pools ─────────────────────────────────────────────────

  const byViews = [...topicGroups].sort((a, b) => b.avgViews - a.avgViews);
  const byEngRate = [...topicGroups].sort((a, b) => b.avgEngRate - a.avgEngRate);
  const byROI = [...topicGroups].sort((a, b) => b.demoRequests - a.demoRequests);

  const slot1Topic = byViews[0];
  const slot2Topic = byEngRate.find((p) => p.value !== slot1Topic.value) ?? null;

  const usedTopics = new Set(
    [slot1Topic.value, slot2Topic?.value].filter(Boolean) as string[]
  );
  const slot3Topic = byROI.find((p) => !usedTopics.has(p.value)) ?? null;

  // ── 5. Format pools ───────────────────────────────────────────────────────

  const formatsByViews = [...formatGroups].sort((a, b) => b.avgViews - a.avgViews);
  const formatsByEngRate = [...formatGroups].sort((a, b) => b.avgEngRate - a.avgEngRate);

  function roiFormatsForTopic(topic: string): PatternGroup[] {
    const fMap = topicFormatROI.get(topic);
    if (!fMap) return formatsByViews;
    return [...fMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(
        ([fmt]) =>
          formatGroups.find((f) => f.value === fmt) ?? {
            value: fmt,
            avgViews: 0,
            avgEngRate: 0,
            sampleSize: 0,
            demoRequests: 0,
            titles: [],
          }
      );
  }

  // ── 6. Build recommendation for each slot ─────────────────────────────────

  const usedCombinations = new Set<string>();
  const generated: Recommendation[] = [];

  function buildSlot(
    topicP: PatternGroup | null,
    preferredFormats: PatternGroup[],
    type: string
  ): void {
    if (!topicP) return;

    const allFormats = [
      ...preferredFormats,
      ...formatsByViews.filter(
        (f) => !preferredFormats.some((p) => p.value === f.value)
      ),
    ];

    const format = selectFormat(allFormats, topicP.value, usedCombinations);
    usedCombinations.add(`${topicP.value}::${format}`);

    const hook = getBestScopedDim(topicP.value, topicHookScope, "performance-backed hook");
    const angle = getBestScopedDim(topicP.value, topicAngleScope, "double down on proven topic");
    const confidenceScore = computeConfidence(topicP, maxAvgViews, maxAvgEngRate);

    generated.push({
      topic: topicP.value,
      format,
      hook,
      angle,
      reasoning: buildReasoning(type, topicP, format, hook),
      confidenceScore,
      expectedOutcome: buildExpectedOutcome(topicP),
      recommendationType: type,
    });
  }

  buildSlot(slot1Topic, formatsByViews, "top-topic-by-views");
  buildSlot(slot2Topic, formatsByEngRate, "top-topic-by-engagement");
  buildSlot(slot3Topic, roiFormatsForTopic(slot3Topic?.value ?? ""), "strongest-roi-signal");

  if (generated.length === 0) return [];

  // ── 7. Dismiss old rules-v1 active recommendations for this account ────────

  await prisma.recommendation.updateMany({
    where: { platformAccountId, modelVersion: "rules-v1", status: "active" },
    data: { status: "dismissed" },
  });

  // ── 8. Persist new recommendations ───────────────────────────────────────

  for (const rec of generated) {
    const topicPattern = topicGroups.find((g) => g.value === rec.topic);

    const historicalExamples = {
      recommendationType: rec.recommendationType,
      basedOn: {
        topic: rec.topic,
        format: rec.format,
        avgViews: Math.round(topicPattern?.avgViews ?? 0),
        avgEngagementRate: Number(((topicPattern?.avgEngRate ?? 0)).toFixed(4)),
        sampleSize: topicPattern?.sampleSize ?? 0,
        demoRequests: topicPattern?.demoRequests ?? 0,
      },
      supportingTitles: (topicPattern?.titles ?? []).slice(0, 3),
    };

    await prisma.recommendation.create({
      data: {
        topic: rec.topic,
        format: rec.format,
        hook: rec.hook,
        angle: rec.angle,
        reasoning: rec.reasoning,
        confidenceScore: rec.confidenceScore,
        expectedOutcome: rec.expectedOutcome,
        historicalExamples,
        status: "active",
        modelVersion: "rules-v1",
        platformAccountId,
      },
    });
  }

  return generated;
}