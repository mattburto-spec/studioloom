// audit-skip: routine teacher pedagogy ops, low audit value
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
import {
  validateSlotFields,
  LEVER_1_DEPRECATED_HEADER,
  LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY,
} from "@/lib/lever-1/validate-slot-fields";
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

  // Validate required fields. Lever 1: title + EITHER (prompt) OR (any
  // of the three slot fields) is required. Pure three-field writes
  // skip prompt entirely; mixed writes are accepted; legacy prompt-only
  // writes still work but trigger the deprecation header.
  const hasAnySlot = Boolean(body.framing || body.task || body.success_signal);
  if (!body.title || (!body.prompt && !hasAnySlot)) {
    return NextResponse.json(
      { error: "title and (prompt OR at least one of framing/task/success_signal) are required" },
      { status: 400 }
    );
  }

  // Lever 1 sub-phase 1D — per-field length validation
  const v = validateSlotFields(
    { framing: body.framing, task: body.task, success_signal: body.success_signal },
    body.prompt
  );
  if (!v.ok) {
    return NextResponse.json(
      { error: "Slot field validation failed", details: v.errors },
      { status: 400 }
    );
  }

  // Manual creation defaults
  const params: CreateActivityBlockParams = {
    ...body,
    // For pure-slot writes (no prompt), synthesise a fallback prompt so
    // the renderer's all-three-null fallback path doesn't fire. Compose
    // from the three slots in render order. The DB column is NOT NULL.
    prompt:
      body.prompt ||
      [body.framing, body.task, body.success_signal]
        .filter((s) => s && s.trim())
        .join("\n\n"),
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

    const response = NextResponse.json(
      { id: blockId, warnings: v.warnings.length > 0 ? v.warnings : undefined },
      { status: 201 }
    );
    if (v.legacyPromptOnly) {
      response.headers.set(
        LEVER_1_DEPRECATED_HEADER,
        LEVER_1_DEPRECATED_VALUE_PROMPT_ONLY
      );
    }
    return response;
  } catch (err) {
    console.error("[activity-blocks API] Create error:", err);
    return NextResponse.json(
      { error: "Failed to create activity block" },
      { status: 500 }
    );
  }
}
