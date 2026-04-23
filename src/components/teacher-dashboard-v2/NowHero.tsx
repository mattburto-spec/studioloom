"use client";

import Link from "next/link";
import { I } from "./icons";
import { NEXT } from "./mock-data";
import type { CurrentPeriod } from "./current-period";

interface NowHeroProps {
  /** Resolved current-or-next period. Null → renders the mock fallback
   *  so the hero always has something to show (blank space on a design-
   *  heavy hero looks broken). */
  current: CurrentPeriod | null;
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
  };
}

function fromMock(): HeroVM {
  return {
    periodLabel: NEXT.period,
    startTime: NEXT.time,
    startsInMin: NEXT.startsIn,
    state: "upcoming",
    room: NEXT.room,
    className: NEXT.class,
    color: NEXT.color,
    colorDark: NEXT.colorDark,
    unitId: null,
    unitTitle: NEXT.title,
    unitSub: NEXT.sub,
    phaseLabel: NEXT.phase,
    phasePct: NEXT.phasePct,
    img: NEXT.img,
  };
}

export function NowHero({ current }: NowHeroProps) {
  const vm = current ? fromCurrent(current) : fromMock();
  const teachHref = vm.unitId ? `/teacher/teach/${vm.unitId}` : null;

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
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div
        className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner"
        style={{ background: vm.color }}
      >
        <div className="grid grid-cols-12 gap-0 items-stretch">
          {/* Left: content */}
          <div className="col-span-7 p-10 flex flex-col justify-between text-white relative z-10">
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
              <h1 className="display-lg text-[108px] leading-[0.88] mt-6 text-white">
                {vm.unitTitle}.
              </h1>
              {vm.unitSub && (
                <p className="text-[22px] leading-snug mt-3 text-white/85 max-w-md font-medium">
                  {vm.unitSub}
                </p>
              )}
            </div>

            {/* Meta pills — class, phase, room, time. Ready/ungraded
             *  land in Phase 3B (needs completion + unmarked counts). */}
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
              {vm.unitId ? (
                <Link
                  href={`/teacher/units/${vm.unitId}`}
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
              <button className="text-white/70 hover:text-white rounded-full px-3 py-3 font-semibold text-[13px]">
                Skip →
              </button>
            </div>
          </div>

          {/* Right: image */}
          <div className="col-span-5 relative">
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
                  background: `linear-gradient(to right, ${vm.color} 0%, transparent 35%)`,
                }}
              />
            </div>
            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 card-shadow">
              <div className="cap text-[var(--ink-3)]">{vm.phaseLabel}</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div
                  className="display text-[32px] leading-none tnum"
                  style={{ color: vm.colorDark }}
                >
                  {vm.phasePct}%
                </div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  {current ? "complete" : "of developing ideas"}
                </div>
              </div>
              <div className="mt-2 w-40 h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${vm.phasePct}%`, background: vm.color }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
