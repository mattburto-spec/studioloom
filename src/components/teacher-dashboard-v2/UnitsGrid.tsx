"use client";

import Link from "next/link";
import { I } from "./icons";
import { UNITS, type BadgeKind, type UnitCardData as MockUnit } from "./mock-data";
import type { UnitCardData, UnitBadgeKind } from "./unit-cards";

interface UnitsGridProps {
  /** Real (class × unit) cards. Empty → mock fallback. */
  cards: UnitCardData[];
}

/** View-model the grid renders. Converges mock + real data. */
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
  mockBadges: BadgeKind[];
  teachHref: string | null;
  editHref: string | null;
  hubHref: string | null;
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
    mockBadges: [],
    teachHref: `/teacher/teach/${c.unitId}`,
    editHref: `/teacher/units/${c.unitId}/class/${c.classId}/edit`,
    hubHref: `/teacher/units/${c.unitId}/class/${c.classId}`,
  };
}

function fromMock(u: MockUnit): CardVM {
  return {
    key: u.id,
    title: u.title,
    kicker: u.kicker,
    classTag: u.classTag,
    color: u.color,
    tint: u.tint,
    students: u.students,
    progress: u.progress,
    img: u.img,
    ungradedCount: 0,
    realBadges: [],
    mockBadges: u.badges,
    teachHref: null,
    editHref: null,
    hubHref: null,
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

function MockBadge({ kind }: { kind: BadgeKind }) {
  if (kind === "pink-re") {
    return (
      <div className="w-6 h-6 rounded-lg bg-[#EC4899] text-white text-[9px] font-extrabold flex items-center justify-center">
        RE
      </div>
    );
  }
  if (kind === "amber") {
    return (
      <div className="w-6 h-6 rounded-lg bg-[#FBBF24] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-white" />
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-lg border-2 border-[var(--hair)] flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-[var(--hair)]" />
    </div>
  );
}

function UnitCard({ u }: { u: CardVM }) {
  const hasBadges = u.realBadges.length > 0 || u.mockBadges.length > 0;
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
            {u.mockBadges.map((b, i) => (
              <MockBadge key={i} kind={b} />
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
        {/* Footer */}
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-[var(--hair)]">
          {u.ungradedCount > 0 ? (
            <div
              className="text-[11.5px] font-bold"
              style={{ color: u.color }}
            >
              {u.ungradedCount} to grade
            </div>
          ) : (
            <div className="text-[11.5px] text-[var(--ink-3)] font-semibold">
              up to date
            </div>
          )}
          <div className="flex items-center gap-4 text-[11.5px] font-bold text-[var(--ink-3)]">
            {u.hubHref ? (
              <Link href={u.hubHref} className="hover:text-[var(--ink)]">
                Hub
              </Link>
            ) : (
              <button className="hover:text-[var(--ink)]">Hub</button>
            )}
            {u.editHref ? (
              <Link href={u.editHref} className="hover:text-[var(--ink)]">
                Edit
              </Link>
            ) : (
              <button className="hover:text-[var(--ink)]">Edit</button>
            )}
            <button className="hover:text-[var(--ink)]" aria-label="More">
              <I name="more" size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function UnitsGrid({ cards }: UnitsGridProps) {
  const vms: CardVM[] =
    cards.length > 0 ? cards.map(fromCard) : UNITS.map(fromMock);

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
      <div className="grid grid-cols-2 gap-5">
        {vms.map((u) => (
          <UnitCard key={u.key} u={u} />
        ))}
      </div>
    </section>
  );
}
