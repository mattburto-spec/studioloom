"use client";

import { useEffect, useState } from "react";

interface DeletionRow {
  id: string;
  target_type: string;
  target_id: string;
  scheduled_for: string;
  status: string;
  scheduled_by: string | null;
  hold_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

interface DeletionsData {
  summary: { total: number; pending: number; completed: number; held: number };
  rows: DeletionRow[];
}

function statusPill(status: string): string {
  switch (status) {
    case "pending":
      return "bg-blue-100 text-blue-800";
    case "completed":
      return "bg-gray-100 text-gray-700";
    case "held":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function relativeTime(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));
  if (days >= 1) return ms < 0 ? `${days}d ago` : `in ${days}d`;
  const hours = Math.floor(abs / (1000 * 60 * 60));
  return ms < 0 ? `${hours}h ago` : `in ${hours}h`;
}

export default function DeletionsPage() {
  const [data, setData] = useState<DeletionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "held">("all");

  useEffect(() => {
    fetch("/api/admin/deletions")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-gray-400 text-sm text-center py-12">Loading deletion queue…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="text-red-600 text-sm">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const filtered = filter === "all" ? data.rows : data.rows.filter((r) => r.status === filter);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Scheduled Deletions</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          DSR (data-subject delete requests) + retention-cron output. The scheduled-hard-delete cron processes pending
          rows where scheduled_for &lt; now() at 03:00 UTC daily. Held rows skip processing — admin must clear the hold
          via SQL (no UI for legal-hold clearance yet; FU-DELETION-HOLD-CLEARANCE-UI P3).
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={data.summary.total} />
        <SummaryCard label="Pending" value={data.summary.pending} />
        <SummaryCard label="Completed" value={data.summary.completed} />
        <SummaryCard
          label="Held (legal)"
          value={data.summary.held}
          highlight={data.summary.held > 0 ? "red" : undefined}
        />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(["all", "pending", "completed", "held"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              filter === s ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" &&
              ` (${data.summary[s as "pending" | "completed" | "held"]})`}
          </button>
        ))}
      </div>

      {/* Rows table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-12 text-center text-sm text-gray-500">
          {data.summary.total === 0
            ? "No deletions queued. Pre-pilot baseline."
            : `No ${filter} deletions.`}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Target</th>
                <th className="px-4 py-2 text-left">ID</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Scheduled</th>
                <th className="px-4 py-2 text-left">Hold reason</th>
                <th className="px-4 py-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-medium text-gray-900">{r.target_type}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.target_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusPill(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-700 text-xs">{relativeTime(r.scheduled_for)}</td>
                  <td className="px-4 py-2 text-xs text-red-700">{r.hold_reason || ""}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{relativeTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "red";
}) {
  const borderClass = highlight === "red" ? "border-red-300 bg-red-50" : "border-gray-200 bg-white";
  const textClass = highlight === "red" ? "text-red-900" : "text-gray-900";
  return (
    <div className={`border rounded-lg px-4 py-3 ${borderClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${textClass}`}>{value}</div>
    </div>
  );
}
