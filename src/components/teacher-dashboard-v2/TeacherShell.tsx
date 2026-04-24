"use client";

/* ================================================================
 * TeacherShell — Bold chrome wrapper used by every non-public,
 * non-chromeless teacher route.
 *
 * Phase 11: owns fonts + scoped CSS + classes fetch + TopNav.
 * Phase 12: also owns the `scope` state and exposes
 *   { classes, programs, scope, setScope, classesLoaded } to
 *   children via TeacherShellContext so the dashboard can filter
 *   its body by program.
 * ================================================================ */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Manrope, DM_Sans } from "next/font/google";
import { TopNav } from "./TopNav";
import { useScopedStyles } from "./styles";
import { TeacherShellContext } from "./TeacherShellContext";
import { deriveTeacherPrograms } from "./program";
import { useTeacher } from "@/app/teacher/teacher-context";
import type { DashboardClass, DashboardData } from "@/types/dashboard";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export function TeacherShell({ children }: { children: React.ReactNode }) {
  useScopedStyles();
  const { teacher } = useTeacher();
  const pathname = usePathname();
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [scope, setScope] = useState<string>("all");

  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/teacher/dashboard");
        if (!res.ok) {
          if (!cancelled) setClassesLoaded(true);
          return;
        }
        const json: DashboardData = await res.json();
        if (!cancelled) {
          setClasses(json.classes);
          setClassesLoaded(true);
        }
      } catch {
        if (!cancelled) setClassesLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  const programs = useMemo(() => deriveTeacherPrograms(classes), [classes]);

  // If the current scope isn't present in the teacher's program set —
  // e.g. classes loaded and scope is a stale ProgramId from a previous
  // roster — snap back to "all". Avoids a phantom chip label.
  useEffect(() => {
    if (scope === "all") return;
    if (!classesLoaded) return;
    if (!programs.some((p) => p.id === scope)) setScope("all");
  }, [scope, programs, classesLoaded]);

  const ctx = useMemo(
    () => ({ classes, programs, scope, setScope, classesLoaded }),
    [classes, programs, scope, classesLoaded],
  );

  return (
    <TeacherShellContext.Provider value={ctx}>
      <div
        className={`${manrope.variable} ${dmSans.variable} tl-v2 min-h-screen`}
      >
        <TopNav
          teacher={teacher}
          classes={classes}
          scope={scope}
          onScope={setScope}
          pathname={pathname}
        />
        {children}
      </div>
    </TeacherShellContext.Provider>
  );
}
