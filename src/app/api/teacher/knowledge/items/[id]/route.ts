// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import {
  getKnowledgeItemById,
  updateKnowledgeItem,
  deleteKnowledgeItem,
  generateItemChunks,
} from "@/lib/knowledge-library";
import type { UpdateKnowledgeItemRequest } from "@/types/knowledge-library";
import { requireTeacher } from "@/lib/auth/require-teacher";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

/**
 * GET /api/teacher/knowledge/items/[id]
 *
 * Fetch a single knowledge item with its curriculum mappings.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id } = await params;
  const item = await getKnowledgeItemById(id);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Only allow owner or public items
  if (item.teacher_id !== teacherId && !item.is_public) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ item });
}

/**
 * PUT /api/teacher/knowledge/items/[id]
 *
 * Update a knowledge item. Re-generates RAG chunks if content changed.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id } = await params;
  const body: UpdateKnowledgeItemRequest = await request.json();

  const item = await updateKnowledgeItem(id, body, teacherId);

  if (!item) {
    return NextResponse.json(
      { error: "Item not found or not owned" },
      { status: 404 }
    );
  }

  // Re-generate chunks if content changed
  if (body.content !== undefined) {
    generateItemChunks(item).catch((err) => {
      console.error("[knowledge-items] Chunk re-generation failed:", err);
    });
  }

  return NextResponse.json({ item });
}

/**
 * DELETE /api/teacher/knowledge/items/[id]
 *
 * Delete a knowledge item and its associated chunks.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacher(request);
  if (auth.error) return auth.error;
  const { teacherId } = auth;

  const { id } = await params;
  const success = await deleteKnowledgeItem(id, teacherId);

  if (!success) {
    return NextResponse.json(
      { error: "Item not found or not owned" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
