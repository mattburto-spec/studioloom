// audit-skip: public anonymous free-tool, no actor identity
/**
 * POST /api/tools/safety/submit-test
 *
 * Grade a completed test and optionally store results.
 * Public endpoint — no authentication required for free tool.
 *
 * Body: { testId, badgeSlug, studentName, sessionId?, answers, timeTakenSeconds }
 * Returns: { score, passed, threshold, results, badgeAwarded? }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeTest, findBadgeBySlug } from "@/lib/safety/badge-definitions";
import { getStudentSession } from "@/lib/access-v2/actor-session";
import { withErrorHandler } from "@/lib/api/error-handler";
import { nanoid } from "nanoid";

export const POST = withErrorHandler(
  "tools/safety/submit-test:POST",
  async (request: NextRequest) => {
    const body = await request.json();
    const { badgeSlug, studentName, sessionId, answers, timeTakenSeconds } = body;

    if (!badgeSlug || !studentName || !answers || timeTakenSeconds == null) {
      return NextResponse.json(
        { error: "Missing required fields: badgeSlug, studentName, answers, timeTakenSeconds" },
        { status: 400 }
      );
    }

    const badge = findBadgeBySlug(badgeSlug);
    if (!badge) {
      return NextResponse.json(
        { error: `Badge not found: ${badgeSlug}` },
        { status: 404 }
      );
    }

    // Grade the test
    const { score, results } = gradeTest(badgeSlug, answers);
    const passed = score >= badge.pass_threshold;
    let badgeAwarded = false;

    // Store result in DB if teacher session exists
    if (sessionId) {
      try {
        const supabase = createAdminClient();

        // Count previous attempts for this student + badge in this session
        const { count } = await supabase
          .from("safety_results")
          .select("id", { count: "exact", head: true })
          .eq("session_id", sessionId)
          .eq("student_name", studentName)
          .eq("badge_id", badge.id);

        const attemptNumber = (count || 0) + 1;

        const { error: resultError } = await supabase
          .from("safety_results")
          .insert({
            id: nanoid(),
            session_id: sessionId,
            student_name: studentName,
            badge_id: badge.id,
            score,
            passed,
            answers,
            time_taken_seconds: timeTakenSeconds,
            attempt_number: attemptNumber,
          });

        if (resultError) {
          console.error("[submit-test] Result insert error:", resultError);
        }
      } catch (e) {
        console.error("[submit-test] DB error:", e);
      }
    }

    // Award badge to authenticated students
    if (passed) {
      try {
        const session = await getStudentSession(request);
        const studentId = session?.studentId ?? null;
        if (studentId) {
          const supabase = createAdminClient();

          // Count previous attempts
          const { count } = await supabase
            .from("student_badges")
            .select("id", { count: "exact", head: true })
            .eq("student_id", studentId)
            .eq("badge_id", badge.id);

          const { error: badgeError } = await supabase
            .from("student_badges")
            .insert({
              id: nanoid(),
              student_id: studentId,
              badge_id: badge.id,
              score,
              attempt_number: (count || 0) + 1,
              granted_by: "test",
              status: "active",
              answers,
              time_taken_seconds: timeTakenSeconds,
              awarded_at: new Date().toISOString(),
              expires_at: badge.expiry_months
                ? new Date(Date.now() + badge.expiry_months * 30 * 24 * 60 * 60 * 1000).toISOString()
                : null,
            });

          if (!badgeError) badgeAwarded = true;
          else console.error("[submit-test] Badge award error:", badgeError);
        }
      } catch {
        // Auth is optional for free tool — silently continue
      }
    }

    return NextResponse.json({ score, passed, threshold: badge.pass_threshold, results, badgeAwarded });
  }
);
