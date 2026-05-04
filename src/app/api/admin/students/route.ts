/**
 * GET /api/admin/students
 * Returns anonymized student roster for the admin Students tab.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "crypto";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();

  try {
    // Note: students table has username + display_name, no `name` column
    // (an old assumption broke this endpoint with a 500 — fixed 4 May 2026).
    // The route doesn't actually USE the name in the response (anonymised
    // by hash) so we just need columns that exist.
    const { data: students, error } = await supabase
      .from("students")
      .select("id, username, display_name, class_id, school_id, created_at, learning_profile, mentor_id, deleted_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) throw error;

    // Get enrollment counts
    const { data: enrollments } = await supabase
      .from("class_students")
      .select("student_id, class_id, is_active");

    const enrollMap = new Map<string, { active: number; total: number }>();
    for (const e of enrollments || []) {
      const entry = enrollMap.get(e.student_id) || { active: 0, total: 0 };
      entry.total++;
      if (e.is_active) entry.active++;
      enrollMap.set(e.student_id, entry);
    }

    // Get progress counts
    const { data: progressCounts } = await supabase
      .from("student_progress")
      .select("student_id");

    const progressMap = new Map<string, number>();
    for (const p of progressCounts || []) {
      if (p.student_id) {
        progressMap.set(p.student_id, (progressMap.get(p.student_id) || 0) + 1);
      }
    }

    const anonymized = (students || []).map((s) => {
      const hash = createHash("sha256").update(s.id).digest("hex").slice(0, 8);
      const enrollment = enrollMap.get(s.id) || { active: 0, total: 0 };
      const hasProfile = s.learning_profile && Object.keys(s.learning_profile).length > 0;

      return {
        hash,
        id: s.id,
        createdAt: s.created_at,
        activeClasses: enrollment.active,
        totalClasses: enrollment.total,
        progressEntries: progressMap.get(s.id) || 0,
        hasLearningProfile: !!hasProfile,
        hasMentor: !!s.mentor_id,
      };
    });

    return NextResponse.json({ students: anonymized });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load students" },
      { status: 500 }
    );
  }
}
