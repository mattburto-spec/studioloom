import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherHasUnit,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";

// ─────────────────────────────────────────────────────────────────
// PATCH /api/teacher/class-units
// Update a class-unit record (term_id, etc.)
//
// Body: {
//   classId: string,
//   unitId: string,
//   term_id?: string (null to clear),
//   schedule_overrides?: object (lesson schedule adjustments)
// }
// ─────────────────────────────────────────────────────────────────

interface ScheduleOverrides {
  extra_sessions?: Record<string, number>;
  skip_dates?: string[];
  notes?: Record<string, string>;
}

interface UpdateRequest {
  classId: string;
  unitId: string;
  term_id?: string | null;
  schedule_overrides?: ScheduleOverrides;
}

async function PATCH(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as UpdateRequest;

    if (!body.classId || !body.unitId) {
      return NextResponse.json(
        { error: "Missing classId or unitId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Phase 6.2 — gate via can()-backed shims. Opens up co_teacher /
    // dept_head capability for class-unit edits while preserving the
    // legacy author-only access (shims fall back to legacy when the
    // permission_helper_rollout flag is off).
    const [unitAccess, classOwned] = await Promise.all([
      verifyTeacherHasUnit(auth.teacherId, body.unitId),
      verifyTeacherOwnsClass(auth.teacherId, body.classId),
    ]);

    if (!unitAccess.hasAccess || !classOwned) {
      return NextResponse.json(
        { error: "Unit or class not found" },
        { status: 404 }
      );
    }

    // Update class_units record
    const updateData: Record<string, unknown> = {};
    if (body.term_id !== undefined) {
      updateData.term_id = body.term_id;
    }
    if (body.schedule_overrides !== undefined) {
      updateData.schedule_overrides = body.schedule_overrides;
    }

    const { data, error } = await supabase
      .from("class_units")
      .update(updateData)
      .eq("class_id", body.classId)
      .eq("unit_id", body.unitId)
      .select()
      .single();

    if (error) {
      console.error("[class-units PATCH]", error);
      return NextResponse.json(
        { error: "Failed to update class-unit" },
        { status: 500 }
      );
    }

    return NextResponse.json({ classUnit: data });
  } catch (err) {
    console.error("[class-units PATCH]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────
// GET /api/teacher/class-units?classId=...&unitId=...
// Returns the class-unit record including schedule_overrides
// ─────────────────────────────────────────────────────────────────

async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const classId = url.searchParams.get("classId");
    const unitId = url.searchParams.get("unitId");

    if (!classId || !unitId) {
      return NextResponse.json(
        { error: "Missing classId or unitId" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("class_units")
      .select("*")
      .eq("class_id", classId)
      .eq("unit_id", unitId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Class-unit not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ classUnit: data });
  } catch (err) {
    console.error("[class-units GET]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export { GET, PATCH };
