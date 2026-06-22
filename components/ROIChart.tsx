"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface EventCount {
  eventType: string;
  count: number;
}

interface Assumptions {
  averageContractValue: number;
  demoToOpportunityRate: number;
  opportunityCloseRate: number;
}

interface Props {
  events: EventCount[];
  estimatedPipeline: number;
  assumptions: Assumptions;
}

const FUNNEL_ORDER = ["landing_page_view", "click", "demo_request", "lead"];
const FUNNEL_LABELS: Record<string, string> = {
  landing_page_view: "Landing Views",
  click: "Tracked Clicks",
  demo_request: "Demo Requests",
  lead: "Leads",
};
const COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"];

export default function ROIChart({ events, estimatedPipeline, assumptions }: Props) {
  const funnelData = FUNNEL_ORDER.map((type, i) => {
    const match = events.find((e) => e.eventType === type);
    return {
      name: FUNNEL_LABELS[type] ?? type,
      count: match?.count ?? 0,
      color: COLORS[i],
    };
  });

  const demoCount = events.find((e) => e.eventType === "demo_request")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Funnel bar chart */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-sm font-medium">Proxy Funnel</h2>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={funnelData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                formatter={(v) => [Number(v).toLocaleString(), "Events"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {funnelData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline estimate */}
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
        <h2 className="text-sm font-medium mb-4">Estimated Pipeline</h2>
        <div className="flex items-end gap-3 mb-6">
          <span className="text-3xl font-semibold">
            ${estimatedPipeline.toLocaleString()}
          </span>
          <span className="mb-1 text-xs text-zinc-400 italic">
            directional — not exact
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Demo Requests
            </p>
            <p className="mt-1 font-semibold">{demoCount}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Demo → Opp
            </p>
            <p className="mt-1 font-semibold">
              {(assumptions.demoToOpportunityRate * 100).toFixed(0)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide">
              Opp → Close
            </p>
            <p className="mt-1 font-semibold">
              {(assumptions.opportunityCloseRate * 100).toFixed(0)}%
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          Assumed ACV: ${assumptions.averageContractValue.toLocaleString()} · Formula:{" "}
          {demoCount} demos × {(assumptions.demoToOpportunityRate * 100).toFixed(0)}% ×{" "}
          {(assumptions.opportunityCloseRate * 100).toFixed(0)}% × $
          {assumptions.averageContractValue.toLocaleString()}
        </p>
      </div>
    </div>
  );
}