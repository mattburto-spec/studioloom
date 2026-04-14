"use client";

import { useState, useEffect, useCallback } from "react";

interface BugReport {
  id: string;
  reporter_id: string | null;
  reporter_role: string | null;
  class_id: string | null;
  category: string;
  description: string;
  screenshot_url: string | null;
  page_url: string | null;
  console_errors: unknown[] | null;
  status: string;
  admin_notes: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_OPTIONS = ["new", "investigating", "fixed", "closed"];
const CATEGORY_OPTIONS = ["broken", "looks_wrong", "confused", "feature_request"];

export default function BugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const loadReports = useCallback(() => {
    const url = filterStatus ? `/api/admin/bug-reports?status=${filterStatus}` : "/api/admin/bug-reports";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setReports(data.reports || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [filterStatus]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateReport = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/bug-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading bug reports...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  const statusCounts: Record<string, number> = {};
  for (const r of reports) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Bug Reports</h2>
          <p className="text-sm text-gray-500">{reports.length} report{reports.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterStatus("")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
              !filterStatus ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({reports.length})
          </button>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition capitalize ${
                filterStatus === s ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s} ({statusCounts[s] || 0})
            </button>
          ))}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No bug reports{filterStatus ? ` with status "${filterStatus}"` : ""}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "new" ? "bg-blue-100 text-blue-700" :
                    r.status === "investigating" ? "bg-amber-100 text-amber-700" :
                    r.status === "fixed" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{r.status}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{r.category}</span>
                  <p className="text-sm text-gray-900">{r.description.slice(0, 100)}{r.description.length > 100 ? "..." : ""}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              {expandedId === r.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <p className="text-sm text-gray-700">{r.description}</p>

                  {r.page_url && (
                    <p className="text-xs text-gray-500">Page: <span className="font-mono">{r.page_url}</span></p>
                  )}
                  {r.reporter_role && (
                    <p className="text-xs text-gray-500">Reporter: {r.reporter_role} ({r.reporter_id?.slice(0, 8)}...)</p>
                  )}
                  {r.console_errors && (r.console_errors as unknown[]).length > 0 && (
                    <details className="text-xs">
                      <summary className="text-gray-500 cursor-pointer">Console errors ({(r.console_errors as unknown[]).length})</summary>
                      <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(r.console_errors, null, 2)}
                      </pre>
                    </details>
                  )}

                  {r.admin_notes && (
                    <div className="p-2 bg-purple-50 rounded-lg text-xs text-purple-700">
                      <strong>Admin notes:</strong> {r.admin_notes}
                    </div>
                  )}

                  <div className="flex gap-2">
                    {STATUS_OPTIONS.filter((s) => s !== r.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateReport(r.id, { status: s })}
                        disabled={updating === r.id}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 transition capitalize"
                      >
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
