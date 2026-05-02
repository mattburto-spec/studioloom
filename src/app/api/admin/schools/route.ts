/**
 * GET /api/admin/schools
 *
 * Phase 4.7 — replaces the paper-only stub that returned class→teacher
 * hierarchy. Returns the real schools directory for the super-admin view.
 *
 * Auth: platform admin only (`is_platform_admin = true` on user_profiles).
 *
 * Response:
 *   {
 *     schools: Array<{
 *       id, name, country, region, city, timezone, default_locale,
 *       subscription_tier, status, bootstrap_expires_at, merged_into_id,
 *       parent_school_id, created_at,
 *       teacher_count, class_count, student_count,
 *       last_active_at  // most recent of audit_events for this school
 *     }>
 *   }
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.7.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";

export async function GET(request: NextRequest) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth.error) return auth.error;

    const supabase = createAdminClient();

    // 1. All schools — the directory
    const { data: schools, error: schoolsErr } = await supabase
      .from("schools")
      .select(
        "id, name, country, region, city, timezone, default_locale, subscription_tier, status, bootstrap_expires_at, merged_into_id, parent_school_id, created_at"
      )
      .order("name", { ascending: true });

    if (schoolsErr) {
      console.error("[admin/schools GET] schools query failed:", schoolsErr);
      return NextResponse.json(
        { error: "Server error" },
        { status: 500 }
      );
    }

    if (!schools || schools.length === 0) {
      return NextResponse.json(
        { schools: [] },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // 2. Aggregate counts — separate queries (Lesson #45: lean on small,
    //    deterministic queries rather than PostgREST embed magic that can
    //    silently drop rows on FK ambiguity).
    const schoolIds = schools.map((s) => s.id);

    const [teacherCounts, classCounts, studentCounts, lastActive] =
      await Promise.all([
        supabase
          .from("teachers")
          .select("school_id")
          .in("school_id", schoolIds)
          .is("deleted_at", null),
        supabase
          .from("classes")
          .select("school_id")
          .in("school_id", schoolIds)
          .is("deleted_at", null),
        supabase
          .from("students")
          .select("school_id")
          .in("school_id", schoolIds)
          .is("deleted_at", null),
        supabase
          .from("audit_events")
          .select("school_id, created_at")
          .in("school_id", schoolIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

    const teacherCountMap = new Map<string, number>();
    for (const row of teacherCounts.data ?? []) {
      teacherCountMap.set(
        row.school_id,
        (teacherCountMap.get(row.school_id) ?? 0) + 1
      );
    }
    const classCountMap = new Map<string, number>();
    for (const row of classCounts.data ?? []) {
      classCountMap.set(
        row.school_id,
        (classCountMap.get(row.school_id) ?? 0) + 1
      );
    }
    const studentCountMap = new Map<string, number>();
    for (const row of studentCounts.data ?? []) {
      studentCountMap.set(
        row.school_id,
        (studentCountMap.get(row.school_id) ?? 0) + 1
      );
    }
    // First row per school_id wins (sorted DESC) — that's the most recent
    const lastActiveMap = new Map<string, string>();
    for (const row of lastActive.data ?? []) {
      if (!lastActiveMap.has(row.school_id)) {
        lastActiveMap.set(row.school_id, row.created_at);
      }
    }

    const enriched = schools.map((s) => ({
      ...s,
      teacher_count: teacherCountMap.get(s.id) ?? 0,
      class_count: classCountMap.get(s.id) ?? 0,
      student_count: studentCountMap.get(s.id) ?? 0,
      last_active_at: lastActiveMap.get(s.id) ?? null,
    }));

    return NextResponse.json(
      { schools: enriched },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[admin/schools GET] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
