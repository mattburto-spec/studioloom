"use client";

/**
 * /admin/school/[id] — Phase 4.7 super-admin school detail view.
 *
 * One page surfacing everything the platform admin needs about a single
 * school: settings snapshot, teachers + their last-active, fabricators,
 * domains, 30-day change history, audit feed, merge requests, view-as
 * impersonation buttons.
 *
 * All data comes from the GET /api/admin/school/[id] bundle in one trip
 * (no per-tab refetches). Mutation actions (merge approve/reject, view-as)
 * fire their own routes; on success the page refetches the bundle.
 */

import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import Link from "next/link";

interface SchoolBundle {
  school: {
    id: string;
    name: string;
    country: string | null;
    region: string | null;
    city: string | null;
    timezone: string | null;
    default_locale: string | null;
    subscription_tier: string;
    status: string;
    bootstrap_expires_at: string | null;
    merged_into_id: string | null;
    parent_school_id: string | null;
    created_at: string;
    [key: string]: unknown;
  };
  teachers: Array<{
    id: string;
    name: string | null;
    display_name: string | null;
    email: string | null;
    deleted_at: string | null;
    created_at: string;
    class_count: number;
    last_active_at: string | null;
  }>;
  fabricators: Array<{
    id: string;
    name: string | null;
    email: string | null;
    deactivated_at: string | null;
    created_at: string;
  }>;
  domains: Array<{
    id: string;
    domain: string;
    verified: boolean;
    added_by: string | null;
    created_at: string;
  }>;
  change_history: Array<{
    id: string;
    change_type: string;
    status: string;
    tier: string;
    proposed_by_user_id: string;
    applied_at: string | null;
    expires_at: string | null;
    payload_jsonb: Record<string, unknown>;
    created_at: string;
  }>;
  audit_feed: Array<{
    id: string;
    actor_id: string | null;
    actor_type: string;
    action: string;
    target_table: string | null;
    target_id: string | null;
    payload_jsonb: Record<string, unknown>;
    severity: string;
    created_at: string;
  }>;
  merge_requests: Array<{
    id: string;
    from_school_id: string;
    into_school_id: string;
    requested_by_user_id: string;
    reason: string;
    status: string;
    approved_at: string | null;
    completed_at: string | null;
    rejected_at: string | null;
    rejection_reason: string | null;
    created_at: string;
  }>;
}

const TIER_COLORS: Record<string, string> = {
  pilot: "bg-amber-100 text-amber-800",
  free: "bg-gray-100 text-gray-700",
  starter: "bg-blue-100 text-blue-800",
  pro: "bg-purple-100 text-purple-800",
  school: "bg-emerald-100 text-emerald-800",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function AdminSchoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: schoolId } = use(params);

  const [bundle, setBundle] = useState<SchoolBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "teachers" | "settings" | "history" | "audit" | "merges" | "fabricators" | "domains"
  >("teachers");
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [impersonateMessage, setImpersonateMessage] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/school/${schoolId}`)
      .then((r) => {
        if (r.status === 403) throw new Error("Platform admin only");
        if (r.status === 404) throw new Error("School not found");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: SchoolBundle) => setBundle(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const issueImpersonationUrl = async (teacherId: string) => {
    setImpersonatingId(teacherId);
    setImpersonateMessage(null);
    try {
      const res = await fetch(`/api/admin/school/${schoolId}/impersonate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_teacher_id: teacherId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // Open in a new tab so the admin can compare with their own session
      window.open(data.url, "_blank", "noopener,noreferrer");
      setImpersonateMessage(
        `Issued — token expires in 5 min. (Audit row logged.)`
      );
    } catch (e) {
      setImpersonateMessage(
        `Failed: ${e instanceof Error ? e.message : "unknown"}`
      );
    } finally {
      setImpersonatingId(null);
    }
  };

  if (loading && !bundle) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <strong>Error:</strong> {error ?? "No data"}
        </div>
        <Link
          href="/admin/schools"
          className="mt-4 inline-block text-sm text-purple-700 hover:underline"
        >
          ← Back to schools
        </Link>
      </div>
    );
  }

  const { school, teachers, fabricators, domains, change_history, audit_feed, merge_requests } =
    bundle;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <Link
          href="/admin/schools"
          className="text-xs text-purple-700 hover:underline"
        >
          ← All schools
        </Link>
        <div className="flex items-baseline justify-between mt-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {school.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {[school.city, school.country].filter(Boolean).join(", ") || "—"}
              {school.timezone ? ` · ${school.timezone}` : ""}
              {school.default_locale ? ` · ${school.default_locale}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs rounded-full ${
                TIER_COLORS[school.subscription_tier] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {school.subscription_tier}
            </span>
            <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
              {school.status}
            </span>
          </div>
        </div>
      </div>

      {school.bootstrap_expires_at && new Date(school.bootstrap_expires_at) > new Date() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Bootstrap grace:</strong> single-teacher mode until{" "}
          {formatDate(school.bootstrap_expires_at)}.
        </div>
      )}

      {school.merged_into_id && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <strong>Merged:</strong> this school was merged into another. ID:{" "}
          <code className="text-xs">{school.merged_into_id}</code>
        </div>
      )}

      {impersonateMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {impersonateMessage}
        </div>
      )}

      {/* Tab nav */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4 -mb-px">
          {([
            ["teachers", `Teachers (${teachers.length})`],
            ["fabricators", `Fabricators (${fabricators.length})`],
            ["domains", `Domains (${domains.length})`],
            ["history", `Change history (${change_history.length})`],
            ["audit", `Audit feed (${audit_feed.length})`],
            ["merges", `Merges (${merge_requests.length})`],
            ["settings", "Settings"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-purple-500 text-purple-700"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === "teachers" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium text-right">Classes</th>
                <th className="px-3 py-2 font-medium">Last active</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    No teachers attached.
                  </td>
                </tr>
              ) : (
                teachers.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{t.display_name || t.name || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{t.email ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.class_count}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(t.last_active_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => issueImpersonationUrl(t.id)}
                        disabled={impersonatingId === t.id}
                        className="px-2 py-1 text-xs rounded border border-purple-200 text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                      >
                        {impersonatingId === t.id ? "Issuing…" : "View as"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "fabricators" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {fabricators.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No fabricators (Preflight not active for this school).
                  </td>
                </tr>
              ) : (
                fabricators.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{f.name ?? "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{f.email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {f.deactivated_at ? (
                        <span className="text-red-600">deactivated</span>
                      ) : (
                        <span className="text-emerald-700">active</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(f.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "domains" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Domain</th>
                <th className="px-3 py-2 font-medium">Verified</th>
                <th className="px-3 py-2 font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {domains.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-400">
                    No domains attached.
                  </td>
                </tr>
              ) : (
                domains.map((d) => (
                  <tr key={d.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs">{d.domain}</td>
                    <td className="px-3 py-2">
                      {d.verified ? (
                        <span className="text-emerald-700 text-xs">✓ verified</span>
                      ) : (
                        <span className="text-amber-700 text-xs">pending</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(d.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "history" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Change type</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Applied</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {change_history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    No changes in last 30 days.
                  </td>
                </tr>
              ) : (
                change_history.map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs">{c.change_type}</td>
                    <td className="px-3 py-2 text-xs">{c.tier}</td>
                    <td className="px-3 py-2 text-xs">{c.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(c.applied_at)}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(c.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "audit" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Severity</th>
              </tr>
            </thead>
            <tbody>
              {audit_feed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No audit events.
                  </td>
                </tr>
              ) : (
                audit_feed.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(e.created_at)}
                    </td>
                    <td className="px-3 py-2 text-xs">{e.actor_type}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                    <td className="px-3 py-2 text-xs">
                      <span
                        className={
                          e.severity === "critical"
                            ? "text-red-600 font-medium"
                            : e.severity === "warn"
                              ? "text-amber-700"
                              : "text-gray-600"
                        }
                      >
                        {e.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "merges" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {merge_requests.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-400">
                    No merge requests.
                  </td>
                </tr>
              ) : (
                merge_requests.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-xs">
                      {m.from_school_id === schoolId ? "from →" : "← into"}{" "}
                      <code className="text-xs">
                        {(m.from_school_id === schoolId
                          ? m.into_school_id
                          : m.from_school_id
                        ).slice(0, 8)}
                      </code>
                    </td>
                    <td className="px-3 py-2 text-xs">{m.status}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-md truncate">
                      {m.reason}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {formatTimeAgo(m.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
            Approve / reject controls will land in 4.7+ — for now manage via
            POST <code>/api/admin/school/{schoolId}/merge-requests/[mergeId]/approve</code>
          </p>
        </div>
      )}

      {tab === "settings" && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <pre className="text-xs overflow-auto bg-gray-50 p-3 rounded border border-gray-100">
            {JSON.stringify(school, null, 2)}
          </pre>
          <p className="text-xs text-gray-500 mt-2">
            Edit settings via{" "}
            <Link
              href={`/school/${schoolId}/settings`}
              className="text-purple-700 hover:underline"
            >
              /school/{schoolId}/settings
            </Link>{" "}
            (governance-gated).
          </p>
        </div>
      )}
    </div>
  );
}
