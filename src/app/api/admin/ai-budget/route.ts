/**
 * GET /api/admin/ai-budget
 *
 * Per-student AI budget overview for the admin AI Budget tab. Reads
 * ai_budget_state (today's burn) joined with students for the human-readable
 * label, plus any ai_budgets overrides for context.
 *
 * Response:
 *   {
 *     summary: {
 *       totalStudents: number,
 *       activeToday: number,
 *       totalTokensToday: number,
 *       studentsApproachingCap: number,
 *       studentsAtCap: number,
 *     },
 *     students: Array<{
 *       studentId, username, displayName, schoolId, schoolName,
 *       tokensUsedToday, resetAt, percentOfEstimatedCap,
 *       hasOverride: boolean, overrideCap: number | null,
 *     }>,
 *     tierDefaults: Record<tier, capTokens>,
 *   }
 *
 * Auth: requireAdmin.
 *
 * Note: per-student cap is normally cascade-resolved at AI-call time
 * (student override → class override → school override → school default →
 * tier default). For the dashboard read we use a heuristic against the
 * tier_default of 100k tokens (pro tier) as a comparison baseline. Real
 * cap enforcement happens in withAIBudget middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { TIER_DEFAULTS } from "@/lib/access-v2/ai-budget/tier-defaults";

const ESTIMATED_CAP_FOR_DASHBOARD = 100_000; // pro-tier default; real cap is per-student

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const supabase = createAdminClient();

  try {
    // ─── 1. Load all per-student burn rows ───────────────────────────
    const { data: budgetRows, error: budgetErr } = await supabase
      .from("ai_budget_state")
      .select("student_id, tokens_used_today, reset_at, last_warning_sent_at, updated_at")
      .order("tokens_used_today", { ascending: false })
      .limit(500);

    if (budgetErr) throw budgetErr;
    const budgets = (budgetRows ?? []) as Array<{
      student_id: string;
      tokens_used_today: number;
      reset_at: string;
      last_warning_sent_at: string | null;
      updated_at: string;
    }>;

    // ─── 2. Load student labels + school context ─────────────────────
    const studentIds = budgets.map((b) => b.student_id);
    const studentMap = new Map<string, { username: string; displayName: string | null; schoolId: string | null }>();
    const schoolMap = new Map<string, string>();

    if (studentIds.length > 0) {
      const { data: studentRows } = await supabase
        .from("students")
        .select("id, username, display_name, school_id")
        .in("id", studentIds);
      for (const s of (studentRows ?? []) as Array<{ id: string; username: string; display_name: string | null; school_id: string | null }>) {
        studentMap.set(s.id, {
          username: s.username,
          displayName: s.display_name,
          schoolId: s.school_id,
        });
      }

      const schoolIds = Array.from(
        new Set((studentRows ?? []).map((s: { school_id: string | null }) => s.school_id).filter((id): id is string => !!id)),
      );
      if (schoolIds.length > 0) {
        const { data: schoolRows } = await supabase
          .from("schools")
          .select("id, name")
          .in("id", schoolIds);
        for (const s of (schoolRows ?? []) as Array<{ id: string; name: string }>) {
          schoolMap.set(s.id, s.name);
        }
      }
    }

    // ─── 3. Load any per-student overrides ───────────────────────────
    const overrideMap = new Map<string, number>();
    if (studentIds.length > 0) {
      const { data: overrideRows } = await supabase
        .from("ai_budgets")
        .select("subject_id, daily_token_cap")
        .eq("subject_type", "student")
        .in("subject_id", studentIds);
      for (const o of (overrideRows ?? []) as Array<{ subject_id: string; daily_token_cap: number }>) {
        overrideMap.set(o.subject_id, o.daily_token_cap);
      }
    }

    // ─── 4. Build response rows ──────────────────────────────────────
    const students = budgets.map((b) => {
      const student = studentMap.get(b.student_id);
      const overrideCap = overrideMap.get(b.student_id) ?? null;
      const effectiveCap = overrideCap ?? ESTIMATED_CAP_FOR_DASHBOARD;
      return {
        studentId: b.student_id,
        username: student?.username ?? "(unknown)",
        displayName: student?.displayName ?? null,
        schoolId: student?.schoolId ?? null,
        schoolName: student?.schoolId ? (schoolMap.get(student.schoolId) ?? null) : null,
        tokensUsedToday: b.tokens_used_today,
        resetAt: b.reset_at,
        percentOfEstimatedCap: effectiveCap > 0 ? Math.round((b.tokens_used_today / effectiveCap) * 100) : 0,
        hasOverride: overrideCap !== null,
        overrideCap,
      };
    });

    // ─── 5. Summary stats ────────────────────────────────────────────
    const summary = {
      totalStudents: students.length,
      activeToday: students.filter((s) => s.tokensUsedToday > 0).length,
      totalTokensToday: students.reduce((sum, s) => sum + s.tokensUsedToday, 0),
      studentsApproachingCap: students.filter(
        (s) => s.percentOfEstimatedCap >= 80 && s.percentOfEstimatedCap < 100,
      ).length,
      studentsAtCap: students.filter((s) => s.percentOfEstimatedCap >= 100).length,
    };

    return NextResponse.json({
      summary,
      students,
      tierDefaults: TIER_DEFAULTS,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load AI budget" },
      { status: 500 },
    );
  }
}
