"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addChannel, type AddChannelState } from "@/app/sources/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Adding…" : "Add Channel"}
    </button>
  );
}

export function AddChannelForm() {
  const [state, formAction] = useActionState<AddChannelState, FormData>(
    addChannel,
    null
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
      <h2 className="text-sm font-medium mb-1">Add YouTube Channel</h2>
      <p className="text-xs text-zinc-500 mb-4">
        Enter a channel ID (UCxxxxxx), handle (@channelname), or any YouTube
        channel URL. The channel will be validated and an initial sync will
        run automatically.
      </p>
      <form action={formAction} className="flex gap-3">
        <input
          name="channelInput"
          type="text"
          placeholder="e.g. @mrbeast or youtube.com/channel/UC…"
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
          autoComplete="off"
        />
        <SubmitButton />
      </form>
      {state?.error && (
        <p className="mt-3 text-sm text-red-500">{state.error}</p>
      )}
    </div>
  );
}