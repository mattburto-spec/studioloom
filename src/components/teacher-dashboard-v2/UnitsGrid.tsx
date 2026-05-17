"use client";

import Link from "next/link";
import { I } from "./icons";
import { SectionEmpty } from "./empty-states";
import type { UnitCardData, UnitBadgeKind } from "./unit-cards";
import { buildSlugWithId } from "@/lib/url/slug";

interface UnitsGridProps {
  /** Real (class × unit) cards. Empty + loaded → empty-state banner
   *  prompting the teacher to assign their first unit. */
  cards: UnitCardData[];
  /** False while the dashboard fetch is still in flight. */
  loaded: boolean;
}

/** View-model the grid renders. Real-data only post-Phase-9. */
interface CardVM {
  key: string;
  title: string;
  kicker: string;
  classTag: string;
  color: string;
  tint: string;
  students: number;
  progress: number;
  img: string;
  ungradedCount: number;
  realBadges: UnitBadgeKind[];
  teachHref: string | null;
  manageHref: string | null;
}

function fromCard(c: UnitCardData): CardVM {
  return {
    key: c.key,
    title: c.title,
    kicker: c.kicker,
    classTag: c.classTag,
    color: c.color,
    tint: c.tint,
    students: c.students,
    progress: c.progress,
    img: c.img,
    ungradedCount: c.ungradedCount,
    realBadges: c.badges,
    teachHref: `/teacher/teach/${c.unitId}`,
    // DT canvas Package B.5 (17 May 2026): canvas URL now class-canonical.
    // classTag carries the class name (set at fromClass() in unit-cards.ts).
    manageHref: `/teacher/c/${buildSlugWithId(c.classTag, c.classId)}`,
  };
}

function RealBadge({ kind, color }: { kind: UnitBadgeKind; color: string }) {
  if (kind === "fork") {
    return (
      <div
        className="h-6 rounded-lg bg-white/95 text-[9px] font-extrabold flex items-center justify-center px-1.5"
        style={{ color }}
        title="Class-local fork"
      >
        FK
      </div>
    );
  }
  if (kind === "ungraded") {
    return (
      <div
        className="w-6 h-6 rounded-lg bg-[#FBBF24] flex items-center justify-center"
        title="Ungraded work waiting"
      >
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    );
  }
  // nm
  return (
    <div
      className="h-6 rounded-lg bg-white/95 text-[9px] font-extrabold flex items-center justify-center px-1.5"
      style={{ color }}
      title="Melbourne Metrics enabled"
    >
      NM
    </div>
  );
}

function UnitCard({ u }: { u: CardVM }) {
  const hasBadges = u.realBadges.length > 0;
  return (
    <article className="group bg-white rounded-3xl overflow-hidden card-shadow hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
      {/* Image */}
      <div
        className="aspect-[16/9] relative overflow-hidden"
        style={{ background: u.color }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={u.img}
          alt=""
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
        />
        <div
          className="absolute top-4 left-4 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[11px] font-extrabold"
          style={{ color: u.color }}
        >
          <span
            className="w-5 h-5 rounded-full"
            style={{ background: u.color }}
          />
          {u.classTag} · {u.students} student{u.students === 1 ? "" : "s"}
        </div>
        {hasBadges && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {u.realBadges.map((b) => (
              <RealBadge key={b} kind={b} color={u.color} />
            ))}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="display text-[28px] leading-none">{u.title}</h3>
            {u.kicker && (
              <p className="text-[13.5px] text-[var(--ink-3)] mt-1.5 leading-snug">
                {u.kicker}
              </p>
            )}
          </div>
          {u.teachHref ? (
            <Link
              href={u.teachHref}
              className="btn-primary rounded-full px-5 py-2.5 text-[13px] inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <I name="play" size={10} s={0} /> Teach
            </Link>
          ) : (
            <button className="btn-primary rounded-full px-5 py-2.5 text-[13px] inline-flex items-center gap-1.5 whitespace-nowrap">
              <I name="play" size={10} s={0} /> Teach
            </button>
          )}
        </div>
        {/* Progress */}
        <div className="mt-5 flex items-center gap-3">
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: u.tint }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(u.progress, 2)}%`,
                background: u.color,
              }}
            />
          </div>
          <div
            className="text-[11.5px] font-extrabold tnum"
            style={{ color: u.color }}
          >
            {u.progress}%
          </div>
        </div>
        {/* Footer — grading status on the left, Manage on the right.
         *  "Hub / Edit / …" row dropped: Hub was the same page Manage
         *  links to, Edit is reachable from there as a tab, and the
         *  `…` overflow button was never wired to anything. */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-[var(--hair)]">
          {u.ungradedCount > 0 ? (
            <div
              className="text-[12px] font-bold"
              style={{ color: u.color }}
            >
              {u.ungradedCount} to grade
            </div>
          ) : (
            <div className="text-[12px] text-[var(--ink-3)] font-semibold">
              up to date
            </div>
          )}
          {u.manageHref ? (
            <Link
              href={u.manageHref}
              className="border border-[var(--hair)] hover:bg-[var(--bg)] rounded-full px-4 py-2 text-[12.5px] font-bold transition whitespace-nowrap"
            >
              Manage
            </Link>
          ) : (
            <button
              disabled
              className="border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold opacity-60 whitespace-nowrap"
            >
              Manage
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function UnitsGrid({ cards, loaded }: UnitsGridProps) {
  if (!loaded) return null;
  const vms: CardVM[] = cards.map(fromCard);

  if (vms.length === 0) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 pt-12">
        <div className="mb-4">
          <div className="cap text-[var(--ink-3)]">Active units · 0</div>
          <h2 className="display text-[32px] leading-none mt-1">
            Nothing on the loom yet.
          </h2>
        </div>
        <SectionEmpty
          eyebrow="No units assigned"
          heading="Pick a unit to get your classroom moving."
          body="Assign one of your existing units to a class, or spin up a new one with the AI wizard."
          ctaLabel="Browse the unit library"
          ctaHref="/teacher/units"
        />
      </section>
    );
  }

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">
            Active units · {vms.length}
          </div>
          <h2 className="display text-[32px] leading-none mt-1">
            Currently on the loom.
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">
            Filter
          </button>
          <button className="bg-white border border-[var(--hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">
            Sort
          </button>
          <Link
            href="/teacher/units"
            className="btn-primary rounded-full px-4 py-2 text-[12.5px] inline-flex items-center gap-1.5"
          >
            <I name="plus" size={12} s={3} /> New unit
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {vms.map((u) => (
          <UnitCard key={u.key} u={u} />
        ))}
      </div>
    </section>
  );
}
