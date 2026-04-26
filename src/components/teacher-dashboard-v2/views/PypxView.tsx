"use client";

/* PYPX Exhibition teacher view — first alternate dashboard model.
 *
 * Swaps in when scope === "pypx". Still consuming the same
 * DashboardViewProps as the default view so the client doesn't care;
 * this is where PYPX-specific sections land.
 *
 * v1 scope — ship the model-switch pattern with distinctive PYPX
 * visuals. Later phases can add real Exhibition fields (exhibitionDate,
 * centralIdea per student, phase per student) once the data layer
 * grows. For now we:
 *
 *   - Render a purple-gradient Exhibition banner with a countdown
 *     (term_end is not on DashboardClass so we use a placeholder +
 *     class count for now).
 *   - Render a 5-phase PYP inquiry strip (Wonder → Find out → Make →
 *     Share → Reflect), with aggregate class position inferred from
 *     average completion %. PYP Exhibition phases per the programme's
 *     Enhanced PYP framework.
 *   - Reuse the existing Insights + UnitsGrid + Admin sections so
 *     grading / stuck-students / empty-classes surfaces still work.
 *
 * Reference: docs/newlook/PYPX Student Dashboard/pypx_dashboard.jsx —
 * student-facing mock. The teacher view is a different animal
 * (class-level), but borrows the phase vocabulary + visual DNA.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Admin } from "../Admin";
import { Insights } from "../Insights";
import { UnitsGrid } from "../UnitsGrid";
import type { DashboardViewProps } from "./types";

const PYPX_PHASES = [
  { id: "wonder",  label: "Wonder",    sub: "Pick the question",      color: "#FBBF24" },
  { id: "findout", label: "Find out",  sub: "Research · experts",     color: "#3B82F6" },
  { id: "make",    label: "Make",      sub: "Build the action",       color: "#14B8A6" },
  { id: "share",   label: "Share",     sub: "Exhibition",             color: "#FF3366" },
  { id: "reflect", label: "Reflect",   sub: "What did we learn",      color: "#8B2FC9" },
];

/** Map a 0-100 completion percentage to one of the 5 PYP Exhibition
 *  phases. Rough approximation — 20% buckets. */
function bucketToPhase(pct: number): number {
  if (pct < 20) return 0;
  if (pct < 40) return 1;
  if (pct < 60) return 2;
  if (pct < 80) return 3;
  return 4;
}

export function PypxView({
  classes,
  insightBuckets,
  unitCards,
  dashboardLoaded,
}: DashboardViewProps) {
  // Aggregate class completion % — average of unit completionPcts
  // weighted by student count. If no classes yet, falls back to 0.
  const totals = classes.reduce(
    (acc, c) => {
      const avgUnitPct =
        c.units.length > 0
          ? c.units.reduce((s, u) => s + u.completionPct, 0) / c.units.length
          : 0;
      acc.weightedSum += avgUnitPct * c.studentCount;
      acc.totalStudents += c.studentCount;
      acc.totalClasses += 1;
      return acc;
    },
    { weightedSum: 0, totalStudents: 0, totalClasses: 0 },
  );
  const overallPct =
    totals.totalStudents > 0
      ? Math.round(totals.weightedSum / totals.totalStudents)
      : 0;
  const currentPhaseIdx = bucketToPhase(overallPct);

  // Hero year — calendar year for now. Once exhibition_config flows
  // into the dashboard payload, prefer the year from exhibition_date
  // (so a January 2027 exhibition renders "2027 Exhibition" even when
  // teachers are setting up in late 2026).
  const exhibitionYear = new Date().getFullYear();

  // Setup popover — anchored to the cog button on the hero. Dismisses
  // on outside click + Escape so it behaves like a normal menu without
  // pulling in a popover library.
  const [setupOpen, setSetupOpen] = useState(false);
  const setupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!setupOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (
        setupRef.current &&
        !setupRef.current.contains(e.target as Node)
      ) {
        setSetupOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSetupOpen(false);
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [setupOpen]);

  return (
    <>
      {/* Exhibition banner — purple gradient, Bold type. Replaces the
       *  MYP hero entirely. Setup is hidden behind a cog top-right
       *  (popover with one tile per class) so the hero stays focused
       *  on identity + headline status; the 5-phase strip below
       *  carries the live state. */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div
          className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg p-6 md:p-8 lg:p-10"
          style={{
            background:
              "linear-gradient(135deg, #7B2FF2 0%, #9333EA 45%, #C026D3 100%)",
          }}
        >
          {/* decorative dots — kept as a subtle accent behind everything. */}
          <svg
            className="absolute top-0 right-0 opacity-10 pointer-events-none"
            width="340"
            height="220"
            viewBox="0 0 340 220"
            aria-hidden
          >
            <circle cx="270" cy="50" r="80" fill="#fff" />
            <circle cx="310" cy="170" r="36" fill="#fff" />
            <circle cx="190" cy="24" r="18" fill="#fff" />
          </svg>

          {/* Setup cog — top-right of hero. Opens a popover listing each
           *  PYP class with a link to its Exhibition setup page. Hidden
           *  if there are no classes yet (nothing to set up). */}
          {classes.length > 0 && (
            <div ref={setupRef} className="absolute top-4 right-4 lg:top-6 lg:right-6 z-10">
              <button
                type="button"
                onClick={() => setSetupOpen((o) => !o)}
                aria-expanded={setupOpen}
                aria-haspopup="menu"
                aria-label="Exhibition setup"
                className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-white/60"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>

              {setupOpen && (
                <div
                  role="menu"
                  className="absolute top-12 right-0 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white shadow-2xl border border-black/5 p-2"
                >
                  <div className="px-3 py-2 text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-[var(--ink-3)]">
                    Exhibition setup
                  </div>
                  <div className="flex flex-col gap-1">
                    {classes.map((c) => {
                      const needsUnit = c.units.length === 0;
                      return (
                        <Link
                          key={c.id}
                          role="menuitem"
                          href={`/teacher/classes/${c.id}/exhibition`}
                          onClick={() => setSetupOpen(false)}
                          className="group flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-purple-50 transition"
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white text-[14px]"
                            style={{
                              background:
                                "linear-gradient(135deg, #9333EA 0%, #C026D3 100%)",
                            }}
                            aria-hidden
                          >
                            🌱
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-bold text-[var(--ink)] truncate">
                              {c.name}
                            </div>
                            <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5">
                              {needsUnit
                                ? "Needs a unit"
                                : `${c.studentCount} student${c.studentCount === 1 ? "" : "s"}`}
                            </div>
                          </div>
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="text-[var(--ink-3)] group-hover:text-purple-700 transition shrink-0"
                          >
                            <path d="M5 12h14M13 6l6 6-6 6" />
                          </svg>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="relative text-white max-w-3xl pr-14 lg:pr-16">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
              PYPX · Exhibition
            </div>
            <h1 className="display-lg text-[44px] sm:text-[56px] md:text-[72px] lg:text-[80px] leading-[0.95] mt-4">
              {exhibitionYear} Exhibition.
            </h1>
            <p className="text-[15px] md:text-[18px] leading-snug mt-3 text-white/85 font-medium">
              {totals.totalClasses} class{totals.totalClasses === 1 ? "" : "es"}{" "}
              · {totals.totalStudents} student
              {totals.totalStudents === 1 ? "" : "s"} · tracking towards
              Exhibition day.
            </p>
          </div>
        </div>
      </section>

      {/* 5-phase PYP Exhibition strip — class-level position. */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-8 md:pt-10">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="cap text-[var(--ink-3)]">
              Exhibition · Inquiry journey
            </div>
            <h2 className="display text-[24px] lg:text-[32px] leading-none mt-1">
              Phase {currentPhaseIdx + 1} of {PYPX_PHASES.length}.
            </h2>
          </div>
          <div className="text-right">
            <div className="cap text-[var(--ink-3)]">Overall</div>
            <div className="display text-[28px] lg:text-[32px] leading-none tnum mt-1">
              {overallPct}%
            </div>
          </div>
        </div>
        <div className="bg-white rounded-3xl border border-[var(--hair)] p-5 md:p-6">
          <div className="relative">
            <div className="absolute left-0 right-0 top-[20px] h-1.5 bg-[var(--hair)] rounded-full" />
            <div
              className="absolute left-0 top-[20px] h-1.5 rounded-full transition-all"
              style={{
                width: `${(currentPhaseIdx / (PYPX_PHASES.length - 1)) * 100}%`,
                background: "linear-gradient(90deg, #FBBF24, #9333EA)",
              }}
            />
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${PYPX_PHASES.length}, 1fr)`,
              }}
            >
              {PYPX_PHASES.map((p, i) => {
                const isDone = i < currentPhaseIdx;
                const isCur = i === currentPhaseIdx;
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center text-center px-1"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-white ring-4 ring-white transition ${
                        isDone || isCur ? "shadow-md" : ""
                      }`}
                      style={{
                        background: isDone
                          ? "#10B981"
                          : isCur
                            ? p.color
                            : "#E8E6DF",
                        color: isDone || isCur ? "#fff" : "#9CA3AF",
                      }}
                    >
                      {isDone ? "✓" : i + 1}
                    </div>
                    <div
                      className={`mt-2 text-[12px] font-extrabold ${
                        isCur ? "text-[var(--ink)]" : "text-[var(--ink-2)]"
                      }`}
                    >
                      {p.label}
                    </div>
                    <div className="text-[10.5px] text-[var(--ink-3)] mt-0.5 max-w-[110px] leading-tight">
                      {p.sub}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Reuse the shared sections — teacher still needs grading +
       *  stuck students + class housekeeping regardless of program. */}
      <Insights buckets={insightBuckets} loaded={dashboardLoaded} />
      <UnitsGrid cards={unitCards} loaded={dashboardLoaded} />
      <Admin classes={classes} loaded={dashboardLoaded} />
    </>
  );
}
