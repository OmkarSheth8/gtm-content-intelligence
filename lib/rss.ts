import Parser from "rss-parser";
import type { ContentPayload, MetricPayload, PlatformAdapter } from "./platformAdapter";

// Shared parser instance — stateless, safe to reuse across calls.
const parser = new Parser({ timeout: 10_000 });

// ─── Input normalizer ─────────────────────────────────────────────────────────

export type ParsedFeedInput =
  | { kind: "url"; feedUrl: string }
  | { kind: "invalid"; reason: string };

// Accepts any http(s) URL — direct feed URL or blog homepage.
// Rejects YouTube URLs (those belong on the YouTube tab).
export function normalizeRssFeedInput(raw: string): ParsedFeedInput {
  const input = raw.trim();
  if (!input) return { kind: "invalid", reason: "Input is empty." };

  if (input.includes("youtube.com") || input.includes("youtu.be")) {
    return {
      kind: "invalid",
      reason: "That looks like a YouTube URL — use the YouTube tab instead.",
    };
  }

  const urlStr = /^https?:\/\//i.test(input) ? input : `https://${input}`;

  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        kind: "invalid",
        reason: "Only http:// and https:// URLs are supported.",
      };
    }
    return { kind: "url", feedUrl: url.toString() };
  } catch {
    return {
      kind: "invalid",
      reason:
        "Could not parse this as a URL. Enter a full RSS feed URL or blog homepage.",
    };
  }
}

// ─── Feed discovery ───────────────────────────────────────────────────────────

export interface RssFeedInfo {
  feedUrl: string; // the URL that successfully parsed
  title: string;   // feed title (falls back to hostname)
}

// Tries the input URL then common feed paths until one returns a parseable
// RSS/Atom feed. Returns null if none work.
export async function discoverFeedInfo(
  inputUrl: string
): Promise<RssFeedInfo | null> {
  let base: URL;
  try {
    base = new URL(inputUrl);
  } catch {
    return null;
  }

  const candidates: string[] = [
    inputUrl,
    new URL("/feed", base).toString(),
    new URL("/rss", base).toString(),
    new URL("/feed.xml", base).toString(),
    new URL("/atom.xml", base).toString(),
    new URL("/index.xml", base).toString(),
  ];

  // Deduplicate while preserving order (inputUrl may already be /feed)
  const seen = new Set<string>();
  const unique = candidates.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });

  for (const url of unique) {
    try {
      const feed = await parser.parseURL(url);
      const title = feed.title?.trim() || base.hostname;
      return { feedUrl: url, title };
    } catch {
      // Not parseable at this candidate — try next
    }
  }

  return null;
}

// ─── RSS/Atom Adapter ─────────────────────────────────────────────────────────

export class RssAdapter implements PlatformAdapter {
  readonly platform = "rss";

  async fetchContent(feedUrl: string): Promise<ContentPayload[]> {
    const feed = await parser.parseURL(feedUrl);
    const payloads: ContentPayload[] = [];

    for (const item of feed.items ?? []) {
      const link = item.link || item.guid;
      if (!link) continue; // cannot make a usable content item without a URL

      // Namespace the ID to the feed URL to prevent (platform, platformContentId)
      // unique-constraint collisions when two different feeds share a GUID.
      const guid = item.guid || item.link || "";
      const platformContentId = `${feedUrl}::${guid}`;

      // rss-parser auto-strips HTML from <description> into contentSnippet.
      // Fall back to content or summary and strip tags manually.
      const rawText =
        item.contentSnippet ||
        item.summary ||
        (item.content ?? "").replace(/<[^>]*>/g, "");
      const description = rawText.slice(0, 1_000).trim();

      const publishedAt =
        item.pubDate || item.isoDate
          ? new Date((item.pubDate || item.isoDate)!)
          : new Date();

      payloads.push({
        platformContentId,
        title: item.title?.trim() || "Untitled",
        description,
        publishedAt,
        url: link,
        // RSS feeds rarely have usable thumbnails in standard fields
        thumbnailUrl: undefined,
        duration: undefined,
      });
    }

    return payloads;
  }

  // RSS has no native engagement metrics.
  // Returns one zero-value MetricPayload per contentId so the sync pipeline
  // inserts a ContentMetricSnapshot row for every item — required for
  // history/trend tracking even when all values are 0.
  async fetchMetrics(contentIds: string[]): Promise<MetricPayload[]> {
    const snapshotAt = new Date();
    return contentIds.map((platformContentId) => ({
      platformContentId,
      views: BigInt(0),
      likes: BigInt(0),
      comments: BigInt(0),
      snapshotAt,
    }));
  }
}