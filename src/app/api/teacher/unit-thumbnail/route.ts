// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacher } from "@/lib/auth/require-teacher";

/**
 * PATCH: Update a unit's thumbnail_url (gallery selection or null to reset)
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const body = await request.json();
  const { unitId, thumbnailUrl } = body;

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify teacher owns this unit
  const { data: unit } = await admin
    .from("units")
    .select("id, author_teacher_id")
    .eq("id", unitId)
    .maybeSingle();

  if (!unit || unit.author_teacher_id !== teacherId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Update thumbnail_url (null = reset to default)
  const { error } = await admin
    .from("units")
    .update({ thumbnail_url: thumbnailUrl ?? null })
    .eq("id", unitId);

  if (error) {
    // Graceful degradation if column doesn't exist yet
    if (error.message?.includes("thumbnail_url") || error.code === "PGRST204") {
      return NextResponse.json({ error: "Migration 052 not yet applied" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, thumbnailUrl: thumbnailUrl ?? null });
}
