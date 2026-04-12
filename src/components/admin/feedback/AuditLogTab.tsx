"use client";

import { useState, useEffect } from "react";

/**
 * §5.4: Read and render feedback_audit_log with who/when/why.
 */

interface AuditEntry {
  id: string;
  proposal_id: string;
  block_id: string;
  action: string;
  field: string;
  previous_value: unknown;
  new_value: unknown;
  evidence_count: number;
  resolved_by: string | null;
  note: string | null;
  created_at: string;
}

export default function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/feedback/audit-log");
        if (!res.ok) throw new Error("Failed to load audit log");
        const data = await res.json();
        setEntries(data.entries ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="text-gray-500 text-sm py-8 text-center">Loading audit log...</div>;
  }

  if (error) {
    return <div className="bg-red-50 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>;
  }

  if (entries.length === 0) {
    return <div className="text-gray-400 text-sm py-8 text-center">No audit log entries yet.</div>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Audit Log ({entries.length} entries)
      </h3>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Date</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">Field</th>
              <th className="text-left px-3 py-2 font-medium">Change</th>
              <th className="text-left px-3 py-2 font-medium">Evidence</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500">
                  {new Date(entry.created_at).toLocaleDateString()}{" "}
                  {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td className="px-3 py-2">
                  <ActionBadge action={entry.action} />
                </td>
                <td className="px-3 py-2 text-gray-700 font-mono">{entry.field}</td>
                <td className="px-3 py-2 text-gray-700">
                  {formatValue(entry.previous_value)} → {formatValue(entry.new_value)}
                </td>
                <td className="px-3 py-2 text-gray-500">{entry.evidence_count}</td>
                <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                  {entry.note || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
    modified: "bg-blue-100 text-blue-700",
    auto_approved: "bg-purple-100 text-purple-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full font-medium ${styles[action] ?? "bg-gray-100 text-gray-700"}`}>
      {action.replace("_", " ")}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") return value.toFixed(1);
  return String(value);
}
