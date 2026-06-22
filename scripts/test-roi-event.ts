import { config } from "dotenv";

config({ path: ".env.local" });

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Mirrors DEFAULT_ASSUMPTIONS from lib/roi.ts — kept inline to avoid @/ imports
const ACV = 25000;
const DEMO_TO_OPP = 0.4;
const OPP_TO_CLOSE = 0.25;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Get the most recently published content item
    const item = await prisma.contentItem.findFirst({
      orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, url: true },
    });

    if (!item) {
      console.log("No content items found. Run npm run seed first.");
      return;
    }

    console.log("Testing ROI event tracking\n");
    console.log(`  Title : "${item.title.slice(0, 60)}"`);
    console.log(`  ID    : ${item.id}`);
    console.log();

    // Create one click event
    const click = await prisma.contentEvent.create({
      data: {
        contentItemId: item.id,
        eventType: "click",
        referrer: "roi-test-script",
        metadata: { source: "roi_test" },
      },
    });
    console.log(`  Created click event        : ${click.id}`);

    // Create one demo_request event
    const demo = await prisma.contentEvent.create({
      data: {
        contentItemId: item.id,
        eventType: "demo_request",
        referrer: "roi-test-script",
        metadata: { source: "roi_test" },
      },
    });
    console.log(`  Created demo_request event : ${demo.id}`);

    // Print last 5 events for this item
    const recent = await prisma.contentEvent.findMany({
      where: { contentItemId: item.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { eventType: true, createdAt: true, referrer: true },
    });

    console.log(`\nLast ${recent.length} event(s) for this item:`);
    for (const e of recent) {
      const ts = e.createdAt.toISOString().replace("T", " ").slice(0, 19);
      console.log(
        `  ${e.eventType.padEnd(20)} ${ts}  referrer=${e.referrer ?? "(none)"}`
      );
    }

    // ROI totals across all items
    const allEvents = await prisma.contentEvent.findMany({
      select: { eventType: true },
    });

    const totals: Record<string, number> = {};
    for (const e of allEvents) {
      totals[e.eventType] = (totals[e.eventType] ?? 0) + 1;
    }

    const FUNNEL = ["landing_page_view", "click", "demo_request", "lead"];
    console.log("\nROI totals (all items):");
    for (const type of FUNNEL) {
      console.log(`  ${type.padEnd(22)}: ${totals[type] ?? 0}`);
    }

    const demoCount = totals["demo_request"] ?? 0;
    const pipeline = demoCount * DEMO_TO_OPP * OPP_TO_CLOSE * ACV;
    console.log(`\n  Estimated pipeline : $${pipeline.toLocaleString()}`);
    console.log(
      `  Formula            : ${demoCount} demos × ${DEMO_TO_OPP * 100}% × ${OPP_TO_CLOSE * 100}% × $${ACV.toLocaleString()}`
    );

    // Browser test URLs
    const appUrl =
      (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    console.log("\nTest URLs (requires npm run dev in another terminal):");
    console.log(`  ${appUrl}/r/${item.id}`);
    console.log(`  ${appUrl}/r/${item.id}?event=demo_request`);
    console.log("\nVisit /roi to see the updated pipeline.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("ROI test failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});