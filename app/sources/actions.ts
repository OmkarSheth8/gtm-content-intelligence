"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  normalizeYouTubeChannelInput,
  getChannelInfo,
} from "@/lib/youtube";
import { runSyncForAccount } from "@/lib/syncPipeline";

export type AddChannelState = {
  error: string;
} | null;

// Called by AddChannelForm — signature matches useActionState expectations.
export async function addChannel(
  _prevState: AddChannelState,
  formData: FormData
): Promise<AddChannelState> {
  const raw = (formData.get("channelInput") as string | null)?.trim() ?? "";

  if (!raw) {
    return { error: "Please enter a channel ID, @handle, or YouTube URL." };
  }

  const parsed = normalizeYouTubeChannelInput(raw);

  if (parsed.kind === "invalid") {
    return { error: parsed.reason };
  }

  let info: { channelId: string; displayName: string } | null;
  try {
    info = await getChannelInfo(parsed);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "YouTube API error — check YOUTUBE_API_KEY.",
    };
  }

  if (!info) {
    return {
      error: "YouTube channel not found. Double-check the channel ID, handle, or URL.",
    };
  }

  const account = await prisma.platformAccount.upsert({
    where: {
      platform_accountId: { platform: "youtube", accountId: info.channelId },
    },
    update: { accountName: info.displayName },
    create: {
      platform: "youtube",
      accountId: info.channelId,
      accountName: info.displayName,
    },
  });

  // Initial sync — best-effort; redirect succeeds even if sync fails
  await runSyncForAccount(account.id, "manual").catch((err) => {
    console.warn(
      `Initial sync failed for "${info!.displayName}":`,
      err instanceof Error ? err.message : String(err)
    );
  });

  redirect(`/dashboard?accountId=${account.id}`);
}