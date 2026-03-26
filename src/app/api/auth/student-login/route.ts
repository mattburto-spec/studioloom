import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { nanoid } from "nanoid";

// Rate limit: 10 attempts/min, 50/hour per IP — prevents brute-force on class codes
const LOGIN_LIMITS = [
  { maxRequests: 10, windowMs: 60 * 1000 },
  { maxRequests: 50, windowMs: 60 * 60 * 1000 },
];

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfterMs } = rateLimit(`login:${ip}`, LOGIN_LIMITS);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((retryAfterMs || 60000) / 1000)) } }
    );
  }

  const { classCode, username } = await request.json();

  if (!classCode || !username) {
    return NextResponse.json(
      { error: "Class code and username are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Look up the class by code
  const { data: classData, error: classError } = await supabase
    .from("classes")
    .select("id, name")
    .eq("code", classCode.toUpperCase().trim())
    .single();

  if (classError || !classData) {
    return NextResponse.json(
      { error: "Invalid class code" },
      { status: 401 }
    );
  }

  // Look up the student via class_students junction (migration 041)
  // Try junction table first, fall back to legacy class_id, then broadest search
  let student: { id: string; username: string; display_name: string | null; ell_level: number } | null = null;
  const normalizedUsername = username.trim().toLowerCase();

  // New path: class_students junction
  const { data: enrollment, error: enrollmentError } = await supabase
    .from("class_students")
    .select("student_id, students(id, username, display_name, ell_level)")
    .eq("class_id", classData.id)
    .eq("is_active", true)
    .not("students", "is", null);

  if (enrollmentError) {
    console.error("[student-login] class_students query error:", enrollmentError.message);
  }

  if (enrollment && enrollment.length > 0) {
    // Find matching student by username
    const match = enrollment.find((e: any) => {
      const s = e.students;
      return s && s.username === normalizedUsername;
    });
    if (match) {
      const s = (match as any).students;
      student = {
        id: s.id,
        username: s.username,
        display_name: s.display_name,
        ell_level: s.ell_level ?? 0,
      };
    }
  }

  // Legacy fallback 1: students.class_id (for pre-junction data)
  if (!student) {
    const { data: legacyStudent } = await supabase
      .from("students")
      .select("id, username, display_name, ell_level")
      .eq("class_id", classData.id)
      .eq("username", normalizedUsername)
      .maybeSingle();

    if (legacyStudent) {
      student = legacyStudent;
    }
  }

  // Legacy fallback 2: find student by username + check author_teacher_id matches class teacher
  // Covers edge case where class_id was nulled but student exists
  if (!student) {
    const { data: classOwner } = await supabase
      .from("classes")
      .select("teacher_id")
      .eq("id", classData.id)
      .single();

    if (classOwner) {
      const { data: orphanStudent } = await supabase
        .from("students")
        .select("id, username, display_name, ell_level")
        .eq("username", normalizedUsername)
        .eq("author_teacher_id", classOwner.teacher_id)
        .maybeSingle();

      if (orphanStudent) {
        student = orphanStudent;
        // Re-link the student to this class for future logins
        await supabase
          .from("students")
          .update({ class_id: classData.id })
          .eq("id", orphanStudent.id);
      }
    }
  }

  if (!student) {
    return NextResponse.json(
      { error: "Student not found in this class" },
      { status: 401 }
    );
  }

  // Create a session token
  const token = nanoid(48);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const { error: sessionError } = await supabase
    .from("student_sessions")
    .insert({
      student_id: student.id,
      token,
      expires_at: expiresAt.toISOString(),
    });

  if (sessionError) {
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }

  // Set the session cookie
  const response = NextResponse.json({
    success: true,
    student: {
      id: student.id,
      username: student.username,
      display_name: student.display_name,
    },
    className: classData.name,
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });

  // Vercel CDN strips Set-Cookie from responses with Cache-Control: public.
  // Next.js defaults Route Handlers to "public, max-age=0, must-revalidate".
  // Force private so the cookie actually reaches the browser.
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

  return response;
}
