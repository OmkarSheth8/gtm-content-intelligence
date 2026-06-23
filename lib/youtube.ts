import type { ContentPayload, MetricPayload, PlatformAdapter } from "./platformAdapter";

// YouTube Data API v3 — uploads playlist approach
// Docs: https://developers.google.com/youtube/v3/docs

const MAX_PAGES = 3;
const CHUNK_SIZE = 50; // videos.list accepts up to 50 IDs per request

// ─── Minimal response types ────────────────────────────────────────────────────

interface ChannelsListResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
    };
    contentDetails?: {
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

// ─── Channel input normalizer ─────────────────────────────────────────────────

export type ParsedChannelInput =
  | { kind: "channelId"; value: string }  // UCxxxxxxxxxxxxxxxxxxxxxxxxx
  | { kind: "handle"; value: string }     // @handle (without @)
  | { kind: "username"; value: string }   // legacy /c/ or /user/ name
  | { kind: "invalid"; reason: string };

// Accepts UC channel IDs, @handles, youtube.com URLs in several formats.
// Returns a tagged union describing how to query the YouTube API.
export function normalizeYouTubeChannelInput(raw: string): ParsedChannelInput {
  const input = raw.trim();
  if (!input) return { kind: "invalid", reason: "Input is empty." };

  // Try URL parsing for anything that looks like a URL or youtube.com path
  const looksLikeUrl = input.includes("youtube.com") || input.startsWith("http");
  if (looksLikeUrl) {
    try {
      const url = new URL(input.startsWith("http") ? input : `https://${input}`);
      const isYT =
        url.hostname === "youtube.com" || url.hostname === "www.youtube.com";

      if (!isYT) {
        return { kind: "invalid", reason: "URL does not point to youtube.com." };
      }

      const p = url.pathname;

      // /channel/UCxxxxxx
      const channelMatch = p.match(/^\/channel\/(UC[\w-]{22})\/?$/);
      if (channelMatch) return { kind: "channelId", value: channelMatch[1] };

      // /@handle
      const handleMatch = p.match(/^\/@([\w.-]+)\/?$/);
      if (handleMatch) return { kind: "handle", value: handleMatch[1] };

      // /c/customname  or  /user/username
      const legacyMatch = p.match(/^\/(?:c|user)\/([\w.-]+)\/?$/);
      if (legacyMatch) return { kind: "username", value: legacyMatch[1] };

      return {
        kind: "invalid",
        reason:
          "Unrecognised YouTube URL format. Try youtube.com/channel/UC…, youtube.com/@handle, or youtube.com/c/name.",
      };
    } catch {
      // Not a valid URL despite looking like one
    }
  }

  // Raw UC channel ID
  if (/^UC[\w-]{22}$/.test(input)) {
    return { kind: "channelId", value: input };
  }

  // @handle (explicit)
  if (input.startsWith("@")) {
    const handle = input.slice(1);
    if (!handle) return { kind: "invalid", reason: 'Handle cannot be empty after "@".' };
    return { kind: "handle", value: handle };
  }

  // Bare word — treat as handle (most common user intent)
  if (/^[\w.-]+$/.test(input)) {
    return { kind: "handle", value: input };
  }

  return {
    kind: "invalid",
    reason:
      "Could not parse this as a channel ID (UCxxxxxxx), handle (@name), or YouTube URL.",
  };
}

// ─── Channel info lookup ──────────────────────────────────────────────────────

export interface ChannelInfo {
  channelId: string;    // resolved UC-prefixed ID
  displayName: string;
}

// Validates the parsed input against the YouTube API and returns the resolved
// channel ID and display name. Returns null if the channel does not exist.
// Throws on API errors (missing key, quota exceeded, etc.).
export async function getChannelInfo(
  parsed: ParsedChannelInput
): Promise<ChannelInfo | null> {
  if (parsed.kind === "invalid") return null;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set");

  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("key", apiKey);

  if (parsed.kind === "channelId") {
    url.searchParams.set("id", parsed.value);
  } else if (parsed.kind === "handle") {
    url.searchParams.set("forHandle", parsed.value);
  } else {
    // username — legacy forUsername
    url.searchParams.set("forUsername", parsed.value);
  }

  const data = await fetchYouTube<ChannelsListResponse>(
    url.toString(),
    "channels.list(snippet)"
  );

  const item = data.items?.[0];
  if (!item) return null;

  return {
    channelId: item.id,
    displayName: item.snippet.title,
  };
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