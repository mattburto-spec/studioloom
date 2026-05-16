"use client";

/**
 * SchoolLayout — Phase 4.4 hotfix TopNav fix.
 *
 * /school/[id]/settings (and any future /school/* routes) need the
 * teacher TopNav so navigating away is possible. Without this layout,
 * /school/* renders bare — no nav, no avatar dropdown, stuck-page UX.
 *
 * Mirrors /teacher/layout.tsx structure with two simplifications:
 *   - No isPublicTeacherPath / isChromelessTeacherPath branches —
 *     /school/* routes are always authenticated + always chromed
 *   - Welcome-wizard redirect: still applies. Teachers who hit
 *     /school/[id]/settings without onboarded_at should finish welcome
 *     first (defence-in-depth; the /school/me/settings redirect already
 *     routes unattached teachers to /teacher/welcome).
 *
 * Slight duplication with /teacher/layout.tsx. Worth deduping if both
 * grow more divergent logic. Filed: FU-AV2-LAYOUT-DEDUP P3.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TeacherContext } from "../teacher/teacher-context";
import { TeacherShell } from "@/components/teacher-dashboard-v2/TeacherShell";
import { BugReportButton } from "@/components/shared/BugReportButton";
import type { Teacher } from "@/types";

/**
 * Auth state for the school shell. Mirrors TeacherLayout / AdminLayout
 * (closes FU-SEC-TEACHER-LAYOUT-FAIL-OPEN sibling site, 16 May 2026).
 *
 *  - "checking"     → waiting on the first auth/teacher-row response
 *  - "teacher"      → confirmed teacher row; render the chrome + children
 *  - "redirecting"  → no user, or auth.getUser() returned a user with no
 *                     matching teachers row (PGRST116). router.replace is
 *                     in flight. Do NOT render chrome.
 *
 * No public / chromeless paths under /school/* (the file header notes
 * "always chromed"), so the state machine is simpler than TeacherLayout's.
 */
type SchoolAuthState = "checking" | "teacher" | "redirecting";

export default function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [authState, setAuthState] = useState<SchoolAuthState>("checking");

  useEffect(() => {
    async function loadTeacher() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError && authError.message !== "Auth session missing!") {
          console.error("[SchoolLayout] Auth error:", authError.message);
        }

        if (!user) {
          // Set "redirecting" BEFORE router.replace so the next render
          // shows the bare placeholder, not the teacher chrome.
          setAuthState("redirecting");
          router.replace("/teacher/login");
          return;
        }

        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("*")
          .eq("id", user.id)
          .single();

        if (teacherError) {
          console.error(
            "[SchoolLayout] Teacher query error:",
            teacherError.message
          );
        }

        // Fail-closed (FU-SEC-TEACHER-LAYOUT-FAIL-OPEN, 16 May 2026):
        // a logged-in user with no matching teachers row is NOT a teacher.
        // Prior behaviour was to log the error, setTeacher(null), and
        // render TeacherShell anyway — same leak shape as the sister bug
        // in /teacher/layout.tsx. Mirror the middleware wrong-role
        // convention so the bounce surfaces the dashboard toast.
        if (!teacherData) {
          setAuthState("redirecting");
          router.replace("/dashboard?wrong_role=1");
          return;
        }

        setTeacher(teacherData);

        // Welcome-wizard guard: if the teacher hasn't completed onboarding,
        // bounce to /teacher/welcome before letting them poke at school
        // settings. Defence-in-depth — the /school/me/settings redirect
        // already routes unattached teachers to welcome, but a teacher
        // who jumps directly to /school/<some-id>/settings shouldn't
        // bypass onboarding.
        if (!teacherData.onboarded_at) {
          setAuthState("redirecting");
          router.replace("/teacher/welcome");
          return;
        }

        setAuthState("teacher");
      } catch (err) {
        console.error("[SchoolLayout] Unexpected error:", err);
        // Fail-closed on unexpected error too — don't render chrome.
        setAuthState("redirecting");
        router.replace("/teacher/login");
      }
    }
    loadTeacher();
  }, [router]);

  // Defense in depth: never render the teacher chrome until we've
  // confirmed a teacher row exists. Both "checking" and "redirecting"
  // render the bare placeholder so a non-teacher caller never sees
  // TeacherShell.
  if (authState !== "teacher") {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-surface-alt"
        data-testid="school-auth-checking"
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary text-sm">
            {authState === "redirecting" ? "Redirecting…" : "Loading…"}
          </span>
        </div>
      </div>
    );
  }

  // Always chromed for /school/* — no public or chromeless paths here.
  return (
    <TeacherContext.Provider value={{ teacher }}>
      <TeacherShell>{children}</TeacherShell>
      <BugReportButton role="teacher" />
    </TeacherContext.Provider>
  );
}
