import { prisma } from "@/lib/db";
import { classifyContent } from "@/lib/classification";
import { generateAndPersistRecommendations } from "@/lib/recommendations";
import { YouTubeAdapter } from "@/lib/youtube";

export interface SyncSummary {
  syncRunId: string;
  trigger: string;
  recordsPulled: number;
  recordsUpserted: number;
  snapshotsInserted: number;
}

export async function runSync(
  trigger: "cron" | "manual"
): Promise<SyncSummary> {
  const channelId = process.env.YOUTUBE_CHANNEL_ID;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!channelId || !apiKey) {
    throw new Error(
      "YOUTUBE_CHANNEL_ID and YOUTUBE_API_KEY must be set in environment"
    );
  }

  // Create a sync run record immediately so every attempt is traceable
  const syncRun = await prisma.syncRun.create({
    data: { platform: "youtube", trigger, status: "running" },
  });

  try {
    const adapter = new YouTubeAdapter();

    // Ensure the platform account row exists for this channel
    const account = await prisma.platformAccount.upsert({
      where: {
        platform_accountId: { platform: "youtube", accountId: channelId },
      },
      update: { accountName: channelId },
      create: {
        platform: "youtube",
        accountId: channelId,
        accountName: channelId,
      },
    });

    // Fetch all content from the uploads playlist
    const contentPayloads = await adapter.fetchContent(channelId);

    // Upsert each video as a ContentItem row
    // @@unique([platform, platformContentId]) ensures idempotency
    const contentIdMap = new Map<string, string>(); // platformContentId → DB id
    let recordsUpserted = 0;

    for (const payload of contentPayloads) {
      const item = await prisma.contentItem.upsert({
        where: {
          platform_platformContentId: {
            platform: "youtube",
            platformContentId: payload.platformContentId,
          },
        },
        update: {
          title: payload.title,
          description: payload.description,
          url: payload.url,
          thumbnailUrl: payload.thumbnailUrl ?? null,
        },
        create: {
          platformAccountId: account.id,
          platform: "youtube",
          platformContentId: payload.platformContentId,
          title: payload.title,
          description: payload.description,
          publishedAt: payload.publishedAt,
          url: payload.url,
          thumbnailUrl: payload.thumbnailUrl ?? null,
          duration: payload.duration ?? null,
        },
      });
      contentIdMap.set(payload.platformContentId, item.id);
      recordsUpserted++;
    }

    // Fetch current metrics for all upserted videos
    const metricPayloads = await adapter.fetchMetrics(
      Array.from(contentIdMap.keys())
    );

    // Insert one snapshot per video — append-only, never overwrite
    let snapshotsInserted = 0;

    for (const metric of metricPayloads) {
      const contentItemId = contentIdMap.get(metric.platformContentId);
      if (!contentItemId) continue;

      await prisma.contentMetricSnapshot.create({
        data: {
          contentItemId,
          snapshotAt: metric.snapshotAt,
          views: metric.views,               // bigint → BigInt schema field
          likes: Number(metric.likes),        // bigint → Int schema field
          comments: Number(metric.comments),  // bigint → Int schema field
        },
      });
      snapshotsInserted++;
    }

    // Classify newly synced content.
    // Protected classifiers (seed, manual, llm, ai) are never overwritten.
    // Only items with no classification or an existing "rules" classification are updated.
    const PROTECTED_CLASSIFIERS = new Set(["seed", "manual", "llm", "ai"]);

    const existingClassifications = await prisma.contentClassification.findMany({
      where: { contentItemId: { in: Array.from(contentIdMap.values()) } },
      select: { contentItemId: true, classifiedBy: true },
    });
    const existingByItemId = new Map(
      existingClassifications.map((c) => [c.contentItemId, c.classifiedBy])
    );

    for (const payload of contentPayloads) {
      const contentItemId = contentIdMap.get(payload.platformContentId);
      if (!contentItemId) continue;

      const existingClassifiedBy = existingByItemId.get(contentItemId);
      if (existingClassifiedBy && PROTECTED_CLASSIFIERS.has(existingClassifiedBy)) {
        continue;
      }

      const result = classifyContent(payload.title, payload.description ?? "");

      await prisma.contentClassification.upsert({
        where: { contentItemId },
        update: {
          topic: result.topic,
          format: result.format,
          hook: result.hook,
          angle: result.angle,
          funnelStage: result.funnelStage,
          audiencePersona: result.audiencePersona,
          classifiedAt: new Date(),
          classifiedBy: "rules",
          modelVersion: null,
        },
        create: {
          contentItemId,
          topic: result.topic,
          format: result.format,
          hook: result.hook,
          angle: result.angle,
          funnelStage: result.funnelStage,
          audiencePersona: result.audiencePersona,
          classifiedBy: "rules",
        },
      });
    }

    // Refresh recommendations after new data lands — best-effort, never fails the sync
    try {
      await generateAndPersistRecommendations(prisma);
    } catch (err) {
      console.warn(
        "Recommendation generation skipped:",
        err instanceof Error ? err.message : String(err)
      );
    }

    // Mark the run successful with counts
    await prisma.syncRun.update({
      where: { id: syncRun.id },
      data: {
        status: "success",
        completedAt: new Date(),
        recordsPulled: contentPayloads.length,
        recordsUpserted,
        snapshotsInserted,
      },
    });

    return {
      syncRunId: syncRun.id,
      trigger,
      recordsPulled: contentPayloads.length,
      recordsUpserted,
      snapshotsInserted,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    // Best-effort update — don't mask the original error if this also fails
    await prisma.syncRun
      .update({
        where: { id: syncRun.id },
        data: { status: "failed", completedAt: new Date(), error },
      })
      .catch(() => {});

    throw err;
  }
}