import { config } from "dotenv";

config({ path: ".env.local" });

interface YouTubeErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
}

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim();

  console.log("=== YouTube Diagnostic ===\n");
  console.log("YOUTUBE_API_KEY present:", !!apiKey);
  console.log("YOUTUBE_CHANNEL_ID present:", !!channelId);

  if (channelId) {
    console.log("channel ID length:", channelId.length);
    console.log("channel ID startsWithUC:", channelId.startsWith("UC"));
  }
  console.log();

  if (!apiKey || !channelId) {
    console.error("Missing required env vars. Stopping.");
    process.exit(1);
  }

  // ── A. channels.list ────────────────────────────────────────────────────────
  console.log("--- A. channels.list ---");

  const channelsUrl = new URL(
    "https://www.googleapis.com/youtube/v3/channels"
  );
  channelsUrl.searchParams.set("part", "snippet,contentDetails");
  channelsUrl.searchParams.set("id", channelId);
  channelsUrl.searchParams.set("key", apiKey);

  const channelsRes = await fetch(channelsUrl.toString());
  console.log("HTTP status:", channelsRes.status);

  const channelsBody = (await channelsRes.json()) as {
    items?: Array<{
      snippet?: { title?: string };
      contentDetails?: { relatedPlaylists?: { uploads?: string } };
    }>;
  } & YouTubeErrorBody;

  if (!channelsRes.ok) {
    const e = channelsBody.error;
    console.error("channels.list failed:");
    console.error("  code:", e?.code);
    console.error("  reason:", e?.errors?.[0]?.reason ?? "(none)");
    console.error("  message:", e?.message ?? "(none)");
    process.exit(1);
  }

  const itemCount = channelsBody.items?.length ?? 0;
  console.log("item count:", itemCount);

  if (itemCount === 0) {
    console.error(
      "No channel returned. YOUTUBE_CHANNEL_ID may be wrong or the API key may not have YouTube Data API v3 enabled."
    );
    process.exit(1);
  }

  const channel = channelsBody.items![0];
  const channelTitle = channel.snippet?.title ?? "(no title)";
  const uploadsPlaylistId =
    channel.contentDetails?.relatedPlaylists?.uploads;

  console.log("channel title:", channelTitle);
  console.log("uploadsPlaylistId:", uploadsPlaylistId ?? "(missing)");
  console.log("uploadsPlaylistId length:", uploadsPlaylistId?.length ?? 0);
  console.log();

  if (!uploadsPlaylistId) {
    console.error("No uploads playlist found. Stopping.");
    process.exit(1);
  }

  // ── B. playlistItems.list ───────────────────────────────────────────────────
  console.log("--- B. playlistItems.list ---");

  const playlistUrl = new URL(
    "https://www.googleapis.com/youtube/v3/playlistItems"
  );
  playlistUrl.searchParams.set("part", "snippet,contentDetails");
  playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
  playlistUrl.searchParams.set("maxResults", "5");
  playlistUrl.searchParams.set("key", apiKey);

  const playlistRes = await fetch(playlistUrl.toString());
  console.log("HTTP status:", playlistRes.status);

  const playlistBody = (await playlistRes.json()) as {
    pageInfo?: { totalResults?: number };
    items?: Array<{
      snippet?: {
        title?: string;
        resourceId?: { videoId?: string };
      };
    }>;
  } & YouTubeErrorBody;

  if (!playlistRes.ok) {
    const e = playlistBody.error;
    console.error("playlistItems.list failed:");
    console.error("  code:", e?.code);
    console.error("  reason:", e?.errors?.[0]?.reason ?? "(none)");
    console.error("  message:", e?.message ?? "(none)");
    process.exit(1);
  }

  const videoCount = playlistBody.items?.length ?? 0;
  console.log("item count:", videoCount);

  for (const item of playlistBody.items ?? []) {
    const videoId = item.snippet?.resourceId?.videoId ?? "(missing)";
    const title = item.snippet?.title ?? "(no title)";
    console.log(`  video: ${videoId} — ${title}`);
  }

  console.log("\nDiagnostic complete.");
}

main().catch((err) => {
  console.error(
    "Diagnostic failed:",
    err instanceof Error ? err.message : err
  );
  process.exit(1);
});