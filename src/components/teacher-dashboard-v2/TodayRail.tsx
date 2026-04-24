"use client";

import Link from "next/link";
import { I } from "./icons";
import { SectionEmpty } from "./empty-states";
import type { RailCard } from "./current-period";

interface TodayRailProps {
  /** Real schedule cards. Empty + loaded → empty state banner. */
  cards: RailCard[];
  /** Wall-clock "today" used for the rail heading. */
  now: Date;
  /** False while the schedule fetch is still in flight. Dashboard-level
   *  skeleton covers that case — we just return null. */
  loaded: boolean;
}

function formatRailHeading(d: Date): string {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `Today · ${weekday} ${day} ${month}`;
}

/** Single compact rail card. Vertical footprint is ~96px (was ~170px
 *  in the pre-compaction Phase 4 layout) — block number inlines with
 *  the unit title, class/meta sits below, Manage button + ungraded
 *  chip in the footer. Progress bar dropped. */
function RailCardView({ c }: { c: RailCard }) {
  const isLive = c.state === "live";
  const isNext = c.state === "next";
  const isDone = c.state === "done";
  const manageHref =
    c.unitId && c.classId
      ? `/teacher/units/${c.unitId}/class/${c.classId}`
      : null;

  return (
    <div
      className={`relative rounded-2xl p-4 transition overflow-hidden ${
        isLive || isNext ? "ring-live" : ""
      } ${isDone ? "opacity-60" : ""}`}
      style={{
        background: c.tint,
        border: `1px solid ${c.color}22`,
      }}
    >
      {/* Top row: block number + title on the left, state pill + time
       *  stacked on the right. Two-line header keeps the block number
       *  visually tied to the unit it's for. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3 flex-1 min-w-0">
          <div
            className="display text-[28px] leading-none tnum shrink-0"
            style={{ color: c.color }}
          >
            {c.num}
          </div>
          <div className="display text-[16px] leading-tight text-[var(--ink)] truncate">
            {c.unitTitle}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isLive && (
            <span
              className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
              style={{ color: c.color }}
            >
              <span
                className="pulse"
                style={{ color: c.color, width: 5, height: 5 }}
              />
              LIVE
            </span>
          )}
          {isNext && (
            <span
              className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
              style={{ color: c.color }}
            >
              <span
                className="pulse"
                style={{ color: c.color, width: 5, height: 5 }}
              />
              NEXT
            </span>
          )}
          {isDone && (
            <span
              className="inline-flex items-center gap-1 bg-white/60 rounded-full px-2 py-0.5 text-[9.5px] font-extrabold"
              style={{ color: c.color }}
            >
              DONE
            </span>
          )}
          {c.time && (
            <span
              className="text-[11px] font-bold tnum"
              style={{ color: c.color }}
            >
              {c.time}
            </span>
          )}
        </div>
      </div>

      {/* Meta row: class name + student count, one line. */}
      <div className="mt-2 text-[11px] font-extrabold truncate" style={{ color: c.color }}>
        {c.className}
        <span className="font-bold text-[var(--ink-3)]">
          {" · "}
          {c.studentCount} student{c.studentCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Footer: Manage button + ungraded chip. No progress bar. */}
      <div className="mt-3 flex items-center justify-between gap-2">
        {manageHref ? (
          <Link
            href={manageHref}
            className="border border-[var(--hair)] bg-white hover:bg-[var(--bg)] rounded-full px-3 py-1 text-[11px] font-bold transition whitespace-nowrap"
          >
            Manage
          </Link>
        ) : (
          <span className="text-[11px] text-[var(--ink-3)] font-semibold">
            —
          </span>
        )}
        {c.ungradedCount > 0 && (
          <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-2 py-0.5 text-[10px] font-extrabold tnum">
            {c.ungradedCount} to grade
          </span>
        )}
      </div>
    </div>
  );
}

export function TodayRail({ cards, now, loaded }: TodayRailProps) {
  // Cap at 4 visible slots so the rail column doesn't grow taller than
  // the hero card beside it.
  const visible = cards.slice(0, 4);

  if (!loaded) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">
            {formatRailHeading(now)}
          </div>
          <h2 className="display text-[24px] lg:text-[26px] leading-none mt-1">
            Your day.
          </h2>
        </div>
        {visible.length > 0 && (
          <Link
            href="/teacher/settings?tab=timetable"
            className="text-[12px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1"
            title="Open the weekly timetable in Settings"
          >
            Week <I name="chevR" size={12} s={2.5} />
          </Link>
        )}
      </div>
      {visible.length === 0 ? (
        <SectionEmpty
          eyebrow="No classes today"
          heading="Enjoy the quiet."
          body="When you have classes scheduled, they'll show up here with the current period highlighted."
          ctaLabel="Check your timetable"
          ctaHref="/teacher/timetable"
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 flex-1 content-start">
          {visible.map((c) => (
            <RailCardView key={c.key} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
