"use client";

import Link from "next/link";
import { I } from "./icons";
import { UNASSIGNED } from "./mock-data";
import { classColor } from "./nav-config";
import type { DashboardClass } from "@/types/dashboard";

interface AdminProps {
  /** All active classes. Phase 7 derives the "Housekeeping" list from
   *  here by filtering for classes with zero active units. Empty
   *  array or not-yet-loaded → render mock fallback so the row
   *  doesn't collapse to "0 classes without units" during initial
   *  page load. */
  classes: DashboardClass[];
}

interface EmptyClassVM {
  key: string;
  name: string;
  students: number;
  color: string;
  /** Deep link to the class's unit-assignment flow. */
  assignHref: string;
}

function fromClasses(classes: DashboardClass[]): EmptyClassVM[] {
  return classes
    .filter((c) => c.units.length === 0)
    .map((c) => ({
      key: c.id,
      name: c.name,
      students: c.studentCount,
      color: classColor(c.id).color,
      assignHref: `/teacher/classes/${c.id}`,
    }));
}

function fromMock(): EmptyClassVM[] {
  return UNASSIGNED.map((c, i) => ({
    key: `mock-${i}`,
    name: c.name,
    students: c.students,
    color: c.color,
    assignHref: "/teacher/units",
  }));
}

export function Admin({ classes }: AdminProps) {
  const emptyClasses =
    classes.length > 0 ? fromClasses(classes) : fromMock();
  const count = emptyClasses.length;

  // When there's nothing to clean up, skip the whole row — mid-build
  // a blank expander looks worse than no section.
  if (count === 0) return null;

  const subtitle = `${count} class${count === 1 ? "" : "es"} without any active units`;

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-20">
      <details className="group bg-white rounded-3xl border border-[var(--hair)] overflow-hidden">
        <summary className="cursor-pointer px-6 py-5 flex items-center justify-between hover:bg-[var(--bg)]/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg)] flex items-center justify-center text-[var(--ink-2)] font-extrabold text-[13px]">
              {count}
            </div>
            <div>
              <div className="display text-[18px] leading-none">
                Housekeeping
              </div>
              <div className="text-[12px] text-[var(--ink-3)] mt-0.5">
                {subtitle}
              </div>
            </div>
          </div>
          <div className="text-[12px] font-bold text-[var(--ink-3)] group-open:hidden flex items-center gap-1">
            Open <I name="chev" size={12} s={2.5} />
          </div>
          <div className="text-[12px] font-bold text-[var(--ink-3)] hidden group-open:flex items-center gap-1">
            Close
          </div>
        </summary>
        <div className="px-6 pb-6 pt-2 flex flex-wrap gap-2">
          {emptyClasses.map((c) => (
            <div
              key={c.key}
              className="bg-[var(--bg)] rounded-2xl px-4 py-3 flex items-center gap-3 text-[12.5px]"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: c.color }}
              />
              <span className="font-extrabold">{c.name}</span>
              <span className="text-[var(--ink-3)]">
                {c.students} student{c.students === 1 ? "" : "s"}
              </span>
              <Link
                href={c.assignHref}
                className="ml-2 font-extrabold text-[var(--ink)] hover:underline"
              >
                Assign unit →
              </Link>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
