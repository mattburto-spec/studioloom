"use client";

import { useEffect, useState } from "react";

interface StudentRow {
  studentId: string;
  username: string;
  displayName: string | null;
  schoolId: string | null;
  schoolName: string | null;
  tokensUsedToday: number;
  resetAt: string;
  percentOfEstimatedCap: number;
  hasOverride: boolean;
  overrideCap: number | null;
}

interface BudgetData {
  summary: {
    totalStudents: number;
    activeToday: number;
    totalTokensToday: number;
    studentsApproachingCap: number;
    studentsAtCap: number;
  };
  students: StudentRow[];
  tierDefaults: Record<string, number>;
}

function pctColor(pct: number): string {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-amber-500";
  if (pct >= 50) return "bg-blue-500";
  return "bg-green-500";
}

function relativeReset(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return "now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(ms / (1000 * 60))}m`;
  return `${hours}h`;
}

export default function AIBudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-budget")
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
        <div className="text-gray-400 text-sm text-center py-12">Loading AI budget…</div>
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

  const activeStudents = data.students.filter((s) => s.tokensUsedToday > 0);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">AI Budget</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Per-student daily token use. Cascade: student override → class → school → schools.default → tier default.
          Real cap is resolved per-AI-call by withAIBudget middleware; this view shows today&apos;s burn against the
          pro-tier baseline of {data.tierDefaults.pro?.toLocaleString() ?? "100,000"} tokens.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard label="Students with state" value={data.summary.totalStudents} />
        <SummaryCard label="Active today" value={data.summary.activeToday} />
        <SummaryCard label="Tokens today" value={data.summary.totalTokensToday.toLocaleString()} />
        <SummaryCard
          label="Approaching cap"
          value={data.summary.studentsApproachingCap}
          highlight={data.summary.studentsApproachingCap > 0 ? "amber" : undefined}
        />
        <SummaryCard
          label="At cap"
          value={data.summary.studentsAtCap}
          highlight={data.summary.studentsAtCap > 0 ? "red" : undefined}
        />
      </div>

      {/* Tier defaults */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Tier defaults (daily token cap)</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Object.entries(data.tierDefaults).map(([tier, cap]) => (
            <div key={tier} className="bg-white border border-gray-200 rounded-lg px-3 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">{tier}</div>
              <div className="text-sm font-mono text-gray-900">{cap.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active students table */}
      {activeStudents.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg px-6 py-12 text-center text-sm text-gray-500">
          No student has used any AI tokens today. Pre-pilot baseline.
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Active students today ({activeStudents.length})
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2 text-left">Student</th>
                  <th className="px-4 py-2 text-left">School</th>
                  <th className="px-4 py-2 text-right">Tokens today</th>
                  <th className="px-4 py-2 text-right">% of cap</th>
                  <th className="px-4 py-2 text-left">Resets in</th>
                  <th className="px-4 py-2 text-left">Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeStudents.map((s) => (
                  <tr key={s.studentId}>
                    <td className="px-4 py-2 font-medium text-gray-900">
                      {s.displayName || s.username}
                      <div className="text-[10px] text-gray-400 font-mono">{s.username}</div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{s.schoolName || "(no school)"}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-900">
                      {s.tokensUsedToday.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${pctColor(s.percentOfEstimatedCap)}`}
                            style={{ width: `${Math.min(100, s.percentOfEstimatedCap)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-gray-700 w-10 text-right">
                          {s.percentOfEstimatedCap}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-600 text-xs">{relativeReset(s.resetAt)}</td>
                    <td className="px-4 py-2 text-xs">
                      {s.hasOverride ? (
                        <span className="text-purple-700 font-mono">{s.overrideCap?.toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  highlight?: "amber" | "red";
}) {
  const borderClass =
    highlight === "red"
      ? "border-red-300 bg-red-50"
      : highlight === "amber"
        ? "border-amber-300 bg-amber-50"
        : "border-gray-200 bg-white";
  const textClass =
    highlight === "red" ? "text-red-900" : highlight === "amber" ? "text-amber-900" : "text-gray-900";
  return (
    <div className={`border rounded-lg px-4 py-3 ${borderClass}`}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${textClass}`}>{value}</div>
    </div>
  );
}
