// audit-skip: Unit Briefs Foundation Phase B.1 MVP. Same audit-sensitivity
// class as /api/teacher/unit-brief — teacher-authored pedagogical content,
// only the unit author can write (verifyTeacherHasUnit.isAuthor gates POST).
// Tracked under FU-BRIEFS-AUDIT-COVERAGE for the next audit-tightening sweep.
//
// Unit Briefs Foundation Phase B.1 — append-only amendments stream
// on top of unit_briefs. Mirrors the v1 RFI / change-order workflow:
// teachers add labelled amendments ("v2.0 — add LEDs") that students
// see stacked in their drawer. No edits, no deletes — once filed, the
// amendment is part of the unit history.

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireTeacher } from "@/lib/auth/require-teacher";
import { verifyTeacherHasUnit } from "@/lib/auth/verify-teacher-unit";
import type { UnitBriefAmendment } from "@/types/unit-brief";

const COLUMNS_RETURNED =
  "id, unit_id, version_label, title, body, created_at, created_by";

const VERSION_LABEL_MAX = 20;

function rowToAmendment(row: Record<string, unknown>): UnitBriefAmendment {
  return {
    id: row.id as string,
    unit_id: row.unit_id as string,
    version_label: row.version_label as string,
    title: row.title as string,
    body: row.body as string,
    created_at: row.created_at as string,
    created_by: (row.created_by as string | null) ?? null,
  };
}

/**
 * GET /api/teacher/unit-brief/amendments?unitId=<uuid>
 *
 * Returns all amendments for a unit, ordered by created_at DESC
 * (latest first — matches the teacher review pattern). The student
 * drawer reverses on render to show oldest first.
 *
 * Author + co-teachers may read.
 */
export const GET = withErrorHandler(
  "teacher/unit-brief-amendments:GET",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("unit_brief_amendments")
      .select(COLUMNS_RETURNED)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      amendments: (data ?? []).map((row) =>
        rowToAmendment(row as Record<string, unknown>),
      ),
    });
  },
);

/**
 * POST /api/teacher/unit-brief/amendments
 *
 * Body: { unitId: string, version_label: string, title: string, body: string }
 *
 * Appends one amendment. version_label is free text capped at 20 chars
 * (Phase D.2 decision — no format enforced). title + body required and
 * non-empty. Only the unit AUTHOR may add amendments.
 *
 * Returns the new row. The DB also has CHECK constraints that mirror
 * these app-side validations (defence in depth).
 */
export const POST = withErrorHandler(
  "teacher/unit-brief-amendments:POST",
  async (request: NextRequest) => {
    const teacher = await requireTeacher(request);
    if (teacher.error) return teacher.error;
    const teacherId = teacher.teacherId;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "body must be an object" },
        { status: 400 },
      );
    }
    const b = body as Record<string, unknown>;

    if (typeof b.unitId !== "string" || b.unitId.length === 0) {
      return NextResponse.json(
        { error: "unitId required (string)" },
        { status: 400 },
      );
    }
    const unitId = b.unitId;

    const versionLabel =
      typeof b.version_label === "string" ? b.version_label.trim() : "";
    const title = typeof b.title === "string" ? b.title.trim() : "";
    const bodyText = typeof b.body === "string" ? b.body.trim() : "";

    if (versionLabel.length === 0) {
      return NextResponse.json(
        { error: "version_label required (non-empty string)" },
        { status: 400 },
      );
    }
    if (versionLabel.length > VERSION_LABEL_MAX) {
      return NextResponse.json(
        { error: `version_label must be ${VERSION_LABEL_MAX} characters or fewer` },
        { status: 400 },
      );
    }
    if (title.length === 0) {
      return NextResponse.json(
        { error: "title required (non-empty string)" },
        { status: 400 },
      );
    }
    if (bodyText.length === 0) {
      return NextResponse.json(
        { error: "body required (non-empty string)" },
        { status: 400 },
      );
    }

    const access = await verifyTeacherHasUnit(teacherId, unitId);
    if (!access.isAuthor) {
      return NextResponse.json(
        { error: "Only the unit author can add amendments" },
        { status: 403 },
      );
    }

    const db = createAdminClient();
    const { data, error } = await db
      .from("unit_brief_amendments")
      .insert({
        unit_id: unitId,
        version_label: versionLabel,
        title,
        body: bodyText,
        created_by: teacherId,
      })
      .select(COLUMNS_RETURNED)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Failed to save amendment" },
        { status: 500 },
      );
    }

    return NextResponse.json({ amendment: rowToAmendment(data) });
  },
);
