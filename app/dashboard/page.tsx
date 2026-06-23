export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/dashboardData";
import MetricCards from "@/components/MetricCards";
import ContentTable from "@/components/ContentTable";
import PerformanceChart from "@/components/PerformanceChart";
import SyncStatus from "@/components/SyncStatus";
import { RefreshButton } from "@/components/RefreshButton";

export default async function DashboardPage({
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

  const { syncData, metrics, chartData, contentRows } = await getDashboardData(accountId);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Content Dashboard</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{account.accountName}</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <SyncStatus lastSync={syncData} />
          <RefreshButton accountId={accountId} />
        </div>
      </div>
      <MetricCards metrics={metrics} />
      <PerformanceChart data={chartData} />
      <ContentTable rows={contentRows} />
    </div>
  );
}