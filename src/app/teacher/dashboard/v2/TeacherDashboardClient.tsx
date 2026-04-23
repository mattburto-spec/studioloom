"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard (Phase 1 scaffold).
 *
 * Phase 1 status: mock data only. Sections are the same ones declared
 * in docs/projects/teacher-dashboard-v1.md. Each will be wired to real
 * data in its own phase (2-7). Cutover at Phase 8.
 * ================================================================ */

import { useState } from "react";
import { Admin } from "@/components/teacher-dashboard-v2/Admin";
import { Insights } from "@/components/teacher-dashboard-v2/Insights";
import { NowHero } from "@/components/teacher-dashboard-v2/NowHero";
import { TodayRail } from "@/components/teacher-dashboard-v2/TodayRail";
import { TopNav } from "@/components/teacher-dashboard-v2/TopNav";
import { UnitsGrid } from "@/components/teacher-dashboard-v2/UnitsGrid";
import { useScopedStyles } from "@/components/teacher-dashboard-v2/styles";

export default function TeacherDashboardClient() {
  useScopedStyles();
  const [scope, setScope] = useState<string>("all");

  return (
    <div className="tl-v2 min-h-screen">
      <TopNav scope={scope} onScope={setScope} />
      <NowHero />
      <TodayRail />
      <Insights />
      <UnitsGrid />
      <Admin />
    </div>
  );
}
