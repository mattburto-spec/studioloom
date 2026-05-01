"use client";

import Link from "next/link";
import { I } from "./icons";
import type { CurrentPeriod } from "./current-period";

interface NowHeroProps {
  /** Resolved current-or-next period. Null + loaded → "no class now"
   *  empty-state variant; null + still-loading → skeleton (rendered by
   *  the dashboard-level shell, so we just return null here). */
  current: CurrentPeriod | null;
  /** False while the schedule fetch is in flight. */
  loaded: boolean;
}

/** View-model NowHero renders. Keeps the mock + real-data branches
 *  converging on one shape so the JSX below stays single-pathed. */
interface HeroVM {
  periodLabel: string;
  startTime: string;
  startsInMin: number | null;
  state: "live" | "upcoming" | "later";
  room: string | null;
  className: string;
  color: string;
  colorDark: string;
  unitId: string | null;
  unitTitle: string;
  unitSub: string;
  phaseLabel: string;
  phasePct: number;
  img: string;
  studentCount: number;
  ungradedCount: number;
}

function fromCurrent(c: CurrentPeriod): HeroVM {
  return {
    periodLabel: c.periodLabel,
    startTime: c.startTime,
    startsInMin: c.startsInMin,
    state: c.state,
    room: c.room,
    className: c.className,
    color: c.classColor,
    colorDark: c.classColorDark,
    unitId: c.unitId,
    unitTitle: c.unitTitle,
    unitSub: "",
    phaseLabel: "Unit progress",
    phasePct: c.completionPct ?? 0,
    img: c.unitThumbnailUrl,
    studentCount: c.studentCount,
    ungradedCount: c.ungradedCount,
  };
}

/** "No class right now" hero — black background, nothing pulsing. */
function NoClassHero() {
  return (
    <div
      className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg p-6 md:p-8 lg:p-12 min-h-[240px] md:min-h-[280px] flex flex-col justify-center h-full"
      style={{ background: "#0A0A0A" }}
    >
        <div className="max-w-2xl text-white">
          <div className="cap text-white/60 mb-3">Nothing on now</div>
          <h1 className="display-lg text-[40px] sm:text-[48px] md:text-[56px] leading-[0.95]">
            Clear deck.
          </h1>
          <p className="text-[15px] md:text-[18px] leading-snug mt-3 text-white/75 font-medium">
            No class in session right now. Check your schedule for what&apos;s
            coming, or dip into planning.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link
              href="/teacher/units"
              className="bg-white text-[var(--ink)] rounded-full px-5 py-2.5 font-bold text-[13px]"
            >
              Plan a unit
            </Link>
            <Link
              href="/teacher/timetable"
              className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-4 py-2.5 font-bold text-[12.5px]"
            >
              View timetable
            </Link>
          </div>
        </div>
      </div>
  );
}

export function NowHero({ current, loaded }: NowHeroProps) {
  if (!loaded) return null;
  if (!current) return <NoClassHero />;
  const vm = fromCurrent(current);
  const teachHref = vm.unitId ? `/teacher/teach/${vm.unitId}` : null;
  // Class-local routes need both unitId + classId. The progress/edit
  // hrefs fall through to the unit-level page when classId is missing,
  // which is rare (schedule entries always carry classId — this is
  // mostly a type guard).
  const classId = current.classId;
  const planHref =
    vm.unitId && classId
      ? `/teacher/units/${vm.unitId}/class/${classId}/edit`
      : vm.unitId
        ? `/teacher/units/${vm.unitId}`
        : null;
  const progressHref =
    vm.unitId && classId
      ? `/teacher/units/${vm.unitId}/class/${classId}`
      : vm.unitId
        ? `/teacher/units/${vm.unitId}`
        : null;

  // Top-left status pill text.
  const statusPrefix =
    vm.state === "live" ? "Now on" : "Next up";
  const startsInText =
    vm.state === "live"
      ? " · in progress"
      : vm.startsInMin != null
        ? ` · starts in`
        : "";

  return (
    <div
      className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg glow-inner h-full"
      style={{ background: vm.color }}
    >
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-0 items-stretch">
          {/* Left: content */}
          <div className="lg:col-span-7 p-6 md:p-8 lg:p-10 flex flex-col justify-between text-white relative z-10 order-2 lg:order-1">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
                <span className="pulse" style={{ color: "#FFF" }} />
                {statusPrefix} · {vm.periodLabel}
                {startsInText}
                {vm.state !== "live" && vm.startsInMin != null && (
                  <span className="tnum font-extrabold ml-1">
                    {vm.startsInMin} min
                  </span>
                )}
              </div>
              {/* Auto-scale title: short unit names stay dramatic, long ones
               *  shrink so they're more likely to fit a single line. Same
               *  bucket approach as the student hero (DashboardClient.tsx
               *  ~line 628), tuned for the teacher hero's larger lg size.
               *
               *  Empty-state (30 Apr 2026 — FU-DASHBOARD-HERO-NULL-UNIT-TITLE):
               *  when no unit is assigned to the class (vm.unitId is null),
               *  render a meaningful prompt instead of a giant "—" which
               *  reads as colored bars at display sizes. */}
              {!vm.unitId ? (
                <div className="mt-4 md:mt-6">
                  <h1 className="display-lg text-[36px] sm:text-[48px] md:text-[56px] lg:text-[64px] leading-[0.95] text-white/90">
                    No unit assigned.
                  </h1>
                  <p className="text-[18px] leading-snug mt-3 text-white/70 max-w-md">
                    Pick a unit to teach this class — the hero will fill in.
                  </p>
                </div>
              ) : (() => {
                const len = vm.unitTitle.length;
                const sizeCls =
                  len > 22
                    ? "text-[36px] sm:text-[48px] md:text-[56px] lg:text-[64px]"
                    : len > 16
                      ? "text-[44px] sm:text-[60px] md:text-[72px] lg:text-[84px]"
                      : len > 10
                        ? "text-[48px] sm:text-[72px] md:text-[88px] lg:text-[100px]"
                        : "text-[48px] sm:text-[72px] md:text-[88px] lg:text-[108px]";
                return (
                  <h1
                    className={`display-lg ${sizeCls} leading-[0.88] mt-4 md:mt-6 text-white`}
                  >
                    {vm.unitTitle}.
                  </h1>
                );
              })()}
              {vm.unitSub && (
                <p className="text-[22px] leading-snug mt-3 text-white/85 max-w-md font-medium">
                  {vm.unitSub}
                </p>
              )}
            </div>

            {/* Meta pills — class, phase, students, ungraded, room+time. */}
            <div className="flex items-center gap-2 mt-8 flex-wrap">
              <span
                className="bg-white rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[12px] font-bold"
                style={{ color: vm.color }}
              >
                <span className="w-5 h-5 rounded-full bg-current opacity-20" />
                <span style={{ color: vm.colorDark }}>{vm.className}</span>
              </span>
              <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white">
                {vm.phaseLabel}
              </span>
              {vm.studentCount > 0 && (
                <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white tnum">
                  {vm.studentCount} student{vm.studentCount === 1 ? "" : "s"}
                </span>
              )}
              {vm.ungradedCount > 0 && (
                <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-3 py-1 text-[12px] font-extrabold tnum">
                  {vm.ungradedCount} to grade
                </span>
              )}
              {vm.room && (
                <span className="text-white/70 text-[12px] font-semibold ml-1">
                  Room {vm.room}
                  {vm.startTime && ` · ${vm.startTime}`}
                </span>
              )}
              {!vm.room && vm.startTime && (
                <span className="text-white/70 text-[12px] font-semibold ml-1">
                  {vm.startTime}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-6">
              {teachHref ? (
                <Link
                  href={teachHref}
                  className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition"
                >
                  <I name="play" size={12} s={0} /> Start teaching
                </Link>
              ) : (
                <button
                  className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition"
                  disabled
                >
                  <I name="play" size={12} s={0} /> Start teaching
                </button>
              )}
              {planHref ? (
                <Link
                  href={planHref}
                  className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]"
                >
                  Lesson plan
                </Link>
              ) : (
                <button
                  className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]"
                  disabled
                >
                  Lesson plan
                </button>
              )}
            </div>
          </div>

          {/* Right: image. On mobile/tablet it appears on top (order-1)
           *  as a banner, then the content flows below. */}
          <div className="lg:col-span-5 relative order-1 lg:order-2 h-48 sm:h-64 lg:h-auto">
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={vm.img}
                alt=""
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to bottom, transparent 60%, ${vm.color} 100%), linear-gradient(to right, ${vm.color} 0%, transparent 35%)`,
                }}
              />
            </div>
            {progressHref ? (
              <Link
                href={progressHref}
                className="absolute bottom-4 right-4 lg:bottom-6 lg:right-6 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 card-shadow hover:-translate-y-0.5 transition block"
                title="Open class progress"
              >
                <div className="cap text-[var(--ink-3)] flex items-center gap-1">
                  {vm.phaseLabel}
                  <I name="arrow" size={10} s={2.5} />
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <div
                    className="display text-[32px] leading-none tnum"
                    style={{ color: vm.colorDark }}
                  >
                    {vm.phasePct}%
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)]">
                    complete
                  </div>
                </div>
                <div className="mt-2 w-40 h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${vm.phasePct}%`, background: vm.color }}
                  />
                </div>
              </Link>
            ) : (
              <div className="absolute bottom-4 right-4 lg:bottom-6 lg:right-6 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 card-shadow">
                <div className="cap text-[var(--ink-3)]">{vm.phaseLabel}</div>
                <div className="flex items-baseline gap-2 mt-1">
                  <div
                    className="display text-[32px] leading-none tnum"
                    style={{ color: vm.colorDark }}
                  >
                    {vm.phasePct}%
                  </div>
                  <div className="text-[11px] text-[var(--ink-3)]">complete</div>
                </div>
                <div className="mt-2 w-40 h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${vm.phasePct}%`, background: vm.color }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

