/**
 * Get a single badge with full question pool and learn content.
 *
 * GET /api/student/safety/badges/[badgeId]
 *   Returns: {
 *     badge: BadgeDefinition;
 *     learnContent: LearnCard[];
 *     questions: BadgeQuestion[];
 *     studentStatus?: 'earned' | 'expired' | 'cooldown' | 'not_started';
 *     earnedAt?: string;
 *     expiresAt?: string;
 *     cooldownUntil?: string;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import * as Sentry from "@sentry/nextjs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ badgeId: string }> }
) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;
  const { badgeId } = await params;

  try {
    const supabase = createAdminClient();

    // Fetch badge
    const { data: badge, error: badgeError } = await supabase
      .from("badges")
      .select("*")
      .eq("id", badgeId)
      .single();

    if (badgeError || !badge) {
      return NextResponse.json({ error: "Badge not found" }, { status: 404 });
    }

    // Fetch student's badge status
    const { data: studentBadge } = await supabase
      .from("student_badges")
      .select("status, awarded_at, expires_at")
      .eq("student_id", studentId)
      .eq("badge_id", badgeId)
      .maybeSingle();

    // Fetch recent failed attempts for cooldown calculation
    // Failed attempts are stored as student_badges with status='expired'
    const { data: recentResults } = await supabase
      .from("student_badges")
      .select("created_at, score")
      .eq("student_id", studentId)
      .eq("badge_id", badgeId)
      .eq("status", "expired")
      .order("created_at", { ascending: false })
      .limit(1);

    const now = new Date();
    let student_status: string | undefined;
    let earned_at: string | undefined;
    let expires_at: string | undefined;
    let cooldown_until: string | undefined;

    if (studentBadge) {
      earned_at = studentBadge.awarded_at;
      expires_at = studentBadge.expires_at;

      if (studentBadge.status === "expired") {
        student_status = "expired";
      } else if (studentBadge.status === "active") {
        if (
          studentBadge.expires_at &&
          new Date(studentBadge.expires_at) < now
        ) {
          student_status = "expired";
        } else {
          student_status = "earned";
        }
      }
    }

    // Check cooldown
    if (recentResults && recentResults.length > 0 && !student_status) {
      const lastFailure = new Date(recentResults[0].created_at);
      const cooldownMs = badge.retake_cooldown_minutes * 60 * 1000;
      const cooldownUntilDate = new Date(
        lastFailure.getTime() + cooldownMs
      );

      if (cooldownUntilDate > now) {
        student_status = "cooldown";
        cooldown_until = cooldownUntilDate.toISOString();
      }
    }

    // NOTE: Periodic cron job should scan and update expired badges to status='expired'.
    // This prevents stale 'active' records from persisting. See scheduled tasks roadmap.

    // Parse JSONB fields
    const learn_content = (badge.learn_content || []) as Array<{
      title: string;
      content: string;
      icon: string;
    }>;
    const question_pool = (badge.question_pool || []) as Array<{
      id: string;
      type: string;
      topic: string;
      prompt: string;
      options?: string[];
      match_pairs?: Array<{ left: string; right: string }>;
      correct_answer: string | string[] | number[];
      explanation: string;
      difficulty: string;
    }>;

    // Randomly select questions (Fisher-Yates shuffle)
    const shuffled = question_pool
      .sort(() => Math.random() - 0.5)
      .slice(0, badge.question_count);

    return NextResponse.json({
      badge,
      learnContent: learn_content,
      questions: shuffled,
      studentStatus: student_status || "not_started",
      earnedAt: earned_at,
      expiresAt: expires_at,
      cooldownUntil: cooldown_until,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
