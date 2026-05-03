// audit-skip: public anonymous free-tool, no actor identity
/**
 * POST /api/tools/safety/start-test
 *
 * Draw random questions from a badge's question pool.
 * Public endpoint — no authentication required.
 *
 * Body: { badgeSlug: string, studentName: string, sessionId?: string }
 * Returns: { testId, badge, questions (stripped of answers), startedAt }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drawQuestions, findBadgeBySlug } from "@/lib/safety/badge-definitions";
import { withErrorHandler } from "@/lib/api/error-handler";
import { nanoid } from "nanoid";

export const POST = withErrorHandler(
  "tools/safety/start-test:POST",
  async (request: NextRequest) => {
    const body = await request.json();
    const { badgeSlug, studentName, sessionId } = body;

    if (!badgeSlug || !studentName) {
      return NextResponse.json(
        { error: "Missing required fields: badgeSlug, studentName" },
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

    // Check retake cooldown if sessionId provided
    if (sessionId) {
      try {
        const supabase = createAdminClient();
        const { data: lastResult } = await supabase
          .from("safety_results")
          .select("created_at")
          .eq("session_id", sessionId)
          .eq("student_name", studentName)
          .eq("badge_id", badge.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lastResult) {
          const lastTime = new Date(lastResult.created_at).getTime();
          const cooldownMs = badge.retake_cooldown_minutes * 60 * 1000;
          const canRetakeAt = lastTime + cooldownMs;
          if (Date.now() < canRetakeAt) {
            return NextResponse.json(
              {
                error: "Retake cooldown active",
                minutesRemaining: Math.ceil((canRetakeAt - Date.now()) / 60000),
              },
              { status: 429 }
            );
          }
        }
      } catch (e) {
        console.error("[start-test] Cooldown check failed:", e);
        // Continue — cooldown check is best-effort
      }
    }

    // Draw randomised questions (stripped of correct_answer + explanation)
    const questions = drawQuestions(badgeSlug, badge.question_count);
    const testId = nanoid();

    return NextResponse.json(
      {
        testId,
        badge: {
          name: badge.name,
          slug: badge.slug,
          description: badge.description,
          category: badge.category,
          tier: badge.tier,
          color: badge.color,
          icon_name: badge.icon_name,
          pass_threshold: badge.pass_threshold,
          expiry_months: badge.expiry_months,
          question_count: badge.question_count,
          topics: badge.topics,
        },
        questions,
        startedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  }
);
