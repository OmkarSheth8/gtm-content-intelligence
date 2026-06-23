"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { refreshAccount, type RefreshState } from "@/lib/actions/sync";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? "Syncing…" : "Refresh"}
    </button>
  );
}

interface Props {
  accountId: string;
}

export function RefreshButton({ accountId }: Props) {
  // Bind accountId so useActionState sees (prevState, formData) => Promise<RefreshState>
  const boundAction = refreshAccount.bind(null, accountId);
  const [state, formAction] = useActionState<RefreshState, FormData>(
    boundAction,
    null
  );

  return (
    <div className="flex items-center gap-2">
      <form action={formAction}>
        <SubmitButton />
      </form>
      {state && (
        <span className="text-xs text-zinc-400">
          {state.skipped
            ? state.message
            : state.message === "Sync complete"
            ? "✓ Done"
            : `Error: ${state.message}`}
        </span>
      )}
    </div>
  );
}