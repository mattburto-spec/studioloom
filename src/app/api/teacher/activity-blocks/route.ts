/**
 * Activity Blocks CRUD API — Dimensions2 Phase 1A/1D
 *
 * GET  — List teacher's blocks (paginated, filterable)
 * POST — Create a block manually (Phase 1D)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  insertActivityBlock,
  listActivityBlocks,
} from "@/lib/activity-blocks";
import type { CreateActivityBlockParams } from "@/types";

export async function GET(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const sourceType = url.searchParams.get("source_type") || undefined;
  const archived = url.searchParams.get("archived") === "true";
  const status = url.searchParams.get("status") || undefined;

  try {
    const { blocks, count } = await listActivityBlocks(db, auth.teacherId, {
      limit: Math.min(limit, 100),
      offset,
      sourceType,
      isArchived: archived,
      verified: status === "verified" ? true : undefined,
    });

    return NextResponse.json({ blocks, count, limit, offset });
  } catch (err) {
    console.error("[activity-blocks API] List error:", err);
    return NextResponse.json(
      { error: "Failed to list activity blocks" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const db = createAdminClient();

  let body: CreateActivityBlockParams;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (!body.title || !body.prompt) {
    return NextResponse.json(
      { error: "title and prompt are required" },
      { status: 400 }
    );
  }

  // Manual creation defaults
  const params: CreateActivityBlockParams = {
    ...body,
    source_type: body.source_type || "manual",
  };

  try {
    const blockId = await insertActivityBlock(db, auth.teacherId, params);

    if (!blockId) {
      return NextResponse.json(
        { error: "Failed to create block" },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: blockId }, { status: 201 });
  } catch (err) {
    console.error("[activity-blocks API] Create error:", err);
    return NextResponse.json(
      { error: "Failed to create activity block" },
      { status: 500 }
    );
  }
}
