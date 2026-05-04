"use client";

import { useState, useEffect, useCallback, useMemo } from "react";

interface BugReport {
  id: string;
  reporter_id: string | null;
  reporter_role: string | null;
  class_id: string | null;
  category: string;
  description: string;
  screenshot_url: string | null;
  screenshot_signed_url?: string | null;
  page_url: string | null;
  console_errors: unknown[] | null;
  client_context: Record<string, unknown> | null;
  sentry_event_id: string | null;
  status: string;
  admin_notes: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
}

const SENTRY_ORG_SLUG = process.env.NEXT_PUBLIC_SENTRY_ORG_SLUG || "";
const SENTRY_PROJECT_SLUG = process.env.NEXT_PUBLIC_SENTRY_PROJECT_SLUG || "";

function buildSentryUrl(eventId: string): string | null {
  // Without org/project slugs configured, link to the org-wide search;
  // with both, link straight to the project events search.
  if (SENTRY_ORG_SLUG && SENTRY_PROJECT_SLUG) {
    return `https://${SENTRY_ORG_SLUG}.sentry.io/issues/?project=${SENTRY_PROJECT_SLUG}&query=event_id%3A${eventId}`;
  }
  if (SENTRY_ORG_SLUG) {
    return `https://${SENTRY_ORG_SLUG}.sentry.io/issues/?query=event_id%3A${eventId}`;
  }
  return `https://sentry.io/issues/?query=event_id%3A${eventId}`;
}

const STATUS_OPTIONS = ["new", "investigating", "fixed", "closed"];
const CATEGORY_OPTIONS = ["broken", "visual", "confused", "feature_request"];
const ROLE_OPTIONS = ["teacher", "student", "admin"];

type ClientContext = {
  release?: string | null;
  deployEnv?: string | null;
  userAgent?: string;
  platform?: string;
  language?: string;
  languages?: string[];
  viewport?: { width?: number; height?: number; dpr?: number };
  screen?: { width?: number | null; height?: number | null };
  connection?: { effectiveType?: string | null; downlink?: number | null; rtt?: number | null; saveData?: boolean | null } | null;
  hardware?: { cores?: number | null; memoryGb?: number | null; touchPoints?: number | null };
  referrer?: string | null;
  timeOnPageMs?: number;
  timezone?: string | null;
  submittedAt?: string;
  role?: string;
  route?: {
    pathname?: string;
    routeKind?: string | null;
    unitId?: string;
    lessonNumber?: number;
    activityNumber?: number;
    classId?: string;
  };
  events?: Array<{ kind: string; message: string; source?: string | null; ts: number }>;
} | null;

/**
 * Fingerprint a report for grouping. Two reports with the same category +
 * route kind + first event message likely point at the same bug. Description
 * text is intentionally NOT in the fingerprint — different students will
 * describe the same bug differently.
 */
function fingerprintReport(r: BugReport): string {
  const ctx = (r.client_context as ClientContext) || {};
  const routeKind = ctx.route?.routeKind || "unknown";
  const firstEvent = (ctx.events || [])[0];
  const eventKey = firstEvent ? `${firstEvent.kind}:${firstEvent.message.slice(0, 80)}` : "no-event";
  return `${r.category}|${routeKind}|${eventKey}`;
}

function summarizeUserAgent(ua: string | undefined): { browser: string; os: string } {
  if (!ua) return { browser: "?", os: "?" };
  let browser = "Unknown";
  const chrome = ua.match(/Chrome\/(\d+)/);
  const safari = ua.match(/Version\/(\d+).*Safari/);
  const firefox = ua.match(/Firefox\/(\d+)/);
  const edge = ua.match(/Edg\/(\d+)/);
  if (edge) browser = `Edge ${edge[1]}`;
  else if (chrome) browser = `Chrome ${chrome[1]}`;
  else if (firefox) browser = `Firefox ${firefox[1]}`;
  else if (safari) browser = `Safari ${safari[1]}`;

  let os = "Unknown";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X ([\d_]+)/.test(ua)) os = `macOS ${RegExp.$1.replace(/_/g, ".")}`;
  else if (/Android (\d+)/.test(ua)) os = `Android ${RegExp.$1}`;
  else if (/iPhone OS ([\d_]+)/.test(ua)) os = `iOS ${RegExp.$1.replace(/_/g, ".")}`;
  else if (/iPad/.test(ua)) os = "iPadOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { browser, os };
}

function formatMs(ms: number | undefined): string {
  if (ms == null) return "?";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return rs ? `${m}m ${rs}s` : `${m}m`;
}

function FilterButtonRow({
  label,
  options,
  value,
  onChange,
  counts,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  counts: Record<string, number>;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide w-16">{label}</span>
      <button
        onClick={() => onChange("")}
        className={`px-2.5 py-1 text-xs font-medium rounded-md transition ${
          !value ? "bg-purple-100 text-purple-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
        }`}
      >
        All
      </button>
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(value === opt ? "" : opt)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition capitalize ${
            value === opt ? "bg-purple-100 text-purple-700" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
          }`}
        >
          {opt.replace(/_/g, " ")} <span className="opacity-60">({counts[opt] || 0})</span>
        </button>
      ))}
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex gap-3 py-1 border-b border-gray-100 last:border-b-0">
      <span className="text-[11px] text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-xs text-gray-800 font-mono break-all">{value}</span>
    </div>
  );
}

function ClientContextSummary({ ctx }: { ctx: ClientContext }) {
  if (!ctx) return null;
  const { browser, os } = summarizeUserAgent(ctx.userAgent);
  const vp = ctx.viewport;
  const conn = ctx.connection;
  const hw = ctx.hardware;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 p-3 bg-gray-50 rounded-lg">
      {/* Page / Identity */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Page</p>
        <ContextRow label="Release" value={ctx.release ? String(ctx.release).slice(0, 7) : null} />
        <ContextRow label="Environment" value={ctx.deployEnv} />
        <ContextRow label="Time on page" value={formatMs(ctx.timeOnPageMs)} />
        <ContextRow label="Submitted at" value={ctx.submittedAt ? new Date(ctx.submittedAt).toLocaleString() : null} />
        <ContextRow label="Referrer" value={ctx.referrer || "(direct)"} />
      </div>

      {/* Browser */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Browser</p>
        <ContextRow label="Browser" value={browser} />
        <ContextRow label="OS" value={os} />
        <ContextRow label="Platform" value={ctx.platform} />
        <ContextRow label="Language" value={Array.isArray(ctx.languages) && ctx.languages.length ? ctx.languages.join(", ") : ctx.language} />
        <ContextRow label="Timezone" value={ctx.timezone} />
      </div>

      {/* Viewport / Screen */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 mt-2">Viewport</p>
        <ContextRow
          label="Viewport"
          value={vp?.width && vp?.height ? `${vp.width} × ${vp.height}${vp.dpr ? ` @${vp.dpr}x DPR` : ""}` : null}
        />
        <ContextRow
          label="Screen"
          value={ctx.screen?.width && ctx.screen?.height ? `${ctx.screen.width} × ${ctx.screen.height}` : null}
        />
      </div>

      {/* Network / Hardware */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 mt-2">Network &amp; Hardware</p>
        <ContextRow
          label="Connection"
          value={
            conn?.effectiveType
              ? `${conn.effectiveType}${conn.downlink ? ` · ${conn.downlink} Mbps` : ""}${conn.rtt ? ` · ${conn.rtt}ms RTT` : ""}${conn.saveData ? " · saveData" : ""}`
              : null
          }
        />
        <ContextRow label="CPU cores" value={hw?.cores ?? null} />
        <ContextRow label="Device memory" value={hw?.memoryGb ? `${hw.memoryGb} GB` : null} />
        <ContextRow label="Touch points" value={hw?.touchPoints ?? null} />
      </div>
    </div>
  );
}

export default function BugReportsPage() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterRole, setFilterRole] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // Always fetch the full set; filter on the client. Reports are capped at
  // 200 server-side, well within client-side filtering territory.
  const loadReports = useCallback(() => {
    fetch("/api/admin/bug-reports")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setReports(data.reports || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const updateReport = async (id: string, updates: Record<string, unknown>) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/admin/bug-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  const { filtered, statusCounts, categoryCounts, roleCounts, fingerprintCounts } = useMemo(() => {
    const sc: Record<string, number> = {};
    const cc: Record<string, number> = {};
    const rc: Record<string, number> = {};
    const fc: Record<string, number> = {};
    for (const r of reports) {
      sc[r.status] = (sc[r.status] || 0) + 1;
      cc[r.category] = (cc[r.category] || 0) + 1;
      if (r.reporter_role) rc[r.reporter_role] = (rc[r.reporter_role] || 0) + 1;
      const fp = fingerprintReport(r);
      fc[fp] = (fc[fp] || 0) + 1;
    }
    const q = search.trim().toLowerCase();
    const f = reports.filter((r) => {
      if (filterStatus && r.status !== filterStatus) return false;
      if (filterCategory && r.category !== filterCategory) return false;
      if (filterRole && r.reporter_role !== filterRole) return false;
      if (q) {
        const hay = `${r.description} ${r.page_url ?? ""} ${r.admin_notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return { filtered: f, statusCounts: sc, categoryCounts: cc, roleCounts: rc, fingerprintCounts: fc };
  }, [reports, filterStatus, filterCategory, filterRole, search]);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading bug reports...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  const activeFilterCount = [filterStatus, filterCategory, filterRole, search.trim()].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Bug Reports</h2>
        <p className="text-sm text-gray-500">
          {filtered.length} of {reports.length} report{reports.length !== 1 ? "s" : ""}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setFilterStatus("");
                setFilterCategory("");
                setFilterRole("");
                setSearch("");
              }}
              className="ml-2 text-xs text-purple-600 hover:underline"
            >
              clear filters
            </button>
          )}
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
        <input
          type="text"
          placeholder="Search description, URL, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
        />
        <FilterButtonRow label="Status" options={STATUS_OPTIONS} value={filterStatus} onChange={setFilterStatus} counts={statusCounts} />
        <FilterButtonRow label="Category" options={CATEGORY_OPTIONS} value={filterCategory} onChange={setFilterCategory} counts={categoryCounts} />
        <FilterButtonRow label="Role" options={ROLE_OPTIONS} value={filterRole} onChange={setFilterRole} counts={roleCounts} />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No bug reports match the current filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const fp = fingerprintReport(r);
            const dupCount = fingerprintCounts[fp] || 1;
            return (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div
                className="flex items-start justify-between cursor-pointer"
                onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.status === "new" ? "bg-blue-100 text-blue-700" :
                    r.status === "investigating" ? "bg-amber-100 text-amber-700" :
                    r.status === "fixed" ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-600"
                  }`}>{r.status}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{r.category.replace(/_/g, " ")}</span>
                  {r.reporter_role && (
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.reporter_role === "student" ? "bg-cyan-50 text-cyan-700" :
                      r.reporter_role === "teacher" ? "bg-purple-50 text-purple-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{r.reporter_role}</span>
                  )}
                  {dupCount > 1 && (
                    <span
                      className="px-2 py-0.5 rounded-full text-xs bg-rose-50 text-rose-700 font-medium"
                      title="Reports with the same category, route, and first error are grouped"
                    >
                      ×{dupCount} similar
                    </span>
                  )}
                  {r.screenshot_url && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600" title="Screenshot attached">📷</span>
                  )}
                  {r.sentry_event_id && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700" title="Linked to Sentry event">⚡</span>
                  )}
                  <p className="text-sm text-gray-900">{r.description.slice(0, 100)}{r.description.length > 100 ? "..." : ""}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-4">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>

              {expandedId === r.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.description}</p>

                  {r.page_url && (
                    <p className="text-xs text-gray-500">Page: <span className="font-mono break-all">{r.page_url}</span></p>
                  )}
                  {r.reporter_role && (
                    <p className="text-xs text-gray-500">Reporter: {r.reporter_role} ({r.reporter_id?.slice(0, 8)}...)</p>
                  )}

                  {/* Route context — surfaces unit/lesson IDs for triage */}
                  {(() => {
                    const ctx = r.client_context as ClientContext;
                    const route = ctx?.route;
                    if (!route?.routeKind) return null;
                    return (
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                          <span className="text-blue-400">route=</span>{route.routeKind}
                        </span>
                        {route.unitId && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                            <span className="text-blue-400">unit=</span>{route.unitId.slice(0, 8)}
                          </span>
                        )}
                        {route.classId && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                            <span className="text-blue-400">class=</span>{route.classId.slice(0, 8)}
                          </span>
                        )}
                        {route.lessonNumber != null && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                            <span className="text-blue-400">lesson=</span>L{route.lessonNumber}
                          </span>
                        )}
                        {route.activityNumber != null && (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-mono">
                            <span className="text-blue-400">activity=</span>A{route.activityNumber}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Sentry deep-link */}
                  {r.sentry_event_id && (
                    <div className="text-xs">
                      {(() => {
                        const url = buildSentryUrl(r.sentry_event_id);
                        if (!url) return null;
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition"
                          >
                            <span>⚡</span>
                            View in Sentry
                            <span className="font-mono text-[10px] opacity-70">{r.sentry_event_id.slice(0, 8)}</span>
                          </a>
                        );
                      })()}
                    </div>
                  )}

                  {/* Screenshot */}
                  {r.screenshot_signed_url && (
                    <details className="text-xs" open>
                      <summary className="text-gray-500 cursor-pointer">Screenshot</summary>
                      <a href={r.screenshot_signed_url} target="_blank" rel="noopener noreferrer" className="block mt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.screenshot_signed_url}
                          alt="Bug report screenshot"
                          className="w-full max-w-2xl rounded-lg border border-gray-200 hover:opacity-95 transition"
                        />
                      </a>
                    </details>
                  )}
                  {r.screenshot_url && !r.screenshot_signed_url && (
                    <p className="text-xs text-gray-400 italic">Screenshot upload exists but signed URL is unavailable.</p>
                  )}

                  {r.client_context && Object.keys(r.client_context).length > 0 && (() => {
                    const ctx = r.client_context as ClientContext;
                    if (!ctx) return null;
                    const events = Array.isArray(ctx.events) ? ctx.events : [];
                    return (
                      <div className="space-y-2">
                        <ClientContextSummary ctx={ctx} />
                        {events.length > 0 && (
                          <details className="text-xs">
                            <summary className="text-gray-500 cursor-pointer">Runtime events ({events.length})</summary>
                            <ul className="mt-1 space-y-1">
                              {events.map((e, i) => (
                                <li key={i} className="p-2 bg-gray-50 rounded">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                      e.kind === "unhandledrejection" || e.kind === "window.error"
                                        ? "bg-red-100 text-red-700"
                                        : e.kind === "console.error"
                                        ? "bg-orange-100 text-orange-700"
                                        : "bg-amber-50 text-amber-700"
                                    }`}>{e.kind}</span>
                                    {e.source && <span className="text-[10px] text-gray-400 font-mono">{e.source}</span>}
                                    <span className="text-[10px] text-gray-400 ml-auto">{new Date(e.ts).toLocaleTimeString()}</span>
                                  </div>
                                  <pre className="text-[11px] text-gray-700 whitespace-pre-wrap break-words">{e.message}</pre>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                        <details className="text-xs">
                          <summary className="text-gray-500 cursor-pointer">Raw JSON</summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-48">
                            {JSON.stringify(r.client_context, null, 2)}
                          </pre>
                        </details>
                      </div>
                    );
                  })()}

                  {r.console_errors && (r.console_errors as unknown[]).length > 0 && (
                    <details className="text-xs">
                      <summary className="text-gray-500 cursor-pointer">Legacy console_errors ({(r.console_errors as unknown[]).length})</summary>
                      <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                        {JSON.stringify(r.console_errors, null, 2)}
                      </pre>
                    </details>
                  )}

                  {r.admin_notes && (
                    <div className="p-2 bg-purple-50 rounded-lg text-xs text-purple-700">
                      <strong>Admin notes:</strong> {r.admin_notes}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.filter((s) => s !== r.status).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateReport(r.id, { status: s })}
                        disabled={updating === r.id}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50 transition capitalize"
                      >
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
