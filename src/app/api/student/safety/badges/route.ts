/**
 * Student Safety Badges API
 *
 * GET /api/student/safety/badges
 *   Returns all available badges with student's current status for each.
 *   Returns: {
 *     badges: Array<BadgeDefinition & {
 *       student_status?: 'earned' | 'expired' | 'cooldown' | 'not_started';
 *       earned_at?: string;
 *       expires_at?: string;
 *       cooldown_until?: string;
 *     }>
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import * as Sentry from "@sentry/nextjs";

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  try {
    const supabase = createAdminClient();

    // Fetch all badges
    const { data: badges, error: badgesError } = await supabase
      .from("badges")
      .select("*")
      .order("tier", { ascending: true })
      .order("created_at", { ascending: true });

    if (badgesError) {
      Sentry.captureException(badgesError);
      return NextResponse.json(
        { error: "Failed to fetch badges" },
        { status: 500 }
      );
    }

    // Fetch student's badge records
    const { data: studentBadges, error: studentBadgesError } = await supabase
      .from("student_badges")
      .select("badge_id, status, awarded_at, expires_at")
      .eq("student_id", studentId);

    if (studentBadgesError) {
      Sentry.captureException(studentBadgesError);
      return NextResponse.json(
        { error: "Failed to fetch student badges" },
        { status: 500 }
      );
    }

    // Fetch recent failed attempts (for cooldown calculation)
    const { data: recentResults, error: resultsError } = await supabase
      .from("safety_results")
      .select("badge_id, created_at, passed")
      .eq("student_id", studentId)
      .eq("passed", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (resultsError) {
      Sentry.captureException(resultsError);
      return NextResponse.json(
        { error: "Failed to fetch results" },
        { status: 500 }
      );
    }

    // Enrich badges with student status
    const now = new Date();
    const enrichedBadges = badges.map((badge) => {
      const studentBadge = studentBadges?.find(
        (sb) => sb.badge_id === badge.id
      );
      const recentFailures = recentResults?.filter(
        (r) => r.badge_id === badge.id && !r.passed
      ) || [];

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
          // Check if expired based on expires_at
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

      // Check for cooldown (failed recently)
      if (recentFailures.length > 0 && !student_status) {
        const lastFailure = new Date(recentFailures[0].created_at);
        const cooldownMs = badge.retake_cooldown_minutes * 60 * 1000;
        const cooldownUntil = new Date(lastFailure.getTime() + cooldownMs);

        if (cooldownUntil > now) {
          student_status = "cooldown";
          cooldown_until = cooldownUntil.toISOString();
        }
      }

      // NOTE: Periodic cron job should scan and update expired badges to status='expired'.
      // This prevents stale 'active' records from persisting. See scheduled tasks roadmap.

      return {
        ...badge,
        student_status: student_status || "not_started",
        earned_at,
        expires_at,
        cooldown_until,
      };
    });

    return NextResponse.json({ badges: enrichedBadges });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
