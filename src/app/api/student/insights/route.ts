/**
 * Student Insights Feed API
 *
 * GET /api/student/insights
 *   Returns a priority-sorted feed of actionable items for the student.
 *   Includes: pending safety tests, overdue work, gallery reviews/submissions,
 *   NM checkpoints, continue work, due soon, unit completions.
 *
 *   Returns: {
 *     insights: Array<{
 *       type: string;
 *       title: string;
 *       subtitle: string;
 *       href: string;
 *       priority: number (0-100);
 *       accentColor: string;
 *       iconType: string;
 *       timestamp: string;
 *     }>;
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStudentAuth } from "@/lib/auth/student";
import { rateLimit } from "@/lib/rate-limit";

interface InsightItem {
  type: string;
  title: string;
  subtitle: string;
  href: string;
  priority: number;
  accentColor: string;
  iconType: string;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireStudentAuth(request);
  if (auth.error) return auth.error;
  const studentId = auth.studentId;

  // Rate limit: 30/min, 100/hour
  const rateLimitResult = rateLimit(studentId, [
    { maxRequests: 30, windowMs: 60 * 1000 },
    { maxRequests: 100, windowMs: 60 * 60 * 1000 },
  ]);

  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(
            (rateLimitResult.retryAfterMs || 60000) / 1000
          ).toString(),
          "Cache-Control": "private",
        },
      }
    );
  }

  try {
    const db = createAdminClient();
    const insights: InsightItem[] = [];
    const now = new Date();

    // 1. Get student's classes via class_students junction (migration 041)
    const { data: enrollments } = await db
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true);

    let studentClassIds: string[] = (enrollments || []).map(
      (e: { class_id: string }) => e.class_id
    );

    if (studentClassIds.length === 0) {
      // Legacy fallback
      const { data: student } = await db
        .from("students")
        .select("class_id")
        .eq("id", studentId)
        .maybeSingle();

      if (student?.class_id) {
        studentClassIds = [student.class_id];
      } else {
        return NextResponse.json(
          { insights: [] },
          {
            headers: { "Cache-Control": "private, max-age=30" },
          }
        );
      }
    }

    // Get unit IDs assigned to student's classes
    const { data: classUnits } = await db
      .from("class_units")
      .select("unit_id")
      .in("class_id", studentClassIds);

    const unitIds = (classUnits || []).map((cu: { unit_id: string }) => cu.unit_id);

    // === INSIGHT TYPE 1: PENDING SAFETY TESTS (P95) ===
    if (unitIds.length > 0) {
      try {
        const { data: requirements } = await db
          .from("unit_badge_requirements")
          .select("unit_id, badge_id, badges(id, name, slug, icon_name, color)")
          .in("unit_id", unitIds);

        if (requirements && requirements.length > 0) {
          const badgeIds = requirements
            .map((r: any) => (r.badges as any)?.id)
            .filter(Boolean);

          const { data: studentBadges } = await db
            .from("student_badges")
            .select("badge_id, status")
            .eq("student_id", studentId)
            .in("badge_id", badgeIds);

          const earnedBadgeIds = new Set(
            (studentBadges || [])
              .filter((sb: any) => sb.status === "active")
              .map((sb: any) => sb.badge_id)
          );

          const pendingBadges = new Set<string>();
          for (const req of requirements) {
            const badge = req.badges as any;
            if (badge && !earnedBadgeIds.has(badge.id)) {
              pendingBadges.add(badge.id);
            }
          }

          for (const badgeId of Array.from(pendingBadges).slice(0, 3)) {
            const badge = requirements.find(
              (r: any) => (r.badges as any)?.id === badgeId
            )?.badges;
            if (badge) {
              insights.push({
                type: "safety_test",
                title: `Safety: ${badge.name}`,
                subtitle: "Complete required safety test",
                href: `/safety/${badgeId}`,
                priority: 95,
                accentColor: "red",
                iconType: "shield",
                timestamp: now.toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error("[insights] Safety tests query error:", err);
        // Gracefully continue
      }
    }

    // === INSIGHT TYPE 2: OVERDUE WORK (P90) ===
    try {
      const { data: progress } = await db
        .from("student_progress")
        .select("unit_id, page_id, status, updated_at")
        .eq("student_id", studentId)
        .neq("status", "complete")
        .order("updated_at", { ascending: true })
        .limit(10);

      if (progress && progress.length > 0) {
        for (const p of progress) {
          // Best-effort check: if it's old enough, flag as overdue
          const daysSinceUpdate = (now.getTime() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceUpdate > 7) {
            insights.push({
              type: "overdue_work",
              title: "Overdue work",
              subtitle: `Not completed for ${Math.floor(daysSinceUpdate)} days`,
              href: `/unit/${p.unit_id}/${p.page_id}`,
              priority: 90,
              accentColor: "red",
              iconType: "alert",
              timestamp: p.updated_at,
            });
            break; // Show only the oldest one
          }
        }
      }
    } catch (err) {
      console.error("[insights] Overdue work query error:", err);
    }

    // === INSIGHT TYPES 3-5: GALLERY ROUNDS (P80, P75, P60) ===
    if (studentClassIds.length > 0) {
      try {
        const { data: rounds } = await db
          .from("gallery_rounds")
          .select("id, title, status, deadline, min_reviews")
          .in("class_id", studentClassIds)
          .eq("status", "open");

        if (rounds && rounds.length > 0) {
          // Get student's submissions and reviews
          const roundIds = rounds.map((r: any) => r.id);
          const { data: submissions } = await db
            .from("gallery_submissions")
            .select("round_id")
            .eq("student_id", studentId)
            .in("round_id", roundIds);

          const { data: reviews } = await db
            .from("gallery_reviews")
            .select("round_id")
            .eq("reviewer_id", studentId)
            .in("round_id", roundIds);

          const submittedRounds = new Set(
            (submissions || []).map((s: any) => s.round_id)
          );
          const reviewsByRound = new Map<string, number>();
          (reviews || []).forEach((r: any) => {
            reviewsByRound.set(
              r.round_id,
              (reviewsByRound.get(r.round_id) || 0) + 1
            );
          });

          // Get total submission counts
          const { data: allSubmissions } = await db
            .from("gallery_submissions")
            .select("round_id")
            .in("round_id", roundIds);

          const submissionCounts = new Map<string, number>();
          (allSubmissions || []).forEach((s: any) => {
            submissionCounts.set(
              s.round_id,
              (submissionCounts.get(s.round_id) || 0) + 1
            );
          });

          for (const round of rounds) {
            const hasSubmitted = submittedRounds.has(round.id);
            const reviewCount = reviewsByRound.get(round.id) || 0;
            const totalSubmissions = submissionCounts.get(round.id) || 0;

            // Gallery Submit (P75)
            if (!hasSubmitted && totalSubmissions > 0) {
              insights.push({
                type: "gallery_submit",
                title: `${round.title} - Submit work`,
                subtitle: `${totalSubmissions} submission${totalSubmissions > 1 ? "s" : ""} to review`,
                href: `/gallery/${round.id}`,
                priority: 75,
                accentColor: "pink",
                iconType: "image",
                timestamp: now.toISOString(),
              });
            }

            // Gallery Review (P80)
            if (hasSubmitted && reviewCount < (round.min_reviews || 1)) {
              insights.push({
                type: "gallery_review",
                title: `${round.title} - Review peers`,
                subtitle: `${round.min_reviews || 1} review${(round.min_reviews || 1) > 1 ? "s" : ""} needed`,
                href: `/gallery/${round.id}`,
                priority: 80,
                accentColor: "pink",
                iconType: "users",
                timestamp: now.toISOString(),
              });
            }

            // Gallery Feedback (P60)
            if (hasSubmitted && reviewCount >= (round.min_reviews || 1)) {
              insights.push({
                type: "gallery_feedback",
                title: `${round.title} - View feedback`,
                subtitle: "Your peers have reviewed your work",
                href: `/gallery/${round.id}`,
                priority: 60,
                accentColor: "green",
                iconType: "message",
                timestamp: now.toISOString(),
              });
            }
          }
        }
      } catch (err) {
        console.error("[insights] Gallery rounds query error:", err);
      }
    }

    // === INSIGHT TYPE 4: NM CHECKPOINTS (P55) ===
    if (studentClassIds.length > 0) {
      try {
        const { data: classUnitData } = await db
          .from("class_units")
          .select("nm_config")
          .in("class_id", studentClassIds);

        for (const cu of classUnitData || []) {
          const nmConfig = cu.nm_config as any;
          if (nmConfig?.enabled && nmConfig.checkpoints) {
            const checkpointPageIds = Object.keys(nmConfig.checkpoints);

            // Check which checkpoints have been assessed
            const { data: assessments } = await db
              .from("competency_assessments")
              .select("page_id")
              .eq("student_id", studentId)
              .eq("source", "student")
              .in("page_id", checkpointPageIds);

            const assessedPageIds = new Set(
              (assessments || []).map((a: any) => a.page_id)
            );

            for (const pageId of checkpointPageIds) {
              if (!assessedPageIds.has(pageId)) {
                insights.push({
                  type: "nm_checkpoint",
                  title: "New Metrics checkpoint",
                  subtitle: "Complete your self-assessment",
                  href: `/unit/${unitIds[0]}/${pageId}`, // Best effort — first unit
                  priority: 55,
                  accentColor: "#FF2D78", // Hot pink
                  iconType: "target",
                  timestamp: now.toISOString(),
                });
                break; // Show only one checkpoint per insight batch
              }
            }
          }
        }
      } catch (err) {
        console.error("[insights] NM checkpoint query error:", err);
      }
    }

    // === INSIGHT TYPE 5: CONTINUE WORK (P50) ===
    try {
      const { data: inProgress } = await db
        .from("student_progress")
        .select("unit_id, page_id, updated_at")
        .eq("student_id", studentId)
        .eq("status", "in_progress")
        .order("updated_at", { ascending: false })
        .limit(1);

      if (inProgress && inProgress.length > 0) {
        const p = inProgress[0];
        insights.push({
          type: "continue_work",
          title: "Continue where you left off",
          subtitle: `Last active ${getRelativeTime(new Date(p.updated_at))} ago`,
          href: `/unit/${p.unit_id}/${p.page_id}`,
          priority: 50,
          accentColor: "purple",
          iconType: "play",
          timestamp: p.updated_at,
        });
      }
    } catch (err) {
      console.error("[insights] Continue work query error:", err);
    }

    // === INSIGHT TYPE 6: DUE SOON (P45) ===
    // Best-effort: check for lessons updated in last 7 days but not yet complete
    try {
      const { data: upcoming } = await db
        .from("student_progress")
        .select("unit_id, page_id, updated_at")
        .eq("student_id", studentId)
        .neq("status", "complete")
        .gte("updated_at", new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("updated_at", { ascending: true })
        .limit(1);

      if (upcoming && upcoming.length > 0) {
        const daysLeft = Math.ceil(
          (7 * 24 * 60 * 60 * 1000 - (now.getTime() - new Date(upcoming[0].updated_at).getTime())) / (24 * 60 * 60 * 1000)
        );
        if (daysLeft > 0 && daysLeft <= 7) {
          insights.push({
            type: "due_soon",
            title: "Work due soon",
            subtitle: `${daysLeft} day${daysLeft > 1 ? "s" : ""} remaining`,
            href: `/unit/${upcoming[0].unit_id}/${upcoming[0].page_id}`,
            priority: 45,
            accentColor: "amber",
            iconType: "clock",
            timestamp: upcoming[0].updated_at,
          });
        }
      }
    } catch (err) {
      console.error("[insights] Due soon query error:", err);
    }

    // === INSIGHT TYPE 7: UNIT COMPLETE (P30) ===
    // Find recently completed units
    try {
      const { data: completed } = await db
        .from("student_progress")
        .select("unit_id, updated_at")
        .eq("student_id", studentId)
        .eq("status", "complete")
        .gte("updated_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
        .order("updated_at", { ascending: false })
        .limit(1);

      if (completed && completed.length > 0) {
        // Get unit title
        const { data: unit } = await db
          .from("units")
          .select("title")
          .eq("id", completed[0].unit_id)
          .maybeSingle();

        if (unit) {
          insights.push({
            type: "unit_complete",
            title: `Completed: ${unit.title}`,
            subtitle: "Celebrate your work! 🎉",
            href: `/unit/${completed[0].unit_id}`,
            priority: 30,
            accentColor: "green",
            iconType: "star",
            timestamp: completed[0].updated_at,
          });
        }
      }
    } catch (err) {
      console.error("[insights] Unit complete query error:", err);
    }

    // Sort by priority (desc) then timestamp (desc)
    insights.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Cap at 20 items
    const response = insights.slice(0, 20);

    return NextResponse.json(
      { insights: response },
      {
        headers: { "Cache-Control": "private, max-age=30" },
      }
    );
  } catch (error) {
    console.error("[student/insights] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "private" } }
    );
  }
}

/**
 * Helper: convert timestamp to relative time string (e.g., "2 hours")
 */
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""}`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""}`;
  return date.toLocaleDateString();
}
