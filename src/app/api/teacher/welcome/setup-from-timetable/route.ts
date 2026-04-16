/**
 * POST /api/teacher/welcome/setup-from-timetable
 *
 * Batch endpoint for step 3 of the timetable-first onboarding flow.
 * Takes the AI-detected classes (with teacher-assigned frameworks) plus the
 * raw timetable data, creates all classes, saves the timetable config, and
 * maps class_meetings to the newly-created class IDs.
 *
 * Body: {
 *   classes: [{ name: string, framework: string }],
 *   timetable: {
 *     cycle_length: number,
 *     periods?: [{ period_number, start_time, end_time, duration_minutes }],
 *     entries: [{ day, period, class_name, room?, is_teaching? }],
 *     anchor_date?: string,       // defaults to today
 *     anchor_cycle_day?: number,   // defaults to 1
 *   }
 * }
 *
 * Returns: {
 *   classes: [{ classId: string, classCode: string, className: string }],
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { generateClassCode } from "@/lib/utils";

// Multiple class inserts + timetable save — unlikely to hit this but be safe
export const maxDuration = 30;

const VALID_FRAMEWORKS = new Set([
  "IB_MYP",
  "GCSE_DT",
  "IGCSE_DT",
  "A_LEVEL_DT",
  "ACARA_DT",
  "PLTW",
]);

interface ClassInput {
  name: string;
  framework: string;
  original_name?: string;
}

interface TimetableEntry {
  day: number;
  period: number;
  class_name: string;
  room?: string;
  is_teaching?: boolean;
}

interface TimetableInput {
  cycle_length: number;
  periods?: Array<{
    period_number: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }>;
  entries: TimetableEntry[];
  anchor_date?: string;
  anchor_cycle_day?: number;
  ical_url?: string;
  excluded_dates?: string[];
}

export const POST = withErrorHandler(
  "teacher/welcome/setup-from-timetable:POST",
  async (request: NextRequest) => {
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    let body: { classes?: ClassInput[]; timetable?: TimetableInput };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { classes, timetable } = body;

    if (!classes || !Array.isArray(classes) || classes.length === 0) {
      return NextResponse.json(
        { error: "At least one class is required" },
        { status: 400 }
      );
    }
    if (!timetable || !timetable.cycle_length || !timetable.entries) {
      return NextResponse.json(
        { error: "Timetable data with cycle_length and entries is required" },
        { status: 400 }
      );
    }
    if (timetable.cycle_length < 2 || timetable.cycle_length > 20) {
      return NextResponse.json(
        { error: "cycle_length must be between 2 and 20" },
        { status: 400 }
      );
    }

    // Validate frameworks
    for (const cls of classes) {
      if (!cls.name?.trim()) {
        return NextResponse.json(
          { error: "Every class must have a name" },
          { status: 400 }
        );
      }
      if (!VALID_FRAMEWORKS.has(cls.framework)) {
        return NextResponse.json(
          { error: `Unknown framework "${cls.framework}" for class "${cls.name}"` },
          { status: 400 }
        );
      }
    }

    const supabase = createAdminClient();

    // ── 1. Create all classes ──────────────────────────────────
    const createdClasses: Array<{
      classId: string;
      classCode: string;
      className: string;
    }> = [];

    // Build a name→classId map for timetable entry resolution
    const nameToClassId = new Map<string, string>();

    for (const cls of classes) {
      let classCode = generateClassCode();
      let insertResult;

      for (let attempt = 0; attempt < 5; attempt++) {
        insertResult = await supabase
          .from("classes")
          .insert({
            teacher_id: teacherId,
            name: cls.name.trim(),
            code: classCode,
            framework: cls.framework,
          })
          .select("id, code")
          .single();

        if (!insertResult.error) break;
        if (insertResult.error.code === "23505") {
          classCode = generateClassCode();
          continue;
        }

        console.error(
          "[setup-from-timetable] class insert failed:",
          insertResult.error.message
        );
        return NextResponse.json(
          { error: `Failed to create class "${cls.name}": ${insertResult.error.message}` },
          { status: 500 }
        );
      }

      if (!insertResult || insertResult.error || !insertResult.data) {
        return NextResponse.json(
          { error: `Could not generate a unique class code for "${cls.name}". Please retry.` },
          { status: 500 }
        );
      }

      createdClasses.push({
        classId: insertResult.data.id,
        classCode: insertResult.data.code,
        className: cls.name.trim(),
      });

      // Use original_name for timetable entry matching (teacher may have renamed)
      const matchName = (cls.original_name || cls.name).trim().toLowerCase();
      nameToClassId.set(matchName, insertResult.data.id);
    }

    // ── 2. Compute typical period length from timetable ────────
    if (timetable.periods?.length) {
      const durations = timetable.periods
        .map((p) => p.duration_minutes)
        .filter((d) => d > 0);
      if (durations.length > 0) {
        const avgDuration = Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        );
        // Best-effort stash on teacher profile
        await supabase
          .from("teacher_profiles")
          .upsert(
            {
              teacher_id: teacherId,
              typical_period_minutes: avgDuration,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "teacher_id" }
          )
          .then(({ error }) => {
            if (error) {
              console.warn(
                "[setup-from-timetable] teacher_profiles upsert warning:",
                error.message
              );
            }
          });
      }
    }

    // ── 3. Save timetable ──────────────────────────────────────
    const anchorDate =
      timetable.anchor_date || new Date().toISOString().split("T")[0];
    const anchorCycleDay = timetable.anchor_cycle_day || 1;

    // Delete existing timetable + meetings if any
    const { data: existing } = await supabase
      .from("school_timetable")
      .select("id")
      .eq("teacher_id", teacherId)
      .maybeSingle();

    let timetableId: string;

    // Determine source — ical if URL provided, otherwise manual
    // (ai_upload requires migration 086 on the CHECK constraint)
    const timetableSource = timetable.ical_url ? "ical" : "manual";
    const excludedDates = timetable.excluded_dates || [];

    if (existing) {
      await supabase
        .from("class_meetings")
        .delete()
        .eq("timetable_id", existing.id);

      const { data: updated, error: updateErr } = await supabase
        .from("school_timetable")
        .update({
          cycle_length: timetable.cycle_length,
          cycle_type: "weekday",
          anchor_date: anchorDate,
          anchor_cycle_day: anchorCycleDay,
          reset_each_term: false,
          periods: timetable.periods || [],
          excluded_dates: excludedDates,
          source: timetableSource,
          ...(timetable.ical_url && { ical_url: timetable.ical_url }),
        })
        .eq("teacher_id", teacherId)
        .select("id")
        .single();

      if (updateErr || !updated) {
        console.error("[setup-from-timetable] timetable update error:", updateErr);
        return NextResponse.json(
          { error: "Failed to save timetable" },
          { status: 500 }
        );
      }
      timetableId = updated.id;
    } else {
      const { data: created, error: createErr } = await supabase
        .from("school_timetable")
        .insert({
          teacher_id: teacherId,
          cycle_length: timetable.cycle_length,
          cycle_type: "weekday",
          anchor_date: anchorDate,
          anchor_cycle_day: anchorCycleDay,
          reset_each_term: false,
          periods: timetable.periods || [],
          excluded_dates: excludedDates,
          source: timetableSource,
          ...(timetable.ical_url && { ical_url: timetable.ical_url }),
        })
        .select("id")
        .single();

      if (createErr || !created) {
        console.error("[setup-from-timetable] timetable create error:", createErr);
        return NextResponse.json(
          { error: "Failed to create timetable" },
          { status: 500 }
        );
      }
      timetableId = created.id;
    }

    // ── 4. Map entries to class IDs and save meetings ──────────
    const meetings = timetable.entries
      .filter((e) => e.is_teaching !== false) // include teaching + borderline
      .map((entry) => {
        // Match entry.class_name to a created class
        const classId = nameToClassId.get(entry.class_name.trim().toLowerCase());
        if (!classId) return null; // no matching class — skip
        return {
          timetable_id: timetableId,
          class_id: classId,
          cycle_day: entry.day,
          period_number: entry.period ?? null,
          room: entry.room ?? null,
        };
      })
      .filter(Boolean);

    if (meetings.length > 0) {
      const { error: meetErr } = await supabase
        .from("class_meetings")
        .insert(meetings);

      if (meetErr) {
        console.error(
          "[setup-from-timetable] meetings insert error:",
          meetErr.message
        );
        // Non-fatal — classes are created, timetable is saved, just meetings
        // failed. Teacher can fix in Settings.
      }
    }

    return NextResponse.json({ classes: createdClasses });
  }
);
