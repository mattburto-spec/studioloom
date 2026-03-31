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

// Timeline-friendly rating colors (softer, still readable)
const DOT_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "#fbbf24", text: "#92400e" },
  2: { bg: "#38bdf8", text: "#fff" },
  3: { bg: "#34d399", text: "#fff" },
  4: { bg: "#a78bfa", text: "#fff" },
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

export function NMResultsPanel({ unitId, classId }: NMResultsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Record<string, { display_name: string; username: string }>>({});
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
  const [pageNames, setPageNames] = useState<Record<string, string>>({});
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

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

  // Per-student timeline data
  const studentData = useMemo(() => {
    return studentIds.map(sid => {
      const studentSelf = selfAssessments.filter(a => a.student_id === sid);
      const studentTeacher = teacherObs.filter(a => a.student_id === sid);
      const name = students[sid]?.display_name || students[sid]?.username || "Unknown";

      // Per checkpoint, per element: { selfRating, teacherRating }
      const checkpointData: Record<string, {
        self: Record<string, number>;
        teacher: Record<string, number>;
        selfComment: string | null;
        teacherComment: string | null;
        latestDate: string;
      }> = {};

      for (const a of studentSelf) {
        const pid = a.page_id || "unknown";
        if (!checkpointData[pid]) {
          checkpointData[pid] = { self: {}, teacher: {}, selfComment: null, teacherComment: null, latestDate: a.created_at };
        }
        checkpointData[pid].self[a.element] = a.rating;
        if (a.comment && a.comment.trim()) checkpointData[pid].selfComment = a.comment;
        if (a.created_at > checkpointData[pid].latestDate) checkpointData[pid].latestDate = a.created_at;
      }

      for (const a of studentTeacher) {
        const pid = a.page_id || "unknown";
        if (!checkpointData[pid]) {
          checkpointData[pid] = { self: {}, teacher: {}, selfComment: null, teacherComment: null, latestDate: a.created_at };
        }
        checkpointData[pid].teacher[a.element] = a.rating;
        if (a.comment && a.comment.trim()) checkpointData[pid].teacherComment = a.comment;
        if (a.created_at > checkpointData[pid].latestDate) checkpointData[pid].latestDate = a.created_at;
      }

      // Compute overall averages
      const allSelfRatings = studentSelf.map(a => a.rating);
      const allTeacherRatings = studentTeacher.map(a => a.rating);
      const selfAvg = allSelfRatings.length > 0 ? allSelfRatings.reduce((s, v) => s + v, 0) / allSelfRatings.length : null;
      const teacherAvg = allTeacherRatings.length > 0 ? allTeacherRatings.reduce((s, v) => s + v, 0) / allTeacherRatings.length : null;

      return { sid, name, checkpointData, selfAvg, teacherAvg, totalCheckpoints: Object.keys(checkpointData).length };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [studentIds, selfAssessments, teacherObs, students]);

  // Summary text
  const summaryText = loading
    ? "Loading..."
    : studentIds.length > 0
      ? `${studentIds.length} student${studentIds.length !== 1 ? "s" : ""} · ${selfAssessments.length} self · ${teacherObs.length} obs`
      : "No responses yet";

  // Header
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
      {/* Arrow: points right when collapsed (click to open), points down when open (click to close) */}
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none"
        style={{ position: "relative", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
        <path d="M7.5 5L12.5 10L7.5 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
            {/* Checkpoint labels header row */}
            {checkpointPageIds.length > 0 && (
              <div style={{
                display: "flex", alignItems: "center",
                padding: "10px 16px 6px 130px",
                borderBottom: `1px solid #e5e7eb`,
                background: POP.cream,
              }}>
                {checkpointPageIds.map((pid, i) => (
                  <div key={pid} style={{ display: "contents" }}>
                    {i > 0 && <div style={{ flex: 1 }} />}
                    <div style={{
                      fontSize: "10px", color: "#888", fontWeight: 700,
                      textAlign: "center", whiteSpace: "nowrap",
                      fontFamily: "'Arial Black', sans-serif",
                    }}>
                      {pageNames[pid] ? (pageNames[pid].length > 14 ? pageNames[pid].slice(0, 12) + "…" : pageNames[pid]) : `CP ${i + 1}`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Timeline per student */}
            <div style={{ maxHeight: "700px", overflowY: "auto" }}>
              {studentData.map(s => {
                const isExpanded = expandedStudent === s.sid;

                return (
                  <div key={s.sid} style={{ borderBottom: `1px solid #e5e7eb` }}>
                    {/* Student header row — clickable */}
                    <button
                      onClick={() => setExpandedStudent(isExpanded ? null : s.sid)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: "0",
                        width: "100%", padding: "14px 16px",
                        border: "none", background: isExpanded ? "#f8f4ff" : "transparent",
                        cursor: "pointer", transition: "background 0.15s",
                      }}
                    >
                      {/* Name column */}
                      <div style={{ width: "114px", flexShrink: 0, textAlign: "left", paddingTop: "2px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: POP.black }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>
                          {s.selfAvg !== null && s.teacherAvg !== null
                            ? `Self ${s.selfAvg.toFixed(1)} / T ${s.teacherAvg.toFixed(1)}`
                            : s.selfAvg !== null
                              ? `Self ${s.selfAvg.toFixed(1)}`
                              : s.teacherAvg !== null
                                ? `Teacher ${s.teacherAvg.toFixed(1)}`
                                : ""}
                        </div>
                      </div>

                      {/* Timeline tracks — one row per element */}
                      <div style={{ flex: 1 }}>
                        {elements.map(elemId => {
                          const elem = AGENCY_ELEMENT_MAP[elemId];
                          if (!elem) return null;
                          return (
                            <div key={elemId} style={{
                              display: "flex", alignItems: "center", gap: "0",
                              marginBottom: "4px", height: "26px",
                            }}>
                              {/* Element label */}
                              <div style={{
                                width: "70px", flexShrink: 0,
                                fontSize: "10px", color: "#888", fontWeight: 600,
                                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                              }}>
                                {elem.name.split(" ").slice(0, 2).join(" ")}
                              </div>

                              {/* Track line with dots */}
                              <div style={{
                                flex: 1, display: "flex", alignItems: "center",
                                position: "relative", height: "26px",
                              }}>
                                {/* Background track */}
                                <div style={{
                                  position: "absolute", top: "12px", left: 0, right: 0,
                                  height: "2px", background: "#e5e7eb", borderRadius: "1px",
                                }} />

                                {/* Dots for each checkpoint */}
                                {checkpointPageIds.map((pid, i) => {
                                  const cpData = s.checkpointData[pid];
                                  const selfRating = cpData?.self[elemId];
                                  const teacherRating = cpData?.teacher[elemId];
                                  const hasSelf = selfRating !== undefined;
                                  const hasTeacher = teacherRating !== undefined;

                                  return (
                                    <div key={pid} style={{ display: "contents" }}>
                                      {i > 0 && <div style={{ flex: 1 }} />}

                                      {/* Self dot */}
                                      {hasSelf ? (
                                        <div
                                          title={`${pageNames[pid] || `CP ${i + 1}`} — Self: ${RATING_LABELS_STUDENT[selfRating] || selfRating} (${selfRating})`}
                                          style={{
                                            position: "relative", zIndex: 1,
                                            width: "22px", height: "22px", borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "9px", fontWeight: 800,
                                            background: DOT_COLORS[selfRating]?.bg || "#e5e7eb",
                                            color: DOT_COLORS[selfRating]?.text || "#999",
                                            border: "2px solid #fff",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                          }}
                                        >
                                          {selfRating}
                                        </div>
                                      ) : !hasTeacher ? (
                                        <div style={{
                                          position: "relative", zIndex: 1,
                                          width: "22px", height: "22px", borderRadius: "50%",
                                          display: "flex", alignItems: "center", justifyContent: "center",
                                          fontSize: "9px", fontWeight: 800,
                                          background: "#f3f4f6", color: "#ccc",
                                          border: "2px solid #fff",
                                        }}>
                                          —
                                        </div>
                                      ) : null}

                                      {/* Teacher dot (smaller, pink border, overlaps slightly if self dot exists) */}
                                      {hasTeacher && (
                                        <div
                                          title={`${pageNames[pid] || `CP ${i + 1}`} — Teacher: ${RATING_LABELS_TEACHER[teacherRating] || teacherRating} (${teacherRating})`}
                                          style={{
                                            position: "relative", zIndex: 2,
                                            marginLeft: hasSelf ? "-6px" : "0",
                                            width: "16px", height: "16px", borderRadius: "50%",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: "8px", fontWeight: 800,
                                            background: DOT_COLORS[teacherRating]?.bg || "#e5e7eb",
                                            color: DOT_COLORS[teacherRating]?.text || "#999",
                                            border: `2px solid ${POP.hotPink}`,
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                          }}
                                        >
                                          {teacherRating}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </button>

                    {/* Expanded: comments per checkpoint */}
                    {isExpanded && (
                      <div style={{ padding: "0 16px 14px 130px" }}>
                        {checkpointPageIds.map((pid, i) => {
                          const cpData = s.checkpointData[pid];
                          if (!cpData) return null;
                          const hasContent = cpData.selfComment || cpData.teacherComment;
                          if (!hasContent) return null;

                          return (
                            <div key={pid} style={{
                              marginBottom: "8px", padding: "8px 12px",
                              borderRadius: "8px", background: "#f9f7ff",
                              border: "1px solid #e8e0f5",
                            }}>
                              <div style={{
                                fontSize: "11px", fontWeight: 700, color: "#7c3aed",
                                marginBottom: "4px",
                              }}>
                                {pageNames[pid] || `Checkpoint ${i + 1}`}
                                <span style={{ color: "#bbb", fontWeight: 400, marginLeft: "6px" }}>
                                  {formatDate(cpData.latestDate)}
                                </span>
                              </div>
                              {cpData.selfComment && (
                                <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.4, marginBottom: "3px" }}>
                                  <span style={{ color: "#38bdf8", fontWeight: 700 }}>Student:</span> {cpData.selfComment}
                                </div>
                              )}
                              {cpData.teacherComment && (
                                <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.4 }}>
                                  <span style={{ color: POP.hotPink, fontWeight: 700 }}>Teacher:</span> {cpData.teacherComment}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {/* If no comments exist at all */}
                        {!checkpointPageIds.some(pid => s.checkpointData[pid]?.selfComment || s.checkpointData[pid]?.teacherComment) && (
                          <div style={{ fontSize: "12px", color: "#bbb", fontStyle: "italic" }}>
                            No comments yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "12px",
              padding: "12px 16px", borderTop: `2px solid ${POP.black}`,
              background: POP.cream, borderRadius: "0 0 13px 13px",
              fontSize: "11px", color: "#666",
            }}>
              {[1, 2, 3].map(r => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: DOT_COLORS[r]?.bg, border: "1.5px solid #fff",
                    boxShadow: "0 0 0 1px #d1d5db",
                  }} />
                  <span>{r} — {RATING_LABELS_STUDENT[r]}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{
                  width: "14px", height: "14px", borderRadius: "50%",
                  background: DOT_COLORS[4]?.bg, border: `2px solid ${POP.hotPink}`,
                }} />
                <span>Teacher (pink border)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
