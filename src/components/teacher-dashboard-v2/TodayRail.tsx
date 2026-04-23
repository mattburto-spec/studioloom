"use client";

import { I } from "./icons";
import { SCHEDULE } from "./mock-data";

export function TodayRail() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Today · Mon 20 Apr</div>
          <h2 className="display text-[32px] leading-none mt-1">
            Your day, at a glance.
          </h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">
          See week <I name="chevR" size={12} s={2.5} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {SCHEDULE.map((s, i) => (
          <div
            key={i}
            className={`relative rounded-2xl p-5 cursor-pointer transition hover:-translate-y-0.5 overflow-hidden ${
              s.state === "next" ? "ring-live" : ""
            }`}
            style={{ background: s.tint, border: `1px solid ${s.color}22` }}
          >
            <div className="flex items-start justify-between">
              <div
                className="display text-[44px] leading-none tnum"
                style={{ color: s.color }}
              >
                {s.num}
              </div>
              <div className="flex flex-col items-end gap-1">
                {s.state === "next" && (
                  <span
                    className="inline-flex items-center gap-1 bg-white rounded-full px-2 py-0.5 text-[10px] font-extrabold"
                    style={{ color: s.color }}
                  >
                    <span
                      className="pulse"
                      style={{
                        color: s.color,
                        width: 6,
                        height: 6,
                      }}
                    />{" "}
                    NEXT
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
                {s.class}
              </div>
              <div className="display text-[18px] leading-tight mt-0.5 text-[var(--ink)]">
                {s.unit}
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
              {s.ungraded > 0 && (
                <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold tnum">
                  {s.ungraded}
                </span>
              )}
              {s.note && (
                <span className="bg-[#FEE2E2] text-[#B91C1C] rounded-full px-1.5 py-0.5 text-[9.5px] font-extrabold">
                  !
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
