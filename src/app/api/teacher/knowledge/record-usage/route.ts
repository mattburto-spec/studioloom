// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { recordGenerationUsage } from "@/lib/knowledge/feedback";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

/**
 * POST /api/teacher/knowledge/record-usage
 * Record that specific RAG chunks were used in a generation.
 * Called fire-and-forget when a teacher saves a generated unit.
 *
 * Body: { chunkIds: string[] }
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { chunkIds } = body as { chunkIds: string[] };

  if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
    return NextResponse.json({ ok: true }); // Nothing to record
  }

  try {
    await recordGenerationUsage(chunkIds);
    return NextResponse.json({ ok: true });
  } catch {
    // Non-critical — usage tracking should never fail the save
    return NextResponse.json({ ok: true });
  }
}
