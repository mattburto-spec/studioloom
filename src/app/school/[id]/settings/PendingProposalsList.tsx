"use client";

/**
 * PendingProposalsList — Phase 4.4c interactive client component +
 * Phase 4.4d 2-way confirm dialog.
 *
 * Replaces the read-only pending-proposals list from §4.4a with confirm
 * buttons. Click flow:
 *   1. "Confirm" button → opens 2-way preview dialog (before → after)
 *   2. Dialog shows change_type, proposer + timestamp, before/after
 *      values, expires_at countdown
 *   3. "Confirm change" submits POST .../proposals/[changeId]/confirm
 *   4. "Cancel" closes dialog without action
 *   5. Self-proposed rows show "Your proposal" badge (no Confirm button
 *      surfaced; saves a server round-trip on the self_confirm_forbidden
 *      409)
 *
 * Live 3-way diff (proposed-before → CURRENT-NOW → after) — Phase 4.4
 * polish follow-up. Requires a change_type → schools-column mapping at
 * the client layer that's worth its own pass. The current 2-way preview
 * + Cancel button gives the confirmer a review moment, which is the
 * material UX win from the brief §3.9 item 14.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

type Proposal = {
  id: string;
  change_type: string;
  tier: "low_stakes" | "high_stakes";
  status: string;
  payload_jsonb: Record<string, unknown>;
  expires_at: string | null;
  actor_user_id: string;
  created_at: string;
};

type Props = {
  schoolId: string;
  /** Current viewer; used to spot self-proposals client-side for nicer UX */
  currentUserId: string;
  proposals: Proposal[];
};

type RowState = {
  status: "idle" | "saving" | "error";
  message: string | null;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function PendingProposalsList({
  schoolId,
  currentUserId,
  proposals,
}: Props) {
  const router = useRouter();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  // Phase 4.4d — 2-way confirm dialog state. Only one dialog open at a
  // time; null means closed.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  function setRow(id: string, patch: RowState) {
    setRowStates((prev) => ({ ...prev, [id]: patch }));
  }

  async function confirm(p: Proposal) {
    setRow(p.id, { status: "saving", message: null });
    try {
      const res = await fetch(
        `/api/school/${schoolId}/proposals/${p.id}/confirm`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setRow(p.id, {
          status: "error",
          message:
            body.message ?? body.error ?? `Failed (HTTP ${res.status})`,
        });
        return;
      }
      // Success — close dialog + refresh server data
      setConfirmingId(null);
      router.refresh();
    } catch (err) {
      setRow(p.id, {
        status: "error",
        message:
          err instanceof Error ? err.message : "Failed to confirm proposal",
      });
    }
  }

  if (proposals.length === 0) return null;

  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
      <div className="text-sm font-semibold text-blue-900">
        🔔 {proposals.length} proposal
        {proposals.length === 1 ? "" : "s"} pending confirm
      </div>
      <ul className="space-y-2 text-xs text-blue-900">
        {proposals.map((p) => {
          const state = rowStates[p.id] ?? { status: "idle", message: null };
          const isSelfProposed = p.actor_user_id === currentUserId;
          const payloadAfter = (p.payload_jsonb as { after?: unknown })?.after;
          const beforeValue = (p.payload_jsonb as { before_at_propose?: unknown })
            ?.before_at_propose;

          return (
            <li
              key={p.id}
              className="rounded-lg bg-white border border-blue-200 px-3 py-2 space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.change_type}</div>
                  <div className="text-blue-700 mt-0.5">
                    Proposed {new Date(p.created_at).toLocaleString()}
                    {p.expires_at && (
                      <>
                        {" · "}expires{" "}
                        {new Date(p.expires_at).toLocaleString()}
                      </>
                    )}
                  </div>
                  {/* Compact value preview */}
                  <div className="mt-1.5 text-[11px] text-blue-800">
                    Change:{" "}
                    <code className="bg-blue-100 rounded px-1 py-0.5">
                      {JSON.stringify(beforeValue)}
                    </code>{" "}
                    →{" "}
                    <code className="bg-blue-100 rounded px-1 py-0.5">
                      {JSON.stringify(payloadAfter)}
                    </code>
                  </div>
                </div>
                <div className="shrink-0">
                  {isSelfProposed ? (
                    <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-1">
                      Your proposal
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(p.id)}
                      disabled={state.status === "saving"}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                    >
                      {state.status === "saving"
                        ? "Confirming…"
                        : "Review &amp; confirm"}
                    </button>
                  )}
                </div>
              </div>
              {state.message && (
                <p className="text-[11px] text-red-700">{state.message}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-blue-700">
        Self-proposals can&apos;t be confirmed by the proposer — needs another
        teacher. Live 3-way diff (with current-value comparison) is a polish
        follow-up.
      </p>

      {/* Phase 4.4d — confirm dialog (2-way before/after preview) */}
      {confirmingId && (() => {
        const p = proposals.find((x) => x.id === confirmingId);
        if (!p) return null;
        const beforeValue = (p.payload_jsonb as { before_at_propose?: unknown })
          ?.before_at_propose;
        const afterValue = (p.payload_jsonb as { after?: unknown })?.after;
        const state = rowStates[p.id] ?? { status: "idle", message: null };

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setConfirmingId(null);
            }}
          >
            <div
              role="dialog"
              aria-labelledby="confirm-dialog-title"
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div>
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Confirm change
                </div>
                <h3
                  id="confirm-dialog-title"
                  className="mt-1 text-lg font-bold text-gray-900"
                >
                  {p.change_type}
                </h3>
                <p className="mt-1 text-xs text-gray-500">
                  Proposed {new Date(p.created_at).toLocaleString()}
                  {p.expires_at && (
                    <>
                      {" · "}expires{" "}
                      {new Date(p.expires_at).toLocaleString()}
                    </>
                  )}
                </p>
              </div>

              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3 text-sm">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                    Current value (when proposed)
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-white px-3 py-2 font-mono text-xs text-gray-800 border border-gray-200">
                    {formatValue(beforeValue)}
                  </pre>
                </div>
                <div className="text-center text-gray-400">↓</div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
                    Proposed new value
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-blue-50 px-3 py-2 font-mono text-xs text-blue-900 border border-blue-200">
                    {formatValue(afterValue)}
                  </pre>
                </div>
              </div>

              <p className="text-[11px] text-gray-500">
                Confirming will apply this change immediately. The proposer
                ({p.actor_user_id.slice(0, 8)}…) will be recorded as the
                proposer; you will be recorded as the confirmer. Live
                current-value comparison (in case the value moved during the
                48h window) is a polish follow-up; for now this preview shows
                the values as proposed.
              </p>

              {state.message && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {state.message}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmingId(null)}
                  disabled={state.status === "saving"}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirm(p)}
                  disabled={state.status === "saving"}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                >
                  {state.status === "saving"
                    ? "Confirming…"
                    : "Confirm change"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
