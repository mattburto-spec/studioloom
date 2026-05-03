/**
 * POST /api/teacher/welcome/request-school-access
 *
 * Phase 4.7b-2 — replaces the auto-join "Use this school" path for
 * school-tier targets. A teacher whose email-domain matches a school
 * on tier='school' can request access via this endpoint. Creates a
 * teacher_access_requests row with school_id set, which the
 * school_admin sees in /admin/school/[id] (Phase 4.7b-2 follow-up
 * surface).
 *
 * Auth: authenticated teacher (post-signup; mid-welcome-wizard).
 *
 * Request body:
 *   { school_id: string }
 *
 * Response:
 *   201 — request created
 *   200 — duplicate (request already pending — idempotent)
 *   400 — invalid school_id
 *   401 — unauthenticated
 *   404 — school not found
 *   422 — school is not on 'school' tier (request would be meaningless)
 *   500 — db_error
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: () => {},
        },
      }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { school_id?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const schoolId = body.school_id;
    if (typeof schoolId !== "string" || !UUID_RE.test(schoolId)) {
      return NextResponse.json(
        { error: "school_id must be a UUID" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // Verify the school is on 'school' tier — request-access is meaningless
    // otherwise (and could leak info about non-school-tier schools).
    const { data: school } = await admin
      .from("schools")
      .select("id, name, subscription_tier, status")
      .eq("id", schoolId)
      .maybeSingle();
    if (!school) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (school.subscription_tier !== "school" || school.status !== "active") {
      return NextResponse.json(
        {
          error:
            "This school does not accept access requests on its current plan",
        },
        { status: 422 }
      );
    }

    // Dedup: if there's already a pending request from this email for
    // this school, return 200 (idempotent — the banner shows "request
    // sent" either way).
    const { data: existing } = await admin
      .from("teacher_access_requests")
      .select("id, status")
      .eq("school_id", schoolId)
      .eq("email", user.email.toLowerCase())
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          duplicate: true,
          request_id: existing.id,
        },
        {
          status: 200,
          headers: { "Cache-Control": "private, no-store" },
        }
      );
    }

    // Insert the request
    const { data: created, error: insertErr } = await admin
      .from("teacher_access_requests")
      .insert({
        email: user.email.toLowerCase(),
        name: user.user_metadata?.name ?? null,
        school: school.name,
        school_id: schoolId,
        status: "pending",
      })
      .select("id")
      .single();
    if (insertErr) {
      console.error(
        "[request-school-access POST] insert failed:",
        insertErr.message
      );
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Audit row — surfaces in school_admin's audit feed.
    // failureMode 'soft-sentry': request must succeed even on audit hiccup.
    await logAuditEvent(admin, {
      actorId: user.id,
      actorType: "teacher",
      action: "school.access_requested",
      targetTable: "teacher_access_requests",
      targetId: created.id,
      schoolId: schoolId,
      severity: "info",
      payload: {
        request_id: created.id,
        requester_email: user.email.toLowerCase(),
        school_name: school.name,
      },
      failureMode: "soft-sentry",
    });

    return NextResponse.json(
      { ok: true, duplicate: false, request_id: created.id },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[request-school-access POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
