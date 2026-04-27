"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TeacherContext } from "./teacher-context";
import { TeacherShell } from "@/components/teacher-dashboard-v2/TeacherShell";
import { BugReportButton } from "@/components/shared/BugReportButton";
import type { Teacher } from "@/types";

/**
 * Bare auth-flow pages: render without the teacher chrome AND are exempt
 * from the "no user → /teacher/login" and "onboarded_at IS NULL → /teacher/welcome"
 * redirects. Each of these pages handles its own session state internally.
 *
 *   /teacher/login            — credential entry, no session yet.
 *   /teacher/welcome          — onboarding wizard, session set but onboarded_at NULL.
 *   /teacher/forgot-password  — password-reset request, works logged-in or out.
 *   /teacher/set-password     — set/change password (invite, recovery, self-service);
 *                               has its own session guard.
 */
const PUBLIC_TEACHER_PATHS: readonly string[] = [
  "/teacher/login",
  "/teacher/welcome",
  "/teacher/forgot-password",
  "/teacher/set-password",
];

function isPublicTeacherPath(pathname: string): boolean {
  return PUBLIC_TEACHER_PATHS.includes(pathname);
}

/**
 * Chromeless teacher paths render bare (no shell, no TopNav) but still
 * pass through auth + teacher-context. Used by full-screen routes that
 * manage their own chrome — the projector view is the canonical case.
 *
 * As of Phase 11 the Bold chrome is the default for all other teacher
 * routes; pre-Phase-11 the dashboard itself was chromeless (it rendered
 * its own TopNav) and this list handled that. Not any more — layout
 * supplies the Bold chrome universally.
 */
function isChromelessTeacherPath(pathname: string): boolean {
  // /teacher/teach/[unitId]/projector — dark full-screen classroom
  // projector, intentionally minimal UI.
  if (pathname.endsWith("/projector")) return true;
  return false;
}

/* NAV_ITEMS removed in Phase 11 — the Bold TopNav (rendered by
 * TeacherShell) now owns the nav config at
 * src/components/teacher-dashboard-v2/nav-config.ts. Everything the
 * legacy inline-SVG nav used to render now flows through that module.
 */

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeacher() {
      try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError && authError.message !== "Auth session missing!") {
          console.error("[TeacherLayout] Auth error:", authError.message);
        }

        if (!user) {
          // Don't trap users who are legitimately on a bare auth-flow page.
          if (!isPublicTeacherPath(pathname)) {
            router.push("/teacher/login");
          }
          setLoading(false);
          return;
        }

        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("*")
          .eq("id", user.id)
          .single();

        if (teacherError) {
          console.error("[TeacherLayout] Teacher query error:", teacherError.message);
        }

        setTeacher(teacherData);

        // Phase 1B: first-login detector. If the teacher hasn't finished the
        // welcome wizard, redirect them there on every request. The wizard
        // itself (and all bare auth-flow pages) must render without this
        // redirect or the teacher would be trapped — critically, the
        // /teacher/set-password step that the invite callback routes to.
        // See migration 083.
        if (
          teacherData &&
          !teacherData.onboarded_at &&
          !isPublicTeacherPath(pathname)
        ) {
          router.push("/teacher/welcome");
          return;
        }

        // Phase 6B's critical-alert count query removed in Phase 11 —
        // the Bold nav doesn't surface per-item nav badges; alerts land
        // under the bell icon (a future iteration could re-add the
        // count there).
      } catch (err) {
        console.error("[TeacherLayout] Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeacher();
  }, [router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-alt">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  // Bare-render any of the public auth-flow pages without the header /
  // nav — these screens manage their own visual chrome.
  if (isPublicTeacherPath(pathname)) {
    return (
      <TeacherContext.Provider value={{ teacher }}>
        {children}
      </TeacherContext.Provider>
    );
  }

  // Chromeless paths (Bold dashboard v2 preview) keep auth + context but
  // drop the legacy header/nav so the v2's own TopNav is the only chrome.
  if (isChromelessTeacherPath(pathname)) {
    return (
      <TeacherContext.Provider value={{ teacher }}>
        {children}
      </TeacherContext.Provider>
    );
  }

  // Everything else — wrap children in the shared Bold shell. The
  // shell owns the Manrope/DM-Sans font vars, the `.tl-v2` scoped CSS,
  // the TopNav with scope chip + avatar dropdown, and the classes
  // fetch for the chip. Settings / log-out live in the avatar
  // dropdown; Alerts land under the bell button.
  return (
    <TeacherContext.Provider value={{ teacher }}>
      <TeacherShell>{children}</TeacherShell>
      <BugReportButton role="teacher" />
    </TeacherContext.Provider>
  );
}
