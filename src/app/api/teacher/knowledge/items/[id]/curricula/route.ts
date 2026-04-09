import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getKnowledgeItemById,
  setItemCurricula,
} from "@/lib/knowledge-library";
import type { KnowledgeItemCurriculum } from "@/types/knowledge-library";

// Un-quarantined (9 Apr 2026) — Knowledge pipeline restored.

async function getTeacherId(request: NextRequest): Promise<string | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id || null;
}

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
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
