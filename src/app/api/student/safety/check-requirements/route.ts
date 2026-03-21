/**
 * Check Badge Requirements for a Unit
 *
 * GET /api/student/safety/check-requirements?unitId=xxx
 *   Returns which safety badges are required for the given unit and
 *   whether the student has earned them.
 *
 *   Returns: {
 *     requirements: Array<{
 *       badge_id: string;
 *       badge_name: string;
 *       badge_slug: string;
 *       is_required: boolean;
 *       student_has: boolean;
 *       student_status: 'active' | 'expired' | 'none';
 *     }>;
 *     all_met: boolean;
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
    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!unitId) {
      return NextResponse.json(
        { error: "unitId query parameter required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch unit badge requirements
    const { data: requirements, error: reqError } = await supabase
      .from("unit_badge_requirements")
      .select(
        `
        id,
        is_required,
        badges (
          id,
          name,
          slug
        )
      `
      )
      .eq("unit_id", unitId);

    if (reqError) {
      Sentry.captureException(reqError);
      return NextResponse.json(
        { error: "Failed to fetch requirements" },
        { status: 500 }
      );
    }

    // If no requirements, all are met
    if (!requirements || requirements.length === 0) {
      return NextResponse.json({
        requirements: [],
        all_met: true,
      });
    }

    // Fetch student's badge records
    const badgeIds = requirements
      .map((r) => (r.badges as any)?.id)
      .filter(Boolean);

    const { data: studentBadges, error: sbError } = await supabase
      .from("student_badges")
      .select("badge_id, status, expires_at")
      .eq("student_id", studentId)
      .in("badge_id", badgeIds);

    if (sbError) {
      Sentry.captureException(sbError);
      return NextResponse.json(
        { error: "Failed to fetch student badges" },
        { status: 500 }
      );
    }

    // Build response
    const now = new Date();
    const enrichedRequirements = requirements.map((req) => {
      const badge = req.badges as any;
      const studentBadge = studentBadges?.find(
        (sb) => sb.badge_id === badge.id
      );

      let student_status: "active" | "expired" | "none" = "none";
      let student_has = false;

      if (studentBadge) {
        if (studentBadge.status === "expired") {
          student_status = "expired";
        } else if (studentBadge.status === "active") {
          // Check if actually expired
          if (
            studentBadge.expires_at &&
            new Date(studentBadge.expires_at) < now
          ) {
            student_status = "expired";
          } else {
            student_status = "active";
            student_has = true;
          }
        }
      }

      return {
        badge_id: badge.id,
        badge_name: badge.name,
        badge_slug: badge.slug,
        is_required: req.is_required,
        student_has,
        student_status,
      };
    });

    // Check if all required badges are met
    const all_met = enrichedRequirements.every((req) => {
      if (req.is_required) {
        return req.student_has && req.student_status === "active";
      }
      return true;
    });

    return NextResponse.json({
      requirements: enrichedRequirements,
      all_met,
    });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
