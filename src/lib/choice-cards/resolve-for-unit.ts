// Choice Cards — resolve the student's most recent pick for a unit.
//
// Used by Product Brief / User Profile / Success Criteria / Kanban
// seeding to lazy-discover a card pick the student made earlier in the
// unit. Lazy resolve (read at consumer mount time) avoids tight
// coupling: Choice Cards doesn't push to subscribers, consumers pull
// on demand.
//
// Returns null when no pick exists for (studentId, unitId).

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ResolvedChoiceCardPick {
  /** Card slug, e.g. 'g8-brief-designer-mentor'. */
  cardId: string;
  /** Card label, e.g. 'Design a Designer Mentor'. */
  label: string;
  /** Snapshot of the on_pick_action JSONB that fired at pick time. */
  action: unknown;
  /** Picked at timestamp (ISO). */
  pickedAt: string;
}

/**
 * Find the student's most recent Choice Cards selection for this unit.
 * Pitch-your-own picks are returned with `cardId = '_pitch-your-own'`
 * and a synthetic label — callers can filter them out if a real card
 * is required.
 */
export async function resolveChoiceCardPickForUnit(
  db: SupabaseClient,
  studentId: string,
  unitId: string,
): Promise<ResolvedChoiceCardPick | null> {
  // Newest pick wins if a unit has multiple Choice Cards blocks.
  const { data: selection, error: selErr } = await db
    .from("choice_card_selections")
    .select("card_id, action_resolved, picked_at")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .order("picked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr || !selection) return null;

  // Resolve the label. Special-case the pitch sentinel.
  let label = "Pitch your own idea";
  if (selection.card_id !== "_pitch-your-own") {
    const { data: card } = await db
      .from("choice_cards")
      .select("label")
      .eq("id", selection.card_id)
      .maybeSingle();
    label = card?.label ?? selection.card_id;
  }

  return {
    cardId: selection.card_id,
    label,
    action: selection.action_resolved,
    pickedAt: selection.picked_at,
  };
}

/**
 * Extract the archetypeId from a resolved pick if the action is a
 * set-archetype shape. Returns null otherwise.
 */
export function extractArchetypeId(pick: ResolvedChoiceCardPick | null): string | null {
  if (!pick || !pick.action || typeof pick.action !== "object") return null;
  const a = pick.action as { type?: unknown; payload?: unknown };
  if (a.type !== "set-archetype") return null;
  const p = a.payload as { archetypeId?: unknown } | undefined;
  if (!p || typeof p.archetypeId !== "string") return null;
  return p.archetypeId;
}

/**
 * Extract the seedKanban tasks from a resolved pick if the action is a
 * set-archetype shape with a seedKanban payload. Returns null otherwise.
 */
export interface SeedKanbanTask {
  title: string;
  listKey: string;
}
export function extractSeedKanban(pick: ResolvedChoiceCardPick | null): SeedKanbanTask[] | null {
  if (!pick || !pick.action || typeof pick.action !== "object") return null;
  const a = pick.action as { type?: unknown; payload?: unknown };
  if (a.type !== "set-archetype") return null;
  const p = a.payload as { seedKanban?: unknown } | undefined;
  if (!p || !Array.isArray(p.seedKanban)) return null;
  const tasks: SeedKanbanTask[] = [];
  for (const t of p.seedKanban) {
    if (
      t &&
      typeof t === "object" &&
      typeof (t as { title?: unknown }).title === "string" &&
      typeof (t as { listKey?: unknown }).listKey === "string"
    ) {
      tasks.push({
        title: (t as { title: string }).title,
        listKey: (t as { listKey: string }).listKey,
      });
    }
  }
  return tasks.length > 0 ? tasks : null;
}
