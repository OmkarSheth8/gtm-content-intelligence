interface MetricsData {
  totalViews: string;
  avgEngagementRate: string;
  topTopic: string;
  topFormat: string;
  videoCount: number;
}

interface Props {
  metrics: MetricsData;
}

export default function MetricCards({ metrics }: Props) {
  const cards = [
    { label: "Total Views", value: metrics.totalViews },
    { label: "Avg Engagement Rate", value: metrics.avgEngagementRate },
    { label: "Top Topic by Views", value: metrics.topTopic },
    { label: "Top Format by Views", value: metrics.topFormat },
    { label: "Videos Tracked", value: String(metrics.videoCount) },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <p className="text-xs text-zinc-500 uppercase tracking-wide">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}