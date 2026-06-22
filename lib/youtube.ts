import type { ContentPayload, MetricPayload, PlatformAdapter } from "./platformAdapter";

// YouTube Data API v3 — uploads playlist approach
// Docs: https://developers.google.com/youtube/v3/docs

const MAX_PAGES = 3;
const CHUNK_SIZE = 50; // videos.list accepts up to 50 IDs per request

// ─── Minimal response types ────────────────────────────────────────────────────

interface ChannelsListResponse {
  items?: Array<{
    contentDetails: {
      relatedPlaylists: {
        uploads: string;
      };
    };
  }>;
}

interface PlaylistItemsListResponse {
  nextPageToken?: string;
  items?: Array<{
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      resourceId: {
        videoId?: string;
      };
      thumbnails?: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
    contentDetails?: {
      videoPublishedAt?: string;
    };
  }>;
}

interface VideosListResponse {
  items?: Array<{
    id: string;
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
}

// ─── YouTube error body shape ─────────────────────────────────────────────────

interface YouTubeErrorBody {
  error?: {
    code?: number;
    message?: string;
    errors?: Array<{ reason?: string; message?: string }>;
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

// endpoint is a human-readable label (e.g. "channels.list") — never the URL,
// so the API key is never included in error messages.
async function fetchYouTube<T>(url: string, endpoint: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let message = `${endpoint}: HTTP ${res.status}`;
    try {
      const body = (await res.json()) as YouTubeErrorBody;
      const e = body.error;
      if (e) {
        const parts: string[] = [`HTTP ${res.status}`];
        if (e.code !== undefined) parts.push(`code=${e.code}`);
        if (e.errors?.[0]?.reason) parts.push(`reason=${e.errors[0].reason}`);
        if (e.message) parts.push(`message="${e.message}"`);
        message = `${endpoint}: ${parts.join(", ")}`;
      }
    } catch {
      // body is not JSON — status-only message is sufficient
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube";

  async fetchContent(channelId: string): Promise<ContentPayload[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

    // Step 1: resolve the uploads playlist ID for this channel
    const channelsUrl = new URL(
      "https://www.googleapis.com/youtube/v3/channels"
    );
    channelsUrl.searchParams.set("part", "contentDetails");
    channelsUrl.searchParams.set("id", channelId);
    channelsUrl.searchParams.set("key", apiKey);

    const channelsData = await fetchYouTube<ChannelsListResponse>(
      channelsUrl.toString(),
      "channels.list"
    );

    const uploadsPlaylistId =
      channelsData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error(
        `No uploads playlist found for channel: ${channelId}`
      );
    }

    // Step 2: paginate through playlist items (up to MAX_PAGES pages)
    const payloads: ContentPayload[] = [];
    let pageToken: string | undefined;
    let page = 0;

    do {
      const listUrl = new URL(
        "https://www.googleapis.com/youtube/v3/playlistItems"
      );
      listUrl.searchParams.set("part", "snippet,contentDetails");
      listUrl.searchParams.set("playlistId", uploadsPlaylistId);
      listUrl.searchParams.set("maxResults", "50");
      listUrl.searchParams.set("key", apiKey);
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const data = await fetchYouTube<PlaylistItemsListResponse>(
        listUrl.toString(),
        "playlistItems.list"
      );

      for (const item of data.items ?? []) {
        const videoId = item.snippet.resourceId.videoId;
        if (!videoId) continue; // skip non-video items

        const rawDate =
          item.contentDetails?.videoPublishedAt ?? item.snippet.publishedAt;

        const thumbnails = item.snippet.thumbnails;
        const thumbnailUrl =
          thumbnails?.high?.url ??
          thumbnails?.medium?.url ??
          thumbnails?.default?.url;

        payloads.push({
          platformContentId: videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          publishedAt: new Date(rawDate),
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnailUrl,
        });
      }

      pageToken = data.nextPageToken;
      page++;
    } while (pageToken && page < MAX_PAGES);

    return payloads;
  }

  async fetchMetrics(videoIds: string[]): Promise<MetricPayload[]> {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

    const payloads: MetricPayload[] = [];
    const snapshotAt = new Date();

    for (let i = 0; i < videoIds.length; i += CHUNK_SIZE) {
      const chunk = videoIds.slice(i, i + CHUNK_SIZE);

      const videosUrl = new URL(
        "https://www.googleapis.com/youtube/v3/videos"
      );
      videosUrl.searchParams.set("part", "statistics,snippet,contentDetails");
      videosUrl.searchParams.set("id", chunk.join(","));
      videosUrl.searchParams.set("key", apiKey);

      const data = await fetchYouTube<VideosListResponse>(
        videosUrl.toString(),
        "videos.list"
      );

      for (const item of data.items ?? []) {
        const stats = item.statistics ?? {};
        payloads.push({
          platformContentId: item.id,
          // Convert string counts directly to BigInt; missing = 0n
          views: BigInt(stats.viewCount ?? "0"),
          likes: BigInt(stats.likeCount ?? "0"),
          comments: BigInt(stats.commentCount ?? "0"),
          snapshotAt,
        });
      }
    }

    return payloads;
  }
}