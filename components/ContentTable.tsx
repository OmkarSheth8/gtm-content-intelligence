export default function ContentTable() {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-medium">Content Items</h2>
      </div>
      <div className="p-8 text-center text-sm text-zinc-400">
        No content yet — YouTube ingestion runs in Phase 2.
      </div>
    </div>
  );
}