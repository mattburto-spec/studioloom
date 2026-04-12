/**
 * Activity Block Review API
 *
 * GET: List pending blocks for teacher review
 * POST: Approve/reject/edit blocks from the review queue
 * PATCH: Bulk approve blocks
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";

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
 * GET: Fetch pending blocks for teacher review.
 * Query params: ?status=pending (default) | approved | rejected
 */
export async function GET(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";

  const adminClient = createAdminClient();

  try {
    let query = adminClient
      .from("activity_blocks")
      .select(
        "id, title, description, prompt, bloom_level, time_weight, grouping, phase, activity_category, materials_needed, pii_scanned, pii_flags, copyright_flag, teacher_verified, source_upload_id, created_at, moderation_status"
      )
      .eq("teacher_id", teacherId)
      .eq("source_type", "extracted")
      .order("created_at", { ascending: false });

    if (status === "pending") {
      query = query.eq("teacher_verified", false).eq("is_archived", false);
    } else if (status === "approved") {
      query = query.eq("teacher_verified", true).eq("is_archived", false);
    } else if (status === "rejected") {
      query = query.eq("is_archived", true);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[review] Query error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ blocks: data || [] }, {
      headers: { "Cache-Control": "private, max-age=10" },
    });
  } catch (e) {
    console.error("[review] Error:", e);
    return NextResponse.json({ error: "Failed to fetch blocks" }, { status: 500 });
  }
}

/**
 * POST: Approve, reject, or edit a single block.
 * Body: { blockId, action: 'approve' | 'reject' | 'edit', edits?: Partial<Block> }
 */
export async function POST(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { blockId?: string; action?: string; edits?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { blockId, action, edits } = body;

  if (!blockId || !action) {
    return NextResponse.json(
      { error: "blockId and action are required" },
      { status: 400 }
    );
  }

  if (!["approve", "reject", "edit"].includes(action)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', or 'edit'" },
      { status: 400 }
    );
  }

  const adminClient = createAdminClient();

  try {
    // Verify ownership
    const { data: existing } = await adminClient
      .from("activity_blocks")
      .select("id, teacher_id")
      .eq("id", blockId)
      .single();

    if (!existing || existing.teacher_id !== teacherId) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown>;

    switch (action) {
      case "approve":
        updateData = { teacher_verified: true, is_archived: false };
        break;
      case "reject":
        updateData = { is_archived: true, teacher_verified: false };
        break;
      case "edit":
        // Allow editing specific safe fields before approving
        updateData = {
          ...(edits && "title" in edits && edits.title ? { title: edits.title } : {}),
          ...(edits && "description" in edits && edits.description ? { description: edits.description } : {}),
          ...(edits && "prompt" in edits && edits.prompt ? { prompt: edits.prompt } : {}),
          ...(edits && "bloom_level" in edits && edits.bloom_level ? { bloom_level: edits.bloom_level } : {}),
          ...(edits && "time_weight" in edits && edits.time_weight ? { time_weight: edits.time_weight } : {}),
          ...(edits && "grouping" in edits && edits.grouping ? { grouping: edits.grouping } : {}),
          ...(edits && "phase" in edits && edits.phase ? { phase: edits.phase } : {}),
          ...(edits && "activity_category" in edits && edits.activity_category ? { activity_category: edits.activity_category } : {}),
          teacher_verified: true,
          is_archived: false,
        };
        break;
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { error } = await adminClient
      .from("activity_blocks")
      .update(updateData)
      .eq("id", blockId);

    if (error) {
      console.error("[review] Update error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, action, blockId });
  } catch (e) {
    console.error("[review] Error:", e);
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
  }
}

/**
 * PATCH: Bulk approve blocks.
 * Body: { blockIds: string[] }
 */
export async function PATCH(request: NextRequest) {
  const teacherId = await getTeacherId(request);
  if (!teacherId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { blockIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { blockIds } = body;

  if (!blockIds || !Array.isArray(blockIds) || blockIds.length === 0) {
    return NextResponse.json({ error: "blockIds array is required" }, { status: 400 });
  }

  if (blockIds.length > 100) {
    return NextResponse.json({ error: "Max 100 blocks per batch" }, { status: 400 });
  }

  const adminClient = createAdminClient();

  try {
    const { error } = await adminClient
      .from("activity_blocks")
      .update({ teacher_verified: true, is_archived: false })
      .eq("teacher_id", teacherId)
      .in("id", blockIds);

    if (error) {
      console.error("[review] Bulk approve error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, approved: blockIds.length });
  } catch (e) {
    console.error("[review] Error:", e);
    return NextResponse.json({ error: "Failed to bulk approve" }, { status: 500 });
  }
}
