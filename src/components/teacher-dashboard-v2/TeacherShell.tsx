"use client";

/* ================================================================
 * TeacherShell — Bold chrome wrapper used by every non-public,
 * non-chromeless teacher route.
 *
 * Loads the Manrope + DM Sans fonts, mounts the scoped `.tl-v2` CSS,
 * fetches the teacher's class list once at the layout level, and
 * renders the BoldTopNav above whatever children the route supplies.
 *
 * Phase 11 of the teacher-dashboard-v1 build (docs/projects/
 * teacher-dashboard-v1.md). Before this, only /teacher/dashboard
 * rendered the Bold chrome; every other teacher route got the legacy
 * sticky header. Now the layout is universal.
 * ================================================================ */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Manrope, DM_Sans } from "next/font/google";
import { TopNav } from "./TopNav";
import { useScopedStyles } from "./styles";
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
  const [scope, setScope] = useState<string>("all");

  // Class list for the scope chip. Fetched once per layout mount;
  // the dashboard page refetches its own richer /api/teacher/dashboard
  // payload independently (insights, unmarkedWork, etc.), so this
  // lightweight duplicate is the price of keeping the layout decoupled
  // from page-specific data. Non-dashboard pages pay for classes only.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/teacher/dashboard");
        if (!res.ok) return;
        const json: DashboardData = await res.json();
        if (!cancelled) setClasses(json.classes);
      } catch {
        // Silent — scope chip just stays on "All classes" if the
        // fetch fails; nothing else depends on this data at the
        // shell level (Phase 12 may).
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  return (
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
  );
}
