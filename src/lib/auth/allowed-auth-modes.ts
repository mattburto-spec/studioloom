/**
 * Phase 2.3 — Auth-mode allowlist resolution.
 *
 * Given a scope (school slug or class code from the login page URL),
 * returns the array of auth modes the login page should render buttons
 * for. The login page is unauthenticated, so this runs against a
 * service-role admin client and reads at most one row per scope.
 *
 * Resolution order:
 *   ?class=<code>  → join classes → schools, intersect class.allowed
 *                    with school.allowed; if class.allowed is NULL,
 *                    inherit fully from school.
 *   ?school=<id>   → schools.allowed_auth_modes (UUID lookup; schools
 *                    has no slug column at v1 — Phase 4 may add one).
 *   neither        → globally-enabled set from env (defaults to all 3
 *                    OAuth-supported modes; 'apple' off until Phase 2.4
 *                    feature flag wires through).
 *
 * Safety net: if the resolved list is empty for any reason (data bug,
 * stale row, broken intersection), this helper falls back to
 * ['email_password']. Locking a school admin out of their own login
 * page is worse than a slightly degraded UX — schools always need a
 * way back in. Phase 2.3 brief §11 risk mitigation.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type AuthMode = "email_password" | "google" | "microsoft" | "apple";

const ALL_MODES: readonly AuthMode[] = [
  "email_password",
  "google",
  "microsoft",
  "apple",
] as const;

const SAFETY_NET: AuthMode[] = ["email_password"];

export interface AllowedAuthModesScope {
  classCode?: string | null;
  schoolId?: string | null;
}

/**
 * Globally-enabled modes — controlled by env vars so we can kill an
 * entire provider (e.g. Microsoft outage) without a deploy. Defaults
 * mirror Phase 2.1+2.2 + the Phase 2.4 feature flag default of false
 * for Apple.
 */
function globallyEnabledModes(): AuthMode[] {
  const apple = process.env.NEXT_PUBLIC_AUTH_OAUTH_APPLE_ENABLED === "true";
  return apple
    ? ["email_password", "google", "microsoft", "apple"]
    : ["email_password", "google", "microsoft"];
}

function sanitise(raw: unknown): AuthMode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is AuthMode => ALL_MODES.includes(m as AuthMode));
}

function intersect(a: AuthMode[], b: AuthMode[]): AuthMode[] {
  const set = new Set(b);
  return a.filter((m) => set.has(m));
}

/**
 * Resolves the auth modes the login page should render for a given
 * URL-scope. Always returns a non-empty array (safety net guarantee).
 */
export async function getAllowedAuthModes(
  scope: AllowedAuthModesScope = {}
): Promise<AuthMode[]> {
  const global = globallyEnabledModes();

  // Class scope → join class.allowed_auth_modes with school.allowed_auth_modes.
  if (scope.classCode) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("classes")
      .select("allowed_auth_modes, schools(allowed_auth_modes)")
      .eq("code", scope.classCode)
      .maybeSingle();

    if (error || !data) {
      return SAFETY_NET;
    }

    const schoolModes = sanitise(
      // PostgREST nests the joined row; tolerate either shape.
      Array.isArray((data as { schools?: unknown }).schools)
        ? ((data as { schools: { allowed_auth_modes?: unknown }[] }).schools[0]?.allowed_auth_modes)
        : (data as { schools?: { allowed_auth_modes?: unknown } | null }).schools?.allowed_auth_modes
    );
    const classModes = sanitise(
      (data as { allowed_auth_modes?: unknown }).allowed_auth_modes
    );

    // School ALWAYS wraps — class can only narrow further.
    const schoolEffective = schoolModes.length ? schoolModes : global;
    if (classModes.length === 0) {
      // NULL → inherit from school.
      return schoolEffective.length ? schoolEffective : SAFETY_NET;
    }
    const intersected = intersect(classModes, schoolEffective);
    return intersected.length ? intersected : SAFETY_NET;
  }

  // School scope → school.allowed_auth_modes.
  if (scope.schoolId) {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("schools")
      .select("allowed_auth_modes")
      .eq("id", scope.schoolId)
      .maybeSingle();

    if (error || !data) {
      return SAFETY_NET;
    }
    const modes = sanitise(
      (data as { allowed_auth_modes?: unknown }).allowed_auth_modes
    );
    return modes.length ? modes : SAFETY_NET;
  }

  // No scope → globally-enabled.
  return global.length ? global : SAFETY_NET;
}

/**
 * Lightweight version that takes the school + class rows directly.
 * Useful in tests + for routes that have already loaded the rows.
 */
export function resolveAllowedAuthModes(opts: {
  schoolModes?: readonly string[] | null;
  classModes?: readonly string[] | null;
  globalModes?: readonly AuthMode[];
}): AuthMode[] {
  const global = sanitise(opts.globalModes ?? globallyEnabledModes());
  const schoolModes = sanitise(opts.schoolModes ?? null);
  const classModes = sanitise(opts.classModes ?? null);

  const schoolEffective = schoolModes.length ? schoolModes : global;
  if (classModes.length === 0) {
    return schoolEffective.length ? schoolEffective : SAFETY_NET;
  }
  const intersected = intersect(classModes, schoolEffective);
  return intersected.length ? intersected : SAFETY_NET;
}
