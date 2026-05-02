"use client";

/**
 * PendingProposalsList — Phase 4.4c interactive client component.
 *
 * Replaces the read-only pending-proposals list from §4.4a with confirm
 * buttons. Each row:
 *   - Shows change_type, proposed-by-info, expires_at countdown
 *   - "Confirm" button fires POST .../proposals/[changeId]/confirm
 *   - On 200: row disappears (router.refresh)
 *   - On 409 self_confirm_forbidden: inline message ("You proposed this
 *     — needs another teacher to confirm")
 *   - On 409 expired: inline message ("Expired before confirm")
 *   - On 429/500: inline error message
 *
 * 4.4d will add the 3-way diff modal (proposed-before → current-now →
 * after) to surface staleness when current value moved during the 48h
 * window.
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

export function PendingProposalsList({
  schoolId,
  currentUserId,
  proposals,
}: Props) {
  const router = useRouter();
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

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
      // Success — refresh server data; row will disappear from the list
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
                      onClick={() => confirm(p)}
                      disabled={state.status === "saving"}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
                    >
                      {state.status === "saving" ? "Confirming…" : "Confirm"}
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
        teacher. 3-way diff modal (showing if current value changed during the
        48h window) lands in Phase 4.4d.
      </p>
    </section>
  );
}
