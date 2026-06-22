import { config } from "dotenv";

config({ path: ".env.local" });

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { generateAndPersistRecommendations } from "../lib/recommendations";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("Generating recommendations from analytics patterns...\n");

    const recs = await generateAndPersistRecommendations(prisma);

    if (recs.length === 0) {
      console.log("No recommendations generated. Need classified content with metric snapshots.");
      return;
    }

    console.log(`Generated ${recs.length} recommendation(s):\n`);
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      console.log(`  [${i + 1}] ${rec.topic} — ${rec.format}`);
      console.log(`       hook     : ${rec.hook}`);
      console.log(`       angle    : ${rec.angle}`);
      console.log(`       confidence: ${(rec.confidenceScore * 100).toFixed(0)}%`);
      console.log(`       type     : ${rec.recommendationType}`);
      console.log(`       outcome  : ${rec.expectedOutcome}`);
      console.log();
    }

    console.log("Done. Visit /recommendations to see the updated panel.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});