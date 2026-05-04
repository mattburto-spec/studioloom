"use client";

/**
 * /teacher/notifications — generic in-app notification inbox (Phase 3C).
 *
 * Reads the current teacher's notifications via /api/teacher/notifications
 * (RLS-enforced). Phase 3B's integrity-flag alerts are the first kind that
 * lands here; future kinds (fab status, share invitations) plug in via
 * the `kind` discriminator without UI changes.
 *
 * Behaviour:
 *   - Auto-marks visible items as read on mount (PATCH /:id mark_read)
 *   - Dismiss button per item → PATCH /:id dismiss → row drops from list
 *   - Click on an item navigates via the link_url (e.g., to the grading
 *     page where IntegrityReport is mounted)
 *   - Filter toggle: all / unread only
 *
 * Companion: /teacher/notifications/use-requests is the Phase 4.6 unit-share
 * inbox (separate table). They coexist as sibling routes for now; Phase 3D
 * may unify the two.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Notification } from "@/types/notifications";

type FilterMode = "all" | "unread";

const KIND_BADGE: Record<string, { label: string; bg: string }> = {
  "integrity.flag_low_score": {
    label: "Integrity",
    bg: "bg-amber-100 text-amber-800",
  },
  "fab.job_status_change": {
    label: "Fabrication",
    bg: "bg-blue-100 text-blue-800",
  },
  "unit.use_request": {
    label: "Share request",
    bg: "bg-purple-100 text-purple-800",
  },
  "share.invitation_received": {
    label: "Invitation",
    bg: "bg-emerald-100 text-emerald-800",
  },
};

const SEVERITY_DOT: Record<string, string> = {
  info: "bg-gray-400",
  warn: "bg-amber-500",
  critical: "bg-red-500",
};

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function NotificationsInboxPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "unread") params.set("unread", "true");
      const res = await fetch(`/api/teacher/notifications?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { notifications: Notification[] };
      setNotifications(data.notifications ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto mark-as-read on view (one PATCH per visible unread item)
  useEffect(() => {
    const unread = notifications.filter((n) => n.read_at === null);
    if (unread.length === 0) return;
    Promise.all(
      unread.map((n) =>
        fetch(`/api/teacher/notifications/${n.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_read" }),
        }).catch(() => {
          /* ignore — best-effort */
        }),
      ),
    );
    // Local state update so the UI reflects "read" immediately without a refetch
    setNotifications((prev) =>
      prev.map((n) =>
        n.read_at === null ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );
  }, [notifications.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/teacher/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dismiss failed");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-1">
            Integrity flags, share requests, and fab updates land here.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5 text-xs">
          {(["all", "unread"] as FilterMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setFilter(m)}
              className={`px-3 py-1 rounded-full transition ${
                filter === m
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {m === "all" ? "All" : "Unread"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && notifications.length === 0 ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="border border-gray-200 rounded-2xl bg-gray-50 p-8 text-center text-sm text-gray-500">
          {filter === "unread"
            ? "All caught up. No unread notifications."
            : "Nothing here yet."}
          <div className="mt-4">
            <Link
              href="/teacher/notifications/use-requests"
              className="text-purple-700 hover:underline"
            >
              View unit-share inbox →
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const badge = KIND_BADGE[n.kind] ?? {
              label: n.kind,
              bg: "bg-gray-100 text-gray-700",
            };
            const isUnread = n.read_at === null;
            return (
              <li
                key={n.id}
                className={`border rounded-2xl p-4 transition ${
                  isUnread
                    ? "bg-white border-amber-200"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                      SEVERITY_DOT[n.severity] ?? "bg-gray-400"
                    }`}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-medium rounded-full uppercase tracking-wide ${badge.bg}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(n.created_at)}
                      </span>
                      {isUnread && (
                        <span className="text-[10px] font-medium uppercase text-amber-700">
                          New
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-gray-900">
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="mt-1 text-sm text-gray-700">{n.body}</p>
                    )}
                    {n.link_url && (
                      <Link
                        href={n.link_url}
                        className="mt-2 inline-block text-xs font-medium text-purple-700 hover:underline"
                      >
                        Open →
                      </Link>
                    )}
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
