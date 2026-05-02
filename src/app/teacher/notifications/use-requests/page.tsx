"use client";

/**
 * /teacher/notifications/use-requests — Phase 4.6.
 *
 * Two-column inbox/outbox for unit-use requests:
 *   - Inbox: requests for the current user's units (author side)
 *     Buttons: Approve / Deny
 *   - Outbox: requests the current user has made (requester side)
 *     Button: Withdraw (only on pending)
 *
 * After any decision, the page refetches the inbox+outbox bundle.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface RequestRow {
  id: string;
  unit_id: string;
  requester_user_id: string;
  author_user_id: string;
  school_id: string;
  intent_message: string | null;
  status: "pending" | "approved" | "denied" | "withdrawn";
  author_response: string | null;
  decided_at: string | null;
  decided_by_user_id: string | null;
  forked_unit_id: string | null;
  created_at: string;
  unit_title: string;
  unit_thumbnail: string | null;
  requester_name: string;
  author_name: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-800",
  denied: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-600",
};

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function UseRequestsPage() {
  const [inbox, setInbox] = useState<RequestRow[]>([]);
  const [outbox, setOutbox] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [responseDraft, setResponseDraft] = useState<string>("");
  const [openResponseFor, setOpenResponseFor] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/teacher/me/unit-use-requests")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { inbox: RequestRow[]; outbox: RequestRow[] }) => {
        setInbox(data.inbox ?? []);
        setOutbox(data.outbox ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const decide = async (
    requestId: string,
    action: "approve" | "deny" | "withdraw"
  ) => {
    setActingId(requestId);
    try {
      const body =
        action !== "withdraw" && responseDraft.trim()
          ? { response: responseDraft.trim() }
          : {};
      const res = await fetch(
        `/api/teacher/me/unit-use-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }
      setOpenResponseFor(null);
      setResponseDraft("");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  if (loading && inbox.length === 0 && outbox.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Unit-use requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          Colleague-to-colleague requests to use units from the school library.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Inbox — requests for MY units */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Inbox ({inbox.filter((r) => r.status === "pending").length} pending)
        </h2>
        {inbox.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-400">
            No requests for your units yet.
          </div>
        ) : (
          <div className="space-y-3">
            {inbox.map((r) => (
              <div
                key={r.id}
                className="border border-gray-200 rounded-xl p-4 bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <strong>{r.requester_name}</strong> wants to use{" "}
                      <span className="text-purple-700">{r.unit_title}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTimeAgo(r.created_at)}
                    </p>
                    {r.intent_message && (
                      <blockquote className="mt-2 text-xs italic text-gray-700 border-l-2 border-purple-200 pl-3">
                        {r.intent_message}
                      </blockquote>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    {openResponseFor === r.id ? (
                      <div className="w-full space-y-2">
                        <textarea
                          value={responseDraft}
                          onChange={(e) => setResponseDraft(e.target.value)}
                          placeholder="(optional) Note to the requester…"
                          maxLength={2000}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(r.id, "approve")}
                            disabled={actingId === r.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            Approve + create fork
                          </button>
                          <button
                            onClick={() => decide(r.id, "deny")}
                            disabled={actingId === r.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Deny
                          </button>
                          <button
                            onClick={() => {
                              setOpenResponseFor(null);
                              setResponseDraft("");
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setOpenResponseFor(r.id);
                            setResponseDraft("");
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                        >
                          Respond
                        </button>
                      </>
                    )}
                  </div>
                )}

                {r.author_response && r.status !== "pending" && (
                  <div className="mt-2 text-xs text-gray-600 italic">
                    Your response: &ldquo;{r.author_response}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Outbox — MY requests for others' units */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Sent ({outbox.filter((r) => r.status === "pending").length} pending)
        </h2>
        {outbox.length === 0 ? (
          <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-400">
            You haven&apos;t requested any units yet.{" "}
            <Link href="/teacher/dashboard" className="text-purple-700 hover:underline">
              Browse your school library
            </Link>
            .
          </div>
        ) : (
          <div className="space-y-3">
            {outbox.map((r) => (
              <div
                key={r.id}
                className="border border-gray-200 rounded-xl p-4 bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      You asked <strong>{r.author_name}</strong> for{" "}
                      <span className="text-purple-700">{r.unit_title}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatTimeAgo(r.created_at)}
                    </p>
                    {r.author_response && (
                      <blockquote className="mt-2 text-xs italic text-gray-700 border-l-2 border-purple-200 pl-3">
                        {r.author_response}
                      </blockquote>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[r.status]}`}
                  >
                    {r.status}
                  </span>
                </div>

                {r.status === "pending" && (
                  <button
                    onClick={() => decide(r.id, "withdraw")}
                    disabled={actingId === r.id}
                    className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Withdraw
                  </button>
                )}

                {r.status === "approved" && r.forked_unit_id && (
                  <Link
                    href={`/teacher/units/${r.forked_unit_id}`}
                    className="mt-3 inline-block px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Open your fork →
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
