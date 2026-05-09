// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * POST /api/teacher/badges/[id]/assign
 *
 * Assign a badge to students or associate with a unit.
 *
 * Body: {
 *   studentIds?: string[] (assign badge to individual students)
 *   classId?: string (associate badge with a class via unit_badge_requirements)
 *   unitId?: string (required if classId is provided)
 *   note?: string (optional teacher note)
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireTeacher(request);
    if (auth.error) return auth.error;

    const { id } = await params;

    const body = await request.json();
    const { type, studentIds = [], unitId, classId, targetStudentIds, note } = body;

    // Use admin client for write access
    const admin = createAdminClient();

    // Verify badge exists — check DB first, then auto-seed from BUILT_IN_BADGES if needed
    const { data: badgeExists } = await admin
      .from("badges")
      .select("id")
      .eq("id", id)
      .maybeSingle();

    if (!badgeExists) {
      // Try to find in built-in badges and auto-seed to DB
      const builtIn = BUILT_IN_BADGES.find(b => b.id === id || b.slug === id);
      if (!builtIn) {
        return NextResponse.json({ error: "Badge not found" }, { status: 404 });
      }
      // Auto-seed this built-in badge to the DB so FK constraints work
      const { error: seedErr } = await admin.from("badges").upsert({
        id: builtIn.id,
        slug: builtIn.slug,
        name: builtIn.name,
        description: builtIn.description,
        category: builtIn.category || "safety",
        tier: builtIn.tier,
        icon_name: builtIn.icon_name,
        color: builtIn.color,
        is_built_in: true,
        pass_threshold: builtIn.pass_threshold,
        expiry_months: builtIn.expiry_months || null,
        retake_cooldown_minutes: builtIn.retake_cooldown_minutes,
        question_count: builtIn.question_count,
        question_pool: JSON.stringify(builtIn.question_pool),
        learn_content: JSON.stringify(builtIn.learn_content),
      }, { onConflict: "id" });
      if (seedErr) {
        console.error("[badges/[id]/assign] Auto-seed error:", seedErr);
        return NextResponse.json({ error: "Failed to prepare badge" }, { status: 500 });
      }
    }

    const results = {
      student_badges_created: 0,
      unit_badge_requirements_created: 0,
      errors: [] as string[],
    };

    // Grant badge directly to students (no test required)
    if (type === "students" && Array.isArray(studentIds) && studentIds.length > 0) {
      const studentBadges = studentIds.map((studentId: string) => ({
        id: nanoid(12),
        student_id: studentId,
        badge_id: id,
        granted_by: "manual",
        teacher_note: note || null,
        status: "active" as const,
        score: null,
        attempt_number: 1,
        awarded_at: new Date().toISOString(),
        expires_at: null,
      }));

      const { data, error } = await admin
        .from("student_badges")
        .insert(studentBadges)
        .select();

      if (error) {
        console.error("[badges/[id]/assign/POST] Student insert error:", error);
        results.errors.push(`Failed to assign to students: ${error.message}`);
      } else {
        results.student_badges_created = data?.length || 0;
      }
    }

    // Assign badge as unit requirement (scoped to a class, optionally to specific students)
    if (type === "unit" && unitId) {
      if (!classId) {
        return NextResponse.json(
          { error: "classId is required when assigning to a unit" },
          { status: 400 }
        );
      }

      // Get the next display_order for this unit
      const { data: existing } = await admin
        .from("unit_badge_requirements")
        .select("display_order")
        .eq("unit_id", unitId)
        .order("display_order", { ascending: false })
        .limit(1);

      const nextOrder = existing && existing.length > 0 ? (existing[0].display_order || 0) + 1 : 0;

      const insertRow: Record<string, unknown> = {
        id: nanoid(12),
        unit_id: unitId,
        badge_id: id,
        class_id: classId,
        is_required: true,
        display_order: nextOrder,
      };

      // Optional: target specific students (e.g. late arrivals)
      if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
        insertRow.target_student_ids = targetStudentIds;
      }

      const { data, error } = await admin
        .from("unit_badge_requirements")
        .insert([insertRow])
        .select();

      if (error) {
        console.error("[badges/[id]/assign/POST] Unit insert error:", error);
        results.errors.push(`Failed to assign to unit: ${error.message}`);
      } else {
        results.unit_badge_requirements_created = data?.length || 0;
      }
    }

    // If neither type provided, return error
    if (type !== "students" && type !== "unit") {
      return NextResponse.json(
        { error: "Must provide type: 'students' or 'unit'" },
        { status: 400 }
      );
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error("[badges/[id]/assign/POST] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
