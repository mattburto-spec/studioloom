/**
 * Provision a Supabase auth.users row for a student.
 *
 * Phase: Access Model v2 Phase 1.1d (29 April 2026)
 *
 * Shared helper used by:
 *   - scripts/access-v2/backfill-student-auth-users.ts (bulk Phase 1.1b backfill)
 *   - src/app/api/auth/lti/launch/route.ts             (LTI student auto-create)
 *   - src/app/api/teacher/welcome/add-roster/route.ts  (bulk roster import)
 *   - src/app/api/teacher/integrations/sync/route.ts   (LMS sync)
 *   - src/app/api/auth/student-classcode-login/route.ts (Phase 1.2 — lazy fallback for UI-created students)
 *
 * Idempotency:
 *   - If student.user_id is already set, returns it without any auth API call.
 *   - If auth.users row already exists for the synthetic email (race / partial
 *     prior run), reuses it and re-links students.user_id.
 *   - If neither exists, creates both atomically (per-row, not transactionally —
 *     a createUser success followed by a students UPDATE failure leaves a
 *     dangling auth.users row, but the next call recovers via the duplicate-email
 *     reuse path).
 *
 * Failure mode:
 *   - Returns `{ ok: false, error }` envelope. Routes throw; the backfill
 *     iterates per-row and records failures.
 *
 * Security:
 *   - REQUIRES a service-role Supabase client (createAdminClient()).
 *   - Never accepts raw classCode/username — caller must have already verified
 *     the student exists. This helper does NOT create new students; it only
 *     provisions auth.users for an existing students.id.
 *   - Synthetic email format: `student-${student_id}@students.studioloom.local`
 *     — opaque, .local TLD reserved (RFC 6762), no PII.
 *   - app_metadata.user_type='student' is the security-critical claim
 *     (admin-only, propagates to JWT). user_metadata.user_type also set so
 *     the Phase 0 handle_new_user_profile trigger (which reads
 *     raw_user_meta_data) creates the user_profiles row.
 *
 * Lessons:
 *   - #38 — assertions on this helper test EXACT email + metadata shape, not just non-null
 *   - #44 — createUser-first-handle-duplicate is simpler than always calling listUsers
 *   - #45 — surgical: this helper does NOT INSERT students, only auth.users + UPDATE student.user_id
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const SYNTHETIC_EMAIL_DOMAIN = "students.studioloom.local";
export const CREATED_VIA_TAG = "phase-1-1-backfill";
// Same tag as Phase 1.1b backfill — by design. Rollback script targets this
// tag; new students provisioned post-backfill should be undone by the same
// rollback flow if Phase 1 is ever rolled back wholesale.

export interface MinimalStudent {
  id: string;
  user_id: string | null;
  school_id: string | null;
}

export type ProvisionResult =
  | { ok: true; user_id: string; created: boolean; reused: boolean; skipped: boolean }
  | { ok: false; error: string };

/**
 * Generate the synthetic email for a student given their UUID.
 *
 * Pattern: `student-${uuid}@students.studioloom.local`
 *
 * Deterministic per student.id; re-running yields the same email.
 */
export function syntheticEmailForStudentId(studentId: string): string {
  if (!studentId || typeof studentId !== "string") {
    throw new Error(`syntheticEmailForStudentId: invalid studentId (got ${typeof studentId})`);
  }
  return `student-${studentId}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

/**
 * Build the createUser payload for a student.
 *
 * - email: synthetic from student.id
 * - user_metadata.user_type='student': read by Phase 0 handle_new_user_profile trigger
 * - app_metadata.user_type='student': security-critical claim, admin-only
 * - app_metadata.school_id: denormalised for analytics + future RLS speed
 * - app_metadata.created_via: tag for rollback discoverability
 */
export function buildAuthUserPayload(student: MinimalStudent) {
  return {
    email: syntheticEmailForStudentId(student.id),
    email_confirm: true, // no outbound email
    user_metadata: {
      user_type: "student" as const,
    },
    app_metadata: {
      user_type: "student" as const,
      school_id: student.school_id,
      created_via: CREATED_VIA_TAG,
    },
  };
}

/**
 * Attempt to provision an auth.users row for a student.
 *
 * Returns a discriminated result. Routes can throw on `!ok`; the backfill
 * driver iterates per-row.
 *
 * @param supabase  Service-role Supabase client (admin client). Required.
 * @param student   Minimum shape — id, user_id (nullable), school_id (nullable).
 */
export async function provisionStudentAuthUser(
  supabase: SupabaseClient,
  student: MinimalStudent
): Promise<ProvisionResult> {
  // 1. Already linked → skip (idempotent re-run)
  if (student.user_id) {
    return { ok: true, user_id: student.user_id, created: false, reused: false, skipped: true };
  }

  const payload = buildAuthUserPayload(student);

  // 2. Try createUser. The fast path: 1 API call.
  //    If a previous partial run created the auth.users row but failed to
  //    UPDATE students.user_id, createUser will return a duplicate-email error.
  //    We recover via lookup-by-email below.
  const { data: createData, error: createError } = await supabase.auth.admin.createUser(payload);

  let authUserId: string;
  let kind: "created" | "reused";

  if (!createError && createData?.user) {
    authUserId = createData.user.id;
    kind = "created";
  } else if (createError && isDuplicateEmailError(createError)) {
    // Recovery path: look up existing auth.users row by email.
    const lookup = await findAuthUserByEmail(supabase, payload.email);
    if (!lookup.ok) {
      return { ok: false, error: `createUser duplicate but lookup failed: ${lookup.error}` };
    }
    authUserId = lookup.user_id;
    kind = "reused";
  } else {
    return {
      ok: false,
      error: `createUser: ${createError?.message ?? "unknown error (no user returned)"}`,
    };
  }

  // 3. Link students.user_id → auth.users.id
  const { error: updateError } = await supabase
    .from("students")
    .update({ user_id: authUserId })
    .eq("id", student.id);

  if (updateError) {
    return {
      ok: false,
      error: `update students.user_id: ${updateError.message}`,
    };
  }

  return {
    ok: true,
    user_id: authUserId,
    created: kind === "created",
    reused: kind === "reused",
    skipped: false,
  };
}

/**
 * Throwing variant for route callers — they want a single user_id or a 500.
 *
 * @throws Error if provisioning fails.
 */
export async function provisionStudentAuthUserOrThrow(
  supabase: SupabaseClient,
  student: MinimalStudent
): Promise<{ user_id: string; created: boolean; reused: boolean; skipped: boolean }> {
  const result = await provisionStudentAuthUser(supabase, student);
  if (!result.ok) {
    throw new Error(`provisionStudentAuthUser failed for student ${student.id}: ${result.error}`);
  }
  return {
    user_id: result.user_id,
    created: result.created,
    reused: result.reused,
    skipped: result.skipped,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check whether a Supabase auth error indicates duplicate email.
 *
 * Supabase's auth API can return this in a few ways depending on version:
 *   - error.message containing "already" + "registered"
 *   - error.message containing "duplicate" + "email"
 *   - error.code === "email_exists" (newer SDK versions)
 *
 * We match liberally to be resilient across Supabase version drift.
 */
function isDuplicateEmailError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "email_exists") return true;
  if (!error.message) return false;
  const msg = error.message.toLowerCase();
  return (
    (msg.includes("already") && msg.includes("registered")) ||
    (msg.includes("duplicate") && msg.includes("email")) ||
    msg.includes("user already exists")
  );
}

/**
 * Look up an auth.users row by email. Used in the duplicate-email recovery path.
 *
 * Supabase admin SDK doesn't expose getUserByEmail directly, so we paginate
 * listUsers and filter client-side. For prod scale (hundreds of students), the
 * default page=1000 covers it. If a future deployment exceeds that we'll need
 * cursor pagination — re-evaluate then.
 */
async function findAuthUserByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) {
    return { ok: false, error: `listUsers: ${error?.message ?? "no data"}` };
  }
  const match = (data.users ?? []).find((u) => u.email === email);
  if (!match) {
    return { ok: false, error: `auth.users with email=${email} not found in first 1000 rows` };
  }
  return { ok: true, user_id: match.id };
}
