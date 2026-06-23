export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRecommendationsData } from "@/lib/dashboardData";
import RecommendationPanel from "@/components/RecommendationPanel";

export default async function RecommendationsPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  const { accountId } = await searchParams;

  if (!accountId) redirect("/sources");

  const account = await prisma.platformAccount.findUnique({
    where: { id: accountId },
    select: { id: true, accountName: true },
  });

  if (!account) redirect("/sources");

  const recommendations = await getRecommendationsData(accountId);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Content Recommendations</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {account.accountName} · Grounded in historical performance patterns.{" "}
          {recommendations.length > 0
            ? `${recommendations.length} active recommendation${recommendations.length !== 1 ? "s" : ""}.`
            : "Run a sync to generate recommendations."}
        </p>
      </div>
      <RecommendationPanel recommendations={recommendations} />
    </div>
  );
}