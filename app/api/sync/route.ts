import { NextResponse } from "next/server";
import { runSync, runSyncForAccount } from "@/lib/syncPipeline";
import { validateSyncAuth } from "@/lib/syncAuth";

export const dynamic = "force-dynamic";

// Manual sync trigger — POST /api/sync
// Authorization: Bearer <CRON_SECRET>
// Body (optional JSON): { "platformAccountId": "<id>" }
//   — with platformAccountId: syncs that one account
//   — without: syncs all active platform accounts
export async function POST(request: Request) {
  const { authorized, debug } = validateSyncAuth(request);

  if (!authorized) {
    const body =
      process.env.NODE_ENV === "development"
        ? { error: "Unauthorized", debug }
        : { error: "Unauthorized" };
    return NextResponse.json(body, { status: 401 });
  }

  let platformAccountId: string | undefined;
  try {
    const body = (await request.json()) as { platformAccountId?: string };
    platformAccountId = body.platformAccountId;
  } catch {
    // No body or non-JSON — treat as "sync all"
  }

  try {
    if (platformAccountId) {
      const result = await runSyncForAccount(platformAccountId, "manual");
      return NextResponse.json({ ok: true, ...result });
    }
    const results = await runSync("manual");
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}