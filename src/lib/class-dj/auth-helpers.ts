/**
 * Class DJ — auth helpers (post-Phase 6 fix).
 *
 * Why this exists:
 *   The Class DJ routes Phase 6 shipped called `has_class_role` via
 *   `db.rpc("has_class_role", {...})` on the admin (service-role) client.
 *   That helper is SECURITY DEFINER and reads `auth.uid()` from the
 *   calling session — but the service-role client has NO auth session,
 *   so `auth.uid()` returns NULL, the lookup returns no rows, the
 *   helper returns false, and every Class DJ teacher route returned
 *   403. That's why the Teaching Mode "Loading Class DJ controls…"
 *   placeholder never resolved.
 *
 *   Fix: do the membership check directly using the teacherId we
 *   already have from `requireTeacher(request)`. The admin client
 *   bypasses RLS, so we authorise here explicitly.
 *
 * Mirrors the logic inside `has_class_role` (active class_members row
 * for the user) but supplies the user id as an arg instead of relying
 * on auth.uid().
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns true if the given teacher has an active class_members row for
 * the given class. Optional `role` filter matches the `_required_role`
 * arg in the `has_class_role` SQL helper.
 */
export async function verifyTeacherInClass(
  db: SupabaseClient,
  classId: string,
  teacherId: string,
  role?: string,
): Promise<boolean> {
  let query = db
    .from("class_members")
    .select("role")
    .eq("class_id", classId)
    .eq("member_user_id", teacherId)
    .is("removed_at", null);

  if (role) query = query.eq("role", role);

  const { data, error } = await query.maybeSingle();
  if (error) {
    console.error("[class-dj/auth-helpers] verifyTeacherInClass failed", error);
    return false;
  }
  return !!data;
}
