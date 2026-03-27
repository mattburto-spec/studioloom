"use client";

import { useState, useEffect, useMemo } from "react";
import { AGENCY_ELEMENT_MAP } from "@/lib/nm/constants";
import type { NMUnitConfig } from "@/lib/nm/constants";

interface Assessment {
  id: string;
  student_id: string;
  unit_id: string;
  page_id: string | null;
  competency: string;
  element: string;
  source: "student_self" | "teacher_observation";
  rating: number;
  comment: string | null;
  created_at: string;
}

interface NMResultsPanelProps {
  unitId: string;
  classId?: string;
}

const POP = {
  hotPink: "#FF2D78",
  electricYellow: "#FFE135",
  cyan: "#00D4FF",
  black: "#1a1a1a",
  white: "#ffffff",
  cream: "#FFF8E7",
  purple: "#9B59B6",
};

const RATING_COLORS: Record<number, string> = {
  1: POP.electricYellow,
  2: POP.cyan,
  3: POP.hotPink,
  4: POP.purple,
};

const RATING_LABELS_STUDENT: Record<number, string> = {
  1: "Hard",
  2: "Getting there",
  3: "Did well",
};

const RATING_LABELS_TEACHER: Record<number, string> = {
  1: "Emerging",
  2: "Developing",
  3: "Applying",
  4: "Extending",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function RatingPill({ rating, source }: { rating: number; source: "student_self" | "teacher_observation" }) {
  const isTeacher = source === "teacher_observation";
  const labels = isTeacher ? RATING_LABELS_TEACHER : RATING_LABELS_STUDENT;
  const color = RATING_COLORS[rating] || "#e5e7eb";
  const isLight = rating <= 2 && !isTeacher;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: "6px",
      border: `1.5px solid ${POP.black}`,
      background: color,
      color: isLight ? POP.black : POP.white,
      fontSize: "11px", fontWeight: 800,
      fontFamily: "'Arial Black', sans-serif",
      boxShadow: `1px 1px 0 ${POP.black}`,
      whiteSpace: "nowrap",
    }}>
      {isTeacher && <span style={{ fontSize: "9px", opacity: 0.8 }}>T</span>}
      {labels[rating] || rating}
    </span>
  );
}

export function NMResultsPanel({ unitId, classId }: NMResultsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Record<string, { display_name: string; username: string }>>({});
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
  const [pageNames, setPageNames] = useState<Record<string, string>>({});
  const [view, setView] = useState<"students" | "elements">("students");
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  // Fetch on mount (not just on expand) so header summary is accurate
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ unitId });
    if (classId) params.set("classId", classId);
    fetch(`/api/teacher/nm-results?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setAssessments(d.assessments || []);
          setStudents(d.students || {});
          setNmConfig(d.nmConfig || null);
          setPageNames(d.pageNames || {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [unitId, classId]);

  const selfAssessments = assessments.filter(a => a.source === "student_self");
  const teacherObs = assessments.filter(a => a.source === "teacher_observation");
  const studentIds = [...new Set(assessments.map(a => a.student_id))];
  const elements = nmConfig?.elements || [];

  // Get checkpoint page IDs in order from NM config
  const checkpointPageIds = useMemo(() => {
    if (!nmConfig?.checkpoints) return [];
    return Object.keys(nmConfig.checkpoints);
  }, [nmConfig]);

  // Per-student data grouped by checkpoint
  const studentData = useMemo(() => {
    return studentIds.map(sid => {
      const studentSelf = selfAssessments.filter(a => a.student_id === sid);
      const studentTeacher = teacherObs.filter(a => a.student_id === sid);
      const name = students[sid]?.display_name || students[sid]?.username || "Unknown";

      // Group assessments by checkpoint (page_id)
      const checkpoints: Record<string, {
        selfRatings: Record<string, number>;
        teacherRatings: Record<string, number>;
        selfComment: string | null;
        teacherComment: string | null;
        selfDate: string;
        teacherDate: string | null;
      }> = {};

      for (const a of studentSelf) {
        const pid = a.page_id || "unknown";
        if (!checkpoints[pid]) {
          checkpoints[pid] = { selfRatings: {}, teacherRatings: {}, selfComment: null, teacherComment: null, selfDate: a.created_at, teacherDate: null };
        }
        checkpoints[pid].selfRatings[a.element] = a.rating;
        if (a.comment && a.comment.trim()) {
          checkpoints[pid].selfComment = a.comment;
        }
        if (a.created_at > checkpoints[pid].selfDate) {
          checkpoints[pid].selfDate = a.created_at;
        }
      }

      for (const a of studentTeacher) {
        const pid = a.page_id || "unknown";
        if (!checkpoints[pid]) {
          checkpoints[pid] = { selfRatings: {}, teacherRatings: {}, selfComment: null, teacherComment: null, selfDate: a.created_at, teacherDate: a.created_at };
        }
        checkpoints[pid].teacherRatings[a.element] = a.rating;
        if (a.comment && a.comment.trim()) {
          checkpoints[pid].teacherComment = a.comment;
        }
        checkpoints[pid].teacherDate = a.created_at;
      }

      // Latest ratings across all checkpoints (for summary row)
      const latestSelf: Record<string, number> = {};
      const latestTeacher: Record<string, number> = {};
      for (const a of studentSelf.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        latestSelf[a.element] = a.rating;
      }
      for (const a of studentTeacher.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        latestTeacher[a.element] = a.rating;
      }

      const selfAvg = Object.values(latestSelf).length > 0
        ? Object.values(latestSelf).reduce((s, v) => s + v, 0) / Object.values(latestSelf).length
        : null;
      const teacherAvg = Object.values(latestTeacher).length > 0
        ? Object.values(latestTeacher).reduce((s, v) => s + v, 0) / Object.values(latestTeacher).length
        : null;

      return {
        sid, name, checkpoints, latestSelf, latestTeacher, selfAvg, teacherAvg,
        totalCheckpoints: Object.keys(checkpoints).length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentIds, selfAssessments, teacherObs, students]);

  // Per-element aggregated data
  const elementData = useMemo(() => {
    return elements.map(elemId => {
      const elem = AGENCY_ELEMENT_MAP[elemId];
      const selfRatings = selfAssessments.filter(a => a.element === elemId);
      const teacherRatings = teacherObs.filter(a => a.element === elemId);

      const selfAvg = selfRatings.length > 0
        ? selfRatings.reduce((s, a) => s + a.rating, 0) / selfRatings.length
        : null;
      const teacherAvg = teacherRatings.length > 0
        ? teacherRatings.reduce((s, a) => s + a.rating, 0) / teacherRatings.length
        : null;

      const dist = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
      selfRatings.forEach(a => { dist[a.rating] = (dist[a.rating] || 0) + 1; });

      // Per-checkpoint averages for trend
      const checkpointAvgs: { pageId: string; avg: number; count: number }[] = [];
      for (const pid of checkpointPageIds) {
        const cpRatings = selfRatings.filter(a => a.page_id === pid);
        if (cpRatings.length > 0) {
          const avg = cpRatings.reduce((s, a) => s + a.rating, 0) / cpRatings.length;
          checkpointAvgs.push({ pageId: pid, avg, count: cpRatings.length });
        }
      }

      return { elemId, elem, selfAvg, teacherAvg, selfCount: selfRatings.length, teacherCount: teacherRatings.length, dist, checkpointAvgs };
    });
  }, [elements, selfAssessments, teacherObs, checkpointPageIds]);

  // Summary text for header — works even when collapsed because we fetch on mount
  const summaryText = loading
    ? "Loading..."
    : studentIds.length > 0
      ? `${studentIds.length} student${studentIds.length !== 1 ? "s" : ""} · ${selfAssessments.length} self · ${teacherObs.length} obs`
      : "No responses yet";

  // Header button
  const headerButton = (
    <button
      onClick={() => setOpen(!open)}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 16px", borderRadius: open ? "16px 16px 0 0" : "16px",
        border: `3px solid ${POP.black}`, background: POP.hotPink,
        cursor: "pointer", position: "relative", overflow: "hidden",
        boxShadow: `4px 4px 0 ${POP.black}`, transition: "all 0.2s",
      }}
    >
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px)",
        backgroundSize: "8px 8px", pointerEvents: "none",
      }} />
      <div style={{
        width: "36px", height: "36px", borderRadius: "10px", border: `2px solid ${POP.black}`,
        background: POP.electricYellow, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "16px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
        boxShadow: `2px 2px 0 ${POP.black}`, flexShrink: 0, position: "relative",
      }}>
        NM
      </div>
      <div style={{ position: "relative", flex: 1, textAlign: "left" }}>
        <div style={{
          fontSize: "16px", fontWeight: 900, color: POP.white,
          fontFamily: "'Arial Black', 'Impact', sans-serif",
          textShadow: `1px 1px 0 ${POP.black}`,
        }}>
          NM Results
        </div>
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>
          {summaryText}
        </div>
      </div>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
        style={{ position: "relative", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
        <path d="M5 7.5L10 12.5L15 7.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (!open) {
    return <div style={{ marginBottom: "16px" }}>{headerButton}</div>;
  }

  return (
    <div style={{ marginBottom: "16px" }}>
      {headerButton}
      <div style={{
        border: `3px solid ${POP.black}`, borderTop: "none",
        borderRadius: "0 0 16px 16px", background: POP.white,
        boxShadow: `4px 4px 0 ${POP.black}`,
      }}>
        {loading ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#888", fontSize: "14px" }}>
            Loading results...
          </div>
        ) : assessments.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: POP.black, fontFamily: "'Arial Black', sans-serif" }}>
              No NM data yet
            </div>
            <div style={{ fontSize: "13px", color: "#666", marginTop: "4px" }}>
              Results will appear here as students complete their reflections.
            </div>
          </div>
        ) : (
          <div>
            {/* View toggle */}
            <div style={{ display: "flex", gap: "0", borderBottom: `2px solid ${POP.black}` }}>
              {(["students", "elements"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    flex: 1, padding: "10px", border: "none",
                    background: view === v ? POP.electricYellow : POP.cream,
                    fontSize: "13px", fontWeight: 800, cursor: "pointer",
                    fontFamily: "'Arial Black', sans-serif",
                    color: POP.black, transition: "background 0.15s",
                    borderRight: v === "students" ? `2px solid ${POP.black}` : "none",
                  }}
                >
                  {v === "students" ? "📋 Checkpoints" : "📊 By Element"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ maxHeight: "700px", overflowY: "auto" }}>
              {view === "students" ? (
                <div>
                  {studentData.map(s => {
                    const isExpanded = expandedStudent === s.sid;
                    return (
                      <div key={s.sid} style={{ borderBottom: `1px solid #e5e7eb` }}>
                        {/* Summary row — clickable */}
                        <button
                          onClick={() => setExpandedStudent(isExpanded ? null : s.sid)}
                          style={{
                            display: "flex", alignItems: "center", gap: "12px",
                            width: "100%",
                            padding: "12px 16px",
                            border: "none", background: isExpanded ? "#f8f4ff" : "transparent",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s", flexShrink: 0 }}>
                            <path d="M4 2L8 6L4 10" stroke="#888" strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: POP.black, flex: 1, textAlign: "left" }}>
                            {s.name}
                          </span>
                          <span style={{ fontSize: "11px", color: "#888", flexShrink: 0 }}>
                            {s.totalCheckpoints} cp{s.totalCheckpoints !== 1 ? "s" : ""}
                          </span>
                          {s.selfAvg !== null && (
                            <span style={{
                              padding: "2px 8px", borderRadius: "6px",
                              border: `1.5px solid ${POP.black}`,
                              background: s.selfAvg >= 2.5 ? POP.hotPink : s.selfAvg >= 1.5 ? POP.cyan : POP.electricYellow,
                              color: s.selfAvg >= 2.5 ? POP.white : POP.black,
                              fontSize: "11px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
                              whiteSpace: "nowrap",
                            }}>
                              Self {s.selfAvg.toFixed(1)}
                            </span>
                          )}
                          {s.teacherAvg !== null && (
                            <span style={{
                              padding: "2px 8px", borderRadius: "6px",
                              border: `1.5px solid ${POP.black}`,
                              background: POP.purple, color: POP.white,
                              fontSize: "11px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
                              whiteSpace: "nowrap",
                            }}>
                              Teacher {s.teacherAvg.toFixed(1)}
                            </span>
                          )}
                        </button>

                        {/* Expanded detail — checkpoint timeline */}
                        {isExpanded && (
                          <div style={{ padding: "0 16px 16px 16px" }}>
                            {/* Checkpoint table */}
                            <div style={{ overflowX: "auto" }}>
                              <table style={{
                                width: "100%", borderCollapse: "collapse",
                                fontSize: "12px",
                              }}>
                                <thead>
                                  <tr style={{ borderBottom: `2px solid ${POP.black}`, background: POP.cream }}>
                                    <th style={{ padding: "8px 10px", textAlign: "left", fontWeight: 800, fontFamily: "'Arial Black', sans-serif", fontSize: "11px", color: POP.black }}>
                                      Lesson
                                    </th>
                                    <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 800, fontFamily: "'Arial Black', sans-serif", fontSize: "14px", color: POP.black, background: "#e0f7fa" }}>
                                      Student Self
                                    </th>
                                    <th style={{ padding: "10px 10px", textAlign: "center", fontWeight: 800, fontFamily: "'Arial Black', sans-serif", fontSize: "14px", color: POP.purple, background: "#f3e5f5" }}>
                                      Teacher Obs
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(s.checkpoints)
                                    .sort(([, a], [, b]) => a.selfDate.localeCompare(b.selfDate))
                                    .map(([pid, cp]) => (
                                      <tr key={pid} style={{ borderBottom: `1px solid #e5e7eb` }}>
                                        {/* Lesson column */}
                                        <td style={{ padding: "10px", verticalAlign: "top", minWidth: "140px" }}>
                                          <div style={{ fontWeight: 700, color: POP.black, marginBottom: "2px" }}>
                                            📍 {pageNames[pid] || "Checkpoint"}
                                          </div>
                                          <div style={{ fontSize: "11px", color: "#888" }}>
                                            {formatDate(cp.selfDate)}
                                          </div>
                                        </td>

                                        {/* Student self column */}
                                        <td style={{ padding: "10px", verticalAlign: "top", background: "#f0fafb" }}>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center", marginBottom: cp.selfComment ? "6px" : "0" }}>
                                            {elements.map(elemId => {
                                              const selfRating = cp.selfRatings[elemId];
                                              if (!selfRating) return null;
                                              return <RatingPill key={elemId} rating={selfRating} source="student_self" />;
                                            })}
                                            {Object.keys(cp.selfRatings).length === 0 && (
                                              <span style={{ color: "#bbb", fontSize: "11px" }}>—</span>
                                            )}
                                          </div>
                                          {cp.selfComment && (
                                            <div style={{
                                              padding: "5px 8px", borderRadius: "6px",
                                              background: "#f0ecf9", border: `1px solid #e0d4f5`,
                                              fontSize: "11px", color: "#444", fontStyle: "italic", lineHeight: 1.4,
                                              marginTop: "4px",
                                            }}>
                                              💬 {cp.selfComment}
                                            </div>
                                          )}
                                        </td>

                                        {/* Teacher observation column */}
                                        <td style={{ padding: "10px", verticalAlign: "top", background: "#faf0fc" }}>
                                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", justifyContent: "center", marginBottom: cp.teacherComment ? "6px" : "0" }}>
                                            {elements.map(elemId => {
                                              const teacherRating = cp.teacherRatings[elemId];
                                              if (!teacherRating) return null;
                                              return <RatingPill key={elemId} rating={teacherRating} source="teacher_observation" />;
                                            })}
                                            {Object.keys(cp.teacherRatings).length === 0 && (
                                              <span style={{ color: "#bbb", fontSize: "11px" }}>—</span>
                                            )}
                                          </div>
                                          {cp.teacherComment && (
                                            <div style={{
                                              padding: "5px 8px", borderRadius: "6px",
                                              background: "#f3e8ff", border: `1px solid #d4b5f5`,
                                              fontSize: "11px", color: "#444", fontStyle: "italic", lineHeight: 1.4,
                                              marginTop: "4px",
                                            }}>
                                              🔍 {cp.teacherComment}
                                            </div>
                                          )}
                                          {cp.teacherDate && Object.keys(cp.teacherRatings).length > 0 && (
                                            <div style={{ fontSize: "10px", color: "#aaa", marginTop: "3px", textAlign: "center" }}>
                                              {formatDate(cp.teacherDate)}
                                            </div>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>

                            {Object.keys(s.checkpoints).length === 0 && (
                              <div style={{ fontSize: "12px", color: "#999", padding: "8px 0" }}>
                                No checkpoint data yet
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* By Element view */
                <div style={{ padding: "16px", display: "grid", gap: "12px" }}>
                  {elementData.map(ed => {
                    if (!ed.elem) return null;
                    return (
                      <div key={ed.elemId} style={{
                        padding: "12px", borderRadius: "10px",
                        border: `2px solid ${POP.black}`, background: POP.cream,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                          <div style={{
                            fontSize: "13px", fontWeight: 800, color: POP.black,
                            fontFamily: "'Arial Black', sans-serif",
                          }}>
                            {ed.elem.name}
                          </div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {ed.selfAvg !== null && (
                              <div style={{
                                padding: "2px 8px", borderRadius: "6px",
                                border: `2px solid ${POP.black}`,
                                background: ed.selfAvg >= 2.5 ? POP.hotPink : ed.selfAvg >= 1.5 ? POP.cyan : POP.electricYellow,
                                color: ed.selfAvg >= 2.5 ? POP.white : POP.black,
                                fontSize: "10px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
                              }}>
                                Self: {ed.selfAvg.toFixed(1)}
                              </div>
                            )}
                            {ed.teacherAvg !== null && (
                              <div style={{
                                padding: "2px 8px", borderRadius: "6px",
                                border: `2px solid ${POP.black}`,
                                background: POP.purple, color: POP.white,
                                fontSize: "10px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
                              }}>
                                Teacher: {ed.teacherAvg.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Distribution bar */}
                        {ed.selfCount > 0 && (
                          <div style={{ display: "flex", height: "24px", borderRadius: "6px", overflow: "hidden", border: `2px solid ${POP.black}` }}>
                            {[1, 2, 3].map(r => {
                              const pct = (ed.dist[r] / ed.selfCount) * 100;
                              if (pct === 0) return null;
                              return (
                                <div key={r} style={{
                                  width: `${pct}%`, background: RATING_COLORS[r],
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "10px", fontWeight: 900, color: r === 3 ? POP.white : POP.black,
                                  fontFamily: "'Arial Black', sans-serif",
                                  minWidth: pct > 10 ? "auto" : "0",
                                }}>
                                  {pct >= 15 ? `${Math.round(pct)}%` : ""}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Per-checkpoint trend */}
                        {ed.checkpointAvgs.length > 1 && (
                          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ fontSize: "10px", color: "#888", fontWeight: 600 }}>Trend:</span>
                            {ed.checkpointAvgs.map((cp, i) => (
                              <div key={cp.pageId} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                                {i > 0 && <span style={{ fontSize: "10px", color: "#ccc" }}>→</span>}
                                <span style={{
                                  padding: "1px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 800,
                                  background: cp.avg >= 2.5 ? POP.hotPink : cp.avg >= 1.5 ? POP.cyan : POP.electricYellow,
                                  color: cp.avg >= 2.5 ? POP.white : POP.black,
                                  fontFamily: "'Arial Black', sans-serif",
                                }}
                                  title={pageNames[cp.pageId] || `Checkpoint ${i + 1}`}
                                >
                                  {cp.avg.toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={{ fontSize: "11px", color: "#777", marginTop: "4px" }}>
                          {ed.selfCount} student response{ed.selfCount !== 1 ? "s" : ""}
                          {ed.teacherCount > 0 && ` · ${ed.teacherCount} teacher obs.`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
