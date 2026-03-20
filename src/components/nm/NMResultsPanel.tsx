"use client";

import { useState, useEffect } from "react";
import { AGENCY_ELEMENT_MAP, STUDENT_RATING_SCALE, TEACHER_RATING_SCALE } from "@/lib/nm/constants";
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

// Rating value → pop art color
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

export function NMResultsPanel({ unitId }: NMResultsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Record<string, { display_name: string; username: string }>>({});
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
  const [view, setView] = useState<"students" | "elements">("students");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/teacher/nm-results?unitId=${unitId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setAssessments(d.assessments || []);
          setStudents(d.students || {});
          setNmConfig(d.nmConfig || null);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, unitId]);

  const selfAssessments = assessments.filter(a => a.source === "student_self");
  const teacherObs = assessments.filter(a => a.source === "teacher_observation");
  const studentIds = [...new Set(selfAssessments.map(a => a.student_id))];
  const elements = nmConfig?.elements || [];

  // Per-student grouped data
  const studentData = studentIds.map(sid => {
    const studentSelf = selfAssessments.filter(a => a.student_id === sid);
    const studentTeacher = teacherObs.filter(a => a.student_id === sid);
    const name = students[sid]?.display_name || students[sid]?.username || "Unknown";

    // Latest rating per element (student self)
    const latestSelf: Record<string, number> = {};
    for (const a of studentSelf) {
      if (!latestSelf[a.element] || new Date(a.created_at) > new Date(latestSelf[a.element] as unknown as string)) {
        latestSelf[a.element] = a.rating;
      }
    }

    // Latest teacher observation per element
    const latestTeacher: Record<string, number> = {};
    for (const a of studentTeacher) {
      if (!latestTeacher[a.element]) {
        latestTeacher[a.element] = a.rating;
      }
    }

    const selfAvg = Object.values(latestSelf).length > 0
      ? Object.values(latestSelf).reduce((s, v) => s + v, 0) / Object.values(latestSelf).length
      : null;

    return { sid, name, latestSelf, latestTeacher, selfAvg, totalResponses: studentSelf.length };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Per-element aggregated data
  const elementData = elements.map(elemId => {
    const elem = AGENCY_ELEMENT_MAP[elemId];
    const selfRatings = selfAssessments.filter(a => a.element === elemId);
    const teacherRatings = teacherObs.filter(a => a.element === elemId);

    const selfAvg = selfRatings.length > 0
      ? selfRatings.reduce((s, a) => s + a.rating, 0) / selfRatings.length
      : null;
    const teacherAvg = teacherRatings.length > 0
      ? teacherRatings.reduce((s, a) => s + a.rating, 0) / teacherRatings.length
      : null;

    // Distribution counts for student self
    const dist = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    selfRatings.forEach(a => { dist[a.rating] = (dist[a.rating] || 0) + 1; });

    return { elemId, elem, selfAvg, teacherAvg, selfCount: selfRatings.length, teacherCount: teacherRatings.length, dist };
  });

  // Toggle header
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
      {/* Halftone dots */}
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
          {selfAssessments.length > 0
            ? `${studentIds.length} student${studentIds.length !== 1 ? "s" : ""} · ${selfAssessments.length} response${selfAssessments.length !== 1 ? "s" : ""}`
            : "No responses yet"}
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
                  {v === "students" ? "👤 By Student" : "📊 By Element"}
                </button>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding: "16px", maxHeight: "500px", overflowY: "auto" }}>
              {view === "students" ? (
                <div style={{ display: "grid", gap: "12px" }}>
                  {studentData.map(s => (
                    <div key={s.sid} style={{
                      padding: "12px", borderRadius: "10px",
                      border: `2px solid ${POP.black}`, background: POP.cream,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div style={{
                          fontSize: "14px", fontWeight: 800, color: POP.black,
                          fontFamily: "'Arial Black', sans-serif",
                        }}>
                          {s.name}
                        </div>
                        {s.selfAvg !== null && (
                          <div style={{
                            padding: "3px 10px", borderRadius: "8px",
                            border: `2px solid ${POP.black}`,
                            background: s.selfAvg >= 2.5 ? POP.hotPink : s.selfAvg >= 1.5 ? POP.cyan : POP.electricYellow,
                            color: s.selfAvg >= 2.5 ? POP.white : POP.black,
                            fontSize: "11px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
                            boxShadow: `2px 2px 0 ${POP.black}`,
                          }}>
                            avg {s.selfAvg.toFixed(1)}
                          </div>
                        )}
                      </div>
                      {/* Element ratings grid */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {elements.map(elemId => {
                          const elem = AGENCY_ELEMENT_MAP[elemId];
                          const rating = s.latestSelf[elemId];
                          const teacherRating = s.latestTeacher[elemId];
                          if (!elem) return null;
                          return (
                            <div key={elemId} style={{
                              padding: "5px 10px", borderRadius: "8px",
                              border: `2px solid ${POP.black}`,
                              background: rating ? RATING_COLORS[rating] : "#e5e7eb",
                              color: rating === 3 ? POP.white : POP.black,
                              fontSize: "11px", fontWeight: 700,
                              fontFamily: "'Arial Black', sans-serif",
                              boxShadow: `1px 1px 0 ${POP.black}`,
                              position: "relative",
                            }}
                              title={`${elem.name}: ${rating ? RATING_LABELS_STUDENT[rating] : "Not rated"}${teacherRating ? ` | Teacher: ${RATING_LABELS_TEACHER[teacherRating]}` : ""}`}
                            >
                              {elem.name.split(" ").map(w => w[0]).join("")}
                              {rating && <span style={{ marginLeft: "3px" }}>{rating === 1 ? "⚡" : rating === 2 ? "↗" : "✓"}</span>}
                              {teacherRating && (
                                <div style={{
                                  position: "absolute", top: "-4px", right: "-4px",
                                  width: "12px", height: "12px", borderRadius: "50%",
                                  background: RATING_COLORS[teacherRating] || "#888",
                                  border: `1.5px solid ${POP.black}`, fontSize: "7px",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontWeight: 900, color: teacherRating >= 3 ? POP.white : POP.black,
                                }}>
                                  T
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gap: "12px" }}>
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
