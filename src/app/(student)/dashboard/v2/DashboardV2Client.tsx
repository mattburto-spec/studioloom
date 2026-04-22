"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { getPageList, getPageById } from "@/lib/unit-adapter";
import type { UnitContentData, StudentProgress } from "@/types";

/* ================================================================
 * Student Dashboard v2 — Bold redesign
 * Phase 1: static scaffold with hard-coded mock data.
 * Ported from docs/newlook/PYPX Student Dashboard/student_bold.jsx.
 * No real data wired yet — see Phase 2+.
 * ================================================================ */

// ================= SESSION =================
type SessionStudent = {
  name: string;
  first: string;
  initials: string;
  avatarGrad: string;
  classTag: string | null;
};

// Gradient palette for the avatar — deterministic per-name pick.
const AVATAR_GRADS = [
  "from-[#E86F2C] to-[#EC4899]", // orange → pink  (matches mock)
  "from-[#0EA5A4] to-[#3B82F6]", // teal → blue
  "from-[#9333EA] to-[#E86F2C]", // violet → orange
  "from-[#EC4899] to-[#F59E0B]", // pink → amber
  "from-[#10B981] to-[#0EA5A4]", // emerald → teal
  "from-[#6366F1] to-[#9333EA]", // indigo → violet
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function gradFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADS[Math.abs(hash) % AVATAR_GRADS.length];
}

// Fallback used when session isn't available (scaffold/preview mode).
const STUDENT_MOCK: SessionStudent = {
  name: "Sam",
  first: "Sam",
  initials: "SM",
  avatarGrad: "from-[#E86F2C] to-[#EC4899]",
  classTag: "Year 7 · Design",
};

type SessionResponse = {
  student: {
    id: string;
    username: string;
    display_name: string | null;
    classes: { id: string; name: string; code: string; framework?: string | null } | null;
  };
};

function toSessionStudent(data: SessionResponse): SessionStudent {
  const name = data.student.display_name?.trim() || data.student.username;
  const first = name.split(/\s+/)[0];
  return {
    name,
    first,
    initials: getInitials(name),
    avatarGrad: gradFor(name),
    classTag: data.student.classes?.name ?? null,
  };
}

const NAV_S = ["My work", "Units", "Badges", "Journal", "Resources"] as const;

// Phase 3A: hero identity (title/subtitle/class/color/image/%) is wired.
// Task card + teacher note still mock — Phase 3B wires the task card;
// teacher note is deferred pending the general-notes system.
type HeroUnit = {
  unitTitle: string;
  unitSub: string;
  class: string;
  color: string;
  colorDark: string;
  img: string | null;
  // Placeholders until Phase 3B:
  currentTask: string;
  taskProgress: number;
  taskTotal: number;
  dueIn: string;
  teacherNote: { from: string; msg: string; when: string };
};

const HERO_MOCK: HeroUnit = {
  unitTitle: "Biomimicry",
  unitSub: "Plastic pouch inspired by nature",
  class: "7 Design",
  color: "#0EA5A4",
  colorDark: "#0F766E",
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1000&h=1200&fit=crop",
  currentTask: "Sketch 3 structural ideas",
  taskProgress: 1,
  taskTotal: 3,
  dueIn: "in 2 days",
  teacherNote: {
    from: "Mr. Griffiths",
    msg: "Your leaf sketch from Monday is a great start — try one with a radial vein pattern next?",
    when: "yesterday",
  },
};

// Subject-based per-unit color palette. Mirrors the SUBJECT_MAP in the
// current student dashboard but returns hex pairs for the Bold design.
type UnitPalette = { color: string; colorDark: string };
const SUBJECT_PALETTE: { keywords: string[]; palette: UnitPalette }[] = [
  { keywords: ["service as action", "service", "community"],         palette: { color: "#EC4899", colorDark: "#BE185D" } },
  { keywords: ["personal project", " pp ", "pp"],                     palette: { color: "#9333EA", colorDark: "#7E22CE" } },
  { keywords: ["pypx", "exhibition", "primary years exhibition"],     palette: { color: "#F59E0B", colorDark: "#B45309" } },
  { keywords: ["inquiry", "interdisciplinary", "transdisciplinary"],  palette: { color: "#3B82F6", colorDark: "#1D4ED8" } },
  { keywords: ["digital design", "digital"],                          palette: { color: "#06B6D4", colorDark: "#0E7490" } },
  { keywords: ["workshop"],                                           palette: { color: "#F59E0B", colorDark: "#B45309" } },
  { keywords: ["product design", "design tech", "design & tech", "design"], palette: { color: "#0EA5A4", colorDark: "#0F766E" } },
  { keywords: ["technology", "tech"],                                 palette: { color: "#0284C7", colorDark: "#075985" } },
  { keywords: ["art", "visual"],                                      palette: { color: "#D946EF", colorDark: "#A21CAF" } },
  { keywords: ["science", "biology", "chemistry", "physics"],         palette: { color: "#10B981", colorDark: "#047857" } },
  { keywords: ["math", "maths"],                                      palette: { color: "#E86F2C", colorDark: "#C2410C" } },
  { keywords: ["english", "language", "literature"],                  palette: { color: "#EF4444", colorDark: "#B91C1C" } },
];

const FALLBACK_PALETTES: UnitPalette[] = [
  { color: "#0EA5A4", colorDark: "#0F766E" }, // teal
  { color: "#9333EA", colorDark: "#7E22CE" }, // violet
  { color: "#EC4899", colorDark: "#BE185D" }, // pink
  { color: "#0284C7", colorDark: "#075985" }, // sky
  { color: "#F59E0B", colorDark: "#B45309" }, // amber
];

function detectUnitPalette(opts: { classSubject?: string | null; className?: string | null; title?: string | null; id: string }): UnitPalette {
  const candidates = [opts.classSubject, opts.className, opts.title]
    .filter(Boolean)
    .map((s) => ` ${(s as string).toLowerCase()} `);
  for (const candidate of candidates) {
    for (const { keywords, palette } of SUBJECT_PALETTE) {
      if (keywords.some((kw) => candidate.includes(kw))) return palette;
    }
  }
  // Deterministic fallback by id hash
  let hash = 0;
  for (let i = 0; i < opts.id.length; i++) hash = ((hash << 5) - hash + opts.id.charCodeAt(i)) | 0;
  return FALLBACK_PALETTES[Math.abs(hash) % FALLBACK_PALETTES.length];
}

// Unit shape returned by /api/student/units
type UnitRow = {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content_data: UnitContentData | null;
  progress: StudentProgress[];
  class_id: string | null;
  class_name: string | null;
  class_subject: string | null;
};

function latestActivity(unit: UnitRow): number {
  if (unit.progress.length === 0) return 0;
  return unit.progress.reduce((max, p) => {
    const t = new Date(p.updated_at).getTime();
    return t > max ? t : max;
  }, 0);
}

function selectHeroUnit(units: UnitRow[]): UnitRow | null {
  if (units.length === 0) return null;
  // Prefer most-recently-updated in-progress unit
  const inProgress = units
    .filter((u) => u.progress.some((p) => p.status === "in_progress" || p.status === "complete"))
    .sort((a, b) => latestActivity(b) - latestActivity(a));
  if (inProgress.length > 0) return inProgress[0];
  // Else first unit
  return units[0];
}

function buildHeroUnit(unit: UnitRow): HeroUnit {
  const palette = detectUnitPalette({
    classSubject: unit.class_subject,
    className: unit.class_name,
    title: unit.title,
    id: unit.id,
  });
  return {
    unitTitle: unit.title,
    unitSub: unit.description || "",
    class: unit.class_name || "",
    color: palette.color,
    colorDark: palette.colorDark,
    img: unit.thumbnail_url,
    // Phase 3B placeholders — filled by loadUnitDetail() after the second fetch
    currentTask: HERO_MOCK.currentTask,
    taskProgress: HERO_MOCK.taskProgress,
    taskTotal: HERO_MOCK.taskTotal,
    dueIn: HERO_MOCK.dueIn,
    teacherNote: HERO_MOCK.teacherNote,
  };
}

// ================= PHASE 3B: CURRENT TASK / LESSON PROGRESS =================

type UnitDetailResponse = {
  unit: { id: string; title: string; content_data: UnitContentData | null };
  progress: Array<StudentProgress & { responses?: Record<string, unknown> }>;
  pageDueDates: Record<string, string>;
};

/** Pick the page the student should resume. */
function selectCurrentPageId(
  contentData: UnitContentData | null,
  progress: UnitDetailResponse["progress"],
): string | null {
  const pages = getPageList(contentData);
  if (pages.length === 0) return null;

  // 1. Most-recently-updated in_progress page (preferred)
  const inProgress = progress
    .filter((p) => p.status === "in_progress" && p.page_id)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  if (inProgress.length > 0 && pages.some((p) => p.id === inProgress[0].page_id)) {
    return inProgress[0].page_id;
  }

  // 2. First page whose progress row is not "complete" (next unfinished)
  const incompleteIds = new Set(
    progress.filter((p) => p.status !== "complete").map((p) => p.page_id),
  );
  const nextUnfinished = pages.find((p) => !progress.some((pr) => pr.page_id === p.id && pr.status === "complete"));
  if (nextUnfinished) return nextUnfinished.id;
  // (incompleteIds is unused but kept for future; silence TS via void)
  void incompleteIds;

  // 3. Fallback: first page
  return pages[0].id;
}

/** Build the {task, num, total} triple from the selected page + responses. */
type TaskState = { currentTask: string; taskProgress: number; taskTotal: number };

function computeTaskState(
  contentData: UnitContentData | null,
  pageId: string | null,
  responses: Record<string, unknown>,
): TaskState | null {
  if (!pageId) return null;
  const page = getPageById(contentData, pageId);
  if (!page) return null;
  const sections = page.content?.sections ?? [];
  const total = sections.length;

  // No blocks on this page — task = the lesson itself
  if (total === 0) {
    return { currentTask: page.title || page.content?.title || "Continue lesson", taskProgress: 0, taskTotal: 1 };
  }

  // Find first section with no response
  const firstUnresponded = sections.findIndex((s, i) => {
    const key = s.activityId ? `activity_${s.activityId}` : `section_${i}`;
    const v = responses[key];
    return v === undefined || v === null || v === "";
  });

  // All responded → show the last block as "current" with progress = total
  const currentIdx = firstUnresponded >= 0 ? firstUnresponded : total - 1;
  const section = sections[currentIdx];
  const prompt = (section.prompt || "").trim();
  const title = prompt.length > 0 ? truncatePrompt(prompt) : `Block ${currentIdx + 1}`;

  return {
    currentTask: title,
    taskProgress: firstUnresponded >= 0 ? currentIdx : total, // "X of N" where X=done+1 while working, or N when done
    taskTotal: total,
  };
}

/** Trim a prompt to a hero-friendly length at a word boundary. */
function truncatePrompt(prompt: string, max = 90): string {
  if (prompt.length <= max) return prompt;
  const cut = prompt.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

/** Turn an ISO date string into a student-friendly "due" phrase, or null if none. */
function computeDueInText(dueDate: string | undefined, now: Date = new Date()): string | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;
  // Strip time — compare by calendar day
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diffDays < 0) return `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays <= 14) return `in ${diffDays} days`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type QueueItem = {
  kind: "overdue" | "today" | "soon";
  title: string;
  sub: string;
  dueText: string;
  due: string;
  color: string;
  icon: IconName;
  href?: string;
};

const QUEUE_MOCK: QueueItem[] = [
  { kind: "overdue", title: "Electronics & Soldering Safety", sub: "Complete required safety test", dueText: "Overdue · 10 days", due: "10/04/2026", color: "#DC2626", icon: "alert" },
  { kind: "today",   title: "Sketch 3 structural ideas",      sub: "Biomimicry · 7 Design",          dueText: "Today · by end of P1", due: "20/04/2026", color: "#0EA5A4", icon: "clock" },
  { kind: "soon",    title: "PPE Fundamentals",               sub: "Complete required safety test",  dueText: "Due in 3 days",         due: "23/04/2026", color: "#D97706", icon: "shield" },
  { kind: "soon",    title: "3D Printer Safety",              sub: "Complete required safety test",  dueText: "Due in 3 days",         due: "23/04/2026", color: "#D97706", icon: "shield" },
  { kind: "soon",    title: "New Metrics checkpoint",         sub: "Complete your self-assessment",  dueText: "Due in 5 days",         due: "25/04/2026", color: "#EC4899", icon: "star" },
  { kind: "soon",    title: "Sketchbook review",              sub: "Upload this week's pages",       dueText: "Due in 5 days",         due: "25/04/2026", color: "#0EA5A4", icon: "book" },
];

// ================= PHASE 4: PRIORITY QUEUE FROM INSIGHTS =================

type InsightType =
  | "safety_test"
  | "overdue_work"
  | "gallery_review"
  | "gallery_submit"
  | "gallery_feedback"
  | "nm_checkpoint"
  | "continue_work"
  | "due_soon"
  | "unit_complete";

type InsightRow = {
  type: InsightType;
  title: string;
  subtitle?: string;
  href?: string;
  priority: number;
  timestamp?: string;
};

// Per-type visual mapping. Mirrors the Bold palette used elsewhere.
const INSIGHT_ICON: Record<InsightType, IconName> = {
  overdue_work:      "alert",
  safety_test:       "shield",
  gallery_review:    "star",
  gallery_submit:    "star",
  gallery_feedback:  "msg",
  nm_checkpoint:     "star",
  continue_work:     "play",
  due_soon:          "clock",
  unit_complete:     "check",
};

const INSIGHT_COLOR: Record<InsightType, string> = {
  overdue_work:      "#DC2626", // red
  safety_test:       "#D97706", // amber
  gallery_review:    "#EC4899", // pink
  gallery_submit:    "#EC4899",
  gallery_feedback:  "#EC4899",
  nm_checkpoint:     "#EC4899",
  continue_work:     "#0EA5A4", // teal
  due_soon:          "#D97706", // amber
  unit_complete:     "#10B981", // emerald
};

/** Format an ISO timestamp for the compact "Coming up" card's date column. */
function formatShortDate(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Map a single insight row into the shape the Priority cards consume. */
function insightToQueueItem(insight: InsightRow, kind: QueueItem["kind"]): QueueItem {
  const color = INSIGHT_COLOR[insight.type] ?? "#0EA5A4";
  const icon = INSIGHT_ICON[insight.type] ?? "clock";
  // Prefer the insight's own subtitle — already human-friendly ("3 days remaining", etc.).
  const dueText =
    kind === "overdue"
      ? insight.subtitle || "Overdue"
      : kind === "today"
        ? "Today · focus"
        : insight.subtitle || "Coming up";
  return {
    kind,
    title: insight.title,
    sub: insight.subtitle || "",
    dueText,
    due: formatShortDate(insight.timestamp),
    color,
    icon,
    href: insight.href,
  };
}

type PriorityBuckets = { overdue: QueueItem[]; today: QueueItem[]; soon: QueueItem[] };

const MOCK_BUCKETS: PriorityBuckets = {
  overdue: QUEUE_MOCK.filter((q) => q.kind === "overdue"),
  today:   QUEUE_MOCK.filter((q) => q.kind === "today"),
  soon:    QUEUE_MOCK.filter((q) => q.kind === "soon"),
};

/** Classify insights into 3 queue buckets by type.
 *  - Overdue: type === "overdue_work"
 *  - Today:   type === "continue_work" (top 1 — the unit the student was working on)
 *  - Soon:    everything else, capped at 5 by priority
 */
function classifyInsights(insights: InsightRow[]): PriorityBuckets {
  const overdue: QueueItem[] = [];
  const todayCandidates: InsightRow[] = [];
  const soon: InsightRow[] = [];

  for (const i of insights) {
    if (i.type === "overdue_work") {
      overdue.push(insightToQueueItem(i, "overdue"));
    } else if (i.type === "continue_work") {
      todayCandidates.push(i);
    } else {
      soon.push(i);
    }
  }

  // Take the highest-priority continue_work as today's focus
  const todayTop = todayCandidates.sort((a, b) => b.priority - a.priority)[0];
  const today = todayTop ? [insightToQueueItem(todayTop, "today")] : [];

  soon.sort((a, b) => b.priority - a.priority);
  const soonItems = soon.slice(0, 5).map((i) => insightToQueueItem(i, "soon"));

  return { overdue, today, soon: soonItems };
}

type UnitState = "in-progress" | "open-studio" | "not-started";
type StudentUnit = {
  id: string; title: string; kicker: string; classTag: string;
  color: string; tint: string; img: string; progress: number;
  state: UnitState; task: string; due: string;
};

const S_UNITS: StudentUnit[] = [
  { id: "biom",    title: "Biomimicry",                     kicker: "Plastic pouch inspired by nature",      classTag: "7 Design",  color: "#0EA5A4", tint: "#CCFBF1", img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",    progress: 34, state: "in-progress", task: "Sketch 3 ideas",            due: "Sketchbook · Apr 25" },
  { id: "arcade",  title: "Arcade Machine",                 kicker: "Build a working coin-op arcade",        classTag: "Service",   color: "#EC4899", tint: "#FCE7F3", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900&h=600&fit=crop",    progress: 62, state: "in-progress", task: "Discovery journey",         due: "First playtest · May 2" },
  { id: "coffee",  title: "Coffee Table",                   kicker: "Designing and building a coffee table", classTag: "10 Design", color: "#9333EA", tint: "#E9D5FF", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",    progress: 12, state: "open-studio", task: "Open Studio available",     due: "Prototype · May 3" },
  { id: "pinball", title: "Engineering a Pinball Machine",  kicker: "Workshop unit · mechanical systems",    classTag: "Workshop",  color: "#F59E0B", tint: "#FEF3C7", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",           due: "Starts Apr 22" },
  { id: "recycle", title: "Recycling Awareness",            kicker: "Correct bins across campus",            classTag: "Service",   color: "#10B981", tint: "#D1FAE5", img: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",           due: "Starts Apr 24" },
  { id: "co2",     title: "CO2 Racer",                      kicker: "Speed Through Science & Design",        classTag: "10 Design", color: "#E86F2C", tint: "#FFEDD5", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",           due: "Starts Apr 28" },
];

type EarnedBadge = { name: string; icon: IconName; color: string; when: string };
type NextBadge = { name: string; icon: IconName; color: string; progress: number; unlock: string };
const BADGES: { earned: EarnedBadge[]; next: NextBadge[] } = {
  earned: [
    { name: "General Workshop Safety", icon: "shield", color: "#10B981", when: "Earned 2 weeks ago" },
    { name: "Hand Tool Safety",        icon: "wrench", color: "#0EA5A4", when: "Earned 2 weeks ago" },
  ],
  next: [
    { name: "Electronics & Soldering", icon: "bolt",  color: "#D97706", progress: 0,  unlock: "Pass safety test" },
    { name: "3D Printer Safety",       icon: "print", color: "#9333EA", progress: 40, unlock: "2 of 5 checks done" },
    { name: "Design Journal Streak",   icon: "flame", color: "#EC4899", progress: 70, unlock: "7-day streak · 5/7" },
  ],
};

type FeedbackItem = { from: string; initials: string; grad: string; unit: string; msg: string; when: string };
const FEEDBACK: FeedbackItem[] = [
  { from: "Mr. Griffiths", initials: "MG", grad: "from-[#9333EA] to-[#E86F2C]", unit: "Biomimicry",     msg: "Your leaf sketch from Monday is a great start — try one with a radial vein pattern next?", when: "1d" },
  { from: "Ms. Tanaka",    initials: "KT", grad: "from-[#0EA5A4] to-[#3B82F6]", unit: "Arcade Machine", msg: "Excellent discovery journey entries this week. Love your research on marquee art history!",  when: "3d" },
];

// ================= ICONS =================
type IconName =
  | "arrow" | "play" | "check" | "chev" | "chevR" | "plus" | "more"
  | "bell" | "search" | "alert" | "clock" | "shield" | "star" | "book"
  | "wrench" | "bolt" | "print" | "flame" | "trophy" | "msg" | "sparkle";

function Icon({ name, size = 16, s = 2 }: { name: IconName; size?: number; s?: number }) {
  const p = {
    strokeWidth: s,
    stroke: "currentColor",
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
  };
  const shapes: Record<IconName, JSX.Element> = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    play:  <path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none" />,
    check: <path d="M20 6L9 17l-5-5" />,
    chev:  <path d="M6 9l6 6 6-6" />,
    chevR: <path d="M9 6l6 6-6 6" />,
    plus:  <path d="M12 5v14M5 12h14" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" />
      </>
    ),
    bell:  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.35-4.35" />
      </>
    ),
    alert: <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
    star:   <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />,
    book:   <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zM4 19.5V21h15" />,
    wrench: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
    bolt:   <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
    print: (
      <>
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </>
    ),
    flame: <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />,
    trophy: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M12 15v6M8 21h8M6 4v5a6 6 0 0 0 12 0V4z" />,
    msg:    <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9 8.5 8.5 0 0 1 7.6 4.7 8.4 8.4 0 0 1 .9 3.8z" />,
    sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />,
  };
  return <svg {...p}>{shapes[name]}</svg>;
}

// ================= RING PROGRESS =================
function RingProgress({ pct, size = 96, stroke = 8, color }: { pct: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="ring-track" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
      />
    </svg>
  );
}

// ================= TOP NAV =================
function TopNav({ student, loading }: { student: SessionStudent; loading: boolean }) {
  return (
    <header className="sticky top-0 z-30 bg-[var(--sl-bg)]/80 backdrop-blur-lg border-b border-[var(--sl-hair)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[var(--sl-ink)] flex items-center justify-center text-white display text-[15px]">#</div>
          <div className="display text-[17px] leading-none">StudioLoom</div>
        </div>
        <div className="w-px h-6 bg-[var(--sl-hair)] mx-1" />
        <nav className="flex items-center gap-0.5">
          {NAV_S.map((n, i) => (
            <button
              key={n}
              className={`px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition ${
                i === 0 ? "bg-[var(--sl-ink)] text-white" : "text-[var(--sl-ink-2)] hover:bg-white"
              }`}
            >
              {n}
            </button>
          ))}
        </nav>
        <div className="flex-1" />
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--sl-ink-2)]">
          <Icon name="search" size={16} />
        </button>
        <button className="w-9 h-9 rounded-full hover:bg-white flex items-center justify-center text-[var(--sl-ink-2)] relative">
          <Icon name="bell" size={16} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626] border-2 border-[var(--sl-bg)]" />
        </button>
        <div className="flex items-center gap-2.5 pl-1">
          <div className="text-right">
            {loading ? (
              <>
                <div className="h-3 w-16 rounded bg-[var(--sl-hair)] animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-[var(--sl-hair)] animate-pulse mt-1" />
              </>
            ) : (
              <>
                <div className="text-[12px] font-bold leading-none">{student.name}</div>
                {student.classTag && (
                  <div className="text-[10.5px] text-[var(--sl-ink-3)] mt-0.5 leading-none">{student.classTag}</div>
                )}
              </>
            )}
          </div>
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${student.avatarGrad} text-white flex items-center justify-center font-bold text-[11px]`}>
            {loading ? "" : student.initials}
          </div>
        </div>
      </div>
    </header>
  );
}

// ================= RESUME HERO =================
function ResumeHero({ student, hero }: { student: SessionStudent; hero: HeroUnit }) {
  const n = hero;
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <div className="cap text-[var(--sl-ink-3)]">Good morning, {student.first}</div>
          <h1 className="display-lg text-[44px] leading-[0.95] mt-1">Let&apos;s pick up where you left off.</h1>
        </div>
        <div className="text-[12px] text-[var(--sl-ink-3)] font-semibold hidden md:block">
          Mon 20 Apr · 9:00 AM · <span className="text-[var(--sl-ink)] font-extrabold">Period 1 starting soon</span>
        </div>
      </div>

      <div className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner" style={{ background: n.color }}>
        <div className="grid grid-cols-12 gap-0 items-stretch">
          {/* Left — content */}
          <div className="col-span-7 p-9 text-white relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
              <span className="pulse" style={{ color: "#FFF" }} />
              Currently working on · {n.class}
            </div>
            <h2 className="display-lg text-[88px] leading-[0.88] mt-5 text-white">{n.unitTitle}.</h2>
            <p className="text-[20px] leading-snug mt-2 text-white/85 max-w-md font-medium">{n.unitSub}</p>

            <div className="mt-7 bg-white rounded-2xl p-4 flex items-center gap-4 max-w-lg text-[var(--sl-ink)]">
              <div className="relative flex-shrink-0">
                <RingProgress pct={(n.taskProgress / n.taskTotal) * 100} size={64} stroke={6} color={n.color} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="display text-[14px] tnum" style={{ color: n.colorDark }}>
                    {n.taskProgress}
                    <span className="text-[9px] text-[var(--sl-ink-3)]">/{n.taskTotal}</span>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="cap text-[var(--sl-ink-3)]">Your current task</div>
                <div className="display text-[18px] leading-tight mt-0.5">{n.currentTask}</div>
                <div className="text-[11.5px] text-[var(--sl-ink-3)] mt-1 font-semibold">
                  Due <span className="text-[var(--sl-ink)] font-bold">{n.dueIn}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6">
              <button className="bg-white text-[var(--sl-ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                <Icon name="play" size={11} s={0} /> Continue
              </button>
              <button className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px]">
                Open journal
              </button>
            </div>
          </div>

          {/* Right — image + teacher note */}
          <div className="col-span-5 relative">
            <div className="absolute inset-0" style={{ background: n.color }}>
              {n.img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.img} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${n.color} 0%, transparent 35%)` }} />
            </div>
            <div className="absolute bottom-6 right-6 left-6 bg-white/95 backdrop-blur rounded-2xl p-4 card-shadow">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-extrabold text-[10px]">MG</div>
                <div>
                  <div className="text-[11.5px] font-extrabold">
                    Mr. Griffiths <span className="font-semibold text-[var(--sl-ink-3)]">· {n.teacherNote.when}</span>
                  </div>
                </div>
              </div>
              <p className="text-[12.5px] mt-2 leading-relaxed text-[var(--sl-ink-2)]">&ldquo;{n.teacherNote.msg}&rdquo;</p>
              <button className="text-[11px] font-extrabold mt-2 hover:underline" style={{ color: n.colorDark }}>
                Reply in journal →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= PRIORITY QUEUE =================
function Priority({ buckets }: { buckets: PriorityBuckets }) {
  const { overdue, today, soon } = buckets;

  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="grid grid-cols-12 gap-5">
        {/* Overdue */}
        <div className="col-span-4">
          <div className="cap text-[#DC2626] mb-3">Overdue · {overdue.length}</div>
          {overdue.map((q, i) => (
            <article key={i} className="relative rounded-3xl p-6 card-shadow-lg glow-inner overflow-hidden text-white" style={{ background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)" }}>
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1 text-[10.5px] font-extrabold">
                <Icon name="alert" size={11} s={3} /> {q.dueText}
              </div>
              <h3 className="display text-[26px] leading-tight mt-4">{q.title}</h3>
              <p className="text-[13px] text-white/85 mt-1">{q.sub}</p>
              <div className="flex items-center gap-2 mt-5">
                {q.href ? (
                  <Link href={q.href} className="bg-white text-[#991B1B] rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5 hover:shadow-lg">
                    Complete now <Icon name="arrow" size={11} s={2.5} />
                  </Link>
                ) : (
                  <button className="bg-white text-[#991B1B] rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5 hover:shadow-lg">
                    Complete now <Icon name="arrow" size={11} s={2.5} />
                  </button>
                )}
                <button className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-2 font-bold text-[12px]">Snooze</button>
              </div>
            </article>
          ))}
        </div>

        {/* Today */}
        <div className="col-span-4">
          <div className="cap text-[var(--sl-ink-2)] mb-3">Due today · {today.length}</div>
          {today.map((q, i) => (
            <article key={i} className="relative bg-white rounded-3xl p-6 card-shadow overflow-hidden" style={{ borderLeft: `6px solid ${q.color}` }}>
              <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10.5px] font-extrabold" style={{ background: `${q.color}1a`, color: q.color }}>
                <Icon name="clock" size={11} s={3} /> {q.dueText}
              </div>
              <h3 className="display text-[22px] leading-tight mt-4">{q.title}</h3>
              <p className="text-[12.5px] text-[var(--sl-ink-3)] mt-1">{q.sub}</p>
              <div className="flex items-center gap-2 mt-5">
                {q.href ? (
                  <Link href={q.href} className="btn-primary rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5">
                    Open task <Icon name="arrow" size={11} s={2.5} />
                  </Link>
                ) : (
                  <button className="btn-primary rounded-full px-4 py-2 font-extrabold text-[12.5px] inline-flex items-center gap-1.5">
                    Open task <Icon name="arrow" size={11} s={2.5} />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>

        {/* Coming up */}
        <div className="col-span-4">
          <div className="cap text-[var(--sl-ink-2)] mb-3">Coming up · {soon.length}</div>
          <div className="bg-white rounded-3xl p-2 card-shadow">
            {soon.map((q, i) => {
              const rowClass = "w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--sl-bg)] transition text-left";
              const rowContent = (
                <>
                  <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: `${q.color}1a`, color: q.color }}>
                    <Icon name={q.icon} size={14} s={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-extrabold leading-tight truncate">{q.title}</div>
                    <div className="text-[11px] text-[var(--sl-ink-3)] truncate mt-0.5">{q.sub}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10.5px] font-extrabold" style={{ color: q.color }}>{q.dueText.replace("Due ", "")}</div>
                    <div className="text-[10px] text-[var(--sl-ink-3)] tnum">{q.due}</div>
                  </div>
                </>
              );
              return q.href ? (
                <Link key={i} href={q.href} className={rowClass}>{rowContent}</Link>
              ) : (
                <button key={i} className={rowClass}>{rowContent}</button>
              );
            })}
            <button className="w-full text-[11.5px] font-bold text-[var(--sl-ink-3)] hover:text-[var(--sl-ink)] py-2">See all upcoming →</button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= UNITS GRID =================
function UnitCard({ u }: { u: StudentUnit }) {
  const isNotStarted = u.state === "not-started";
  const cta = isNotStarted ? "Start unit" : u.state === "open-studio" ? "Open Studio" : "Continue";
  return (
    <article className="group bg-white rounded-3xl overflow-hidden card-shadow hover:card-shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="aspect-[16/9] relative overflow-hidden" style={{ background: u.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={u.img} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${u.color}cc 0%, transparent 45%)` }} />
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: u.color }}>
          <span className="w-5 h-5 rounded-full" style={{ background: u.color }} />
          {u.classTag}
        </div>
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-full p-1 flex items-center gap-1.5 pr-2.5">
          <div className="relative w-7 h-7 flex-shrink-0">
            <RingProgress pct={Math.max(u.progress, 0.5)} size={28} stroke={3} color={u.color} />
          </div>
          <div className="text-[10.5px] font-extrabold tnum" style={{ color: u.color }}>{u.progress}%</div>
        </div>
      </div>
      <div className="p-5">
        <h3 className="display text-[22px] leading-none">{u.title}</h3>
        <p className="text-[12.5px] text-[var(--sl-ink-3)] mt-1.5 leading-snug">{u.kicker}</p>
        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-[var(--sl-hair)]">
          <div>
            <div className="text-[10.5px] text-[var(--sl-ink-3)] font-semibold">{isNotStarted ? "Starts" : "Current task"}</div>
            <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: u.color }}>{u.task}</div>
          </div>
          <button className="text-white rounded-full px-4 py-2 font-extrabold text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap hover:brightness-110 transition" style={{ background: u.color }}>
            {cta} <Icon name="arrow" size={10} s={2.5} />
          </button>
        </div>
        <div className="text-[10.5px] text-[var(--sl-ink-3)] mt-2 font-semibold">{u.due}</div>
      </div>
    </article>
  );
}

function UnitsGrid() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--sl-ink-3)]">Your units · {S_UNITS.length}</div>
          <h2 className="display text-[32px] leading-none mt-1">Everything you&apos;re working on.</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="bg-white border border-[var(--sl-hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm">In progress</button>
          <button className="bg-white border border-[var(--sl-hair)] rounded-full px-4 py-2 text-[12.5px] font-bold hover:shadow-sm text-[var(--sl-ink-3)]">All</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-5">
        {S_UNITS.map((u) => <UnitCard key={u.id} u={u} />)}
      </div>
    </section>
  );
}

// ================= BADGES =================
function BadgeCircle({ b, size = 88 }: { b: { name: string; icon: IconName; color: string; when?: string | null }; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${b.color}35 0%, ${b.color}08 60%, transparent 85%)` }} />
        <div className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${b.color} 0%, ${b.color}cc 100%)`, boxShadow: `0 8px 24px -8px ${b.color}80` }}>
          <div className="text-white"><Icon name={b.icon} size={Math.round(size * 0.38)} s={2} /></div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-extrabold leading-tight">{b.name}</div>
        {b.when && <div className="text-[10px] text-[var(--sl-ink-3)] mt-0.5">{b.when}</div>}
      </div>
    </div>
  );
}

function BadgeProgress({ b }: { b: NextBadge }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-[var(--sl-hair)] flex items-center gap-4">
      <div className="relative flex-shrink-0" style={{ width: 52, height: 52 }}>
        <RingProgress pct={b.progress} size={52} stroke={4} color={b.color} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ color: b.color }}>
          <Icon name={b.icon} size={20} s={2} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-extrabold leading-tight">{b.name}</div>
        <div className="text-[10.5px] text-[var(--sl-ink-3)] mt-0.5">{b.unlock}</div>
        <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: `${b.color}1a` }}>
          <div className="h-full rounded-full" style={{ width: `${Math.max(b.progress, 4)}%`, background: b.color }} />
        </div>
      </div>
      <div className="text-[11px] font-extrabold tnum" style={{ color: b.color }}>{b.progress}%</div>
    </div>
  );
}

function Badges() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-5 relative rounded-3xl overflow-hidden card-shadow-lg glow-inner p-8 text-white" style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)" }}>
          <div className="relative">
            <div className="cap text-white/60 inline-flex items-center gap-2"><Icon name="trophy" size={12} s={2.5} /> You&apos;ve earned</div>
            <h2 className="display text-[56px] leading-none mt-1">
              {BADGES.earned.length} badges<span className="text-[#FBBF24]">.</span>
            </h2>
            <div className="text-[13px] text-white/70 mt-2">Nice work — both earned through your workshop safety tests.</div>
            <div className="mt-8 flex items-center gap-6">
              {BADGES.earned.map((b, i) => (
                <BadgeCircle key={i} b={{ ...b, when: null }} size={76} />
              ))}
            </div>
          </div>
          <div className="absolute top-6 right-6 text-[#FBBF24] opacity-70"><Icon name="sparkle" size={48} s={1.5} /></div>
          <div className="absolute bottom-6 right-20 text-[#FBBF24] opacity-40"><Icon name="sparkle" size={24} s={1.5} /></div>
        </div>

        <div className="col-span-7">
          <div className="cap text-[var(--sl-ink-3)] mb-3">Next to unlock · {BADGES.next.length}</div>
          <div className="flex flex-col gap-2.5">
            {BADGES.next.map((b, i) => <BadgeProgress key={i} b={b} />)}
          </div>
          <button className="text-[12px] font-bold text-[var(--sl-ink-3)] hover:text-[var(--sl-ink)] mt-3 inline-flex items-center gap-1">
            All badges <Icon name="chevR" size={11} s={2.5} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ================= FEEDBACK =================
function Feedback() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12 pb-20">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--sl-ink-3)]">Recent feedback · from teachers</div>
          <h2 className="display text-[32px] leading-none mt-1">What your teachers said.</h2>
        </div>
        <button className="text-[12.5px] font-bold text-[var(--sl-ink-2)] hover:text-[var(--sl-ink)] inline-flex items-center gap-1">
          All messages <Icon name="chevR" size={12} s={2.5} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-5">
        {FEEDBACK.map((f, i) => (
          <article key={i} className="bg-white rounded-3xl p-6 card-shadow flex gap-4 items-start">
            <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${f.grad} text-white flex items-center justify-center font-extrabold text-[13px] flex-shrink-0`}>{f.initials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-extrabold">{f.from}</div>
                  <div className="text-[11px] text-[var(--sl-ink-3)]">On {f.unit} · {f.when} ago</div>
                </div>
                <button className="text-[11px] font-extrabold hover:underline">Reply →</button>
              </div>
              <p className="text-[13.5px] mt-2 leading-relaxed text-[var(--sl-ink-2)]">&ldquo;{f.msg}&rdquo;</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ================= SCOPED STYLES =================
// All custom CSS scoped under .sl-v2 so it can't leak elsewhere.
const SCOPED_CSS = `
.sl-v2 {
  --sl-bg: #F7F6F2;
  --sl-surface: #FFFFFF;
  --sl-ink: #0A0A0A;
  --sl-ink-2: #3A3A3A;
  --sl-ink-3: #6B6B6B;
  --sl-hair: #E8E6DF;
  --sl-display-tracking: -0.035em;
  font-family: var(--font-dm-sans), system-ui, sans-serif;
  background: var(--sl-bg);
  color: var(--sl-ink);
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
}
.sl-v2 .display, .sl-v2 .display-lg {
  font-family: var(--font-manrope), system-ui, sans-serif;
  letter-spacing: var(--sl-display-tracking);
  font-weight: 700;
}
.sl-v2 .display-lg { letter-spacing: -0.045em; }
.sl-v2 .tnum { font-variant-numeric: tabular-nums; }
.sl-v2 .cap {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  font-size: 10.5px;
}
.sl-v2 .card-shadow {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 8px 24px -12px rgba(10,10,10,0.08);
}
.sl-v2 .card-shadow-lg {
  box-shadow: 0 1px 2px rgba(10,10,10,0.04), 0 16px 48px -20px rgba(10,10,10,0.18);
}
.sl-v2 .glow-inner::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(circle at 20% 15%, rgba(255,255,255,0.28), transparent 55%);
}
.sl-v2 .pulse {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  position: relative;
}
.sl-v2 .pulse::after {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 999px;
  border: 2px solid currentColor;
  opacity: 0;
  animation: sl-v2-ring 2s ease-out infinite;
}
@keyframes sl-v2-ring {
  0%   { opacity: 0.6; transform: scale(0.6); }
  100% { opacity: 0;   transform: scale(1.8); }
}
.sl-v2 .btn-primary {
  background: var(--sl-ink);
  color: white;
  font-weight: 700;
  letter-spacing: -0.01em;
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.sl-v2 .btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 28px -12px rgba(10,10,10,0.35);
}
.sl-v2 .ring-track { stroke: var(--sl-hair); }
`;

// ================= APP =================
export default function DashboardV2Client() {
  const [student, setStudent] = useState<SessionStudent>(STUDENT_MOCK);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [hero, setHero] = useState<HeroUnit>(HERO_MOCK);
  const [buckets, setBuckets] = useState<PriorityBuckets>(MOCK_BUCKETS);

  // Mount-time style inject (scoped via .sl-v2).
  useEffect(() => {
    const id = "sl-v2-scoped-styles";
    if (document.getElementById(id)) return;
    const el = document.createElement("style");
    el.id = id;
    el.textContent = SCOPED_CSS;
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, []);

  // Load real session if available; fall back to mock for scaffold/preview mode.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/student-session");
        if (!res.ok) return; // 401 → stay on mock (preview mode)
        const data: SessionResponse = await res.json();
        if (!cancelled && data.student) setStudent(toSessionStudent(data));
      } catch {
        /* silent — keep mock */
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load real insights → classify into priority buckets (Phase 4).
  // Fall back silently to MOCK_BUCKETS on 401 or error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/insights");
        if (!res.ok) return;
        const data = (await res.json()) as { insights?: InsightRow[] };
        const list = data.insights ?? [];
        if (list.length === 0) return; // no real insights → keep mock for preview
        if (!cancelled) setBuckets(classifyInsights(list));
      } catch {
        /* silent — keep mock */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load real units + pick hero unit. Then fetch unit detail to wire the
  // current-task card (Phase 3B). Fall back silently to HERO_MOCK.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/student/units");
        if (!res.ok) return;
        const data = (await res.json()) as { units?: UnitRow[] };
        const selected = selectHeroUnit(data.units ?? []);
        if (!selected) return;
        if (cancelled) return;
        // First render: hero identity (fast — no second fetch needed yet).
        const heroIdentity = buildHeroUnit(selected);
        setHero(heroIdentity);

        // Second fetch: full progress + responses + due dates for the selected
        // unit — needed to resolve the current activity block.
        const detailRes = await fetch(`/api/student/unit?unitId=${selected.id}`);
        if (!detailRes.ok || cancelled) return;
        const detail = (await detailRes.json()) as UnitDetailResponse;
        const pageId = selectCurrentPageId(detail.unit.content_data, detail.progress);
        const currentProgress = detail.progress.find((p) => p.page_id === pageId);
        const responses = (currentProgress?.responses ?? {}) as Record<string, unknown>;
        const task = computeTaskState(detail.unit.content_data, pageId, responses);
        const dueInText = pageId ? computeDueInText(detail.pageDueDates[pageId]) : null;

        if (cancelled) return;
        setHero({
          ...heroIdentity,
          currentTask: task?.currentTask ?? heroIdentity.currentTask,
          taskProgress: task?.taskProgress ?? heroIdentity.taskProgress,
          taskTotal: task?.taskTotal ?? heroIdentity.taskTotal,
          dueIn: dueInText ?? heroIdentity.dueIn,
        });
      } catch {
        /* silent — keep mock */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sl-v2">
      <TopNav student={student} loading={sessionLoading} />
      <ResumeHero student={student} hero={hero} />
      <Priority buckets={buckets} />
      <UnitsGrid />
      <Badges />
      <Feedback />
    </div>
  );
}
