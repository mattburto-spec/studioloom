"use client";

import { useState, useEffect } from "react";
import CostOverview from "@/components/admin/costs/CostOverview";

export default function CostsPage() {
  const [data, setData] = useState<Parameters<typeof CostOverview>[0]["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/monitors?monitor=cost")
      .then((r) => r.json())
      .then((result) => {
        if (result.cost) {
          setData({
            todayUSD: result.cost.todayUSD,
            weekUSD: result.cost.weekUSD,
            monthUSD: result.cost.monthUSD,
            dailyBreakdown: result.cost.dailyBreakdown,
            alerts: result.cost.alerts,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <h2 className="text-lg font-bold text-gray-900 mb-6">Cost & Usage</h2>
      {loading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading cost data...</div>
      ) : data ? (
        <CostOverview data={data} />
      ) : (
        <div className="text-gray-400 text-sm py-8 text-center">No cost data available</div>
      )}
    </div>
  );
}
