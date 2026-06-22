interface SyncStatusData {
  completedAt: string | null;
  startedAt: string;
  status: string;
  snapshotsInserted: number | null;
}

interface Props {
  lastSync: SyncStatusData | null;
}

export default function SyncStatus({ lastSync }: Props) {
  if (!lastSync) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
        Last sync: never
      </div>
    );
  }

  const dot =
    lastSync.status === "success" ? "bg-emerald-400" : "bg-red-400";

  const displayTime = lastSync.completedAt
    ? new Date(lastSync.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "in progress";

  return (
    <div className="flex items-center gap-2 text-xs text-zinc-500">
      <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
      Last sync: {displayTime}
      {lastSync.snapshotsInserted !== null && (
        <span className="text-zinc-400">
          · {lastSync.snapshotsInserted} snapshots
        </span>
      )}
    </div>
  );
}