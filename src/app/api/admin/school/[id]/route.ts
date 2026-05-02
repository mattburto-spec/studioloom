/**
 * GET /api/admin/school/[id]
 *
 * Phase 4.7 — super-admin detail view bundle for a single school.
 * Returns all the data the /admin/school/[id] page needs in one trip:
 *
 *   {
 *     school:       schools row (full)
 *     teachers:     [{ id, name, email, last_active_at, class_count }]
 *     fabricators:  [{ id, name, email, ... }]      // Preflight Phase 8
 *     domains:      [{ id, domain, verified, ... }] // Phase 4.2
 *     change_history: [...]   // last 30 days from school_setting_changes
 *     audit_feed:    [...]    // last 50 events from audit_events
 *     merge_requests: [...]   // any-status, both directions
 *   }
 *
 * Auth: platform admin only.
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.7.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RouteContext = { params: Promise<{ id: string }> };

const THIRTY_DAYS_AGO_MS = 30 * 24 * 60 * 60 * 1000;
const AUDIT_FEED_LIMIT = 50;

export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth.error) return auth.error;

    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. School row
    const { data: school, error: schoolErr } = await supabase
      .from("schools")
      .select("*")
      .eq("id", schoolId)
      .maybeSingle();
    if (schoolErr) {
      console.error("[admin/school/[id] GET] schools query:", schoolErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!school) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const thirtyDaysAgo = new Date(Date.now() - THIRTY_DAYS_AGO_MS).toISOString();

    // 2. Parallel fetch of the bundle pieces (Lesson #45: many small
    //    deterministic queries beat one big PostgREST embed).
    const [
      teachersRes,
      fabricatorsRes,
      domainsRes,
      changeHistoryRes,
      auditFeedRes,
      mergeRequestsRes,
      classesForCounts,
      lastActiveByTeacher,
    ] = await Promise.all([
      supabase
        .from("teachers")
        .select("id, name, display_name, email, deleted_at, created_at")
        .eq("school_id", schoolId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("fabricators")
        .select("id, name, email, deactivated_at, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase
        .from("school_domains")
        .select("id, domain, verified, added_by, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
      supabase
        .from("school_setting_changes")
        .select(
          "id, change_type, status, tier, proposed_by_user_id, applied_at, expires_at, payload_jsonb, created_at"
        )
        .eq("school_id", schoolId)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false }),
      supabase
        .from("audit_events")
        .select(
          "id, actor_id, actor_type, action, target_table, target_id, payload_jsonb, severity, created_at"
        )
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(AUDIT_FEED_LIMIT),
      supabase
        .from("school_merge_requests")
        .select(
          "id, from_school_id, into_school_id, requested_by_user_id, reason, status, approved_by_user_id, approved_at, completed_at, rejected_at, rejection_reason, created_at"
        )
        .or(`from_school_id.eq.${schoolId},into_school_id.eq.${schoolId}`)
        .order("created_at", { ascending: false }),
      supabase
        .from("classes")
        .select("teacher_id, school_id")
        .eq("school_id", schoolId)
        .is("deleted_at", null),
      supabase
        .from("audit_events")
        .select("actor_id, created_at")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    // Build per-teacher class counts + last_active
    const teacherClassCount = new Map<string, number>();
    for (const row of classesForCounts.data ?? []) {
      teacherClassCount.set(
        row.teacher_id,
        (teacherClassCount.get(row.teacher_id) ?? 0) + 1
      );
    }
    const teacherLastActive = new Map<string, string>();
    for (const row of lastActiveByTeacher.data ?? []) {
      if (row.actor_id && !teacherLastActive.has(row.actor_id)) {
        teacherLastActive.set(row.actor_id, row.created_at);
      }
    }

    const enrichedTeachers = (teachersRes.data ?? []).map((t) => ({
      ...t,
      class_count: teacherClassCount.get(t.id) ?? 0,
      last_active_at: teacherLastActive.get(t.id) ?? null,
    }));

    return NextResponse.json(
      {
        school,
        teachers: enrichedTeachers,
        fabricators: fabricatorsRes.data ?? [],
        domains: domainsRes.data ?? [],
        change_history: changeHistoryRes.data ?? [],
        audit_feed: auditFeedRes.data ?? [],
        merge_requests: mergeRequestsRes.data ?? [],
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[admin/school/[id] GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
