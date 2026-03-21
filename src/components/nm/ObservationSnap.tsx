"use client";

import { useState } from "react";
import { NMElement, TEACHER_RATING_SCALE } from "@/lib/nm/constants";

interface ObservationSnapProps {
  studentId: string;
  studentName: string;
  unitId: string;
  classId?: string;
  elements: NMElement[];
  onComplete: () => void;
  onClose: () => void;
}

const POP = {
  hotPink: "#FF2D78",
  electricYellow: "#FFE135",
  cyan: "#00D4FF",
  black: "#1a1a1a",
  white: "#ffffff",
};

const LEVEL_COLORS = [
  { bg: "#FFE135", border: "#E6CA00", text: "#1a1a1a" },  // Emerging
  { bg: "#00D4FF", border: "#00A8CC", text: "#1a1a1a" },  // Developing
  { bg: "#FF2D78", border: "#D4005A", text: "#ffffff" },  // Applying
  { bg: "#9333EA", border: "#7C22CB", text: "#ffffff" },  // Extending
];

export function ObservationSnap({
  studentId,
  studentName,
  unitId,
  classId,
  elements,
  onComplete,
  onClose,
}: ObservationSnapProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [expandedObservation, setExpandedObservation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasAnyRating = Object.keys(ratings).length > 0;

  const handleRating = (elementId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async () => {
    if (!hasAnyRating) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/nm-observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          unitId,
          classId: classId || undefined,
          assessments: Object.entries(ratings).map(([element, rating]) => ({
            element,
            rating,
            comment: observations[element] || null,
          })),
        }),
      });
      if (res.ok) {
        onComplete();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Observation save failed:", res.status, errData);
        setError(errData.error || `Failed to save (${res.status}) — try again.`);
      }
    } catch (err) {
      console.error("Observation submission failed:", err);
      setError("Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "rgba(0, 0, 0, 0.4)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
      }}
      onClick={onClose}
    >
      {/* Modal panel — pop art style */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "520px", maxHeight: "85vh",
          borderRadius: "16px", border: `3px solid ${POP.black}`,
          background: POP.white, boxShadow: `6px 6px 0 ${POP.black}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          margin: "16px",
        }}
      >
        {/* Header — hot pink with dots */}
        <div style={{
          padding: "14px 20px", background: POP.hotPink,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.15) 1.5px, transparent 1.5px)",
            backgroundSize: "8px 8px",
          }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "28px", height: "28px", borderRadius: "8px",
              border: `2px solid ${POP.black}`, background: POP.electricYellow,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", fontWeight: 900, fontFamily: "'Arial Black', sans-serif",
              boxShadow: `1px 1px 0 ${POP.black}`,
            }}>NM</div>
            <div>
              <h2 style={{
                margin: 0, fontSize: "15px", fontWeight: 900, color: POP.white,
                fontFamily: "'Arial Black', sans-serif",
                textShadow: `1px 1px 0 rgba(0,0,0,0.3)`,
              }}>
                Observation Snap
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.85)", fontWeight: 600 }}>
                {studentName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              position: "relative", background: POP.electricYellow,
              border: `2px solid ${POP.black}`, borderRadius: "8px",
              width: "28px", height: "28px", fontSize: "14px", fontWeight: 900,
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `1px 1px 0 ${POP.black}`,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          <div style={{ display: "grid", gap: "14px" }}>
            {elements.map((elem) => (
              <div
                key={elem.id}
                style={{
                  borderRadius: "12px", border: `2px solid ${POP.black}`,
                  background: ratings[elem.id] ? "#f0fdf4" : "#FFF8E7",
                  padding: "14px", transition: "all 0.2s",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  <div style={{
                    fontSize: "14px", fontWeight: 800, color: POP.black,
                    fontFamily: "'Arial Black', sans-serif",
                  }}>
                    {elem.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#555", marginTop: "2px" }}>
                    {elem.definition}
                  </div>
                </div>

                {/* 4-point rating grid — pop art buttons */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                  {TEACHER_RATING_SCALE.map((option, i) => {
                    const colors = LEVEL_COLORS[i];
                    const selected = ratings[elem.id] === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleRating(elem.id, option.value)}
                        style={{
                          padding: "8px 10px", borderRadius: "8px",
                          border: `2px solid ${POP.black}`,
                          background: selected ? colors.bg : POP.white,
                          color: selected ? colors.text : "#888",
                          fontSize: "12px", fontWeight: 800,
                          fontFamily: "'Arial Black', sans-serif",
                          cursor: "pointer", transition: "all 0.15s",
                          boxShadow: selected ? `2px 2px 0 ${POP.black}` : "none",
                          transform: selected ? "translate(-1px, -1px)" : "none",
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {/* Observation toggle */}
                {ratings[elem.id] && (
                  <button
                    onClick={() => setExpandedObservation(expandedObservation === elem.id ? null : elem.id)}
                    style={{
                      background: "none", border: "none", fontSize: "12px",
                      color: POP.hotPink, cursor: "pointer", padding: 0,
                      fontWeight: 700, textDecoration: "underline",
                    }}
                  >
                    {expandedObservation === elem.id ? "Hide note" : "+ Add evidence"}
                  </button>
                )}

                {expandedObservation === elem.id && (
                  <textarea
                    value={observations[elem.id] || ""}
                    onChange={(e) => setObservations((prev) => ({ ...prev, [elem.id]: e.target.value }))}
                    placeholder="What did you observe?"
                    style={{
                      width: "100%", padding: "10px 12px", marginTop: "8px",
                      borderRadius: "8px", border: `2px solid ${POP.black}`,
                      fontSize: "13px", fontFamily: "inherit",
                      resize: "vertical", minHeight: "60px", outline: "none",
                      boxShadow: `2px 2px 0 ${POP.black}`,
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `2px solid ${POP.black}`,
          display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center",
        }}>
          {error && (
            <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700, marginRight: "auto" }}>
              {error}
            </span>
          )}
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px", borderRadius: "8px",
              border: `2px solid ${POP.black}`, background: POP.white,
              fontSize: "13px", fontWeight: 800, fontFamily: "'Arial Black', sans-serif",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasAnyRating || loading}
            style={{
              padding: "8px 20px", borderRadius: "8px",
              border: `2px solid ${POP.black}`,
              background: hasAnyRating && !loading ? POP.hotPink : "#ccc",
              color: hasAnyRating && !loading ? POP.white : "#888",
              fontSize: "13px", fontWeight: 900,
              fontFamily: "'Arial Black', 'Impact', sans-serif",
              textTransform: "uppercase", letterSpacing: "0.5px",
              cursor: hasAnyRating && !loading ? "pointer" : "not-allowed",
              boxShadow: hasAnyRating && !loading ? `3px 3px 0 ${POP.black}` : "none",
              transition: "all 0.15s",
            }}
          >
            {loading ? "SAVING..." : "RECORD"}
          </button>
        </div>
      </div>
    </div>
  );
}
