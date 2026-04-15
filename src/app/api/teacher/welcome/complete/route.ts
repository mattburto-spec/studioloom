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
 *
 * Idempotent — calling this twice is fine. If `onboarded_at` is already
 * set we leave it, so we don't lose the original completion timestamp.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

export const POST = withErrorHandler(
  "teacher/welcome/complete:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: { name?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — name update is optional.
    }

    const nextName = body.name?.trim();

    const supabase = createAdminClient();

    // Pull current state so we don't overwrite an existing onboarded_at
    // and can decide whether to touch the name column.
    const { data: current, error: loadErr } = await supabase
      .from("teachers")
      .select("id, name, onboarded_at")
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

    const patch: { onboarded_at?: string; name?: string } = {};
    if (!current.onboarded_at) {
      patch.onboarded_at = new Date().toISOString();
    }
    if (nextName && nextName !== current.name) {
      patch.name = nextName;
    }

    if (Object.keys(patch).length === 0) {
      // Nothing to change — e.g. already onboarded, same name.
      return NextResponse.json({
        ok: true,
        onboarded_at: current.onboarded_at,
        name: current.name,
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("teachers")
      .update(patch)
      .eq("id", teacherId)
      .select("id, name, onboarded_at")
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
    });
  }
);
