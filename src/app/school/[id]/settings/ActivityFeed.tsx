"use client";

/**
 * ActivityFeed — Phase 4.4c interactive client component.
 *
 * Replaces the read-only recent-changes list from §4.4a with revert
 * buttons. Each row:
 *   - Shows change_type + status pill + applied/reverted timestamp
 *   - For 'applied' rows within 7-day window: "Revert" button
 *   - For 'applied' rows outside 7-day window: "Outside revert window"
 *   - For 'reverted' / 'expired' rows: no action button
 *   - On revert success: row's status pill flips to 'reverted'
 *     (router.refresh)
 *   - On 409 not_applied / outside_revert_window: inline message
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Change = {
  id: string;
  change_type: string;
  tier: "low_stakes" | "high_stakes";
  status: "applied" | "reverted" | "expired";
  payload_jsonb: Record<string, unknown>;
  applied_at: string | null;
  reverted_at: string | null;
  actor_user_id: string;
  confirmed_by_user_id: string | null;
  reverted_by_user_id: string | null;
  created_at: string;
};

type Props = {
  schoolId: string;
  changes: Change[];
};

const REVERT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type RowState = {
  status: "idle" | "saving" | "error";
  message: string | null;
};

function formatTimestamp(ts: string | null): string {
  if (!ts) return "";
  return new Date(ts).toLocaleString();
}

function statusPillClass(status: Change["status"]): string {
  if (status === "applied") return "bg-green-100 text-green-800";
  if (status === "reverted") return "bg-orange-100 text-orange-800";
  return "bg-gray-200 text-gray-700"; // expired
}

export function ActivityFeed({ schoolId, changes }: Props) {
  const router = useRouter();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  function setRow(id: string, patch: RowState) {
    setRowStates((prev) => ({ ...prev, [id]: patch }));
  }

  async function revert(c: Change) {
    setRow(c.id, { status: "saving", message: null });
    try {
      const res = await fetch(
        `/api/school/${schoolId}/changes/${c.id}/revert`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setRow(c.id, {
          status: "error",
          message:
            body.message ?? body.error ?? `Failed (HTTP ${res.status})`,
        });
        return;
      }
      router.refresh();
    } catch (err) {
      setRow(c.id, {
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to revert change",
      });
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">
        Recent Activity (last 30 days)
      </h2>
      {changes.length === 0 ? (
        <p className="text-xs text-gray-500">
          No settings changes yet. The feed will fill in as teachers update
          settings.
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {changes.map((c) => {
            const state = rowStates[c.id] ?? {
              status: "idle",
              message: null,
            };
            const appliedAt = c.applied_at ? new Date(c.applied_at) : null;
            const withinRevertWindow =
              c.status === "applied" &&
              appliedAt !== null &&
              Date.now() - appliedAt.getTime() <= REVERT_WINDOW_MS;

            return (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900">
                    {c.change_type}
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.status === "applied" && c.applied_at && (
                      <>Applied {formatTimestamp(c.applied_at)}</>
                    )}
                    {c.status === "reverted" && c.reverted_at && (
                      <>Reverted {formatTimestamp(c.reverted_at)}</>
                    )}
                    {c.status === "expired" && (
                      <>Expired {formatTimestamp(c.created_at)}</>
                    )}
                  </div>
                  {state.message && (
                    <p className="text-[11px] text-red-700 mt-1">
                      {state.message}
                    </p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                      statusPillClass(c.status)
                    }
                  >
                    {c.status}
                  </span>
                  {withinRevertWindow && (
                    <button
                      type="button"
                      onClick={() => revert(c)}
                      disabled={state.status === "saving"}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                    >
                      {state.status === "saving" ? "Reverting…" : "Revert"}
                    </button>
                  )}
                  {c.status === "applied" && !withinRevertWindow && (
                    <span className="text-[10px] text-gray-400 italic">
                      revert window closed
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-gray-400">
        7-day revert window per change. Same-school teachers can revert any
        applied change. Reverted changes remain in the audit trail.
      </p>
    </section>
  );
}
