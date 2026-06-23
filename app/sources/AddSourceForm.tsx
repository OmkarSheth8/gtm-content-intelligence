"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addSource, type AddSourceState } from "@/app/sources/actions";

type Platform = "youtube" | "rss";

const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  rss: "Blog / RSS",
};

const PLACEHOLDERS: Record<Platform, string> = {
  youtube: "@handle, UCxxxxxx, or youtube.com/…",
  rss: "https://yourblog.com or https://yourblog.com/feed.xml",
};

const HINTS: Record<Platform, string> = {
  youtube:
    "Enter a channel ID (UCxxxxxx), handle (@channelname), or any YouTube channel URL.",
  rss: "Enter a direct RSS/Atom feed URL or your blog homepage — common feed paths are discovered automatically.",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Adding…" : "Add Source"}
    </button>
  );
}

export function AddSourceForm() {
  const [platform, setPlatform] = useState<Platform>("youtube");
  const [state, formAction] = useActionState<AddSourceState, FormData>(
    addSource,
    null
  );

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
      <h2 className="text-sm font-medium mb-3">Add Source</h2>

      {/* Platform tabs */}
      <div className="flex gap-1 mb-4 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg w-fit">
        {(["youtube", "rss"] as Platform[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              platform === p
                ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            }`}
          >
            {PLATFORM_LABELS[p]}
          </button>
        ))}
      </div>

      <p className="text-xs text-zinc-500 mb-3">{HINTS[platform]}</p>

      <form action={formAction} className="flex gap-3">
        {/* Carries the selected platform to the server action */}
        <input type="hidden" name="platform" value={platform} />
        {/*
          key=platform resets the input value when the user switches tabs,
          preventing a YouTube handle from being submitted as an RSS URL.
        */}
        <input
          key={platform}
          name="sourceInput"
          type="text"
          placeholder={PLACEHOLDERS[platform]}
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