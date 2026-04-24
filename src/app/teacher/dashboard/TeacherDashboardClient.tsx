"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard body.
 *
 * Phase 1-10 built the dashboard sections; Phase 11 pushed the Bold
 * chrome (TopNav + scoped CSS + scope state + class fetch) up into
 * `src/app/teacher/layout.tsx` via TeacherShell so every teacher
 * route renders under the same navigation. This file is now just the
 * dashboard *body*: hero, rail, insights, units, admin.
 * ================================================================ */

import { useEffect, useMemo, useState } from "react";
import { Admin } from "@/components/teacher-dashboard-v2/Admin";
import { Insights } from "@/components/teacher-dashboard-v2/Insights";
import { NowHero } from "@/components/teacher-dashboard-v2/NowHero";
import { TodayRail } from "@/components/teacher-dashboard-v2/TodayRail";
import { UnitsGrid } from "@/components/teacher-dashboard-v2/UnitsGrid";
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
import { useTeacherShell } from "@/components/teacher-dashboard-v2/TeacherShellContext";
import { filterClassesByScope } from "@/components/teacher-dashboard-v2/program";
import type {
  DashboardData,
  DashboardClass,
  DashboardInsight,
  UnmarkedWorkItem,
} from "@/types/dashboard";

export default function TeacherDashboardClient() {
  const { teacher } = useTeacher();
  const { scope } = useTeacherShell();
  const [classes, setClasses] = useState<DashboardClass[]>([]);
  const [unmarkedWork, setUnmarkedWork] = useState<UnmarkedWorkItem[]>([]);
  const [insights, setInsights] = useState<DashboardInsight[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null);
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [scheduleLoaded, setScheduleLoaded] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Dashboard fetch. Yes, TeacherShell also hits /api/teacher/dashboard
  // for the class list — accept the duplicate for now; consolidation
  // will happen alongside the Phase 12 program-scope rollout when
  // we'll lift dashboard data into shared context.
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

  // Phase 12 — narrow all four body sections to the selected program.
  // The scope chip writes to TeacherShell; everything below reads the
  // filtered roster so hero/rail/insights/units/admin all agree.
  const filteredClasses = useMemo(
    () => filterClassesByScope(classes, scope),
    [classes, scope],
  );
  const filteredClassIds = useMemo(
    () => new Set(filteredClasses.map((c) => c.id)),
    [filteredClasses],
  );
  const filteredUnmarkedWork = useMemo(
    () => unmarkedWork.filter((w) => filteredClassIds.has(w.classId)),
    [unmarkedWork, filteredClassIds],
  );
  const filteredInsights = useMemo(() => {
    if (insights === null) return null;
    if (scope === "all") return insights;
    // DashboardInsight carries subtitle like "Student · Class Name · Unit".
    // We don't have classId on the insight row itself, so we match by
    // class name contained in the subtitle. Imperfect but reasonable
    // for a v1 filter.
    const allowedNames = new Set(filteredClasses.map((c) => c.name));
    return insights.filter((i) =>
      Array.from(allowedNames).some((n) => i.subtitle.includes(` · ${n} · `)),
    );
  }, [insights, filteredClasses, scope]);

  const currentPeriod = useMemo(() => {
    if (!schedule) return null;
    return resolveCurrentPeriod(
      schedule,
      filteredClasses,
      filteredUnmarkedWork,
      now,
    );
  }, [schedule, filteredClasses, filteredUnmarkedWork, now]);

  const railCards = useMemo(() => {
    if (!schedule) return [];
    const all = buildTodayRail(schedule, filteredClasses, filteredUnmarkedWork, now);
    // buildTodayRail maps every schedule entry → a card, even ones
    // whose class isn't in the filtered roster (student counts come
    // from the `classes` param; meetings come from the schedule). Drop
    // rail cards that aren't in the selected program.
    return all.filter((c) => filteredClassIds.has(c.classId));
  }, [schedule, filteredClasses, filteredClassIds, filteredUnmarkedWork, now]);

  const insightBuckets = useMemo(() => {
    if (filteredInsights === null) return [];
    return buildInsightBuckets(filteredInsights);
  }, [filteredInsights]);

  const unitCards = useMemo(
    () => buildUnitCards(filteredClasses, filteredUnmarkedWork),
    [filteredClasses, filteredUnmarkedWork],
  );

  const allLoaded = dashboardLoaded && scheduleLoaded;
  const showWelcome = allLoaded && classes.length === 0;

  if (!allLoaded) return <DashboardSkeleton />;
  if (showWelcome) return <NoClassesWelcome teacherName={teacher?.name ?? ""} />;

  return (
    <>
      {/* Hero + today rail share the same row on lg+ (2/3 + 1/3 split)
       *  so the huge hero doesn't push the rail below the fold on
       *  wide screens. Stacks as two blocks below lg. */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          <div className="lg:col-span-2">
            <NowHero current={currentPeriod} loaded={scheduleLoaded} />
          </div>
          <div className="lg:col-span-1">
            <TodayRail cards={railCards} now={now} loaded={scheduleLoaded} />
          </div>
        </div>
      </section>
      <Insights buckets={insightBuckets} loaded={dashboardLoaded} />
      <UnitsGrid cards={unitCards} loaded={dashboardLoaded} />
      <Admin classes={filteredClasses} loaded={dashboardLoaded} />
    </>
  );
}
