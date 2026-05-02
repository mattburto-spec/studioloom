/**
 * School-invitation helpers — Phase 4.7b-2.
 *
 * Tokenized invitations for school-tier schools. school_admin (or
 * platform admin) creates an invitation with a random 32-byte URL-safe
 * token; the invited teacher accepts via /api/auth/accept-school-invitation
 * which links them to the school + role.
 *
 * Token design (DB-stored, NOT HMAC-signed):
 *   - 32 random bytes, base64url-encoded (43 chars after padding strip)
 *   - Generated server-side via node:crypto.randomBytes
 *   - Stored verbatim in school_invitations.token (UNIQUE constraint
 *     guarantees no collision in practice)
 *   - Revocability via DB row state (HMAC tokens would verify regardless)
 *
 * Uniqueness model:
 *   - Partial unique index on (school_id, lower(invited_email),
 *     invited_role) WHERE accepted_at IS NULL AND revoked_at IS NULL
 *   - One active invite per (school, email, role); after accept/revoke,
 *     a fresh invite can be created (re-invite).
 *
 * 14-day default expiry. The accept route refuses past-expiry tokens.
 *
 * Routes that consume this module:
 *   POST /api/school/[id]/invitations            (create — admin)
 *   GET  /api/school/[id]/invitations            (list — admin)
 *   POST /api/school/[id]/invitations/[id]/revoke (revoke — admin)
 *   POST /api/auth/accept-school-invitation       (accept — anon-ish; needs auth)
 */

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export const INVITATION_TOKEN_BYTES = 32;
export const INVITATION_DEFAULT_EXPIRY_DAYS = 14;

export type InvitedRole =
  | "lead_teacher"
  | "co_teacher"
  | "dept_head"
  | "school_admin";

const VALID_ROLES: ReadonlySet<InvitedRole> = new Set([
  "lead_teacher",
  "co_teacher",
  "dept_head",
  "school_admin",
]);

export function isValidInvitedRole(value: unknown): value is InvitedRole {
  return typeof value === "string" && VALID_ROLES.has(value as InvitedRole);
}

// ─────────────────────────────────────────────────────────────────────
// Token generation
// ─────────────────────────────────────────────────────────────────────

/**
 * 32 random bytes → base64url string. ~43 characters. Suitable for URL
 * paths and query params without escaping.
 */
export function generateInvitationToken(): string {
  return randomBytes(INVITATION_TOKEN_BYTES)
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

// ─────────────────────────────────────────────────────────────────────
// createInvitation
// ─────────────────────────────────────────────────────────────────────

export type CreateInvitationArgs = {
  schoolId: string;
  invitedEmail: string;
  invitedRole: InvitedRole;
  invitedByTeacherId: string;
  expiresAt?: Date;
  supabase?: SupabaseClient;
};

export type CreateInvitationResult =
  | {
      ok: true;
      invitationId: string;
      token: string;
      expiresAt: Date;
    }
  | {
      ok: false;
      reason:
        | "invalid_email"
        | "invalid_role"
        | "duplicate_active"
        | "school_not_found"
        | "school_not_invitable"
        | "db_error";
      message: string;
    };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createInvitation(
  args: CreateInvitationArgs
): Promise<CreateInvitationResult> {
  const email = args.invitedEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return {
      ok: false,
      reason: "invalid_email",
      message: "invited_email must be a syntactically valid email address",
    };
  }

  if (!isValidInvitedRole(args.invitedRole)) {
    return {
      ok: false,
      reason: "invalid_role",
      message: `invited_role must be one of: ${[...VALID_ROLES].join(", ")}`,
    };
  }

  const db = args.supabase ?? createAdminClient();

  // Verify the school exists + is invitable (school-tier; not archived).
  // Lower-tier schools shouldn't be issuing invitations — the invite-only
  // flow is the school-tier feature. Free/pro schools are personal
  // schools (single-teacher); inviting into them is meaningless.
  const { data: school, error: schoolErr } = await db
    .from("schools")
    .select("id, subscription_tier, status")
    .eq("id", args.schoolId)
    .maybeSingle();
  if (schoolErr) {
    return { ok: false, reason: "db_error", message: schoolErr.message };
  }
  if (!school) {
    return {
      ok: false,
      reason: "school_not_found",
      message: `School ${args.schoolId} does not exist`,
    };
  }
  if (school.status !== "active") {
    return {
      ok: false,
      reason: "school_not_invitable",
      message: `School is in '${school.status}' status; cannot invite into it`,
    };
  }
  if (school.subscription_tier !== "school") {
    return {
      ok: false,
      reason: "school_not_invitable",
      message: `Only 'school'-tier schools support invitations. This school is on '${school.subscription_tier}'.`,
    };
  }

  const token = generateInvitationToken();
  const expiresAt =
    args.expiresAt ??
    new Date(Date.now() + INVITATION_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const { data: row, error: insertErr } = await db
    .from("school_invitations")
    .insert({
      school_id: args.schoolId,
      invited_email: email,
      invited_role: args.invitedRole,
      invited_by: args.invitedByTeacherId,
      token,
      expires_at: expiresAt.toISOString(),
    })
    .select("id, expires_at")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return {
        ok: false,
        reason: "duplicate_active",
        message:
          "An active invitation already exists for this email and role at this school. Revoke the existing one first or wait for it to expire.",
      };
    }
    return { ok: false, reason: "db_error", message: insertErr.message };
  }

  return {
    ok: true,
    invitationId: row.id,
    token,
    expiresAt: new Date(row.expires_at),
  };
}

// ─────────────────────────────────────────────────────────────────────
// acceptInvitation
// ─────────────────────────────────────────────────────────────────────

export type AcceptInvitationArgs = {
  token: string;
  acceptingUserId: string;
  acceptingEmail: string;
  supabase?: SupabaseClient;
};

export type AcceptInvitationResult =
  | {
      ok: true;
      invitationId: string;
      schoolId: string;
      role: InvitedRole;
      previousSchoolId: string | null;
    }
  | {
      ok: false;
      reason:
        | "token_not_found"
        | "expired"
        | "revoked"
        | "already_accepted"
        | "email_mismatch"
        | "db_error";
      message: string;
    };

/**
 * Accepts an invitation token. Service-role-driven (route uses admin
 * client) so RLS doesn't gate the accept-side UPDATE. The route still
 * verifies that the calling user's email matches invited_email
 * (case-insensitive) — this is the security boundary against someone
 * intercepting a token meant for someone else.
 *
 * On success, this function:
 *   1. Sets the invitation to accepted (accepted_at + accepted_by_user_id)
 *   2. Updates teachers.school_id to the school
 *   3. If invited_role is school_admin, inserts a school_responsibilities
 *      row (using service role — bypasses INSERT policy that would
 *      otherwise fail because the inserter isn't yet a school_admin)
 *   4. Audit-logs the acceptance via audit_events
 *
 * Returns previousSchoolId so the caller can decide whether to mark
 * the old (personal) school as merged_into the new one (tying into
 * Phase 4.5 cascade machinery for upgrade-path scenarios). Phase 4.7b-2
 * does NOT auto-merge — that's a follow-up flow.
 */
export async function acceptInvitation(
  args: AcceptInvitationArgs
): Promise<AcceptInvitationResult> {
  const db = args.supabase ?? createAdminClient();
  const acceptEmail = args.acceptingEmail.trim().toLowerCase();

  // 1. Lookup the invitation by token
  const { data: inv, error: lookupErr } = await db
    .from("school_invitations")
    .select(
      "id, school_id, invited_email, invited_role, expires_at, accepted_at, revoked_at"
    )
    .eq("token", args.token)
    .maybeSingle();
  if (lookupErr) {
    return { ok: false, reason: "db_error", message: lookupErr.message };
  }
  if (!inv) {
    return {
      ok: false,
      reason: "token_not_found",
      message: "Invitation token not recognised",
    };
  }

  // 2. State checks
  if (inv.accepted_at) {
    return {
      ok: false,
      reason: "already_accepted",
      message: "This invitation has already been accepted",
    };
  }
  if (inv.revoked_at) {
    return {
      ok: false,
      reason: "revoked",
      message: "This invitation was revoked",
    };
  }
  if (new Date(inv.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      reason: "expired",
      message: "This invitation has expired",
    };
  }

  // 3. Email match (case-insensitive)
  if (inv.invited_email.toLowerCase() !== acceptEmail) {
    return {
      ok: false,
      reason: "email_mismatch",
      message:
        "Your account email does not match the invited email address",
    };
  }

  // 4. Mark invitation accepted
  const { error: acceptErr } = await db
    .from("school_invitations")
    .update({
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: args.acceptingUserId,
    })
    .eq("id", inv.id);
  if (acceptErr) {
    return { ok: false, reason: "db_error", message: acceptErr.message };
  }

  // 5. Read the user's current school_id (so we can return previousSchoolId)
  const { data: teacherBefore } = await db
    .from("teachers")
    .select("school_id")
    .eq("id", args.acceptingUserId)
    .maybeSingle();
  const previousSchoolId = teacherBefore?.school_id ?? null;

  // 6. Update teacher's school_id to the invited school
  const { error: updErr } = await db
    .from("teachers")
    .update({ school_id: inv.school_id })
    .eq("id", args.acceptingUserId);
  if (updErr) {
    // Roll back the invitation flip so a retry is possible
    await db
      .from("school_invitations")
      .update({ accepted_at: null, accepted_by_user_id: null })
      .eq("id", inv.id);
    return { ok: false, reason: "db_error", message: updErr.message };
  }

  // 7. If the role is school_admin, also insert school_responsibilities
  if (inv.invited_role === "school_admin") {
    const { error: respErr } = await db
      .from("school_responsibilities")
      .insert({
        school_id: inv.school_id,
        teacher_id: args.acceptingUserId,
        responsibility_type: "school_admin",
        granted_by: null, // accepted via invite — the invited_by lives on the invitation row
        scope_jsonb: { source: "school_invitation", invitation_id: inv.id },
      });
    if (respErr) {
      // The teacher.school_id was set; school_admin grant failed.
      // Surface this loudly — admin needs to manually grant.
      console.error(
        "[acceptInvitation] school_admin grant failed:",
        respErr.message
      );
      // Don't roll back the school_id change — partial state is better
      // than the user being totally locked out. They've joined the school;
      // the role grant is fixable post-hoc by another admin.
    }
  }

  // 8. Audit row
  await db.from("audit_events").insert({
    actor_id: args.acceptingUserId,
    actor_type: "teacher",
    action: "school_invitation.accepted",
    target_table: "school_invitations",
    target_id: inv.id,
    school_id: inv.school_id,
    payload_jsonb: {
      invitation_id: inv.id,
      invited_role: inv.invited_role,
      previous_school_id: previousSchoolId,
    },
    severity: "info",
  });

  return {
    ok: true,
    invitationId: inv.id,
    schoolId: inv.school_id,
    role: inv.invited_role as InvitedRole,
    previousSchoolId,
  };
}

// ─────────────────────────────────────────────────────────────────────
// revokeInvitation
// ─────────────────────────────────────────────────────────────────────

export type RevokeInvitationArgs = {
  invitationId: string;
  revokedByTeacherId: string;
  supabase?: SupabaseClient;
};

export type RevokeInvitationResult =
  | { ok: true; invitationId: string }
  | {
      ok: false;
      reason: "not_found" | "already_terminal" | "db_error";
      message: string;
    };

export async function revokeInvitation(
  args: RevokeInvitationArgs
): Promise<RevokeInvitationResult> {
  const db = args.supabase ?? createAdminClient();

  const { data: inv, error: lookupErr } = await db
    .from("school_invitations")
    .select("id, accepted_at, revoked_at")
    .eq("id", args.invitationId)
    .maybeSingle();
  if (lookupErr) {
    return { ok: false, reason: "db_error", message: lookupErr.message };
  }
  if (!inv) {
    return {
      ok: false,
      reason: "not_found",
      message: `Invitation ${args.invitationId} not found`,
    };
  }
  if (inv.accepted_at) {
    return {
      ok: false,
      reason: "already_terminal",
      message: "Invitation already accepted; cannot revoke",
    };
  }
  if (inv.revoked_at) {
    return {
      ok: false,
      reason: "already_terminal",
      message: "Invitation already revoked",
    };
  }

  const { error: updErr } = await db
    .from("school_invitations")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_by: args.revokedByTeacherId,
    })
    .eq("id", args.invitationId);
  if (updErr) {
    return { ok: false, reason: "db_error", message: updErr.message };
  }

  return { ok: true, invitationId: args.invitationId };
}

// ─────────────────────────────────────────────────────────────────────
// Test exports
// ─────────────────────────────────────────────────────────────────────

export const __TEST__ = {
  EMAIL_RE,
  VALID_ROLES,
};
