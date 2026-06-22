export const dynamic = "force-dynamic";

import { getDashboardData } from "@/lib/dashboardData";
import MetricCards from "@/components/MetricCards";
import ContentTable from "@/components/ContentTable";
import PerformanceChart from "@/components/PerformanceChart";
import SyncStatus from "@/components/SyncStatus";

export default async function DashboardPage() {
  const { syncData, metrics, chartData, contentRows } = await getDashboardData();

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Content Dashboard</h1>
        <SyncStatus lastSync={syncData} />
      </div>
      <MetricCards metrics={metrics} />
      <PerformanceChart data={chartData} />
      <ContentTable rows={contentRows} />
    </div>
  );
}