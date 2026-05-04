import { getAllowedAuthModes } from "@/lib/auth/allowed-auth-modes";
import LoginForm from "./LoginForm";

/**
 * /teacher/login — server component.
 *
 * Reads ?school= (UUID) or ?class= (class code) from the URL and
 * resolves which auth modes the page should offer, then hands off to
 * the LoginForm client component for state + button click handling.
 *
 * Phase 2.3 (1 May 2026) — adds the URL-scoped allowlist filtering.
 * Pre-Phase-2.3 behaviour: every login page rendered all 3 modes.
 *
 * Note: searchParams is async in Next.js 15+ (Promise<…>).
 */
export default async function TeacherLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ school?: string | string[]; class?: string | string[] }>;
}) {
  const params = await searchParams;

  // searchParams entries can be string or string[] when the same key
  // appears multiple times. Coerce to single string.
  const schoolId = Array.isArray(params.school) ? params.school[0] : params.school;
  const classCode = Array.isArray(params.class) ? params.class[0] : params.class;

  const allowedModes = await getAllowedAuthModes({
    schoolId: schoolId ?? undefined,
    classCode: classCode ?? undefined,
  });

  const restrictedScope = !!(schoolId || classCode);

  return <LoginForm allowedModes={allowedModes} restrictedScope={restrictedScope} />;
}
