"use client";

/* Default dashboard body — the MYP Design / all-programs view.
 * Hero + TodayRail in a 2:1 grid, then Insights, UnitsGrid, Admin.
 * Extracted from TeacherDashboardClient in Phase 13 so we can swap
 * it out per program via the view registry.
 */

import { Admin } from "../Admin";
import { Insights } from "../Insights";
import { NowHero } from "../NowHero";
import { TodayRail } from "../TodayRail";
import { UnitsGrid } from "../UnitsGrid";
import type { DashboardViewProps } from "./types";

export function DefaultView({
  classes,
  currentPeriod,
  railCards,
  insightBuckets,
  unitCards,
  now,
  dashboardLoaded,
  scheduleLoaded,
}: DashboardViewProps) {
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
      <Admin classes={classes} loaded={dashboardLoaded} />
    </>
  );
}
