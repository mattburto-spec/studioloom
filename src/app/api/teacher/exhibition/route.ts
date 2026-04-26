import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  requireTeacherAuth,
  verifyTeacherOwnsClass,
} from "@/lib/auth/verify-teacher-unit";

/* ──────────────────────────────────────────────────────────────
 * /api/teacher/exhibition
 *
 * Get / patch the `exhibition_config` JSONB on a class_unit row.
 * Teachers only — ownership of the class is required for both.
 *
 * Phase 13a-2 of the PYPX build. Migration 111 added the column.
 * ────────────────────────────────────────────────────────────── */

export interface ExhibitionMilestone {
  /** Stable id (client-generated, e.g. crypto.randomUUID()) so full-array
   *  replacement on PATCH doesn't lose local UI state. */
  id: string;
  label: string;
  /** ISO date "YYYY-MM-DD". */
  date: string;
  /** Free-form semantic tag (rehearsal / deliverable / checkpoint / …).
   *  UI chooses from a preset list but we don't enforce server-side. */
  type: string;
}

export interface ExhibitionConfig {
  exhibition_date?: string | null;
  milestones?: ExhibitionMilestone[];
  /* Mentor check-in schedule used to live here. Removed — schedules
   * vary per mentor, not per class, so they belong to the upcoming
   * Mentor Manager instead. The PATCH handler drops any stale
   * mentor_checkin_schedule key from existing JSONB rows on next
   * write (see cleanup block below). */
}

// ─────────────────────────────────────────────────────────────
// GET /api/teacher/exhibition?classId=…&unitId=…
// → { exhibition_config: ExhibitionConfig | null }
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const classId = url.searchParams.get("classId");
  const unitId = url.searchParams.get("unitId");
  if (!classId || !unitId) {
    return NextResponse.json(
      { error: "classId + unitId required" },
      { status: 400 },
    );
  }

  const owns = await verifyTeacherOwnsClass(auth.teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("class_units")
    .select("exhibition_config")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .maybeSingle();

  if (error) {
    console.error("[teacher/exhibition GET]", error);
    return NextResponse.json({ error: "Read failed" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "class_unit not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    exhibition_config: (data.exhibition_config as ExhibitionConfig | null) ?? null,
  });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/teacher/exhibition
// body: { classId, unitId, exhibition_date?, milestones? }
//
// Partial merge — only fields present in the body are updated. Pass
// `null` to clear a field (e.g. `{ exhibition_date: null }`). `milestones`
// is always a full-array replacement when present.
// ─────────────────────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  let body: {
    classId?: string;
    unitId?: string;
    exhibition_date?: string | null;
    milestones?: ExhibitionMilestone[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { classId, unitId } = body;
  if (!classId || !unitId) {
    return NextResponse.json(
      { error: "classId + unitId required" },
      { status: 400 },
    );
  }

  const owns = await verifyTeacherOwnsClass(auth.teacherId, classId);
  if (!owns) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = createAdminClient();

  // Load existing config so we can merge partial updates without
  // clobbering fields the client didn't send.
  const { data: existing } = await db
    .from("class_units")
    .select("exhibition_config")
    .eq("class_id", classId)
    .eq("unit_id", unitId)
    .maybeSingle();

  const prev: ExhibitionConfig =
    (existing?.exhibition_config as ExhibitionConfig | null) ?? {};

  const next: ExhibitionConfig = { ...prev };
  if ("exhibition_date" in body) next.exhibition_date = body.exhibition_date;
  if ("milestones" in body) next.milestones = body.milestones;
  // Legacy cleanup — drop fields that lived here in earlier iterations.
  // Both moved out of class-scope (interval_days replaced by free-text
  // schedule, which itself moved to Mentor Manager). Safe to delete —
  // nothing reads them.
  for (const stale of [
    "mentor_checkin_interval_days",
    "mentor_checkin_schedule",
  ]) {
    if (stale in (next as Record<string, unknown>)) {
      delete (next as Record<string, unknown>)[stale];
    }
  }

  const { error: updateErr } = await db
    .from("class_units")
    .update({ exhibition_config: next })
    .eq("class_id", classId)
    .eq("unit_id", unitId);

  if (updateErr) {
    console.error("[teacher/exhibition PATCH]", updateErr);
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }

  return NextResponse.json({ exhibition_config: next });
}
