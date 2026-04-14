/**
 * GET /api/admin/schools
 * Returns class → teacher hierarchy for the admin Schools tab.
 * No schools entity exists yet (FU-P), so this returns a flat class list grouped by teacher.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: classes, error } = await supabase
      .from("classes")
      .select("id, name, teacher_id, framework, subject, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get teacher names
    const { data: teachers } = await supabase
      .from("teachers")
      .select("id, name, email");

    const teacherMap = new Map<string, string>();
    for (const t of teachers || []) {
      teacherMap.set(t.id, t.name || t.email || t.id.slice(0, 8));
    }

    // Get student counts per class
    const { data: enrollments } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("is_active", true);

    const countMap = new Map<string, number>();
    for (const e of enrollments || []) {
      countMap.set(e.class_id, (countMap.get(e.class_id) || 0) + 1);
    }

    const enriched = (classes || []).map((c) => ({
      ...c,
      teacherName: teacherMap.get(c.teacher_id) || c.teacher_id.slice(0, 8),
      studentCount: countMap.get(c.id) || 0,
    }));

    return NextResponse.json({ classes: enriched });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load schools data" },
      { status: 500 }
    );
  }
}
