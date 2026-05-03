/**
 * POST /api/admin/school/[id]/impersonate
 *
 * Phase 4.7 — generate a signed view-as URL for the platform admin to
 * "browse as" a target teacher. Per §3.8 Q9: 5-minute TTL, audit-logged,
 * read-only forced via middleware (mutation routes 403 when the
 * impersonation token is present).
 *
 * Auth: platform admin only.
 *
 * Request body:
 *   { target_teacher_id: string, redirect_path?: string }
 *
 * Response (201):
 *   { url: string, expires_at_ms: number }
 *
 * Side effect: inserts an audit_events row of type
 * `platform_admin.impersonation_url_issued`. A SECOND audit row will fire
 * when the URL is actually used (logged by the consuming route via
 * `verifyImpersonationToken`). The pair-up gives forensic visibility of
 * "issued but never used" vs "issued and consumed."
 *
 * Spec: docs/projects/access-model-v2-phase-4-brief.md §4.7 + §3.8 Q9.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import {
  signImpersonationToken,
  buildImpersonationUrl,
  IMPERSONATION_TOKEN_TTL_MS,
} from "@/lib/auth/impersonation";
import { logAuditEvent } from "@/lib/access-v2/audit-log";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_REDIRECT_RE = /^\/teacher\/[^?#]*$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    const auth = await requirePlatformAdmin(request);
    if (auth.error) return auth.error;

    const { id: schoolId } = await ctx.params;
    if (!UUID_RE.test(schoolId)) {
      return NextResponse.json({ error: "Invalid school id" }, { status: 400 });
    }

    let body: { target_teacher_id?: unknown; redirect_path?: unknown } = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetTeacherId = body.target_teacher_id;
    if (typeof targetTeacherId !== "string" || !UUID_RE.test(targetTeacherId)) {
      return NextResponse.json(
        { error: "target_teacher_id must be a UUID" },
        { status: 400 }
      );
    }

    // Open redirect guard: only allow redirect_path under /teacher/*
    let redirectPath: string | undefined;
    if (typeof body.redirect_path === "string") {
      if (!SAFE_REDIRECT_RE.test(body.redirect_path)) {
        return NextResponse.json(
          { error: "redirect_path must start with /teacher/" },
          { status: 400 }
        );
      }
      redirectPath = body.redirect_path;
    }

    // Verify the target teacher exists + is in the named school
    const supabase = createAdminClient();
    const { data: teacher, error: teacherErr } = await supabase
      .from("teachers")
      .select("id, school_id, deleted_at")
      .eq("id", targetTeacherId)
      .maybeSingle();

    if (teacherErr) {
      console.error("[impersonate POST] teacher lookup failed:", teacherErr);
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!teacher) {
      return NextResponse.json(
        { error: "target_teacher not found" },
        { status: 404 }
      );
    }
    if (teacher.deleted_at) {
      return NextResponse.json(
        { error: "target_teacher is soft-deleted" },
        { status: 409 }
      );
    }
    if (teacher.school_id !== schoolId) {
      return NextResponse.json(
        { error: "target_teacher is not in the named school" },
        { status: 409 }
      );
    }

    // Sign the token
    let token: string;
    try {
      token = signImpersonationToken({
        adminId: auth.userId,
        targetTeacherId,
        schoolId,
      });
    } catch (err) {
      console.error("[impersonate POST] signing failed:", err);
      return NextResponse.json(
        { error: "Server error — signing key not configured" },
        { status: 500 }
      );
    }

    const url = buildImpersonationUrl({ token, redirectPath });
    const expiresAtMs = Date.now() + IMPERSONATION_TOKEN_TTL_MS;

    // Audit row — issuance (the consuming route logs a second row on use).
    // failureMode 'soft-sentry' — admin must get the URL even on audit hiccup,
    // but the gap is critical for forensic visibility so Sentry captures it.
    await logAuditEvent(supabase, {
      actorId: auth.userId,
      actorType: "platform_admin",
      action: "platform_admin.impersonation_url_issued",
      targetTable: "teachers",
      targetId: targetTeacherId,
      schoolId: schoolId,
      payload: {
        admin_email: auth.email,
        target_teacher_id: targetTeacherId,
        redirect_path: redirectPath ?? "/teacher/dashboard",
        expires_at_ms: expiresAtMs,
      },
      severity: "warn", // visible in admin filtered view
      failureMode: "soft-sentry",
    });

    return NextResponse.json(
      { url, expires_at_ms: expiresAtMs },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    console.error("[impersonate POST] unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
