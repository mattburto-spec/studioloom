"use client";

import { useState, useEffect } from "react";

interface QualityData {
  recentAlerts: Array<{ id: string; type: string; severity: string; message: string; created_at: string }>;
  efficacyStats: { avg: number; min: number; max: number; count: number };
  recentProposals: Array<{ id: string; block_id: string; proposed_score: number; current_score: number; status: string; created_at: string }>;
}

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/monitors?type=quality-drift").then((r) => r.json()),
      fetch("/api/admin/library?limit=1000").then((r) => r.json()),
      fetch("/api/admin/feedback?status=pending&limit=20").then((r) => r.json()),
    ])
      .then(([alertsRes, libraryRes, proposalsRes]) => {
        const blocks = libraryRes.blocks || [];
        const scores = blocks.map((b: { efficacy_score?: number }) => b.efficacy_score ?? 50).filter((s: number) => s > 0);

        setData({
          recentAlerts: alertsRes.alerts || [],
          efficacyStats: {
            avg: scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0,
            min: scores.length ? Math.min(...scores) : 0,
            max: scores.length ? Math.max(...scores) : 0,
            count: scores.length,
          },
          recentProposals: proposalsRes.proposals || [],
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading quality data...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;
  if (!data) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Quality</h2>
        <p className="text-sm text-gray-500">Generation quality drift, efficacy trends, and feedback proposals</p>
      </div>

      {/* Efficacy Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Efficacy</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.efficacyStats.avg.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Min / Max</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.efficacyStats.min.toFixed(0)} / {data.efficacyStats.max.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Blocks Tracked</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.efficacyStats.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Pending Proposals</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.recentProposals.length}</p>
        </div>
      </div>

      {/* Quality Drift Alerts */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality Drift Alerts</h3>
        {data.recentAlerts.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No quality drift detected</p>
        ) : (
          <div className="space-y-2">
            {data.recentAlerts.map((a) => (
              <div
                key={a.id}
                className={`px-3 py-2 rounded-lg text-sm ${
                  a.severity === "critical" ? "bg-red-50 text-red-700" :
                  a.severity === "warning" ? "bg-amber-50 text-amber-700" :
                  "bg-blue-50 text-blue-700"
                }`}
              >
                <span className="font-medium">{a.type}</span>: {a.message}
                <span className="text-xs ml-2 opacity-60">{new Date(a.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Feedback Proposals */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent Feedback Proposals</h3>
        {data.recentProposals.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No pending proposals</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-3 py-1.5 text-xs text-gray-500">Block</th>
                <th className="text-right px-3 py-1.5 text-xs text-gray-500">Current</th>
                <th className="text-right px-3 py-1.5 text-xs text-gray-500">Proposed</th>
                <th className="text-right px-3 py-1.5 text-xs text-gray-500">Delta</th>
                <th className="text-right px-3 py-1.5 text-xs text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentProposals.map((p) => {
                const delta = p.proposed_score - p.current_score;
                return (
                  <tr key={p.id} className="border-b border-gray-50">
                    <td className="px-3 py-1.5 font-mono text-xs">{p.block_id.slice(0, 8)}...</td>
                    <td className="px-3 py-1.5 text-right">{p.current_score}</td>
                    <td className="px-3 py-1.5 text-right">{p.proposed_score}</td>
                    <td className={`px-3 py-1.5 text-right font-medium ${delta > 0 ? "text-green-600" : "text-red-600"}`}>
                      {delta > 0 ? "+" : ""}{delta.toFixed(1)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        p.status === "pending" ? "bg-amber-100 text-amber-700" :
                        p.status === "approved" ? "bg-green-100 text-green-700" :
                        "bg-red-100 text-red-700"
                      }`}>{p.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
