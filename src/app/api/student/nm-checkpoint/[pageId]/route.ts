import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";
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

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    // For unauthenticated users (public toolkit), just return null
    return NextResponse.json({ checkpoint: null });
  }

  const supabase = createAdminClient();

  // Validate session
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json({ checkpoint: null });
  }

  // Get the unit's nm_config
  const { data: unit } = await supabase
    .from("units")
    .select("nm_config")
    .eq("id", unitId)
    .single();

  if (!unit?.nm_config) {
    return NextResponse.json({ checkpoint: null });
  }

  const nmConfig = unit.nm_config as NMUnitConfig;

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
