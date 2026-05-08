"use client";

import { Fragment, useEffect, useState } from "react";

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

interface BreakdownRow {
  endpoint: string;
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  last_call_at: string;
}

interface BreakdownData {
  studentId: string;
  schoolTimezone: string;
  dayStart: string;
  breakdown: BreakdownRow[];
  totals: {
    calls: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  budgetStateTokens: number | null;
  reconciliationGap: number | null;
}

interface BreakdownState {
  loading: boolean;
  error: string | null;
  data: BreakdownData | null;
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

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function AIBudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, BreakdownState>>({});

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

  function toggleExpand(studentId: string) {
    setExpanded((prev) => {
      const current = prev[studentId];
      if (current) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: { loading: true, error: null, data: null } };
    });

    if (expanded[studentId]) return;

    fetch(`/api/admin/ai-budget/${studentId}/breakdown`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as BreakdownData;
      })
      .then((d) => {
        setExpanded((prev) => ({
          ...prev,
          [studentId]: { loading: false, error: null, data: d },
        }));
      })
      .catch((e: Error) => {
        setExpanded((prev) => ({
          ...prev,
          [studentId]: { loading: false, error: e.message, data: null },
        }));
      });
  }

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
          pro-tier baseline of {data.tierDefaults.pro?.toLocaleString() ?? "100,000"} tokens. Click a row to see
          where today&apos;s tokens went.
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
                  <th className="px-4 py-2 text-left w-6"></th>
                  <th className="px-4 py-2 text-left">Student</th>
                  <th className="px-4 py-2 text-left">School</th>
                  <th className="px-4 py-2 text-right">Tokens today</th>
                  <th className="px-4 py-2 text-right">% of cap</th>
                  <th className="px-4 py-2 text-left">Resets in</th>
                  <th className="px-4 py-2 text-left">Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeStudents.map((s) => {
                  const ex = expanded[s.studentId];
                  const isOpen = !!ex;
                  return (
                    <Fragment key={s.studentId}>
                      <tr
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleExpand(s.studentId)}
                      >
                        <td className="px-4 py-2 text-gray-400 w-6 select-none">{isOpen ? "▾" : "▸"}</td>
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
                      {isOpen ? (
                        <tr className="bg-gray-50">
                          <td colSpan={7} className="px-6 py-4">
                            <BreakdownPanel state={ex} rowTokens={s.tokensUsedToday} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownPanel({ state, rowTokens }: { state: BreakdownState; rowTokens: number }) {
  if (state.loading) {
    return <div className="text-xs text-gray-500">Loading breakdown…</div>;
  }
  if (state.error) {
    return <div className="text-xs text-red-600">Failed to load: {state.error}</div>;
  }
  if (!state.data) return null;

  const { breakdown, totals, schoolTimezone, budgetStateTokens, reconciliationGap } = state.data;

  if (breakdown.length === 0) {
    return (
      <div className="text-xs text-gray-500">
        No <code className="font-mono">ai_usage_log</code> rows for this student today (tz {schoolTimezone}),
        but <code className="font-mono">ai_budget_state.tokens_used_today</code> = {rowTokens.toLocaleString()}. That&apos;s a reconciliation
        gap — some AI call site is incrementing the budget without going through <code className="font-mono">logUsage()</code>.
      </div>
    );
  }

  const gapMeaningful = reconciliationGap !== null && Math.abs(reconciliationGap) > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          <span className="font-semibold">Today&apos;s breakdown</span>
          <span className="text-gray-400"> · school tz {schoolTimezone}</span>
        </div>
        <div className="text-[11px] text-gray-500">
          {totals.calls} call{totals.calls === 1 ? "" : "s"} · {totals.total_tokens.toLocaleString()} tokens logged
          {budgetStateTokens !== null
            ? ` · ${budgetStateTokens.toLocaleString()} on budget state`
            : ""}
        </div>
      </div>

      {gapMeaningful ? (
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          Reconciliation gap: budget state is{" "}
          <span className="font-mono">{(reconciliationGap ?? 0).toLocaleString()}</span>{" "}
          tokens {(reconciliationGap ?? 0) > 0 ? "ahead of" : "behind"} the sum of logged calls.
          {(reconciliationGap ?? 0) > 0
            ? " Some AI call site bypasses logUsage() (counter increments without a row)."
            : " More logged than billed — possible double-log or pre-billing-state row."}
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 text-[10px] text-gray-500 uppercase tracking-wider">
            <tr>
              <th className="px-3 py-1.5 text-left">Endpoint</th>
              <th className="px-3 py-1.5 text-left">Model</th>
              <th className="px-3 py-1.5 text-right">Calls</th>
              <th className="px-3 py-1.5 text-right">Input</th>
              <th className="px-3 py-1.5 text-right">Output</th>
              <th className="px-3 py-1.5 text-right">Total</th>
              <th className="px-3 py-1.5 text-left">Last call</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {breakdown.map((r) => (
              <tr key={`${r.endpoint}__${r.model}`}>
                <td className="px-3 py-1.5 font-mono text-gray-900">{r.endpoint}</td>
                <td className="px-3 py-1.5 font-mono text-gray-600 text-[11px]">{r.model}</td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-700">{r.calls.toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                  {r.input_tokens.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-700">
                  {r.output_tokens.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-900">
                  {r.total_tokens.toLocaleString()}
                </td>
                <td className="px-3 py-1.5 text-gray-500 text-[11px]" title={r.last_call_at}>
                  {relativeAgo(r.last_call_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
