// Student archetype resolver — single source of truth for "what
// archetype is this student designing under for this unit?"
//
// Fallback chain (most-committed → least-committed):
//
//   1. project_specs.archetype_id
//      — placeholder for a future unified Project Spec table that
//        doesn't exist yet. Try/catch falls through silently when the
//        table is missing. When that table ships, this branch becomes
//        the strongest signal (a student who has committed to an
//        archetype via the Project Spec block).
//
//   2. student_unit_product_briefs.archetype_id
//      — Project Spec v2 (shipped). Set when the student engaged the
//        Product Brief block and either confirmed a suggested archetype
//        or picked one explicitly. "Committed" source.
//
//   3. choice_card_selections.action_resolved.payload.archetypeId
//      — Choice Cards source (shipped). Set when the student picked a
//        card whose on_pick_action is `set-archetype`. "Intended"
//        source — student picked the brief but hasn't yet engaged the
//        spec walker.
//
// Returns null when no archetype is set anywhere. Callers — typically
// `getArchetypeAwareContent(block, archetypeId)` — must always handle
// null gracefully (fall through to the base block content).

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getStudentArchetype(
  studentId: string,
  unitId: string,
  db?: SupabaseClient,
): Promise<string | null> {
  const supa = db ?? createAdminClient();

  // Step 1 — project_specs (placeholder, graceful fall-through).
  try {
    const { data: spec, error: specErr } = await supa
      .from("project_specs")
      .select("archetype_id")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();
    if (!specErr && spec?.archetype_id) {
      return spec.archetype_id as string;
    }
  } catch {
    // Table doesn't exist yet — silent skip.
  }

  // Step 2 — student_unit_product_briefs (shipped v2).
  try {
    const { data: brief } = await supa
      .from("student_unit_product_briefs")
      .select("archetype_id")
      .eq("student_id", studentId)
      .eq("unit_id", unitId)
      .maybeSingle();
    if (brief?.archetype_id) {
      return brief.archetype_id as string;
    }
  } catch {
    // Defensive — the table exists in shipped code, but stay resilient.
  }

  // Step 3 — choice_card_selections (shipped Choice Cards).
  // Newest pick wins if a unit has multiple Choice Cards blocks.
  const { data: pick } = await supa
    .from("choice_card_selections")
    .select("action_resolved, picked_at")
    .eq("student_id", studentId)
    .eq("unit_id", unitId)
    .order("picked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const resolved = pick?.action_resolved as
    | { type?: unknown; payload?: { archetypeId?: unknown } }
    | null;
  if (
    resolved &&
    resolved.type === "set-archetype" &&
    resolved.payload &&
    typeof resolved.payload.archetypeId === "string"
  ) {
    return resolved.payload.archetypeId;
  }

  return null;
}
