import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Called daily by Vercel Cron at 09:00 UTC (see vercel.json)
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase 2: run full sync pipeline
  // 1. Start sync_run record
  // 2. Pull content from YouTube adapter
  // 3. Upsert content_items
  // 4. Insert metric snapshots
  // 5. Classify new content (Phase 5)
  // 6. Recalculate analytics (Phase 4)
  // 7. Generate recommendations (Phase 5)
  // 8. Mark sync_run success/failed

  return NextResponse.json({
    ok: true,
    message: "Cron sync placeholder — implement in Phase 2",
    timestamp: new Date().toISOString(),
  });
}