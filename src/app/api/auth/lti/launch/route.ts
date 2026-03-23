import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyLtiSignature, extractLtiStudentInfo } from "@/lib/lti";
import { decrypt } from "@/lib/encryption";
import { nanoid } from "nanoid";
import { SESSION_COOKIE_NAME, SESSION_DURATION_DAYS } from "@/lib/constants";

/**
 * POST /api/auth/lti/launch
 * LTI 1.1 launch endpoint — receives signed POST from ANY LMS.
 * Verifies OAuth 1.0a signature, finds/creates student, creates session, redirects to dashboard.
 *
 * This endpoint is 100% LMS-agnostic. LTI 1.1 is a standard supported by
 * ManageBac, Canvas, Schoology, Moodle, Toddle, Blackboard, and virtually every LMS.
 */
export async function POST(request: NextRequest) {
  try {
    // LTI sends application/x-www-form-urlencoded
    const formData = await request.formData();
    const params: Record<string, string> = {};
    for (const [key, value] of formData.entries()) {
      params[key] = String(value);
    }

    // Validate required LTI parameters
    const consumerKey = params.oauth_consumer_key;
    if (!consumerKey) {
      return errorResponse("Missing oauth_consumer_key", 400);
    }

    if (!params.user_id) {
      return errorResponse("Missing user_id", 400);
    }

    // Look up the integration by consumer key
    const supabase = createAdminClient();
    const { data: integration } = await supabase
      .from("teacher_integrations")
      .select("id, teacher_id, provider, lti_consumer_secret")
      .eq("lti_consumer_key", consumerKey)
      .single();

    if (!integration) {
      return errorResponse("Unknown consumer key", 401);
    }

    if (!integration.lti_consumer_secret) {
      return errorResponse("LTI not configured properly", 500);
    }

    // Decrypt the consumer secret and verify the OAuth signature
    const consumerSecret = decrypt(integration.lti_consumer_secret);

    // Build the launch URL from the request
    const launchUrl = getLaunchUrl(request);

    if (!verifyLtiSignature(params, launchUrl, consumerSecret)) {
      return errorResponse("Invalid signature", 401);
    }

    // Extract student info from LTI params
    const studentInfo = extractLtiStudentInfo(params);

    if (!studentInfo.externalId) {
      return errorResponse("No student identity in LTI params", 400);
    }

    // Find the StudioLoom class to add the student to
    // Priority: custom_studioloom_class param → context_id mapping
    const classId = await resolveClassId(
      supabase,
      integration.teacher_id,
      params.custom_studioloom_class,
      params.context_id,
      integration.provider
    );

    if (!classId) {
      return errorResponse(
        "Could not determine which class to join. Ask your teacher to configure the LTI link with a StudioLoom class code.",
        400
      );
    }

    // Find or create the student
    const studentId = await findOrCreateStudent(
      supabase,
      classId,
      studentInfo,
      integration.provider
    );

    // Create a session
    const token = nanoid(48);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

    await supabase.from("student_sessions").insert({
      student_id: studentId,
      token,
      expires_at: expiresAt.toISOString(),
    });

    // Redirect to student dashboard with session cookie
    const dashboardUrl = new URL("/dashboard", request.url);
    const response = NextResponse.redirect(dashboardUrl, 302);

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    });

    // Prevent Vercel CDN from stripping Set-Cookie
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

    return response;
  } catch (error) {
    console.error("LTI launch error:", error);
    return errorResponse("Internal server error", 500);
  }
}

/**
 * Reconstruct the launch URL from the request.
 * The URL must match exactly what the LMS used to sign the request.
 */
function getLaunchUrl(request: NextRequest): string {
  const url = new URL(request.url);
  // Use forwarded host/proto if behind a proxy (Vercel, etc.)
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  return `${proto}://${host}${url.pathname}`;
}

/**
 * Resolve the StudioLoom class ID from LTI params.
 * Tries custom_studioloom_class (class code) first, then context_id (external_class_id).
 */
async function resolveClassId(
  supabase: ReturnType<typeof createAdminClient>,
  teacherId: string,
  classCode?: string,
  contextId?: string,
  provider?: string
): Promise<string | null> {
  // Try 1: custom_studioloom_class = StudioLoom class code
  if (classCode) {
    const { data } = await supabase
      .from("classes")
      .select("id")
      .eq("code", classCode.toUpperCase().trim())
      .eq("teacher_id", teacherId)
      .single();
    if (data) return data.id;
  }

  // Try 2: context_id = external_class_id from a previous sync
  if (contextId && provider) {
    const { data } = await supabase
      .from("classes")
      .select("id")
      .eq("external_class_id", contextId)
      .eq("external_provider", provider)
      .eq("teacher_id", teacherId)
      .single();
    if (data) return data.id;
  }

  return null;
}

/**
 * Find an existing student by external_id or create a new one.
 */
async function findOrCreateStudent(
  supabase: ReturnType<typeof createAdminClient>,
  classId: string,
  studentInfo: {
    externalId: string;
    displayName: string;
    username: string;
  },
  provider: string
): Promise<string> {
  // Try to find by external_id in this class
  const { data: existing } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("external_id", studentInfo.externalId)
    .eq("external_provider", provider)
    .single();

  if (existing) {
    // Update display name in case it changed
    await supabase
      .from("students")
      .update({ display_name: studentInfo.displayName })
      .eq("id", existing.id);
    return existing.id;
  }

  // Ensure username is unique within the class
  let username = studentInfo.username;
  const { data: usernameCheck } = await supabase
    .from("students")
    .select("id")
    .eq("class_id", classId)
    .eq("username", username)
    .single();

  if (usernameCheck) {
    // Username taken — append external ID suffix
    username = `${username}_${studentInfo.externalId.slice(-4)}`;
  }

  // Create new student
  const { data: newStudent, error } = await supabase
    .from("students")
    .insert({
      username,
      display_name: studentInfo.displayName,
      class_id: classId,
      external_id: studentInfo.externalId,
      external_provider: provider,
    })
    .select("id")
    .single();

  if (error || !newStudent) {
    throw new Error(`Failed to create student: ${error?.message}`);
  }

  return newStudent.id;
}

function errorResponse(message: string, status: number) {
  // For LTI errors, show a user-friendly HTML page
  const html = `<!DOCTYPE html>
<html>
<head><title>StudioLoom - Launch Error</title></head>
<body style="font-family: system-ui; max-width: 600px; margin: 80px auto; text-align: center;">
  <h1 style="color: #1B3A5C;">StudioLoom</h1>
  <div style="background: #FEE2E2; border: 1px solid #FECACA; border-radius: 8px; padding: 16px; margin: 24px 0;">
    <p style="color: #DC2626; margin: 0;">${message}</p>
  </div>
  <p style="color: #6B7280;">If this problem persists, please contact your teacher.</p>
</body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html" },
  });
}
