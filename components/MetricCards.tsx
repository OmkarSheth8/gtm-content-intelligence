export default function MetricCards() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {[
        { label: "Total Views", value: "—" },
        { label: "Avg Engagement Rate", value: "—" },
        { label: "Top Performing Topic", value: "—" },
        { label: "Videos Tracked", value: "—" },
      ].map((card) => (
        <div key={card.label} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
        </div>
      ))}
      <p className="col-span-full text-xs text-zinc-400">Populated in Phase 4 after YouTube ingestion.</p>
    </div>
  );
}