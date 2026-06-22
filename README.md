# GTM Content Intelligence Engine

A self-updating content analytics and recommendation system for B2B GTM teams. Ingests YouTube performance data, classifies content by topic/format/hook/angle, analyzes which patterns drive views and engagement, generates data-grounded recommendations, and tracks downstream ROI signals through a transparent proxy funnel.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router (Server Components) |
| Language | TypeScript (strict) |
| Database | Supabase (Postgres) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| UI / Charts | Tailwind CSS v4 · Recharts |
| Classification | Rule-based keyword matching (no LLM required) |
| Scheduling | Vercel Cron (daily at 09:00 UTC) |
| Deployment | Vercel |
| AI (planned) | Claude API — not yet wired |

---

## Architecture

```
YouTube Data API
    ↓
YouTubeAdapter (lib/youtube.ts)         — uploads playlist → video metrics
    ↓
Sync Pipeline (lib/syncPipeline.ts)
    ↓ upsert content_items
    ↓ insert content_metric_snapshots   — append-only, never overwrite
    ↓ classify content (rule-based)     — topic / format / hook / angle
    ↓ generate recommendations          — scored from analytics patterns
Database (Supabase Postgres via Prisma)
    ↓
Dashboard (Next.js Server Components)  — reads live DB, no client fetches
    ↓
Tracking Redirects (/r/[contentId])    — records ContentEvents → ROI estimates
```

Sync is triggered daily by Vercel Cron or on demand via `POST /api/sync`.

---

## Repo Structure

```
app/
  dashboard/            main analytics view (metrics, chart, content table)
  recommendations/      data-grounded content ideas
  roi/                  proxy funnel and estimated pipeline
  api/
    cron/sync/          Vercel Cron endpoint — GET, daily at 09:00 UTC
    sync/               manual sync trigger — POST with CRON_SECRET
  r/[contentId]/        tracking redirect — records event, redirects to content URL

components/
  ContentTable.tsx
  MetricCards.tsx
  PerformanceChart.tsx
  RecommendationPanel.tsx
  ROIChart.tsx
  SyncStatus.tsx

lib/
  analytics.ts          pattern analysis — avgViews and engagement by dimension
  classification.ts     rule-based classifier — 9 topic buckets, 4 formats, 4 hooks, 4 angles
  dashboardData.ts      server-side query layer for all dashboard pages
  db.ts                 Prisma singleton using @prisma/adapter-pg
  platformAdapter.ts    shared ContentPayload / MetricPayload interfaces
  recommendations.ts    scores analytics patterns, generates and persists recommendations
  roi.ts                ROI assumptions and pipeline formula
  serialize.ts          BigInt → number helpers for JSON serialization
  syncAuth.ts           Bearer token validation with whitespace trimming
  syncPipeline.ts       orchestrates fetch → upsert → classify → recommend
  youtube.ts            YouTubeAdapter — channels.list → playlistItems.list → videos.list

prisma/
  schema.prisma         7-table schema
  seed.ts               seeds demo content, metrics, classifications, events, recommendations

scripts/
  classify-existing.ts        classify all unclassified DB items (skips seed/manual/ai)
  diagnose-youtube.ts         step-by-step YouTube API diagnostic
  generate-recommendations.ts run recommendation engine standalone
  manual-sync.ts              POST /api/sync from the command line
  test-roi-event.ts           create test ContentEvents, print ROI totals
```

---

## Database Schema

| Table | Purpose |
|---|---|
| `platform_accounts` | One row per YouTube channel |
| `content_items` | One row per video — never deleted, only updated |
| `content_metric_snapshots` | Append-only performance snapshots — enables trend tracking |
| `content_classifications` | Topic, format, hook, angle, funnel stage per item |
| `content_events` | Downstream clicks, demo requests, leads from tracking redirects |
| `recommendations` | Generated content ideas with confidence scores and supporting data |
| `sync_runs` | Scheduled job history with status, counts, and error logs |

`content_metric_snapshots` is append-only. Every sync inserts a new row — views are never overwritten, which enables growth tracking and trend analysis over time.

---

## Prerequisites

- **Node.js 18+**
- **Supabase project** (free tier works) — [supabase.com](https://supabase.com)
- **YouTube Data API v3 key** — Google Cloud Console → APIs & Services → YouTube Data API v3
- **Vercel account** — for deployment and cron scheduling

Anthropic API key is **not required** — classification and recommendations are currently rule-based.

---

## Local Setup

```bash
# 1. Install dependencies
#    postinstall runs "prisma generate" automatically
npm install

# 2. Copy environment variable template
cp .env.example .env.local

# 3. Fill in .env.local with your credentials (see Environment Variables below)

# 4. Push schema to Supabase
#    Uses DIRECT_URL (port 5432) — set this before running
npx prisma db push

# 5. Seed demo data (optional — skip if you have a real YouTube channel)
npm run seed

# 6. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/dashboard`.

---

## Environment Variables

Set these in `.env.local` for local development and in the Vercel dashboard for production.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Supabase pooler connection string (port **6543**) — used by the app at runtime |
| `DIRECT_URL` | Yes | Supabase direct connection string (port **5432**) — used by Prisma CLI (`db push`, `generate`) |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key from Google Cloud Console |
| `YOUTUBE_CHANNEL_ID` | Yes | Channel ID to ingest (format: `UCxxxxxxxxxxxxxxxxxxxxxx`) |
| `CRON_SECRET` | Yes | Random secret protecting the sync endpoint — generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Yes | Public URL of the app (`http://localhost:3000` locally, `https://your-app.vercel.app` in prod) |
| `ANTHROPIC_API_KEY` | No | Not yet wired — reserved for future LLM features |
| `ANTHROPIC_MODEL` | No | Not yet wired — reserved for future LLM features |

**Why two database URLs?**
Supabase's transaction pooler (port 6543) is used by the app for all runtime queries. Prisma CLI operations require a direct Postgres connection (port 5432) because they use advisory locks that the pooler does not support. Both values come from the Supabase dashboard under **Project Settings → Database → Connection string**.

---

## npm Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build (TypeScript + Next.js) |
| `npm run start` | Start production server |
| `npm run seed` | Seed demo content, metrics, classifications, events, and recommendations |
| `npm run sync:manual` | Trigger a full sync via `POST /api/sync` (dev server must be running) |
| `npm run youtube:diagnose` | Test YouTube API connectivity step by step |
| `npm run classify` | Classify all unclassified content items using keyword rules |
| `npm run recommend` | Run the recommendation engine and persist new recommendations |
| `npm run roi:test` | Create test click and demo_request events, print ROI totals |

---

## YouTube Sync

The sync pipeline runs through three YouTube API calls per sync:

1. `channels.list` — resolves the uploads playlist ID for the channel
2. `playlistItems.list` — paginates through uploaded videos (up to 3 pages of 50)
3. `videos.list` — fetches current statistics for all video IDs in chunks of 50

After fetching, the pipeline:
- Upserts each video as a `ContentItem` (idempotent — keyed on `platform + platformContentId`)
- Inserts a new `ContentMetricSnapshot` for each video (always appended, never overwritten)
- Classifies any newly added or previously unclassified items using keyword rules
- Generates fresh recommendations from the updated analytics patterns

**Trigger manually:**

```bash
# Via npm script (requires dev server running)
npm run sync:manual

# Via curl (works against any environment)
curl -X POST https://your-app.vercel.app/api/sync \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Diagnose YouTube API issues:**

```bash
npm run youtube:diagnose
```

---

## Content Classification

Classification runs automatically during sync. To classify content already in the database:

```bash
npm run classify
```

Default behavior: only classifies items with no existing classification, or items previously classified as `"rules"`. Protected classifiers (`"seed"`, `"manual"`, `"llm"`, `"ai"`) are never overwritten.

To force-overwrite all classifications including protected ones:

```bash
npm run classify -- --force
```

**Classification dimensions:**

| Dimension | Values |
|---|---|
| Topic | AI in Sales, GTM Automation, Sales Enablement, Content ROI, GTM Strategy, LinkedIn Strategy, PLG, RevOps, Demand Generation |
| Format | listicle, tutorial, case-study, opinion |
| Hook | question, stat, story, contrarian |
| Angle | comparison, how-to, beginner, advanced |

Classification is keyword-based — no API calls, no LLM required.

---

## Recommendations

The recommendation engine scores content patterns from real analytics data and generates up to 3 recommendations per run:

- **Slot 1** — topic with highest average views
- **Slot 2** — topic with highest average engagement rate (different topic from Slot 1)
- **Slot 3** — topic with strongest ROI signal (demo requests; different from Slots 1 & 2)

Confidence scores weight: views 40%, engagement 30%, ROI signal 15%, sample depth 15%. Thin samples (n < 3) receive a penalty multiplier.

```bash
npm run recommend
```

Each run dismisses old `rules-v1` active recommendations and inserts fresh ones. Seed recommendations (`modelVersion: "seed-demo"`) are never touched.

Recommendations also regenerate automatically at the end of every successful sync.

---

## ROI Tracking

Tracked links follow the pattern `/r/[contentId]`. When a visitor hits this URL:

1. A `ContentEvent` row is created (default type: `"click"`)
2. The visitor is redirected to the content URL (only `http`/`https` destinations accepted)

Supported event types: `landing_page_view`, `click`, `demo_request`, `lead`. Pass via `?event=<type>`:

```
https://your-app.vercel.app/r/<contentId>
https://your-app.vercel.app/r/<contentId>?event=demo_request
```

**Test event creation locally:**

```bash
npm run roi:test
```

This creates one `click` and one `demo_request` event for the most recent content item and prints ROI totals. The `/roi` page reflects updated counts immediately on next load.

**Pipeline formula** (directional — not exact):

```
Estimated Pipeline = demo_requests × demo_to_opp_rate × opp_close_rate × ACV
                   = N × 40% × 25% × $25,000
```

---

## Deployment (Vercel)

### First deploy

1. Push to a GitHub repository
2. Import the repo in the Vercel dashboard
3. Set all required environment variables (see table above) — use production `DATABASE_URL` and `DIRECT_URL` from Supabase
4. Deploy — Vercel runs `npm install` (which triggers `postinstall: prisma generate`) then `npm run build`

### Prisma generate on Vercel

The `postinstall` script runs `prisma generate` automatically after every `npm install`. This ensures the generated Prisma client exists before `next build` starts. No manual step required.

### Cron authentication

`vercel.json` schedules `GET /api/cron/sync` daily at 09:00 UTC. Vercel automatically injects `Authorization: Bearer <CRON_SECRET>` into cron requests when `CRON_SECRET` is set as an environment variable. The route's `validateSyncAuth` checks this header with whitespace trimming on both sides.

If `CRON_SECRET` is not set, all sync requests (cron and manual) return 401 — this is intentional.

### Environment variables to set in Vercel

| Variable | Value source |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection pooling URI (port 6543) |
| `DIRECT_URL` | Supabase → Project Settings → Database → Connection string URI (port 5432) |
| `YOUTUBE_API_KEY` | Google Cloud Console |
| `YOUTUBE_CHANNEL_ID` | Your YouTube channel ID |
| `CRON_SECRET` | Generate with `openssl rand -hex 32` — must match `.env.local` |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

---

## Build Phases

| Phase | Status | Description |
|---|---|---|
| 1 — Scaffold | Done | Project structure, Prisma schema, placeholder pages |
| 2 — YouTube Ingestion | Done | Uploads playlist approach, metric snapshots, BigInt handling |
| 3 — Dashboard | Done | Server Components, real DB reads, force-dynamic pages |
| 4 — Analytics | Done | Pattern analysis by topic/format/hook/angle, engagement metrics |
| 5 — Classification | Done | Rule-based keyword classifier, sync integration, backfill script |
| 6 — Recommendations | Done | Scored pattern engine, confidence formula, rules-v1 lifecycle |
| 7 — ROI Tracking | Done | Tracking redirects, ContentEvents, proxy funnel, pipeline estimate |
| 8 — Deployment Readiness | Done | postinstall, .env.example, Vercel cron, this README |