/**
 * POST /api/bug-reports — submit a bug report (teacher or student)
 *
 * Auth resolution order:
 *   - If the client passes role_hint="student", try the student session token
 *     FIRST and only fall back to Supabase Auth if that fails.
 *   - If the client passes role_hint="teacher" (or omits the hint), try
 *     Supabase Auth first.
 *
 * Why the hint: the same browser can hold both a Supabase Auth session
 * (teacher) and a student session cookie at the same time (e.g. teacher
 * QA-ing as a student in the same profile). The hint disambiguates so a
 * student-context submission isn't tagged as a teacher.
 *
 * The hint is a hint, not a credential — we still verify against the
 * matching session/auth source. If the hinted source has no valid session,
 * we fall through to the other.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const VALID_CATEGORIES = ["broken", "visual", "confused", "feature_request"];
const MAX_CLIENT_CONTEXT_BYTES = 32_000;

type Reporter = { id: string; role: "teacher" | "student" };

async function resolveTeacher(): Promise<Reporter | null> {
  const serverSupabase = await createServerSupabaseClient();
  const { data: { user } } = await serverSupabase.auth.getUser();
  return user ? { id: user.id, role: "teacher" } : null;
}

async function resolveStudent(request: NextRequest, supabase: ReturnType<typeof createAdminClient>): Promise<Reporter | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const { data: session } = await supabase
    .from("student_sessions")
    .select("student_id")
    .eq("token", token)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  return session ? { id: session.student_id, role: "student" } : null;
}

export async function POST(request: NextRequest) {
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const {
      category,
      description,
      page_url,
      console_errors,
      class_id,
      screenshot_url,
      role_hint,
      client_context,
    } = body;

    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "Description required" }, { status: 400 });
    }

    // Hint-aware auth resolution. Hint is a hint, not a credential —
    // each branch still verifies against its own session source.
    const studentFirst = role_hint === "student";
    const reporter: Reporter | null =
      (studentFirst
        ? (await resolveStudent(request, supabase)) ?? (await resolveTeacher())
        : (await resolveTeacher()) ?? (await resolveStudent(request, supabase)));

    if (!reporter) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Defensive cap: client_context is loose JSONB but should never be huge.
    let safeClientContext: Record<string, unknown> = {};
    if (client_context && typeof client_context === "object" && !Array.isArray(client_context)) {
      const serialized = JSON.stringify(client_context);
      if (serialized.length <= MAX_CLIENT_CONTEXT_BYTES) {
        safeClientContext = client_context as Record<string, unknown>;
      } else {
        // Truncate by dropping events array if present, then by giving up.
        const trimmed = { ...(client_context as Record<string, unknown>) };
        delete trimmed.events;
        const trimmedSerialized = JSON.stringify(trimmed);
        if (trimmedSerialized.length <= MAX_CLIENT_CONTEXT_BYTES) {
          safeClientContext = { ...trimmed, events_dropped: true };
        } else {
          safeClientContext = { context_too_large: true };
        }
      }
    }

    const { data, error } = await supabase
      .from("bug_reports")
      .insert({
        reporter_id: reporter.id,
        reporter_role: reporter.role,
        class_id: class_id || null,
        category,
        description: description.trim().slice(0, 2000),
        page_url: page_url?.slice(0, 500) || null,
        console_errors: Array.isArray(console_errors) ? console_errors.slice(0, 5) : [],
        screenshot_url: screenshot_url || null,
        client_context: safeClientContext,
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
