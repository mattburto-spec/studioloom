"use client";

/* PYPX Exhibition teacher view — Phase 13b rebuild.
 *
 * Drops the v1 placeholder (year-based hero + completion-% phase
 * strip) and consumes /api/teacher/pypx-cohort for real data:
 *
 *   - Hero shows class name + exhibition year badge, "Exhibition in
 *     N days" countdown, formatted date + roster summary, plus
 *     COHORT AVG / NEED ATTENTION / AHEAD metric block top-right
 *     and a 5-segment phase distribution bar at the bottom.
 *   - Below the hero: student card grid (one card per enrolled
 *     student) with avatar + project title + phase pill + progress
 *     bar + mentor + tasks summary + status pill.
 *   - Filter chips + Cards/Table/By-phase view toggle are deferred
 *     to a polish pass.
 *   - Insights / UnitsGrid / Admin still render below — teacher
 *     still needs cross-class housekeeping regardless of program.
 *
 * Class+unit selection: picks the first PYP class with an active
 * unit. Multi-PYP-class switcher is a polish item once Matt has
 * more than one Year-5 class to need it.
 *
 * Reference mockup: docs/newlook/PYPX Teacher Dashboard mockup
 * (handed off via screenshot, this commit follows it).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Admin } from "../Admin";
import { Insights } from "../Insights";
import { UnitsGrid } from "../UnitsGrid";
import type { DashboardViewProps } from "./types";

// ────────────────────────────────────────────────────────────────
// Types — mirror /api/teacher/pypx-cohort response shape.
// ────────────────────────────────────────────────────────────────

type Phase = "wonder" | "findout" | "make" | "share" | "reflect";
type Status = "on_track" | "needs_attention" | "ahead";

interface CohortStudent {
  id: string;
  displayName: string;
  avatarInitials: string;
  projectTitle: string | null;
  centralIdea: string | null;
  transdisciplinaryTheme: string | null;
  mentorId: string | null;
  mentorName: string | null;
  mentorInitials: string | null;
  progressPct: number;
  completedPages: number;
  totalPages: number;
  currentPhase: Phase;
  lastActivityAt: string | null;
  daysSinceActivity: number | null;
  status: Status;
  statusReason?: string;
}

interface CohortResponse {
  exhibitionDate: string | null;
  daysUntilExhibition: number | null;
  cohortAvgPct: number;
  needsAttentionCount: number;
  aheadCount: number;
  phaseDistribution: Record<Phase, number>;
  totalStudents: number;
  totalPages: number;
  students: CohortStudent[];
}

// ────────────────────────────────────────────────────────────────
// Phase + status presentation maps.
// ────────────────────────────────────────────────────────────────

const PHASE_META: Record<
  Phase,
  { label: string; color: string; index: number }
> = {
  wonder:  { label: "Wonder",   color: "#FBBF24", index: 1 },
  findout: { label: "Find out", color: "#3B82F6", index: 2 },
  make:    { label: "Make",     color: "#14B8A6", index: 3 },
  share:   { label: "Share",    color: "#FF3366", index: 4 },
  reflect: { label: "Reflect",  color: "#8B2FC9", index: 5 },
};

const PHASE_ORDER: Phase[] = ["wonder", "findout", "make", "share", "reflect"];

function formatExhibitionDate(iso: string): string {
  // "Thu 21 May" — short weekday + day + short month, no year (year
  // already in the badge).
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatActivity(daysSince: number | null): string {
  if (daysSince == null) return "No activity yet";
  if (daysSince === 0) return "Today";
  if (daysSince === 1) return "Yesterday";
  if (daysSince < 7) return `${daysSince} days ago`;
  if (daysSince < 14) return "A week ago";
  return `${daysSince} days ago`;
}

// ────────────────────────────────────────────────────────────────
// Main view
// ────────────────────────────────────────────────────────────────

export function PypxView({
  classes,
  insightBuckets,
  unitCards,
  dashboardLoaded,
}: DashboardViewProps) {
  // Pick the first PYP class with an active unit. Multi-class switcher
  // is deferred — most schools have one Year 5 class running PYPX.
  const primary = useMemo(() => {
    for (const c of classes) {
      const u = c.units[0];
      if (u) {
        return {
          classId: c.id,
          className: c.name,
          unitId: u.unitId,
        };
      }
    }
    return null;
  }, [classes]);

  const [cohort, setCohort] = useState<CohortResponse | null>(null);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [cohortError, setCohortError] = useState<string | null>(null);

  useEffect(() => {
    if (!primary) {
      setCohort(null);
      return;
    }
    let cancelled = false;
    setCohortLoading(true);
    setCohortError(null);
    fetch(
      `/api/teacher/pypx-cohort?classId=${primary.classId}&unitId=${primary.unitId}`,
    )
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as CohortResponse;
      })
      .then((data) => {
        if (!cancelled) setCohort(data);
      })
      .catch((err) => {
        if (!cancelled) setCohortError(String(err));
      })
      .finally(() => {
        if (!cancelled) setCohortLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [primary]);

  // Derived hero content
  const exhibitionYear = cohort?.exhibitionDate
    ? new Date(cohort.exhibitionDate + "T00:00:00").getFullYear()
    : new Date().getFullYear();

  const headline = useMemo(() => {
    if (!cohort) return "Loading…";
    if (cohort.daysUntilExhibition == null) {
      return "Exhibition date not set";
    }
    if (cohort.daysUntilExhibition > 0) {
      return (
        <>
          Exhibition in{" "}
          <span style={{ color: "#FBBF24" }}>
            {cohort.daysUntilExhibition}{" "}
            {cohort.daysUntilExhibition === 1 ? "day" : "days"}
          </span>
          .
        </>
      );
    }
    if (cohort.daysUntilExhibition === 0) return "Exhibition is today 🎉";
    return `Exhibition was ${Math.abs(cohort.daysUntilExhibition)} days ago`;
  }, [cohort]);

  const subtitle = useMemo(() => {
    if (!cohort) return null;
    const dateBit = cohort.exhibitionDate
      ? formatExhibitionDate(cohort.exhibitionDate)
      : null;
    const studentsBit = `${cohort.totalStudents} student${
      cohort.totalStudents === 1 ? "" : "s"
    } across 5 phases`;
    return [dateBit, studentsBit].filter(Boolean).join(" · ");
  }, [cohort]);

  // Setup popover (cog top-right of hero)
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
      {/* Hero — gradient banner with badge, countdown, subtitle,
       *  metrics block top-right, and phase distribution bar at the
       *  bottom. */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
        <div
          className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg p-6 md:p-8 lg:p-10"
          style={{
            background:
              "linear-gradient(135deg, #7B2FF2 0%, #9333EA 45%, #C026D3 100%)",
          }}
        >
          {/* decorative dots */}
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

          {/* Top row: badge (left) + metrics + cog (right) */}
          <div className="relative flex items-start justify-between gap-4 flex-wrap mb-6">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold text-white">
              {primary?.className
                ? `${primary.className} · PYPX ${exhibitionYear}`
                : `PYPX ${exhibitionYear}`}
            </div>

            {/* Metrics + cog */}
            <div className="flex items-start gap-5 md:gap-7 text-white">
              {cohort && (
                <>
                  <Metric label="Cohort avg" value={`${cohort.cohortAvgPct}%`} />
                  <Metric
                    label="Need attention"
                    value={cohort.needsAttentionCount}
                    valueColor="#FF6B8A"
                  />
                  <Metric
                    label="Ahead"
                    value={cohort.aheadCount}
                    valueColor="#34D399"
                  />
                </>
              )}

              {classes.length > 0 && (
                <div ref={setupRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setSetupOpen((o) => !o)}
                    aria-expanded={setupOpen}
                    aria-haspopup="menu"
                    aria-label="Exhibition setup"
                    className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur text-white flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-white/60 mt-1"
                  >
                    <svg
                      width="16"
                      height="16"
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
                      className="absolute top-11 right-0 w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-white shadow-2xl border border-black/5 p-2 z-20"
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
            </div>
          </div>

          {/* Headline + subtitle */}
          <div className="relative text-white max-w-3xl">
            <h1 className="display-lg text-[44px] sm:text-[56px] md:text-[72px] lg:text-[80px] leading-[0.95]">
              {headline}
            </h1>
            {subtitle && (
              <p className="text-[15px] md:text-[18px] leading-snug mt-3 text-white/85 font-medium">
                {subtitle}
              </p>
            )}
          </div>

          {/* Phase distribution bar */}
          {cohort && cohort.totalStudents > 0 && (
            <div className="relative mt-7">
              <PhaseDistributionBar distribution={cohort.phaseDistribution} />
            </div>
          )}
        </div>
      </section>

      {/* Student card grid */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-8 md:pt-10">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="cap text-[var(--ink-3)]">Cohort</div>
            <h2 className="display text-[24px] lg:text-[32px] leading-none mt-1">
              {cohort
                ? `All ${cohort.totalStudents} student${cohort.totalStudents === 1 ? "" : "s"}.`
                : "Loading…"}
            </h2>
          </div>
        </div>

        {cohortLoading && !cohort && <CardGridSkeleton />}

        {cohortError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl px-4 py-3 text-sm">
            Couldn&apos;t load cohort data: {cohortError}
          </div>
        )}

        {cohort && cohort.students.length === 0 && !cohortLoading && (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <div className="text-3xl mb-2">👥</div>
            <h3 className="text-base font-bold text-gray-900">
              No students enrolled yet
            </h3>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              Enrol students into{" "}
              {primary?.className ? (
                <span className="font-semibold">{primary.className}</span>
              ) : (
                "this class"
              )}{" "}
              first, then come back to see their projects here.
            </p>
          </div>
        )}

        {cohort && cohort.students.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cohort.students.map((s) => (
              <StudentCard key={s.id} student={s} />
            ))}
          </div>
        )}
      </section>

      {/* Reuse shared sections — teacher still needs grading +
       *  stuck students + class housekeeping regardless of program. */}
      <Insights buckets={insightBuckets} loaded={dashboardLoaded} />
      <UnitsGrid cards={unitCards} loaded={dashboardLoaded} />
      <Admin classes={classes} loaded={dashboardLoaded} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────

function Metric({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="text-right whitespace-nowrap">
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/70">
        {label}
      </div>
      <div
        className="display text-[28px] lg:text-[32px] leading-none tnum mt-1"
        style={{ color: valueColor ?? "white" }}
      >
        {value}
      </div>
    </div>
  );
}

function PhaseDistributionBar({
  distribution,
}: {
  distribution: Record<Phase, number>;
}) {
  const total = PHASE_ORDER.reduce((s, p) => s + distribution[p], 0);
  if (total === 0) return null;

  return (
    <div>
      <div className="flex h-7 rounded-full overflow-hidden border border-white/15">
        {PHASE_ORDER.map((p) => {
          const count = distribution[p];
          if (count === 0) return null;
          const widthPct = (count / total) * 100;
          return (
            <div
              key={p}
              className="flex items-center justify-center text-white text-[11px] font-extrabold"
              style={{
                width: `${widthPct}%`,
                background: PHASE_META[p].color,
              }}
              title={`${PHASE_META[p].label}: ${count}`}
            >
              {count}
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-5 mt-2 text-center">
        {PHASE_ORDER.map((p) => (
          <div
            key={p}
            className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/70"
          >
            {PHASE_META[p].label}
          </div>
        ))}
      </div>
    </div>
  );
}

// Avatar — coloured initials circle. Hashes the name to one of a small
// palette so the same student gets the same colour every render.
const AVATAR_PALETTE = [
  "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899",
  "#14B8A6", "#F97316", "#6366F1", "#22C55E", "#E11D48",
];

function colourFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function Avatar({
  initials,
  seed,
  size = 40,
}: {
  initials: string;
  seed: string;
  size?: number;
}) {
  const bg = colourFor(seed);
  return (
    <div
      className="rounded-full flex items-center justify-center font-extrabold text-white shrink-0"
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: size * 0.38,
      }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function StatusPill({
  status,
  reason,
}: {
  status: Status;
  reason?: string;
}) {
  const map: Record<Status, { label: string; bg: string; fg: string }> = {
    on_track:        { label: "On track",        bg: "#F0FDF4", fg: "#15803D" },
    needs_attention: { label: reason ?? "Needs attention", bg: "#FEE2E2", fg: "#B91C1C" },
    ahead:           { label: "Ahead",           bg: "#EFF6FF", fg: "#1D4ED8" },
  };
  const { label, bg, fg } = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10.5px] font-extrabold rounded-full px-2.5 py-1 max-w-[180px] truncate"
      style={{ background: bg, color: fg }}
      title={reason}
    >
      {status === "needs_attention" && <span aria-hidden>▸</span>}
      <span className="truncate">{label}</span>
    </span>
  );
}

function StudentCard({ student }: { student: CohortStudent }) {
  const phase = PHASE_META[student.currentPhase];
  return (
    <div
      className={`bg-white rounded-2xl border p-5 transition ${
        student.status === "needs_attention"
          ? "border-rose-200 shadow-[0_0_0_3px_rgba(254,202,202,0.4)]"
          : "border-gray-200"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <Avatar initials={student.avatarInitials} seed={student.id} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-extrabold text-gray-900 truncate">
            {student.displayName}
          </div>
          <div className="text-[12.5px] text-gray-500 mt-0.5 truncate">
            {student.projectTitle ?? (
              <span className="italic text-gray-400">
                Project not set yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10.5px] font-extrabold uppercase tracking-[0.08em] mb-1.5">
        <span style={{ color: phase.color }}>
          ● {phase.label} · Phase {phase.index}/5
        </span>
        <span className="text-gray-700 tnum">{student.progressPct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${student.progressPct}%`,
            background: phase.color,
          }}
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <span className="text-[10.5px] uppercase tracking-[0.08em] font-extrabold text-gray-400">
          Mentor
        </span>
        {student.mentorId && student.mentorInitials ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px]">
            <Avatar
              initials={student.mentorInitials}
              seed={student.mentorId}
              size={20}
            />
            <span className="font-semibold text-gray-700 truncate max-w-[120px]">
              {student.mentorName}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-rose-600">
            <span
              className="w-5 h-5 rounded-full border border-dashed border-rose-300 flex items-center justify-center text-[10px]"
              aria-hidden
            >
              ?
            </span>
            Unassigned
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="text-[12px] text-gray-500 truncate">
          {student.completedPages}/{student.totalPages} pages ·{" "}
          {formatActivity(student.daysSinceActivity)}
        </div>
        <StatusPill status={student.status} reason={student.statusReason} />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Coming with Mentor Manager"
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-purple-50 text-purple-700 text-[12px] font-bold opacity-60 cursor-not-allowed"
        >
          ✺ Suggest resource
        </button>
        <button
          type="button"
          disabled
          title="Per-student detail page coming next"
          className="px-4 py-2 rounded-full border border-gray-200 text-gray-700 text-[12px] font-bold opacity-60 cursor-not-allowed"
        >
          View
        </button>
      </div>
    </div>
  );
}

function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-200 p-5"
        >
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 bg-gray-200 rounded" />
                <div className="h-2 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
            <div className="flex gap-2">
              <div className="h-8 flex-1 bg-gray-100 rounded-full" />
              <div className="h-8 w-16 bg-gray-100 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
