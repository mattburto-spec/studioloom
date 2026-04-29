/**
 * Student Pending Safety Badges API
 *
 * GET /api/student/safety/pending
 *   Returns badges that are REQUIRED for the student's assigned units
 *   but not yet earned. This powers the "Required Safety Tests" section
 *   on the student dashboard.
 *
 *   Returns: {
 *     pending: Array<{
 *       badge_id: string;
 *       badge_name: string;
 *       badge_slug: string;
 *       badge_description: string;
 *       badge_icon: string;
 *       badge_color: string;
 *       badge_tier: number;
 *       pass_threshold: number;
 *       question_count: number;
 *       unit_id: string;
 *       unit_title: string;
 *       student_status: 'not_started' | 'cooldown' | 'expired';
 *       cooldown_until?: string;
 *     }>;
 *     earned: Array<{
 *       badge_id: string;
 *       badge_name: string;
 *       badge_slug: string;
 *       badge_icon: string;
 *       badge_color: string;
 *       earned_at: string;
 *       expires_at: string | null;
 *     }>;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";

export async function GET(request: NextRequest) {
  // Phase 1.4b — explicit Supabase Auth via requireStudentSession.
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  try {
    const db = createAdminClient();

    // 1. Get student's class(es) via class_students junction (migration 041)
    const { data: enrollments, error: enrollErr } = await db
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let studentClassIds: string[] = (enrollments || []).map((e: { class_id: string }) => e.class_id);

    if (enrollErr || studentClassIds.length === 0) {
      // Legacy fallback: try students.class_id
      const { data: student } = await db
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .single();

      if (!student?.class_id) {
        return NextResponse.json({ pending: [], earned: [] });
      }
      studentClassIds = [student.class_id];
    }

    // 2. Get unit IDs assigned to this student's classes via class_units
    const { data: classUnits } = await db
      .from("class_units")
      .select("unit_id")
      .in("class_id", studentClassIds);

    const unitIds = (classUnits || []).map((cu: { unit_id: string }) => cu.unit_id);
    if (unitIds.length === 0) {
      return NextResponse.json({ pending: [], earned: [] });
    }

    // 3. Get badge requirements for those units
    //    Filter by class_id: NULL (all classes) OR matching student's class
    //    Then filter by target_student_ids: NULL (all students) OR includes this student
    const { data: allRequirements } = await db
      .from("unit_badge_requirements")
      .select(`
        unit_id,
        badge_id,
        is_required,
        class_id,
        target_student_ids,
        badges (
          id, name, slug, description, icon_name, color, tier,
          pass_threshold, question_count, retake_cooldown_minutes
        )
      `)
      .in("unit_id", unitIds);

    // Filter requirements: only those targeting this student's class(es) (or all classes)
    // and targeting this student (or all students)
    const studentClassIdSet = new Set(studentClassIds);
    const requirements = (allRequirements || []).filter((req: any) => {
      // class_id NULL = applies to all classes; otherwise must match one of student's classes
      if (req.class_id && !studentClassIdSet.has(req.class_id)) return false;
      // target_student_ids NULL/empty = all students; otherwise must include this student
      if (req.target_student_ids && Array.isArray(req.target_student_ids) && req.target_student_ids.length > 0) {
        if (!req.target_student_ids.includes(studentId)) return false;
      }
      return true;
    });

    if (!requirements || requirements.length === 0) {
      return NextResponse.json({ pending: [], earned: [] });
    }

    // 4. Get unit titles
    const { data: units } = await db
      .from("units")
      .select("id, title")
      .in("id", unitIds);

    const unitTitleMap = new Map(
      (units || []).map((u: { id: string; title: string }) => [u.id, u.title])
    );

    // 5. Get student's existing badges
    const badgeIds = requirements.map((r: any) => (r.badges as any)?.id).filter(Boolean);
    const { data: studentBadges } = await db
      .from("student_badges")
      .select("badge_id, status, awarded_at, expires_at")
      .eq("student_id", studentId)
      .in("badge_id", badgeIds);

    // 6. Get recent failures for cooldown (failed attempts stored as status='expired' in student_badges)
    const { data: recentFailures } = await db
      .from("student_badges")
      .select("badge_id, created_at")
      .eq("student_id", studentId)
      .eq("status", "expired")
      .in("badge_id", badgeIds)
      .order("created_at", { ascending: false })
      .limit(50);

    // 7. Build pending and earned lists
    const now = new Date();
    const pending: any[] = [];
    const earned: any[] = [];
    const seenBadges = new Set<string>();

    for (const req of requirements) {
      const badge = req.badges as any;
      if (!badge || seenBadges.has(badge.id)) continue;
      seenBadges.add(badge.id);

      // Prefer "active" badge over old failed "expired" attempts
      const sb = (studentBadges || []).find(
        (s: any) => s.badge_id === badge.id && s.status === "active"
      ) || (studentBadges || []).find(
        (s: any) => s.badge_id === badge.id
      );

      // Check if earned and active
      if (sb && sb.status === "active") {
        const isExpired = sb.expires_at && new Date(sb.expires_at) < now;
        if (!isExpired) {
          earned.push({
            badge_id: badge.id,
            badge_name: badge.name,
            badge_slug: badge.slug,
            badge_icon: badge.icon_name,
            badge_color: badge.color,
            earned_at: sb.awarded_at,
            expires_at: sb.expires_at,
          });
          continue;
        }
      }

      // Not earned — check cooldown
      let student_status: "not_started" | "cooldown" | "expired" = "not_started";
      let cooldown_until: string | undefined;

      if (sb && (sb.status === "expired" || (sb.expires_at && new Date(sb.expires_at) < now))) {
        student_status = "expired";
      }

      const lastFail = (recentFailures || []).find(
        (f: any) => f.badge_id === badge.id
      );
      if (lastFail) {
        const cooldownMs = (badge.retake_cooldown_minutes || 0) * 60 * 1000;
        const cooldownEnd = new Date(new Date(lastFail.created_at).getTime() + cooldownMs);
        if (cooldownEnd > now) {
          student_status = "cooldown";
          cooldown_until = cooldownEnd.toISOString();
        }
      }

      pending.push({
        badge_id: badge.id,
        badge_name: badge.name,
        badge_slug: badge.slug,
        badge_description: badge.description,
        badge_icon: badge.icon_name,
        badge_color: badge.color,
        badge_tier: badge.tier,
        pass_threshold: badge.pass_threshold,
        question_count: badge.question_count,
        unit_id: req.unit_id,
        unit_title: unitTitleMap.get(req.unit_id) || "Unknown unit",
        student_status,
        cooldown_until,
      });
    }

    return NextResponse.json({ pending, earned });
  } catch (err) {
    console.error("[student/safety/pending] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
