/**
 * /school/[id]/settings — Phase 4.4a read-only skeleton.
 *
 * Same-school teacher reads their school's settings + recent governance
 * activity. Server component — fetches directly via admin client + the
 * Supabase SSR helper for auth.
 *
 * Phase 4.4a SCOPE (this commit):
 *   - Auth: redirect to /teacher/login if unauthenticated
 *   - Cross-school: notFound() if not user's school AND not platform admin
 *   - Read-only display of identity + status + activity feed
 *   - Archived banner if school.status='archived'
 *   - Bootstrap banner if bootstrap_expires_at > now()
 *   - Lone-teacher post-bootstrap banner if past bootstrap + 1 active teacher
 *   - "Editable sections coming in Phase 4.4b" placeholder for the meat
 *
 * Phase 4.4b will replace placeholders with editable sections (Identity,
 * Calendar, Timetable, Frameworks, Auth Policy, AI Policy, Branding,
 * Safeguarding, Content Sharing) wired through proposeSchoolSettingChange.
 *
 * Phase 4.4c adds the proposal lifecycle UI (confirm + revert buttons,
 * activity-feed interactivity).
 *
 * Phase 4.4d adds multi-campus inheritance badges + i18n primitive
 * (next-intl) + timezone smart-default in welcome wizard.
 */

import { redirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceArchivedReadOnly } from "@/lib/access-v2/school/archived-guard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SchoolRow = {
  id: string;
  name: string;
  city: string | null;
  country: string;
  region: string;
  timezone: string;
  default_locale: string;
  status: "active" | "dormant" | "archived" | "merged_into";
  subscription_tier: string;
  allowed_auth_modes: string[];
  bootstrap_expires_at: string | null;
  parent_school_id: string | null;
};

type SettingChangeRow = {
  id: string;
  change_type: string;
  tier: "low_stakes" | "high_stakes";
  status: "pending" | "applied" | "reverted" | "expired";
  payload_jsonb: Record<string, unknown>;
  applied_at: string | null;
  reverted_at: string | null;
  expires_at: string | null;
  actor_user_id: string;
  confirmed_by_user_id: string | null;
  reverted_by_user_id: string | null;
  created_at: string;
};

async function loadAuthState() {
  const hdrs = await headers();
  const cookieHeader = hdrs.get("cookie") ?? "";

  // SSR Supabase client built from request cookies (server-component compatible)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          cookieHeader
            .split("; ")
            .filter(Boolean)
            .map((c) => {
              const eq = c.indexOf("=");
              return {
                name: c.slice(0, eq),
                value: decodeURIComponent(c.slice(eq + 1)),
              };
            }),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: teacher }, { data: profile }] = await Promise.all([
    admin
      .from("teachers")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle(),
    admin
      .from("user_profiles")
      .select("is_platform_admin")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  return {
    userId: user.id,
    teacherSchoolId: teacher?.school_id ?? null,
    isPlatformAdmin: profile?.is_platform_admin === true,
  };
}

async function loadPageData(schoolId: string) {
  const admin = createAdminClient();
  const guard = await enforceArchivedReadOnly(schoolId, admin);
  if (guard.readOnly && guard.reason === "school_not_found") {
    return null;
  }

  const [
    { data: school },
    { count: teacherCount },
    { data: pending },
    { data: recent },
  ] = await Promise.all([
    admin
      .from("schools")
      .select(
        [
          "id",
          "name",
          "city",
          "country",
          "region",
          "timezone",
          "default_locale",
          "status",
          "subscription_tier",
          "allowed_auth_modes",
          "bootstrap_expires_at",
          "parent_school_id",
        ].join(", ")
      )
      .eq("id", schoolId)
      .maybeSingle(),
    admin
      .from("teachers")
      .select("id", { count: "exact", head: true })
      .eq("school_id", schoolId)
      .is("deleted_at", null),
    admin
      .from("school_setting_changes")
      .select(
        "id, change_type, tier, payload_jsonb, status, expires_at, actor_user_id, created_at"
      )
      .eq("school_id", schoolId)
      .eq("status", "pending")
      .order("expires_at", { ascending: true })
      .limit(20),
    admin
      .from("school_setting_changes")
      .select(
        "id, change_type, tier, payload_jsonb, status, applied_at, reverted_at, actor_user_id, confirmed_by_user_id, reverted_by_user_id, created_at"
      )
      .eq("school_id", schoolId)
      .in("status", ["applied", "reverted", "expired"])
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!school) return null;

  return {
    school: school as unknown as SchoolRow,
    teacherCount: teacherCount ?? 0,
    pendingProposals: (pending ?? []) as unknown as SettingChangeRow[],
    recentChanges: (recent ?? []) as unknown as SettingChangeRow[],
    readOnly: guard.readOnly,
    readOnlyReason: guard.readOnly ? guard.reason : undefined,
  };
}

export default async function SchoolSettingsPage({ params }: PageProps) {
  const { id: schoolId } = await params;

  if (!UUID_RE.test(schoolId)) {
    notFound();
  }

  const auth = await loadAuthState();
  if (!auth) {
    redirect("/teacher/login");
  }

  // Cross-school: 404 unless platform admin
  if (auth.teacherSchoolId !== schoolId && !auth.isPlatformAdmin) {
    notFound();
  }

  const data = await loadPageData(schoolId);
  if (!data) {
    notFound();
  }

  const { school, teacherCount, pendingProposals, recentChanges, readOnly } =
    data;

  const bootstrapExpiry = school.bootstrap_expires_at
    ? new Date(school.bootstrap_expires_at)
    : null;
  const bootstrapActive =
    bootstrapExpiry === null || bootstrapExpiry > new Date();
  const lonePostBootstrap =
    !bootstrapActive && teacherCount === 1;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <header className="space-y-1">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          School Settings
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{school.name}</h1>
        <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
          <span>
            {school.city ? `${school.city}, ` : ""}
            {school.country}
          </span>
          <span>·</span>
          <span className="capitalize">{school.status}</span>
          <span>·</span>
          <span className="capitalize">{school.subscription_tier} tier</span>
          <span>·</span>
          <span>
            {teacherCount} active teacher{teacherCount === 1 ? "" : "s"}
          </span>
        </div>
      </header>

      {/* Archived banner — read-only mode (§3.9 item 16) */}
      {readOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            This school is {school.status}.
          </div>
          <p className="mt-1 text-xs text-amber-800">
            Settings are view-only. Historical data preserved. Contact your
            platform admin to reactivate.
          </p>
        </div>
      )}

      {/* Bootstrap grace banner — single-teacher mode */}
      {!readOnly && bootstrapActive && teacherCount <= 1 && (
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
          <div className="text-sm font-semibold text-purple-900">
            🌱 Single-teacher mode
          </div>
          <p className="mt-1 text-xs text-purple-800">
            You&apos;re the only teacher in this school right now. While in
            single-teacher mode, all settings apply instantly. Once a 2nd
            teacher joins, high-stakes changes (school name, region, auth
            policy, etc.) require a 2nd confirm.
            {bootstrapExpiry && (
              <>
                {" "}Window closes at {bootstrapExpiry.toLocaleString()}.
              </>
            )}
          </p>
        </div>
      )}

      {/* Lone-teacher post-bootstrap banner */}
      {!readOnly && lonePostBootstrap && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">
            ⚠ Single active teacher (governance window has closed)
          </div>
          <p className="mt-1 text-xs text-amber-800">
            High-stakes proposals will sit pending until a 2nd teacher joins
            to confirm.{" "}
            <a href="/admin/teachers" className="underline">
              Invite a colleague →
            </a>
          </p>
        </div>
      )}

      {/* Pending proposals — Phase 4.4c will make these confirm/dismiss interactive */}
      {pendingProposals.length > 0 && (
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="text-sm font-semibold text-blue-900">
            🔔 {pendingProposals.length} proposal
            {pendingProposals.length === 1 ? "" : "s"} pending confirm
          </div>
          <ul className="space-y-2 text-xs text-blue-900">
            {pendingProposals.map((p) => (
              <li
                key={p.id}
                className="rounded-lg bg-white border border-blue-200 px-3 py-2"
              >
                <div className="font-medium">{p.change_type}</div>
                <div className="text-blue-700">
                  Proposed{" "}
                  {new Date(p.created_at).toLocaleString()} ·{" "}
                  {p.expires_at && (
                    <>
                      expires {new Date(p.expires_at).toLocaleString()}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-blue-700">
            Confirm/dismiss actions land in Phase 4.4c.
          </p>
        </section>
      )}

      {/* Identity (read-only in 4.4a; editable in 4.4b) */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Identity</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500">Name</dt>
            <dd className="text-gray-900">{school.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Country</dt>
            <dd className="text-gray-900">{school.country}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Region</dt>
            <dd className="text-gray-900">{school.region}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Timezone</dt>
            <dd className="text-gray-900">{school.timezone}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Locale</dt>
            <dd className="text-gray-900">{school.default_locale}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Status</dt>
            <dd className="text-gray-900 capitalize">{school.status}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">
              Subscription tier
            </dt>
            <dd className="text-gray-900 capitalize">
              {school.subscription_tier}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">
              Allowed auth modes
            </dt>
            <dd className="text-gray-900">
              {school.allowed_auth_modes.join(", ")}
            </dd>
          </div>
        </dl>
        <p className="text-[11px] text-gray-400">
          Editable sections coming in Phase 4.4b — Identity, Calendar,
          Timetable, Frameworks, Auth Policy, AI Policy, Branding,
          Safeguarding, Content Sharing.
        </p>
      </section>

      {/* Activity feed (read-only in 4.4a; revert buttons in 4.4c) */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          Recent Activity (last 30 days)
        </h2>
        {recentChanges.length === 0 ? (
          <p className="text-xs text-gray-500">
            No settings changes yet. The feed will fill in as teachers update
            settings.
          </p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recentChanges.map((c) => (
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
                      <>
                        Applied {new Date(c.applied_at).toLocaleString()}
                      </>
                    )}
                    {c.status === "reverted" && c.reverted_at && (
                      <>
                        Reverted {new Date(c.reverted_at).toLocaleString()}
                      </>
                    )}
                    {c.status === "expired" && (
                      <>
                        Expired {new Date(c.created_at).toLocaleString()}
                      </>
                    )}
                  </div>
                </div>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                    (c.status === "applied"
                      ? "bg-green-100 text-green-800"
                      : c.status === "reverted"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-gray-200 text-gray-700")
                  }
                >
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-gray-400">
          Revert / confirm actions land in Phase 4.4c.
        </p>
      </section>

      {/* Domains link */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">
          School Domains
        </h2>
        <p className="text-sm text-gray-600">
          Email domains that auto-suggest this school during teacher signup.
          Manage via the existing API: {" "}
          <code className="text-xs bg-gray-100 rounded px-1 py-0.5">
            /api/school/{school.id}/domains
          </code>
          .
        </p>
        <p className="text-[11px] text-gray-400">
          UI for domain management coming in Phase 4.4b.
        </p>
      </section>
    </div>
  );
}
