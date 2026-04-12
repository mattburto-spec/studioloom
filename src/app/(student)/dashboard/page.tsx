"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { useStudent } from "../student-context";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { getThemeStyles, type ThemeId } from "@/lib/student/themes";
import { ToolModal } from "@/components/toolkit/ToolModal";
import { UnitThumbnail } from "@/components/shared/UnitThumbnail";
import { BadgeIcon } from "@/components/safety/BadgeIcon";
import { TrophyShelf } from "@/components/student/TrophyShelf";
import type { Unit, StudentProgress, UnitPage } from "@/types";

interface ToolSession {
  id: string;
  tool_id: string;
  challenge: string;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  version: number;
}

interface Insight {
  type: "safety_test" | "overdue_work" | "gallery_review" | "gallery_submit" | "gallery_feedback" | "nm_checkpoint" | "continue_work" | "due_soon" | "unit_complete";
  title: string;
  subtitle?: string;
  time?: string;
  actionUrl?: string;
  priority: number;
}

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
  page_due_dates?: Record<string, string>;
  class_id?: string | null;
  class_name?: string | null;
  class_subject?: string | null;
  class_grade_level?: string | null;
}

export default function StudentDashboard() {
  const { student } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentToolSessions, setRecentToolSessions] = useState<ToolSession[]>([]);
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [openStudioUnits, setOpenStudioUnits] = useState<Set<string>>(new Set());
  const [earnedBadges, setEarnedBadges] = useState<Array<{
    badge_id: string;
    badge_name: string;
    badge_icon: string;
    badge_color: string;
  }>>([]);
  const [nextClass, setNextClass] = useState<{ short: string; room?: string } | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  const themeStyles = useMemo(() => {
    const themeId = (student as any)?.theme_id as ThemeId | null;
    return getThemeStyles(themeId);
  }, [student]);

  const loadToolSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/student/tool-sessions?limit=50");
      if (res.ok) {
        const data = await res.json();
        setRecentToolSessions(data.sessions || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadOpenStudioStatus = useCallback(async (unitList: UnitWithProgress[]) => {
    const unlocked = new Set<string>();
    await Promise.all(
      unitList.map(async (unit) => {
        try {
          const res = await fetch(`/api/student/open-studio/status?unitId=${unit.id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.unlocked) unlocked.add(unit.id);
          }
        } catch { /* silent */ }
      })
    );
    setOpenStudioUnits(unlocked);
  }, []);

  const loadPendingBadges = useCallback(async () => {
    try {
      const res = await fetch("/api/student/safety/pending");
      if (res.ok) {
        const data = await res.json();
        setEarnedBadges(data.earned || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/student/insights");
      if (res.ok) {
        const data = await res.json();
        setInsights((data.insights || []).map((i: any) => ({
          type: i.type,
          title: i.title,
          subtitle: i.subtitle,
          actionUrl: i.href,
          priority: i.priority,
          time: i.timestamp ? new Date(i.timestamp).toLocaleDateString() : undefined,
        })));
      }
    } catch { /* silent */ }
  }, []);

  const loadNextClass = useCallback(async (unitId: string) => {
    try {
      const res = await fetch(`/api/student/next-class?unitId=${unitId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.nextClass) setNextClass({ short: data.nextClass.short, room: data.nextClass.room });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    async function loadAll() {
      if (!student) return;
      try {
        const res = await fetch("/api/student/units");
        if (res.ok) {
          const data = await res.json();
          const unitList = data.units || [];
          setUnits(unitList);
          loadOpenStudioStatus(unitList);
          const inProg = unitList.find((u: UnitWithProgress) => {
            const pages = getPageList(u.content_data);
            if (pages.length === 0) return false;
            const complete = u.progress.filter((p: StudentProgress) => p.status === "complete").length;
            const pct = Math.round((complete / pages.length) * 100);
            return pct > 0 && pct < 100;
          });
          if (inProg) loadNextClass(inProg.id);
          else if (unitList.length > 0) loadNextClass(unitList[0].id);
        }
      } finally {
        setLoading(false);
      }
    }
    loadAll();
    loadToolSessions();
    loadPendingBadges();
    loadInsights();
  }, [student, loadOpenStudioStatus, loadToolSessions, loadPendingBadges, loadInsights, loadNextClass]);

  const insightIcon = (type: Insight["type"]) => {
    const iconProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "currentColor", strokeWidth: 0 };
    const svgs: Record<string, JSX.Element> = {
      safety_test: <svg {...iconProps} stroke="#D97706" fill="none" strokeWidth="2"><path d="M12 2L2 7v7c0 5 10 8 10 8s10-3 10-8V7l-10-5z" /></svg>,
      overdue_work: <svg {...iconProps} stroke="#EF4444" fill="none" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
      gallery_review: <svg {...iconProps} stroke="#EC4899" fill="none" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
      gallery_submit: <svg {...iconProps} stroke="#EC4899" fill="none" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
      gallery_feedback: <svg {...iconProps} stroke="#10B981" fill="none" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
      nm_checkpoint: <svg {...iconProps} stroke="#FF2D78" fill="none" strokeWidth="2"><polygon points="12 2 15.09 10.26 24 10.35 17.18 16.54 19.34 24.04 12 18.77 4.66 24.04 6.82 16.54 0 10.35 8.91 10.26 12 2" /></svg>,
      due_soon: <svg {...iconProps} stroke="#D97706" fill="none" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
      unit_complete: <svg {...iconProps} stroke="#10B981" fill="none" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>,
      continue_work: <svg {...iconProps} stroke="#8B5CF6" fill="none" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
    };
    return svgs[type] || svgs.continue_work;
  };

  function getCompletionPercent(unit: Unit, progress: StudentProgress[]): number {
    const unitPages = getPageList(unit.content_data);
    if (unitPages.length === 0) return 0;
    const complete = progress.filter((p) => p.status === "complete").length;
    return Math.round((complete / unitPages.length) * 100);
  }

  const SUBJECT_MAP: [string[], string, string][] = [
    [["product design", "design tech", "design & tech"], "from-teal-500 to-emerald-400", "DESIGN"],
    [["digital design", "digital"], "from-cyan-500 to-blue-400", "DIGITAL DESIGN"],
    [["service as action", "service", "community"], "from-pink-400 to-rose-300", "SERVICE"],
    [["personal project", " pp ", "pp"], "from-violet-500 to-purple-400", "PP"],
    [["pypx", "exhibition"], "from-amber-400 to-yellow-300", "PYPX"],
    [["inquiry", "interdisciplinary", "transdisciplinary"], "from-blue-500 to-indigo-400", "INQUIRY"],
    [["design"], "from-teal-500 to-emerald-400", "DESIGN"],
    [["technology", "tech"], "from-sky-500 to-blue-400", "TECHNOLOGY"],
    [["art", "visual"], "from-fuchsia-500 to-pink-400", "ART"],
    [["science", "biology", "chemistry", "physics"], "from-green-500 to-emerald-400", "SCIENCE"],
    [["math", "maths"], "from-orange-500 to-amber-400", "MATHS"],
    [["english", "language", "literature"], "from-red-400 to-rose-300", "ENGLISH"],
  ];

  function detectSubject(unit: UnitWithProgress): { gradient: string; label: string } {
    const candidates = [unit.class_subject, unit.class_name, unit.title]
      .filter(Boolean)
      .map(s => ` ${s!.toLowerCase()} `);

    for (const candidate of candidates) {
      for (const [keywords, gradient, label] of SUBJECT_MAP) {
        if (keywords.some(kw => candidate.includes(kw))) {
          return { gradient, label };
        }
      }
    }

    const fallbacks: [string, string][] = [
      ["from-teal-500 to-emerald-400", "DESIGN"],
      ["from-violet-500 to-purple-400", "PROJECT"],
      ["from-pink-400 to-rose-300", "CREATIVE"],
      ["from-sky-500 to-blue-400", "LEARNING"],
      ["from-amber-400 to-yellow-300", "WORKSHOP"],
    ];
    let hash = 0;
    for (let i = 0; i < unit.id.length; i++) hash = ((hash << 5) - hash + unit.id.charCodeAt(i)) | 0;
    const [gradient, label] = fallbacks[Math.abs(hash) % fallbacks.length];
    return { gradient, label };
  }

  return (
    <main style={{ background: themeStyles["--st-bg"], minHeight: "100vh" }}>
      {selectedToolId && <ToolModal toolId={selectedToolId} onClose={() => setSelectedToolId(null)} />}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header — just next class info (name already in nav bar) */}
        {nextClass && (
          <div className="mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: `var(--st-accent)20`, color: "var(--st-accent)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="text-sm font-medium">Next: {nextClass.short}</span>
              {nextClass.room && <span style={{ color: themeStyles["--st-text-secondary"], fontSize: "12px" }}>{nextClass.room}</span>}
            </div>
          </div>
        )}

        {/* Trophy Shelf — badges above everything */}
        {!loading && earnedBadges.length > 0 && (
          <div className="mb-5">
            <TrophyShelf badges={earnedBadges} themeStyles={themeStyles} />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 rounded-2xl animate-pulse h-80" style={{ background: themeStyles["--st-surface"] }} />
            <div className="rounded-2xl animate-pulse h-80" style={{ background: themeStyles["--st-surface"] }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left column: Units */}
            <div className="lg:col-span-2">
              {units.length === 0 ? (
                <div className="rounded-2xl p-16 text-center" style={{ background: themeStyles["--st-surface"], borderColor: themeStyles["--st-border"], border: `1px solid ${themeStyles["--st-border"]}` }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `var(--st-accent)15` }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--st-accent)" strokeWidth="1.5">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold mb-1" style={{ color: themeStyles["--st-text"] }}>No units assigned yet</p>
                  <p className="text-sm" style={{ color: themeStyles["--st-text-secondary"] }}>Your teacher will assign units for you to work on.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {units.map((unit) => {
                    const unitPages = getPageList(unit.content_data);
                    const firstPageId = unitPages.length > 0 ? unitPages[0].id : null;
                    const unitLink = firstPageId ? `/unit/${unit.id}/${firstPageId}` : `/unit/${unit.id}/narrative`;
                    const percent = getCompletionPercent(unit, unit.progress);
                    const hasStudio = openStudioUnits.has(unit.id);
                    const isComplete = percent === 100;
                    const { gradient, label: subjectLabel } = detectSubject(unit);

                    const isDiscovery = ["SERVICE", "PP", "PYPX"].includes(subjectLabel);
                    const hasBottomStrip = (hasStudio && !isDiscovery) || isDiscovery;

                    return (
                      <div key={unit.id} className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col" style={{ background: themeStyles["--st-surface"], border: `1px solid ${themeStyles["--st-border"]}` }}>
                        <Link href={unitLink} className="flex flex-col flex-1">
                          {/* Gradient header */}
                          <div className={`relative bg-gradient-to-r ${gradient} px-4 py-5`}>
                            <span className="text-white font-extrabold text-sm tracking-widest uppercase drop-shadow-sm">{subjectLabel}</span>
                            {unit.thumbnail_url && (
                              <div className="absolute inset-0 opacity-20">
                                <UnitThumbnail thumbnailUrl={unit.thumbnail_url} title={unit.title} className="w-full h-full object-cover" />
                              </div>
                            )}
                            {/* Progress ring */}
                            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full p-0.5 shadow-md">
                              <div className="relative" style={{ width: 36, height: 36 }}>
                                <svg width="36" height="36" className="transform -rotate-90">
                                  <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" />
                                  <circle cx="18" cy="18" r="14" fill="none" stroke={isComplete ? "#10b981" : "#fff"} strokeWidth="2.5" strokeDasharray={2 * Math.PI * 14} strokeDashoffset={2 * Math.PI * 14 * (1 - percent / 100)} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  {isComplete ? <svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg> : <span className="text-[10px] font-bold text-gray-700">{percent}%</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Content */}
                          <div className="p-4 flex-1 flex flex-col">
                            <h2 className="font-bold text-base mb-1 line-clamp-2" style={{ color: themeStyles["--st-text"] }}>{unit.title}</h2>
                            <p className="text-sm" style={{ color: themeStyles["--st-text-secondary"] }}>
                              {percent === 0 ? "Start this unit" : isComplete ? "Complete" : "Continue where you left off"} &rarr;
                            </p>
                          </div>

                          {/* Open Studio strip (inside unit link) */}
                          {hasStudio && !isDiscovery && (
                            <div className="bg-violet-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 py-1.5">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0" /></svg>
                              Open Studio
                            </div>
                          )}
                        </Link>

                        {/* Discovery strip (separate link, visually flush) */}
                        {isDiscovery && (
                          <Link href={`/discovery/${unit.id}?mode=mode_2${unit.class_id ? `&classId=${unit.class_id}` : ''}`} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 py-1.5 hover:from-indigo-500 hover:to-purple-500 transition-all">
                            🧭 Start Discovery Journey
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right column: Insights + Badges */}
            <div className="space-y-5">
              {/* What's Next */}
              <div className="rounded-2xl" style={{ background: themeStyles["--st-surface"], borderColor: themeStyles["--st-border"], border: `1px solid ${themeStyles["--st-border"]}` }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeStyles["--st-border"]}`, background: `var(--st-accent)08` }}>
                  <h2 className="text-sm font-bold" style={{ color: themeStyles["--st-text"] }}>What's Next</h2>
                </div>
                <div className="divide-y" style={{ "--tw-divide-color": themeStyles["--st-border"] } as React.CSSProperties}>
                  {insights.length === 0 ? (
                    <div className="p-4 text-center" style={{ color: themeStyles["--st-text-secondary"] }}>
                      <p className="text-xs">All caught up!</p>
                    </div>
                  ) : (
                    insights.slice(0, 6).map((insight, idx) => (
                      <Link key={idx} href={insight.actionUrl || "/dashboard"} className="p-3 flex items-start gap-3 hover:opacity-75 transition">
                        <div style={{ color: "var(--st-accent)" }} className="flex-shrink-0 mt-0.5">{insightIcon(insight.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold" style={{ color: themeStyles["--st-text"] }}>{insight.title}</p>
                          {insight.subtitle && <p className="text-[11px] mt-0.5" style={{ color: themeStyles["--st-text-secondary"] }}>{insight.subtitle}</p>}
                        </div>
                        {insight.time && <span className="text-[10px] flex-shrink-0" style={{ color: themeStyles["--st-text-secondary"] }}>{insight.time}</span>}
                      </Link>
                    ))
                  )}
                </div>
                {insights.length > 6 && (
                  <div className="px-4 py-2 text-center border-t" style={{ borderColor: themeStyles["--st-border"] }}>
                    <span className="text-[10px] font-semibold" style={{ color: "var(--st-accent)" }}>+{insights.length - 6} more</span>
                  </div>
                )}
              </div>

              {/* My Tools */}
              {recentToolSessions.length > 0 && (
                <div className="rounded-2xl" style={{ background: themeStyles["--st-surface"], borderColor: themeStyles["--st-border"], border: `1px solid ${themeStyles["--st-border"]}` }}>
                  <div className="px-4 py-3" style={{ borderBottom: `1px solid ${themeStyles["--st-border"]}`, background: `var(--st-accent)08` }}>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-bold" style={{ color: themeStyles["--st-text"] }}>My Tools</h2>
                      <Link href="/my-tools" className="text-xs font-semibold" style={{ color: "var(--st-accent)" }}>View all →</Link>
                    </div>
                  </div>
                  <div className="p-3 flex flex-col gap-2">
                    {recentToolSessions.slice(0, 5).map((session) => (
                      <button key={session.id} onClick={() => setSelectedToolId(session.tool_id)} className="text-left px-2 py-1.5 rounded-lg text-xs font-medium transition" style={{ background: themeStyles["--st-accent-subtle"], color: themeStyles["--st-text"] }}>
                        {session.tool_id.replace(/-/g, " ")}{session.version > 1 && ` v${session.version}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
