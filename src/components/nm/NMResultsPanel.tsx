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

// Rating dot colors — consistent everywhere
const DOT: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "#fbbf24", text: "#92400e", label: "Hard" },
  2: { bg: "#38bdf8", text: "#fff", label: "Getting there" },
  3: { bg: "#34d399", text: "#fff", label: "Did well" },
};

const TEACHER_DOT: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "#fbbf24", text: "#92400e", label: "Emerging" },
  2: { bg: "#38bdf8", text: "#fff", label: "Developing" },
  3: { bg: "#34d399", text: "#fff", label: "Applying" },
  4: { bg: "#a78bfa", text: "#fff", label: "Extending" },
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** Average rating → color */
function avgColor(avg: number): string {
  if (avg >= 2.5) return "#34d399";
  if (avg >= 1.5) return "#38bdf8";
  return "#fbbf24";
}

function avgTextColor(avg: number): string {
  if (avg >= 2.5) return "#fff";
  if (avg >= 1.5) return "#fff";
  return "#92400e";
}

export function NMResultsPanel({ unitId, classId }: NMResultsPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [students, setStudents] = useState<Record<string, { display_name: string; username: string }>>({});
  const [nmConfig, setNmConfig] = useState<NMUnitConfig | null>(null);
  const [pageNames, setPageNames] = useState<Record<string, string>>({});

  // Which cell is drilled into: { studentId, checkpointPageId }
  const [drillCell, setDrillCell] = useState<{ sid: string; pid: string } | null>(null);

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
  // Include ALL students from the API response (students map), not just those with assessments
  const studentIds = useMemo(() => {
    const fromAssessments = assessments.map(a => a.student_id);
    const fromStudentsMap = Object.keys(students);
    return [...new Set([...fromAssessments, ...fromStudentsMap])];
  }, [assessments, students]);
  const elements = nmConfig?.elements || [];

  // Pseudo page ID for teacher observations that have no checkpoint (e.g. from Teaching Mode)
  const GENERAL_OBS_ID = "__general_obs__";

  const checkpointPageIds = useMemo(() => {
    if (!nmConfig?.checkpoints) return [];
    return Object.keys(nmConfig.checkpoints);
  }, [nmConfig]);

  // Check if any teacher observations have null page_id (i.e. made from Teaching Mode without checkpoint)
  const hasGeneralObs = useMemo(() => {
    return teacherObs.some(a => !a.page_id || !checkpointPageIds.includes(a.page_id));
  }, [teacherObs, checkpointPageIds]);

  // All column IDs including the General column if needed
  const allColumnIds = useMemo(() => {
    return hasGeneralObs ? [...checkpointPageIds, GENERAL_OBS_ID] : checkpointPageIds;
  }, [checkpointPageIds, hasGeneralObs]);

  // Build grid data: per student, per checkpoint → avg rating + has teacher obs
  type CellData = {
    selfAvg: number | null;
    teacherAvg: number | null;
    selfRatings: Record<string, number>;
    teacherRatings: Record<string, number>;
    selfComment: string | null;
    teacherComment: string | null;
    latestDate: string;
  };
  const gridData = useMemo(() => {
    const data: Record<string, Record<string, CellData>> = {};

    for (const sid of studentIds) {
      data[sid] = {};

      // Regular checkpoint columns
      for (const pid of checkpointPageIds) {
        const selfHere = selfAssessments.filter(a => a.student_id === sid && a.page_id === pid);
        const teacherHere = teacherObs.filter(a => a.student_id === sid && a.page_id === pid);

        const selfRatings: Record<string, number> = {};
        let selfComment: string | null = null;
        let latestDate = "";
        for (const a of selfHere) {
          selfRatings[a.element] = a.rating;
          if (a.comment?.trim()) selfComment = a.comment;
          if (a.created_at > latestDate) latestDate = a.created_at;
        }

        const teacherRatings: Record<string, number> = {};
        let teacherComment: string | null = null;
        for (const a of teacherHere) {
          teacherRatings[a.element] = a.rating;
          if (a.comment?.trim()) teacherComment = a.comment;
          if (a.created_at > latestDate) latestDate = a.created_at;
        }

        const selfVals = Object.values(selfRatings);
        const teacherVals = Object.values(teacherRatings);
        const selfAvg = selfVals.length > 0 ? selfVals.reduce((s, v) => s + v, 0) / selfVals.length : null;
        const teacherAvg = teacherVals.length > 0 ? teacherVals.reduce((s, v) => s + v, 0) / teacherVals.length : null;

        if (selfVals.length > 0 || teacherVals.length > 0) {
          data[sid][pid] = { selfAvg, teacherAvg, selfRatings, teacherRatings, selfComment, teacherComment, latestDate };
        }
      }

      // General observations column — teacher obs with null page_id or page_id not in checkpoints
      if (hasGeneralObs) {
        const generalTeacher = teacherObs.filter(a =>
          a.student_id === sid && (!a.page_id || !checkpointPageIds.includes(a.page_id))
        );
        if (generalTeacher.length > 0) {
          const teacherRatings: Record<string, number> = {};
          let teacherComment: string | null = null;
          let latestDate = "";
          for (const a of generalTeacher) {
            teacherRatings[a.element] = a.rating;
            if (a.comment?.trim()) teacherComment = a.comment;
            if (a.created_at > latestDate) latestDate = a.created_at;
          }
          const teacherVals = Object.values(teacherRatings);
          const teacherAvg = teacherVals.length > 0 ? teacherVals.reduce((s, v) => s + v, 0) / teacherVals.length : null;
          if (teacherVals.length > 0) {
            data[sid][GENERAL_OBS_ID] = {
              selfAvg: null, teacherAvg, selfRatings: {}, teacherRatings,
              selfComment: null, teacherComment, latestDate,
            };
          }
        }
      }
    }
    return data;
  }, [studentIds, checkpointPageIds, selfAssessments, teacherObs, hasGeneralObs]);

  // Sort students alphabetically
  const sortedStudents = useMemo(() => {
    return studentIds
      .map(sid => ({ sid, name: students[sid]?.display_name || students[sid]?.username || "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [studentIds, students]);

  // Shorten lesson names for column headers — longer now that headers are rotated
  function shortName(pid: string, maxLen: number = 28): string {
    const name = pageNames[pid];
    if (!name) return `Checkpoint`;
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen - 1) + "…";
  }

  const summaryText = loading
    ? "Loading..."
    : studentIds.length > 0
      ? `${studentIds.length} student${studentIds.length !== 1 ? "s" : ""} · ${selfAssessments.length} self · ${teacherObs.length} obs`
      : "No responses yet";

  // Header button
  const headerButton = (
    <button
      onClick={() => { setOpen(!open); setDrillCell(null); }}
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
        style={{ position: "relative", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
        <path d="M7.5 5L12.5 10L7.5 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );

  if (!open) {
    return <div style={{ marginBottom: "16px" }}>{headerButton}</div>;
  }

  // Currently drilled cell data
  const drillData = drillCell ? gridData[drillCell.sid]?.[drillCell.pid] : null;
  const drillStudentName = drillCell ? (students[drillCell.sid]?.display_name || students[drillCell.sid]?.username || "Unknown") : "";

  return (
    <div style={{ marginBottom: "16px" }}>
      {headerButton}
      <div style={{
        border: `3px solid ${POP.black}`, borderTop: "none",
        borderRadius: "0 0 16px 16px", background: POP.white,
        boxShadow: `4px 4px 0 ${POP.black}`,
        overflow: "hidden",
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
            {/* ===== SUMMARY GRID ===== */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: POP.cream, borderBottom: `2px solid ${POP.black}` }}>
                    <th style={{
                      padding: "8px 12px", textAlign: "left", fontWeight: 800,
                      fontFamily: "'Arial Black', sans-serif", fontSize: "11px",
                      color: POP.black, position: "sticky", left: 0, background: POP.cream, zIndex: 2,
                      minWidth: "110px",
                    }}>
                      Student
                    </th>
                    {allColumnIds.map((pid, i) => (
                      <th key={pid} style={{
                        padding: "0 4px", textAlign: "left", fontWeight: 700,
                        fontFamily: "'Arial Black', sans-serif", fontSize: "10px",
                        color: pid === GENERAL_OBS_ID ? POP.hotPink : "#666",
                        minWidth: "48px", maxWidth: "56px",
                        height: "90px", verticalAlign: "bottom", position: "relative",
                      }}
                        title={pid === GENERAL_OBS_ID ? "Teacher observations (general)" : (pageNames[pid] || `Checkpoint ${i + 1}`)}
                      >
                        <div style={{
                          transform: "rotate(-45deg)",
                          transformOrigin: "bottom left",
                          whiteSpace: "nowrap",
                          position: "absolute",
                          bottom: "8px",
                          left: "50%",
                          fontSize: "10px",
                          lineHeight: 1.2,
                        }}>
                          {pid === GENERAL_OBS_ID ? "General" : shortName(pid)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map(({ sid, name }) => (
                    <tr key={sid} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{
                        padding: "10px 12px", fontWeight: 600, color: POP.black,
                        position: "sticky", left: 0, background: POP.white, zIndex: 1,
                        fontSize: "12px",
                      }}>
                        {name}
                      </td>
                      {allColumnIds.map(pid => {
                        const cell = gridData[sid]?.[pid];
                        const isActive = drillCell?.sid === sid && drillCell?.pid === pid;

                        if (!cell) {
                          return (
                            <td key={pid} style={{ padding: "6px", textAlign: "center" }}>
                              <div style={{
                                width: "32px", height: "32px", borderRadius: "50%",
                                background: "#f5f5f5", margin: "0 auto",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#ddd", fontSize: "11px",
                              }}>
                                —
                              </div>
                            </td>
                          );
                        }

                        // Show self avg as main dot, teacher as small indicator
                        const displayAvg = cell.selfAvg ?? cell.teacherAvg ?? 0;
                        const hasTeacher = cell.teacherAvg !== null;

                        return (
                          <td key={pid} style={{ padding: "6px", textAlign: "center" }}>
                            <button
                              onClick={() => setDrillCell(isActive ? null : { sid, pid })}
                              style={{
                                position: "relative", border: "none", background: "none",
                                cursor: "pointer", padding: "0", margin: "0 auto", display: "block",
                              }}
                              title={`${name} — ${pageNames[pid] || "Checkpoint"}`}
                            >
                              {/* Main dot */}
                              <div style={{
                                width: "32px", height: "32px", borderRadius: "50%",
                                background: avgColor(displayAvg),
                                color: avgTextColor(displayAvg),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "11px", fontWeight: 800,
                                fontFamily: "'Arial Black', sans-serif",
                                border: isActive ? `3px solid ${POP.hotPink}` : "2px solid rgba(255,255,255,0.8)",
                                boxShadow: isActive
                                  ? `0 0 0 2px ${POP.hotPink}, 0 2px 4px rgba(0,0,0,0.15)`
                                  : "0 1px 3px rgba(0,0,0,0.12)",
                                transition: "all 0.15s",
                                transform: isActive ? "scale(1.15)" : "scale(1)",
                              }}>
                                {displayAvg.toFixed(1)}
                              </div>
                              {/* Teacher indicator — small pink dot at bottom-right */}
                              {hasTeacher && (
                                <div style={{
                                  position: "absolute", bottom: "-2px", right: "-2px",
                                  width: "12px", height: "12px", borderRadius: "50%",
                                  background: POP.hotPink, border: "1.5px solid #fff",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontSize: "7px", fontWeight: 900, color: "#fff",
                                }}>
                                  T
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ===== DRILL-DOWN PANEL ===== */}
            {drillCell && drillData && (
              <div style={{
                borderTop: `2px solid ${POP.black}`,
                background: "#faf8ff",
                padding: "16px",
                animation: "nmSlideDown 0.2s ease-out",
              }}>
                {/* Header with close button */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div>
                    <div style={{
                      fontSize: "14px", fontWeight: 800, color: POP.black,
                      fontFamily: "'Arial Black', sans-serif",
                    }}>
                      {drillStudentName}
                    </div>
                    <div style={{ fontSize: "12px", color: "#888" }}>
                      {drillCell.pid === GENERAL_OBS_ID ? "General observation" : (pageNames[drillCell.pid] || "Checkpoint")} · {formatDate(drillData.latestDate)}
                    </div>
                  </div>
                  <button
                    onClick={() => setDrillCell(null)}
                    style={{
                      width: "28px", height: "28px", borderRadius: "8px",
                      border: `2px solid ${POP.black}`, background: POP.cream,
                      cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "14px", fontWeight: 900, color: POP.black,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Per-element ratings */}
                <div style={{ display: "grid", gap: "8px" }}>
                  {elements.map(elemId => {
                    const elem = AGENCY_ELEMENT_MAP[elemId];
                    if (!elem) return null;
                    const selfR = drillData.selfRatings[elemId];
                    const teacherR = drillData.teacherRatings[elemId];

                    return (
                      <div key={elemId} style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "8px 12px", borderRadius: "8px",
                        background: POP.white, border: "1px solid #e8e0f5",
                      }}>
                        {/* Element name — full width, no truncation */}
                        <div style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: POP.black }}>
                          {elem.name}
                        </div>

                        {/* Student self rating */}
                        {selfR !== undefined ? (
                          <div style={{
                            padding: "3px 10px", borderRadius: "6px",
                            background: DOT[selfR]?.bg || "#e5e7eb",
                            color: DOT[selfR]?.text || "#999",
                            fontSize: "11px", fontWeight: 800,
                            fontFamily: "'Arial Black', sans-serif",
                            border: "1.5px solid rgba(0,0,0,0.1)",
                            whiteSpace: "nowrap",
                          }}>
                            {DOT[selfR]?.label || selfR}
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#ccc", padding: "3px 10px" }}>No self</div>
                        )}

                        {/* Teacher rating */}
                        {teacherR !== undefined ? (
                          <div style={{
                            padding: "3px 10px", borderRadius: "6px",
                            background: TEACHER_DOT[teacherR]?.bg || "#e5e7eb",
                            color: TEACHER_DOT[teacherR]?.text || "#999",
                            fontSize: "11px", fontWeight: 800,
                            fontFamily: "'Arial Black', sans-serif",
                            border: `2px solid ${POP.hotPink}`,
                            whiteSpace: "nowrap",
                          }}>
                            T: {TEACHER_DOT[teacherR]?.label || teacherR}
                          </div>
                        ) : (
                          <div style={{ fontSize: "11px", color: "#ccc", padding: "3px 10px" }}>No obs</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Comments */}
                {(drillData.selfComment || drillData.teacherComment) && (
                  <div style={{ marginTop: "12px", display: "grid", gap: "6px" }}>
                    {drillData.selfComment && (
                      <div style={{
                        padding: "8px 12px", borderRadius: "8px",
                        background: "#f0fafb", border: "1px solid #d1ecf0",
                        fontSize: "12px", color: "#444", lineHeight: 1.5,
                      }}>
                        <span style={{ fontWeight: 700, color: "#0891b2" }}>Student:</span> {drillData.selfComment}
                      </div>
                    )}
                    {drillData.teacherComment && (
                      <div style={{
                        padding: "8px 12px", borderRadius: "8px",
                        background: "#faf0fc", border: "1px solid #e0bff0",
                        fontSize: "12px", color: "#444", lineHeight: 1.5,
                      }}>
                        <span style={{ fontWeight: 700, color: POP.hotPink }}>Teacher:</span> {drillData.teacherComment}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            <div style={{
              display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center",
              padding: "10px 16px", borderTop: `2px solid ${POP.black}`,
              background: POP.cream, borderRadius: drillCell ? "0" : "0 0 13px 13px",
              fontSize: "11px", color: "#666",
            }}>
              {[1, 2, 3].map(r => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{
                    width: "12px", height: "12px", borderRadius: "50%",
                    background: DOT[r]?.bg, border: "1.5px solid rgba(255,255,255,0.8)",
                    boxShadow: "0 0 0 1px #d1d5db",
                  }} />
                  <span>{DOT[r]?.label}</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{
                  width: "12px", height: "12px", borderRadius: "50%",
                  background: POP.hotPink, border: "1.5px solid #fff",
                }} />
                <span>T = Teacher obs</span>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "10px", color: "#aaa" }}>
                Click any dot to see detail
              </div>
            </div>

            {/* CSS animation */}
            <style>{`
              @keyframes nmSlideDown {
                from { opacity: 0; max-height: 0; }
                to { opacity: 1; max-height: 600px; }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
}
