export const dynamic = "force-dynamic";

import { getRecommendationsData } from "@/lib/dashboardData";
import RecommendationPanel from "@/components/RecommendationPanel";

export default async function RecommendationsPage() {
  const recommendations = await getRecommendationsData();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Content Recommendations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Grounded in historical performance patterns.{" "}
          {recommendations.length > 0
            ? `${recommendations.length} active recommendations.`
            : "AI generation runs in Phase 5 after analytics are built."}
        </p>
      </div>
      <RecommendationPanel recommendations={recommendations} />
    </div>
  );
}