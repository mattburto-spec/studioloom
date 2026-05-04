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

export default function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

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
          router.push("/teacher/login");
          setLoading(false);
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

        setTeacher(teacherData);

        // Welcome-wizard guard: if the teacher hasn't completed onboarding,
        // bounce to /teacher/welcome before letting them poke at school
        // settings. Defence-in-depth — the /school/me/settings redirect
        // already routes unattached teachers to welcome, but a teacher
        // who jumps directly to /school/<some-id>/settings shouldn't
        // bypass onboarding.
        if (teacherData && !teacherData.onboarded_at) {
          router.push("/teacher/welcome");
          return;
        }
      } catch (err) {
        console.error("[SchoolLayout] Unexpected error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTeacher();
  }, [router]);

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

  // Always chromed for /school/* — no public or chromeless paths here.
  return (
    <TeacherContext.Provider value={{ teacher }}>
      <TeacherShell>{children}</TeacherShell>
      <BugReportButton role="teacher" />
    </TeacherContext.Provider>
  );
}
