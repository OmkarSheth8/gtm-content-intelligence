export default function RecommendationPanel() {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-medium">Recommendations</h2>
      </div>
      <div className="p-8 text-center text-sm text-zinc-400">
        No recommendations yet — AI engine runs in Phase 5 after analytics are built.
      </div>
    </div>
  );
}