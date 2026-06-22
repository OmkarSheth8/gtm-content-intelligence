import { config } from "dotenv";

config({ path: ".env.local" });

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { classifyContent } from "../lib/classification";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Skip classifications set by a more authoritative source than rule-based logic.
// --force bypasses this and overwrites everything.
const PROTECTED_CLASSIFIERS = new Set(["seed", "manual", "llm", "ai"]);
const force = process.argv.includes("--force");

async function main() {
  const items = await prisma.contentItem.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      classification: { select: { classifiedBy: true } },
    },
    orderBy: { publishedAt: "desc" },
  });

  console.log(`Found ${items.length} content item(s).`);
  if (force) console.log("--force flag set: protected classifications will be overwritten.");

  let classified = 0;
  let skipped = 0;
  const topicCounts: Record<string, number> = {};
  const formatCounts: Record<string, number> = {};

  for (const item of items) {
    const existingClassifiedBy = item.classification?.classifiedBy;

    if (!force && existingClassifiedBy && PROTECTED_CLASSIFIERS.has(existingClassifiedBy)) {
      skipped++;
      continue;
    }

    const result = classifyContent(item.title, item.description ?? "");

    await prisma.contentClassification.upsert({
      where: { contentItemId: item.id },
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
        contentItemId: item.id,
        topic: result.topic,
        format: result.format,
        hook: result.hook,
        angle: result.angle,
        funnelStage: result.funnelStage,
        audiencePersona: result.audiencePersona,
        classifiedBy: "rules",
      },
    });

    classified++;
    if (result.topic) topicCounts[result.topic] = (topicCounts[result.topic] ?? 0) + 1;
    if (result.format) formatCounts[result.format] = (formatCounts[result.format] ?? 0) + 1;

    const shortTitle = item.title.length > 55 ? item.title.slice(0, 55) + "…" : item.title;
    console.log(
      `  [${classified}] "${shortTitle}" → topic=${result.topic ?? "null"} format=${result.format ?? "null"} hook=${result.hook ?? "null"}`
    );
  }

  console.log(`\nDone.`);
  console.log(`  Classified : ${classified}`);
  console.log(`  Skipped (protected): ${skipped}`);
  if (Object.keys(topicCounts).length > 0) {
    console.log(`  Topics     :`, topicCounts);
  }
  if (Object.keys(formatCounts).length > 0) {
    console.log(`  Formats    :`, formatCounts);
  }
}

main()
  .catch((err) => {
    console.error("Classification failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());