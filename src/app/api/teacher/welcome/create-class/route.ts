// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * POST /api/teacher/welcome/create-class
 *
 * Phase 1B — Teacher Onboarding Flow. Called from step 2 of `/teacher/welcome`.
 *
 * Creates the teacher's very first class. A fresh invitee lands in the welcome
 * wizard with zero classes; this endpoint shortcuts the full dashboard flow
 * with a minimal `{ name, framework, periodLengthMinutes? }` body so the
 * wizard step can stay tight.
 *
 * Side effects:
 *   1. Inserts a row into `classes` with a generated 6-char class code.
 *   2. If `periodLengthMinutes` is supplied, upserts
 *      `teacher_profiles.typical_period_minutes` so downstream generation
 *      picks it up without a second trip to settings.
 *
 * Does NOT set `teachers.onboarded_at` — the `/complete` endpoint does that
 * only after the teacher has seen their credentials screen. If they bounce
 * before the end, the layout redirect pulls them back here.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { enforceClassCreateLimit } from "@/lib/access-v2/plan-gates";
import { generateClassCode } from "@/lib/utils";

// Keep in sync with the wizard's framework picker. Other frameworks are
// still creatable via the full settings UI — this list is just the curated
// "starter" set.
const VALID_FRAMEWORKS = new Set([
  "IB_MYP",
  "GCSE_DT",
  "IGCSE_DT",
  "A_LEVEL_DT",
  "ACARA_DT",
  "PLTW",
]);

const MIN_PERIOD = 30;
const MAX_PERIOD = 120;

export const POST = withErrorHandler(
  "teacher/welcome/create-class:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: {
      name?: string;
      framework?: string;
      periodLengthMinutes?: number;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = body.name?.trim();
    const framework = body.framework?.trim();
    const periodLengthMinutes = body.periodLengthMinutes;

    if (!name) {
      return NextResponse.json(
        { error: "Class name is required" },
        { status: 400 }
      );
    }
    if (!framework || !VALID_FRAMEWORKS.has(framework)) {
      return NextResponse.json(
        { error: "Unknown framework. Pick one from the list." },
        { status: 400 }
      );
    }
    if (
      periodLengthMinutes !== undefined &&
      (typeof periodLengthMinutes !== "number" ||
        periodLengthMinutes < MIN_PERIOD ||
        periodLengthMinutes > MAX_PERIOD)
    ) {
      return NextResponse.json(
        {
          error: `Period length must be between ${MIN_PERIOD} and ${MAX_PERIOD} minutes`,
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // TODO(access-v2 §4.0): replace with requireActorSession().schoolId once Phase 1 lands.
    // classes.school_id was tightened to NOT NULL by mig 20260428222049_phase_0_8b.
    const { data: welcomeTeacherRow } = await supabase
      .from("teachers")
      .select("school_id")
      .eq("id", teacherId)
      .single();
    if (!welcomeTeacherRow?.school_id) {
      return NextResponse.json(
        { error: "Teacher missing school context" },
        { status: 500 }
      );
    }

    // Phase 4.8b — plan-gate chokepoint (pass-through today; freemium
    // build wires real count + cap from admin_settings).
    const gate = await enforceClassCreateLimit(teacherId);
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: `Class create limit reached for your plan (${gate.tier}): ${gate.current}/${gate.cap}.`,
          reason: gate.reason,
          tier: gate.tier,
          cap: gate.cap,
          current: gate.current,
        },
        { status: 422 }
      );
    }

    // Generate a class code, retrying a few times on collision. 6 chars from a
    // 32-char alphabet = ~1 in a billion collision rate at N=1000 classes, but
    // retry anyway so a collision doesn't 500 the welcome flow.
    let classCode = generateClassCode();
    let insertResult;
    for (let attempt = 0; attempt < 5; attempt++) {
      insertResult = await supabase
        .from("classes")
        .insert({
          teacher_id: teacherId,
          school_id: welcomeTeacherRow.school_id,
          name,
          code: classCode,
          framework,
        })
        .select("id, code")
        .single();

      if (!insertResult.error) break;

      // 23505 = unique_violation on `code`
      if (insertResult.error.code === "23505") {
        classCode = generateClassCode();
        continue;
      }

      console.error(
        "[welcome/create-class] classes insert failed:",
        insertResult.error.message
      );
      return NextResponse.json(
        { error: insertResult.error.message },
        { status: 500 }
      );
    }

    if (!insertResult || insertResult.error || !insertResult.data) {
      return NextResponse.json(
        { error: "Could not generate a unique class code. Please retry." },
        { status: 500 }
      );
    }

    // Best-effort: stash period length on the teacher profile so downstream
    // generation picks it up. Non-blocking — a failure here doesn't cost
    // the teacher their class.
    if (periodLengthMinutes) {
      const { error: profileErr } = await supabase
        .from("teacher_profiles")
        .upsert(
          {
            teacher_id: teacherId,
            typical_period_minutes: periodLengthMinutes,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "teacher_id" }
        );
      if (profileErr) {
        console.warn(
          "[welcome/create-class] teacher_profiles upsert warning:",
          profileErr.message
        );
      }
    }

    return NextResponse.json({
      classId: insertResult.data.id,
      classCode: insertResult.data.code,
    });
  }
);
