"use client";

import { useState, useEffect } from "react";

interface AuditEntry {
  id: string;
  source: string;
  action: string;
  actor: string | null;
  target: string | null;
  details: string | null;
  created_at: string;
}

const SOURCE_OPTIONS = ["", "admin", "feedback", "moderation", "removal"];
const SOURCE_LABELS: Record<string, string> = {
  "": "All Sources",
  admin: "Admin Actions",
  feedback: "Feedback Queue",
  moderation: "Content Moderation",
  removal: "Data Removal",
};

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState("");

  useEffect(() => {
    setLoading(true);
    const url = source ? `/api/admin/audit-log?source=${source}` : "/api/admin/audit-log";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setEntries(data.entries || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [source]);

  const exportCsv = () => {
    const csv = [
      "Date,Source,Action,Actor,Target,Details",
      ...entries.map((e) =>
        `"${e.created_at}","${e.source}","${e.action}","${e.actor || ""}","${e.target || ""}","${(e.details || "").replace(/"/g, '""')}"`
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading audit log...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  const sourceColor: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    feedback: "bg-blue-100 text-blue-700",
    moderation: "bg-amber-100 text-amber-700",
    removal: "bg-red-100 text-red-700",
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Audit Log</h2>
          <p className="text-sm text-gray-500">{entries.length} entries from {source ? SOURCE_LABELS[source] : "all sources"}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white text-gray-700"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
            ))}
          </select>
          <button
            onClick={exportCsv}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            Export CSV
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No audit log entries</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Action</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Actor</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Target</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${sourceColor[e.source] || "bg-gray-100 text-gray-600"}`}>
                      {e.source}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs font-medium text-gray-700">{e.action}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">
                    {e.actor ? `${e.actor.slice(0, 8)}...` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{e.target || "—"}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{e.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
