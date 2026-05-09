// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import {
  getKnowledgeItemById,
  setItemCurricula,
} from "@/lib/knowledge-library";
import type { KnowledgeItemCurriculum } from "@/types/knowledge-library";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

/**
 * PUT /api/teacher/knowledge/items/[id]/curricula
 *
 * Replace all curriculum mappings for a knowledge item.
 * Body: { curricula: [{ framework, criteria, strand?, topic?, year_group?, textbook_ref? }] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id } = await params;

  // Verify ownership
  const item = await getKnowledgeItemById(id);
  if (!item || item.teacher_id !== teacherId) {
    return NextResponse.json(
      { error: "Item not found or not owned" },
      { status: 404 }
    );
  }

  const body: {
    curricula: Omit<KnowledgeItemCurriculum, "id" | "item_id">[];
  } = await request.json();

  if (!Array.isArray(body.curricula)) {
    return NextResponse.json(
      { error: "curricula must be an array" },
      { status: 400 }
    );
  }

  const success = await setItemCurricula(id, body.curricula);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to update curricula" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
