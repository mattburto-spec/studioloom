/**
 * GET /api/student/skills/cards/[slug]
 *
 * Student-facing read of a single published skill card. Logs a
 * `skill.viewed` event into `learning_events` on the student's behalf —
 * the view page mounts this as the first fetch, so the event represents
 * "student opened the card at this timestamp".
 *
 * De-dupes views within a 5-minute window so rapid remounts / tab
 * switches don't flood the log. Older views still count toward state
 * transitions (viewed → higher ranks) because the state view takes MAX
 * rank, not latest.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import type { SkillCardHydrated, SkillCardRow } from "@/types/skills";

const VIEW_DEDUPE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const auth = await requireStudentAuth(request);
    if (auth.error) return auth.error;
    const studentId = auth.studentId;

    const admin = createAdminClient();

    // Load card by slug — must be published (students never see drafts).
    const { data: cardRow, error: cardErr } = await admin
      .from("skill_cards")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (cardErr) {
      console.error("[student/skills/cards/[slug]:GET] Card error:", cardErr);
      return NextResponse.json(
        { error: "Failed to load card" },
        { status: 500 }
      );
    }
    if (!cardRow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const card = cardRow as SkillCardRow;

    // Hydrate: tags, external links, prereqs (titles only).
    const [{ data: tagRows }, { data: linkRows }, { data: prereqRows }] =
      await Promise.all([
        admin.from("skill_card_tags").select("tag").eq("skill_id", card.id),
        admin
          .from("skill_external_links")
          .select("*")
          .eq("skill_id", card.id)
          .order("display_order", { ascending: true }),
        admin
          .from("skill_prerequisites")
          .select("prerequisite_id")
          .eq("skill_id", card.id),
      ]);

    const prereqIds = (prereqRows ?? []).map(
      (r: { prerequisite_id: string }) => r.prerequisite_id
    );
    let prereqs: SkillCardHydrated["prerequisites"] = [];
    if (prereqIds.length > 0) {
      const { data: prereqCards } = await admin
        .from("skill_cards")
        .select("id, slug, title, difficulty")
        .in("id", prereqIds)
        .eq("is_published", true);
      prereqs = (prereqCards ?? []) as SkillCardHydrated["prerequisites"];
    }

    const hydrated: SkillCardHydrated = {
      ...card,
      tags: (tagRows ?? []).map((r: { tag: string }) => r.tag),
      external_links:
        (linkRows ?? []) as SkillCardHydrated["external_links"],
      prerequisites: prereqs,
    };

    // Log skill.viewed (with 5-min dedupe).
    const cutoff = new Date(Date.now() - VIEW_DEDUPE_WINDOW_MS).toISOString();
    const { data: recent } = await admin
      .from("learning_events")
      .select("id")
      .eq("student_id", studentId)
      .eq("subject_type", "skill_card")
      .eq("subject_id", card.id)
      .eq("event_type", "skill.viewed")
      .gte("created_at", cutoff)
      .limit(1)
      .maybeSingle();

    if (!recent) {
      const { error: insertErr } = await admin.from("learning_events").insert({
        student_id: studentId,
        event_type: "skill.viewed",
        subject_type: "skill_card",
        subject_id: card.id,
        payload: { slug: card.slug },
      });
      if (insertErr) {
        // Log but don't fail the read — viewing the card is the user-visible action.
        console.error(
          "[student/skills/cards/[slug]:GET] skill.viewed insert error:",
          insertErr
        );
      }
    }

    // Fetch student's current state on this card from the derived view.
    const { data: stateRow } = await admin
      .from("student_skill_state")
      .select("state, freshness, last_passed_at")
      .eq("student_id", studentId)
      .eq("skill_id", card.id)
      .maybeSingle();

    return NextResponse.json({
      card: hydrated,
      state: stateRow ?? {
        state: "untouched",
        freshness: null,
        last_passed_at: null,
      },
    });
  } catch (error) {
    console.error("[student/skills/cards/[slug]:GET] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
