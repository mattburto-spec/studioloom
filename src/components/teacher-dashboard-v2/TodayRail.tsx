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
  /** False while the schedule fetch is still in flight. We don't
   *  render skeletons here — the dashboard-level skeleton covers it. */
  loaded: boolean;
}

/** View-model the rail renders. Keeps the mock + real-data branches
 *  converging on one shape. */
interface CardVM {
  key: string;
  num: string;
  time: string;
  className: string;
  color: string;
  tint: string;
  unitTitle: string;
  sub: string;
  state: "done" | "live" | "next" | "upcoming";
  progress: number;
  ungradedCount: number;
  note?: string;
  href: string | null;
}

function fromCard(c: RailCard): CardVM {
  return {
    key: c.key,
    num: c.num,
    time: c.time,
    className: c.className,
    color: c.color,
    tint: c.tint,
    unitTitle: c.unitTitle,
    sub: c.sub,
    state: c.state,
    progress: c.progress,
    ungradedCount: c.ungradedCount,
    href: c.unitId ? `/teacher/teach/${c.unitId}` : null,
  };
}

function formatRailHeading(d: Date): string {
  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `Today · ${weekday} ${day} ${month}`;
}

export function TodayRail({ cards, now, loaded }: TodayRailProps) {
  // Cap at 4 visible slots so the grid stays single-row at the Bold
  // design's width. Teachers with >4 periods/day see the first 4 —
  // layout pass can add a "+N more" affordance.
  const vms: CardVM[] = cards.slice(0, 4).map(fromCard);

  // Nothing to render pre-load — the dashboard-level skeleton already
  // has a placeholder for this section.
  if (!loaded) return null;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">
            {formatRailHeading(now)}
          </div>
          <h2 className="display text-[32px] leading-none mt-1">
            Your day, at a glance.
          </h2>
        </div>
        {vms.length > 0 && (
          <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">
            See week <I name="chevR" size={12} s={2.5} />
          </button>
        )}
      </div>
      {vms.length === 0 ? (
        <SectionEmpty
          eyebrow="No classes today"
          heading="Enjoy the quiet."
          body="When you have classes scheduled, they'll show up here with the current period highlighted."
          ctaLabel="Check your timetable"
          ctaHref="/teacher/timetable"
        />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 flex-1 content-start">
        {vms.map((s) => {
          const isLive = s.state === "live";
          const isNext = s.state === "next";
          const isDone = s.state === "done";
          const card = (
            <div
              className={`relative rounded-2xl p-5 cursor-pointer transition hover:-translate-y-0.5 overflow-hidden ${
                isLive || isNext ? "ring-live" : ""
              } ${isDone ? "opacity-60" : ""}`}
              style={{
                background: s.tint,
                border: `1px solid ${s.color}22`,
              }}
            >
              <div className="flex items-start justify-between">
                <div
                  className="display text-[44px] leading-none tnum"
                  style={{ color: s.color }}
                >
                  {s.num}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isLive && (
                    <span
                      className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{ color: s.color }}
                    >
                      <span
                        className="pulse"
                        style={{ color: s.color, width: 6, height: 6 }}
                      />{" "}
                      LIVE
                    </span>
                  )}
                  {isNext && (
                    <span
                      className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{ color: s.color }}
                    >
                      <span
                        className="pulse"
                        style={{ color: s.color, width: 6, height: 6 }}
                      />{" "}
                      NEXT
                    </span>
                  )}
                  {isDone && (
                    <span
                      className="inline-flex items-center gap-1 bg-white/60 rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                      style={{ color: s.color }}
                    >
                      DONE
                    </span>
                  )}
                  <span
                    className="text-[11px] font-bold tnum"
                    style={{ color: s.color }}
                  >
                    {s.time}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <div
                  className="text-[11px] font-extrabold"
                  style={{ color: s.color }}
                >
                  {s.className}
                </div>
                <div className="display text-[18px] leading-tight mt-0.5 text-[var(--ink)]">
                  {s.unitTitle}
                </div>
                <div className="text-[11px] text-[var(--ink-3)] mt-1 line-clamp-1">
                  {s.sub}
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div
                  className="flex-1 h-1 rounded-full overflow-hidden"
                  style={{ background: `${s.color}33` }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(s.progress, 2)}%`,
                      background: s.color,
                    }}
                  />
                </div>
                {s.ungradedCount > 0 && (
                  <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold tnum">
                    {s.ungradedCount}
                  </span>
                )}
                {s.note && (
                  <span className="bg-[#FEE2E2] text-[#B91C1C] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold">
                    !
                  </span>
                )}
              </div>
            </div>
          );
          return s.href ? (
            <Link key={s.key} href={s.href} className="block">
              {card}
            </Link>
          ) : (
            <div key={s.key}>{card}</div>
          );
        })}
      </div>
      )}
    </div>
  );
}
