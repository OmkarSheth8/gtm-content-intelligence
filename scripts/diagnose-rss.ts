// Diagnose an RSS/Atom feed: discover feed URL, print title, item count, first 3 items.
// Usage:
//   npm run rss:diagnose
//   npm run rss:diagnose -- https://yourblog.com/feed.xml

import { config } from "dotenv";
config({ path: ".env.local" });

import { normalizeRssFeedInput, discoverFeedInfo, RssAdapter } from "../lib/rss";

const DEFAULT_FEED = "https://news.ycombinator.com/rss";

async function main() {
  const raw = process.argv[2] || DEFAULT_FEED;
  console.log(`\nDiagnosing: ${raw}\n`);

  const parsed = normalizeRssFeedInput(raw);
  if (parsed.kind === "invalid") {
    console.error(`✗ Invalid input: ${parsed.reason}`);
    process.exit(1);
  }

  const info = await discoverFeedInfo(parsed.feedUrl);
  if (!info) {
    console.error("✗ Could not find or parse a feed at this URL.");
    console.error("  Try a direct feed path: /feed.xml, /rss, /atom.xml");
    process.exit(1);
  }

  console.log(`✓ Feed found: ${info.feedUrl}`);
  console.log(`  Title      : ${info.title}`);

  const adapter = new RssAdapter();
  const items = await adapter.fetchContent(info.feedUrl);

  console.log(`  Item count : ${items.length}\n`);

  const preview = items.slice(0, 3);
  for (let i = 0; i < preview.length; i++) {
    const item = preview[i];
    console.log(`  [${i + 1}] ${item.title}`);
    console.log(`       URL      : ${item.url}`);
    console.log(`       Published: ${item.publishedAt.toISOString().slice(0, 10)}`);
    if (item.description) {
      console.log(`       Excerpt  : ${item.description.slice(0, 120)}…`);
    }
    console.log();
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});