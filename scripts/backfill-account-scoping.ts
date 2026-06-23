// One-time migration: attaches pre-migration recommendations and sync runs
// (where platformAccountId IS NULL) to the demo platform account.
// Run once after npx prisma db push when upgrading from a pre-Phase-9 database.

import { config } from "dotenv";

config({ path: ".env.local" });

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const nullRecs = await prisma.recommendation.count({
      where: { platformAccountId: null },
    });
    const nullRuns = await prisma.syncRun.count({
      where: { platformAccountId: null },
    });

    if (nullRecs === 0 && nullRuns === 0) {
      console.log(
        "Nothing to backfill — all records already have platformAccountId."
      );
      return;
    }

    // Prefer the demo account; fall back to the first account in DB
    const target =
      (await prisma.platformAccount.findFirst({
        where: { accountId: "demo-youtube-gtm-lab" },
      })) ??
      (await prisma.platformAccount.findFirst({
        orderBy: { createdAt: "asc" },
      }));

    if (!target) {
      console.error(
        "No platform accounts found. Run npm run seed first, then re-run backfill."
      );
      process.exit(1);
    }

    console.log(
      `Backfilling ${nullRecs} recommendation(s) and ${nullRuns} sync run(s)` +
        ` → account "${target.accountName}" (${target.id})\n`
    );

    const [updatedRecs, updatedRuns] = await Promise.all([
      prisma.recommendation.updateMany({
        where: { platformAccountId: null },
        data: { platformAccountId: target.id },
      }),
      prisma.syncRun.updateMany({
        where: { platformAccountId: null },
        data: { platformAccountId: target.id },
      }),
    ]);

    console.log(`  Recommendations updated : ${updatedRecs.count}`);
    console.log(`  Sync runs updated       : ${updatedRuns.count}`);
    console.log(
      `\nDone. Visit /dashboard?accountId=${target.id} to verify.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});