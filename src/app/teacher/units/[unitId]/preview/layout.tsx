"use client";

/**
 * Preview Layout — wraps lesson preview pages with a LHS sidebar
 * matching the student experience, but under teacher auth.
 *
 * No student context, no progress tracking. All lessons shown as
 * "not started" since this is a read-only preview.
 */

import { use, useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getPageList, normalizeContentData } from "@/lib/unit-adapter";
import { getPageColor } from "@/lib/constants";
import { renderCriterionLabel, getCriterionColor } from "@/lib/frameworks/render-helpers";
import type { FrameworkId } from "@/lib/frameworks/adapter";
import type { Unit, UnitPage } from "@/types";

// ---------------------------------------------------------------------------
// Phase colors (same as student LessonSidebar)
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
// Grouping (same logic as student sidebar)
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

    if (page.type === "strand" && page.criterion) {
      const existing = groups.find((g) => g.key === `crit-${page.criterion}`);
      if (existing) {
        existing.pages.push(page);
      } else {
        const rendered = renderCriterionLabel(page.criterion as string, framework);
        const displayLabel =
          rendered.kind === "label" || rendered.kind === "implicit"
            ? `${rendered.short}: ${rendered.name}`
            : (page.criterion as string);
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
// Preview Sidebar
// ---------------------------------------------------------------------------
function PreviewSidebar({
  unit,
  pages,
  unitId,
  currentPageId,
  sidebarOpen,
  onClose,
}: {
  unit: Unit;
  pages: UnitPage[];
  unitId: string;
  currentPageId: string;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const framework: FrameworkId = "IB_MYP"; // Default for preview
  const groups = useMemo(() => buildGroups(pages, framework), [pages]);
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].label !== "Lessons");

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function navigateToPage(pageId: string) {
    router.push(`/teacher/units/${unitId}/preview/${pageId}`);
    onClose();
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Unit header */}
      <div className="p-4 border-b border-white/10">
        {unit.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={unit.thumbnail_url}
            alt=""
            className="w-full aspect-video rounded-lg object-cover mb-3"
          />
        )}
        <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">
          {unit.title}
        </h2>
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mt-2">
          {pages.length} lesson{pages.length !== 1 ? "s" : ""} — Preview
        </p>
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
                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-white/5 transition-colors"
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
                    className={`text-white/40 transition-transform duration-150 ${isCollapsed ? "" : "rotate-90"}`}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider truncate">
                    {group.label}
                  </span>
                </button>
              )}

              {/* Lesson items */}
              {!isCollapsed && group.pages.map((page) => {
                const isActive = page.id === currentPageId;
                const globalIndex = pages.findIndex((p) => p.id === page.id);
                const displayTitle = page.phaseLabel && page.title.startsWith(`${page.phaseLabel}: `)
                  ? page.title.slice(page.phaseLabel.length + 2)
                  : page.title;

                return (
                  <button
                    key={page.id}
                    onClick={() => navigateToPage(page.id)}
                    className={`w-full flex items-center gap-2.5 px-4 py-2 text-left transition-all duration-150 border-l-3 ${
                      isActive
                        ? "bg-white/10 border-l-[3px]"
                        : "border-l-[3px] border-transparent hover:bg-white/5"
                    } cursor-pointer`}
                    style={isActive ? { borderLeftColor: group.color } : undefined}
                  >
                    {/* Simple number circle instead of progress circle */}
                    <span
                      className={`flex-shrink-0 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold ${
                        isActive ? "text-white" : "text-white/50 border border-white/20"
                      }`}
                      style={isActive ? { backgroundColor: group.color } : undefined}
                    >
                      {globalIndex + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-snug truncate ${
                        isActive ? "text-white font-semibold" : "text-white/70"
                      }`}>
                        {displayTitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Back to unit */}
      <div className="p-3 border-t border-white/10">
        <Link
          href={`/teacher/units/${unitId}`}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Exit Preview
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 bg-gradient-to-b from-[#1A1A2E] to-[#2D1B69] border-r border-white/10 h-screen sticky top-0 overflow-hidden">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-gradient-to-b from-[#1A1A2E] to-[#2D1B69] z-50 md:hidden shadow-2xl overflow-hidden flex flex-col">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export default function PreviewLayout({
  params,
  children,
}: {
  params: Promise<{ unitId: string }>;
  children: React.ReactNode;
}) {
  const { unitId } = use(params);
  const pathname = usePathname();

  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPageId = useMemo(() => {
    const parts = pathname.split("/");
    return parts[parts.length - 1] || "";
  }, [pathname]);

  useEffect(() => {
    async function loadUnit() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("units")
          .select("*")
          .eq("id", unitId)
          .single();
        if (data) setUnit(data as Unit);
      } catch {
        // handled by page
      } finally {
        setLoading(false);
      }
    }
    loadUnit();
  }, [unitId]);

  const pages = useMemo(() => {
    if (!unit) return [];
    return getPageList(normalizeContentData(unit.content_data));
  }, [unit]);

  if (loading || !unit) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading preview...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <PreviewSidebar
        unit={unit}
        pages={pages}
        unitId={unitId}
        currentPageId={currentPageId}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 min-w-0 overflow-x-hidden">
        {/* Preview banner */}
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mobile menu button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 hover:bg-amber-200 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="text-sm font-semibold text-amber-800">Student Preview</span>
              <span className="text-xs text-amber-600 hidden sm:inline">Read-only view of how students see this lesson</span>
            </div>
            <Link
              href={`/teacher/units/${unitId}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Exit Preview
            </Link>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
