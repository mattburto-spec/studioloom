"use client";

import Link from "next/link";
import { I } from "./icons";
import type { InsightBucket } from "./insight-buckets";

interface InsightsProps {
  /** Always four buckets when loaded (Act/Grade/Watch/Celebrate); an
   *  empty-bucket has isEmpty=true and renders a calm "nothing here"
   *  card rather than hiding — the 4-column grid stays solid. */
  buckets: InsightBucket[];
  /** False while the dashboard fetch is still in flight. */
  loaded: boolean;
}

interface CardVM {
  key: string;
  bg: string;
  accent: string;
  text: string;
  tag: string;
  big: string;
  unit: string;
  body: string;
  who: string[];
  whoOverflow: number;
  href: string | null;
  cta: string;
  isEmpty: boolean;
}

function fromBucket(b: InsightBucket): CardVM {
  return {
    key: b.tag,
    bg: b.bg,
    accent: b.accent,
    text: b.text,
    tag: b.tag,
    big: b.big,
    unit: b.unit,
    body: b.body,
    who: b.who,
    whoOverflow: b.whoOverflow,
    href: b.href,
    cta: b.cta,
    isEmpty: b.isEmpty,
  };
}

export function Insights({ buckets, loaded }: InsightsProps) {
  if (!loaded) return null;
  const cards: CardVM[] = buckets.map(fromBucket);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const body = (
            <article
              className={`relative rounded-3xl p-6 hover:-translate-y-0.5 transition ${
                c.href ? "cursor-pointer" : ""
              } flex flex-col min-h-[280px] ${c.isEmpty ? "opacity-60" : ""}`}
              style={{ background: c.bg, color: c.text }}
            >
              <div className="flex items-center justify-between">
                <span className="cap" style={{ color: c.accent }}>
                  {c.tag}
                </span>
                <button
                  className="w-7 h-7 rounded-full hover:bg-white/60 flex items-center justify-center"
                  style={{ color: c.text }}
                  aria-label="More options"
                >
                  <I name="more" size={14} />
                </button>
              </div>
              <div
                className="display-lg text-[72px] leading-[0.9] mt-4 tnum"
                style={{ color: c.accent }}
              >
                {c.big}
              </div>
              <div className="text-[13px] font-bold mt-1">{c.unit}</div>
              <p
                className="text-[12.5px] leading-relaxed mt-3 flex-1"
                style={{ color: c.text, opacity: 0.85 }}
              >
                {c.body}
              </p>
              <div
                className="flex items-center justify-between mt-4 pt-4 border-t"
                style={{ borderColor: `${c.accent}33` }}
              >
                {c.who.length > 0 ? (
                  <div className="flex items-center">
                    {c.who.map((initials, idx) => (
                      <div
                        key={idx}
                        className="w-7 h-7 rounded-full text-white flex items-center justify-center font-extrabold text-[9.5px] border-2 -ml-1.5 first:ml-0"
                        style={{
                          background: c.accent,
                          borderColor: c.bg,
                        }}
                      >
                        {initials}
                      </div>
                    ))}
                    {c.whoOverflow > 0 && (
                      <div
                        className="text-[11px] ml-1 font-bold"
                        style={{ color: c.accent }}
                      >
                        +{c.whoOverflow}
                      </div>
                    )}
                  </div>
                ) : (
                  <div />
                )}
                <span
                  className="inline-flex items-center gap-1 text-[11.5px] font-extrabold hover:gap-2 transition-all"
                  style={{ color: c.accent }}
                >
                  {c.cta} <I name="arrow" size={11} s={2.5} />
                </span>
              </div>
            </article>
          );
          return c.href ? (
            <Link key={c.key} href={c.href} className="block">
              {body}
            </Link>
          ) : (
            <div key={c.key}>{body}</div>
          );
        })}
      </div>
    </section>
  );
}
