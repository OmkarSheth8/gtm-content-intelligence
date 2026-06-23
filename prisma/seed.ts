import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local not found");
  }

  const content = fs.readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvLocal();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is missing from .env.local");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

function makeEvents(
  contentKey: string,
  counts: Record<string, number>
) {
  let index = 0;
  const rows: Array<{
    eventType: string;
    sessionId: string;
    referrer: string;
    createdAt: Date;
    metadata: Record<string, string>;
  }> = [];

  for (const [eventType, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      rows.push({
        eventType,
        sessionId: `demo-${contentKey}-${eventType}-${index++}`,
        referrer: "seed-demo",
        createdAt: new Date(Date.now() - index * 60 * 60 * 1000),
        metadata: {
          source: "seed",
        },
      });
    }
  }

  return rows;
}

async function main() {
  console.log("Clearing old demo data...");

  await prisma.contentEvent.deleteMany();
  await prisma.contentClassification.deleteMany();
  await prisma.contentMetricSnapshot.deleteMany();
  await prisma.contentItem.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.syncRun.deleteMany();
  await prisma.platformAccount.deleteMany();

  console.log("Creating demo platform account...");

  const account = await prisma.platformAccount.create({
    data: {
      platform: "youtube",
      accountId: "demo-youtube-gtm-lab",
      accountName: "GTM Content Lab",
      metadata: {
        niche: "B2B SaaS go-to-market",
        owner: "Demo Account",
      },
    },
  });

  const seedItems = [
    {
      key: "sales-ai-workflows",
      title: "How AI SDR Workflows Shorten Prospecting Time",
      description:
        "A tactical walkthrough of AI-assisted SDR research, lead scoring, and outbound prioritization.",
      publishedAt: new Date("2026-06-01T14:00:00Z"),
      url: "https://youtube.com/watch?v=demo-sales-ai",
      thumbnailUrl: "https://placehold.co/600x400",
      duration: 540,
      views: 18400,
      likes: 780,
      comments: 96,
      topic: "Sales Enablement",
      format: "tutorial",
      hook: "stat",
      angle: "how-to",
      funnelStage: "consideration",
      audiencePersona: "SDR Manager",
      events: {
        landing_page_view: 22,
        click: 11,
        demo_request: 4,
        lead: 2,
      },
    },
    {
      key: "roi-content-attribution",
      title: "Simple ROI Attribution for Founder-Led Content",
      description:
        "A beginner-friendly explanation of mapping content views to downstream pipeline signals.",
      publishedAt: new Date("2026-06-04T16:30:00Z"),
      url: "https://youtube.com/watch?v=demo-roi-content",
      thumbnailUrl: "https://placehold.co/600x400",
      duration: 720,
      views: 12650,
      likes: 510,
      comments: 73,
      topic: "Content ROI",
      format: "case-study",
      hook: "story",
      angle: "beginner",
      funnelStage: "decision",
      audiencePersona: "Founder",
      events: {
        landing_page_view: 30,
        click: 14,
        demo_request: 6,
        lead: 3,
      },
    },
    {
      key: "linkedin-content-engine",
      title: "Building a LinkedIn Content Engine for B2B SaaS",
      description:
        "A breakdown of repeatable content formats that turn audience attention into qualified conversations.",
      publishedAt: new Date("2026-06-07T13:00:00Z"),
      url: "https://youtube.com/watch?v=demo-linkedin-engine",
      thumbnailUrl: "https://placehold.co/600x400",
      duration: 610,
      views: 9200,
      likes: 390,
      comments: 44,
      topic: "PLG",
      format: "listicle",
      hook: "question",
      angle: "comparison",
      funnelStage: "awareness",
      audiencePersona: "Growth Lead",
      events: {
        landing_page_view: 14,
        click: 7,
        demo_request: 2,
        lead: 1,
      },
    },
    {
      key: "gtm-automation-stack",
      title: "The GTM Automation Stack I Would Build First",
      description:
        "A practical breakdown of CRM enrichment, workflow automation, reporting, and content intelligence.",
      publishedAt: new Date("2026-06-10T18:00:00Z"),
      url: "https://youtube.com/watch?v=demo-gtm-stack",
      thumbnailUrl: "https://placehold.co/600x400",
      duration: 840,
      views: 21400,
      likes: 940,
      comments: 122,
      topic: "GTM Automation",
      format: "opinion",
      hook: "contrarian",
      angle: "advanced",
      funnelStage: "consideration",
      audiencePersona: "RevOps",
      events: {
        landing_page_view: 36,
        click: 18,
        demo_request: 8,
        lead: 4,
      },
    },
  ];

  console.log("Creating content items, metrics, classifications, and events...");

  const createdItems = [];

  for (const item of seedItems) {
    const created = await prisma.contentItem.create({
      data: {
        platformAccountId: account.id,
        platform: "youtube",
        platformContentId: item.key,
        title: item.title,
        description: item.description,
        publishedAt: item.publishedAt,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        metadata: {
          seedKey: item.key,
        },
        metricSnapshots: {
          create: [
            {
              snapshotAt: new Date("2026-06-15T12:00:00Z"),
              views: BigInt(Math.floor(item.views * 0.72)),
              likes: Math.floor(item.likes * 0.7),
              comments: Math.floor(item.comments * 0.65),
              shares: Math.floor(item.likes * 0.08),
              metadata: {
                source: "seed",
                stage: "earlier",
              },
            },
            {
              snapshotAt: new Date("2026-06-22T12:00:00Z"),
              views: BigInt(item.views),
              likes: item.likes,
              comments: item.comments,
              shares: Math.floor(item.likes * 0.12),
              metadata: {
                source: "seed",
                stage: "latest",
              },
            },
          ],
        },
        classification: {
          create: {
            topic: item.topic,
            format: item.format,
            hook: item.hook,
            angle: item.angle,
            funnelStage: item.funnelStage,
            audiencePersona: item.audiencePersona,
            classifiedBy: "manual",
            modelVersion: "seed-demo",
          },
        },
        events: {
          create: makeEvents(item.key, item.events),
        },
      },
    });

    createdItems.push(created);
  }

  console.log("Creating recommendations...");

  await prisma.recommendation.create({
    data: {
      topic: "GTM Automation",
      format: "tutorial",
      hook: "contrarian",
      angle: "how-to",
      reasoning:
        "The highest-performing seeded content combines tactical GTM automation advice with a strong point of view. Create more workflow teardown content tied to measurable pipeline outcomes.",
      historicalExamples: [createdItems[0].id, createdItems[3].id],
      confidenceScore: 0.86,
      expectedOutcome: "Higher qualified landing page views and demo requests",
      status: "active",
      modelVersion: "seed-demo",
      platformAccountId: account.id,
    },
  });

  await prisma.recommendation.create({
    data: {
      topic: "Content ROI",
      format: "case-study",
      hook: "story",
      angle: "beginner",
      reasoning:
        "Founder and operator audiences respond well to simple ROI attribution examples. The next content piece should show a realistic before-and-after pipeline example.",
      historicalExamples: [createdItems[1].id],
      confidenceScore: 0.78,
      expectedOutcome: "More decision-stage engagement",
      status: "active",
      modelVersion: "seed-demo",
      platformAccountId: account.id,
    },
  });

  await prisma.recommendation.create({
    data: {
      topic: "Sales Enablement",
      format: "listicle",
      hook: "stat",
      angle: "comparison",
      reasoning:
        "Sales enablement content with clear workflow comparisons can attract SDR managers and RevOps buyers who are evaluating automation tools.",
      historicalExamples: [createdItems[0].id, createdItems[2].id],
      confidenceScore: 0.74,
      expectedOutcome: "More clicks from consideration-stage content",
      status: "active",
      modelVersion: "seed-demo",
      platformAccountId: account.id,
    },
  });

  await prisma.syncRun.create({
    data: {
      platform: "youtube",
      trigger: "manual",
      status: "success",
      completedAt: new Date(),
      recordsPulled: seedItems.length,
      recordsUpserted: seedItems.length,
      snapshotsInserted: seedItems.length * 2,
      platformAccountId: account.id,
      metadata: {
        source: "seed",
      },
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });