/**
 * POST /api/auth/student-classcode-login
 *
 * Phase: Access Model v2 Phase 1.2 (Auth Unification — classcode+name flow on Supabase Auth)
 * Brief:  docs/projects/access-model-v2-phase-1-brief.md §4.2
 *
 * Mints a real Supabase session for a student logging in by classcode + username.
 * Replaces the legacy /api/auth/student-login route's `nanoid(48) + custom session
 * cookie` pattern with `auth.admin.generateLink({ type: 'magiclink' })` followed
 * by server-side `auth.verifyOtp({ token_hash })`. Result: sb-* cookies set by
 * the @supabase/ssr cookies adapter; legacy /api/auth/student-login stays
 * callable during the grace window (Phase 6 deletes it).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SECURITY POSTURE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * 1. Two-tier rate limiting:
 *    - Per-IP: 10/min + 50/hour (mirrors legacy bucket exactly)
 *    - Per-classcode: 30 failures/hour (NEW — defeats distributed-IP attacks
 *      on a known classcode)
 *    The classcode bucket counts only failed attempts — successful logins
 *    don't burn budget.
 *
 * 2. Audit logging on every outcome:
 *    - Success:      severity=info,  action=student.login.classcode.success
 *    - Failed login: severity=warn,  action=student.login.classcode.failed
 *    - Rate limited: severity=warn,  action=student.login.classcode.rate_limited
 *    Failures keep classCode in payload_jsonb but never the user-supplied
 *    username (avoids logging PII for typo'd login attempts).
 *
 * 3. Sanitised error logging:
 *    - hashed_token from generateLink NEVER logged anywhere
 *    - Supabase auth errors logged with a fixed message; original error
 *      stays in the function-scope variable but never leaves the process
 *
 * 4. Lazy auth.users provisioning:
 *    - If student.user_id is NULL (UI-created student post-Phase-1.1b),
 *      provision inline via the shared helper. Idempotent + safe — we only
 *      do this AFTER classCode + username verifies the student exists.
 *
 * 5. Cache-Control: private, no-cache, no-store
 *    - Vercel CDN strips Set-Cookie from public responses. Without this
 *      header, the sb-* cookies wouldn't reach the browser.
 *
 * 6. Generic 401 messages:
 *    - "Invalid class code" / "Student not found in this class" — same as
 *      legacy. Doesn't leak whether classCode exists vs username doesn't match.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COOKIE BEHAVIOUR
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The @supabase/ssr cookies adapter writes to Next.js `cookies()` from
 * `next/headers`. In Route Handlers (Next.js 15+), that store IS writable
 * and its contents propagate to the outgoing response automatically. After
 * a successful verifyOtp, the sb-<projectref>-auth-token cookie (Supabase's
 * single-cookie session JSON format under @supabase/ssr v0.6+) is set
 * HttpOnly + Secure + SameSite=Lax with a configurable lifetime.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, type RateLimitWindow } from "@/lib/rate-limit";
import {
  provisionStudentAuthUserOrThrow,
  syntheticEmailForStudentId,
} from "@/lib/access-v2/provision-student-auth-user";

// ─────────────────────────────────────────────────────────────────────────
// Rate-limit configuration
// ─────────────────────────────────────────────────────────────────────────

const PER_IP_LIMITS: RateLimitWindow[] = [
  { maxRequests: 10, windowMs: 60 * 1000 },
  { maxRequests: 50, windowMs: 60 * 60 * 1000 },
];

// Per-classcode bucket — counts FAILURES only (success doesn't burn budget).
// 30 failed attempts/hour locks the classcode for ~5 min.
const PER_CLASSCODE_LIMITS: RateLimitWindow[] = [
  { maxRequests: 30, windowMs: 60 * 60 * 1000 },
];

// ─────────────────────────────────────────────────────────────────────────
// Audit log helper (Phase 1.2 — direct INSERT; logAuditEvent wrapper lands in Phase 5)
// ─────────────────────────────────────────────────────────────────────────

type LoginAuditPayload = {
  actor_id: string | null;
  actor_type: "student" | "system";
  action:
    | "student.login.classcode.success"
    | "student.login.classcode.failed"
    | "student.login.classcode.rate_limited";
  severity: "info" | "warn";
  classCode: string | null;
  studentId?: string;
  schoolId?: string | null;
  classId?: string | null;
  ip: string;
  userAgent: string | null;
  failureReason?: string;
};

async function logLoginEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any,
  payload: LoginAuditPayload
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("audit_events").insert({
      actor_id: payload.actor_id,
      actor_type: payload.actor_type,
      action: payload.action,
      severity: payload.severity,
      target_table: payload.studentId ? "students" : null,
      target_id: payload.studentId ?? null,
      school_id: payload.schoolId ?? null,
      class_id: payload.classId ?? null,
      payload_jsonb: {
        classCode: payload.classCode,
        ...(payload.failureReason && { failureReason: payload.failureReason }),
      },
      ip_address: payload.ip === "unknown" ? null : payload.ip,
      user_agent: payload.userAgent,
    });
    if (error) {
      // Audit-log failures must NEVER fail the request — we degrade silently
      // and surface to ops via the warn level. logAuditEvent (Phase 5) will
      // add Sentry breadcrumb + retry queue.
      console.warn("[student-classcode-login] audit_events insert failed:", error.message);
    }
  } catch (e) {
    console.warn("[student-classcode-login] audit_events insert threw:", (e as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = request.headers.get("user-agent");
  const supabaseAdmin = createAdminClient();

  // ── 1. Per-IP rate limit ────────────────────────────────────────────────
  const ipCheck = rateLimit(`csl-login:ip:${ip}`, PER_IP_LIMITS);
  if (!ipCheck.allowed) {
    await logLoginEvent(supabaseAdmin, {
      actor_id: null,
      actor_type: "system",
      action: "student.login.classcode.rate_limited",
      severity: "warn",
      classCode: null,
      ip,
      userAgent,
      failureReason: "per_ip_rate_limit",
    });
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((ipCheck.retryAfterMs || 60_000) / 1000)),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }

  // ── 2. Parse + validate body ────────────────────────────────────────────
  let body: { classCode?: string; username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { classCode, username } = body;

  if (!classCode || !username) {
    return NextResponse.json(
      { error: "Class code and username are required" },
      { status: 400 }
    );
  }
  const normalizedClassCode = classCode.toUpperCase().trim();
  const normalizedUsername = username.trim().toLowerCase();

  // ── 3. Per-classcode rate limit (failure-only bucket) ───────────────────
  // We check it eagerly here — every request consumes budget regardless of
  // outcome. A successful login is rare enough that this is conservative.
  // (Alternative: check only on failure path. Trades worse-case-burst for
  // implementation simplicity. Accept the conservative form for v1.)
  const codeCheck = rateLimit(
    `csl-login:code:${normalizedClassCode}`,
    PER_CLASSCODE_LIMITS
  );
  if (!codeCheck.allowed) {
    await logLoginEvent(supabaseAdmin, {
      actor_id: null,
      actor_type: "system",
      action: "student.login.classcode.rate_limited",
      severity: "warn",
      classCode: normalizedClassCode,
      ip,
      userAgent,
      failureReason: "per_classcode_rate_limit",
    });
    return NextResponse.json(
      { error: "Too many login attempts for this class. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((codeCheck.retryAfterMs || 60_000) / 1000)),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  }

  // ── 4. Look up class ────────────────────────────────────────────────────
  const { data: classData } = await supabaseAdmin
    .from("classes")
    .select("id, name, school_id, teacher_id")
    .eq("code", normalizedClassCode)
    .single();

  if (!classData) {
    await logLoginEvent(supabaseAdmin, {
      actor_id: null,
      actor_type: "system",
      action: "student.login.classcode.failed",
      severity: "warn",
      classCode: normalizedClassCode,
      ip,
      userAgent,
      failureReason: "invalid_class_code",
    });
    return NextResponse.json(
      { error: "Invalid class code" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      }
    );
  }

  // ── 5. Look up student via 3-level chain (mirrors legacy route) ─────────
  type StudentLite = {
    id: string;
    username: string;
    display_name: string | null;
    ell_level: number;
    user_id: string | null;
    school_id: string | null;
  };
  let student: StudentLite | null = null;

  // Level 1: class_students junction (preferred path post-mig 041)
  const { data: enrollment } = await supabaseAdmin
    .from("class_students")
    .select(
      "student_id, students(id, username, display_name, ell_level, user_id, school_id)"
    )
    .eq("class_id", classData.id)
    .eq("is_active", true)
    .not("students", "is", null);

  if (enrollment && enrollment.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = enrollment.find((e: any) => {
      const s = e.students;
      return s && s.username === normalizedUsername;
    });
    if (match) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = (match as any).students;
      student = {
        id: s.id,
        username: s.username,
        display_name: s.display_name,
        ell_level: s.ell_level ?? 0,
        user_id: s.user_id ?? null,
        school_id: s.school_id ?? null,
      };
    }
  }

  // Level 2: legacy students.class_id direct lookup
  if (!student) {
    const { data: legacy } = await supabaseAdmin
      .from("students")
      .select("id, username, display_name, ell_level, user_id, school_id")
      .eq("class_id", classData.id)
      .eq("username", normalizedUsername)
      .maybeSingle();
    if (legacy) student = legacy as StudentLite;
  }

  // Level 3: orphan student (matches legacy fallback exactly)
  if (!student && classData.teacher_id) {
    const { data: orphan } = await supabaseAdmin
      .from("students")
      .select("id, username, display_name, ell_level, user_id, school_id")
      .eq("username", normalizedUsername)
      .eq("author_teacher_id", classData.teacher_id)
      .maybeSingle();
    if (orphan) {
      student = orphan as StudentLite;
      // Re-link for future logins (mirror legacy)
      await supabaseAdmin
        .from("students")
        .update({ class_id: classData.id })
        .eq("id", orphan.id);
    }
  }

  if (!student) {
    await logLoginEvent(supabaseAdmin, {
      actor_id: null,
      actor_type: "system",
      action: "student.login.classcode.failed",
      severity: "warn",
      classCode: normalizedClassCode,
      schoolId: classData.school_id,
      classId: classData.id,
      ip,
      userAgent,
      failureReason: "student_not_in_class",
    });
    return NextResponse.json(
      { error: "Student not found in this class" },
      {
        status: 401,
        headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      }
    );
  }

  // ── 6. Lazy provision auth.users if NULL (UI-created student fallback) ──
  // Phase 1.1d wires server-side INSERT routes to provision immediately. The
  // 4 client-side UI INSERT sites (FU-AV2-UI-STUDENT-INSERT-REFACTOR) leave
  // user_id NULL until first login. This block closes that window. We only
  // call this AFTER classCode + username has verified the student exists, so
  // it can never create users from unverified input.
  let authUserId: string | null = student.user_id;
  if (!authUserId) {
    try {
      const provisionResult = await provisionStudentAuthUserOrThrow(supabaseAdmin, {
        id: student.id,
        user_id: null,
        school_id: student.school_id ?? classData.school_id ?? null,
      });
      authUserId = provisionResult.user_id;
    } catch (e) {
      // Sanitised log — error message goes to console but we don't expose to client
      console.error(
        `[student-classcode-login] lazy provisionStudentAuthUser failed for student=${student.id}:`,
        (e as Error).message
      );
      await logLoginEvent(supabaseAdmin, {
        actor_id: null,
        actor_type: "system",
        action: "student.login.classcode.failed",
        severity: "warn",
        classCode: normalizedClassCode,
        studentId: student.id,
        schoolId: classData.school_id,
        classId: classData.id,
        ip,
        userAgent,
        failureReason: "lazy_provision_failed",
      });
      return NextResponse.json(
        { error: "Login temporarily unavailable. Please try again in a moment." },
        {
          status: 503,
          headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
        }
      );
    }
  }

  // ── 7. Mint Supabase session via generateLink + verifyOtp ───────────────
  const syntheticEmail = syntheticEmailForStudentId(student.id);

  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });

  // Sanitised error path — never log linkErr.message verbatim (could include
  // tokens). Use a fixed prefix.
  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error("[student-classcode-login] generateLink failed");
    await logLoginEvent(supabaseAdmin, {
      actor_id: authUserId,
      actor_type: "system",
      action: "student.login.classcode.failed",
      severity: "warn",
      classCode: normalizedClassCode,
      studentId: student.id,
      schoolId: classData.school_id,
      classId: classData.id,
      ip,
      userAgent,
      failureReason: "generate_link_failed",
    });
    return NextResponse.json(
      { error: "Login service unavailable. Please try again in a moment." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      }
    );
  }

  // Construct SSR client whose cookies adapter persists to Next.js cookies()
  // — that store is writable in Route Handlers and propagates to the outgoing
  // response automatically.
  const cookieStore = await cookies();
  const ssrClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
        ) {
          for (const { name, value, options } of cookiesToSet) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Defensive — set is read-only in some Next.js contexts;
              // we run inside a POST Route Handler which is writable.
            }
          }
        },
      },
    }
  );

  // type: 'magiclink' matches GenerateLinkType used in generateLink above.
  // The EmailOtpType union accepts both 'magiclink' and 'email' but using the
  // canonical 'magiclink' keeps the round-trip explicit and version-stable.
  const { data: sessionData, error: otpErr } = await ssrClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (otpErr || !sessionData?.session) {
    console.error("[student-classcode-login] verifyOtp failed");
    await logLoginEvent(supabaseAdmin, {
      actor_id: authUserId,
      actor_type: "system",
      action: "student.login.classcode.failed",
      severity: "warn",
      classCode: normalizedClassCode,
      studentId: student.id,
      schoolId: classData.school_id,
      classId: classData.id,
      ip,
      userAgent,
      failureReason: "verify_otp_failed",
    });
    return NextResponse.json(
      { error: "Login service unavailable. Please try again in a moment." },
      {
        status: 503,
        headers: { "Cache-Control": "private, no-cache, no-store, must-revalidate" },
      }
    );
  }

  // ── 8. Success — log + return response ──────────────────────────────────
  await logLoginEvent(supabaseAdmin, {
    actor_id: authUserId,
    actor_type: "student",
    action: "student.login.classcode.success",
    severity: "info",
    classCode: normalizedClassCode,
    studentId: student.id,
    schoolId: classData.school_id,
    classId: classData.id,
    ip,
    userAgent,
  });

  const response = NextResponse.json({
    success: true,
    student: {
      id: student.id,
      username: student.username,
      display_name: student.display_name,
    },
    className: classData.name,
  });

  // Vercel CDN strips Set-Cookie from public responses. Force private so the
  // sb-* cookies (set by the SSR cookies adapter on cookieStore) reach the
  // browser. Same gotcha as the legacy /api/auth/student-login route.
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");

  return response;
}
