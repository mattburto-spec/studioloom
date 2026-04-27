"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStudent } from "@/app/(student)/student-context";
import { renderCriterionLabel, getCriterionColor } from "@/lib/frameworks/render-helpers";
import type { FrameworkId } from "@/lib/frameworks/adapter";
import { ProgressCircle } from "./ProgressCircle";
import type { UnitNavData } from "@/contexts/UnitNavContext";
import type { UnitPage, StudentProgress } from "@/types";

// ---------------------------------------------------------------------------
// Phase / criterion colors (solid hex for sidebar indicators)
// ---------------------------------------------------------------------------
const PHASE_HEX: Record<string, string> = {
  Research: "#3B82F6",
  Ideation: "#8B5CF6",
  Planning: "#6366F1",
  "Skill Building": "#F59E0B",
  Making: "#22C55E",
  Testing: "#F97316",
  Iteration: "#14B8A6",
  Evaluation: "#F43F5E",
  Presentation: "#EC4899",
};

function getPhaseHex(label: string): string {
  if (PHASE_HEX[label]) return PHASE_HEX[label];
  for (const [k, v] of Object.entries(PHASE_HEX)) {
    if (label.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "#6B7280";
}

// ---------------------------------------------------------------------------
// Status helper (same logic as ChapterNav)
// ---------------------------------------------------------------------------
function getPageStatus(
  page: UnitPage,
  progress: StudentProgress[],
  lockedPages: string[]
): "locked" | "complete" | "in_progress" | "not_started" {
  if (lockedPages.includes(page.id)) return "locked";
  const p = progress.find((pr) => pr.page_id === page.id);
  if (!p) return "not_started";
  return p.status as "complete" | "in_progress" | "not_started";
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------
interface SidebarGroup {
  key: string;
  label: string;
  color: string;
  pages: UnitPage[];
}

function buildGroups(pages: UnitPage[], framework: FrameworkId): SidebarGroup[] {
  const groups: SidebarGroup[] = [];
  let lastPhase = "";

  for (const page of pages) {
    // v4 timeline: group by phaseLabel
    if (page.phaseLabel) {
      if (page.phaseLabel !== lastPhase) {
        groups.push({
          key: `phase-${groups.length}`,
          label: page.phaseLabel,
          color: getPhaseHex(page.phaseLabel),
          pages: [page],
        });
        lastPhase = page.phaseLabel;
      } else {
        groups[groups.length - 1].pages.push(page);
      }
      continue;
    }

    // v2: group by criterion — resolve via FrameworkAdapter
    if (page.type === "strand" && page.criterion) {
      const existing = groups.find((g) => g.key === `crit-${page.criterion}`);
      if (existing) {
        existing.pages.push(page);
      } else {
        const rendered = renderCriterionLabel(page.criterion as string, framework);
        const displayLabel =
          rendered.kind === "label" || rendered.kind === "implicit"
            ? `${rendered.short}: ${rendered.name}`
            : page.criterion as string;
        const color = getCriterionColor(page.criterion as string, framework);
        groups.push({
          key: `crit-${page.criterion}`,
          label: displayLabel,
          color,
          pages: [page],
        });
      }
      continue;
    }

    // Default: add to last group or create ungrouped
    if (groups.length > 0) {
      groups[groups.length - 1].pages.push(page);
    } else {
      groups.push({
        key: "_lessons",
        label: "Lessons",
        color: "#6B7280",
        pages: [page],
      });
    }
    lastPhase = "";
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Sidebar component
// ---------------------------------------------------------------------------
interface LessonSidebarProps {
  data: UnitNavData;
  unitId: string;
  sidebarOpen: boolean;
  onClose: () => void;
}

export function LessonSidebar({ data, unitId, sidebarOpen, onClose }: LessonSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { classInfo } = useStudent();
  const framework: FrameworkId =
    (classInfo?.framework as FrameworkId | null | undefined) ?? "IB_MYP";
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Current page ID from URL
  const currentPageId = useMemo(() => {
    const parts = pathname.split("/");
    return parts[parts.length - 1] || "";
  }, [pathname]);

  const groups = useMemo(() => buildGroups(data.enabledPages, framework), [data.enabledPages, framework]);
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].label !== "Lessons");

  // Progress stats
  const completedCount = data.progress.filter((p) => p.status === "complete").length;
  const totalCount = data.enabledPages.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function navigateToPage(pageId: string) {
    router.push(`/unit/${unitId}/${pageId}`);
    onClose();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Unit header */}
      <div
        className="p-4"
        style={{ borderBottom: "1px solid var(--sl-hair)" }}
      >
        {data.unit.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.unit.thumbnail_url}
            alt=""
            className="w-full aspect-video rounded-lg object-cover mb-3"
          />
        )}
        <h2
          className="text-sm font-bold leading-snug line-clamp-2"
          style={{ color: "var(--sl-ink)" }}
        >
          {data.unit.title}
        </h2>
        {/* Progress bar */}
        <div className="mt-3">
          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--sl-hair)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: "var(--sl-ink)" }}
            />
          </div>
          <p
            className="text-[10px] font-bold uppercase tracking-wider mt-1.5"
            style={{ color: "var(--sl-ink-3)" }}
          >
            {pct}% Complete
          </p>
        </div>
      </div>

      {/* Lesson nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups.has(group.key);

          return (
            <div key={group.key} className="mb-1">
              {/* Group header */}
              {hasMultipleGroups && (
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-[var(--sl-bg)]"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                    style={{ color: "var(--sl-ink-3)" }}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider truncate"
                    style={{ color: group.color }}
                  >
                    {group.label}
                  </span>
                </button>
              )}

              {/* Lesson items */}
              {!isCollapsed && group.pages.map((page) => {
                const status = getPageStatus(page, data.progress, data.lockedPages);
                const isActive = page.id === currentPageId;
                const globalIndex = data.enabledPages.findIndex((p) => p.id === page.id);
                // Strip phase prefix from title for cleaner sidebar display
                const displayTitle = page.phaseLabel && page.title.startsWith(`${page.phaseLabel}: `)
                  ? page.title.slice(page.phaseLabel.length + 2)
                  : page.title;

                return (
                  <button
                    key={page.id}
                    onClick={() => status !== "locked" && navigateToPage(page.id)}
                    disabled={status === "locked"}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-all duration-150 ${
                      isActive
                        ? "bg-[var(--sl-bg)]"
                        : "hover:bg-[var(--sl-bg)]"
                    } ${status === "locked" ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                    style={{
                      borderLeft: `3px solid ${isActive ? group.color : "transparent"}`,
                    }}
                  >
                    <ProgressCircle status={status} size={18} color={group.color} />
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-xs leading-snug truncate"
                        style={{
                          color: isActive ? "var(--sl-ink)" : "var(--sl-ink-2)",
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {globalIndex >= 0 ? `${globalIndex + 1}. ` : ""}{displayTitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Back to dashboard */}
      <div
        className="p-3"
        style={{ borderTop: "1px solid var(--sl-hair)" }}
      >
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-[var(--sl-bg)]"
          style={{ color: "var(--sl-ink-3)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="lesson-bold hidden md:flex flex-col w-64 flex-shrink-0 h-screen sticky top-0 overflow-hidden"
        style={{
          background: "var(--sl-paper)",
          borderRight: "1px solid var(--sl-hair)",
        }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={onClose}
          />
          <aside
            className="lesson-bold fixed inset-y-0 left-0 w-72 z-50 md:hidden animate-slide-in-left shadow-2xl overflow-hidden flex flex-col"
            style={{ background: "var(--sl-paper)" }}
          >
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
