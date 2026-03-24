/**
 * Teacher Badge Status by Class
 *
 * GET /api/teacher/badges/class-status?classId=xxx&unitId=yyy
 *   Returns badge requirements for a unit and each student's completion
 *   status. Powers the badge column on the teacher progress page.
 *
 *   Returns: {
 *     requirements: Array<{
 *       badge_id: string;
 *       badge_name: string;
 *       badge_slug: string;
 *       is_required: boolean;
 *     }>;
 *     student_status: Record<string, Array<{
 *       badge_id: string;
 *       status: 'earned' | 'failed' | 'not_attempted';
 *       score: number | null;
 *       awarded_at: string | null;
 *     }>>;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

function createSupabaseServer(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServer(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const unitId = url.searchParams.get("unitId");

    if (!classId || !unitId) {
      return NextResponse.json(
        { error: "classId and unitId required" },
        { status: 400 }
      );
    }

    const db = createAdminClient();

    // Verify teacher owns this class
    const { data: cls } = await db
      .from("classes")
      .select("id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .single();

    if (!cls) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Get badge requirements for this unit
    const { data: requirements } = await db
      .from("unit_badge_requirements")
      .select(`
        badge_id,
        is_required,
        badges (
          id, name, slug
        )
      `)
      .eq("unit_id", unitId)
      .order("display_order");

    if (!requirements || requirements.length === 0) {
      return NextResponse.json({
        requirements: [],
        student_status: {},
      });
    }

    // Get students in this class via class_students junction (migration 041)
    const { data: enrollments } = await db
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId)
      .eq("is_active", true);

    const studentIds = (enrollments || []).map((e: { student_id: string }) => e.student_id);
    if (studentIds.length === 0) {
      return NextResponse.json({
        requirements: requirements.map((r: any) => ({
          badge_id: (r.badges as any).id,
          badge_name: (r.badges as any).name,
          badge_slug: (r.badges as any).slug,
          is_required: r.is_required,
        })),
        student_status: {},
      });
    }

    // Get badge IDs
    const badgeIds = requirements.map((r: any) => (r.badges as any).id);

    // Get all student_badges for these students and badges
    const { data: studentBadges } = await db
      .from("student_badges")
      .select("student_id, badge_id, status, score, awarded_at")
      .in("student_id", studentIds)
      .in("badge_id", badgeIds);

    // Also get the latest failed attempt for students without badges
    const { data: failedResults } = await db
      .from("safety_results")
      .select("student_id, badge_id, score, passed, created_at")
      .in("student_id", studentIds)
      .in("badge_id", badgeIds)
      .eq("passed", false)
      .order("created_at", { ascending: false });

    // Build per-student status map
    const studentStatus: Record<
      string,
      Array<{
        badge_id: string;
        status: "earned" | "failed" | "not_attempted";
        score: number | null;
        awarded_at: string | null;
      }>
    > = {};

    for (const sid of studentIds) {
      studentStatus[sid] = badgeIds.map((bid: string) => {
        const sb = (studentBadges || []).find(
          (b: any) => b.student_id === sid && b.badge_id === bid
        );

        if (sb && sb.status === "active") {
          return {
            badge_id: bid,
            status: "earned" as const,
            score: sb.score,
            awarded_at: sb.awarded_at,
          };
        }

        // Check for failed attempt
        const fail = (failedResults || []).find(
          (f: any) => f.student_id === sid && f.badge_id === bid
        );

        if (fail) {
          return {
            badge_id: bid,
            status: "failed" as const,
            score: fail.score,
            awarded_at: null,
          };
        }

        return {
          badge_id: bid,
          status: "not_attempted" as const,
          score: null,
          awarded_at: null,
        };
      });
    }

    return NextResponse.json({
      requirements: requirements.map((r: any) => ({
        badge_id: (r.badges as any).id,
        badge_name: (r.badges as any).name,
        badge_slug: (r.badges as any).slug,
        is_required: r.is_required,
      })),
      student_status: studentStatus,
    });
  } catch (error) {
    console.error("[badges/class-status] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
