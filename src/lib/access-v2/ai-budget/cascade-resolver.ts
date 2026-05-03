/**
 * SCAFFOLD — Phase 5.2
 *
 * Resolves a student's effective daily AI token cap via 4-layer cascade:
 *   1. ai_budgets WHERE subject_type='student' AND subject_id=studentId
 *   2. ai_budgets WHERE subject_type='class' AND subject_id IN (student's classes)
 *   3. ai_budgets WHERE subject_type='school' AND subject_id=student.school_id
 *   4. schools.default_student_ai_budget (Phase 4.8 column)
 *   5. readTierDefault(school.subscription_tier)
 *
 * Tighter overrides win (student beats class beats school beats tier).
 *
 * Returns the resolved cap + which layer won (for audit-event payload + UI).
 */

export type CascadeSource =
  | "student"
  | "class"
  | "school"
  | "school_default_column"
  | "tier_default";

export interface ResolvedCap {
  cap: number;
  source: CascadeSource;
  schoolId: string | null;
}

export async function resolveStudentCap(
  _supabase: unknown,
  _studentId: string,
): Promise<ResolvedCap> {
  throw new Error(
    "[scaffold] resolveStudentCap not implemented — see docs/projects/access-model-v2-phase-5-brief.md §5.2",
  );
}
