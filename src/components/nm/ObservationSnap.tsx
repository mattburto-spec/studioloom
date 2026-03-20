"use client";

import { useState } from "react";
import { NMElement, TEACHER_RATING_SCALE } from "@/lib/nm/constants";

interface ObservationSnapProps {
  studentId: string;
  studentName: string;
  unitId: string;
  elements: NMElement[];
  onComplete: () => void;
  onClose: () => void;
}

export function ObservationSnap({
  studentId,
  studentName,
  unitId,
  elements,
  onComplete,
  onClose,
}: ObservationSnapProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [expandedObservation, setExpandedObservation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasAnyRating = Object.keys(ratings).length > 0;

  const handleRating = (elementId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async () => {
    if (!hasAnyRating) return;

    setLoading(true);
    try {
      const res = await fetch("/api/teacher/nm-observation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          unitId,
          ratings: Object.entries(ratings).map(([elementId, rating]) => ({
            elementId,
            rating,
            observation: observations[elementId] || null,
          })),
        }),
      });

      if (res.ok) {
        onComplete();
      }
    } catch (error) {
      console.error("Observation submission failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 50,
      }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "80vh",
          borderRadius: "16px 16px 0 0",
          background: "white",
          borderTop: "2px solid #7c3aed",
          boxShadow: "0 -10px 25px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: "#1f2937",
            }}
          >
            Observation: <span style={{ color: "#7c3aed" }}>{studentName}</span>
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: "#9ca3af",
              padding: "0",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            {elements.map((elem) => (
              <div
                key={elem.id}
                style={{
                  borderRadius: "10px",
                  border: ratings[elem.id]
                    ? `1px solid ${elem.color}`
                    : "1px solid #e5e7eb",
                  background: ratings[elem.id]
                    ? `${elem.color}11`
                    : "#f9fafb",
                  padding: "12px",
                }}
              >
                {/* Element name + definition */}
                <div style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#1f2937",
                      marginBottom: "2px",
                    }}
                  >
                    {elem.name}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                    }}
                  >
                    {elem.definition}
                  </div>
                </div>

                {/* 4-point rating pills */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "8px" }}>
                  {TEACHER_RATING_SCALE.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleRating(elem.id, option.value)}
                      style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        border:
                          ratings[elem.id] === option.value
                            ? "none"
                            : "1px solid #d1d5db",
                        background:
                          ratings[elem.id] === option.value
                            ? elem.color
                            : "white",
                        color:
                          ratings[elem.id] === option.value
                            ? "white"
                            : "#6b7280",
                        fontSize: "11px",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {/* Observation textarea (collapsible) */}
                {ratings[elem.id] && (
                  <button
                    onClick={() =>
                      setExpandedObservation(
                        expandedObservation === elem.id ? null : elem.id
                      )
                    }
                    style={{
                      background: "none",
                      border: "none",
                      fontSize: "11px",
                      color: elem.color,
                      cursor: "pointer",
                      padding: "0",
                      fontWeight: 500,
                      textDecoration: "underline",
                    }}
                  >
                    {expandedObservation === elem.id
                      ? "Hide note"
                      : "Add observation"}
                  </button>
                )}

                {expandedObservation === elem.id && (
                  <textarea
                    value={observations[elem.id] || ""}
                    onChange={(e) =>
                      setObservations((prev) => ({
                        ...prev,
                        [elem.id]: e.target.value,
                      }))
                    }
                    placeholder="What did you observe?"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      marginTop: "8px",
                      borderRadius: "6px",
                      border: `1px solid ${elem.color}40`,
                      fontSize: "12px",
                      fontFamily: "inherit",
                      resize: "vertical",
                      minHeight: "60px",
                      outline: "none",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer with submit button */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid #e5e7eb",
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              background: "white",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!hasAnyRating || loading}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: hasAnyRating && !loading ? "#7c3aed" : "#d1d5db",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor: hasAnyRating && !loading ? "pointer" : "not-allowed",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Saving..." : "Record Observation"}
          </button>
        </div>
      </div>
    </div>
  );
}
