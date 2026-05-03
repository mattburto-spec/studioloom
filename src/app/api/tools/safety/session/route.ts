// audit-skip: public anonymous free-tool, no actor identity
/**
 * POST /api/tools/safety/session — Create teacher session (free tool)
 * GET  /api/tools/safety/session?code=ABC123 — Retrieve session by class code
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withErrorHandler } from "@/lib/api/error-handler";
import { nanoid } from "nanoid";

// In-memory rate limit: email → { count, resetAt }
const emailRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkEmailRateLimit(email: string): boolean {
  const now = Date.now();
  const existing = emailRateLimitMap.get(email);
  if (!existing || now >= existing.resetAt) {
    emailRateLimitMap.set(email, { count: 1, resetAt: now + 86400000 });
    return true;
  }
  if (existing.count >= 5) return false;
  existing.count++;
  return true;
}

function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const POST = withErrorHandler(
  "tools/safety/session:POST",
  async (request: NextRequest) => {
    const body = await request.json();
    const { teacherEmail, teacherName, className, requiredBadges } = body;

    if (!teacherEmail || !teacherName || !className) {
      return NextResponse.json(
        { error: "Missing required fields: teacherEmail, teacherName, className" },
        { status: 400 }
      );
    }

    if (!checkEmailRateLimit(teacherEmail)) {
      return NextResponse.json(
        { error: "Rate limit exceeded: max 5 sessions per email per 24 hours" },
        { status: 429 }
      );
    }

    const supabase = createAdminClient();
    const sessionId = nanoid();
    let classCode = generateClassCode();

    // Ensure unique class code
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from("safety_sessions")
        .select("id")
        .eq("class_code", classCode)
        .single();
      if (!existing) break;
      classCode = generateClassCode();
    }

    const { error } = await supabase.from("safety_sessions").insert({
      id: sessionId,
      class_code: classCode,
      teacher_email: teacherEmail,
      teacher_name: teacherName,
      class_name: className,
      required_badges: requiredBadges || [],
    });

    if (error) {
      console.error("[session:POST] DB error:", error);
      throw new Error(error.message);
    }

    return NextResponse.json({ sessionId, classCode }, { status: 201 });
  }
);

export const GET = withErrorHandler(
  "tools/safety/session:GET",
  async (request: NextRequest) => {
    const code = new URL(request.url).searchParams.get("code");
    if (!code) {
      return NextResponse.json({ error: "Missing query param: code" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: session, error: sessionError } = await supabase
      .from("safety_sessions")
      .select("*")
      .eq("class_code", code)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { data: results } = await supabase
      .from("safety_results")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      session: {
        id: session.id,
        classCode: session.class_code,
        teacherEmail: session.teacher_email,
        teacherName: session.teacher_name,
        className: session.class_name,
        createdAt: session.created_at,
        requiredBadges: session.required_badges || [],
      },
      resultsCount: results?.length || 0,
      results: results || [],
    });
  }
);
