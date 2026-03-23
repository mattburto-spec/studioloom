import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

// GET: Validate current student session and return student data
export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: "No session" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: session, error } = await supabase
    .from("student_sessions")
    .select(`
      id,
      student_id,
      expires_at,
      students (
        id,
        username,
        display_name,
        ell_level,
        class_id,
        classes (
          id,
          name,
          code
        )
      )
    `)
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !session) {
    const response = NextResponse.json(
      { error: "Invalid or expired session" },
      { status: 401 }
    );
    response.cookies.delete(SESSION_COOKIE_NAME);
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    return response;
  }

  const response = NextResponse.json({ student: session.students });
  // Prevent Vercel CDN from caching session responses
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}

// DELETE: Logout — clear session
export async function DELETE(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const supabase = createAdminClient();
    await supabase.from("student_sessions").delete().eq("token", token);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  // Prevent Vercel CDN from caching/stripping cookie-clearing header
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
  return response;
}
