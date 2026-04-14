"use client";

import { useState, useEffect } from "react";

interface TeacherCost {
  teacherId: string;
  ingestion: number;
  generation: number;
  student_api: number;
  teacher_api: number;
  total: number;
  runCount: number;
}

interface DailyCost {
  date: string;
  cost: number;
}

interface CostData {
  period: string;
  summary: { totalCost: number; totalRuns: number; avgCostPerRun: number };
  teachers: TeacherCost[];
  dailyCosts: DailyCost[];
  thresholds: Record<string, number>;
}

export default function CostUsagePage() {
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30d");
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/cost-usage?period=${period}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading cost data...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;
  if (!data) return null;

  const dailyCeiling = data.thresholds["pipeline.cost_ceiling_per_day_usd"] || 50;
  const todayCost = data.dailyCosts[data.dailyCosts.length - 1]?.cost || 0;
  const overBudget = todayCost > dailyCeiling;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Cost & Usage</h2>
          <p className="text-sm text-gray-500">Per-teacher profitability across 4 cost categories</p>
        </div>
        <div className="flex gap-1">
          {["7d", "30d", "all"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                period === p
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p === "all" ? "All time" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Cost</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${data.summary.totalCost.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Runs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.summary.totalRuns}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Cost / Run</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${data.summary.avgCostPerRun.toFixed(3)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${overBudget ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Today vs Budget</p>
          <p className={`text-2xl font-bold mt-1 ${overBudget ? "text-red-600" : "text-gray-900"}`}>
            ${todayCost.toFixed(2)} / ${dailyCeiling}
          </p>
        </div>
      </div>

      {/* Daily Cost Trend */}
      {data.dailyCosts.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily Cost Trend</h3>
          <div className="flex items-end gap-1 h-32">
            {data.dailyCosts.slice(-30).map((d) => {
              const maxCost = Math.max(...data.dailyCosts.map((x) => x.cost), 0.01);
              const height = Math.max((d.cost / maxCost) * 100, 2);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center" title={`${d.date}: $${d.cost.toFixed(3)}`}>
                  <div
                    className={`w-full rounded-t ${d.cost > dailyCeiling ? "bg-red-400" : "bg-purple-400"}`}
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-gray-400">{data.dailyCosts[0]?.date}</span>
            <span className="text-[10px] text-gray-400">{data.dailyCosts[data.dailyCosts.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Per-Teacher Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Teacher</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Ingestion</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Generation</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Student API</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Teacher API</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Runs</th>
            </tr>
          </thead>
          <tbody>
            {data.teachers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No cost data yet</td></tr>
            )}
            {data.teachers.map((t) => (
              <tr
                key={t.teacherId}
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                onClick={() => setExpandedTeacher(expandedTeacher === t.teacherId ? null : t.teacherId)}
              >
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{t.teacherId.slice(0, 8)}...</td>
                <td className="px-4 py-2 text-right text-gray-600">${t.ingestion.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-600">${t.generation.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-600">${t.student_api.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-600">${t.teacher_api.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900">${t.total.toFixed(2)}</td>
                <td className="px-4 py-2 text-right text-gray-600">{t.runCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            const csv = [
              "Teacher,Ingestion,Generation,Student API,Teacher API,Total,Runs",
              ...data.teachers.map((t) =>
                `${t.teacherId},${t.ingestion.toFixed(2)},${t.generation.toFixed(2)},${t.student_api.toFixed(2)},${t.teacher_api.toFixed(2)},${t.total.toFixed(2)},${t.runCount}`
              ),
            ].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `cost-usage-${period}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          Export CSV
        </button>
      </div>
    </div>
  );
}
