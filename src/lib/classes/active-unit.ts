import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atomically activates a target unit as the active unit for a class.
 * Deactivates any other class_units rows with is_active=true on the same
 * class in the same transaction, then activates the target (inserting the
 * row if it doesn't exist).
 *
 * Backed by Postgres function public.set_active_unit (migration
 * 20260515220845_set_active_unit_function). The function is SECURITY DEFINER
 * with search_path locked to public,pg_temp (Lesson #64) and authorizes
 * via is_teacher_of_class (Phase 1.4 CS-2 helper).
 *
 * Discriminated-union return mirrors the convention in src/lib/ai/call.ts —
 * callers branch on `ok` rather than catching thrown errors. The `code`
 * field carries the SQLSTATE so callers can render specific error toasts
 * (e.g. "42501" = permission denied, "23505" = constraint violation).
 */
export async function setActiveUnit(
  supabase: SupabaseClient,
  classId: string,
  unitId: string,
): Promise<
  | { ok: true }
  | { ok: false; error: string; code?: string }
> {
  const { error } = await supabase.rpc("set_active_unit", {
    class_uuid: classId,
    target_unit_uuid: unitId,
  });
  if (error) {
    return { ok: false, error: error.message, code: error.code };
  }
  return { ok: true };
}
