import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Manual sync trigger — use this to refresh data during demos without waiting for cron
// POST /api/sync
// Authorization: Bearer <CRON_SECRET>
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Phase 2: same pipeline as /api/cron/sync
  return NextResponse.json({
    ok: true,
    message: "Manual sync triggered — implement pipeline in Phase 2",
    timestamp: new Date().toISOString(),
  });
}