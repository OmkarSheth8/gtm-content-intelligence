import MetricCards from "@/components/MetricCards";
import ContentTable from "@/components/ContentTable";
import PerformanceChart from "@/components/PerformanceChart";
import SyncStatus from "@/components/SyncStatus";

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Content Dashboard</h1>
        <SyncStatus />
      </div>
      <MetricCards />
      <PerformanceChart />
      <ContentTable />
    </div>
  );
}