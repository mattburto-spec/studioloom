/**
 * POST /api/bug-reports — submit a bug report (teacher or student)
 *
 * Teachers: identified via Supabase Auth
 * Students: identified via session cookie token
 * Falls back gracefully if neither is authenticated.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const VALID_CATEGORIES = ["broken", "visual", "confused", "feature_request"];

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { category, description, page_url, console_errors, class_id, screenshot_url } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "Description required" }, { status: 400 });
    }

    // Identify reporter — try teacher (Supabase Auth) first, then student (token)
    let reporter_id: string | null = null;
    let reporter_role: "teacher" | "student" | null = null;

    // Try teacher auth
    const serverSupabase = await createServerSupabaseClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user) {
      reporter_id = user.id;
      reporter_role = "teacher";
    }

    // Try student session if no teacher auth
    if (!reporter_id) {
      const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (token) {
        const { data: session } = await supabase
          .from("student_sessions")
          .select("student_id")
          .eq("token", token)
          .gt("expires_at", new Date().toISOString())
          .maybeSingle();

        if (session) {
          reporter_id = session.student_id;
          reporter_role = "student";
        }
      }
    }

    if (!reporter_id || !reporter_role) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("bug_reports")
      .insert({
        reporter_id,
        reporter_role,
        class_id: class_id || null,
        category,
        description: description.trim().slice(0, 2000),
        page_url: page_url?.slice(0, 500) || null,
        console_errors: Array.isArray(console_errors) ? console_errors.slice(0, 5) : [],
        screenshot_url: screenshot_url || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ id: data.id, success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to submit bug report" },
      { status: 500 }
    );
  }
}
