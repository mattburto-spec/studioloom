"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard.
 *
 * Phase 1-8 built + cut over to production. Phase 9 (this commit)
 * added loading skeletons + empty states: no more flash-of-mock on
 * first render, dedicated welcome state for new teachers with zero
 * classes, and proper "nothing here" states per section.
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
  DashboardSkeleton,
  NoClassesWelcome,
} from "@/components/teacher-dashboard-v2/empty-states";
import {
  buildTodayRail,
  resolveCurrentPeriod,
  type ScheduleResponse,
} from "@/components/teacher-dashboard-v2/current-period";
import { useTeacher } from "@/app/teacher/teacher-context";
import { buildInsightBuckets } from "@/components/teacher-dashboard-v2/insight-buckets";
import { buildUnitCards } from "@/components/teacher-dashboard-v2/unit-cards";
import type {
  DashboardData,
  DashboardClass,
  DashboardInsight,
  UnmarkedWorkItem,
} from "@/types/dashboard";

export default function TeacherDashboardClient() {
  useScopedStyles();

  const { teacher } = useTeacher();
  const pathname = usePathname();
  const [scope, setScope] = useState<string>("all");
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [unmarkedWork, setUnmarkedWork] = useState<UnmarkedWorkItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsight[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
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
        if (!res.ok) {
          if (!cancelled) setDashboardLoaded(true);
          return;
        }
        const json: DashboardData = await res.json();
        if (!cancelled) {
          setClasses(json.classes);
          setUnmarkedWork(json.unmarkedWork ?? []);
          setInsights(json.insights ?? []);
          setDashboardLoaded(true);
        }
      } catch {
        if (!cancelled) setDashboardLoaded(true);
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
        if (!res.ok) {
          if (!cancelled) setScheduleLoaded(true);
          return;
        }
        const json: ScheduleResponse = await res.json();
        if (!cancelled) {
          setSchedule(json);
          setScheduleLoaded(true);
        }
      } catch {
        if (!cancelled) setScheduleLoaded(true);
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

  const railCards = useMemo(() => {
    if (!schedule) return [];
    return buildTodayRail(schedule, classes, unmarkedWork, now);
  }, [schedule, classes, unmarkedWork, now]);

  const insightBuckets = useMemo(() => {
    if (insights === null) return [];
    return buildInsightBuckets(insights);
  }, [insights]);

  const unitCards = useMemo(
    () => buildUnitCards(classes, unmarkedWork),
    [classes, unmarkedWork],
  );

  // The whole page hinges on both fetches having resolved. While
  // either is pending we render the page-level skeleton below the
  // TopNav — the hydrated chrome is fine to show immediately.
  const allLoaded = dashboardLoaded && scheduleLoaded;
  // "Brand new teacher" state: fetches done, still no classes.
  const showWelcome = allLoaded && classes.length === 0;

  return (
    <div className="tl-v2 min-h-screen">
      <TopNav
        teacher={teacher}
        classes={classes}
        scope={scope}
        onScope={setScope}
        pathname={pathname}
      />
      {!allLoaded ? (
        <DashboardSkeleton />
      ) : showWelcome ? (
        <NoClassesWelcome teacherName={teacher?.name ?? ""} />
      ) : (
        <>
          <NowHero current={currentPeriod} loaded={scheduleLoaded} />
          <TodayRail cards={railCards} now={now} loaded={scheduleLoaded} />
          <Insights buckets={insightBuckets} loaded={dashboardLoaded} />
          <UnitsGrid cards={unitCards} loaded={dashboardLoaded} />
          <Admin classes={classes} loaded={dashboardLoaded} />
        </>
      )}
    </div>
  );
}
