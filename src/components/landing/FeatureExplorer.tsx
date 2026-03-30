"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform, useInView } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs — no lucide-react in project)                   */
/* ------------------------------------------------------------------ */

const IconCheck = ({ color }: { color: string }) => (
  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconArrowRight = () => (
  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  CSS-art mockup components (richer than old SVGs)                   */
/* ------------------------------------------------------------------ */

function MockTeachingDashboard() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1a1a2e" }}>
      {/* macOS title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ background: "#13132a" }}>
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-3 text-[10px] text-white/30 font-medium">Teaching Mode — Design & Technology 9</span>
      </div>
      {/* 3-column layout */}
      <div className="flex gap-2 p-3" style={{ minHeight: 200 }}>
        {/* Left: Lesson nav */}
        <div className="w-1/5 rounded-lg p-2.5 space-y-2" style={{ background: "#252540" }}>
          {["Opening", "Mini-Lesson", "Work Time", "Debrief"].map((phase, i) => (
            <div key={phase} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[9px] font-medium" style={{ background: i === 2 ? "rgba(123,47,242,0.25)" : "transparent", color: i === 2 ? "#a78bfa" : "#6b6b8a" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: ["#6366f1", "#3b82f6", "#10b981", "#f59e0b"][i], opacity: i === 2 ? 1 : 0.4 }} />
              {phase}
            </div>
          ))}
          <div className="mt-3 pt-2 border-t border-white/5">
            <div className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Timer</div>
            <div className="text-lg font-bold text-emerald-400 font-mono">18:42</div>
            <div className="text-[8px] text-white/30">Work Time remaining</div>
          </div>
        </div>
        {/* Center: Student grid */}
        <div className="flex-1 rounded-lg p-3" style={{ background: "#252540" }}>
          <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider mb-2">Live Student Grid</div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { name: "Alice", status: "green", page: "Page 3" },
              { name: "Ben", status: "green", page: "Page 3" },
              { name: "Carlos", status: "amber", page: "Page 2" },
              { name: "Diana", status: "green", page: "Page 3" },
              { name: "Ella", status: "red", page: "Page 1" },
              { name: "Frank", status: "green", page: "Page 4" },
              { name: "Grace", status: "green", page: "Page 3" },
              { name: "Hugo", status: "amber", page: "Page 2" },
            ].map((s) => (
              <div key={s.name} className="rounded-lg p-2" style={{ background: "#2a2a48" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ background: s.status === "green" ? "#34d399" : s.status === "amber" ? "#fbbf24" : "#ef4444" }} />
                  <span className="text-[9px] text-white/70 font-medium">{s.name}</span>
                </div>
                <div className="text-[8px] text-white/30">{s.page}</div>
                {s.status === "red" && (
                  <div className="mt-1 text-[7px] font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full inline-block">Needs Help</div>
                )}
              </div>
            ))}
          </div>
          {/* Phase timeline */}
          <div className="mt-3 flex rounded-md overflow-hidden h-2.5">
            <div style={{ width: "15%", background: "#6366f1" }} />
            <div style={{ width: "20%", background: "#3b82f6" }} />
            <div style={{ width: "50%", background: "#10b981" }} />
            <div style={{ width: "15%", background: "#f59e0b", opacity: 0.3 }} />
          </div>
        </div>
        {/* Right: Notes */}
        <div className="w-1/5 rounded-lg p-2.5 space-y-2" style={{ background: "#252540" }}>
          <div className="text-[9px] text-white/30 uppercase tracking-wider font-semibold">Notes</div>
          <div className="text-[9px] text-white/40 leading-relaxed">Carlos still on Step 2 — check bandsaw confidence</div>
          <div className="text-[9px] text-white/40 leading-relaxed">Ella absent Mon, needs catch-up</div>
          <div className="mt-3 pt-2 border-t border-white/5">
            <div className="text-[8px] text-white/20 uppercase tracking-wider mb-1">Extensions</div>
            <div className="text-[9px] text-emerald-400/60">3 students ready</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockStudentLesson() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-white">
      {/* Top nav */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-purple-100 flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><rect x="2" y="8" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="2" y="19" width="28" height="5" rx="2.5" fill="#7B2FF2"/><rect x="8" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/><rect x="19" y="2" width="5" height="28" rx="2.5" fill="#7B2FF2"/></svg>
          </div>
          <span className="text-xs font-bold text-gray-800">Designing for a Need</span>
        </div>
        <div className="text-[10px] text-gray-400">Page 3 of 8</div>
      </div>
      {/* Hero gradient */}
      <div className="h-16 relative" style={{ background: "linear-gradient(135deg, #6366f1, #7c3aed)" }}>
        <div className="absolute inset-0 flex items-center px-5">
          <div>
            <div className="text-sm font-bold text-white">Criterion B: Developing Ideas</div>
            <div className="text-[10px] text-white/60">Sketch 3 possible solutions for your user</div>
          </div>
        </div>
      </div>
      {/* Activity area */}
      <div className="p-4 space-y-3">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-700 mb-2">Sketch your first idea</div>
          <div className="text-[10px] text-gray-400 mb-3">Think about the needs you identified in the interview. How might your design solve them?</div>
          <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 h-24 flex items-center justify-center">
            <div className="text-center">
              <div className="text-gray-300 text-lg mb-1">+</div>
              <div className="text-[9px] text-gray-400">Click to draw or upload</div>
            </div>
          </div>
        </div>
        {/* AI mentor bubble */}
        <div className="flex items-end gap-2">
          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-purple-600">#</span>
          </div>
          <div className="rounded-xl rounded-bl-sm bg-purple-50 border border-purple-100 px-3 py-2 max-w-[75%]">
            <div className="text-[10px] text-purple-800 leading-relaxed">What specific need from your user interview does this design address? Can you point to the exact quote?</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockUnitBuilder() {
  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-white">
      {/* Split pane header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-800">Lesson Editor</span>
          <span className="text-[8px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Class fork</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-[9px] text-gray-400">Auto-saved 2s ago</div>
          <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center">
            <svg width="8" height="8" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          </div>
        </div>
      </div>
      <div className="flex" style={{ minHeight: 200 }}>
        {/* Sidebar */}
        <div className="w-1/4 border-r border-gray-100 p-3 space-y-1.5">
          <div className="text-[8px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Lessons</div>
          {["Introduction to Needs", "User Research", "Developing Ideas", "Prototyping", "Testing & Feedback"].map((l, i) => (
            <div key={l} className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[9px] font-medium ${i === 2 ? "bg-purple-50 text-purple-700 border border-purple-200" : "text-gray-500 hover:bg-gray-50"}`}>
              <div className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold" style={{ background: i === 2 ? "#7B2FF2" : "#f3f4f6", color: i === 2 ? "white" : "#9ca3af" }}>{i + 1}</div>
              <span className="truncate">{l}</span>
            </div>
          ))}
          <button className="w-full mt-2 text-[9px] text-purple-500 font-medium py-1.5 rounded-md border border-dashed border-purple-300 hover:bg-purple-50">+ New Lesson</button>
        </div>
        {/* Editor */}
        <div className="flex-1 p-4 space-y-3">
          {/* Workshop phases bar */}
          <div className="flex rounded-lg overflow-hidden h-3 mb-3">
            <div className="flex items-center justify-center text-[6px] text-white font-bold" style={{ width: "12%", background: "#6366f1" }}>O</div>
            <div className="flex items-center justify-center text-[6px] text-white font-bold" style={{ width: "18%", background: "#3b82f6" }}>ML</div>
            <div className="flex items-center justify-center text-[6px] text-white font-bold" style={{ width: "55%", background: "#10b981" }}>WT</div>
            <div className="flex items-center justify-center text-[6px] text-white font-bold" style={{ width: "15%", background: "#f59e0b" }}>D</div>
          </div>
          {/* Activity blocks */}
          {[
            { title: "Hook: Show the terrible design", dur: "5 min", phase: "Opening" },
            { title: "Sketch 3 possible solutions", dur: "20 min", phase: "Work Time" },
            { title: "Peer critique using Two Stars & a Wish", dur: "10 min", phase: "Work Time" },
          ].map((a, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-purple-200 transition group">
              <div className="flex flex-col gap-0.5 text-gray-300 cursor-grab">
                <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /></div>
                <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /></div>
                <div className="flex gap-0.5"><div className="w-1 h-1 rounded-full bg-current" /><div className="w-1 h-1 rounded-full bg-current" /></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-gray-700">{a.title}</div>
                <div className="text-[8px] text-gray-400">{a.phase}</div>
              </div>
              <span className="text-[8px] font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{a.dur}</span>
              <div className="w-5 h-5 rounded-md bg-purple-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span className="text-[9px] font-bold text-purple-500">#</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature section component — full-width alternating layout          */
/* ------------------------------------------------------------------ */

interface FeatureData {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  accentGradient: string;
  bullets: string[];
  cta?: { label: string; href: string };
  mockup: React.ReactNode;
  image?: { src: string; alt: string };
}

function FeatureSection({ feature, index }: { feature: FeatureData; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const isReversed = index % 2 !== 0;

  // Parallax on the mockup
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      {/* Subtle background accent */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ background: `radial-gradient(ellipse at ${isReversed ? "20%" : "80%"} 50%, ${feature.color}, transparent 70%)` }}
      />

      <div className={`max-w-6xl mx-auto px-6 py-16 md:py-24 flex flex-col ${isReversed ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-10 md:gap-16`}>
        {/* Text side */}
        <motion.div
          className="flex-1 max-w-lg"
          initial={{ opacity: 0, x: isReversed ? 30 : -30 }}
          animate={isInView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Feature label */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-1 rounded-full" style={{ background: feature.color }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: feature.color }}>
              {feature.id.replace(/-/g, " ")}
            </span>
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 leading-tight">
            {feature.title}
          </h3>
          <p className="text-base text-text-secondary mb-6 leading-relaxed">
            {feature.description}
          </p>

          <ul className="space-y-3 mb-8">
            {feature.bullets.map((bullet, i) => (
              <motion.li
                key={bullet}
                className="flex items-start gap-3 text-sm text-text-secondary"
                initial={{ opacity: 0, x: -12 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <IconCheck color={feature.color} />
                <span>{bullet}</span>
              </motion.li>
            ))}
          </ul>

          {feature.cta && (
            <Link
              href={feature.cta.href}
              className="group inline-flex items-center gap-2 text-sm font-semibold transition hover:gap-3"
              style={{ color: feature.color }}
            >
              {feature.cta.label}
              <IconArrowRight />
            </Link>
          )}
        </motion.div>

        {/* Visual side — mockup with parallax */}
        <motion.div
          className="flex-1 w-full max-w-xl"
          style={{ y }}
          initial={{ opacity: 0, x: isReversed ? -30 : 30, scale: 0.96 }}
          animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        >
          {/* Glow behind mockup */}
          <div className="relative">
            <div
              className="absolute -inset-8 rounded-3xl blur-3xl opacity-20 pointer-events-none"
              style={{ background: feature.accentGradient }}
            />
            <div className="relative z-10">
              {feature.mockup}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Discovery section — uses real images                               */
/* ------------------------------------------------------------------ */

function DiscoveryShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);

  return (
    <div ref={ref} className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0c0a1a 0%, #1a0e3a 50%, #0d1b2a 100%)" }}>
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-28">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Text */}
          <motion.div
            className="flex-1 max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-1 rounded-full bg-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">Discovery & Open Studio</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3 leading-tight">
              From Guided Lessons to Self-Directed Projects
            </h3>
            <p className="text-base text-white/50 mb-6 leading-relaxed">
              Students begin with structured lessons, then unlock Open Studio for independent work.
              The 8-station Discovery Journey helps them find their project direction through interactive
              exploration — not questionnaires.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "8-station interactive Discovery Journey with Kit as mentor",
                "Teacher-unlocked Open Studio — AI switches from tutor to studio critic",
                "Drift detection with 3-level escalation and auto-revocation",
                "Archetype scoring reveals student strengths without asking directly",
              ].map((bullet, i) => (
                <motion.li
                  key={bullet}
                  className="flex items-start gap-3 text-sm text-white/50"
                  initial={{ opacity: 0, x: -12 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                >
                  <IconCheck color="#a78bfa" />
                  <span>{bullet}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Image mosaic */}
          <motion.div
            className="flex-1 w-full max-w-xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-10 rounded-3xl bg-purple-500/10 blur-3xl pointer-events-none" />

              {/* Stacked image cards with parallax */}
              <div className="relative z-10 grid grid-cols-2 gap-3">
                <motion.div style={{ y: bgY }} className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
                    <Image src="/discovery/backgrounds/s1-campfire.webp" alt="Campfire station" width={300} height={200} className="w-full h-auto object-cover" />
                  </div>
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
                    <Image src="/discovery/backgrounds/s6-crossroads.webp" alt="Crossroads station" width={300} height={200} className="w-full h-auto object-cover" />
                  </div>
                </motion.div>
                <div className="space-y-3 mt-6">
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl">
                    <Image src="/discovery/backgrounds/s3-collection.webp" alt="Collection station" width={300} height={200} className="w-full h-auto object-cover" />
                  </div>
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl relative">
                    <Image src="/discovery/backgrounds/s7-launchpad.webp" alt="Launchpad station" width={300} height={200} className="w-full h-auto object-cover" />
                    {/* Kit overlay */}
                    <div className="absolute bottom-2 right-2 w-12 h-12 rounded-full overflow-hidden border-2 border-purple-400/50 shadow-lg">
                      <Image src="/discovery/kit/excited.png" alt="Kit mentor" width={48} height={48} className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Station label strip */}
              <div className="mt-4 flex items-center justify-center gap-1.5">
                {["Identity", "Campfire", "Workshop", "Collection", "Window", "Toolkit", "Crossroads", "Launchpad"].map((s, i) => (
                  <div key={s} className="flex flex-col items-center gap-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${i <= 5 ? "bg-purple-400" : "bg-white/20"}`} style={{ opacity: i <= 5 ? 0.5 + i * 0.07 : 0.3 }} />
                    <span className="text-[7px] text-white/30 hidden md:block">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

const FEATURES: FeatureData[] = [
  {
    id: "teaching-mode",
    title: "Live Teaching Dashboard",
    subtitle: "See every student at a glance during class",
    description: "A real-time cockpit for your classroom. See who's working, who's stuck, and who needs help — all on one screen. The Workshop Model timer keeps your lesson phases on track while the projector view displays phase-appropriate content.",
    color: "#2E86AB",
    accentGradient: "linear-gradient(135deg, #2E86AB, #1a6b8a)",
    bullets: [
      "Live student grid — who's working, stuck, or needs help",
      "Phase timer with Workshop Model (Opening → Mini-Lesson → Work Time → Debrief)",
      "Dark-themed projector view syncs from your laptop",
      "One-click launch from your dashboard with class pre-selected",
    ],
    cta: { label: "See how Teaching Mode works", href: "/teacher/login" },
    mockup: <MockTeachingDashboard />,
  },
  {
    id: "student-experience",
    title: "Students Learn by Doing",
    subtitle: "Self-paced lessons with scaffolding that builds itself",
    description: "Activity-first pages where students sketch, write, upload, and reflect. The AI mentor asks Socratic questions instead of giving answers — pushing students to think deeper, not copy faster.",
    color: "#7B2FF2",
    accentGradient: "linear-gradient(135deg, #7B2FF2, #5b1fd2)",
    bullets: [
      "10+ response types — text, voice, upload, canvas, toolkit tools inline",
      "Socratic AI mentor asks questions instead of giving answers",
      "Peer critique gallery with effort-gated feedback",
      "Auto-building portfolio from every response and reflection",
    ],
    mockup: <MockStudentLesson />,
  },
  {
    id: "unit-builder",
    title: "Build Units in Minutes, Not Hours",
    subtitle: "AI-assisted generation with drag-and-drop editing",
    description: "Choose your level of control: Express mode generates a full unit from a topic in 3 clicks. Guided mode has a 7-step conversation. Architect mode gives you every field. Then drag, drop, and edit with Workshop Model phases built in.",
    color: "#8B2FC9",
    accentGradient: "linear-gradient(135deg, #8B2FC9, #6b1fa9)",
    bullets: [
      "3-lane wizard: Express (3 clicks), Guided (conversation), Architect (full control)",
      "Drag-and-drop lesson editor with Workshop Model phases",
      "Per-class customisation — fork on first edit, others keep the original",
      "Knowledge base with PDF/DOCX/PPTX upload and AI analysis",
    ],
    cta: { label: "Try the unit builder", href: "/teacher/login" },
    mockup: <MockUnitBuilder />,
  },
  {
    id: "safety-and-grading",
    title: "Safety Badges, Flexible Grading & Integrity",
    subtitle: "Certify, assess, and verify — built for workshop classrooms",
    description: "Students earn safety certifications before touching equipment. Grading adapts to your framework — IB MYP 1-8, GCSE percentages, PLTW 1-4. Silent writing analytics track integrity without surveillance theatre.",
    color: "#2DA05E",
    accentGradient: "linear-gradient(135deg, #2DA05E, #1d8048)",
    bullets: [
      "Safety badge system — learn cards, quiz, pass/fail certification",
      "Framework-flexible grading (IB MYP, GCSE, A-Level, ACARA, PLTW, IGCSE)",
      "Melbourne Metrics competency assessment with student self-rating",
      "Silent writing analytics with writing playback for evidence",
    ],
    mockup: (
      <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl bg-white p-6 space-y-4">
        {/* Safety badges */}
        <div className="text-xs font-bold text-gray-700 mb-1">Safety Certifications</div>
        <div className="flex gap-3">
          {[
            { name: "Workshop Safety", color: "#2DA05E", status: "Passed" },
            { name: "Fire Protocols", color: "#E86F2C", status: "Passed" },
            { name: "Power Tools", color: "#2E86AB", status: "Required" },
          ].map((b) => (
            <div key={b.name} className="flex-1 rounded-xl border border-gray-200 p-3 text-center">
              <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center" style={{ background: `${b.color}15` }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={b.color} strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
              </div>
              <div className="text-[9px] font-bold text-gray-700">{b.name}</div>
              <div className="text-[8px] mt-0.5 font-medium" style={{ color: b.status === "Passed" ? "#2DA05E" : "#E86F2C" }}>{b.status}</div>
            </div>
          ))}
        </div>
        {/* Grading row */}
        <div>
          <div className="text-xs font-bold text-gray-700 mb-2">Criterion Scores — IB MYP</div>
          <div className="flex gap-2">
            {[
              { crit: "A", score: 6, color: "#6366f1" },
              { crit: "B", score: 7, color: "#10b981" },
              { crit: "C", score: 5, color: "#f59e0b" },
              { crit: "D", score: 4, color: "#8b5cf6" },
            ].map((c) => (
              <div key={c.crit} className="flex-1 text-center">
                <div className="text-[9px] font-bold text-gray-500 mb-1">Criterion {c.crit}</div>
                <div className="flex gap-0.5 justify-center">
                  {[1,2,3,4,5,6,7,8].map((n) => (
                    <div key={n} className="w-4 h-4 rounded text-[7px] font-bold flex items-center justify-center" style={{ background: n <= c.score ? `${c.color}20` : "#f3f4f6", color: n === c.score ? c.color : "#d1d5db", border: n === c.score ? `1.5px solid ${c.color}` : "1px solid #e5e7eb" }}>
                      {n}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function FeatureExplorer() {
  const headerRef = useRef<HTMLDivElement>(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-50px" });

  return (
    <section className="bg-white">
      {/* Section header */}
      <div ref={headerRef} className="max-w-3xl mx-auto px-6 pt-20 pb-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Everything You Need</span>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Built for the Design Workshop</h2>
          <p className="text-text-secondary max-w-lg mx-auto">
            From lesson planning to live teaching to student portfolios — every piece connects.
          </p>
        </motion.div>
      </div>

      {/* Feature sections — alternating layout */}
      {FEATURES.map((feature, index) => (
        <FeatureSection key={feature.id} feature={feature} index={index} />
      ))}

      {/* Discovery section — dark background with real images */}
      <DiscoveryShowcase />

      {/* AI Philosophy section — spans full width with gradient */}
      <AIPhilosophySection />

      {/* Frameworks row */}
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <p className="text-xs text-text-secondary mb-4 uppercase tracking-wider font-semibold">Works with your curriculum</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {["IB MYP", "GCSE DT", "A-Level DT", "ACARA", "PLTW", "IGCSE DT"].map((fw) => (
            <span key={fw} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-border text-text-secondary bg-surface-alt">
              {fw}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-secondary">
          <span>ManageBac <span className="text-accent-green font-medium">LTI 1.0a</span></span>
          <span className="text-border">|</span>
          <span>Canvas <span className="text-text-secondary/50">Coming soon</span></span>
          <span className="text-border">|</span>
          <span>Google Classroom <span className="text-text-secondary/50">Coming soon</span></span>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Philosophy — full-width gradient band                           */
/* ------------------------------------------------------------------ */

function AIPhilosophySection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <div ref={ref} className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #faf5ff 0%, #f0e7ff 50%, #faf5ff 100%)" }}>
      <div className="max-w-6xl mx-auto px-6 py-20 md:py-24">
        <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
          {/* Visual: network diagram */}
          <motion.div
            className="flex-1 w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative aspect-square max-w-sm mx-auto">
              {/* Central # node */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-2xl bg-white shadow-xl flex items-center justify-center z-10"
                animate={{ boxShadow: ["0 0 0 0 rgba(123,47,242,0)", "0 0 0 20px rgba(123,47,242,0.06)", "0 0 0 0 rgba(123,47,242,0)"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-3xl font-black text-purple-600">#</span>
              </motion.div>
              {/* Orbiting nodes */}
              {[
                { label: "Socratic", angle: 0, color: "#7B2FF2", distance: 120 },
                { label: "Style Learning", angle: 60, color: "#E86F2C", distance: 130 },
                { label: "Integrity", angle: 120, color: "#2DA05E", distance: 115 },
                { label: "Scaffolding", angle: 180, color: "#2E86AB", distance: 125 },
                { label: "Workshop Model", angle: 240, color: "#8B2FC9", distance: 120 },
                { label: "Effort-Gating", angle: 300, color: "#E86F2C", distance: 130 },
              ].map((node, i) => {
                const rad = (node.angle * Math.PI) / 180;
                const x = 50 + (node.distance / 3) * Math.cos(rad);
                const y = 50 + (node.distance / 3) * Math.sin(rad);
                return (
                  <motion.div
                    key={node.label}
                    className="absolute flex items-center justify-center"
                    style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -50%)" }}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.3 + i * 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                  >
                    <div className="px-3 py-1.5 rounded-full bg-white shadow-md border text-[10px] font-semibold whitespace-nowrap" style={{ color: node.color, borderColor: `${node.color}30` }}>
                      {node.label}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Text */}
          <motion.div
            className="flex-1 max-w-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-1 rounded-full bg-purple-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600">AI Philosophy</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 leading-tight">
              AI That Supports, Not Replaces
            </h3>
            <p className="text-base text-text-secondary mb-6 leading-relaxed">
              You circulate and mentor — the platform handles the rest. AI generates lesson scaffolding
              following the Workshop Model. The student AI mentor uses Socratic questions, never gives answers.
              Your teaching style is learned over time and woven into everything it generates.
            </p>
            <ul className="space-y-3">
              {[
                "Student effort is assessed before AI responds — low effort gets pushed, high effort gets challenged",
                "Silent writing analytics track paste events, typing patterns — never visible to students",
                "Your teaching style is learned from uploads, edits, and feedback over time",
                "Per-step AI rules change the mentor's personality for each activity phase",
              ].map((bullet, i) => (
                <motion.li
                  key={bullet}
                  className="flex items-start gap-3 text-sm text-text-secondary"
                  initial={{ opacity: 0, x: -12 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                >
                  <IconCheck color="#7B2FF2" />
                  <span>{bullet}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
