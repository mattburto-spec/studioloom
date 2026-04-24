"use client";

/* ================================================================
 * TeacherDashboardClient — Bold teacher dashboard body.
 *
 * Phase 13 — data-loading + filtering stays here; the rendered body
 * comes from a per-scope view resolved at render time. DefaultView
 * (all-programs + Design) keeps the hero/rail/insights/units/admin
 * layout; PypxView (scope === "pypx") swaps in an Exhibition-themed
 * body. Adding Service / PP / Inquiry views is just: write the
 * component, drop it in views/registry.ts.
 * ================================================================ */

import { useEffect, useMemo, useState } from "react";
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
import { resolveDashboardView } from "@/components/teacher-dashboard-v2/views/registry";
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
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
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

  // Scope filter — all views see the same filtered input, so the chip
  // behaves consistently across programs.
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
    const all = buildTodayRail(
      schedule,
      filteredClasses,
      filteredUnmarkedWork,
      now,
    );
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

  const View = resolveDashboardView(scope);
  return (
    <View
      teacher={teacher}
      classes={filteredClasses}
      currentPeriod={currentPeriod}
      railCards={railCards}
      insightBuckets={insightBuckets}
      unitCards={unitCards}
      now={now}
      dashboardLoaded={dashboardLoaded}
      scheduleLoaded={scheduleLoaded}
    />
  );
}
