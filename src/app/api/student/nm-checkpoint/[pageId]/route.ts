import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentId } from "@/lib/auth/student";
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

  const studentId = await getStudentId(request);
  if (!studentId) {
    // For unauthenticated users (public toolkit), just return null
    return NextResponse.json({ checkpoint: null });
  }

  const supabase = createAdminClient();

  // Get student's class_id for per-class NM config lookup
  const { data: student } = await supabase
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .single();

  // Get NM config: class-specific (class_units) with fallback to unit-level (units)
  let nmConfig: NMUnitConfig | null = null;

  if (student?.class_id) {
    const { data: classUnit } = await supabase
      .from("class_units")
      .select("nm_config")
      .eq("class_id", student.class_id)
      .eq("unit_id", unitId)
      .single();

    if (classUnit?.nm_config) {
      nmConfig = classUnit.nm_config as NMUnitConfig;
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
