"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { normalizeYouTubeChannelInput, getChannelInfo } from "@/lib/youtube";
import { normalizeRssFeedInput, discoverFeedInfo } from "@/lib/rss";
import { runSyncForAccount } from "@/lib/syncPipeline";

export type AddSourceState = {
  error: string;
} | null;

// Unified source action — handles "youtube" and "rss" platforms.
// Called by AddSourceForm via useActionState.
export async function addSource(
  _prevState: AddSourceState,
  formData: FormData
): Promise<AddSourceState> {
  const platform = (formData.get("platform") as string | null) ?? "";
  const raw = (formData.get("sourceInput") as string | null)?.trim() ?? "";

  if (!raw) {
    return { error: "Please enter a channel, handle, URL, or feed URL." };
  }

  // ── YouTube ──────────────────────────────────────────────────────────────────

  if (platform === "youtube") {
    const parsed = normalizeYouTubeChannelInput(raw);
    if (parsed.kind === "invalid") return { error: parsed.reason };

    let info: { channelId: string; displayName: string } | null;
    try {
      info = await getChannelInfo(parsed);
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "YouTube API error — check YOUTUBE_API_KEY.",
      };
    }

    if (!info) {
      return {
        error:
          "YouTube channel not found. Double-check the channel ID, handle, or URL.",
      };
    }

    const account = await prisma.platformAccount.upsert({
      where: {
        platform_accountId: { platform: "youtube", accountId: info.channelId },
      },
      update: { accountName: info.displayName },
      create: {
        platform: "youtube",
        accountId: info.channelId,
        accountName: info.displayName,
      },
    });

    await runSyncForAccount(account.id, "manual").catch((err) => {
      console.warn(
        `Initial sync failed for "${info!.displayName}":`,
        err instanceof Error ? err.message : String(err)
      );
    });

    redirect(`/dashboard?accountId=${account.id}`);
  }

  // ── RSS / Blog ────────────────────────────────────────────────────────────────

  if (platform === "rss") {
    const parsed = normalizeRssFeedInput(raw);
    if (parsed.kind === "invalid") return { error: parsed.reason };

    let feedInfo: { feedUrl: string; title: string } | null;
    try {
      feedInfo = await discoverFeedInfo(parsed.feedUrl);
    } catch (err) {
      return {
        error:
          err instanceof Error
            ? err.message
            : "Failed to reach that URL — check your connection or the feed address.",
      };
    }

    if (!feedInfo) {
      return {
        error:
          "Could not find an RSS or Atom feed at that URL. Try a direct feed URL (e.g. /feed.xml, /rss, /atom.xml).",
      };
    }

    const account = await prisma.platformAccount.upsert({
      where: {
        platform_accountId: { platform: "rss", accountId: feedInfo.feedUrl },
      },
      update: { accountName: feedInfo.title },
      create: {
        platform: "rss",
        accountId: feedInfo.feedUrl,
        accountName: feedInfo.title,
      },
    });

    await runSyncForAccount(account.id, "manual").catch((err) => {
      console.warn(
        `Initial sync failed for "${feedInfo!.title}":`,
        err instanceof Error ? err.message : String(err)
      );
    });

    redirect(`/dashboard?accountId=${account.id}`);
  }

  return { error: "Unknown platform — please select YouTube or Blog/RSS." };
}