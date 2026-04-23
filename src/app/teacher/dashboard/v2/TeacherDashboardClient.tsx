"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard.
 *
 * Phase 2 (wired):
 *   - TopNav pulls teacher + classes from TeacherContext +
 *     /api/teacher/dashboard.
 *
 * Phase 3A (wired):
 *   - NowHero consumes a resolved CurrentPeriod joined from
 *     /api/teacher/schedule/today (timetable + periods + entries)
 *     and /api/teacher/dashboard (unit thumbnails + completion %).
 *     Falls back to mock if the teacher has no timetable or no
 *     meetings today — blank hero would look broken.
 *
 * Phases 3B-7 (pending): hero ungraded/ready counts, TodayRail,
 *   Insights, UnitsGrid, Admin — still mock data.
 * ================================================================ */

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Admin } from "@/components/teacher-dashboard-v2/Admin";
import { Insights } from "@/components/teacher-dashboard-v2/Insights";
import { NowHero } from "@/components/teacher-dashboard-v2/NowHero";
import { TodayRail } from "@/components/teacher-dashboard-v2/TodayRail";
import { TopNav } from "@/components/teacher-dashboard-v2/TopNav";
import { UnitsGrid } from "@/components/teacher-dashboard-v2/UnitsGrid";
import { useScopedStyles } from "@/components/teacher-dashboard-v2/styles";
import {
  resolveCurrentPeriod,
  type ScheduleResponse,
} from "@/components/teacher-dashboard-v2/current-period";
import { useTeacher } from "@/app/teacher/teacher-context";
import type {
  DashboardData,
  DashboardClass,
  UnmarkedWorkItem,
} from "@/types/dashboard";

export default function TeacherDashboardClient() {
  useScopedStyles();

  const { teacher } = useTeacher();
  const pathname = usePathname();
  const [scope, setScope] = useState<string>("all");
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [unmarkedWork, setUnmarkedWork] = useState<UnmarkedWorkItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());

  // Re-pick the "current period" every minute so `startsIn`
  // counts down in-place without a full refetch.
  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Load class list from the existing dashboard endpoint.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/teacher/dashboard");
        if (!res.ok) return;
        const json: DashboardData = await res.json();
        if (!cancelled) {
          setClasses(json.classes);
          setUnmarkedWork(json.unmarkedWork ?? []);
        }
      } catch {
        // Phase 9 adds error surfaces. For now the chip stays on
        // "All classes" if the fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  // Load today's schedule with the browser's IANA timezone so the
  // server resolves "today" in the teacher's local clock, not UTC.
  useEffect(() => {
    if (!teacher) return;
    let cancelled = false;
    (async () => {
      try {
        const tz =
          Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const qs = new URLSearchParams({ days: "1" });
        if (tz) qs.set("tz", tz);
        const res = await fetch(`/api/teacher/schedule/today?${qs}`);
        if (!res.ok) return;
        const json: ScheduleResponse = await res.json();
        if (!cancelled) setSchedule(json);
      } catch {
        // Same graceful degradation — NowHero will render its mock
        // fallback if the resolver returns null.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  const currentPeriod = useMemo(() => {
    if (!schedule) return null;
    return resolveCurrentPeriod(schedule, classes, unmarkedWork, now);
  }, [schedule, classes, unmarkedWork, now]);

  return (
    <div className="tl-v2 min-h-screen">
      <TopNav
        teacher={teacher}
        classes={classes}
        scope={scope}
        onScope={setScope}
        pathname={pathname}
      />
      <NowHero current={currentPeriod} />
      <TodayRail />
      <Insights />
      <UnitsGrid />
      <Admin />
    </div>
  );
}
