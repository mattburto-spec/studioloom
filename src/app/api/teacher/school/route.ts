/**
 * PATCH /api/teacher/school
 *
 * Authenticated teacher sets their own `teachers.school_id`.
 * Body: { schoolId: string | null }
 *
 * - Pass a UUID to link to a school (validated against schools table)
 * - Pass null to clear
 *
 * Called from the welcome wizard (step 1) and from the Settings → Account
 * "School" row.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PATCH = withErrorHandler("teacher/school:PATCH", async (request: NextRequest) => {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { schoolId } = (body ?? {}) as { schoolId?: unknown };

  if (schoolId !== null && typeof schoolId !== "string") {
    return NextResponse.json(
      { error: "schoolId must be a UUID string or null" },
      { status: 400 }
    );
  }
  if (typeof schoolId === "string" && !UUID_RE.test(schoolId)) {
    return NextResponse.json({ error: "schoolId is not a valid UUID" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Validate school exists when setting (skip when clearing)
  if (typeof schoolId === "string") {
    const { data: school, error: lookupError } = await supabase
      .from("schools")
      .select("id")
      .eq("id", schoolId)
      .maybeSingle();

    if (lookupError) {
      console.error("[teacher/school:PATCH] School lookup failed:", lookupError.message);
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }
  }

  const { error } = await supabase
    .from("teachers")
    .update({ school_id: schoolId })
    .eq("id", teacherId);

  if (error) {
    console.error("[teacher/school:PATCH] Update failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, schoolId });
});
