import Link from "next/link";
import { WaveDivider } from "@/components/ui/WaveDivider";
import { FeaturesCarousel } from "@/components/landing/FeaturesCarousel";

/* ------------------------------------------------------------------ */
/*  Inline SVG helper components for visual flair                     */
/* ------------------------------------------------------------------ */

function HeroIllustration() {
  return (
    <div className="relative w-full max-w-2xl mx-auto" style={{ height: 480 }}>
      {/* ---- CARD 1: Teacher Unit Dashboard (back, tilted left) ---- */}
      <div className="absolute -left-4 top-0 w-[92%] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white" style={{ transform: "rotate(-3deg)" }}>
        {/* Mini browser bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-[8px] text-gray-400 font-mono">studioloom.org/teacher/classes</span>
          </div>
        </div>

        {/* Teacher dashboard content */}
        <div className="p-3">
          {/* Dashboard header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[10px] font-bold text-gray-800">My Units</div>
              <div className="text-[7px] text-gray-400">MYP Design — Grade 9</div>
            </div>
            <div className="px-2 py-1 rounded-lg text-[7px] font-semibold text-white" style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}>
              + New Unit
            </div>
          </div>

          {/* Unit cards grid — 3 columns of colourful cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { title: "Arcade Game", subject: "Digital Design", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=130&fit=crop", students: 28, progress: 72 },
              { title: "Sustainable Chair", subject: "Product Design", color: "#2E86AB", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=200&h=130&fit=crop", students: 26, progress: 45 },
              { title: "Smart Garden", subject: "Electronics", color: "#2DA05E", img: "https://images.unsplash.com/photo-1585399000684-d2f72660f092?w=200&h=130&fit=crop", students: 24, progress: 88 },
              { title: "Bridge Challenge", subject: "Systems Design", color: "#E86F2C", img: "https://images.unsplash.com/photo-1545296664-39db56ad95bd?w=200&h=130&fit=crop", students: 30, progress: 31 },
              { title: "Stop Motion Film", subject: "Digital Design", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=200&h=130&fit=crop", students: 22, progress: 56 },
              { title: "Solar Charger", subject: "Electronics", color: "#E86F2C", img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=200&h=130&fit=crop", students: 28, progress: 15 },
            ].map((unit) => (
              <div key={unit.title} className="rounded-lg overflow-hidden border border-gray-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={unit.img} alt="" className="w-full h-16 object-cover" loading="lazy" />
                <div className="p-1.5">
                  <div className="text-[7px] font-bold text-gray-800 leading-tight">{unit.title}</div>
                  <div className="text-[5px] text-gray-400 mb-1">{unit.subject}</div>
                  {/* Progress bar */}
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${unit.progress}%`, backgroundColor: unit.color }} />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[5px] text-gray-400">{unit.students} students</span>
                    <span className="text-[5px] font-medium" style={{ color: unit.color }}>{unit.progress}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- CARD 2: Gantt Chart (front, tilted right) ---- */}
      <div className="absolute -right-2 top-28 w-[88%] rounded-2xl overflow-hidden shadow-2xl border border-gray-200 bg-white" style={{ transform: "rotate(2deg)", zIndex: 10 }}>
        {/* Mini header bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <div className="w-2 h-2 rounded-full bg-yellow-400" />
            <div className="w-2 h-2 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <span className="text-[8px] text-gray-400 font-mono">studioloom.org/unit/arcade-game/B4</span>
          </div>
        </div>

        <div className="flex">
          {/* Left: page content (dimmed) */}
          <div className="flex-1 p-3 opacity-40">
            <div className="text-[7px] text-gray-400 font-bold mb-1">B4: Develop a detailed plan</div>
            <div className="h-2 w-3/4 bg-gray-200 rounded mb-1.5" />
            <div className="h-2 w-full bg-gray-100 rounded mb-1" />
            <div className="h-2 w-5/6 bg-gray-100 rounded" />
          </div>

          {/* Right: Gantt panel */}
          <div className="w-[62%] bg-white border-l border-gray-200 p-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-bold text-gray-800">📅 Schedule</span>
              <span className="text-[7px] text-gray-400">5 tasks</span>
            </div>

            {/* B4 tip */}
            <div className="px-2 py-1 bg-[#2DA05E]/8 border border-[#2DA05E]/15 rounded text-[6px] text-[#2DA05E] mb-2">
              💡 Plan your project timeline here — this connects to B4!
            </div>

            {/* Week headers */}
            <div className="flex mb-1 pl-16">
              {["Mon 3", "Mon 10", "Mon 17", "Mon 24"].map((w) => (
                <div key={w} className="flex-1 text-[5px] text-gray-400 text-center">{w}</div>
              ))}
            </div>

            {/* Gantt rows */}
            <div className="space-y-1.5">
              {[
                { name: "Research clients", page: "A1", color: "#2E86AB", start: 0, width: 30 },
                { name: "Sketch ideas", page: "B2", color: "#2DA05E", start: 15, width: 35 },
                { name: "Build prototype", page: "C1", color: "#E86F2C", start: 35, width: 45 },
                { name: "Test & iterate", page: "C3", color: "#E86F2C", start: 55, width: 25 },
                { name: "Final evaluation", page: "D1", color: "#8B2FC9", start: 72, width: 22 },
              ].map((task) => (
                <div key={task.name} className="flex items-center gap-1">
                  <div className="w-14 flex-shrink-0 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: task.color }} />
                    <span className="text-[6px] text-gray-600 truncate">{task.name}</span>
                  </div>
                  <div className="flex-1 relative h-3 bg-gray-50 rounded-sm">
                    <div
                      className="absolute top-0.5 h-2 rounded-full"
                      style={{
                        left: `${task.start}%`,
                        width: `${task.width}%`,
                        backgroundColor: task.color,
                        opacity: 0.7,
                      }}
                    />
                  </div>
                  <span className="text-[5px] text-gray-400 w-4 text-right flex-shrink-0">{task.page}</span>
                </div>
              ))}
            </div>

            {/* Today marker label */}
            <div className="flex items-center gap-1 mt-2 pl-16">
              <div className="h-px flex-1 bg-[#FF3366]/40" />
              <span className="text-[5px] font-bold text-[#FF3366]">TODAY</span>
              <div className="h-px flex-1 bg-[#FF3366]/40" />
            </div>

            {/* Milestone markers */}
            <div className="flex mt-1.5 pl-16 gap-2">
              {[
                { label: "A4 due", color: "#2E86AB" },
                { label: "C4 due", color: "#E86F2C" },
                { label: "D4 due", color: "#8B2FC9" },
              ].map((m) => (
                <div key={m.label} className="flex items-center gap-0.5">
                  <div className="w-1 h-1 rotate-45" style={{ backgroundColor: m.color }} />
                  <span className="text-[5px] font-medium" style={{ color: m.color }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Glow effects */}
      <div className="absolute inset-0 -z-10 blur-3xl opacity-30">
        <div className="absolute top-1/4 left-0 w-40 h-40 bg-brand-pink rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-white rounded-full" />
      </div>
    </div>
  );
}

/* Sample unit data for the library showcase — Row 1 (10 unique units) */
const UNITS_ROW1 = [
  { title: "Sustainable Packaging", subject: "Product Design", grade: "MYP 4", color: "#2E86AB", img: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?w=400&h=300&fit=crop" },
  { title: "App UI Prototype", subject: "Digital Design", grade: "MYP 5", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=400&h=300&fit=crop" },
  { title: "Bridge Engineering", subject: "Systems Design", grade: "MYP 3", color: "#E86F2C", img: "https://images.unsplash.com/photo-1545296664-39db56ad95bd?w=400&h=300&fit=crop" },
  { title: "Smart Garden Monitor", subject: "Electronics", grade: "MYP 4", color: "#2DA05E", img: "https://images.unsplash.com/photo-1585399000684-d2f72660f092?w=400&h=300&fit=crop" },
  { title: "Ergonomic Workspace", subject: "Product Design", grade: "MYP 5", color: "#2E86AB", img: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&h=300&fit=crop" },
  { title: "Stop-Motion Animation", subject: "Digital Design", grade: "MYP 2", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&h=300&fit=crop" },
  { title: "Solar-Powered Charger", subject: "Electronics", grade: "MYP 4", color: "#E86F2C", img: "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400&h=300&fit=crop" },
  { title: "Board Game Design", subject: "Product Design", grade: "MYP 1", color: "#2DA05E", img: "https://images.unsplash.com/photo-1632501641765-e568d28b0015?w=400&h=300&fit=crop" },
  { title: "Robotic Arm", subject: "Systems Design", grade: "MYP 5", color: "#2E86AB", img: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=400&h=300&fit=crop" },
  { title: "Tiny House Model", subject: "Architecture", grade: "MYP 3", color: "#E86F2C", img: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400&h=300&fit=crop" },
];

/* Row 2 — completely different set (10 unique units) */
const UNITS_ROW2 = [
  { title: "Wearable Tech", subject: "Digital Design", grade: "MYP 4", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=400&h=300&fit=crop" },
  { title: "Aquaponics System", subject: "Systems Design", grade: "MYP 3", color: "#2DA05E", img: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&h=300&fit=crop" },
  { title: "Drone Photography Rig", subject: "Electronics", grade: "MYP 5", color: "#E86F2C", img: "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=400&h=300&fit=crop" },
  { title: "Eco-Friendly Furniture", subject: "Product Design", grade: "MYP 4", color: "#2E86AB", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop" },
  { title: "Interactive Museum Exhibit", subject: "Digital Design", grade: "MYP 3", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&h=300&fit=crop" },
  { title: "Wind Turbine Model", subject: "Systems Design", grade: "MYP 4", color: "#2DA05E", img: "https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=400&h=300&fit=crop" },
  { title: "Assistive Device", subject: "Product Design", grade: "MYP 5", color: "#E86F2C", img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=300&fit=crop" },
  { title: "Podcast Studio Setup", subject: "Digital Design", grade: "MYP 2", color: "#2E86AB", img: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=400&h=300&fit=crop" },
  { title: "Greenhouse Design", subject: "Architecture", grade: "MYP 3", color: "#2DA05E", img: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop" },
  { title: "LED Light Installation", subject: "Electronics", grade: "MYP 1", color: "#8B2FC9", img: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&h=300&fit=crop" },
];

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* ======== HERO (purple gradient) ======== */}
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
            <Link href="/tools/safety" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 text-sm text-white/70 hover:text-white transition">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              Safety Badges
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
        <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs text-white/80 mb-6 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
                Built for MYP Design Teachers
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-6">
                You Teach Design.{" "}
                <br className="hidden md:block" />
                <span className="text-white/90">We Handle the Rest.</span>
              </h1>
              <p className="text-lg text-white/60 mb-8 max-w-md leading-relaxed">
                Project timelines, materials orders, safety checks, overdue
                work — the admin never stops. StudioLoom carries the logistics
                so you can carry the room: circulating, mentoring, and meeting
                each student where they are.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/login" className="group px-7 py-3.5 gradient-cta text-white rounded-full font-semibold hover:opacity-90 transition text-base flex items-center gap-2 shadow-lg shadow-brand-pink/25">
                  Student Login
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <Link href="/teacher/login" className="px-7 py-3.5 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition border border-white/20 text-base backdrop-blur-sm">
                  Teacher Portal
                </Link>
              </div>
            </div>
            <div className="hidden lg:block">
              <HeroIllustration />
            </div>
          </div>
        </section>

        <WaveDivider fillClass="fill-white" />
      </div>

      {/* ======== 3 USPs ======== */}
      <section className="bg-white text-text-primary">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Why StudioLoom</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Less Admin. More Making.</h2>
            <p className="text-text-secondary max-w-lg mx-auto">Three things no other design teaching platform does.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* USP 1: AI Unit Builder */}
            <div className="relative rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-brand-purple/5 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-purple/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Units Built on Real Experience</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Thousands of hours of design teaching distilled into a library of
                  scaffolded, criterion-aligned units. Pick one, make it yours, and
                  tailor it for your next class of unique students.
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-brand-purple font-semibold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  Start proven, then make it yours
                </div>
              </div>
            </div>

            {/* USP 2: Student Ownership */}
            <div className="relative rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-accent-blue/5 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-blue/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Students Own Their Journey</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Self-paced lessons, personal project timelines, and a portfolio
                  that builds itself. You set the direction — they navigate it
                  without waiting for you to say &ldquo;next.&rdquo;
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-accent-blue font-semibold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  You direct traffic less, teach more
                </div>
              </div>
            </div>

            {/* USP 3: Safety Certifications */}
            <div className="relative rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-accent-green/5 overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-green/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="w-12 h-12 rounded-xl bg-accent-green/10 flex items-center justify-center mb-5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2DA05E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2">Safety Certs That Follow the Student</h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Timestamped, quiz-verified safety certifications for every machine
                  in your workshop. Students earn them once — the system enforces them
                  across every unit, every year.
                </p>
                <div className="mt-5 flex items-center gap-2 text-xs text-accent-green font-semibold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  Robust enough for an audit trail
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== FEATURES CAROUSEL ======== */}
      <section className="bg-white text-text-primary">
        <div className="max-w-6xl mx-auto px-6 pt-8 pb-24">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">And so much more</span>
            <h2 className="text-2xl md:text-3xl font-bold mb-4">Everything Else You Need</h2>
            <p className="text-text-secondary max-w-lg mx-auto">Due dates, portfolio export, LMS sync, academic integrity, safety badges — the full toolkit for running a design classroom.</p>
          </div>
          <FeaturesCarousel />
        </div>
      </section>

      {/* ======== FREE DESIGN TOOLKIT SHOWCASE ======== */}
      <section className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #06060f 0%, #0d0d2a 50%, #0f0620 100%)" }}>
        {/* Aurora glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[500px] h-[300px] rounded-full blur-[120px]" style={{ background: "rgba(99,102,241,0.08)" }} />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[250px] rounded-full blur-[100px]" style={{ background: "rgba(168,85,247,0.06)" }} />
          <div className="absolute top-1/2 right-0 w-[300px] h-[300px] rounded-full blur-[100px]" style={{ background: "rgba(236,72,153,0.04)" }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ background: "rgba(129,140,248,0.1)", border: "1px solid rgba(129,140,248,0.2)", color: "#818cf8" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Free for All Teachers
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-5 text-white leading-tight">
                42 Design Thinking Tools.{" "}
                <span style={{ background: "linear-gradient(135deg, #818cf8 0%, #e879f9 50%, #fb923c 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Beautifully Organised.
                </span>
              </h2>
              <p className="text-base mb-6 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                Browse the world&apos;s best collection of visual thinking tools — from Mind Maps to Morphological Charts. Filter by design process phase, deploy as a presentation, printable worksheet, group activity, or solo task. One click.
              </p>

              {/* Framework badges */}
              <div className="flex flex-wrap gap-2 mb-8">
                {["IB MYP", "GCSE DT", "A-Level", "ACARA", "PLTW", "d.school", "IDEO", "Double Diamond"].map((fw) => (
                  <span key={fw} className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                    {fw}
                  </span>
                ))}
              </div>

              <Link href="/toolkit" className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-white text-base transition-all hover:scale-[1.02] shadow-lg" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", boxShadow: "0 8px 32px rgba(99,102,241,0.3)" }}>
                Browse the Design Toolkit
                <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>

            {/* Right: Preview cards */}
            <div className="hidden lg:block relative">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: "Mind Map", color: "#818cf8", svg: '<circle cx="50" cy="50" r="12" fill="#818cf8" opacity="0.8"/><g stroke="#818cf8" stroke-width="1.5" opacity="0.3"><line x1="60" y1="50" x2="85" y2="30"/><line x1="60" y1="50" x2="85" y2="70"/><line x1="40" y1="50" x2="15" y2="30"/><line x1="40" y1="50" x2="15" y2="70"/></g><circle cx="85" cy="30" r="6" fill="#818cf8" opacity="0.4"/><circle cx="85" cy="70" r="5" fill="#818cf8" opacity="0.3"/><circle cx="15" cy="30" r="6" fill="#818cf8" opacity="0.4"/><circle cx="15" cy="70" r="5" fill="#818cf8" opacity="0.3"/>' },
                  { name: "Crazy 8s", color: "#fb923c", svg: '<g stroke="#fb923c" stroke-width="1" opacity="0.2" fill="none"><rect x="5" y="5" width="40" height="40" rx="4"/><rect x="55" y="5" width="40" height="40" rx="4"/><rect x="5" y="55" width="40" height="40" rx="4"/><rect x="55" y="55" width="40" height="40" rx="4"/></g><text x="50" y="100" text-anchor="middle" font-family="monospace" font-size="8" fill="#fb923c" opacity="0.3">8:00</text>' },
                  { name: "Empathy Map", color: "#ec4899", svg: '<circle cx="50" cy="35" r="22" fill="#ec4899" opacity="0.08" stroke="#ec4899" stroke-width="0.8" opacity="0.15"/><line x1="50" y1="57" x2="50" y2="95" stroke="#ec4899" stroke-width="0.5" opacity="0.12"/><line x1="10" y1="75" x2="90" y2="75" stroke="#ec4899" stroke-width="0.5" opacity="0.12"/><text x="30" y="70" font-size="7" fill="#ec4899" opacity="0.3" font-family="sans-serif">Say</text><text x="60" y="70" font-size="7" fill="#ec4899" opacity="0.3" font-family="sans-serif">Think</text><text x="30" y="90" font-size="7" fill="#ec4899" opacity="0.25" font-family="sans-serif">Do</text><text x="60" y="90" font-size="7" fill="#ec4899" opacity="0.25" font-family="sans-serif">Feel</text>' },
                  { name: "SCAMPER", color: "#e879f9", svg: '<g font-family="sans-serif" font-weight="800" font-size="16"><text x="8" y="35" fill="#e879f9" opacity="0.7">S</text><text x="28" y="35" fill="#e879f9" opacity="0.55">C</text><text x="48" y="35" fill="#e879f9" opacity="0.4">A</text><text x="68" y="35" fill="#e879f9" opacity="0.3">M</text></g><g opacity="0.2"><rect x="8" y="48" width="80" height="6" rx="3" fill="#e879f9"/><rect x="8" y="60" width="60" height="6" rx="3" fill="#e879f9"/><rect x="8" y="72" width="70" height="6" rx="3" fill="#e879f9"/></g>' },
                  { name: "SWOT", color: "#06b6d4", svg: '<rect x="8" y="8" width="38" height="38" rx="6" fill="#06b6d4" opacity="0.1"/><rect x="54" y="8" width="38" height="38" rx="6" fill="#06b6d4" opacity="0.14"/><rect x="8" y="54" width="38" height="38" rx="6" fill="#06b6d4" opacity="0.07"/><rect x="54" y="54" width="38" height="38" rx="6" fill="#06b6d4" opacity="0.11"/><text x="27" y="32" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#06b6d4" opacity="0.4">S</text><text x="73" y="32" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="14" fill="#06b6d4" opacity="0.35">W</text>' },
                  { name: "Decision Matrix", color: "#059669", svg: '<g opacity="0.3"><rect x="30" y="10" width="20" height="8" rx="2" fill="#059669"/><rect x="55" y="10" width="20" height="8" rx="2" fill="#059669"/><rect x="80" y="10" width="15" height="8" rx="2" fill="#059669"/></g><g fill="#059669" opacity="0.5"><circle cx="40" cy="35" r="5" opacity="0.6"/><circle cx="65" cy="35" r="4" opacity="0.4"/><circle cx="87" cy="35" r="6" opacity="0.8"/><circle cx="40" cy="55" r="6" opacity="0.8"/><circle cx="65" cy="55" r="5" opacity="0.6"/><circle cx="87" cy="55" r="3" opacity="0.3"/></g>' },
                ].map((tool) => (
                  <div key={tool.name} className="rounded-xl overflow-hidden transition-transform hover:scale-105" style={{ background: "rgba(13,13,26,0.8)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="h-20 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${tool.color}08, ${tool.color}03)` }}>
                      <svg viewBox="0 0 100 100" className="w-16 h-16" dangerouslySetInnerHTML={{ __html: tool.svg }} />
                    </div>
                    <div className="px-3 py-2">
                      <div className="text-[11px] font-semibold text-white/80">{tool.name}</div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Floating count badge */}
              <div className="absolute -bottom-3 -right-3 px-4 py-2 rounded-full text-xs font-bold" style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)", color: "white", boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
                +36 more tools
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Wave → purple integrations */}
      <div className="gradient-hero relative">
        <WaveDivider direction="top" fillClass="fill-white" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-lilac mb-3 block">Integrations</span>
              <h2 className="text-2xl md:text-3xl font-bold mb-3">Connects With Your School&apos;s LMS</h2>
              <p className="text-white/50 max-w-lg mx-auto text-sm">One-click student SSO via LTI and automatic roster sync. Start with ManageBac — Canvas, Schoology, Toddle and others coming soon.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
              {[
                { name: "ManageBac", status: "live" },
                { name: "Canvas", status: "soon" },
                { name: "Schoology", status: "soon" },
                { name: "Toddle", status: "soon" },
                { name: "Google Classroom", status: "planned" },
                { name: "SIMS", status: "planned" },
              ].map((lms) => (
                <div key={lms.name} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition ${lms.status === "live" ? "border-accent-green/40 bg-accent-green/15" : lms.status === "soon" ? "border-white/15 bg-white/5" : "border-white/5 bg-white/[0.02] opacity-50"}`}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={lms.status === "live" ? "text-accent-green" : "text-white/30"}>
                    <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                  </svg>
                  <span className={`text-sm font-medium ${lms.status === "live" ? "text-white" : "text-white/50"}`}>{lms.name}</span>
                  {lms.status === "live" && <span className="text-[10px] font-semibold text-accent-green bg-accent-green/20 px-1.5 py-0.5 rounded-full">LIVE</span>}
                  {lms.status === "soon" && <span className="text-[10px] font-medium text-white/30 bg-white/5 px-1.5 py-0.5 rounded-full">SOON</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
        <WaveDivider fillClass="fill-surface-alt" />
      </div>

      {/* ======== UNIT LIBRARY SECTION ======== */}
      <section className="bg-surface-alt text-text-primary overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-14">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Unit Library</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Stop Building Units from Scratch</h2>
            <p className="text-text-secondary max-w-lg mx-auto">
              Browse the library, adapt an existing unit, or let AI generate one from your brief. Each comes with scaffolded pages, responsive ELL support, and full criterion alignment.
            </p>
          </div>

          {/* Scrolling unit cards grid */}
          <div className="relative overflow-hidden">

            {/* Row 1 — 10 unique units */}
            <div className="flex gap-5 mb-5 animate-[scroll-left_40s_linear_infinite]" style={{ width: "max-content" }}>
              {[...UNITS_ROW1, ...UNITS_ROW1].map((unit, i) => (
                <div key={`r1-${i}`} className="w-56 flex-shrink-0 bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:shadow-brand-purple/5 transition-all duration-300 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="h-32 relative overflow-hidden">
                    <img src={unit.img} alt={unit.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white backdrop-blur-sm bg-black/40">
                      {unit.grade}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: unit.color }}>{unit.subject}</div>
                    <div className="text-sm font-semibold text-text-primary leading-snug">{unit.title}</div>
                    <div className="flex items-center gap-1 mt-2.5">
                      {["#2E86AB", "#2DA05E", "#E86F2C", "#8B2FC9"].map((c, ci) => (
                        <div key={ci} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: 0.5 }} />
                      ))}
                      <span className="text-[10px] text-text-secondary/60 ml-1">4 criteria</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2 — 10 different unique units, reverse direction */}
            <div className="flex gap-5 animate-[scroll-right_45s_linear_infinite]" style={{ width: "max-content" }}>
              {[...UNITS_ROW2, ...UNITS_ROW2].map((unit, i) => (
                <div key={`r2-${i}`} className="w-56 flex-shrink-0 bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg hover:shadow-brand-purple/5 transition-all duration-300 group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <div className="h-32 relative overflow-hidden">
                    <img src={unit.img} alt={unit.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-semibold text-white backdrop-blur-sm bg-black/40">
                      {unit.grade}
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: unit.color }}>{unit.subject}</div>
                    <div className="text-sm font-semibold text-text-primary leading-snug">{unit.title}</div>
                    <div className="flex items-center gap-1 mt-2.5">
                      {["#2E86AB", "#2DA05E", "#E86F2C", "#8B2FC9"].map((c, ci) => (
                        <div key={ci} className="w-2 h-2 rounded-full" style={{ backgroundColor: c, opacity: 0.5 }} />
                      ))}
                      <span className="text-[10px] text-text-secondary/60 ml-1">4 criteria</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-text-secondary text-sm mb-4">Product Design, Digital Design, Systems Engineering, Architecture, Electronics &amp; more</p>
            <Link href="/teacher/login" className="inline-flex items-center gap-2 px-6 py-3 gradient-cta text-white rounded-full font-semibold hover:opacity-90 transition text-sm shadow-lg shadow-brand-pink/20">
              Browse All Units
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ======== TEACHER + STUDENT PREVIEW ======== */}
      <section className="bg-white text-text-primary">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-pink mb-3 block">Two Portals</span>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">You Set the Direction. They Own the Journey.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-surface-alt">
              <div className="w-12 h-12 rounded-xl bg-brand-purple/10 flex items-center justify-center mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Teacher Dashboard</h3>
              <ul className="space-y-3">
                {["Build units yourself or let AI generate a starting point", "Live progress grid replaces constant check-ins", "Toggle pages on/off to tailor each class", "Due dates and safety gates run themselves", "Roster sync from your LMS — zero data entry", "Academic integrity monitoring runs silently", "One dashboard for every class, unit, and student", "Be present in the classroom, not buried in admin"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <svg className="w-5 h-5 text-accent-green flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/teacher/login" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-brand-purple hover:text-brand-violet transition">
                Open Teacher Portal
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
            <div className="rounded-2xl border border-border p-8 bg-gradient-to-br from-white to-brand-purple/5">
              <div className="w-12 h-12 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
              </div>
              <h3 className="text-xl font-bold mb-3">Student Experience</h3>
              <ul className="space-y-3">
                {["Move through lessons at your own pace", "Scaffolding adapts to your language level", "Choose how to respond — text, voice, upload, or link", "Plan your own project timeline with a Gantt chart", "Make design decisions with structured frameworks", "Capture your process in a living portfolio", "Earn skill badges and safety certifications", "Export your work as PDF or PowerPoint anytime"].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
                    <svg className="w-5 h-5 text-accent-blue flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/login" className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-accent-blue hover:text-accent-blue/80 transition">
                Student Login
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======== CTA ======== */}
      <div className="gradient-hero-warm relative">
        <WaveDivider direction="top" fillClass="fill-white" />
        <section className="text-white">
          <div className="max-w-6xl mx-auto px-6 py-20">
            <div className="relative rounded-3xl bg-white/10 border border-white/15 p-12 text-center overflow-hidden backdrop-blur-sm">
              <div className="absolute inset-0 pointer-events-none opacity-10">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="absolute w-2 h-2 rounded-full bg-white" style={{ left: `${10 + (i % 4) * 25}%`, top: `${15 + Math.floor(i / 4) * 30}%` }} />
                ))}
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 relative z-10">Ready to Be More Present in Your Classroom?</h2>
              <p className="text-white/60 mb-8 max-w-md mx-auto relative z-10">Set up your first class in minutes. Let students take ownership of their learning while you focus on what matters.</p>
              <div className="flex flex-wrap gap-4 justify-center relative z-10">
                <Link href="/teacher/login" className="px-8 py-3.5 bg-white text-brand-purple rounded-full font-semibold hover:bg-white/90 transition text-base shadow-lg">Get Started Free</Link>
                <Link href="/login" className="px-8 py-3.5 bg-white/10 text-white rounded-full font-medium hover:bg-white/20 transition border border-white/20 text-base backdrop-blur-sm">Student Login</Link>
              </div>
            </div>
          </div>
        </section>
        <WaveDivider fillClass="fill-surface-dark" />
      </div>

      {/* ======== FOOTER ======== */}
      <footer className="bg-surface-dark text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><rect x="2" y="8" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="2" y="19" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="8" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/><rect x="19" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/><rect x="4" y="8" width="12" height="5" rx="2.5" fill="#7B2FF2"/><rect x="16" y="19" width="12" height="5" rx="2.5" fill="#7B2FF2"/></svg>
              </div>
              <span className="text-sm font-semibold text-white/80">StudioLoom</span>
            </div>
            <p className="text-xs text-white/30">Design Process Platform — Built for international educators. Works with ManageBac, Canvas, Schoology &amp; more.</p>
            <div className="flex items-center gap-4">
              <Link href="/toolkit" className="text-xs text-white/40 hover:text-white/70 transition">Design Toolkit</Link>
              <Link href="/tools/safety" className="text-xs text-white/40 hover:text-white/70 transition">Safety Badges</Link>
              <Link href="/tools/report-writer" className="text-xs text-white/40 hover:text-white/70 transition">Report Writer</Link>
              <Link href="/login" className="text-xs text-white/40 hover:text-white/70 transition">Students</Link>
              <Link href="/teacher/login" className="text-xs text-white/40 hover:text-white/70 transition">Teachers</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
