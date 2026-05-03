// audit-skip: routine teacher pedagogy ops, low audit value
/**
 * Single Activity Block API — Dimensions2 Phase 1A
 *
 * GET    — Retrieve a single block
 * PATCH  — Update block fields
 * DELETE — Archive (soft delete) a block
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = createAdminClient();

  const { data, error } = await db
    .from("activity_blocks")
    .select("*")
    .eq("id", id)
    .eq("teacher_id", auth.teacherId)
    .maybeSingle();

  if (error) {
    console.error("[activity-blocks API] Get error:", error);
    return NextResponse.json({ error: "Failed to get block" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allowed fields for update
  const ALLOWED_FIELDS = new Set([
    "title",
    "description",
    "prompt",
    "bloom_level",
    "time_weight",
    "grouping",
    "ai_rules",
    "udl_checkpoints",
    "success_look_fors",
    "design_phase",
    "lesson_structure_role",
    "response_type",
    "toolkit_tool_id",
    "criterion_tags",
    "materials_needed",
    "scaffolding",
    "example_response",
    "tags",
    "is_public",
    "is_archived",
  ]);

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (ALLOWED_FIELDS.has(key)) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await db
    .from("activity_blocks")
    .update(updates)
    .eq("id", id)
    .eq("teacher_id", auth.teacherId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[activity-blocks API] Update error:", error);
    return NextResponse.json({ error: "Failed to update block" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, updated: Object.keys(updates) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireTeacherAuth(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const db = createAdminClient();

  // Soft delete — archive the block
  const { data, error } = await db
    .from("activity_blocks")
    .update({ is_archived: true })
    .eq("id", id)
    .eq("teacher_id", auth.teacherId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[activity-blocks API] Archive error:", error);
    return NextResponse.json({ error: "Failed to archive block" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, archived: true });
}
