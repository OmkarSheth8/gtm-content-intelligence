interface RecommendationRow {
  id: string;
  topic: string;
  format: string;
  hook: string;
  angle: string;
  reasoning: string;
  confidenceScore: number;
  expectedOutcome: string | null;
  generatedAt: string;
}

interface Props {
  recommendations: RecommendationRow[];
}

export default function RecommendationPanel({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium">Recommendations</h2>
        </div>
        <div className="p-8 text-center text-sm text-zinc-400">
          No recommendations yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">
                {rec.topic} — {rec.format}
              </h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                Hook: {rec.hook} · Angle: {rec.angle}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {(rec.confidenceScore * 100).toFixed(0)}% confidence
            </span>
          </div>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {rec.reasoning}
          </p>
          {rec.expectedOutcome && (
            <p className="mt-2 text-xs text-zinc-400">
              Expected: {rec.expectedOutcome}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-300 dark:text-zinc-600">
            Generated {rec.generatedAt}
          </p>
        </div>
      ))}
    </div>
  );
}