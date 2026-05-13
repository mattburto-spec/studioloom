"use client";

/**
 * /teacher/classes/[classId]/dj-constraints
 *
 * Phase 6 constraints panel. Lets the teacher:
 *   - see current persistent vetoes for the class (with occurrences +
 *     last-seen date)
 *   - manually expire any of them
 *   - reset the fairness ledger (with confirmation)
 *
 * Per brief §11 Q6 (Phase 3 decision) this is the ONLY teacher
 * dashboard surface in v1. Trolling counter + per-seat voice-weight
 * history defer to FU-DJ-TEACHER-DASHBOARD.
 *
 * Brief: docs/projects/class-dj-block-brief.md §7 (constraints panel).
 */

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";

interface PersistentVeto {
  veto: string;
  occurrences: number;
  last_seen: string;
}

interface LedgerSummary {
  total_participants: number;
  unserved_count: number;
}

interface LastReset {
  reset_at: string;
  reset_by: string;
  rounds_since_last_reset: number;
  rows_cleared: number;
}

interface ConstraintsResponse {
  persistent_vetoes: PersistentVeto[];
  ledger_summary: LedgerSummary;
  last_reset: LastReset | null;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
}

export default function DjConstraintsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);

  const [data, setData] = useState<ConstraintsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const fetchConstraints = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/class-dj/constraints/${classId}`, {
        credentials: "same-origin",
      });
      const body = (await res.json()) as ConstraintsResponse | { error: string };
      if (!res.ok) {
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setData(body as ConstraintsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    fetchConstraints();
  }, [fetchConstraints]);

  async function expireVeto(veto: string) {
    setBusy(`veto:${veto}`);
    try {
      const res = await fetch(`/api/teacher/class-dj/constraints/${classId}/expire-veto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ veto }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      await fetchConstraints();
    } finally {
      setBusy(null);
    }
  }

  async function resetLedger() {
    setBusy("reset");
    try {
      const res = await fetch(`/api/teacher/class-dj/constraints/${classId}/reset-ledger`, {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setResetConfirm(false);
      await fetchConstraints();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-6">
        <Link
          href={`/teacher/classes/${classId}`}
          className="text-sm text-violet-700 hover:underline"
        >
          ← Back to class
        </Link>
        <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
          <span>🎵</span> Class DJ constraints
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Persistent vetoes that have accumulated across the term, and the
          fairness ledger that prevents any single student&apos;s
          preferences from always winning.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading && (
        <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-sm text-gray-500">
          Loading…
        </div>
      )}

      {data && (
        <>
          {/* Persistent vetoes */}
          <section className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Persistent vetoes</h2>
            <p className="text-xs text-gray-600 mb-3">
              Vetoes that have appeared in <strong>≥ 2 rounds in the last 30 days</strong>.
              The AI treats these as standing policy. Vetoes that haven&apos;t
              appeared in 30+ days auto-expire; you can also expire any of
              these manually.
            </p>
            {data.persistent_vetoes.length === 0 ? (
              <div className="rounded-md bg-gray-50 border border-gray-100 p-3 text-sm text-gray-500 italic">
                No persistent vetoes — the class hasn&apos;t echoed any veto twice in 30 days.
              </div>
            ) : (
              <ul className="space-y-2">
                {data.persistent_vetoes.map((v) => (
                  <li
                    key={v.veto}
                    className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-3"
                  >
                    <div>
                      <span className="font-semibold text-sm text-gray-900">
                        &ldquo;{v.veto}&rdquo;
                      </span>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {v.occurrences} occurrences · last seen {daysAgo(v.last_seen)}d ago
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => expireVeto(v.veto)}
                      disabled={busy === `veto:${v.veto}`}
                      className="px-3 py-1.5 rounded text-xs border border-violet-300 text-violet-700 hover:bg-violet-50 disabled:opacity-50"
                    >
                      {busy === `veto:${v.veto}` ? "Expiring…" : "Expire"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Ledger summary + reset */}
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-bold text-gray-900 mb-1">Fairness ledger</h2>
            <p className="text-xs text-gray-600 mb-3">
              Tracks each student&apos;s &ldquo;served score&rdquo; — how often a
              picked suggestion aligned with their vote. Quiet students get a
              small voice-weight bump in the next round so no one&apos;s
              preferences always lose. Reset whenever you want a fresh
              start (e.g., start of term).
            </p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-md bg-violet-50 border border-violet-100 p-3">
                <div className="text-2xl font-bold text-violet-900 tabular-nums">
                  {data.ledger_summary.total_participants}
                </div>
                <div className="text-xs text-violet-700">students with a row</div>
              </div>
              <div className="rounded-md bg-amber-50 border border-amber-100 p-3">
                <div className="text-2xl font-bold text-amber-900 tabular-nums">
                  {data.ledger_summary.unserved_count}
                </div>
                <div className="text-xs text-amber-700">
                  currently unserved (servedScore &lt; 0.4)
                </div>
              </div>
            </div>

            {data.last_reset && (
              <p className="text-[11px] text-gray-500 mb-3">
                Last reset {daysAgo(data.last_reset.reset_at)}d ago by{" "}
                <code>{data.last_reset.reset_by}</code> ·{" "}
                {data.last_reset.rows_cleared} rows cleared after{" "}
                {data.last_reset.rounds_since_last_reset} round(s).
              </p>
            )}

            {!resetConfirm ? (
              <button
                type="button"
                onClick={() => setResetConfirm(true)}
                disabled={busy !== null || data.ledger_summary.total_participants === 0}
                className="px-4 py-2 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reset fairness ledger…
              </button>
            ) : (
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-center gap-3">
                <p className="flex-1 text-xs text-amber-900">
                  Confirm? This clears <strong>{data.ledger_summary.total_participants} ledger row(s)</strong> for
                  this class. Logged to <code>class_dj_ledger_resets</code>.
                </p>
                <button
                  type="button"
                  onClick={() => setResetConfirm(false)}
                  disabled={busy === "reset"}
                  className="px-3 py-1.5 rounded text-xs border border-gray-300 text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={resetLedger}
                  disabled={busy === "reset"}
                  className="px-3 py-1.5 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {busy === "reset" ? "Resetting…" : "Confirm reset"}
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
