import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import { AGENCY_ELEMENT_MAP } from "@/lib/nm/constants";
import type { NMUnitConfig } from "@/lib/nm/constants";

/**
 * Student NM Checkpoint API
 *
 * GET /api/student/nm-checkpoint/[pageId]?unitId={unitId}
 *   → Returns the NM checkpoint config for a page:
 *     - Which elements to assess at this checkpoint
 *     - Student-facing descriptions per element
 *   Returns { checkpoint: { elements: [...] } | null }
 *
 * Note: Pages are stored as JSONB inside units.content_data,
 * not in a separate table. So unitId is required as a query param.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await params;
  const unitId = request.nextUrl.searchParams.get("unitId");

  if (!unitId) {
    return NextResponse.json({ checkpoint: null });
  }

  const session = await getStudentSession(request);
  if (!session) {
    // For unauthenticated users (public toolkit), just return null
    return NextResponse.json({ checkpoint: null });
  }
  const studentId = session.studentId;

  const supabase = createAdminClient();

  // Get student's class IDs — try junction table first, then legacy class_id
  const { data: junctionRows } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  const classIds: string[] = (junctionRows || []).map((r: { class_id: string }) => r.class_id);

  // Legacy fallback: students.class_id
  if (classIds.length === 0) {
    const { data: student } = await supabase
      .from("students")
      .select("class_id")
      .eq("id", studentId)
      .single();
    if (student?.class_id) classIds.push(student.class_id);
  }

  // Get NM config: class-specific (class_units) with fallback to unit-level (units)
  let nmConfig: NMUnitConfig | null = null;

  if (classIds.length > 0) {
    // Check all enrolled classes for this unit's NM config
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("nm_config")
      .in("class_id", classIds)
      .eq("unit_id", unitId);

    // Use the first class-unit with NM config
    const cuWithNm = (classUnits || []).find((cu: { nm_config: NMUnitConfig | null }) => cu.nm_config);
    if (cuWithNm?.nm_config) {
      nmConfig = cuWithNm.nm_config as NMUnitConfig;
    }
  }

  if (!nmConfig) {
    // Fallback to unit-level config
    const { data: unit } = await supabase
      .from("units")
      .select("nm_config")
      .eq("id", unitId)
      .single();
    nmConfig = (unit?.nm_config as NMUnitConfig) || null;
  }

  if (!nmConfig) {
    return NextResponse.json({ checkpoint: null });
  }

  if (!nmConfig.enabled) {
    return NextResponse.json({ checkpoint: null });
  }

  // Note: The per-class NM config with enabled=true is sufficient intent.
  // The global use_new_metrics toggle in teacher settings is checked for
  // dashboard display but NOT required here — if a teacher configured NM
  // checkpoints on a class-unit, that's explicit enough.

  const checkpoint = nmConfig.checkpoints?.[pageId];
  if (!checkpoint) {
    return NextResponse.json({ checkpoint: null });
  }

  // Resolve element IDs to full element data with student-facing descriptions
  const elements = checkpoint.elements
    .map((elemId: string) => {
      const elem = AGENCY_ELEMENT_MAP[elemId];
      if (!elem) return null;
      return {
        id: elem.id,
        name: elem.name,
        studentDescription: elem.studentDescription,
      };
    })
    .filter(Boolean);

  if (elements.length === 0) {
    return NextResponse.json({ checkpoint: null });
  }

  return NextResponse.json({
    checkpoint: { elements },
  });
}
