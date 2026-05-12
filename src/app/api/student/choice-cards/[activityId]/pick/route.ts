// Choice Cards block — student pick endpoint.
//
// POST /api/student/choice-cards/[activityId]/pick
// Body: { cardId: string, unitId?: string, classId?: string }
//
// Looks up the card, writes (or updates) the student's selection for
// this block instance, returns { cardId, label, action_resolved }.
//
// Service-role write + studentId from token session (Lesson #4). Phase 8
// will wrap this with the action dispatcher (learning_events emission).
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";
import { resolveStudentClassId } from "@/lib/student-support/resolve-class-id";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { activityId } = await params;
  if (!activityId || typeof activityId !== "string") {
    return NextResponse.json({ error: "activityId required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "body must be an object" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  if (typeof b.cardId !== "string" || b.cardId.length === 0) {
    return NextResponse.json({ error: "cardId required (string)" }, { status: 400 });
  }
  const cardId = b.cardId;

  const unitId =
    typeof b.unitId === "string" && UUID_RE.test(b.unitId) ? b.unitId : undefined;

  const db = createAdminClient();

  // Special-case the "pitch your own" sentinel — no card lookup needed.
  let label: string;
  let action_resolved: unknown;
  if (cardId === "_pitch-your-own") {
    label = "Pitch your own idea";
    action_resolved = { type: "pitch-to-teacher" };
  } else {
    const { data: card, error: cardErr } = await db
      .from("choice_cards")
      .select("id, label, on_pick_action")
      .eq("id", cardId)
      .maybeSingle();
    if (cardErr) {
      return NextResponse.json({ error: cardErr.message }, { status: 500 });
    }
    if (!card) {
      return NextResponse.json({ error: `Unknown cardId: ${cardId}` }, { status: 404 });
    }
    label = card.label;
    action_resolved = card.on_pick_action;
  }

  const classIdInput =
    typeof b.classId === "string" && UUID_RE.test(b.classId) ? b.classId : undefined;
  const classId = await resolveStudentClassId({
    studentId,
    classId: classIdInput,
    unitId,
  });

  // Upsert on (student_id, activity_id) — one pick per block instance.
  const row = {
    student_id: studentId,
    activity_id: activityId,
    unit_id: unitId ?? null,
    class_id: classId ?? null,
    card_id: cardId,
    action_resolved,
    picked_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("choice_card_selections")
    .upsert(row, { onConflict: "student_id,activity_id" })
    .select("id, card_id, action_resolved")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to write selection" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    selectionId: data.id,
    cardId: data.card_id,
    label,
    action_resolved: data.action_resolved,
  });
}
