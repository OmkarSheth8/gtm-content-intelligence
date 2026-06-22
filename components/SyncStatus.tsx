export default function SyncStatus() {
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="inline-block w-2 h-2 rounded-full bg-zinc-300" />
      Last sync: not yet run
    </div>
  );
}