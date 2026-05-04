"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getPageList, getPageById } from "@/lib/unit-adapter";
import type { UnitContentData, StudentProgress } from "@/types";
import { useStudent } from "../student-context";
import { useBellCount } from "@/components/student/BellCountContext";
import { composedPromptText } from "@/lib/lever-1/compose-prompt";
import {
  Icon,
  type IconName,
  type SessionStudent,
  studentToSession,
} from "@/components/student/BoldTopNav";

/* ================================================================
 * Student Dashboard v2 — Bold redesign
 * Content sections (hero, priority queue, units, badges) + their
 * data-loading effects. Header/nav and session fetch now live in
 * (student)/layout.tsx + BoldTopNav since Phase 10.
 * ================================================================ */

// SessionStudent, AVATAR_GRADS, getInitials, gradFor, STUDENT_MOCK,
// toSessionStudent, and NAV_S moved to BoldTopNav.tsx in Phase 10.

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
  /** Continue button target — URL of the current task's page. null = inert. */
  continueHref: string | null;
  // Placeholders until Phase 3B:
  currentTask: string;
  taskProgress: number;
  taskTotal: number;
  dueIn: string;
  /** Teacher note card — null until Phase 14 (notes system) ships.
   *  HERO_MOCK keeps a value so the preview/scaffold path can still show
   *  the card, but buildHeroUnit() returns null so real students never
   *  see a fake Mr. Griffiths message. */
  teacherNote: { from: string; msg: string; when: string } | null;
};

const HERO_MOCK: HeroUnit = {
  unitTitle: "Biomimicry",
  unitSub: "Plastic pouch inspired by nature",
  class: "7 Design",
  color: "#0EA5A4",
  colorDark: "#0F766E",
  img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1000&h=1200&fit=crop",
  continueHref: null,
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
  // Provisional Continue target — resumes at the most-recently-touched page
  // we know about from /api/student/units. Gets refined by the unit-detail
  // fetch which has full content_data + responses.
  const pages = getPageList(unit.content_data);
  const sortedProgress = [...unit.progress].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const resumePageId =
    sortedProgress.find((p) => pages.some((pg) => pg.id === p.page_id))?.page_id ??
    pages[0]?.id ??
    null;
  const continueHref = resumePageId ? `/unit/${unit.id}/${resumePageId}` : null;

  return {
    unitTitle: unit.title,
    unitSub: unit.description || "",
    class: unit.class_name || "",
    color: palette.color,
    colorDark: palette.colorDark,
    img: unit.thumbnail_url,
    continueHref,
    // Phase 3B placeholders — filled by loadUnitDetail() after the second fetch
    currentTask: HERO_MOCK.currentTask,
    taskProgress: HERO_MOCK.taskProgress,
    taskTotal: HERO_MOCK.taskTotal,
    dueIn: HERO_MOCK.dueIn,
    // Phase 9.4 — hide teacher note on real data until Phase 14 notes system
    teacherNote: null,
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
  // Lever 1: composedPromptText prefers the v2 slot fields and falls back
  // to legacy `prompt` automatically.
  const prompt = composedPromptText(section);
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

// Phase 5: Open Studio state intentionally NOT represented here. When a
// student has Open Studio enabled, it becomes its own card in the grid
// (or the hero card if it's their active focus), not an inline marker on
// a regular unit card. See docs/projects/student-dashboard-v2.md "Key
// product decisions" for context.
type UnitState = "in-progress" | "not-started";
type StudentUnit = {
  id: string;
  title: string;
  kicker: string;
  classTag: string;
  color: string;
  img: string | null;
  progress: number;
  state: UnitState;
  task: string;
  href: string;
};

const S_UNITS_MOCK: StudentUnit[] = [
  { id: "biom",    title: "Biomimicry",                     kicker: "Plastic pouch inspired by nature",      classTag: "7 Design",  color: "#0EA5A4", img: "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=900&h=600&fit=crop",    progress: 34, state: "in-progress", task: "Continue lesson",  href: "#" },
  { id: "arcade",  title: "Arcade Machine",                 kicker: "Build a working coin-op arcade",        classTag: "Service",   color: "#EC4899", img: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900&h=600&fit=crop",    progress: 62, state: "in-progress", task: "Continue lesson",  href: "#" },
  { id: "coffee",  title: "Coffee Table",                   kicker: "Designing and building a coffee table", classTag: "10 Design", color: "#9333EA", img: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=900&h=600&fit=crop",    progress: 12, state: "in-progress", task: "Continue lesson",  href: "#" },
  { id: "pinball", title: "Engineering a Pinball Machine",  kicker: "Workshop unit · mechanical systems",    classTag: "Workshop",  color: "#F59E0B", img: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",  href: "#" },
  { id: "recycle", title: "Recycling Awareness",            kicker: "Correct bins across campus",            classTag: "Service",   color: "#10B981", img: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",  href: "#" },
  { id: "co2",     title: "CO2 Racer",                      kicker: "Speed Through Science & Design",        classTag: "10 Design", color: "#E86F2C", img: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=900&h=600&fit=crop",    progress: 0,  state: "not-started", task: "Start this unit",  href: "#" },
];

/** Build a grid card from a /api/student/units row. */
function unitRowToStudentUnit(unit: UnitRow): StudentUnit {
  const palette = detectUnitPalette({
    classSubject: unit.class_subject,
    className: unit.class_name,
    title: unit.title,
    id: unit.id,
  });
  const pages = getPageList(unit.content_data);
  const completeCount = unit.progress.filter((p) => p.status === "complete").length;
  const progressPct = pages.length === 0 ? 0 : Math.round((completeCount / pages.length) * 100);

  // Resume at the most-recently-touched page if there's one, else first page.
  const sortedProgress = [...unit.progress].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const resumePageId =
    sortedProgress.find((p) => pages.some((pg) => pg.id === p.page_id))?.page_id ??
    pages[0]?.id ??
    null;
  const href = resumePageId ? `/unit/${unit.id}/${resumePageId}` : `/unit/${unit.id}/narrative`;

  const state: UnitState = unit.progress.length === 0 ? "not-started" : "in-progress";

  return {
    id: unit.id,
    title: unit.title,
    kicker: unit.description || "",
    classTag: unit.class_name || "",
    color: palette.color,
    img: unit.thumbnail_url,
    progress: progressPct,
    state,
    task: state === "not-started" ? "Start this unit" : "Continue lesson",
    href,
  };
}

type EarnedBadge = { name: string; icon: IconName; color: string; when: string };
type NextBadge = { name: string; icon: IconName; color: string; progress: number; unlock: string };
type BadgesState = { earned: EarnedBadge[]; next: NextBadge[] };

const BADGES_MOCK: BadgesState = {
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

// ================= PHASE 6: BADGES FROM SAFETY API =================

type SafetyBadgeEarned = {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_color: string;
  earned_at: string;
};

type SafetyBadgePending = {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  badge_color: string;
  student_status: "not_started" | "cooldown" | "expired";
  cooldown_until?: string;
};

type SafetyResponse = { earned?: SafetyBadgeEarned[]; pending?: SafetyBadgePending[] };

// Map backend icon slug → our IconName. Fallback to "shield".
function mapBadgeIcon(slug: string | undefined): IconName {
  const iconSet: Record<string, IconName> = {
    shield: "shield", wrench: "wrench", bolt: "bolt", print: "print",
    flame: "flame", trophy: "trophy", star: "star", book: "book",
    check: "check", plus: "plus",
  };
  return (slug && iconSet[slug.toLowerCase()]) || "shield";
}

/** Human-friendly "earned X ago" / "earned today" string. */
function relativeTimeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "Earned recently";
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60)     return "Earned just now";
  if (seconds < 3600)   return `Earned ${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)  return `Earned ${Math.floor(seconds / 3600)}h ago`;
  const days = Math.floor(seconds / 86400);
  if (days === 1)       return "Earned yesterday";
  if (days < 14)        return `Earned ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9)        return `Earned ${weeks} weeks ago`;
  return then.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

/** Convert the safety API response into the view-model the Badges section uses. */
function toBadgesState(resp: SafetyResponse): BadgesState {
  const earned: EarnedBadge[] = (resp.earned ?? []).map((b) => ({
    name: b.badge_name,
    icon: mapBadgeIcon(b.badge_icon),
    color: b.badge_color || "#10B981",
    when: relativeTimeAgo(b.earned_at),
  }));

  const next: NextBadge[] = (resp.pending ?? []).map((b) => ({
    name: b.badge_name,
    icon: mapBadgeIcon(b.badge_icon),
    color: b.badge_color || "#D97706",
    progress: 0, // safety badges are binary — pass/not pass, no partial progress
    unlock:
      b.student_status === "cooldown"
        ? "In cooldown · try again soon"
        : b.student_status === "expired"
          ? "Needs retake"
          : "Pass safety test",
  }));

  return { earned, next };
}

// Feedback section dropped in Phase 7 — no backing data model yet for
// teacher-to-student messages. Returns when the general notes system
// ships (see docs/projects/student-dashboard-v2.md end-of-project TODO).

// Icon + IconName now imported from @/components/student/BoldTopNav.

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

// TopNav moved to @/components/student/BoldTopNav and is now mounted
// from (student)/layout.tsx so every student route shares it.

// ================= RESUME HERO =================
/** Time-of-day greeting based on the student's browser clock. */
function timeGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ResumeHero({ student, hero, onFocus }: { student: SessionStudent; hero: HeroUnit; onFocus: () => void }) {
  const n = hero;
  return (
    <section id="dashboard-hero" className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="mb-4 px-1">
        <div className="cap text-[var(--sl-ink-3)]">{timeGreeting()}, {student.first}</div>
        <h1 className="display-lg text-[30px] md:text-[44px] leading-[0.95] mt-1">Let&apos;s pick up where you left off.</h1>
        {/* Date / time / period-status removed 23 Apr 2026 — was hard-coded
            mock never wired to real timetable data. Return when timetable
            integration lands. */}
      </div>

      <div className="relative rounded-[32px] overflow-hidden card-shadow-lg glow-inner" style={{ background: n.color }}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch">
          {/* Left — content */}
          <div className="md:col-span-7 p-6 md:p-9 text-white relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-3 py-1.5 text-[11.5px] font-bold">
              <span className="pulse" style={{ color: "#FFF" }} />
              Currently working on · {n.class}
            </div>
            {/* Auto-scale title: short unit names stay dramatic, long ones
                shrink so they're more likely to fit a single line. Buckets
                tuned for col-span-7 width at lg breakpoint. */}
            {(() => {
              const len = n.unitTitle.length;
              const cls =
                len > 22 ? "text-[40px] md:text-[52px]"
                : len > 16 ? "text-[48px] md:text-[64px]"
                : len > 10 ? "text-[52px] md:text-[76px]"
                : "text-[52px] md:text-[88px]";
              return (
                <h2 className={`display-lg ${cls} leading-[0.88] mt-5 text-white`}>{n.unitTitle}.</h2>
              );
            })()}
            {n.unitSub && (
              <p className="text-[16px] md:text-[20px] leading-snug mt-2 text-white/85 max-w-md font-medium line-clamp-2">
                {n.unitSub}
              </p>
            )}

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
              {n.continueHref ? (
                <Link href={n.continueHref} className="bg-white text-[var(--sl-ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                  <Icon name="play" size={11} s={0} /> Continue
                </Link>
              ) : (
                <button className="bg-white text-[var(--sl-ink)] rounded-full px-6 py-3 font-bold text-[14px] inline-flex items-center gap-2 hover:shadow-lg transition">
                  <Icon name="play" size={11} s={0} /> Continue
                </button>
              )}
              {/* "Open journal" button removed 23 Apr 2026 — no backing route
                  and duplicated Continue's destination. Returns in Phase 14
                  when the notes/journal system ships. */}
              {/* Focus — hides everything except the next step (Phase 12). */}
              <button
                onClick={onFocus}
                className="bg-white/15 backdrop-blur hover:bg-white/25 text-white rounded-full px-5 py-3 font-bold text-[13.5px] inline-flex items-center gap-1.5"
                aria-label="Enter focus mode"
              >
                <Icon name="sparkle" size={12} s={2.5} />
                Focus
              </button>
            </div>
          </div>

          {/* Right — image + teacher note. Hidden below md — the hero card
              is already expressive enough with the unit colour, and the
              teacher note hides on real data anyway. */}
          <div className="hidden md:block md:col-span-5 relative">
            <div className="absolute inset-0" style={{ background: n.color }}>
              {n.img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.img} alt="" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${n.color} 0%, transparent 35%)` }} />
            </div>
            {n.teacherNote && (
              <div className="absolute bottom-6 right-6 left-6 bg-white/95 backdrop-blur rounded-2xl p-4 card-shadow">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#9333EA] to-[#E86F2C] text-white flex items-center justify-center font-extrabold text-[10px]">
                    {n.teacherNote.from.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[11.5px] font-extrabold">
                      {n.teacherNote.from} <span className="font-semibold text-[var(--sl-ink-3)]">· {n.teacherNote.when}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[12.5px] mt-2 leading-relaxed text-[var(--sl-ink-2)]">&ldquo;{n.teacherNote.msg}&rdquo;</p>
                <button className="text-[11px] font-extrabold mt-2 hover:underline" style={{ color: n.colorDark }}>
                  Reply in journal →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= FOCUS OVERLAY (Phase 12) =================
// Full-screen replacement of the dashboard when the student hits "Focus".
// Renders above the BoldTopNav (z-50), shows only the next-step card,
// exits on Esc or the "Back to dashboard" button.
function FocusOverlay({ hero, onExit }: { hero: HeroUnit; onExit: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onExit]);

  const pct = hero.taskTotal > 0 ? (hero.taskProgress / hero.taskTotal) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--sl-bg)] overflow-auto">
      <button
        onClick={onExit}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--sl-ink-2)] hover:text-[var(--sl-ink)] bg-white rounded-full px-4 py-2 card-shadow"
        aria-label="Exit focus mode"
      >
        ← Back to dashboard
      </button>

      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-xl w-full text-center">
          <div className="cap text-[var(--sl-ink-3)]">Your next step</div>
          <div className="mt-6 mx-auto relative" style={{ width: 128, height: 128 }}>
            <RingProgress pct={pct} size={128} stroke={10} color={hero.color} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="display text-[26px] tnum" style={{ color: hero.colorDark }}>
                {hero.taskProgress}
                <span className="text-[14px] text-[var(--sl-ink-3)]">/{hero.taskTotal}</span>
              </div>
            </div>
          </div>
          <h1 className="display-lg text-[40px] md:text-[56px] leading-[0.95] mt-8">
            {hero.currentTask}
          </h1>
          {hero.dueIn && (
            <div className="text-[14px] text-[var(--sl-ink-3)] mt-3 font-semibold">
              Due <span className="text-[var(--sl-ink)] font-bold">{hero.dueIn}</span>
            </div>
          )}
          <div className="mt-8 flex items-center justify-center gap-2">
            {hero.continueHref ? (
              <Link
                href={hero.continueHref}
                className="text-white rounded-full px-8 py-3.5 font-bold text-[15px] inline-flex items-center gap-2 hover:brightness-110 transition"
                style={{ background: hero.color }}
              >
                <Icon name="play" size={12} s={0} /> Continue
              </Link>
            ) : (
              <button
                className="text-white rounded-full px-8 py-3.5 font-bold text-[15px] inline-flex items-center gap-2"
                style={{ background: hero.color }}
              >
                <Icon name="play" size={12} s={0} /> Continue
              </button>
            )}
          </div>
          <div className="text-[11px] text-[var(--sl-ink-3)] mt-6 font-semibold">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white border border-[var(--sl-hair)] text-[var(--sl-ink-2)]">Esc</kbd> to exit
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= PRIORITY QUEUE =================
/**
 * Dashboard middle row.
 *
 * Used to be the 3-col priority queue (Overdue · Due today · Coming up)
 * plus a separate full-width Badges section below. Matt's call 23 Apr:
 * those big red Overdue / accent-rule Today cards felt heavy for what
 * was usually 0-1 items. Collapsed into a single 3-col row:
 *
 *   [ Earned badges ]  [ Next to unlock ]  [ Coming up ]
 *
 * Keeps the #dashboard-priority anchor so the nav bell still scrolls here.
 */
function MiddleRow({ buckets, badges }: { buckets: PriorityBuckets; badges: BadgesState }) {
  const { soon } = buckets;
  const { earned, next } = badges;
  const earnedCount = earned.length;
  const headline =
    earnedCount === 0
      ? "No badges yet."
      : `${earnedCount} badge${earnedCount === 1 ? "" : "s"}`;

  return (
    <section id="dashboard-priority" className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Earned badges card */}
        <Link
          href="/skills"
          className="md:col-span-5 relative rounded-3xl overflow-hidden card-shadow-lg glow-inner p-6 text-white group hover:card-shadow-lg block"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 100%)" }}
        >
          <div className="relative">
            <div className="cap text-white/60 inline-flex items-center gap-2"><Icon name="trophy" size={12} s={2.5} /> You&apos;ve earned</div>
            <h2 className="display text-[40px] leading-none mt-1">
              {headline}{earnedCount > 0 && <span className="text-[#FBBF24]">.</span>}
            </h2>
            {earned.length > 0 && (
              <div className="mt-5 flex items-center gap-4 flex-wrap">
                {earned.slice(0, 4).map((b, i) => (
                  <BadgeCircle key={i} b={{ ...b, when: null }} size={64} />
                ))}
              </div>
            )}
            {earnedCount === 0 && (
              <div className="text-[12px] text-white/70 mt-2">
                Pass a safety test to earn your first badge.
              </div>
            )}
            <div className="mt-5 text-[11px] font-extrabold text-white/70 group-hover:text-white inline-flex items-center gap-1 transition">
              See all skills <Icon name="arrow" size={11} s={2.5} />
            </div>
          </div>
          <div className="absolute top-5 right-5 text-[#FBBF24] opacity-60"><Icon name="sparkle" size={36} s={1.5} /></div>
        </Link>

        {/* Next to unlock */}
        <div className="md:col-span-4">
          <div className="cap text-[var(--sl-ink-3)] mb-3">Next to unlock · {next.length}</div>
          {next.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-[var(--sl-hair)] text-[13px] text-[var(--sl-ink-3)]">
              Nothing to unlock right now.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {next.slice(0, 3).map((b, i) => <BadgeProgress key={i} b={b} />)}
            </div>
          )}
        </div>

        {/* Coming up */}
        <div className="md:col-span-3">
          <div className="cap text-[var(--sl-ink-2)] mb-3">Coming up · {soon.length}</div>
          <div className="bg-white rounded-3xl p-2 card-shadow">
            {soon.length === 0 ? (
              <div className="p-4 text-[12px] text-[var(--sl-ink-3)] text-center">
                Nothing upcoming.
              </div>
            ) : (
              soon.map((q, i) => {
                const rowClass = "w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[var(--sl-bg)] transition text-left";
                const rowContent = (
                  <>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: `${q.color}1a`, color: q.color }}>
                      <Icon name={q.icon} size={14} s={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-extrabold leading-tight truncate">{q.title}</div>
                      <div className="text-[10.5px] text-[var(--sl-ink-3)] truncate mt-0.5">{q.sub}</div>
                    </div>
                  </>
                );
                return q.href ? (
                  <Link key={i} href={q.href} className={rowClass}>{rowContent}</Link>
                ) : (
                  <button key={i} className={rowClass}>{rowContent}</button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ================= UNITS GRID =================
function UnitCard({ u }: { u: StudentUnit }) {
  const isNotStarted = u.state === "not-started";
  const cta = isNotStarted ? "Start unit" : "Continue";
  return (
    <Link href={u.href} className="group bg-white rounded-3xl overflow-hidden card-shadow hover:card-shadow-lg hover:-translate-y-0.5 transition-all flex flex-col">
      <div className="aspect-[16/9] relative overflow-hidden" style={{ background: u.color }}>
        {u.img && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.img} alt="" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${u.color}cc 0%, transparent 45%)` }} />
        {u.classTag && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-[11px] font-extrabold" style={{ color: u.color }}>
            <span className="w-5 h-5 rounded-full" style={{ background: u.color }} />
            {u.classTag}
          </div>
        )}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-full p-1 flex items-center gap-1.5 pr-2.5">
          <div className="relative w-7 h-7 flex-shrink-0">
            <RingProgress pct={Math.max(u.progress, 0.5)} size={28} stroke={3} color={u.color} />
          </div>
          <div className="text-[10.5px] font-extrabold tnum" style={{ color: u.color }}>{u.progress}%</div>
        </div>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="display text-[22px] leading-none">{u.title}</h3>
        {u.kicker && <p className="text-[12.5px] text-[var(--sl-ink-3)] mt-1.5 leading-snug">{u.kicker}</p>}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4 border-t border-[var(--sl-hair)]">
          <div>
            <div className="text-[10.5px] text-[var(--sl-ink-3)] font-semibold">{isNotStarted ? "Starts" : "Current task"}</div>
            <div className="text-[12px] font-extrabold leading-tight mt-0.5" style={{ color: u.color }}>{u.task}</div>
          </div>
          <span className="text-white rounded-full px-4 py-2 font-extrabold text-[12px] inline-flex items-center gap-1.5 whitespace-nowrap group-hover:brightness-110 transition" style={{ background: u.color }}>
            {cta} <Icon name="arrow" size={10} s={2.5} />
          </span>
        </div>
      </div>
    </Link>
  );
}

function UnitsGrid({ units }: { units: StudentUnit[] }) {
  const [filter, setFilter] = useState<"in-progress" | "all">("in-progress");
  const inProgressCount = units.filter((u) => u.state === "in-progress").length;
  const visible = filter === "in-progress"
    ? units.filter((u) => u.state === "in-progress")
    : units;

  const chipClass = (active: boolean) =>
    `bg-white border border-[var(--sl-hair)] rounded-full px-4 py-2 text-[12.5px] font-bold transition ${
      active ? "text-[var(--sl-ink)] shadow-sm" : "text-[var(--sl-ink-3)] hover:shadow-sm"
    }`;

  return (
    <section id="dashboard-units" className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="cap text-[var(--sl-ink-3)]">
            Your units · {filter === "in-progress" ? `${inProgressCount} in progress` : `${units.length} total`}
          </div>
          <h2 className="display text-[32px] leading-none mt-1">Everything you&apos;re working on.</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("in-progress")}
            className={chipClass(filter === "in-progress")}
          >
            In progress · {inProgressCount}
          </button>
          <button
            onClick={() => setFilter("all")}
            className={chipClass(filter === "all")}
          >
            All · {units.length}
          </button>
        </div>
      </div>
      {visible.length === 0 ? (
        filter === "in-progress" ? (
          <div className="bg-white rounded-2xl border border-[var(--sl-hair)] p-8 text-center">
            <div className="text-[13px] text-[var(--sl-ink-3)]">
              No units in progress yet. Start one below — open a unit and save a response to get going.
            </div>
            <button
              onClick={() => setFilter("all")}
              className="mt-4 btn-primary rounded-full px-4 py-2 text-[12.5px] inline-flex items-center gap-1.5"
            >
              Show all units <Icon name="arrow" size={11} s={2.5} />
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[var(--sl-hair)] p-8 text-center text-[13px] text-[var(--sl-ink-3)]">
            No units assigned yet — your teacher will add some soon.
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {visible.map((u) => <UnitCard key={u.id} u={u} />)}
        </div>
      )}
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

// Standalone Badges section removed 23 Apr 2026 — earned + next-to-unlock
// now render inline within <MiddleRow />, replacing the Overdue and
// Due-today slots from the old priority queue. BadgeCircle + BadgeProgress
// sub-components are still used by MiddleRow.

// Feedback section (teacher messages) removed in Phase 7. Will return
// when the general notes system ships — see end-of-project TODO.

// Scoped .sl-v2 CSS now lives alongside BoldTopNav and is injected from
// there — covers every student route since Phase 10, not just this page.

// ================= LOADING SKELETONS =================
// Shown until each section's fetch resolves — prevents the "mock flashes
// then swaps to real data" behaviour that surfaces on slow networks or
// cold Vercel serverless cold-starts.

function skelBlock(className: string) {
  return <div className={`rounded-xl bg-[var(--sl-hair)]/50 animate-pulse ${className}`} />;
}

function HeroSkeleton() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="flex items-end justify-between mb-4 px-1">
        <div className="space-y-3">
          {skelBlock("h-3 w-40")}
          {skelBlock("h-10 w-[440px]")}
        </div>
      </div>
      <div className="rounded-[32px] overflow-hidden card-shadow-lg h-[380px] bg-[var(--sl-hair)]/40 animate-pulse" />
    </section>
  );
}

/** Rendered when the student has no assigned units — skips the "pick up
 *  where you left off" framing entirely. */
function EmptyHero({ firstName }: { firstName: string }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-8">
      <div className="mb-4 px-1">
        <div className="cap text-[var(--sl-ink-3)]">{greet}, {firstName}</div>
        <h1 className="display-lg text-[30px] md:text-[44px] leading-[0.95] mt-1">No units yet.</h1>
      </div>
      <div className="rounded-[32px] bg-white card-shadow p-10 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--sl-hair)]/60 mx-auto flex items-center justify-center">
          <Icon name="book" size={28} s={1.8} />
        </div>
        <h2 className="display text-[22px] mt-5">Nothing assigned yet</h2>
        <p className="text-[13.5px] text-[var(--sl-ink-3)] mt-2 max-w-md mx-auto">
          Your teacher will add units for you to work through. Check back soon, or head to the Safety page to earn your workshop badges while you wait.
        </p>
      </div>
    </section>
  );
}

function MiddleRowSkeleton() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-10">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {skelBlock("md:col-span-5 h-52")}
        <div className="md:col-span-4 space-y-3">
          {skelBlock("h-3 w-24")}
          {skelBlock("h-16 w-full")}
          {skelBlock("h-16 w-full")}
        </div>
        <div className="md:col-span-3 space-y-3">
          {skelBlock("h-3 w-20")}
          {skelBlock("h-52 w-full")}
        </div>
      </div>
    </section>
  );
}

function UnitsGridSkeleton() {
  return (
    <section className="max-w-[1400px] mx-auto px-6 pt-12">
      <div className="flex items-end justify-between mb-4">
        <div className="space-y-2">
          {skelBlock("h-3 w-32")}
          {skelBlock("h-8 w-80")}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-[var(--sl-hair)]/50 animate-pulse h-80 w-full" />
        ))}
      </div>
    </section>
  );
}

// BadgesSkeleton removed — badges now live inside the middle row, covered
// by MiddleRowSkeleton.

// ================= APP =================
export default function DashboardClient() {
  // Session comes from the layout via StudentContext (Phase 10). The hero
  // derives its SessionStudent view-model from the raw Student + classInfo
  // using the same helper BoldTopNav uses.
  const { student, classInfo } = useStudent();
  const sessionStudent: SessionStudent = studentToSession(student, classInfo?.name);

  // The nav's bell badge is provided via BellCountContext — dashboard owns
  // the insights fetch, so it pushes the count up to the layout-owned nav.
  const { setCount: setBellCount } = useBellCount();

  // Initial state is null so we render skeletons until the fetch resolves.
  // On success → real data. On 401/error → fall back to MOCK (preview mode).
  // This prevents the "mock flashes, then swaps to real data" behaviour.
  const [hero, setHero] = useState<HeroUnit | null>(null);
  const [buckets, setBuckets] = useState<PriorityBuckets | null>(null);
  const [units, setUnits] = useState<StudentUnit[] | null>(null);
  const [badges, setBadges] = useState<BadgesState | null>(null);
  // Distinguishes "hero fetch resolved with no unit" from "hero fetch still
  // in flight". Lets us render an empty-state hero instead of the skeleton
  // forever when a student genuinely has no assigned units.
  const [heroLoaded, setHeroLoaded] = useState(false);

  // Phase 12 — focus mode. Hides everything except the current next step.
  const [focusMode, setFocusMode] = useState(false);

  // Keep the nav's bell badge in sync with the priority queue.
  useEffect(() => {
    setBellCount((buckets?.overdue.length ?? 0) + (buckets?.today.length ?? 0));
  }, [buckets, setBellCount]);

  // Load badges (earned + pending) from the safety API (Phase 6).
  // Sets MOCK on 401/error so preview mode still renders, just without
  // the mock flashing first.
  useEffect(() => {
    let cancelled = false;
    const empty: BadgesState = { earned: [], next: [] };
    (async () => {
      try {
        const res = await fetch("/api/student/safety/pending");
        if (!res.ok) { if (!cancelled) setBadges(empty); return; }
        const data = (await res.json()) as SafetyResponse;
        // toBadgesState handles empty earned/pending gracefully; no need
        // to fall back to mock data when the real student has nothing yet.
        if (!cancelled) setBadges(toBadgesState(data));
      } catch {
        if (!cancelled) setBadges(empty);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load real insights → classify into priority buckets (Phase 4).
  useEffect(() => {
    let cancelled = false;
    const empty: PriorityBuckets = { overdue: [], today: [], soon: [] };
    (async () => {
      try {
        const res = await fetch("/api/student/insights");
        if (!res.ok) { if (!cancelled) setBuckets(empty); return; }
        const data = (await res.json()) as { insights?: InsightRow[] };
        const list = data.insights ?? [];
        // classifyInsights([]) returns the empty shape — no mock fallback needed.
        if (!cancelled) setBuckets(classifyInsights(list));
      } catch {
        if (!cancelled) setBuckets(empty);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load real units + pick hero unit. Then fetch unit detail to wire the
  // current-task card (Phase 3B).
  useEffect(() => {
    let cancelled = false;
    const setEmpty = () => {
      if (cancelled) return;
      setUnits([]);
      setHero(null); // sentinel for "no unit" — paired with heroLoaded flag below
      setHeroLoaded(true);
    };
    (async () => {
      try {
        const res = await fetch("/api/student/units");
        if (!res.ok) { setEmpty(); return; }
        const data = (await res.json()) as { units?: UnitRow[] };
        const unitRows = data.units ?? [];

        if (unitRows.length === 0) { setEmpty(); return; }

        if (!cancelled) setUnits(unitRows.map(unitRowToStudentUnit));

        const selected = selectHeroUnit(unitRows);
        if (!selected) { setEmpty(); return; }
        if (cancelled) return;
        // First render: hero identity (fast — no second fetch needed yet).
        const heroIdentity = buildHeroUnit(selected);
        setHero(heroIdentity);
        setHeroLoaded(true);

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
        const refinedContinueHref = pageId
          ? `/unit/${selected.id}/${pageId}`
          : heroIdentity.continueHref;
        setHero({
          ...heroIdentity,
          continueHref: refinedContinueHref,
          currentTask: task?.currentTask ?? heroIdentity.currentTask,
          taskProgress: task?.taskProgress ?? heroIdentity.taskProgress,
          taskTotal: task?.taskTotal ?? heroIdentity.taskTotal,
          dueIn: dueInText ?? heroIdentity.dueIn,
        });
      } catch {
        setEmpty();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {hero
        ? <ResumeHero student={sessionStudent} hero={hero} onFocus={() => setFocusMode(true)} />
        : heroLoaded
          ? <EmptyHero firstName={sessionStudent.first} />
          : <HeroSkeleton />}
      {buckets && badges
        ? <MiddleRow buckets={buckets} badges={badges} />
        : <MiddleRowSkeleton />}
      {units ? <UnitsGrid units={units} /> : <UnitsGridSkeleton />}
      {/* Bottom padding — replaces old <Feedback /> slot (dropped Phase 7) */}
      <div className="pb-20" />

      {/* Phase 12 — focus overlay. Renders above everything (including the
          layout-owned BoldTopNav) when focusMode is true. */}
      {focusMode && hero && (
        <FocusOverlay hero={hero} onExit={() => setFocusMode(false)} />
      )}
    </>
  );
}
