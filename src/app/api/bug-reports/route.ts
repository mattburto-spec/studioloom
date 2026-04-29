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
 *
 * Side effects on successful insert:
 *   1. If a screenshot data-URL is provided, decode + upload to the
 *      bug-report-screenshots Storage bucket (private). Stores the
 *      object path in bug_reports.screenshot_url.
 *   2. If BUG_REPORT_NOTIFY_EMAIL is set, fire-and-forget a Resend email
 *      to that address. Failure does not break the submission.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/constants";

const VALID_CATEGORIES = ["broken", "visual", "confused", "feature_request"];
const MAX_CLIENT_CONTEXT_BYTES = 32_000;
const SCREENSHOT_BUCKET = "bug-report-screenshots";
const MAX_SCREENSHOT_BYTES = 4 * 1024 * 1024; // 4MB raw image cap
const NOTIFY_SENDER = "StudioLoom <hello@loominary.org>";

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

/**
 * Decode a data URL like "data:image/png;base64,iVBOR..." into raw bytes
 * + content-type. Returns null on malformed input or oversized payload.
 */
function decodeDataUrl(dataUrl: unknown): { bytes: Buffer; contentType: string } | null {
  if (typeof dataUrl !== "string") return null;
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], "base64");
    if (bytes.length === 0 || bytes.length > MAX_SCREENSHOT_BYTES) return null;
    return { bytes, contentType: m[1] };
  } catch {
    return null;
  }
}

async function uploadScreenshot(
  supabase: ReturnType<typeof createAdminClient>,
  reportId: string,
  dataUrl: unknown,
): Promise<string | null> {
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded) return null;
  const ext = decoded.contentType === "image/jpeg" ? "jpg" : decoded.contentType === "image/webp" ? "webp" : "png";
  const path = `${reportId}.${ext}`;
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, decoded.bytes, {
      contentType: decoded.contentType,
      upsert: false,
    });
  if (error) {
    console.error(`[bug-reports] Screenshot upload failed for ${reportId}:`, error.message);
    return null;
  }
  return path;
}

/**
 * Best-effort email notification on every new report. No idempotency
 * (each report is unique) and no DB write to track delivery — failures
 * are logged but never break the submission.
 */
async function notifyAdmin(report: {
  id: string;
  category: string;
  description: string;
  reporter_role: string;
  page_url: string | null;
  has_screenshot: boolean;
  sentry_event_id: string | null;
}): Promise<void> {
  const to = process.env.BUG_REPORT_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!to || !apiKey) return;

  const adminBase = process.env.NEXT_PUBLIC_SITE_URL || "https://www.studioloom.org";
  const subject = `[Bug · ${report.category}] ${report.description.slice(0, 60)}${report.description.length > 60 ? "…" : ""}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111;">
      <h2 style="margin: 0 0 12px;">New bug report</h2>
      <p style="margin: 0 0 4px;"><strong>Category:</strong> ${report.category}</p>
      <p style="margin: 0 0 4px;"><strong>Reporter:</strong> ${report.reporter_role}</p>
      ${report.page_url ? `<p style="margin: 0 0 4px;"><strong>Page:</strong> <a href="${report.page_url}">${report.page_url}</a></p>` : ""}
      ${report.has_screenshot ? `<p style="margin: 0 0 4px;"><strong>Screenshot:</strong> attached</p>` : ""}
      <p style="white-space: pre-wrap; margin: 12px 0; padding: 12px; background: #f7f7f8; border-radius: 8px; font-size: 14px;">${escapeHtml(report.description)}</p>
      <p style="margin: 16px 0 4px;">
        <a href="${adminBase}/admin/bug-reports" style="display: inline-block; padding: 8px 16px; background: #7B2FF2; color: white; border-radius: 8px; text-decoration: none;">Open in admin</a>
        ${report.sentry_event_id ? `&nbsp; <a href="https://sentry.io/organizations/your-org/issues/?query=event_id:${report.sentry_event_id}" style="color: #7B2FF2;">View in Sentry</a>` : ""}
      </p>
    </div>
  `;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_SENDER,
        to: [to],
        subject,
        html,
      }),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "<unreadable>");
      console.error(`[bug-reports] Resend ${response.status}: ${text}`);
    }
  } catch (err) {
    console.error(`[bug-reports] Resend network error:`, err);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
      role_hint,
      client_context,
      sentry_event_id,
      screenshot_data_url,
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

    // Defensive cap on client_context — drops events first, then gives up.
    let safeClientContext: Record<string, unknown> = {};
    if (client_context && typeof client_context === "object" && !Array.isArray(client_context)) {
      const serialized = JSON.stringify(client_context);
      if (serialized.length <= MAX_CLIENT_CONTEXT_BYTES) {
        safeClientContext = client_context as Record<string, unknown>;
      } else {
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

    // Insert first to get the row id; screenshot upload uses it as the
    // object path so the storage path is naturally tied to the report.
    const { data: inserted, error: insertError } = await supabase
      .from("bug_reports")
      .insert({
        reporter_id: reporter.id,
        reporter_role: reporter.role,
        class_id: class_id || null,
        category,
        description: description.trim().slice(0, 2000),
        page_url: page_url?.slice(0, 500) || null,
        console_errors: Array.isArray(console_errors) ? console_errors.slice(0, 5) : [],
        screenshot_url: null,
        client_context: safeClientContext,
        sentry_event_id: typeof sentry_event_id === "string" && sentry_event_id ? sentry_event_id : null,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Upload screenshot if present, then patch the row with the path.
    let screenshotPath: string | null = null;
    if (screenshot_data_url) {
      screenshotPath = await uploadScreenshot(supabase, inserted.id, screenshot_data_url);
      if (screenshotPath) {
        await supabase
          .from("bug_reports")
          .update({ screenshot_url: screenshotPath })
          .eq("id", inserted.id);
      }
    }

    // Fire-and-forget admin notification. Don't await — return to caller fast.
    void notifyAdmin({
      id: inserted.id,
      category,
      description: description.trim(),
      reporter_role: reporter.role,
      page_url: page_url || null,
      has_screenshot: !!screenshotPath,
      sentry_event_id: typeof sentry_event_id === "string" ? sentry_event_id : null,
    });

    return NextResponse.json({ id: inserted.id, success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to submit bug report" },
      { status: 500 }
    );
  }
}
