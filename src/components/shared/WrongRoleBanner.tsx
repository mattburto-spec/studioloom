"use client";

/**
 * WrongRoleBanner — surfaces a friendly explanation when middleware
 * Phase 6.3b (or the TeacherLayout / SchoolLayout fail-closed fix from
 * FU-SEC-TEACHER-LAYOUT-FAIL-OPEN, 16 May 2026) bounces a user to the
 * wrong-role dashboard.
 *
 * Closes FU-AV2-WRONG-ROLE-TOAST (P3, filed 4 May 2026).
 *
 * Triggers on `?wrong_role=1` in the URL — set by middleware.ts when:
 *   - a student session reaches /teacher/* → /dashboard?wrong_role=1
 *   - a teacher session reaches /dashboard etc. → /teacher/dashboard?wrong_role=1
 * AND by the fail-closed TeacherLayout / SchoolLayout when the
 * teacher-row lookup returns PGRST116 for a logged-in user.
 *
 * UX:
 *   - Renders a single inline notice at the top of the layout content area.
 *   - "Sign out" runs the role-appropriate sign-out flow then redirects
 *     to the corresponding login page.
 *   - "Dismiss" hides the banner AND strips `?wrong_role=1` from the URL
 *     via router.replace so a hard refresh doesn't re-trigger it.
 *
 * No tracking, no analytics — pure UX surface for a security redirect
 * that would otherwise be silent.
 */

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface WrongRoleBannerProps {
  /** Which dashboard owns this banner. Drives copy + sign-out flow. */
  role: "student" | "teacher";
}

export function WrongRoleBanner({ role }: WrongRoleBannerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [dismissed, setDismissed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const wrongRole = searchParams.get("wrong_role") === "1";
  if (!wrongRole || dismissed) return null;

  // Strip the wrong_role param from the URL so a hard refresh (or a
  // back-button hit) doesn't re-show the banner after dismissal.
  // Preserves any other query params the user might have on this page.
  const handleDismiss = () => {
    setDismissed(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("wrong_role");
    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    if (role === "student") {
      // Mirrors StudentLayout.handleLogout — DELETE the student session
      // cookie, then bounce to /login. We use window.location so the next
      // page load runs through middleware cleanly (router.push keeps the
      // SPA mounted and may not invalidate cached layout state).
      try {
        await fetch("/api/auth/student-session", { method: "DELETE" });
      } catch {
        // Even if the DELETE fails, force-navigate — middleware will
        // re-evaluate on the next request.
      }
      window.location.href = "/login";
    } else {
      // Mirrors TopNav.handleLogout — Supabase signOut then full reload
      // to /teacher/login. The hard nav is critical: teacher sign-out
      // also needs to clear the SSR-cached session that TeacherLayout
      // reads on mount.
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // Same as above — force-navigate even on failure.
      }
      window.location.href = "/teacher/login";
    }
  };

  const message =
    role === "student"
      ? "You were redirected because you're signed in as a student, and the page you tried to open is part of the teacher area."
      : "You were redirected because you're signed in as a teacher, and the page you tried to open is part of the student area.";

  const otherRoleLabel = role === "student" ? "teacher" : "student";

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="wrong-role-banner"
      className="mx-auto mt-3 mb-2 max-w-6xl px-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
        <div className="flex-1 text-sm leading-relaxed">
          <span className="font-semibold">Heads up — wrong account.</span>{" "}
          {message}{" "}
          <span className="opacity-80">
            Sign out and log back in with your {otherRoleLabel} account if
            you meant to go there.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="rounded-lg bg-amber-900 text-amber-50 text-xs font-semibold px-3 py-1.5 hover:bg-amber-950 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-lg border border-amber-300 bg-white/60 text-amber-900 text-xs font-semibold px-3 py-1.5 hover:bg-white transition-colors"
            aria-label="Dismiss this notice"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
