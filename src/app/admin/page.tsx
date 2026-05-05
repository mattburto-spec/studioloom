"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import HealthStrip from "@/components/admin/dashboard/HealthStrip";
import QuickStats from "@/components/admin/dashboard/QuickStats";
import AlertsFeed from "@/components/admin/dashboard/AlertsFeed";

interface HealthData {
  pipeline: { status: string; last24h: { total: number; succeeded: number; failed: number } };
  cost: { status: string; todayUSD: number; weekUSD: number; monthUSD: number; alerts: string[] };
  quality: { status: string; thisWeekAvg: number | null };
  stale: { status: string };
  usage: { activeTeachers: number; activeStudents: number; totalUnits: number; totalBlocks: number; bugReportCount: number | null };
  auth: { status: string; studentLogins24h: number; loginFailures24h: number; wrongRoleRedirects24h: number };
  aiBudget: { status: string; totalTokensUsedToday: number; studentsApproachingCap: number; studentsAtCap: number };
  crons: {
    status: string;
    lastCostAlert: string | null;
    lastScheduledHardDelete: string | null;
    lastRetentionEnforcement: string | null;
  };
  auditWarnings: { warnCount24h: number; criticalCount24h: number };
  scheduledDeletions: { pendingCount: number; heldCount: number };
  pendingTeacherRequests: { pendingCount: number };
  overallAlerts: string[];
  sparklines: { runs: number[]; cost: number[] };
}

function isValidHealth(x: unknown): x is HealthData {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    o.cost != null &&
    o.usage != null &&
    o.auth != null &&
    o.aiBudget != null &&
    o.crons != null &&
    o.sparklines != null
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(ms / (1000 * 60))}m ago`;
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminDashboard() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/health")
      .then(async (r) => {
        if (r.status === 401 || r.status === 403) {
          window.location.href = `/admin/login?redirect=${encodeURIComponent("/admin")}`;
          return null;
        }
        const data = await r.json();
        return isValidHealth(data) ? data : null;
      })
      .then((data) => {
        if (data) setHealth(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="text-gray-400 text-sm text-center py-12">Loading health data...</div>
      </div>
    );
  }

  // Pilot-focused health strip — 4 lights replacing the 5 Dimensions3-era ones.
  const lights = health
    ? [
        {
          label: "Auth",
          status: health.auth.status as "green" | "amber" | "red",
          detail: `${health.auth.studentLogins24h} logins · ${health.auth.loginFailures24h} failed`,
        },
        {
          label: "AI Budget",
          status: health.aiBudget.status as "green" | "amber" | "red",
          detail: health.aiBudget.studentsAtCap > 0
            ? `${health.aiBudget.studentsAtCap} at cap`
            : health.aiBudget.studentsApproachingCap > 0
              ? `${health.aiBudget.studentsApproachingCap} near cap`
              : `${(health.aiBudget.totalTokensUsedToday / 1000).toFixed(1)}k tokens today`,
        },
        {
          label: "Cost",
          status: health.cost.status as "green" | "amber" | "red",
          detail: `$${health.cost.todayUSD.toFixed(2)} today`,
        },
        {
          label: "Crons",
          status: health.crons.status as "green" | "amber" | "red",
          detail: health.crons.lastCostAlert
            ? `cost ${relativeTime(health.crons.lastCostAlert)}`
            : "no fires yet",
        },
      ]
    : [];

  // Pilot-focused stats — replaces Units/Blocks (Dimensions3 metrics) with
  // operational signals that move during a school day.
  const stats = health
    ? [
        { label: "Active Teachers", value: health.usage.activeTeachers },
        { label: "Student Logins 24h", value: health.auth.studentLogins24h },
        { label: "Audit Warnings 24h", value: health.auditWarnings.warnCount24h },
        { label: "Open Bug Reports", value: health.usage.bugReportCount ?? "—" },
        { label: "Pending Deletions", value: health.scheduledDeletions.pendingCount },
        { label: "Cost (7d)", value: `$${health.cost.weekUSD.toFixed(2)}`, sparkline: health.sparklines.cost },
      ]
    : [];

  const cronEntries = health
    ? [
        { name: "cost-alert", label: "Cost Alert", schedule: "daily 06:00 UTC", lastFired: health.crons.lastCostAlert },
        { name: "scheduled-hard-delete", label: "Hard Delete", schedule: "daily 03:00 UTC", lastFired: health.crons.lastScheduledHardDelete },
        { name: "retention-enforcement", label: "Retention", schedule: "monthly 1st 04:00 UTC", lastFired: health.crons.lastRetentionEnforcement },
      ]
    : [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Pilot Health</h2>
        <p className="text-xs text-gray-500 mt-0.5">Pre-pilot baseline — most counts are 0 until first student logs in.</p>
      </div>

      <HealthStrip lights={lights} />
      <QuickStats stats={stats} />

      {/* Action queues — surface things needing admin attention. */}
      {health && (health.pendingTeacherRequests.pendingCount > 0 || health.scheduledDeletions.heldCount > 0 || health.auditWarnings.criticalCount24h > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Needs your attention</h3>
          <div className="space-y-2">
            {health.pendingTeacherRequests.pendingCount > 0 && (
              <Link
                href="/admin/teachers"
                className="block bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 hover:bg-amber-100 transition-colors"
              >
                <span className="text-sm font-medium text-amber-900">
                  {health.pendingTeacherRequests.pendingCount} teacher request(s) awaiting review
                </span>
                <span className="text-xs text-amber-700 ml-2">→ Teachers tab</span>
              </Link>
            )}
            {health.scheduledDeletions.heldCount > 0 && (
              <div className="block bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <span className="text-sm font-medium text-red-900">
                  {health.scheduledDeletions.heldCount} deletion(s) on legal hold
                </span>
              </div>
            )}
            {health.auditWarnings.criticalCount24h > 0 && (
              <Link
                href="/admin/audit-log"
                className="block bg-red-50 border border-red-200 rounded-lg px-4 py-3 hover:bg-red-100 transition-colors"
              >
                <span className="text-sm font-medium text-red-900">
                  {health.auditWarnings.criticalCount24h} critical audit event(s) in 24h
                </span>
                <span className="text-xs text-red-700 ml-2">→ Audit Log</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Cron jobs panel — when did each fire? */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Vercel Cron Jobs</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2 text-left">Job</th>
                <th className="px-4 py-2 text-left">Schedule</th>
                <th className="px-4 py-2 text-left">Last fired</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cronEntries.map((c) => (
                <tr key={c.name}>
                  <td className="px-4 py-2 font-medium text-gray-900">{c.label}</td>
                  <td className="px-4 py-2 text-gray-600 text-xs font-mono">{c.schedule}</td>
                  <td className="px-4 py-2 text-gray-700">
                    {c.lastFired ? (
                      <>
                        <span className="text-green-700">●</span> {relativeTime(c.lastFired)}
                      </>
                    ) : (
                      <span className="text-gray-400">never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Active Alerts</h3>
        <AlertsFeed alerts={health?.overallAlerts || []} />
      </div>
    </div>
  );
}
