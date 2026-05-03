// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/welcome/complete
 *
 * Phase 1B — Teacher Onboarding Flow. Called from the final step of
 * `/teacher/welcome` once the teacher has seen their class credentials.
 *
 * Side effects:
 *   1. Sets `teachers.onboarded_at = now()` so the layout redirect in
 *      `/teacher/layout.tsx` stops pulling them back to the wizard.
 *   2. Optionally updates `teachers.name` if the wizard passed a fresh
 *      value (step 1 of the wizard lets a teacher confirm/adjust their
 *      name before it lands on dashboards and gradebooks).
 *   3. Optionally sets `teachers.school_id` if the wizard passed one
 *      (step 1 picker, migration 085). Accepts a UUID or null; null
 *      leaves school_id untouched (use PATCH /api/teacher/school to
 *      clear explicitly).
 *
 * Idempotent — calling this twice is fine. If `onboarded_at` is already
 * set we leave it, so we don't lose the original completion timestamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST = withErrorHandler(
  "teacher/welcome/complete:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: { name?: string; schoolId?: string | null } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — all wizard fields are optional.
    }

    const nextName = body.name?.trim();
    const rawSchoolId = body.schoolId;

    // Validate schoolId shape before touching the DB. Anything we can't
    // parse cleanly is treated as "don't update this column" — better to
    // skip than to blow up the whole wizard-complete flow.
    let nextSchoolId: string | undefined = undefined;
    if (typeof rawSchoolId === "string" && UUID_RE.test(rawSchoolId)) {
      nextSchoolId = rawSchoolId;
    }

    const supabase = createAdminClient();

    // Pull current state so we don't overwrite an existing onboarded_at
    // and can decide whether to touch the name/school columns.
    const { data: current, error: loadErr } = await supabase
      .from("teachers")
      .select("id, name, onboarded_at, school_id")
      .eq("id", teacherId)
      .single();

    if (loadErr || !current) {
      console.error(
        "[welcome/complete] could not load teacher:",
        loadErr?.message
      );
      return NextResponse.json(
        { error: "Teacher not found" },
        { status: 404 }
      );
    }

    // If a school_id was provided, sanity-check it exists. Silent skip on
    // not-found so a deleted school doesn't wedge the wizard — the teacher
    // can re-pick from settings.
    if (nextSchoolId) {
      const { data: school } = await supabase
        .from("schools")
        .select("id")
        .eq("id", nextSchoolId)
        .maybeSingle();
      if (!school) {
        nextSchoolId = undefined;
      }
    }

    const patch: {
      onboarded_at?: string;
      name?: string;
      school_id?: string;
    } = {};
    if (!current.onboarded_at) {
      patch.onboarded_at = new Date().toISOString();
    }
    if (nextName && nextName !== current.name) {
      patch.name = nextName;
    }
    if (nextSchoolId && nextSchoolId !== current.school_id) {
      patch.school_id = nextSchoolId;
    }

    if (Object.keys(patch).length === 0) {
      // Nothing to change — e.g. already onboarded, same name, same school.
      return NextResponse.json({
        ok: true,
        onboarded_at: current.onboarded_at,
        name: current.name,
        school_id: current.school_id,
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("teachers")
      .update(patch)
      .eq("id", teacherId)
      .select("id, name, onboarded_at, school_id")
      .single();

    if (updateErr) {
      console.error(
        "[welcome/complete] teacher update failed:",
        updateErr.message
      );
      return NextResponse.json(
        { error: updateErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      onboarded_at: updated.onboarded_at,
      name: updated.name,
      school_id: updated.school_id,
    });
  }
);
