import { prisma } from "@/lib/db";
import { classifyContent } from "@/lib/classification";
import { generateAndPersistRecommendations } from "@/lib/recommendations";
import { YouTubeAdapter } from "@/lib/youtube";

export interface SyncSummary {
  syncRunId: string;
  trigger: string;
  platformAccountId: string;
  accountName: string;
  recordsPulled: number;
  recordsUpserted: number;
  snapshotsInserted: number;
}

const PROTECTED_CLASSIFIERS = new Set(["seed", "manual", "llm", "ai"]);

// ─── Single-account sync ──────────────────────────────────────────────────────

// Syncs one PlatformAccount identified by its DB id.
// Fetches content from YouTube, upserts items, inserts snapshots,
// classifies, and regenerates recommendations.
export async function runSyncForAccount(
  platformAccountId: string,
  trigger: "cron" | "manual"
): Promise<SyncSummary> {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });

  if (!account) {
    throw new Error(`Platform account not found: ${platformAccountId}`);
  }

  const channelId = account.accountId;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

  const syncRun = await prisma.syncRun.create({
    data: { platform: "youtube", trigger, status: "running", platformAccountId },
  });

  try {
    const adapter = new YouTubeAdapter();

    // Fetch all content from the uploads playlist
    const contentPayloads = await adapter.fetchContent(channelId);

    // Upsert each video as a ContentItem row
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
          platformAccountId,
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
          views: metric.views,
          likes: Number(metric.likes),
          comments: Number(metric.comments),
        },
      });
      snapshotsInserted++;
    }

    // Classify newly synced content — protected classifiers are never overwritten
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

    // Refresh recommendations for this account — best-effort, never fails the sync
    try {
      await generateAndPersistRecommendations(prisma, platformAccountId);
    } catch (err) {
      console.warn(
        "Recommendation generation skipped:",
        err instanceof Error ? err.message : String(err)
      );
    }

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
      platformAccountId,
      accountName: account.accountName,
      recordsPulled: contentPayloads.length,
      recordsUpserted,
      snapshotsInserted,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    await prisma.syncRun
      .update({
        where: { id: syncRun.id },
        data: { status: "failed", completedAt: new Date(), error },
      })
      .catch(() => {});

    throw err;
  }
}

// ─── All-accounts sync ────────────────────────────────────────────────────────

// Syncs all PlatformAccounts in DB.
// If no accounts exist, falls back to YOUTUBE_CHANNEL_ID env var and creates
// the account — this handles fresh deploys before any channel is added via UI.
export async function runSync(
  trigger: "cron" | "manual"
): Promise<SyncSummary[]> {
  const accounts = await prisma.platformAccount.findMany({
    orderBy: { createdAt: "asc" },
  });

  if (accounts.length === 0) {
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!channelId || !apiKey) {
      throw new Error(
        "No platform accounts in database and YOUTUBE_CHANNEL_ID / YOUTUBE_API_KEY are not set"
      );
    }

    const account = await prisma.platformAccount.upsert({
      where: { platform_accountId: { platform: "youtube", accountId: channelId } },
      update: { accountName: channelId },
      create: {
        platform: "youtube",
        accountId: channelId,
        accountName: channelId,
      },
    });

    return [await runSyncForAccount(account.id, trigger)];
  }

  const results: SyncSummary[] = [];
  for (const account of accounts) {
    try {
      results.push(await runSyncForAccount(account.id, trigger));
    } catch (err) {
      console.warn(
        `Sync failed for account "${account.accountName}" (${account.id}):`,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  return results;
}