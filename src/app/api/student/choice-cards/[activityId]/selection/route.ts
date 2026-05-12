// Choice Cards block — student current-selection endpoint (hydration on reload).
//
// GET /api/student/choice-cards/[activityId]/selection
// Returns: { selection: { cardId, label, action_resolved } | null }
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentSession } from "@/lib/access-v2/actor-session";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const session = await requireStudentSession(request);
  if (session instanceof NextResponse) return session;
  const studentId = session.studentId;

  const { activityId } = await params;
  if (!activityId) {
    return NextResponse.json({ error: "activityId required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("choice_card_selections")
    .select("card_id, action_resolved, picked_at")
    .eq("student_id", studentId)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ selection: null });
  }

  // Resolve label for the front-end. Special-case the pitch sentinel.
  let label = "Pitch your own idea";
  if (data.card_id !== "_pitch-your-own") {
    const { data: card } = await db
      .from("choice_cards")
      .select("label")
      .eq("id", data.card_id)
      .maybeSingle();
    label = card?.label ?? data.card_id;
  }

  return NextResponse.json({
    selection: {
      cardId: data.card_id,
      label,
      action_resolved: data.action_resolved,
      picked_at: data.picked_at,
    },
  });
}
