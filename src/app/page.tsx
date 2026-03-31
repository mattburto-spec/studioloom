import Link from "next/link";
import { WaveDivider } from "@/components/ui/WaveDivider";

/* ------------------------------------------------------------------ */
/*  SVG icon helpers (no lucide-react in project)                      */
/* ------------------------------------------------------------------ */

const IconArrowRight = () => (
  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Journey phase section — alternating left/right layout              */
/* ------------------------------------------------------------------ */

function JourneyPhase({
  tag,
  tagColor,
  headline,
  headlineAccent,
  description,
  bullets,
  visual,
  reverse = false,
}: {
  tag: string;
  tagColor: string;
  headline: string;
  headlineAccent?: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={`grid md:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? "md:[direction:rtl]" : ""}`}>
      {/* Visual */}
      <div className={reverse ? "md:[direction:ltr]" : ""}>{visual}</div>
      {/* Copy */}
      <div className={reverse ? "md:[direction:ltr]" : ""}>
        <span className={`text-[11px] font-semibold uppercase tracking-wider mb-3 block ${tagColor}`}>{tag}</span>
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          {headline}
          {headlineAccent && (
            <>
              {" "}
              <span className="text-purple-600">{headlineAccent}</span>
            </>
          )}
        </h2>
        <p className="text-gray-500 mb-6 leading-relaxed">{description}</p>
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-gray-600 text-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 flex-shrink-0 mt-2" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Journey phase mock visuals (CSS-only, no images needed)            */
/* ------------------------------------------------------------------ */

function MockPlan() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        </div>
        <span className="text-sm font-semibold text-gray-700">Unit Builder</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium ml-auto">3 lanes</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {["Express", "Guided", "Architect"].map((lane, i) => (
          <div key={lane} className={`rounded-lg p-3 text-center text-xs font-medium border ${i === 0 ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
            {lane}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 pt-2">
        {["Design", "Service", "Capstone", "Inquiry"].map((t, i) => (
          <div key={t} className={`rounded-md py-2 text-center text-[10px] font-semibold ${
            [
              "bg-teal-50 text-teal-700 border border-teal-200",
              "bg-pink-50 text-pink-700 border border-pink-200",
              "bg-purple-50 text-purple-700 border border-purple-200",
              "bg-amber-50 text-amber-700 border border-amber-200",
            ][i]
          }`}>
            {t}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1 text-[10px] text-gray-400">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        Workshop Model phases auto-generated
      </div>
    </div>
  );
}

function MockTeach() {
  const students = [
    { color: "bg-green-400", label: "On track" },
    { color: "bg-green-400", label: "On track" },
    { color: "bg-amber-400", label: "Slow" },
    { color: "bg-green-400", label: "On track" },
    { color: "bg-red-400", label: "Needs help" },
    { color: "bg-green-400", label: "On track" },
    { color: "bg-green-400", label: "On track" },
    { color: "bg-amber-400", label: "Slow" },
    { color: "bg-green-400", label: "On track" },
  ];
  return (
    <div className="bg-gray-900 rounded-2xl shadow-lg p-5 text-white space-y-3">
      {/* Title bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-500"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500"/><div className="w-2.5 h-2.5 rounded-full bg-green-500"/></div>
        <span className="text-[10px] text-gray-400 ml-2">Teaching Mode — Live</span>
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">1 needs help</span>
      </div>
      {/* Phase timer */}
      <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
        <div className="text-[10px] font-medium text-emerald-400">Work Time</div>
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full w-3/5 bg-emerald-400 rounded-full"/></div>
        <span className="text-[10px] text-gray-400">18:42</span>
      </div>
      {/* Student grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {students.map((s, i) => (
          <div key={i} className="bg-white/5 rounded-md px-2 py-1.5 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${s.color}`}/>
            <span className="text-[9px] text-gray-300">Student {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockStudentWork() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-lg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="https://images.unsplash.com/photo-1744809495173-217ca4faa8bc?w=800&q=80&fit=crop&crop=center"
        alt="Student carefully drawing with a ruler, deeply focused on their design work"
        className="w-full h-[320px] md:h-[400px] object-cover"
        loading="lazy"
      />
    </div>
  );
}

function MockData() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-700">Smart Insights</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium ml-auto">Live</span>
      </div>
      {[
        { icon: "🔴", label: "Maya — stuck on Criterion B for 48 hours", type: "Needs attention" },
        { icon: "🟡", label: "3 students have unmarked work (7+ days)", type: "Stale work" },
        { icon: "🔵", label: "Writing integrity flag — high paste ratio", type: "Review" },
        { icon: "🟢", label: "Liam completed all pages in Packaging Unit", type: "Finished" },
      ].map((insight, i) => (
        <div key={i} className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
          <span className="text-sm mt-0.5">{insight.icon}</span>
          <div>
            <div className="text-xs text-gray-700">{insight.label}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{insight.type}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockAssess() {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-semibold text-gray-700">Grading + Portfolio</span>
      </div>
      {/* Criterion scores mock */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "A", score: 6, color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
          { label: "B", score: 5, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
          { label: "C", score: 7, color: "bg-amber-100 text-amber-700 border-amber-200" },
          { label: "D", score: 4, color: "bg-violet-100 text-violet-700 border-violet-200" },
        ].map((c) => (
          <div key={c.label} className={`rounded-lg p-3 text-center border ${c.color}`}>
            <div className="text-[10px] font-medium mb-1">Criterion {c.label}</div>
            <div className="text-lg font-bold">{c.score}</div>
          </div>
        ))}
      </div>
      {/* Gallery mock */}
      <div className="flex items-center gap-2 pt-1">
        <div className="flex -space-x-2">
          {[0,1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"/>)}
        </div>
        <span className="text-[10px] text-gray-500">12 peer reviews completed this round</span>
      </div>
    </div>
  );
}

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
              The platform for classrooms where students{" "}
              <span className="text-white/90">make, solve, and create.</span>
            </h1>
            <p className="text-base md:text-lg text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed">
              Unit planning. Lesson delivery. Student mentoring. Thinking tools. Grading. Portfolio.
              One place — for Design, Service, Capstone, Exhibition, and inquiry classrooms.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/teacher/login" className="group px-7 py-3.5 gradient-cta text-white rounded-full font-semibold hover:opacity-90 transition text-base flex items-center gap-2 shadow-lg shadow-brand-pink/25">
                Get Started
                <IconArrowRight />
              </Link>
              <Link href="/toolkit" className="px-7 py-3.5 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition border border-white/20 text-base backdrop-blur-sm">
                Browse Free Toolkit
              </Link>
            </div>

            {/* Stat badges — process-focused */}
            <div className="flex items-center justify-center gap-6 md:gap-10 mt-10 pt-8 border-t border-white/10 text-xs md:text-sm text-white/40">
              {["Plan", "Deliver", "Assess", "Showcase"].map((phase, i) => (
                <span key={phase} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/20">→</span>}
                  {phase}
                </span>
              ))}
              <span className="text-white/15 mx-1">|</span>
              <span>8+ Frameworks</span>
              <span className="text-white/15 mx-1">|</span>
              <span>42 Thinking Tools</span>
            </div>
          </div>

          {/* Hero image */}
          <div className="relative z-10 max-w-4xl mx-auto mt-14 px-4">
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1576595580361-90a855b84b20?w=1200&q=80&fit=crop&crop=center"
                alt="Students sketching wireframes and prototyping with post-it notes in a design workshop"
                className="w-full h-[280px] md:h-[380px] object-cover"
                loading="eager"
              />
            </div>
            <p className="text-center text-white/25 text-[11px] mt-3">
              Built for how teachers actually teach and how students actually learn.
            </p>
          </div>
        </section>
      </div>

      {/* Wave transition: dark hero → white content */}
      <WaveDivider fillClass="fill-white" showAccent={false} className="-mt-1 gradient-hero" />


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* THE JOURNEY — 5 phases of the teaching cycle                  */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {/* Phase 1: Plan */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <JourneyPhase
            tag="Phase 1 — Plan"
            tagColor="text-purple-600"
            headline="Start from a library of"
            headlineAccent="classroom-tested units."
            description="Hundreds of ready-to-go units built by real teachers for Design, Service, Capstone, Exhibition, and inquiry classrooms. Use one as-is, remix it for your context, or generate something entirely new with a unit builder that understands how to scaffold and extend students in project-based learning."
            bullets={[
              "Browse units by subject, framework, and grade level — each one structured with Workshop Model phases, scaffolding, and differentiation built in",
              "Customise any unit per class: fork the content, adjust timing, swap activities — your version, your students",
              "Or build from scratch: Express mode for speed, Guided for conversation, Architect for full control over every activity and phase",
              "AI generation trained on design teaching pedagogy — it knows when to scaffold, when to stretch, and when to get out of the way",
            ]}
            visual={<MockPlan />}
          />
        </div>
      </section>

      {/* Phase 2: Teach */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <JourneyPhase
            tag="Phase 2 — Teach"
            tagColor="text-emerald-600"
            headline="Teach with a live dashboard,"
            headlineAccent="not a stack of printouts."
            description="A three-column teaching cockpit shows your lesson phases, a live student grid, and notes — all on one screen. Project the current phase to the board while you circulate. See who needs help before they raise their hand."
            bullets={[
              "Phase timer counts down each Workshop Model segment with one-click skip and extend",
              "Live student grid shows active, slow, and stuck students — updated every 30 seconds",
              "Projector view syncs automatically — students see the current phase, you see everything",
              "One-tap observations for Melbourne Metrics competency tracking during class",
            ]}
            visual={<MockTeach />}
            reverse
          />
        </div>
      </section>

      {/* Phase 3: Students Work — the emotional centrepiece */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <JourneyPhase
            tag="Phase 3 — Students Work"
            tagColor="text-pink-600"
            headline="They own the process."
            headlineAccent="You see it happen."
            description="Students work through real challenges at their own pace — sketching, prototyping, testing, reflecting. A mentor scaffolds without over-helping. They discover their own projects. They earn independence. They build a real portfolio."
            bullets={[
              "Mentor asks questions, never gives answers — effort-gated so students think before getting feedback",
              "42 built-in thinking tools available inside lessons as embedded activities, no context switching",
              "Discovery Engine: 8 interactive stations help students find their own project direction",
              "Open Studio: students earn self-directed working mode with drift detection and check-ins",
              "Portfolio builds automatically from daily work — no separate assignment to submit",
            ]}
            visual={<MockStudentWork />}
          />
        </div>
      </section>

      {/* Phase 4: See Everything */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <JourneyPhase
            tag="Phase 4 — See Everything"
            tagColor="text-blue-600"
            headline="The data collects itself."
            description="No spreadsheets. No manual data entry. Writing behaviour, time on task, attempt history, pace feedback — all captured silently while students work. Smart Insights surfaces what matters: stuck students, stale unmarked work, integrity flags."
            bullets={[
              "Writing integrity monitoring: paste detection, typing patterns, focus tracking — zero student-facing indicators",
              "Activity tracking: time spent, attempts, and effort signals per activity, per student",
              "Smart Insights feed on your dashboard — priority-sorted alerts instead of raw data tables",
              "Students tap one emoji after each lesson (pace feedback) — feeds the timing model for next time",
            ]}
            visual={<MockData />}
            reverse
          />
        </div>
      </section>

      {/* Phase 5: Assess & Showcase */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <JourneyPhase
            tag="Phase 5 — Assess & Showcase"
            tagColor="text-violet-600"
            headline="From grading to gallery —"
            headlineAccent="the evidence is already there."
            description="Grade with the evidence the platform already collected. Students showcase through structured peer review rounds, not just submission. The portfolio is already built — because it captured their work as they did it."
            bullets={[
              "Criterion-based grading for any framework — MYP 1-8, GCSE percentages, PLTW 1-4, and more",
              "Evidence panel shows student work alongside integrity report and activity tracking data",
              "Gallery: teacher-created peer review rounds with structured formats (PMI, Two Stars & a Wish)",
              "Effort-gated feedback — students only see peer reviews after completing their own reviews first",
            ]}
            visual={<MockAssess />}
          />
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* ONE PLATFORM STRIP                                            */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-900 py-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-white/70 text-sm md:text-base leading-relaxed">
            Unit planning. Lesson delivery. Live monitoring. Student mentoring. Thinking tools.
            Data collection. Grading. Portfolio. Peer review.{" "}
            <span className="text-white font-semibold">One platform.</span>{" "}
            <span className="text-white/40">Built for how project-based teaching actually works.</span>
          </p>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* COMPACT TOOLKIT STRIP                                         */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white py-12 border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-5">
            {["SCAMPER", "Six Hats", "PMI", "Five Whys", "Empathy Map", "Decision Matrix", "SWOT", "Stakeholder Map", "Lotus Diagram", "Dot Voting"].map((name) => (
              <span key={name} className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-600">
                {name}
              </span>
            ))}
            <span className="text-[10px] font-medium px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-400">
              +32 more
            </span>
          </div>
          <Link href="/toolkit" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-500 font-semibold text-sm transition group">
            Open the Free Toolkit — 42 tools, no login required <IconArrowRight />
          </Link>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* FRAMEWORK TRUST BAR                                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-[10px] text-gray-400 uppercase tracking-wider mb-4">Works with your framework</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {["IB MYP", "GCSE DT", "A-Level DT", "IGCSE DT", "ACARA", "PLTW", "Stanford d.school", "IDEO", "Double Diamond"].map((fw) => (
              <span key={fw} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-500">
                {fw}
              </span>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* CTA                                                           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="gradient-hero-warm relative">
        <WaveDivider direction="top" fillClass="fill-gray-50" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="relative rounded-3xl bg-white/10 border border-white/15 p-10 md:p-14 text-center overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 pointer-events-none opacity-10">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="absolute w-2 h-2 rounded-full bg-white" style={{ left: `${10 + (i % 4) * 25}%`, top: `${15 + Math.floor(i / 4) * 30}%` }} />
                ))}
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                  Ready to teach with everything in one place?
                </h2>
                <p className="text-white/50 mb-8 max-w-lg mx-auto">
                  Start with the free toolkit — no login needed. Or set up your first class
                  and see what it feels like when the platform actually works with you.
                </p>
                <div className="flex flex-wrap gap-4 justify-center">
                  <Link href="/teacher/login" className="px-8 py-3.5 bg-white text-brand-purple rounded-full font-semibold hover:bg-white/90 transition text-base shadow-lg">
                    Get Started
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
            <p className="text-xs text-white/30">The platform for project-based classrooms. Works with IB MYP, GCSE, ACARA, PLTW &amp; more.</p>
            <div className="flex items-center gap-4">
              <Link href="/toolkit" className="text-xs text-white/40 hover:text-white/70 transition">Toolkit</Link>
              <Link href="/login" className="text-xs text-white/40 hover:text-white/70 transition">Students</Link>
              <Link href="/teacher/login" className="text-xs text-white/40 hover:text-white/70 transition">Teachers</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
