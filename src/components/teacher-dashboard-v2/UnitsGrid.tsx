"use client";

import { I } from "./icons";
import { UNITS, type BadgeKind, type UnitCardData } from "./mock-data";

function StatusBadge({ kind }: { kind: BadgeKind }) {
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

function UnitCard({ u }: { u: UnitCardData }) {
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
        {u.badges.length > 0 && (
          <div className="absolute top-4 right-4 flex items-center gap-1.5">
            {u.badges.map((b, i) => (
              <StatusBadge key={i} kind={b} />
            ))}
          </div>
        )}
      </div>
      {/* Body */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="display text-[28px] leading-none">{u.title}</h3>
            <p className="text-[13.5px] text-[var(--ink-3)] mt-1.5 leading-snug">
              {u.kicker}
            </p>
          </div>
          <button className="btn-primary rounded-full px-5 py-2.5 text-[13px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <I name="play" size={10} s={0} /> Teach
          </button>
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
          <div className="text-[11.5px] font-bold" style={{ color: u.color }}>
            {u.due}
          </div>
          <div className="flex items-center gap-4 text-[11.5px] font-bold text-[var(--ink-3)]">
            <button className="hover:text-[var(--ink)]">Hub</button>
            <button className="hover:text-[var(--ink)]">Edit</button>
            <button className="hover:text-[var(--ink)]">
              <I name="more" size={14} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function UnitsGrid() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">
            Active units · {UNITS.length}
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
          <button className="btn-primary rounded-full px-4 py-2 text-[12.5px] inline-flex items-center gap-1.5">
            <I name="plus" size={12} s={3} /> New unit
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {UNITS.map((u) => (
          <UnitCard key={u.id} u={u} />
        ))}
      </div>
    </section>
  );
}
