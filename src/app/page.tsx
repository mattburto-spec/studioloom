import Link from "next/link";
import { WaveDivider } from "@/components/ui/WaveDivider";
import FeatureExplorer from "@/components/landing/FeatureExplorer";

/* ------------------------------------------------------------------ */
/*  Section components                                                 */
/* ------------------------------------------------------------------ */

function StatBadge({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      <div className="text-xs text-white/50 mt-0.5">{label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SVG icon helpers (no lucide-react in project)                      */
/* ------------------------------------------------------------------ */

const IconArrowRight = () => (
  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden">

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* HERO                                                          */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="gradient-hero text-white relative">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-brand-pink/10 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] bg-brand-lilac/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-white/5 rounded-full blur-3xl" />
        </div>

        {/* Nav */}
        <nav className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <rect x="2" y="8" width="28" height="5" rx="2.5" fill="#7B2FF2"/>
                <rect x="2" y="19" width="28" height="5" rx="2.5" fill="#7B2FF2"/>
                <rect x="8" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/>
                <rect x="19" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/>
                <rect x="4" y="8" width="12" height="5" rx="2.5" fill="#7B2FF2"/>
                <rect x="16" y="19" width="12" height="5" rx="2.5" fill="#7B2FF2"/>
              </svg>
            </div>
            <span className="text-xl md:text-2xl font-bold tracking-tight text-white">StudioLoom</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/toolkit" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white/70 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              Free Toolkit
            </Link>
            <Link href="/login" className="hidden sm:inline-block px-4 py-2 text-sm text-white/70 hover:text-white transition">
              Student Login
            </Link>
            <Link href="/teacher/login" className="px-3 md:px-4 py-2 text-xs md:text-sm bg-white/15 rounded-lg hover:bg-white/25 transition border border-white/20 backdrop-blur-sm whitespace-nowrap">
              Teacher Portal
            </Link>
          </div>
        </nav>

        {/* Hero content */}
        <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-28 md:pb-36">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6">
              You Teach Design.{" "}
              <br className="hidden md:block" />
              <span className="text-white/90">We Handle the Rest.</span>
            </h1>
            <p className="text-lg text-white/55 mb-10 max-w-xl mx-auto leading-relaxed">
              Project timelines, safety checks, overdue work, lesson prep — the
              admin never stops. StudioLoom carries the logistics so you can
              circulate, mentor, and meet each student where they are.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/teacher/login" className="group px-7 py-3.5 gradient-cta text-white rounded-full font-semibold hover:opacity-90 transition text-base flex items-center gap-2 shadow-lg shadow-brand-pink/25">
                Get Started Free
                <IconArrowRight />
              </Link>
              <Link href="/toolkit" className="px-7 py-3.5 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition border border-white/20 text-base backdrop-blur-sm">
                Browse Free Toolkit
              </Link>
            </div>

            {/* Quick stats */}
            <div className="flex items-center justify-center gap-8 md:gap-14 mt-10 pt-8 border-t border-white/10">
              <StatBadge value="42" label="Design Thinking Tools" />
              <StatBadge value="8+" label="Curriculum Frameworks" />
              <StatBadge value="27" label="AI-Powered Interactive Tools" />
            </div>
          </div>
        </section>

        <WaveDivider fillClass="fill-[#0c0a1a]" />
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 1. FREE TOOLKIT — Dark-themed showcase                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section style={{ background: "linear-gradient(135deg, #0c0a1a 0%, #1a0e3a 40%, #0d1b2a 100%)" }}>
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="text-center mb-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-3 block">Free for Every Teacher</span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Design Thinking Toolkit</h2>
            <p className="text-white/50 max-w-xl mx-auto">
              42 visual thinking tools. 27 are AI-powered and interactive. Filter by design phase, deploy as
              presentation, worksheet, group activity, or solo task. No login required.
            </p>
          </div>

          {/* Tool name pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10 max-w-3xl mx-auto">
            {["SCAMPER", "Six Thinking Hats", "PMI Chart", "Five Whys", "Empathy Map", "Decision Matrix", "SWOT Analysis", "Stakeholder Map", "Lotus Diagram", "How Might We", "Reverse Brainstorm", "Dot Voting", "Quick Sketch", "Affinity Diagram", "Morphological Chart"].map((name) => (
              <span key={name} className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300">
                {name}
              </span>
            ))}
            <span className="text-[11px] font-medium px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/40">
              +27 more
            </span>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-10 mb-10">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">42</div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider">Tools</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">27</div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider">Interactive</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">8+</div>
              <div className="text-[11px] text-white/40 uppercase tracking-wider">Frameworks</div>
            </div>
          </div>

          {/* Framework badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            {["IB MYP", "GCSE DT", "A-Level DT", "ACARA", "PLTW", "Stanford d.school", "IDEO", "Double Diamond"].map((fw) => (
              <span key={fw} className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-white/30">
                {fw}
              </span>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link href="/toolkit" className="inline-flex items-center gap-2 px-8 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full font-semibold transition text-base shadow-lg shadow-purple-600/25">
              Open the Free Toolkit <IconArrowRight />
            </Link>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 2. FEATURE EXPLORER — Expandable cards for all platform features */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <FeatureExplorer />


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 8. PRICING / CTA                                              */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="gradient-hero-warm relative">
        <WaveDivider direction="top" fillClass="fill-white" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="relative rounded-3xl bg-white/10 border border-white/15 p-10 md:p-14 text-center overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 pointer-events-none opacity-10">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="absolute w-2 h-2 rounded-full bg-white" style={{ left: `${10 + (i % 4) * 25}%`, top: `${15 + Math.floor(i / 4) * 30}%` }} />
                ))}
              </div>
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-green/20 border border-accent-green/30 text-xs font-semibold text-accent-green mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                  Free During Early Access
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Ready to Spend Less Time on Admin?</h2>
                <p className="text-white/55 mb-8 max-w-lg mx-auto">
                  Start with the free toolkit — no login needed. Or set up your first class and see how it feels
                  to teach with a live dashboard that actually helps.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link href="/teacher/login" className="px-8 py-3.5 bg-white text-brand-purple rounded-full font-semibold hover:bg-white/90 transition text-base shadow-lg">
                    Get Started Free
                  </Link>
                  <Link href="/toolkit" className="px-8 py-3.5 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition border border-white/20 text-base backdrop-blur-sm">
                    Browse the Toolkit
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
        <WaveDivider fillClass="fill-surface-dark" />
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* FOOTER                                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <footer className="bg-surface-dark text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><rect x="2" y="8" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="2" y="19" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="8" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/><rect x="19" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/><rect x="4" y="8" width="12" height="5" rx="2.5" fill="#7B2FF2"/><rect x="16" y="19" width="12" height="5" rx="2.5" fill="#7B2FF2"/></svg>
              </div>
              <span className="text-sm font-semibold text-white/80">StudioLoom</span>
            </div>
            <p className="text-xs text-white/30">Design Process Platform — Built by a teacher, for teachers. Works with IB MYP, GCSE, ACARA, PLTW &amp; more.</p>
            <div className="flex items-center gap-4">
              <Link href="/toolkit" className="text-xs text-white/40 hover:text-white/70 transition">Design Toolkit</Link>
              <Link href="/login" className="text-xs text-white/40 hover:text-white/70 transition">Students</Link>
              <Link href="/teacher/login" className="text-xs text-white/40 hover:text-white/70 transition">Teachers</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
