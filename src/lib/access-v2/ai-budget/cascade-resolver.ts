/**
 * AI budget cascade resolver — Phase 5.2.
 *
 * Resolves a student's effective daily AI token cap via the 5-layer cascade
 * specified in master spec §4 line 269 (Q1 amended) + Decision 6:
 *
 *   1. ai_budgets   WHERE subject_type='student' AND subject_id=studentId
 *   2. ai_budgets   WHERE subject_type='class'   AND subject_id IN (student's classes)
 *   3. ai_budgets   WHERE subject_type='school'  AND subject_id=student.school_id
 *   4. schools.default_student_ai_budget (Phase 4.8 column)
 *   5. readTierDefault(school.subscription_tier)
 *
 * Tighter overrides win (student beats class beats school beats column beats tier).
 *
 * The class layer is "any class with an override" — if a student is enrolled
 * in 3 classes and any one class has a class-level cap set, that cap wins.
 * If multiple classes have overrides, the LOWEST cap wins (most restrictive).
 *
 * Returns the resolved cap + which layer won (for audit-event payload + UI).
 *
 * No throwing — orphan students get { cap: tier_default(school='pilot') = 50000 }
 * so the middleware can still emit a 429 with a real cap value.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { readTierDefault, TIER_DEFAULTS, type SubscriptionTier } from "./tier-defaults";

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
  /** When source='class', the class_id whose override won. */
  winningClassId?: string | null;
}

const FALLBACK_CAP = TIER_DEFAULTS.pilot;

export async function resolveStudentCap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  studentId: string,
): Promise<ResolvedCap> {
  // ── Step 0: load student → school + class enrollments ──────────────
  const { data: studentRow } = await supabase
    .from("students")
    .select("id, school_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!studentRow) {
    // Orphan student — return the floor so middleware can emit a real 429.
    return {
      cap: FALLBACK_CAP,
      source: "tier_default",
      schoolId: null,
    };
  }

  const schoolId = (studentRow as { school_id: string | null }).school_id;

  // ── Step 1: per-student override ───────────────────────────────────
  const studentOverride = await readBudget(supabase, "student", studentId);
  if (studentOverride !== null) {
    return { cap: studentOverride, source: "student", schoolId };
  }

  // ── Step 2: per-class override (any class the student is in) ──────
  // Lowest cap wins if multiple classes have overrides (most restrictive).
  const { data: classRows } = await supabase
    .from("class_students")
    .select("class_id")
    .eq("student_id", studentId);

  const classIds = ((classRows ?? []) as Array<{ class_id: string }>).map(
    (r) => r.class_id,
  );

  if (classIds.length > 0) {
    const { data: classBudgets } = await supabase
      .from("ai_budgets")
      .select("subject_id, daily_token_cap")
      .eq("subject_type", "class")
      .in("subject_id", classIds);

    const rows = (classBudgets ?? []) as Array<{
      subject_id: string;
      daily_token_cap: number;
    }>;
    if (rows.length > 0) {
      const winner = rows.reduce((min, r) =>
        r.daily_token_cap < min.daily_token_cap ? r : min,
      );
      return {
        cap: winner.daily_token_cap,
        source: "class",
        schoolId,
        winningClassId: winner.subject_id,
      };
    }
  }

  // ── Step 3: per-school override row (ai_budgets subject_type='school') ─
  if (schoolId) {
    const schoolOverride = await readBudget(supabase, "school", schoolId);
    if (schoolOverride !== null) {
      return { cap: schoolOverride, source: "school", schoolId };
    }
  }

  // ── Step 4: schools.default_student_ai_budget (Phase 4.8 column) ──
  // ── Step 5: tier default                                          ──
  if (!schoolId) {
    return { cap: FALLBACK_CAP, source: "tier_default", schoolId: null };
  }

  const { data: schoolRow } = await supabase
    .from("schools")
    .select("default_student_ai_budget, subscription_tier")
    .eq("id", schoolId)
    .maybeSingle();

  if (!schoolRow) {
    return { cap: FALLBACK_CAP, source: "tier_default", schoolId };
  }

  const colCap = (schoolRow as { default_student_ai_budget: number | null })
    .default_student_ai_budget;
  if (colCap !== null && colCap !== undefined) {
    return { cap: colCap, source: "school_default_column", schoolId };
  }

  const tier = (schoolRow as { subscription_tier: string | null })
    .subscription_tier;
  if (tier && tier in TIER_DEFAULTS) {
    const cap = await readTierDefault(supabase, tier as SubscriptionTier);
    return { cap, source: "tier_default", schoolId };
  }

  return { cap: FALLBACK_CAP, source: "tier_default", schoolId };
}

async function readBudget(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  subjectType: "student" | "class" | "school",
  subjectId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("ai_budgets")
    .select("daily_token_cap")
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .maybeSingle();
  const cap = (data as { daily_token_cap?: number } | null)?.daily_token_cap;
  return typeof cap === "number" ? cap : null;
}
