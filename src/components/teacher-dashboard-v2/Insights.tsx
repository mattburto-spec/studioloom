"use client";

import { I } from "./icons";
import { INSIGHTS } from "./mock-data";

export function Insights() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--ink-3)]">Insights · This week</div>
          <h2 className="display text-[32px] leading-none mt-1">
            What deserves your attention.
          </h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--ink-2)] hover:text-[var(--ink)] inline-flex items-center gap-1">
          All insights <I name="chevR" size={12} s={2.5} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {INSIGHTS.map((it, i) => (
          <article
            key={i}
            className="relative rounded-3xl p-6 hover:-translate-y-0.5 transition cursor-pointer flex flex-col min-h-[280px]"
            style={{ background: it.bg, color: it.text }}
          >
            <div className="flex items-center justify-between">
              <span className="cap" style={{ color: it.accent }}>
                {it.tag}
              </span>
              <button
                className="w-7 h-7 rounded-full hover:bg-white/60 flex items-center justify-center"
                style={{ color: it.text }}
              >
                <I name="more" size={14} />
              </button>
            </div>
            <div
              className="display-lg text-[72px] leading-[0.9] mt-4 tnum"
              style={{ color: it.accent }}
            >
              {it.big}
            </div>
            <div className="text-[13px] font-bold mt-1">{it.unit}</div>
            <p
              className="text-[12.5px] leading-relaxed mt-3 flex-1"
              style={{ color: it.text, opacity: 0.85 }}
            >
              {it.body}
            </p>
            <div
              className="flex items-center justify-between mt-4 pt-4 border-t"
              style={{ borderColor: `${it.accent}33` }}
            >
              {it.who ? (
                <div className="flex items-center">
                  {it.who.slice(0, 4).map((a, idx) => (
                    <div
                      key={idx}
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center font-extrabold text-[9.5px] border-2 -ml-1.5 first:ml-0"
                      style={{ background: it.accent, borderColor: it.bg }}
                    >
                      {a}
                    </div>
                  ))}
                  {it.who.length > 4 && (
                    <div
                      className="text-[11px] ml-1 font-bold"
                      style={{ color: it.accent }}
                    >
                      +{it.who.length - 4}
                    </div>
                  )}
                </div>
              ) : (
                <div />
              )}
              <button
                className="inline-flex items-center gap-1 text-[11.5px] font-extrabold hover:gap-2 transition-all"
                style={{ color: it.accent }}
              >
                {it.cta} <I name="arrow" size={11} s={2.5} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
