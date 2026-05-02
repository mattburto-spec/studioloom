/**
 * Governance engine rollout-flag accessor.
 *
 * Phase 4.0 scaffold per docs/projects/access-model-v2-phase-4-brief.md
 * §3.8 Q4. Mirrors the Phase 3 `isPermissionHelperRolloutEnabled`
 * pattern (src/lib/access-v2/can.ts:403). Default-on semantics: an
 * absent admin_settings row means the engine is active, so a fresh
 * env that hasn't run the migration yet doesn't accidentally disable
 * governance.
 *
 * Removed in Phase 6 cutover.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const FLAG_KEY = "school.governance_engine_rollout";

export async function isGovernanceEngineRolloutEnabled(
  supabase?: SupabaseClient
): Promise<boolean> {
  const db = supabase ?? (await createServerSupabaseClient());
  const { data } = await db
    .from("admin_settings")
    .select("value")
    .eq("key", FLAG_KEY)
    .maybeSingle();
  if (!data) return true; // absent row = on
  return data.value === true;
}
