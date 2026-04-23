"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard.
 *
 * Phase 2 (wired): TopNav pulls teacher + classes from
 *   TeacherContext + /api/teacher/dashboard. Scope chip drives
 *   a class-filter. Nav pills link to real routes with active
 *   highlight. Avatar initials from teacher.name.
 *
 * Phases 3A-7 (pending): NowHero, TodayRail, Insights, UnitsGrid,
 *   Admin — still mock data for now.
 * ================================================================ */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Admin } from "@/components/teacher-dashboard-v2/Admin";
import { Insights } from "@/components/teacher-dashboard-v2/Insights";
import { NowHero } from "@/components/teacher-dashboard-v2/NowHero";
import { TodayRail } from "@/components/teacher-dashboard-v2/TodayRail";
import { TopNav } from "@/components/teacher-dashboard-v2/TopNav";
import { UnitsGrid } from "@/components/teacher-dashboard-v2/UnitsGrid";
import { useScopedStyles } from "@/components/teacher-dashboard-v2/styles";
import { useTeacher } from "@/app/teacher/teacher-context";
import type { DashboardData, DashboardClass } from "@/types/dashboard";

export default function TeacherDashboardClient() {
  useScopedStyles();

  const { teacher } = useTeacher();
  const pathname = usePathname();
  const [scope, setScope] = useState<string>("all");
  const [classes, setClasses] = useState<DashboardClass[]>([]);

  // Load class list from the existing dashboard endpoint. Phase 3A
  // introduces a new current-period endpoint for hero/rail data.
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
        // Silent — Phase 9 adds error surfaces. For now the chip just
        // stays on "All classes" if the fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  return (
    <div className="tl-v2 min-h-screen">
      <TopNav
        teacher={teacher}
        classes={classes}
        scope={scope}
        onScope={setScope}
        pathname={pathname}
      />
      <NowHero />
      <TodayRail />
      <Insights />
      <UnitsGrid />
      <Admin />
    </div>
  );
}
