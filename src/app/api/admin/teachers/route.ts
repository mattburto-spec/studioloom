/**
 * GET /api/admin/teachers
 * Returns all teachers with usage stats for the admin Teachers tab.
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  try {
    const { data: teachers, error } = await supabase
      .from("teachers")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Get class counts per teacher
    const { data: classes } = await supabase
      .from("classes")
      .select("id, teacher_id");

    // Get unit counts per teacher
    const { data: units } = await supabase
      .from("units")
      .select("id, author_teacher_id");

    const classMap = new Map<string, number>();
    for (const c of classes || []) {
      classMap.set(c.teacher_id, (classMap.get(c.teacher_id) || 0) + 1);
    }

    const unitMap = new Map<string, number>();
    for (const u of units || []) {
      if (u.author_teacher_id) {
        unitMap.set(u.author_teacher_id, (unitMap.get(u.author_teacher_id) || 0) + 1);
      }
    }

    const enriched = (teachers || []).map((t) => ({
      ...t,
      classCount: classMap.get(t.id) || 0,
      unitCount: unitMap.get(t.id) || 0,
    }));

    return NextResponse.json({ teachers: enriched });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load teachers" },
      { status: 500 }
    );
  }
}
