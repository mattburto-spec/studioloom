/**
 * Teacher skill-card refs API — the "Used in" surface.
 *
 *   GET    /api/teacher/skills/cards/[id]/refs  → list refs for this card
 *   POST   /api/teacher/skills/cards/[id]/refs  → body {subject_type,subject_id,subject_label?,gate_level?}
 *   DELETE /api/teacher/skills/cards/[id]/refs?ref_id=<uuid>  → remove a ref
 *
 * Item #7 from the world-class sequence. Refs pin a skill card to a
 * "subject" (unit_page, activity_block, etc.) so the card surfaces at
 * the moment of need on the student side.
 *
 * For v1, subject_type='unit_page' is the primary surface. Other types
 * are accepted by the schema for forward-compat but not authored yet.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTeacherAuth } from "@/lib/auth/verify-teacher-unit";

const VALID_SUBJECT_TYPES = new Set([
  "unit_page",
  "activity_block",
  "unit",
  "class_gallery_pin",
  "safety_badge",
]);
const VALID_GATE_LEVELS = new Set([
  "suggested",
  "viewed",
  "quiz_passed",
  "demonstrated",
]);

// ============================================================================
// GET — list refs for this card
// ============================================================================
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    const admin = createAdminClient();

    const { data: card } = await admin
      .from("skill_cards")
      .select("id")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const { data, error } = await admin
      .from("skill_card_refs")
      .select(
        "id, subject_type, subject_id, subject_label, gate_level, display_order, created_at, created_by_teacher_id"
      )
      .eq("skill_card_id", cardId)
      .order("subject_type", { ascending: true })
      .order("display_order", { ascending: true });
    if (error) {
      console.error("[skills/cards/refs:GET] error:", error);
      return NextResponse.json(
        { error: "Failed to load refs" },
        { status: 500 }
      );
    }

    return NextResponse.json({ refs: data ?? [] });
  } catch (error) {
    console.error("[skills/cards/refs:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — create a ref
// ============================================================================
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;
    const teacherId = auth.teacherId;

    const body = (await request.json()) as {
      subject_type?: string;
      subject_id?: string;
      subject_label?: string;
      gate_level?: string;
      display_order?: number;
    };
    if (!body.subject_type || !VALID_SUBJECT_TYPES.has(body.subject_type)) {
      return NextResponse.json(
        {
          error: `subject_type must be one of ${[...VALID_SUBJECT_TYPES].join("|")}`,
        },
        { status: 400 }
      );
    }
    if (!body.subject_id || typeof body.subject_id !== "string") {
      return NextResponse.json(
        { error: "subject_id required" },
        { status: 400 }
      );
    }
    const gateLevel = body.gate_level ?? "suggested";
    if (!VALID_GATE_LEVELS.has(gateLevel)) {
      return NextResponse.json(
        { error: "Invalid gate_level" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data: card } = await admin
      .from("skill_cards")
      .select("id")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    // Insert — ON CONFLICT makes it idempotent so a second click returns
    // the existing row rather than erroring.
    const { data: existing } = await admin
      .from("skill_card_refs")
      .select("*")
      .eq("skill_card_id", cardId)
      .eq("subject_type", body.subject_type)
      .eq("subject_id", body.subject_id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ ref: existing, duplicate: true });
    }

    const { data: inserted, error: insertError } = await admin
      .from("skill_card_refs")
      .insert({
        skill_card_id: cardId,
        subject_type: body.subject_type,
        subject_id: body.subject_id,
        subject_label: body.subject_label?.toString().trim() || null,
        gate_level: gateLevel,
        display_order: body.display_order ?? 0,
        created_by_teacher_id: teacherId,
      })
      .select()
      .single();
    if (insertError || !inserted) {
      console.error("[skills/cards/refs:POST] Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to add ref" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ref: inserted });
  } catch (error) {
    console.error("[skills/cards/refs:POST] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — remove a ref by id
// ============================================================================
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: cardId } = await context.params;
    const auth = await requireTeacherAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const refId = url.searchParams.get("ref_id");
    if (!refId) {
      return NextResponse.json(
        { error: "ref_id query param required" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the ref belongs to this card (defense against mistargeted deletes)
    const { data: ref } = await admin
      .from("skill_card_refs")
      .select("id, skill_card_id")
      .eq("id", refId)
      .maybeSingle();
    if (!ref) {
      return NextResponse.json({ error: "Ref not found" }, { status: 404 });
    }
    if (ref.skill_card_id !== cardId) {
      return NextResponse.json(
        { error: "Ref does not belong to this card" },
        { status: 400 }
      );
    }

    const { error: deleteError } = await admin
      .from("skill_card_refs")
      .delete()
      .eq("id", refId);
    if (deleteError) {
      console.error("[skills/cards/refs:DELETE] Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove ref" },
        { status: 500 }
      );
    }

    return NextResponse.json({ removed_ref_id: refId });
  } catch (error) {
    console.error("[skills/cards/refs:DELETE] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
