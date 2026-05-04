// audit-skip: routine teacher pedagogy ops, low audit value
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { linkItemToPage, unlinkItem } from "@/lib/knowledge-library";
import type { LinkType, DisplayMode } from "@/types/knowledge-library";

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
 * POST /api/teacher/knowledge/items/[id]/link
 *
 * Link a knowledge item to a unit page.
 * Body: { unitId, pageId, linkType?, displayMode?, sortOrder? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: {
    unitId: string;
    pageId: string;
    linkType?: LinkType;
    displayMode?: DisplayMode;
    sortOrder?: number;
  } = await request.json();

  if (!body.unitId || !body.pageId) {
    return NextResponse.json(
      { error: "unitId and pageId are required" },
      { status: 400 }
    );
  }

  const link = await linkItemToPage({
    itemId: id,
    unitId: body.unitId,
    pageId: body.pageId,
    linkType: body.linkType,
    displayMode: body.displayMode,
    sortOrder: body.sortOrder,
    teacherId,
  });

  if (!link) {
    return NextResponse.json(
      { error: "Failed to create link" },
      { status: 500 }
    );
  }

  return NextResponse.json({ link }, { status: 201 });
}

/**
 * DELETE /api/teacher/knowledge/items/[id]/link
 *
 * Unlink a knowledge item from a unit page.
 * Body: { unitId, pageId }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body: { unitId: string; pageId: string } = await request.json();

  if (!body.unitId || !body.pageId) {
    return NextResponse.json(
      { error: "unitId and pageId are required" },
      { status: 400 }
    );
  }

  const success = await unlinkItem(id, body.unitId, body.pageId, teacherId);

  if (!success) {
    return NextResponse.json(
      { error: "Link not found or not owned" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
