import Link from "next/link";
import { WaveDivider } from "@/components/ui/WaveDivider";

/* ------------------------------------------------------------------ */
/*  Section components                                                 */
/* ------------------------------------------------------------------ */

function FeatureCard({ icon, title, desc, color }: { icon: React.ReactNode; title: string; desc: string; color: string }) {
  return (
    <div className="relative rounded-2xl border border-border p-6 bg-white overflow-hidden group hover:shadow-lg hover:shadow-brand-purple/5 transition-all duration-300 hover:-translate-y-0.5">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" style={{ background: `${color}08` }} />
      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${color}12` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <h3 className="text-base font-bold mb-1.5 text-text-primary">{title}</h3>
        <p className="text-sm text-text-secondary leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

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

const IconLayers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const IconClock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
  </svg>
);

const IconMessageCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

const IconBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconEdit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);

const IconEye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);

const IconCompass = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const IconUnlock = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const IconStar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const IconArrowRight = () => (
  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

const IconCheck = () => (
  <svg className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white/80 mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
              Built by a Design Teacher
            </div>
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

        <WaveDivider fillClass="fill-white" />
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 1. THE TEACHING COCKPIT — Live classroom control               */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="gradient-hero relative">
        <WaveDivider direction="top" fillClass="fill-white" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-lilac mb-3 block">Teaching Mode</span>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Your Classroom. At a Glance.</h2>
              <p className="text-white/50 max-w-xl mx-auto">
                A live dashboard that shows who&apos;s working, who&apos;s stuck, and who needs you — so you can spend your time
                where it matters most. Open the projector view on the big screen. Keep the controls on your laptop.
              </p>
            </div>

            {/* Teaching Mode mockup */}
            <div className="mb-10 max-w-3xl mx-auto rounded-xl overflow-hidden border border-white/10 bg-black/40 shadow-2xl shadow-brand-purple/10">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                </div>
                <span className="text-[10px] text-white/30 ml-2">Teaching Mode — Unit: Sustainable Packaging</span>
              </div>
              {/* 3-column layout mockup */}
              <div className="grid grid-cols-[140px_1fr_140px] gap-px bg-white/5 p-3 min-h-[140px]">
                {/* Left: Lesson nav */}
                <div className="space-y-1.5">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2 px-1">Lessons</div>
                  {["1. Discover", "2. Define", "3. Ideate", "4. Prototype"].map((l, i) => (
                    <div key={l} className={`text-[10px] px-2 py-1.5 rounded-md ${i === 2 ? "bg-brand-purple/30 text-white font-semibold" : "text-white/40"}`}>{l}</div>
                  ))}
                </div>
                {/* Center: Student grid */}
                <div className="px-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] text-white/30 uppercase tracking-wider">Work Time — 18:42 remaining</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-accent-green/20 text-accent-green">● Live</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { c: "bg-accent-green/20", t: "✓" },
                      { c: "bg-accent-green/20", t: "✓" },
                      { c: "bg-amber-500/20", t: "…" },
                      { c: "bg-accent-green/20", t: "✓" },
                      { c: "bg-red-400/20", t: "!" },
                      { c: "bg-accent-green/20", t: "✓" },
                      { c: "bg-accent-green/20", t: "✓" },
                      { c: "bg-amber-500/20", t: "…" },
                    ].map((s, i) => (
                      <div key={i} className={`${s.c} rounded-md h-8 flex items-center justify-center text-[10px] text-white/60`}>{s.t}</div>
                    ))}
                  </div>
                  <div className="mt-2 text-[9px] text-white/25">1 student needs help · 6 on track · 1 completing</div>
                </div>
                {/* Right: Notes */}
                <div className="space-y-1.5">
                  <div className="text-[9px] text-white/30 uppercase tracking-wider mb-2 px-1">Notes</div>
                  <div className="text-[9px] text-white/30 px-1 leading-relaxed">Sarah — check prototype</div>
                  <div className="text-[9px] text-white/30 px-1 leading-relaxed">Extension: materials test</div>
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-5">
              {[
                { icon: <IconGrid />, title: "Live Student Grid", desc: "See every student's current page, time spent, and status. \"Needs Help\" flags appear after 3 minutes of inactivity.", color: "#2E86AB" },
                { icon: <IconClock />, title: "Phase Timer", desc: "Workshop Model phases (Opening → Mini-Lesson → Work Time → Debrief) with countdown, 60-second warning pulse, and one-click skip.", color: "#2DA05E" },
                { icon: <IconPlay />, title: "Projector View", desc: "Dark-themed second screen showing the current phase, key content, and activities. Syncs automatically from your dashboard.", color: "#8B2FC9" },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: `${f.color}20` }}>
                    <div style={{ color: f.color }}>{f.icon}</div>
                  </div>
                  <h3 className="font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-white/50 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <p className="text-white/40 text-sm">
                One click from your dashboard. Pre-selects the right class. Works with your rotating timetable.
              </p>
            </div>
          </div>
        </section>
        <WaveDivider fillClass="fill-surface-alt" />
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 3. THE STUDENT JOURNEY — What the student experience looks like */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-surface-alt text-text-primary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-accent-blue mb-3 block">Student Experience</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Students Own Their Design Journey</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Self-paced lessons, structured scaffolding, and a portfolio that builds itself.
              You set the direction — they navigate it without waiting for you to say &ldquo;next.&rdquo;
            </p>
          </div>

          {/* Journey steps as horizontal flow */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: "01", title: "Scaffolded Lessons", icon: <IconBook />, color: "#2E86AB",
                desc: "Activity-first pages with 10+ response types (text, voice, upload, canvas, decision matrix). 3-tier ELL support on every page."
              },
              {
                step: "02", title: "Guided Mentor", icon: <IconMessageCircle />, color: "#7B2FF2",
                desc: "When students get stuck, a Socratic mentor asks questions instead of giving answers — adapting to their effort level and language.",
                avatar: "/discovery/kit/encouraging.png"
              },
              {
                step: "03", title: "Peer Critique", icon: <IconUsers />, color: "#E86F2C",
                desc: "Pin-up gallery rounds where students review each other's work using structured formats. Feedback unlocks only after reviewing peers."
              },
              {
                step: "04", title: "Living Portfolio", icon: <IconEdit />, color: "#2DA05E",
                desc: "Every response, reflection, and photo auto-flows into a timeline portfolio. Quick Capture Bar for notes on the go. Export as PDF anytime."
              },
            ].map((item) => (
              <div key={item.step} className="bg-white rounded-2xl border border-border p-6 relative">
                <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: item.color }}>Step {item.step}</div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${item.color}12` }}>
                    <div style={{ color: item.color }}>{item.icon}</div>
                  </div>
                  {/* Kit avatar on the Guided Mentor card */}
                  {"avatar" in item && item.avatar && (
                    <div className="w-10 h-10 rounded-full overflow-hidden border-2 shadow-sm" style={{ borderColor: `${item.color}40` }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.avatar} alt="Kit mentor" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-text-primary mb-1.5">{item.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Additional student features as compact list */}
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 max-w-4xl mx-auto">
            {[
              "Personal project timeline with Gantt chart",
              "Design thinking tools available on every page",
              "Open Studio mode for self-directed work",
              "Discovery Journey to find their project direction",
              "Pace feedback (one tap) after each lesson",
              "Safety badges earned before using equipment",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <IconCheck />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 4. YOU'RE THE TEACHER — AI supports, doesn't replace           */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white text-text-primary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Your Classroom, Your Way</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">You&apos;re the Teacher. We&apos;re the Extra Pair of Hands.</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              StudioLoom doesn&apos;t replace your expertise — it handles the things that pull you away from teaching.
              You circulate. You mentor. You decide when a student is ready. The platform keeps everything else running.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left column: What YOU do */}
            <div className="rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-brand-purple/5">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-brand-purple/10 flex items-center justify-center text-brand-purple">
                  <IconStar />
                </span>
                What You Do
              </h3>
              <ul className="space-y-3">
                {[
                  "Decide which units to teach and how to adapt them",
                  "Unlock Open Studio when a student earns independence",
                  "Run gallery rounds and set the critique culture",
                  "Monitor integrity signals and make the judgment calls",
                  "Drag lesson phases to match your class's rhythm",
                  "Observe competency growth and write the final assessments",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <IconCheck />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right column: What THE PLATFORM does */}
            <div className="rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-accent-blue/5">
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue">
                  <IconLayers />
                </span>
                What the Platform Does
              </h3>
              <ul className="space-y-3">
                {[
                  "Generates lesson scaffolding following the Workshop Model",
                  "Guides stuck students with Socratic questions (never gives answers)",
                  "Tracks progress, flags inactivity, and surfaces who needs help",
                  "Enforces safety badge requirements before equipment access",
                  "Auto-saves portfolios and captures the design process",
                  "Silently monitors writing behaviour for integrity evidence",
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <IconCheck />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 5. TEACHER TOOLS — Building, editing, managing                 */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-surface-alt text-text-primary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-pink mb-3 block">Teacher Tools</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Build, Edit, and Run Your Units</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              From AI-assisted unit generation to drag-and-drop lesson editing. Customise per class without losing the original.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<IconLayers />}
              title="AI Unit Builder"
              desc="7-step wizard generates scaffolded units with criterion alignment, ELL support, and 20 configurable emphasis dials."
              color="#8B2FC9"
            />
            <FeatureCard
              icon={<IconEdit />}
              title="Drag-and-Drop Lesson Editor"
              desc="Reorder activities, add from 6 templates, get AI suggestions for hooks and debrief protocols. Auto-saves with undo."
              color="#2E86AB"
            />
            <FeatureCard
              icon={<IconGrid />}
              title="Per-Class Customisation"
              desc="Same unit, different classes, different versions. Edit a lesson for one class — the others keep the original. Fork on first edit."
              color="#E86F2C"
            />
            <FeatureCard
              icon={<IconShield />}
              title="Safety Badge System"
              desc="Create badges with learning cards and 5 question types. Students earn them before accessing equipment. Results tracked per class."
              color="#2DA05E"
            />
            <FeatureCard
              icon={<IconCalendar />}
              title="Timetable & Scheduling"
              desc="Rotating cycle timetable (5-10 day cycles). Import holidays from iCal. Map lessons to real dates with per-lesson overrides."
              color="#8B2FC9"
            />
            <FeatureCard
              icon={<IconEye />}
              title="Academic Integrity"
              desc="Silent writing analytics track paste events, typing patterns, and focus loss. You see the evidence — students see a normal textarea."
              color="#E86F2C"
            />
          </div>

          {/* Additional teacher features */}
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 max-w-4xl mx-auto">
            {[
              "Knowledge base with PDF/DOCX/PPTX upload + AI analysis",
              "Workshop Model enforced in every AI-generated lesson",
              "Grading with framework-specific criterion scores",
              "Competency assessments (Melbourne Metrics)",
              "School calendar with terms and academic years",
              "Student learning profiles for personalisation",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2.5 text-sm text-text-secondary">
                <IconCheck />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 6. WORKS WITH YOUR SCHOOL — Frameworks + LMS                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div className="gradient-hero relative">
        <WaveDivider direction="top" fillClass="fill-surface-alt" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Left: Frameworks */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-lilac mb-3 block">Frameworks</span>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">Speaks Your Curriculum&apos;s Language</h2>
                <p className="text-white/50 mb-6 text-sm leading-relaxed">
                  Every unit, rubric, and AI prompt is aware of your framework&apos;s command verbs,
                  assessment criteria, and grade boundaries. Switch frameworks and the vocabulary adapts instantly.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: "IB MYP", active: true },
                    { name: "GCSE DT", active: true },
                    { name: "A-Level DT", active: true },
                    { name: "ACARA", active: true },
                    { name: "PLTW", active: true },
                    { name: "IGCSE DT", active: true },
                  ].map((fw) => (
                    <span key={fw.name} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${fw.active ? "border-accent-green/40 bg-accent-green/15 text-white" : "border-white/10 bg-white/5 text-white/40"} border`}>
                      {fw.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: LMS */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-lilac mb-3 block">Integrations</span>
                <h2 className="text-2xl md:text-3xl font-bold mb-4">Connects With Your LMS</h2>
                <p className="text-white/50 mb-6 text-sm leading-relaxed">
                  Students log in from ManageBac, Canvas, or Google Classroom — no extra passwords.
                  Or use simple class codes for schools without an LMS.
                </p>
                <div className="space-y-2.5">
                  {[
                    { name: "ManageBac", status: "LTI 1.0a" },
                    { name: "Canvas", status: "Coming soon" },
                    { name: "Google Classroom", status: "Coming soon" },
                    { name: "Schoology / Toddle", status: "Planned" },
                  ].map((lms) => (
                    <div key={lms.name} className="flex items-center gap-3 text-sm">
                      <span className="text-white/80 font-medium w-36">{lms.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${lms.status === "LTI 1.0a" ? "bg-accent-green/20 text-accent-green" : "bg-white/5 text-white/30"}`}>
                        {lms.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <WaveDivider fillClass="fill-[#0c0a1a]" />
      </div>


      {/* ══════════════════════════════════════════════════════════════ */}
      {/* 6. FREE TOOLKIT — Dark-themed showcase                        */}
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
      {/* 7. OPEN STUDIO + DISCOVERY — The progression story             */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <section className="bg-white text-text-primary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Student Independence</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">From Guided Lessons to Self-Directed Work</h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Not every student is ready for independence at the same time.
              You decide when each student has earned the right to work freely.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border p-6 bg-gradient-to-br from-white to-accent-blue/5 relative">
              <div className="w-10 h-10 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-4 text-accent-blue">
                <IconBook />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent-blue mb-2">Phase 1</div>
              <h3 className="text-base font-bold mb-2">Guided Lessons</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Structured, scaffolded pages with activities, checkpoints, and a Socratic mentor
                that asks questions when students get stuck. The AI never gives answers.
              </p>
            </div>

            <div className="rounded-2xl border border-brand-purple/20 p-6 bg-gradient-to-br from-brand-purple/5 to-white relative overflow-hidden">
              <div className="w-10 h-10 rounded-xl bg-brand-purple/10 flex items-center justify-center mb-4 text-brand-purple">
                <IconCompass />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-purple mb-2">Phase 2</div>
              <h3 className="text-base font-bold mb-2">Discovery Journey</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                An interactive 8-station exploration where students discover their design identity,
                interests, and project direction — guided by Kit, a mentor character.
              </p>
              {/* Discovery station preview strip */}
              <div className="relative flex gap-1.5 rounded-xl overflow-hidden">
                {["s1-campfire", "s3-collection", "s6-crossroads", "s7-launchpad"].map((bg) => (
                  <div key={bg} className="relative w-1/4 h-16 rounded-lg overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/discovery/backgrounds/${bg}.webp`} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-brand-purple/20" />
                  </div>
                ))}
                {/* Kit avatar overlapping the strip */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full border-2 border-white shadow-lg overflow-hidden bg-brand-purple/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/discovery/kit/excited.png" alt="Kit mentor" className="w-full h-full object-cover" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-accent-green/20 p-6 bg-gradient-to-br from-accent-green/5 to-white relative">
              <div className="w-10 h-10 rounded-xl bg-accent-green/10 flex items-center justify-center mb-4 text-accent-green">
                <IconUnlock />
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-accent-green mb-2">Phase 3</div>
              <h3 className="text-base font-bold mb-2">Open Studio</h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                Teacher-unlocked self-directed mode. The AI switches from tutor to studio critic.
                Check-ins keep students on track. Drift detection escalates to you if needed.
              </p>
            </div>
          </div>
        </div>
      </section>


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
