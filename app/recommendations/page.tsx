import RecommendationPanel from "@/components/RecommendationPanel";

export default function RecommendationsPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-2xl font-semibold">Content Recommendations</h1>
      <p className="text-sm text-zinc-500">
        AI-powered recommendations grounded in historical performance data. Populated in Phase 5.
      </p>
      <RecommendationPanel />
    </div>
  );
}