/**
 * Plan-gate helpers — Phase 4.8b (freemium-build seam).
 *
 * Pass-through helpers wired into the 3 chokepoints that the post-
 * access-v2 freemium build will fill in with real plan-limit logic
 * (1 active class for free, 30 students/class, etc.). Today they
 * always return ok:true — they're seams, not gates.
 *
 * Why a thin pass-through now: collapsing class-create + enrollment
 * to single chokepoints means the freemium build replaces these
 * helpers in one place rather than auditing + threading limits
 * through every route. Cheaper to change (~0.5 day per the audit
 * vs ~2 days without the seam).
 *
 * Two functions:
 *   enforceClassCreateLimit(actor)
 *   enforceEnrollmentLimit(classId)
 *
 * Routes consume the discriminated-union result and return 422 +
 * `reason: 'plan_limit'` on a future-day cap hit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SubscriptionTier } from "./actor-session";

export type PlanGateResult =
  | { ok: true }
  | {
      ok: false;
      reason: "plan_limit";
      cap: number;
      current: number;
      tier: SubscriptionTier;
    };

/**
 * Phase 4.8b pass-through — always returns ok:true today. The freemium
 * build replaces this with a real count query against `classes` filtered
 * by `teacher_id = ?` + non-archived. Caps come from admin_settings keys
 * keyed by tier:
 *   free.max_active_classes   = 1
 *   pro.max_active_classes    = unlimited (or some sane cap)
 *   school.max_active_classes = unlimited
 *
 * Wired at the 2 class-create chokepoints:
 *   - src/app/api/teacher/welcome/create-class/route.ts
 *   - src/app/api/teacher/welcome/setup-from-timetable/route.ts
 *
 * Takes teacherId (not full session) because the pass-through doesn't
 * need any session fields — keeps callers simple. The freemium build
 * can fetch tier internally from teachers.subscription_tier when it
 * implements real cap checks.
 */
export async function enforceClassCreateLimit(
  _teacherId: string,
  _supabase?: SupabaseClient
): Promise<PlanGateResult> {
  // Pass-through. Freemium build replaces with count query.
  return { ok: true };
}

/**
 * Phase 4.8b pass-through — always returns ok:true today. The freemium
 * build replaces this with a real count query against `class_students`
 * filtered by `class_id = ?` + active enrollments. Cap typically lives
 * at admin_settings.<tier>.max_students_per_class.
 *
 * Wired at the enrollment chokepoint:
 *   - src/app/api/teacher/students/route.ts (when classId in body)
 */
export async function enforceEnrollmentLimit(
  _classId: string,
  _supabase?: SupabaseClient
): Promise<PlanGateResult> {
  return { ok: true };
}
