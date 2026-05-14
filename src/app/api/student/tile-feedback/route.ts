/**
 * GET /api/student/tile-feedback?unitId=X&pageId=Y
 *
 * TFL.2 Pass B sub-phase B.2. Returns the multi-turn feedback threads
 * for the requesting student × unit × page, grouped by tile_id. Drops
 * into the `<TeacherFeedback turns={threads[tileId] ?? []} />`
 * component without massaging.
 *
 * Read-receipt: bumps `student_seen_comment_at` via the existing
 * TFL.1 RPC (`bump_student_seen_comment_at`) — same mechanism the
 * legacy `/api/student/tile-comments` route uses. Single source of
 * truth on the receipt timestamp; the chip dot ladder on the marking
 * page keeps working unchanged.
 *
 * Auth: requireStudentSession (custom student session token, not
 * Supabase Auth). The admin client is gated by the session check.
 */

// audit-skip: routine read endpoint, no audit value beyond TFL.1 receipt

import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadTileFeedbackThreads,
  type TileFeedbackResult,
} from "@/lib/grading/tile-feedback-loader";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { extractTilesFromPage } from "@/lib/grading/lesson-tiles";
import { getPageList } from "@/lib/unit-adapter";
import type { UnitContentData } from "@/types";

export async function GET(request: NextRequest) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) {
    return session;
  }

  const url = request.nextUrl.searchParams;
  const unitId = url.get("unitId");
  const pageId = url.get("pageId");
  if (!unitId || !pageId) {
    return NextResponse.json(
      { error: "unitId and pageId required" },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  // TFL.1 read-receipt bump BEFORE the SELECT, mirroring the legacy
  // /api/student/tile-comments route. Routes the bump through the
  // SECURITY DEFINER RPC so `student_seen_comment_at` and the
  // BEFORE-UPDATE trigger's `updated_at` derive from the same
  // Postgres `now()` (Lesson #66; fix lives in migration
  // 20260509222601_add_bump_student_seen_comment_at_rpc.sql).
  await db.rpc("bump_student_seen_comment_at", {
    p_student_id: session.studentId,
    p_unit_id: unitId,
    p_page_id: pageId,
  });

  // Compute the set of tile_ids that ACTUALLY exist on the rendered
  // page right now, so the loader can drop orphan grades for tiles
  // a teacher has since deleted from the page. Matt smoke 14 May
  // 2026: student banner read "feedback on 3 tiles" on a lesson
  // that no longer had any tiles (he'd deleted them after the
  // grades were written).
  //
  // Resolution path mirrors /api/student/unit:
  //   1. student → active class_students rows
  //   2. find class_units row matching (active_class, unitId)
  //   3. resolveClassUnitContent(master, override) → resolved unit
  //   4. getPageList → find page by id → extractTilesFromPage
  //
  // On any failure we fall through to validTileIds=null which
  // disables the filter (matches legacy behaviour — better to show
  // a slightly-stale banner than crash the lesson load).
  let validTileIds: Set<string> | null = null;
  try {
    const { data: enrollments } = await db
      .from("class_students")
      .select("class_id")
      .eq("student_id", session.studentId)
      .eq("is_active", true);
    const activeClassIds = (enrollments ?? []).map((e) => e.class_id);
    if (activeClassIds.length > 0) {
      const { data: cuRows } = await db
        .from("class_units")
        .select("content_data, units(content_data)")
        .in("class_id", activeClassIds)
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .limit(1);
      const cu = cuRows && cuRows[0];
      if (cu) {
        type ClassUnitRow = {
          content_data: UnitContentData | null;
          units:
            | { content_data: UnitContentData | null }
            | { content_data: UnitContentData | null }[]
            | null;
        };
        const cuTyped = cu as ClassUnitRow;
        const unitRow = Array.isArray(cuTyped.units)
          ? cuTyped.units[0]
          : cuTyped.units;
        const master =
          unitRow?.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
        const resolved = resolveClassUnitContent(master, cuTyped.content_data);
        const page = getPageList(resolved).find((p) => p.id === pageId);
        if (page) {
          const tiles = extractTilesFromPage(page, {});
          validTileIds = new Set(tiles.map((t) => t.tileId));
        }
      }
    }
  } catch {
    // Swallow — keep validTileIds null so the filter is a no-op.
    // Banner shows orphan-grade tiles as a worst case, same as before.
    validTileIds = null;
  }

  let result: TileFeedbackResult;
  try {
    result = await loadTileFeedbackThreads(
      db,
      session.studentId,
      unitId,
      pageId,
      validTileIds,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load tile feedback threads",
      },
      { status: 500 },
    );
  }

  // Return both: threads (the rendering payload) AND gradeIdByTileId
  // (the lookup table the reply POST endpoint needs to route to the
  // right grade row). Both populated from the same source query — no
  // chance of inconsistency between them.
  return NextResponse.json(result);
}
