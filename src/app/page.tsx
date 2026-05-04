import Link from "next/link";
import { WaveDivider } from "@/components/ui/WaveDivider";
import AnimatedJourneyPhase from "@/components/landing/AnimatedJourneyPhase";
// ProcessSteps removed from hero — style now used as phase pills on each section

/* ------------------------------------------------------------------ */
/*  SVG icon helpers (no lucide-react in project)                      */
/* ------------------------------------------------------------------ */

const IconArrowRight = () => (
  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Journey phase mock visuals (CSS-only, no images needed)            */
/* ------------------------------------------------------------------ */

function MockPlan() {
  const units = [
    { title: "Sustainable Packaging", type: "Design", typeColor: "bg-teal-500", img: "https://images.unsplash.com/photo-1605000797499-95a51c5269ae?w=400&h=400&fit=crop&crop=center", lessons: 12, rotate: "-6deg", z: 1, left: "0%", top: "18px" },
    { title: "Community Garden", type: "Service", typeColor: "bg-pink-500", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop&crop=center", lessons: 8, rotate: "2deg", z: 3, left: "30%", top: "0px" },
    { title: "Smart Home Prototype", type: "Design", typeColor: "bg-teal-500", img: "https://images.unsplash.com/photo-1558002038-1055907df827?w=400&h=400&fit=crop&crop=center", lessons: 15, rotate: "5deg", z: 2, left: "58%", top: "24px" },
  ];
  return (
    <div className="py-4">
      <div className="relative h-[320px] md:h-[360px]">
        {units.map((u) => (
          <div
            key={u.title}
            className="absolute w-[52%] md:w-[48%] transition-transform duration-300 hover:scale-105 hover:!z-40"
            style={{ transform: `rotate(${u.rotate})`, zIndex: u.z, left: u.left, top: u.top }}
          >
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.img} alt={u.title} className="w-full aspect-[4/3] object-cover" loading="lazy" />
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[9px] md:text-[10px] px-2 py-0.5 rounded-full text-white font-semibold ${u.typeColor}`}>{u.type}</span>
                  <span className="text-[10px] md:text-[11px] text-gray-400">{u.lessons} lessons</span>
                </div>
                <div className="text-sm md:text-base font-semibold text-gray-800 leading-tight">{u.title}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center text-[11px] text-gray-400 pt-2">Browse hundreds more or build your own →</div>
    </div>
  );
}

function MockTeach() {
  return (
    <div className="space-y-4">
      {/* Student lesson page mock */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        {/* Lesson header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-3.5">
          <div className="text-[9px] text-white/50 uppercase tracking-wider mb-0.5">Lesson 4 of 12</div>
          <div className="text-sm font-bold text-white">Exploring Sustainable Materials</div>
        </div>
        <div className="p-4 space-y-3">
          {/* Video/media block */}
          <div className="bg-gray-100 rounded-lg p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5,3 19,12 5,21" fill="#ef4444"/></svg>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-700">How sustainable packaging is made</div>
              <div className="text-[9px] text-gray-400">3 min video • auto-pauses for reflection</div>
            </div>
          </div>
          {/* Response types */}
          <div className="space-y-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100">
              <div className="text-[9px] text-purple-600 font-semibold mb-1">Written Response</div>
              <div className="h-6 bg-white rounded border border-gray-200 flex items-center px-2"><span className="text-[8px] text-gray-300">Compare two materials you researched...</span></div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <div className="text-[9px] text-pink-600 font-semibold mb-1">Upload Photo</div>
                <div className="text-[8px] text-gray-400">of your prototype</div>
              </div>
              <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                <div className="text-[9px] text-amber-600 font-semibold mb-1">Voice Note</div>
                <div className="text-[8px] text-gray-400">explain your choice</div>
              </div>
            </div>
          </div>
          {/* Feature badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { label: "Extension ready", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
              { label: "ELL scaffolding", color: "bg-blue-50 text-blue-600 border-blue-200" },
              { label: "3 UDL checkpoints", color: "bg-purple-50 text-purple-600 border-purple-200" },
              { label: "Integrity monitored", color: "bg-gray-50 text-gray-500 border-gray-200" },
            ].map((b) => (
              <span key={b.label} className={`text-[8px] font-medium px-2 py-0.5 rounded-full border ${b.color}`}>{b.label}</span>
            ))}
          </div>
        </div>
      </div>
      {/* Teacher dashboard mini — live tracking */}
      <div className="bg-gray-900 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[10px] text-gray-400">Teacher Dashboard — Live</span>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">24 active</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: "Active", val: "21", color: "text-green-400" },
            { label: "Slow", val: "2", color: "text-amber-400" },
            { label: "Flagged", val: "1", color: "text-red-400" },
            { label: "Done", val: "4", color: "text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="bg-white/5 rounded-md px-2 py-1.5 text-center">
              <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
              <div className="text-[8px] text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 bg-white/5 rounded-md px-2.5 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400"/>
          <span className="text-[9px] text-gray-400">Maya — high paste ratio detected, review integrity report</span>
        </div>
      </div>
    </div>
  );
}

function MockStudentWork() {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg">
      {/* Discovery station backgrounds strip */}
      <div className="grid grid-cols-2 grid-rows-2 h-[320px] md:h-[400px]">
        {/* eslint-disable @next/next/no-img-element */}
        <img src="/discovery/backgrounds/s1-campfire.webp" alt="" className="w-full h-full object-cover" loading="lazy" />
        <img src="/discovery/backgrounds/s3-collection.webp" alt="" className="w-full h-full object-cover" loading="lazy" />
        <img src="/discovery/backgrounds/s6-crossroads.webp" alt="" className="w-full h-full object-cover" loading="lazy" />
        <img src="/discovery/backgrounds/s7-launchpad.webp" alt="" className="w-full h-full object-cover" loading="lazy" />
        {/* eslint-enable @next/next/no-img-element */}
      </div>
      {/* Soft overlay to unify the panels */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 pointer-events-none" />
      {/* Kit mentor avatar — centred circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-28 h-28 md:w-36 md:h-36 rounded-full border-4 border-white shadow-xl overflow-hidden bg-purple-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/discovery/kit/encouraging.png" alt="Kit, your AI design mentor" className="w-full h-full object-cover" loading="lazy" />
        </div>
      </div>
      {/* Label */}
      <div className="absolute bottom-4 left-0 right-0 text-center z-10">
        <span className="inline-block px-4 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 shadow-sm">
          AI Mentor &middot; 8 Discovery Stations &middot; 42 Thinking Tools
        </span>
      </div>
    </div>
  );
}

function MockData() {
  const students = [
    { name: "Maya T.", avatar: "M", pages: [3,3,3,2,2,1,0,0], pace: "on-track", integrity: 92, flag: null },
    { name: "Liam K.", avatar: "L", pages: [3,3,3,3,3,3,2,1], pace: "ahead", integrity: 88, flag: null },
    { name: "Sophie R.", avatar: "S", pages: [3,3,2,2,1,0,0,0], pace: "behind", integrity: 45, flag: "paste" },
    { name: "Aiden W.", avatar: "A", pages: [3,3,3,3,2,2,1,0], pace: "on-track", integrity: 91, flag: null },
    { name: "Zara M.", avatar: "Z", pages: [3,3,3,2,0,0,0,0], pace: "stuck", integrity: 78, flag: "stuck" },
    { name: "Noah C.", avatar: "N", pages: [3,3,3,3,3,2,2,1], pace: "ahead", integrity: 95, flag: null },
  ];
  const cellColor = (v: number) => v === 3 ? "bg-emerald-400" : v === 2 ? "bg-emerald-200" : v === 1 ? "bg-amber-200" : "bg-gray-100";
  const paceColor = (p: string) => p === "ahead" ? "text-emerald-600 bg-emerald-50" : p === "on-track" ? "text-blue-600 bg-blue-50" : p === "behind" ? "text-amber-600 bg-amber-50" : "text-red-600 bg-red-50";

  return (
    <div className="space-y-3">
      {/* Progress grid */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 md:p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-700">Sustainable Packaging — 10B</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">18/24 on track</span>
        </div>
        {/* Column headers */}
        <div className="grid gap-1 mb-1.5" style={{ gridTemplateColumns: "90px 28px repeat(8, 1fr) 52px 36px" }}>
          <div className="text-[9px] text-gray-400 font-medium">Student</div>
          <div />
          {["L1","L2","L3","L4","L5","L6","L7","L8"].map(l => (
            <div key={l} className="text-[8px] text-gray-300 text-center font-medium">{l}</div>
          ))}
          <div className="text-[8px] text-gray-400 text-center font-medium">Pace</div>
          <div className="text-[8px] text-gray-400 text-center font-medium">WI</div>
        </div>
        {/* Student rows */}
        {students.map((s) => (
          <div key={s.name} className="grid gap-1 items-center py-[3px]" style={{ gridTemplateColumns: "90px 28px repeat(8, 1fr) 52px 36px" }}>
            <div className="text-[11px] text-gray-700 font-medium truncate">{s.name}</div>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${s.flag === "stuck" ? "bg-red-400" : s.flag === "paste" ? "bg-amber-400" : "bg-purple-400"}`}>{s.avatar}</div>
            {s.pages.map((v, i) => (
              <div key={i} className={`h-4 rounded-[3px] ${cellColor(v)}`} />
            ))}
            <div className={`text-[8px] font-semibold text-center rounded-full px-1 py-0.5 ${paceColor(s.pace)}`}>{s.pace === "on-track" ? "on track" : s.pace}</div>
            <div className={`text-[9px] font-bold text-center ${s.integrity < 60 ? "text-red-500" : s.integrity < 80 ? "text-amber-500" : "text-emerald-500"}`}>{s.integrity}</div>
          </div>
        ))}
        {/* Legend */}
        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-400"/><span className="text-[8px] text-gray-400">Complete</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-200"/><span className="text-[8px] text-gray-400">In progress</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-amber-200"/><span className="text-[8px] text-gray-400">Started</span></div>
          <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-sm bg-gray-100"/><span className="text-[8px] text-gray-400">Not started</span></div>
          <span className="text-[8px] text-gray-300 ml-auto">WI = Writing Integrity</span>
        </div>
      </div>

      {/* Smart Insights — compact */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-700">Smart Insights</span>
          <span className="relative flex h-2 w-2 ml-1"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span></span>
        </div>
        <div className="space-y-2">
          {[
            { dot: "bg-red-400", label: "Zara stuck on Lesson 5 for 48h", sub: "Needs help" },
            { dot: "bg-amber-400", label: "Sophie — integrity flag (high paste ratio)", sub: "Review work" },
            { dot: "bg-blue-400", label: "3 students have unmarked work (7+ days)", sub: "Grade pending" },
          ].map((insight, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${insight.dot}`} />
              <div className="min-w-0">
                <div className="text-[11px] text-gray-700 truncate">{insight.label}</div>
                <div className="text-[9px] text-gray-400">{insight.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MockAssess() {
  return (
    <div className="space-y-4">
      {/* Student work photo */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
        <img
          src="https://images.unsplash.com/photo-1576595580361-90a855b84b20?w=800&h=300&fit=crop&crop=center"
          alt="Student working on design project"
          className="w-full h-40 md:h-48 object-cover"
          loading="lazy"
        />
      </div>
      {/* Criterion scores + gallery */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-3">
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
        <div className="flex items-center gap-2 pt-1">
          <div className="flex -space-x-2">
            {[0,1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white"/>)}
          </div>
          <span className="text-[10px] text-gray-500">12 peer reviews completed this round</span>
        </div>
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
        <section className="relative z-10 max-w-6xl mx-auto px-6 pt-12 md:pt-20 pb-16 md:pb-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6">
              The platform for classrooms that{" "}
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

          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-6 mt-12 text-xs text-white/30">
            <span>6 Frameworks</span>
            <span className="text-white/15">|</span>
            <span>42 Thinking Tools</span>
            <span className="text-white/15">|</span>
            <span>Built for how teachers actually teach</span>
          </div>
        </section>
      </div>

      {/* Wave transition: dark hero → white content — negative margin pulls wave into hero */}
      <div className="gradient-hero -mt-1">
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="block w-full h-12 md:h-16 lg:h-20">
          <path d="M0,30 C320,80 640,0 960,40 C1120,60 1320,50 1440,30 L1440,80 L0,80 Z" className="fill-white" />
        </svg>
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* THE JOURNEY — 5 phases of the teaching cycle                  */}
      {/* ══════════════════════════════════════════════════════════════ */}

      {/* Phase 1: Plan */}
      <section className="bg-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedJourneyPhase
            tag="Phase 1 — Plan"
            tagColor="text-purple-600"
            pill={{ step: 1, label: "Plan", accent: "#a855f7", gradientFrom: "from-purple-500/30", gradientTo: "to-purple-600/10" }}
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
          <AnimatedJourneyPhase
            tag="Phase 2 — Deliver"
            tagColor="text-emerald-600"
            pill={{ step: 2, label: "Deliver", accent: "#3b82f6", gradientFrom: "from-blue-500/30", gradientTo: "to-blue-600/10" }}
            headline="Every unit comes with"
            headlineAccent="the materials students actually use."
            description="Lessons arrive ready to present — multimedia content, multiple submission types, extensions for early finishers, and language scaffolding built in. Students work through rich, structured activities while the platform silently tracks writing integrity, time on task, and effort signals."
            bullets={[
              "Multimedia lessons with video, images, and interactive prompts — students submit via text, photo upload, voice, canvas, or embedded thinking tools",
              "Automatic extension activities for early finishers, matched to the current design phase",
              "3-tier ELL scaffolding: sentence starters, guided prompts, and stretch challenges — every lesson, every student",
              "UDL checkpoints and inclusive learning practices baked into activities, not bolted on afterward",
              "Live teacher dashboard tracks progress, pace, and writing integrity — flagging issues as they happen",
            ]}
            visual={<MockTeach />}
            reverse
          />
        </div>
      </section>

      {/* Phase 3: Students Work — the emotional centrepiece */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedJourneyPhase
            tag="Phase 3 — Students Work"
            tagColor="text-pink-600"
            pill={{ step: 3, label: "Students Work", accent: "#ec4899", gradientFrom: "from-pink-500/30", gradientTo: "to-pink-600/10" }}
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
          <AnimatedJourneyPhase
            tag="Phase 4 — See Everything"
            tagColor="text-blue-600"
            pill={{ step: 4, label: "See Everything", accent: "#6366f1", gradientFrom: "from-indigo-500/30", gradientTo: "to-indigo-600/10" }}
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
          <AnimatedJourneyPhase
            tag="Phase 5 — Assess & Showcase"
            tagColor="text-violet-600"
            pill={{ step: 5, label: "Assess & Showcase", accent: "#8b5cf6", gradientFrom: "from-violet-500/30", gradientTo: "to-violet-600/10" }}
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
              <Link href="/privacy" className="text-xs text-white/40 hover:text-white/70 transition">Privacy</Link>
              <Link href="/terms" className="text-xs text-white/40 hover:text-white/70 transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
