// audit-skip: routine learner activity, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { moderateAndLog } from "@/lib/content-safety/moderate-and-log";
import { createHash } from "crypto";

// In-memory hash cache: progressRowId → last moderated content hash.
// Prevents duplicate Haiku calls when autosave fires with unchanged text.
// Resets on server restart (acceptable: one extra call per row after cold start).
const lastModeratedHash = new Map<string, string>();

// Mappings for pre-migration-011 fallback
const PAGE_ID_TO_NUMBER: Record<string, number> = {
  A1: 1, A2: 2, A3: 3, A4: 4,
  B1: 5, B2: 6, B3: 7, B4: 8,
  C1: 9, C2: 10, C3: 11, C4: 12,
  D1: 13, D2: 14, D3: 15, D4: 16,
};
const NUMBER_TO_PAGE_ID: Record<number, string> = {
  1: "A1", 2: "A2", 3: "A3", 4: "A4",
  5: "B1", 6: "B2", 7: "B3", 8: "B4",
  9: "C1", 10: "C2", 11: "C3", 12: "C4",
  13: "D1", 14: "D2", 15: "D3", 16: "D4",
};

// GET: Load progress for a specific unit
export const GET = withErrorHandler("student/progress:GET", async (request: NextRequest) => {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { searchParams } = new URL(request.url);
  const unitId = searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: progress } = await supabase
    .from("student_progress")
    .select("*")
    .eq("student_id", studentId)
    .eq("unit_id", unitId);

  // Normalize progress — ensure page_id exists on every record
  const normalized = (progress || []).map((p: Record<string, unknown>) => {
    if (!p.page_id && p.page_number) {
      return { ...p, page_id: NUMBER_TO_PAGE_ID[p.page_number as number] || `page_${p.page_number}` };
    }
    return p;
  });

  return NextResponse.json({ progress: normalized });
});

// POST: Save/update progress for a specific page
export const POST = withErrorHandler("student/progress:POST", async (request: NextRequest) => {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { unitId, pageId, status, responses, timeSpent, integrityMetadata } =
    await request.json();

  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Phase 0.9 (Dimensions3): resolve class_id so progress rows are no longer
  // ambiguous when a student is enrolled in multiple classes. Uses the same
  // junction + legacy intersection pattern as src/app/api/student/unit/route.ts.
  // Falls back to NULL if the student is in multiple classes AND the unit is
  // assigned to more than one of them (ambiguous — the POST caller never says
  // which class the session is in). Migration 065 also runs a best-effort
  // backfill for single-class students.
  let resolvedClassId: string | null = null;
  try {
    const [{ data: enrollments }, { data: student }] = await Promise.all([
      supabase
        .from("class_students")
        .select("class_id")
        .eq("student_id", studentId)
        .eq("is_active", true),
      supabase
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .single(),
    ]);

    const activeClassIds = new Set<string>();
    if (enrollments) {
      for (const e of enrollments as { class_id: string }[]) {
        if (e.class_id) activeClassIds.add(e.class_id);
      }
    }
    if (student?.class_id) activeClassIds.add(student.class_id);

    if (activeClassIds.size > 0) {
      const { data: cuRows } = await supabase
        .from("class_units")
        .select("class_id")
        .in("class_id", Array.from(activeClassIds))
        .eq("unit_id", unitId)
        .eq("is_active", true);
      if (cuRows && cuRows.length === 1) {
        resolvedClassId = (cuRows[0] as { class_id: string }).class_id;
      }
    }
  } catch {
    // Non-fatal — class_id is additive context, not a write gate.
  }

  // Build upsert payload
  const upsertPayload: Record<string, unknown> = {
    student_id: studentId,
    unit_id: unitId,
    page_id: pageId,
    ...(resolvedClassId && { class_id: resolvedClassId }),
    ...(status && { status }),
    ...(responses && { responses }),
    ...(timeSpent !== undefined && { time_spent: timeSpent }),
    ...(integrityMetadata && { integrity_metadata: integrityMetadata }),
  };

  if (integrityMetadata) {
    console.log("[student/progress] Saving with integrity_metadata:", Object.keys(integrityMetadata));
  }

  // Try page_id-based upsert (post-migration 011)
  let { data, error } = await supabase
    .from("student_progress")
    .upsert(upsertPayload, { onConflict: "student_id,unit_id,page_id" })
    .select()
    .single();

  // Lesson Learned #17: retry without integrity_metadata if migration 054 not applied
  // Check multiple error patterns: message includes column name, PGRST204, or PostgreSQL 42703 (undefined column)
  if (error && integrityMetadata && (
    error.message?.includes("integrity_metadata") ||
    error.code === "PGRST204" ||
    error.code === "42703"
  )) {
    console.warn("[student/progress] integrity_metadata column not found, retrying without it. Error:", error.message, error.code);
    delete upsertPayload.integrity_metadata;
    const retry = await supabase
      .from("student_progress")
      .upsert(upsertPayload, { onConflict: "student_id,unit_id,page_id" })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error && (error.message?.includes("does not exist") || error.message?.includes("Could not find"))) {
    // Fallback: migration 011 not yet applied, use page_number
    const pageNumber = PAGE_ID_TO_NUMBER[pageId];
    if (!pageNumber) {
      return NextResponse.json(
        { error: "Custom pages require database migration 011" },
        { status: 500 }
      );
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("student_progress")
      .upsert(
        {
          student_id: studentId,
          unit_id: unitId,
          page_number: pageNumber,
          ...(resolvedClassId && { class_id: resolvedClassId }),
          ...(status && { status }),
          ...(responses && { responses }),
          ...(timeSpent !== undefined && { time_spent: timeSpent }),
        },
        {
          onConflict: "student_id,unit_id,page_number",
        }
      )
      .select()
      .single();

    if (fallbackError) {
      return NextResponse.json(
        { error: fallbackError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ progress: fallbackData });
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Phase 5F: Fire-and-forget server moderation (non-blocking for auto-save)
  // Hash-and-skip: only call Haiku when content actually changed (saves $$)
  if (responses && data?.id) {
    const textToModerate = typeof responses === 'string'
      ? responses
      : JSON.stringify(responses);
    if (textToModerate.length > 2) { // skip empty objects '{}'
      const hash = createHash('sha256').update(textToModerate).digest('hex').slice(0, 16);
      const prevHash = lastModeratedHash.get(data.id);

      if (hash !== prevHash) {
        lastModeratedHash.set(data.id, hash);
        const moderationCtx = {
          classId: resolvedClassId || '',
          studentId,
          source: 'student_progress' as const,
        };
        moderateAndLog(textToModerate, moderationCtx).then(({ result }) => {
          createAdminClient()
            .from('student_progress')
            .update({
              moderation_status: result.moderation.status,
              moderation_flags: result.moderation.flags,
            })
            .eq('id', data.id)
            .then(({ error: updateErr }) => {
              if (updateErr) console.error('[progress] moderation status update failed:', updateErr);
            });
        }).catch((err) => {
          console.error('[progress] fire-and-forget moderation failed:', err);
        });
      }
    }
  }

  return NextResponse.json({ progress: data });
});
