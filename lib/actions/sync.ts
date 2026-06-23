"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { runSyncForAccount } from "@/lib/syncPipeline";

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export type RefreshState = {
  skipped: boolean;
  message: string;
  timestamp: number;
} | null;

// Called by RefreshButton — platformAccountId is bound via .bind() before passing
// to useActionState, so the actual signature seen by useActionState is
// (prevState: RefreshState, formData: FormData) => Promise<RefreshState>.
export async function refreshAccount(
  platformAccountId: string,
  _prevState: RefreshState,
  _formData: FormData
): Promise<RefreshState> {
  const recent = await prisma.syncRun.findFirst({
    where: {
      platformAccountId,
      status: "success",
      startedAt: { gte: new Date(Date.now() - COOLDOWN_MS) },
    },
    orderBy: { startedAt: "desc" },
  });

  if (recent) {
    const elapsedMs = Date.now() - recent.startedAt.getTime();
    const remainingMs = COOLDOWN_MS - elapsedMs;
    const remainingMin = Math.ceil(remainingMs / 60000);
    const elapsedSec = Math.round(elapsedMs / 1000);
    return {
      skipped: true,
      message: `Synced ${elapsedSec}s ago — wait ${remainingMin > 1 ? `${remainingMin} min` : "a moment"} before refreshing again.`,
      timestamp: Date.now(),
    };
  }

  try {
    await runSyncForAccount(platformAccountId, "manual");
  } catch (err) {
    return {
      skipped: false,
      message: err instanceof Error ? err.message : "Sync failed",
      timestamp: Date.now(),
    };
  }

  revalidatePath("/dashboard");
  return {
    skipped: false,
    message: "Sync complete",
    timestamp: Date.now(),
  };
}