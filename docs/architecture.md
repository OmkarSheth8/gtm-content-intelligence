# Architecture

## Data Flow

```
YouTube Data API
    │
    ▼
YouTubeAdapter.fetchContent()     → returns ContentPayload[]
YouTubeAdapter.fetchMetrics()     → returns MetricPayload[]
    │
    ▼
Sync Pipeline (/api/cron/sync or /api/sync)
    │
    ├── Upsert → content_items (idempotent by platform + platformContentId)
    ├── Insert → content_metric_snapshots (append-only, never overwrite)
    ├── Classify → content_classifications (via Claude API, upsert)
    ├── Analyze → recalculate pattern analytics
    ├── Recommend → insert new recommendations
    └── Log → sync_runs (success or failed)
    │
    ▼
Supabase Postgres (via Prisma)
    │
    ▼
Next.js App Router Dashboard
    │
    └── /r/[contentId] tracking → content_events → ROI estimates
```

## Key Design Decisions

### Append-only metric snapshots
`content_metric_snapshots` is never updated, only inserted. This is the core design
principle that enables growth tracking, trend detection, and historical analysis.

### Platform adapter pattern
`PlatformAdapter` interface in `lib/platformAdapter.ts` lets the system support
additional platforms (LinkedIn, X, etc.) without touching the sync pipeline.
Each platform implements `fetchContent` and `fetchMetrics`.

### AI is downstream of data, not a replacement for it
The LLM (Claude API) only sees pre-computed winning patterns as structured input.
It outputs human-readable recommendations — it does not make up patterns.

### Cron + manual trigger
`/api/cron/sync` (GET) is called by Vercel Cron daily.
`/api/sync` (POST) is a manual trigger for demos — same pipeline, same auth.
Both require `Authorization: Bearer <CRON_SECRET>`.

### ROI is directional
`content_events` records proxy signals (clicks, demo requests).
`lib/roi.ts` converts these to pipeline estimates using visible assumptions.
All estimates are labeled `isDirectional: true` and never presented as exact.

## Module Map

| Module | Responsibility |
|---|---|
| `lib/platformAdapter.ts` | Shared interface for platform adapters |
| `lib/youtube.ts` | YouTube Data API v3 adapter |
| `lib/db.ts` | Prisma client singleton |
| `lib/analytics.ts` | Metric calculations and pattern analysis |
| `lib/recommendations.ts` | Data-grounded LLM recommendation engine |
| `lib/roi.ts` | Proxy funnel ROI estimates |
| `lib/logger.ts` | Structured JSON logger |