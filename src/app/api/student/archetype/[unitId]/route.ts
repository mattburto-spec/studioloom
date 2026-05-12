// Student archetype lookup — canonical client-facing read endpoint.
//
// GET /api/student/archetype/[unitId]
// Returns: { archetypeId: string | null }
//
// Delegates to getStudentArchetype() — the 3-step fallback chain
// (project_specs → student_unit_product_briefs → choice_card_selections).
// Cache-Control private + 60s so the same lesson page render doesn't
// re-fetch on every block remount.
//
// Used by all archetype-aware blocks (Inspiration Board v1 first).
// Never query the underlying tables directly from the client — always
// go through this route so the fallback semantics stay consistent.
import { NextRequest, NextResponse } from "next/server";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { getStudentArchetype } from "@/lib/students/archetype-resolver";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ unitId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { unitId } = await params;
  if (!unitId) {
    return NextResponse.json({ error: "unitId required" }, { status: 400 });
  }

  const archetypeId = await getStudentArchetype(studentId, unitId);

  return NextResponse.json(
    { archetypeId },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
