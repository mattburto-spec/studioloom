/**
 * GET /api/tools/safety/results?sessionId=XXX&email=teacher@school.com
 *
 * Fetch results for a teacher session with summary stats.
 * Simple auth: email must match session.teacher_email.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";

export const GET = withErrorHandler(
  "tools/safety/results:GET",
  async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const email = searchParams.get("email");

    if (!sessionId || !email) {
      return NextResponse.json(
        { error: "Missing required query params: sessionId, email" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: session, error: sessionError } = await supabase
      .from("safety_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.teacher_email !== email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { data: results } = await supabase
      .from("safety_results")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });

    // Compute summary
    const allResults = results || [];
    const byBadge: Record<string, { attempts: number; passed: number; avgScore: number }> = {};

    for (const r of allResults) {
      const key = r.badge_id;
      if (!byBadge[key]) byBadge[key] = { attempts: 0, passed: 0, avgScore: 0 };
      byBadge[key].attempts++;
      if (r.passed) byBadge[key].passed++;
    }

    for (const key of Object.keys(byBadge)) {
      const badgeResults = allResults.filter((r) => r.badge_id === key);
      byBadge[key].avgScore = Math.round(
        badgeResults.reduce((sum, r) => sum + (r.score || 0), 0) / badgeResults.length
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        classCode: session.class_code,
        teacherEmail: session.teacher_email,
        teacherName: session.teacher_name,
        className: session.class_name,
        createdAt: session.created_at,
      },
      results: allResults,
      summary: {
        totalAttempts: allResults.length,
        passedCount: allResults.filter((r) => r.passed).length,
        averageScore: allResults.length
          ? Math.round(allResults.reduce((s, r) => s + (r.score || 0), 0) / allResults.length)
          : 0,
        byBadge,
      },
    });
  }
);
