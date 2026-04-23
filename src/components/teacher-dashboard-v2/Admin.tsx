"use client";

import { I } from "./icons";
import { UNASSIGNED } from "./mock-data";

export function Admin() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-20">
      <details className="group bg-white rounded-3xl border border-[var(--hair)] overflow-hidden">
        <summary className="cursor-pointer px-6 py-5 flex items-center justify-between hover:bg-[var(--bg)]/60 transition">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--bg)] flex items-center justify-center text-[var(--ink-2)] font-extrabold text-[13px]">
              {UNASSIGNED.length}
            </div>
            <div>
              <div className="display text-[18px] leading-none">
                Housekeeping
              </div>
              <div className="text-[12px] text-[var(--ink-3)] mt-0.5">
                {UNASSIGNED.length} classes without units · 4 drafts · last
                cleaned 6 days ago
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
          {UNASSIGNED.map((c, i) => (
            <div
              key={i}
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
              <button className="ml-2 font-extrabold text-[var(--ink)] hover:underline">
                Assign unit →
              </button>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
