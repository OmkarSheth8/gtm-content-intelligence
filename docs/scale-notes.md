# Scale Notes

## BigInt for Platform Metric Counts

Platform metric fields (`views`, `likes`, `comments`, `shares`, and any future
`impressions` or `clicks`) are stored as `BigInt` in Postgres, not `INTEGER`.

**Why:** PostgreSQL `INTEGER` is 32-bit and caps at ~2.1 billion. YouTube views
on popular videos exceed this. Storing views as `INTEGER` would cause silent
overflow or a database error for any video approaching that threshold. `BIGINT`
(64-bit, max ~9.2 quintillion) is the correct type for any unbounded count metric.

**Trade-off:** JavaScript cannot serialize `BigInt` with `JSON.stringify`, so
`NextResponse.json()` would throw at runtime if raw Prisma results are passed
directly to the client.

**Solution:** Use `jsonResponse()` from `lib/serialize.ts` instead of
`NextResponse.json()` in all API routes that return Prisma data. It recursively
converts `BigInt` values to strings before serialization. Strings (not numbers)
are used to preserve full precision beyond `Number.MAX_SAFE_INTEGER`.

```typescript
// ✗ throws at runtime if result contains BigInt
return NextResponse.json(result)

// ✓ safe — BigInt values become strings
import { jsonResponse } from "@/lib/serialize"
return jsonResponse(result)
```

The client receives view counts as strings. Parse them with `BigInt(str)` for
arithmetic or display them directly as formatted strings.

---

## Current Limits

- YouTube Data API v3: 10,000 units/day on free tier. Each video fetch costs ~3 units.
  A channel with 200 videos costs ~600 units per full sync. Quota is not a concern at this scale.
- Supabase free tier: 500 MB database, 2 GB egress/month. Sufficient for demo scale.
- Vercel free tier: 12 cron executions/day, 10s execution limit on hobby plan.
  Consider Vercel Pro if sync runtime exceeds 10 seconds for large channels.

## Scaling to Production

- Add pagination to YouTube ingestion (`nextPageToken`)
- Add rate limiting / exponential backoff on YouTube API errors
- Move heavy analytics to Postgres materialized views or background jobs
- Add Redis cache for dashboard queries if read latency becomes an issue
- Add per-platform quota tracking in `sync_runs.metadata`