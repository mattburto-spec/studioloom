"use client";

import { I } from "./icons";
import { NEXT } from "./mock-data";

export function NowHero() {
  const n = NEXT;
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div
        className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner"
        style={{ background: n.color }}
      >
        <div className="grid grid-cols-12 gap-0 items-stretch">
          {/* Left: content */}
          <div className="col-span-7 p-10 flex flex-col justify-between text-white relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
                <span className="pulse" style={{ color: "#FFF" }} />
                Next up · {n.period} · starts in
                <span className="tnum font-extrabold ml-1">
                  {n.startsIn} min
                </span>
              </div>
              <h1 className="display-lg text-[108px] leading-[0.88] mt-6 text-white">
                {n.title}.
              </h1>
              <p className="text-[22px] leading-snug mt-3 text-white/85 max-w-md font-medium">
                {n.sub}
              </p>
            </div>

            {/* Meta pills */}
            <div className="flex items-center gap-2 mt-8 flex-wrap">
              <span
                className="bg-white rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[12px] font-bold"
                style={{ color: n.color }}
              >
                <span className="w-5 h-5 rounded-full bg-current opacity-20" />
                <span style={{ color: n.colorDark }}>{n.class}</span>
              </span>
              <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white">
                {n.phase}
              </span>
              <span className="bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[12px] font-bold text-white tnum">
                {n.ready} / {n.students} ready
              </span>
              <span className="bg-[#FBBF24] text-[#78350F] rounded-full px-3 py-1 text-[12px] font-extrabold">
                {n.ungraded} to grade
              </span>
              <span className="text-white/70 text-[12px] font-semibold ml-1">
                Room {n.room} · {n.time}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                <I name="play" size={12} s={0} /> Start teaching
              </button>
              <button className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]">
                Lesson plan
              </button>
              <button className="text-white/70 hover:text-white rounded-full px-3 py-3 font-semibold text-[13px]">
                Skip →
              </button>
            </div>
          </div>

          {/* Right: image */}
          <div className="col-span-5 relative">
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={n.img}
                alt=""
                className="w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to right, ${n.color} 0%, transparent 35%)`,
                }}
              />
            </div>
            <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur rounded-2xl px-4 py-3 card-shadow">
              <div className="cap text-[var(--ink-3)]">Phase progress</div>
              <div className="flex items-baseline gap-2 mt-1">
                <div
                  className="display text-[32px] leading-none tnum"
                  style={{ color: n.colorDark }}
                >
                  {n.phasePct}%
                </div>
                <div className="text-[11px] text-[var(--ink-3)]">
                  of developing ideas
                </div>
              </div>
              <div className="mt-2 w-40 h-1.5 bg-[var(--hair)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${n.phasePct}%`, background: n.color }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
