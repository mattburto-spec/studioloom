import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import {
  getKnowledgeItems,
  searchKnowledgeItems,
  createKnowledgeItem,
  generateItemChunks,
} from "@/lib/knowledge-library";
import type {
  CreateKnowledgeItemRequest,
  KnowledgeItemType,
} from "@/types/knowledge-library";

/**
 * GET /api/teacher/knowledge/items
 *
 * List or search knowledge items for the authenticated teacher.
 * Query params: search, type, tags (comma-separated), framework, archived
 */
export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const type = searchParams.get("type");
  const tagsStr = searchParams.get("tags");
  const framework = searchParams.get("framework");
  const archived = searchParams.get("archived");

  const filters = {
    item_type: (type || undefined) as KnowledgeItemType | undefined,
    tags: tagsStr ? tagsStr.split(",").map((t) => t.trim()) : undefined,
    framework: framework || undefined,
    is_archived: archived === "true" ? true : undefined,
  };

  // Use semantic search if query provided, otherwise list with filters
  const items = search
    ? await searchKnowledgeItems(search, teacherId, filters)
    : await getKnowledgeItems(teacherId, filters);

  return NextResponse.json({ items });
}

/**
 * POST /api/teacher/knowledge/items
 *
 * Create a new knowledge item. Generates RAG chunks in the background.
 */
export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;
  const teacherId = auth.teacherId;

  const body: CreateKnowledgeItemRequest = await request.json();

  if (!body.title || !body.item_type) {
    return NextResponse.json(
      { error: "title and item_type are required" },
      { status: 400 }
    );
  }

  const item = await createKnowledgeItem(body, teacherId);

  if (!item) {
    return NextResponse.json(
      { error: "Failed to create item" },
      { status: 500 }
    );
  }

  // Fire-and-forget: generate RAG chunks
  generateItemChunks(item).catch((err) => {
    console.error("[knowledge-items] Chunk generation failed:", err);
  });

  return NextResponse.json({ item }, { status: 201 });
}
