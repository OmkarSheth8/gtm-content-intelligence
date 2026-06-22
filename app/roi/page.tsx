export const dynamic = "force-dynamic";

import { getROIData } from "@/lib/dashboardData";
import ROIChart from "@/components/ROIChart";

export default async function ROIPage() {
  const { events, estimatedPipeline, assumptions } = await getROIData();

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">ROI Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Directional proxy funnel: views → tracked clicks → demo requests →
          estimated pipeline.
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