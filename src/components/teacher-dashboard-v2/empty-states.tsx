"use client";

/* Shared empty-state + loading-skeleton visuals for the Bold teacher
 * dashboard. Kept separate from the section components so each section
 * file stays focused on its real-data view.
 */

import Link from "next/link";

/** Page-wide loading skeleton. Used while both the dashboard + schedule
 *  fetches are still in flight — cheaper than a per-section skeleton
 *  and avoids the flash-of-mock that Phases 1-8 tolerated. */
export function DashboardSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
      <div className="rounded-[24px] lg:rounded-[32px] h-[280px] lg:h-[360px] bg-white/60 animate-pulse" />
      <div className="mt-8 md:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-[170px] bg-white/60 animate-pulse"
          />
        ))}
      </div>
      <div className="mt-10 md:mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-3xl h-[280px] bg-white/60 animate-pulse"
          />
        ))}
      </div>
      <div className="mt-10 md:mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-3xl h-[360px] bg-white/60 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}

/** Shown after the dashboard fetch resolves with zero classes — new
 *  teachers, or teachers who archived everything. Bold-styled hero
 *  replacing every other section. Full onboarding wizard still lives
 *  behind /teacher/classes (deferred port). */
export function NoClassesWelcome({ teacherName }: { teacherName: string }) {
  const first = teacherName?.trim().split(/\s+/)[0] || "there";
  return (
    <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8">
      <div
        className="relative rounded-[24px] lg:rounded-[32px] overflow-hidden card-shadow-lg glow-inner p-6 md:p-8 lg:p-12 min-h-[320px] md:min-h-[360px] flex flex-col justify-center"
        style={{ background: "#0A0A0A" }}
      >
        <div className="max-w-2xl text-white">
          <div className="cap text-white/60 mb-4">Welcome to StudioLoom</div>
          <h1 className="display-lg text-[48px] sm:text-[56px] md:text-[72px] leading-[0.95] tracking-tight">
            Hi {first}.
          </h1>
          <p className="text-[16px] md:text-[20px] leading-snug mt-3 md:mt-4 text-white/80 font-medium">
            Your dashboard comes alive once you have a class. Start by creating
            one, then assign a unit and invite your students.
          </p>
          <div className="flex items-center gap-3 mt-6 md:mt-8 flex-wrap">
            <Link
              href="/teacher/classes"
              className="bg-white text-[var(--ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition"
            >
              Create your first class →
            </Link>
            <Link
              href="/teacher/units"
              className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]"
            >
              Browse units
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Small empty banner rendered in place of a section when it loaded
 *  fine but has no items. Used by TodayRail + UnitsGrid. */
export function SectionEmpty({
  eyebrow,
  heading,
  body,
  ctaLabel,
  ctaHref,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--hair)] bg-white/60 px-8 py-10 flex flex-col items-start">
      <div className="cap text-[var(--ink-3)]">{eyebrow}</div>
      <h3 className="display text-[24px] leading-tight mt-1">{heading}</h3>
      <p className="text-[13.5px] text-[var(--ink-3)] mt-2 max-w-xl leading-snug">
        {body}
      </p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="btn-primary rounded-full px-5 py-2.5 text-[13px] inline-flex items-center gap-1.5 mt-5"
        >
          {ctaLabel} →
        </Link>
      )}
    </div>
  );
}
