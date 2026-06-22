import { NextResponse } from "next/server";
import { runSync } from "@/lib/syncPipeline";
import { validateSyncAuth } from "@/lib/syncAuth";

export const dynamic = "force-dynamic";

// Manual sync trigger — use this to refresh data during demos without waiting for cron
// POST /api/sync
// Authorization: Bearer <CRON_SECRET>
export async function POST(request: Request) {
  const { authorized, debug } = validateSyncAuth(request);

  if (!authorized) {
    const body =
      process.env.NODE_ENV === "development"
        ? { error: "Unauthorized", debug }
        : { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  try {
    const result = await runSync("manual");
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}