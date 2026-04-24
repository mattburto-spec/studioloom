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
  teacher,
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
  const firstName = teacher?.name?.trim().split(/\s+/)[0] || "there";

  return (
    <>
      {/* Exhibition setup CTA — always-visible strip guiding the teacher
       *  to each PYP class's setup page. First-time PYP teachers would
       *  otherwise have to discover the small "Exhibition" button buried
       *  inside each class detail page; this surfaces the setup route
       *  prominently on the main dashboard. Renders one card per PYP
       *  class the teacher currently has in scope. */}
      {classes.length > 0 && (
        <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
          <div className="bg-white rounded-2xl border border-[var(--hair)] p-5 md:p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="cap text-[var(--ink-3)]">Exhibition setup</div>
                <h2 className="display text-[22px] lg:text-[26px] leading-none mt-1">
                  Configure dates, mentors, and projects.
                </h2>
                <p className="text-[13px] text-[var(--ink-3)] mt-2 max-w-xl leading-snug">
                  Set the Exhibition date and milestones, then assign each
                  student a mentor and seed their project inquiry. Students
                  can take over their own entries once the PYPX student view
                  ships.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {classes.map((c) => {
                const needsUnit = c.units.length === 0;
                return (
                  <Link
                    key={c.id}
                    href={`/teacher/classes/${c.id}/exhibition`}
                    className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-[var(--hair)] hover:border-transparent hover:shadow-md transition bg-gradient-to-br from-white to-purple-50/40"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white font-extrabold text-[13px]"
                      style={{
                        background:
                          "linear-gradient(135deg, #9333EA 0%, #C026D3 100%)",
                      }}
                    >
                      🌱
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-bold text-[var(--ink)] truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-[var(--ink-3)] mt-0.5">
                        {needsUnit
                          ? "Needs a unit · set up →"
                          : `${c.studentCount} student${c.studentCount === 1 ? "" : "s"} · set up →`}
                      </div>
                    </div>
                    <svg
                      width="14"
                      height="14"
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
        </section>
      )}

      {/* Exhibition banner — purple gradient, Bold type. Replaces the
       *  MYP hero entirely. */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div
          className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg p-6 md:p-8 lg:p-12"
          style={{
            background:
              "linear-gradient(135deg, #7B2FF2 0%, #9333EA 45%, #C026D3 100%)",
          }}
        >
          {/* decorative dots */}
          <svg
            className="absolute top-0 right-0 opacity-15 pointer-events-none"
            width="340"
            height="220"
            viewBox="0 0 340 220"
            aria-hidden
          >
            <circle cx="270" cy="50" r="80" fill="#fff" />
            <circle cx="310" cy="170" r="36" fill="#fff" />
            <circle cx="190" cy="24" r="18" fill="#fff" />
          </svg>
          <div className="relative text-white max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
              PYPX · Exhibition
            </div>
            <h1 className="display-lg text-[56px] sm:text-[72px] md:text-[88px] leading-[0.95] mt-4 md:mt-6">
              {firstName}&apos;s Exhibition.
            </h1>
            <p className="text-[16px] md:text-[20px] leading-snug mt-3 md:mt-4 text-white/85 font-medium">
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
