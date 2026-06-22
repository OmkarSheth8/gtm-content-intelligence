# GTM Content Intelligence Engine

A self-updating GTM content analytics and recommendation engine. Ingests real platform data, stores historical performance metrics, analyzes what content patterns drive results, and generates data-grounded recommendations — connected to downstream ROI signals.

---

## What It Does

- **Ingests** YouTube video data and performance metrics via the YouTube Data API
- **Snapshots** metrics over time — never overwrites, always appends to history
- **Analyzes** which topics, formats, hooks, angles, and posting times drive views and engagement
- **Recommends** content ideas grounded in actual performance data, not LLM guesses
- **Tracks ROI** with a transparent proxy funnel: views → tracked clicks → demo requests → estimated pipeline
- **Runs automatically** on a daily Vercel Cron schedule with a manual trigger for demos

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript (strict) |
| Database | Supabase (Postgres) |
| ORM | Prisma |
| Charts | Recharts |
| AI | Claude API (classification + recommendations only) |
| Scheduling | Vercel Cron |
| Deployment | Vercel |

---

## Architecture

```
Platform (YouTube)
    ↓ YouTube Data API
YouTubeAdapter (lib/youtube.ts)          ← implements PlatformAdapter interface
    ↓
Sync Pipeline (app/api/cron/sync)
    ↓ upsert content_items
    ↓ insert metric_snapshots (append-only)
    ↓ classify new content via Claude API
    ↓ recalculate analytics
    ↓ generate recommendations
Database (Supabase Postgres via Prisma)
    ↓
Dashboard (Next.js App Router pages)
    ↓
Tracking Redirects (/r/[contentId]) → content_events → ROI estimates
```

---

## Repo Structure

```
app/
  dashboard/           ← main analytics view
  recommendations/     ← AI-generated content ideas
  roi/                 ← proxy funnel and pipeline estimates
  api/
    cron/sync/         ← Vercel Cron endpoint (daily at 09:00 UTC)
    sync/              ← manual sync trigger (POST with CRON_SECRET)
  r/[contentId]/       ← tracking redirect (records click → redirects)

components/
  ContentTable.tsx
  MetricCards.tsx
  PerformanceChart.tsx
  RecommendationPanel.tsx
  ROIChart.tsx
  SyncStatus.tsx

lib/
  db.ts               ← Prisma client singleton
  youtube.ts          ← YouTube platform adapter
  analytics.ts        ← metric calculations
  recommendations.ts  ← LLM-powered recommendation engine
  roi.ts              ← proxy funnel ROI estimates
  logger.ts           ← structured JSON logger
  platformAdapter.ts  ← shared adapter interface

prisma/
  schema.prisma       ← 7-table schema (see Database Schema)

scripts/
  seed.ts             ← seed demo data
  backfill-youtube.ts ← one-time historical backfill
  generate-demo-events.ts ← generate fake ROI events for demos

tests/
  analytics.test.ts
  dedupe.test.ts
  recommendations.test.ts
  roi.test.ts
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `platform_accounts` | One row per YouTube channel / platform account |
| `content_items` | One row per video/post |
| `content_metric_snapshots` | Append-only performance snapshots over time |
| `content_classifications` | Topic, format, hook, angle, funnel stage per item |
| `content_events` | Downstream clicks, demo requests, leads |
| `recommendations` | Historical AI-generated content ideas |
| `sync_runs` | Scheduled job history with status and error logs |

`content_metric_snapshots` is the most important table — it enables growth tracking, trend detection, and pattern analysis across time.

---

## Prerequisites

- **Node.js** 18+
- **Supabase project** (free tier works) — [supabase.com](https://supabase.com)
- **YouTube Data API v3 key** — Google Cloud Console → APIs & Services → YouTube Data API v3
- **Anthropic API key** — console.anthropic.com
- **Vercel account** for deployment and cron scheduling

---

## Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variables
cp .env.example .env.local

# 3. Fill in your credentials in .env.local

# 4. Apply the database schema
npx prisma db push

# 5. Generate the Prisma client
npx prisma generate

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — it redirects to `/dashboard`.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase Postgres connection string |
| `YOUTUBE_API_KEY` | YouTube Data API v3 key |
| `YOUTUBE_CHANNEL_ID` | YouTube channel ID to ingest (`UCxxxxx`) |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `ANTHROPIC_MODEL` | Claude model for AI features (e.g. `claude-sonnet-4-6`) |
| `CRON_SECRET` | Random secret to protect the sync endpoint |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed app |

---

## Triggering a Manual Sync

Useful for refreshing data during a demo without waiting for the daily cron:

```bash
curl -X POST https://your-app.vercel.app/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Deployment

1. Push to GitHub
2. Import to Vercel
3. Add all environment variables from `.env.example` in the Vercel dashboard
4. Vercel reads `vercel.json` and schedules the daily cron automatically

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 — Scaffold | Done | Project structure, schema draft, placeholder pages |
| 2 — Ingestion | Pending | YouTube ingestion, content upsert, metric snapshots |
| 3 — Scheduled Sync | Pending | Cron pipeline, last sync status, error handling |
| 4 — Analytics | Pending | Dashboard charts, pattern analysis, top content |
| 5 — Recommendations | Pending | AI content recommendations grounded in data |
| 6 — ROI Tracking | Pending | Tracking redirects, demo form, pipeline estimates |
| 7 — Tests + Deploy | Pending | Test suite, production deployment, walkthrough |