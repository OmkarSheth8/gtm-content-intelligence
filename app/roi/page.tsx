export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getROIData } from "@/lib/dashboardData";
import ROIChart from "@/components/ROIChart";

export default async function ROIPage({
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

  const { events, estimatedPipeline, assumptions } = await getROIData(accountId);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">ROI Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {account.accountName} · Directional proxy funnel: views → tracked
          clicks → demo requests → estimated pipeline.
        </p>
      </div>
      <ROIChart
        events={events}
        estimatedPipeline={estimatedPipeline}
        assumptions={assumptions}
      />
    </div>
  );
}