"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ------------------------------------------------------------------ */
/*  Icons (inline SVGs — no lucide-react in project)                   */
/* ------------------------------------------------------------------ */

const IconGrid = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);
const IconLayers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
  </svg>
);
const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
  </svg>
);
const IconCompass = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);
const IconStar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const IconCheck = () => (
  <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);
const IconChevron = ({ open }: { open: boolean }) => (
  <motion.svg
    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    animate={{ rotate: open ? 180 : 0 }}
    transition={{ duration: 0.2 }}
  >
    <polyline points="6 9 12 15 18 9" />
  </motion.svg>
);

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  bullets: string[];
  extra?: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    id: "teaching",
    icon: <IconGrid />,
    title: "Live Teaching Dashboard",
    subtitle: "See every student at a glance during class",
    color: "#2E86AB",
    bullets: [
      "Live student grid — who's working, stuck, or needs help",
      "Phase timer with Workshop Model (Opening, Mini-Lesson, Work Time, Debrief)",
      "Dark-themed projector view syncs from your laptop",
      "One-click launch from your dashboard with class pre-selected",
    ],
  },
  {
    id: "student",
    icon: <IconBook />,
    title: "Student Experience",
    subtitle: "Self-paced lessons with scaffolding that builds itself",
    color: "#7B2FF2",
    bullets: [
      "Activity-first pages with 10+ response types (text, voice, upload, canvas)",
      "Socratic mentor asks questions instead of giving answers",
      "Peer critique gallery with effort-gated feedback",
      "Auto-building portfolio from every response and reflection",
      "Pace feedback (one tap) after each lesson",
    ],
  },
  {
    id: "tools",
    icon: <IconLayers />,
    title: "Unit Builder & Editor",
    subtitle: "AI-assisted generation with drag-and-drop editing",
    color: "#8B2FC9",
    bullets: [
      "3-lane wizard: Express (3 clicks), Guided (conversation), or Architect (full control)",
      "Drag-and-drop lesson editor with Workshop Model phases",
      "Per-class customisation — fork on first edit, others keep the original",
      "Knowledge base with PDF/DOCX/PPTX upload and AI analysis",
      "Timetable & scheduling with rotating cycle support and iCal import",
    ],
  },
  {
    id: "ai",
    icon: <IconStar />,
    title: "AI That Supports, Not Replaces",
    subtitle: "You circulate and mentor — the platform handles the rest",
    color: "#E86F2C",
    bullets: [
      "AI generates scaffolding following the Workshop Model — you edit it",
      "Student mentor uses Socratic questions, never gives answers",
      "Silent writing analytics track integrity (paste events, typing patterns, focus)",
      "Per-step AI rules adapt personality for each tool and activity",
      "Your teaching style is learned over time and injected into generation",
    ],
  },
  {
    id: "safety",
    icon: <IconShield />,
    title: "Safety, Grading & Assessment",
    subtitle: "Badges, framework-flexible grading, competency tracking",
    color: "#2DA05E",
    bullets: [
      "Safety badge system — students earn certification before equipment access",
      "Framework-flexible grading (IB MYP, GCSE, A-Level, ACARA, PLTW, IGCSE)",
      "Melbourne Metrics competency assessment with student self-rating",
      "Academic integrity report with writing playback for evidence",
    ],
  },
  {
    id: "studio",
    icon: <IconCompass />,
    title: "Open Studio & Discovery",
    subtitle: "From guided lessons to self-directed independence",
    color: "#8B2FC9",
    bullets: [
      "Teacher-unlocked Open Studio mode — AI switches from tutor to studio critic",
      "8-station Discovery Journey to find project direction (Service, PP, PYPx)",
      "Drift detection with 3-level escalation and auto-revocation",
      "Configurable check-in intervals and productivity scoring",
    ],
    extra: (
      <div className="flex gap-1.5 mt-3 rounded-lg overflow-hidden">
        {["s1-campfire", "s3-collection", "s6-crossroads", "s7-launchpad"].map((bg) => (
          <div key={bg} className="relative w-1/4 h-12 rounded-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/discovery/backgrounds/${bg}.webp`} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-purple-900/30" />
          </div>
        ))}
      </div>
    ),
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
            Click any feature to see what&apos;s inside. StudioLoom handles the logistics so you can
            focus on the teaching that matters.
          </p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((feature) => {
            const isOpen = openId === feature.id;
            return (
              <div key={feature.id} className="rounded-2xl border border-border overflow-hidden bg-white">
                {/* Collapsed card — always visible */}
                <button
                  onClick={() => toggle(feature.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-surface-alt/50 transition-colors"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{ background: isOpen ? `${feature.color}20` : `${feature.color}10`, color: feature.color }}
                  >
                    {feature.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary text-[15px]">{feature.title}</h3>
                    <p className="text-sm text-text-secondary truncate">{feature.subtitle}</p>
                  </div>
                  <div className="text-text-secondary flex-shrink-0">
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
                        <div className="border-t border-border pt-4">
                          <ul className="space-y-2.5">
                            {feature.bullets.map((bullet) => (
                              <li key={bullet} className="flex items-start gap-2.5 text-sm text-text-secondary">
                                <IconCheck />
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                          {feature.extra}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
