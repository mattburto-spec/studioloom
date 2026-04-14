"use client";

import { useState, useEffect } from "react";
import HealthStrip from "@/components/admin/dashboard/HealthStrip";
import QuickStats from "@/components/admin/dashboard/QuickStats";
import AlertsFeed from "@/components/admin/dashboard/AlertsFeed";

interface HealthData {
  pipeline: { status: string; last24h: { total: number; succeeded: number; failed: number } };
  cost: { status: string; todayUSD: number; weekUSD: number; alerts: string[] };
  quality: { status: string; thisWeekAvg: number | null };
  stale: { status: string };
  usage: { activeTeachers: number; activeStudents: number; totalUnits: number; totalBlocks: number; bugReportCount: number | null };
  overallAlerts: string[];
  sparklines: { runs: number[]; cost: number[] };
}

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [smokeResult, setSmokeResult] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const runSmokeTests = async () => {
    setSmokeResult("Running...");
    try {
      const res = await fetch("/api/admin/smoke-tests", { method: "POST" });
      const data = await res.json();
      setSmokeResult(`${data.passed}/${data.total} passed`);
    } catch {
      setSmokeResult("Failed to run");
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-gray-400 text-sm text-center py-12">Loading health data...</div>
      </div>
    );
  }

  const lights = health
    ? [
        { label: "Pipeline", status: health.pipeline.status as "green" | "amber" | "red", detail: `${health.pipeline.last24h.succeeded}/${health.pipeline.last24h.total} succeeded` },
        { label: "Library", status: (health.usage.totalBlocks > 0 ? "green" : "amber") as "green" | "amber" | "red", detail: `${health.usage.totalBlocks} blocks` },
        { label: "Cost", status: health.cost.status as "green" | "amber" | "red", detail: `$${health.cost.todayUSD.toFixed(2)} today` },
        { label: "Quality", status: health.quality.status as "green" | "amber" | "red", detail: health.quality.thisWeekAvg ? `Pulse ${health.quality.thisWeekAvg.toFixed(1)}` : "No data" },
        { label: "Wiring", status: (smokeResult?.includes("/") && !smokeResult.startsWith("0") ? "green" : "amber") as "green" | "amber" | "red", detail: smokeResult || "Not run" },
      ]
    : [];

  const stats = health
    ? [
        { label: "Teachers", value: health.usage.activeTeachers },
        { label: "Students", value: health.usage.activeStudents },
        { label: "Units", value: health.usage.totalUnits },
        { label: "Blocks", value: health.usage.totalBlocks, sparkline: health.sparklines.runs },
        { label: "Bug Reports", value: health.usage.bugReportCount ?? "—" },
        { label: "Cost (7d)", value: `$${health.cost.weekUSD.toFixed(2)}`, sparkline: health.sparklines.cost },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">System Health</h2>
        <button
          onClick={runSmokeTests}
          className="text-xs px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          {smokeResult === "Running..." ? "Running..." : "Run Smoke Tests"}
        </button>
      </div>

      <HealthStrip lights={lights} />
      <QuickStats stats={stats} />

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Alerts</h3>
        <AlertsFeed alerts={health?.overallAlerts || []} />
      </div>
    </div>
  );
}
