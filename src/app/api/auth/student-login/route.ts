import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "@/lib/constants";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
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

  // Look up the student by username within that class
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("id, username, display_name, ell_level")
    .eq("class_id", classData.id)
    .eq("username", username.trim().toLowerCase())
    .single();

  if (studentError || !student) {
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

  return response;
}
