"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs — no lucide-react in project)                   */
/* ------------------------------------------------------------------ */

const IconCheck = () => (
  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <motion.svg
    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    animate={{ rotate: open ? 180 : 0 }}
    transition={{ duration: 0.25 }}
    className="flex-shrink-0"
  >
    <polyline points="6 9 12 15 18 9" />
  </motion.svg>
);

/* ------------------------------------------------------------------ */
/*  Mini preview graphics (SVG illustrations per feature)              */
/* ------------------------------------------------------------------ */

const PreviewTeaching = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    {/* Dark dashboard mockup */}
    <rect width="320" height="140" rx="8" fill="#1a1a2e" />
    {/* Title bar */}
    <rect x="8" y="8" width="304" height="16" rx="4" fill="#252540" />
    <circle cx="18" cy="16" r="3" fill="#ff5f57" /><circle cx="28" cy="16" r="3" fill="#febc2e" /><circle cx="38" cy="16" r="3" fill="#28c840" />
    {/* Left sidebar */}
    <rect x="8" y="30" width="70" height="102" rx="4" fill="#252540" />
    <rect x="14" y="38" width="56" height="6" rx="2" fill="#3a3a5c" />
    <rect x="14" y="50" width="56" height="6" rx="2" fill="#3a3a5c" />
    <rect x="14" y="62" width="56" height="6" rx="2" fill="#7B2FF2" opacity="0.6" />
    <rect x="14" y="74" width="56" height="6" rx="2" fill="#3a3a5c" />
    {/* Main: student grid */}
    <rect x="84" y="30" width="228" height="102" rx="4" fill="#252540" />
    {/* Student dots */}
    {[0,1,2,3,4,5].map((i) => (
      <g key={i} transform={`translate(${100 + (i % 3) * 70}, ${48 + Math.floor(i / 3) * 38})`}>
        <rect width="54" height="28" rx="6" fill="#2a2a48" />
        <circle cx="14" cy="14" r="6" fill={i === 2 ? "#fbbf24" : i === 4 ? "#ef4444" : "#34d399"} opacity="0.9" />
        <rect x="26" y="9" width="22" height="4" rx="2" fill="#4a4a6a" />
        <rect x="26" y="16" width="16" height="3" rx="1.5" fill="#3a3a5c" />
      </g>
    ))}
    {/* Phase timer bar */}
    <rect x="84" y="118" width="228" height="10" rx="3" fill="#2a2a48" />
    <rect x="84" y="118" width="90" height="10" rx="3" fill="#7B2FF2" opacity="0.7" />
    <rect x="174" y="118" width="60" height="10" rx="0" fill="#2DA05E" opacity="0.5" />
  </svg>
);

const PreviewStudent = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    <rect width="320" height="140" rx="8" fill="#fafafa" />
    {/* Mobile-style lesson card */}
    <rect x="20" y="12" width="280" height="32" rx="8" fill="#7B2FF2" />
    <rect x="30" y="20" width="80" height="5" rx="2" fill="white" opacity="0.9" />
    <rect x="30" y="28" width="50" height="3" rx="1.5" fill="white" opacity="0.4" />
    <rect x="254" y="18" width="36" height="18" rx="4" fill="white" opacity="0.2" />
    {/* Activity area */}
    <rect x="20" y="52" width="280" height="76" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" />
    <rect x="32" y="62" width="120" height="5" rx="2" fill="#374151" />
    <rect x="32" y="72" width="256" height="36" rx="6" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="0.5" />
    <rect x="40" y="80" width="100" height="3" rx="1.5" fill="#9ca3af" />
    <rect x="40" y="88" width="80" height="3" rx="1.5" fill="#9ca3af" />
    {/* Mentor bubble */}
    <rect x="180" y="112" width="110" height="20" rx="10" fill="#7B2FF2" opacity="0.1" />
    <rect x="192" y="119" width="60" height="3" rx="1.5" fill="#7B2FF2" opacity="0.5" />
    <circle cx="296" cy="122" r="8" fill="#7B2FF2" opacity="0.15" />
  </svg>
);

const PreviewBuilder = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    <rect width="320" height="140" rx="8" fill="#fafafa" />
    {/* Split pane editor */}
    <rect x="8" y="8" width="90" height="124" rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" />
    {/* Sidebar lessons */}
    {[0,1,2,3,4].map((i) => (
      <rect key={i} x="14" y={16 + i * 22} width="78" height="16" rx="4" fill={i === 1 ? "#7B2FF2" : "#f3f4f6"} opacity={i === 1 ? 0.15 : 1} stroke={i === 1 ? "#7B2FF2" : "transparent"} strokeWidth="1" />
    ))}
    {/* Main editor area */}
    <rect x="104" y="8" width="208" height="124" rx="6" fill="white" stroke="#e5e7eb" strokeWidth="1" />
    {/* Workshop phases */}
    <rect x="112" y="16" width="192" height="10" rx="3" fill="#f3f4f6" />
    <rect x="112" y="16" width="40" height="10" rx="3" fill="#6366f1" opacity="0.3" />
    <rect x="152" y="16" width="30" height="10" rx="0" fill="#3b82f6" opacity="0.3" />
    <rect x="182" y="16" width="80" height="10" rx="0" fill="#10b981" opacity="0.3" />
    <rect x="262" y="16" width="42" height="10" rx="3" fill="#f59e0b" opacity="0.3" />
    {/* Activity blocks with drag handles */}
    {[0,1,2].map((i) => (
      <g key={i} transform={`translate(112, ${34 + i * 32})`}>
        <rect width="192" height="26" rx="5" fill="white" stroke="#e5e7eb" strokeWidth="0.5" />
        <rect x="6" y="8" width="2" height="10" rx="1" fill="#d1d5db" />
        <rect x="10" y="8" width="2" height="10" rx="1" fill="#d1d5db" />
        <rect x="20" y="8" width="80" height="4" rx="2" fill="#6b7280" />
        <rect x="20" y="15" width="50" height="3" rx="1.5" fill="#d1d5db" />
        <rect x="160" y="7" width="24" height="12" rx="3" fill="#7B2FF2" opacity="0.1" />
      </g>
    ))}
  </svg>
);

const PreviewAI = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    <defs>
      <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#7B2FF2" stopOpacity="0.08" />
        <stop offset="100%" stopColor="#E86F2C" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    <rect width="320" height="140" rx="8" fill="url(#aiGrad)" />
    {/* Brain/network illustration */}
    <circle cx="160" cy="55" r="20" fill="#7B2FF2" opacity="0.12" />
    <circle cx="160" cy="55" r="12" fill="#7B2FF2" opacity="0.2" />
    <text x="160" y="60" textAnchor="middle" fontSize="14" fill="#7B2FF2" opacity="0.6">#</text>
    {/* Connections */}
    {[
      { x: 80, y: 35 }, { x: 240, y: 35 }, { x: 90, y: 85 }, { x: 230, y: 85 },
      { x: 120, y: 20 }, { x: 200, y: 20 }, { x: 115, y: 95 }, { x: 205, y: 95 },
    ].map((n, i) => (
      <g key={i}>
        <line x1="160" y1="55" x2={n.x} y2={n.y} stroke="#7B2FF2" strokeWidth="0.5" opacity="0.2" />
        <circle cx={n.x} cy={n.y} r="4" fill="#7B2FF2" opacity={0.1 + (i % 3) * 0.08} />
      </g>
    ))}
    {/* Labels */}
    <rect x="40" y="112" width="70" height="18" rx="9" fill="#7B2FF2" opacity="0.1" />
    <text x="75" y="124" textAnchor="middle" fontSize="8" fill="#7B2FF2" opacity="0.5">Socratic</text>
    <rect x="125" y="112" width="70" height="18" rx="9" fill="#E86F2C" opacity="0.1" />
    <text x="160" y="124" textAnchor="middle" fontSize="8" fill="#E86F2C" opacity="0.5">Style Learning</text>
    <rect x="210" y="112" width="70" height="18" rx="9" fill="#2DA05E" opacity="0.1" />
    <text x="245" y="124" textAnchor="middle" fontSize="8" fill="#2DA05E" opacity="0.5">Integrity</text>
  </svg>
);

const PreviewSafety = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    <rect width="320" height="140" rx="8" fill="#fafafa" />
    {/* Badge cards */}
    {[
      { x: 16, color: "#2DA05E", label: "Workshop Safety" },
      { x: 120, color: "#E86F2C", label: "Fire Safety" },
      { x: 224, color: "#2E86AB", label: "Hand Tools" },
    ].map((b, i) => (
      <g key={i} transform={`translate(${b.x}, 14)`}>
        <rect width="88" height="70" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" />
        <rect x="10" y="10" width="28" height="28" rx="14" fill={b.color} opacity="0.15" />
        <path d="M24 18 L24 18" transform={`translate(${10}, ${10})`}>
          <animate attributeName="d" dur="0s" />
        </path>
        <text x="18" y="30" fontSize="14">🛡️</text>
        <rect x="10" y="46" width="60" height="4" rx="2" fill="#374151" />
        <rect x="10" y="54" width="40" height="3" rx="1.5" fill="#9ca3af" />
      </g>
    ))}
    {/* Grading scale row */}
    <rect x="16" y="96" width="288" height="32" rx="8" fill="white" stroke="#e5e7eb" strokeWidth="1" />
    <text x="28" y="116" fontSize="9" fill="#6b7280">Criterion A</text>
    {[1,2,3,4,5,6,7,8].map((n) => (
      <rect key={n} x={88 + (n - 1) * 26} y={102} width="20" height="20" rx="4" fill={n <= 5 ? "#7B2FF2" : "#f3f4f6"} opacity={n <= 5 ? 0.15 + n * 0.08 : 1} stroke={n === 5 ? "#7B2FF2" : "#e5e7eb"} strokeWidth="1" />
    ))}
  </svg>
);

const PreviewStudio = () => (
  <svg viewBox="0 0 320 140" className="w-full h-auto rounded-lg">
    <defs>
      <linearGradient id="studioGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1a0e3a" /><stop offset="100%" stopColor="#0d1b2a" />
      </linearGradient>
    </defs>
    <rect width="320" height="140" rx="8" fill="url(#studioGrad)" />
    {/* Station dots — discovery journey */}
    {[0,1,2,3,4,5,6,7].map((i) => {
      const x = 30 + i * 37;
      const y = 50 + Math.sin(i * 0.8) * 15;
      const active = i <= 4;
      return (
        <g key={i}>
          {i > 0 && <line x1={30 + (i - 1) * 37} y1={50 + Math.sin((i - 1) * 0.8) * 15} x2={x} y2={y} stroke={active ? "#7B2FF2" : "#3a3a5c"} strokeWidth="1.5" strokeDasharray={active ? "0" : "4 3"} />}
          <circle cx={x} cy={y} r={i === 4 ? 8 : 6} fill={active ? "#7B2FF2" : "#3a3a5c"} opacity={active ? 0.8 : 0.4} />
          {i === 4 && <circle cx={x} cy={y} r="12" fill="none" stroke="#7B2FF2" strokeWidth="1" opacity="0.3" />}
        </g>
      );
    })}
    {/* Kit mentor */}
    <circle cx="260" cy="42" r="18" fill="#7B2FF2" opacity="0.25" />
    <text x="260" y="48" textAnchor="middle" fontSize="16">🧭</text>
    {/* Banner */}
    <rect x="40" y="90" width="240" height="30" rx="8" fill="rgba(123,47,242,0.15)" />
    <rect x="54" y="100" width="100" height="4" rx="2" fill="#a78bfa" opacity="0.6" />
    <rect x="54" y="108" width="70" height="3" rx="1.5" fill="#7B2FF2" opacity="0.3" />
    <rect x="230" y="98" width="40" height="14" rx="7" fill="#7B2FF2" opacity="0.3" />
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  gradient: string;
  bullets: string[];
  preview: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: "teaching",
    title: "Live Teaching Dashboard",
    subtitle: "See every student at a glance during class",
    color: "#2E86AB",
    gradient: "linear-gradient(135deg, #2E86AB15 0%, #2E86AB05 100%)",
    bullets: [
      "Live student grid — who's working, stuck, or needs help",
      "Phase timer with Workshop Model (Opening → Mini-Lesson → Work Time → Debrief)",
      "Dark-themed projector view syncs from your laptop",
      "One-click launch from your dashboard with class pre-selected",
    ],
    preview: <PreviewTeaching />,
  },
  {
    id: "student",
    title: "Student Experience",
    subtitle: "Self-paced lessons with scaffolding that builds itself",
    color: "#7B2FF2",
    gradient: "linear-gradient(135deg, #7B2FF215 0%, #7B2FF205 100%)",
    bullets: [
      "Activity-first pages with 10+ response types (text, voice, upload, canvas)",
      "Socratic AI mentor asks questions instead of giving answers",
      "Peer critique gallery with effort-gated feedback",
      "Auto-building portfolio from every response and reflection",
    ],
    preview: <PreviewStudent />,
  },
  {
    id: "tools",
    title: "Unit Builder & Editor",
    subtitle: "AI-assisted generation with drag-and-drop editing",
    color: "#8B2FC9",
    gradient: "linear-gradient(135deg, #8B2FC915 0%, #8B2FC905 100%)",
    bullets: [
      "3-lane wizard: Express (3 clicks), Guided (conversation), Architect (full control)",
      "Drag-and-drop lesson editor with Workshop Model phases",
      "Per-class customisation — fork on first edit, others keep the original",
      "Knowledge base with PDF/DOCX/PPTX upload and AI analysis",
    ],
    preview: <PreviewBuilder />,
  },
  {
    id: "ai",
    title: "AI That Supports, Not Replaces",
    subtitle: "You circulate and mentor — the platform handles the rest",
    color: "#E86F2C",
    gradient: "linear-gradient(135deg, #E86F2C15 0%, #E86F2C05 100%)",
    bullets: [
      "AI generates scaffolding following the Workshop Model — you edit it",
      "Student AI mentor uses Socratic questions, never gives answers",
      "Silent writing analytics track integrity (paste events, typing patterns)",
      "Your teaching style is learned over time and injected into generation",
    ],
    preview: <PreviewAI />,
  },
  {
    id: "safety",
    title: "Safety, Grading & Assessment",
    subtitle: "Badges, framework-flexible grading, competency tracking",
    color: "#2DA05E",
    gradient: "linear-gradient(135deg, #2DA05E15 0%, #2DA05E05 100%)",
    bullets: [
      "Safety badge system — earn certification before equipment access",
      "Framework-flexible grading (IB MYP, GCSE, A-Level, ACARA, PLTW, IGCSE)",
      "Melbourne Metrics competency assessment with student self-rating",
      "Academic integrity report with writing playback for evidence",
    ],
    preview: <PreviewSafety />,
  },
  {
    id: "studio",
    title: "Open Studio & Discovery",
    subtitle: "From guided lessons to self-directed independence",
    color: "#8B2FC9",
    gradient: "linear-gradient(135deg, #8B2FC915 0%, #1a0e3a15 100%)",
    bullets: [
      "Teacher-unlocked Open Studio — AI switches from tutor to studio critic",
      "8-station Discovery Journey to find project direction",
      "Drift detection with 3-level escalation and auto-revocation",
      "Configurable check-in intervals and productivity scoring",
    ],
    preview: <PreviewStudio />,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function FeatureExplorer() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="bg-white">
      <div className="max-w-4xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-purple mb-3 block">Everything You Need</span>
          <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">Explore the Platform</h2>
          <p className="text-text-secondary max-w-lg mx-auto">
            Click any feature to see what&apos;s inside.
          </p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((feature) => {
            const isOpen = openId === feature.id;
            return (
              <motion.div
                key={feature.id}
                layout
                className="rounded-2xl overflow-hidden"
                style={{
                  border: isOpen ? `1.5px solid ${feature.color}30` : "1.5px solid #e5e7eb",
                  background: isOpen ? feature.gradient : "white",
                  boxShadow: isOpen ? `0 8px 30px ${feature.color}12` : "none",
                }}
                transition={{ duration: 0.2 }}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => toggle(feature.id)}
                  className="w-full flex items-center gap-4 p-5 text-left transition-colors"
                >
                  {/* Colored accent bar */}
                  <div
                    className="w-1 self-stretch rounded-full flex-shrink-0 transition-all"
                    style={{
                      background: isOpen ? feature.color : `${feature.color}30`,
                      opacity: isOpen ? 0.8 : 0.5,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary text-[15px]">{feature.title}</h3>
                    <p className="text-sm text-text-secondary">{feature.subtitle}</p>
                  </div>
                  <div className="text-text-secondary">
                    <IconChevron open={isOpen} />
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-0">
                        {/* Preview graphic */}
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1, duration: 0.3 }}
                          className="mb-4 rounded-xl overflow-hidden border border-black/5"
                        >
                          {feature.preview}
                        </motion.div>

                        {/* Bullets */}
                        <ul className="space-y-2">
                          {feature.bullets.map((bullet, i) => (
                            <motion.li
                              key={bullet}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.15 + i * 0.05, duration: 0.25 }}
                              className="flex items-start gap-2.5 text-sm text-text-secondary"
                            >
                              <span style={{ color: feature.color }}><IconCheck /></span>
                              <span>{bullet}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Frameworks row */}
        <div className="mt-10 text-center">
          <p className="text-xs text-text-secondary mb-3 uppercase tracking-wider font-semibold">Works with your curriculum</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {["IB MYP", "GCSE DT", "A-Level DT", "ACARA", "PLTW", "IGCSE DT"].map((fw) => (
              <span key={fw} className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-border text-text-secondary bg-surface-alt">
                {fw}
              </span>
            ))}
          </div>
        </div>

        {/* LMS row */}
        <div className="mt-6 text-center">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-secondary">
            <span>ManageBac <span className="text-accent-green font-medium">LTI 1.0a</span></span>
            <span className="text-border">|</span>
            <span>Canvas <span className="text-text-secondary/50">Coming soon</span></span>
            <span className="text-border">|</span>
            <span>Google Classroom <span className="text-text-secondary/50">Coming soon</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
