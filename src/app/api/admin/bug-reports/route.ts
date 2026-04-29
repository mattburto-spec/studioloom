/**
 * GET /api/admin/bug-reports — list all bug reports with filters
 * PATCH /api/admin/bug-reports — update a bug report status/notes
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

const SCREENSHOT_BUCKET = "bug-report-screenshots";
const SCREENSHOT_URL_TTL_SECONDS = 60 * 60 * 4; // 4 hr — admin can leave a tab open across a triage session without thumbnails dying. For internal admin use; longer URL-leakage window is a non-issue with a single admin viewer.

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();
  const status = request.nextUrl.searchParams.get("status");

  try {
    let query = supabase
      .from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Mint signed URLs for any reports with a screenshot. Bucket is private,
    // so the raw screenshot_url is just a storage path — UI needs a signed
    // URL to render the image. createSignedUrls is one round-trip per batch.
    const reports = data || [];
    const screenshotPaths = reports
      .map((r) => r.screenshot_url)
      .filter((p): p is string => typeof p === "string" && p.length > 0);

    if (screenshotPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(SCREENSHOT_BUCKET)
        .createSignedUrls(screenshotPaths, SCREENSHOT_URL_TTL_SECONDS);
      const byPath = new Map(
        (signed || []).map((s) => [s.path, s.signedUrl] as const)
      );
      for (const r of reports) {
        if (r.screenshot_url && byPath.has(r.screenshot_url)) {
          (r as Record<string, unknown>).screenshot_signed_url = byPath.get(r.screenshot_url);
        }
      }
    }

    return NextResponse.json({ reports });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load bug reports" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const supabase = createAdminClient();

  try {
    const body = await request.json();
    const { id, status, admin_notes, response } = body;

    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (admin_notes !== undefined) updates.admin_notes = admin_notes;
    if (response !== undefined) updates.response = response;

    const { data, error } = await supabase
      .from("bug_reports")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ report: data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update bug report" },
      { status: 500 }
    );
  }
}
