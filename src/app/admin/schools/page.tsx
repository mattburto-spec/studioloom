"use client";

/**
 * /admin/schools — Phase 4.7 super-admin schools directory.
 *
 * Replaces the paper-only stub from before A5a (which returned class →
 * teacher hierarchy and rendered an "entity not yet built" banner).
 * Lists all schools with summary counts; clicking a row drills into
 * /admin/school/[id] for the full bundle.
 *
 * Auth gated by middleware (is_admin) + the /api/admin/schools route
 * (is_platform_admin). Two layers: any admin can hit /admin/* routes,
 * but only platform admin sees actual rows.
 */

import { useState, useEffect } from "react";
import Link from "next/link";

interface SchoolRow {
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
  teacher_count: number;
  class_count: number;
  student_count: number;
  last_active_at: string | null;
}

const TIER_COLORS: Record<string, string> = {
  pilot: "bg-amber-100 text-amber-800 border-amber-300",
  free: "bg-gray-100 text-gray-700 border-gray-300",
  starter: "bg-blue-100 text-blue-800 border-blue-300",
  pro: "bg-purple-100 text-purple-800 border-purple-300",
  school: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-700",
  dormant: "text-gray-500",
  archived: "text-red-600",
  merged_into: "text-amber-600",
};

function formatTimeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default function AdminSchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  useEffect(() => {
    fetch("/api/admin/schools")
      .then((r) => {
        if (r.status === 403) throw new Error("Platform admin only");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { schools: SchoolRow[] }) => {
        setSchools(data.schools ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = schools.filter((s) => {
    if (
      search &&
      !s.name.toLowerCase().includes(search.toLowerCase()) &&
      !(s.country?.toLowerCase().includes(search.toLowerCase()) ?? false) &&
      !(s.city?.toLowerCase().includes(search.toLowerCase()) ?? false)
    ) {
      return false;
    }
    if (tierFilter && s.subscription_tier !== tierFilter) return false;
    if (statusFilter && s.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-sm text-gray-500">Loading schools…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  const totals = {
    schools: schools.length,
    teachers: schools.reduce((a, s) => a + s.teacher_count, 0),
    classes: schools.reduce((a, s) => a + s.class_count, 0),
    students: schools.reduce((a, s) => a + s.student_count, 0),
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Schools (super-admin)</h2>
          <p className="text-sm text-gray-500">All schools across the platform</p>
        </div>
        <div className="text-sm text-gray-600">
          {totals.schools} schools · {totals.teachers} teachers · {totals.classes} classes · {totals.students} students
        </div>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search by name / country / city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All tiers</option>
          <option value="pilot">pilot</option>
          <option value="free">free</option>
          <option value="starter">starter</option>
          <option value="pro">pro</option>
          <option value="school">school</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="dormant">dormant</option>
          <option value="archived">archived</option>
          <option value="merged_into">merged_into</option>
        </select>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-700">Name</th>
              <th className="px-3 py-2 font-medium text-gray-700">Tier</th>
              <th className="px-3 py-2 font-medium text-gray-700">Status</th>
              <th className="px-3 py-2 font-medium text-gray-700">Country</th>
              <th className="px-3 py-2 font-medium text-gray-700 text-right">Teachers</th>
              <th className="px-3 py-2 font-medium text-gray-700 text-right">Classes</th>
              <th className="px-3 py-2 font-medium text-gray-700 text-right">Students</th>
              <th className="px-3 py-2 font-medium text-gray-700">Last active</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  No schools match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/school/${s.id}`}
                      className="text-purple-700 hover:underline font-medium"
                    >
                      {s.name}
                    </Link>
                    {s.parent_school_id && (
                      <span
                        className="ml-2 text-xs text-gray-500"
                        title="Multi-campus child"
                      >
                        · child
                      </span>
                    )}
                    {s.merged_into_id && (
                      <span
                        className="ml-2 text-xs text-amber-600"
                        title="Merged into another school"
                      >
                        · merged
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block px-2 py-0.5 text-xs rounded-full border ${
                        TIER_COLORS[s.subscription_tier] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.subscription_tier}
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-xs ${STATUS_COLORS[s.status] ?? "text-gray-700"}`}>
                    {s.status}
                  </td>
                  <td className="px-3 py-2 text-gray-700">{s.country ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.teacher_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.class_count}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{s.student_count}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {formatTimeAgo(s.last_active_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
