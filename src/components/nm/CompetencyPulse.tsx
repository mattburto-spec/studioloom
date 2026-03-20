"use client";

import { useState } from "react";
import { NMElement, STUDENT_RATING_SCALE } from "@/lib/nm/constants";

interface CompetencyPulseProps {
  pageId: string;
  unitId: string;
  elements: NMElement[];
  onComplete: () => void;
}

export function CompetencyPulse({
  pageId,
  unitId,
  elements,
  onComplete,
}: CompetencyPulseProps) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [reflection, setReflection] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allRated = elements.every((e) => ratings[e.id] !== undefined);

  const handleRating = (elementId: string, value: number) => {
    setRatings((prev) => ({ ...prev, [elementId]: value }));
  };

  const handleSubmit = async () => {
    if (!allRated) return;

    setLoading(true);
    try {
      const res = await fetch("/api/student/nm-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          unitId,
          assessments: elements.map((e) => ({
            element: e.id,
            rating: ratings[e.id],
            comment: null,
          })),
          reflection: reflection || null,
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          onComplete();
        }, 1500);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("Assessment save failed:", res.status, errData);
        setError("Something went wrong — please try again.");
      }
    } catch (error) {
      console.error("Assessment submission failed:", error);
      setError("Connection error — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          borderRadius: "12px",
          border: "1px solid #7c3aed",
          background: "#f5f3ff",
          padding: "20px",
          textAlign: "center",
          animation: "fadeOut 0.3s ease-out 1.2s forwards",
        }}
      >
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>✨</div>
        <p
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "#7c3aed",
          }}
        >
          Thanks for reflecting!
        </p>
        <style>{`
          @keyframes fadeOut {
            to {
              opacity: 0;
              transform: translateY(-8px);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #c4b5fd",
        background: "white",
        padding: "20px",
        animation: "slideIn 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <span style={{ fontSize: "18px" }}>💭</span>
        <h3
          style={{
            margin: 0,
            fontSize: "15px",
            fontWeight: 600,
            color: "#1f2937",
          }}
        >
          Quick reflection
        </h3>
      </div>

      {/* Element ratings */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px", marginBottom: "16px" }}>
        {elements.map((elem) => (
          <div key={elem.id}>
            <div style={{ marginBottom: "8px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
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
                {elem.studentDescription}
              </div>
            </div>

            {/* 3-point rating pills */}
            <div style={{ display: "flex", gap: "8px" }}>
              {STUDENT_RATING_SCALE.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleRating(elem.id, option.value)}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border:
                      ratings[elem.id] === option.value
                        ? `2px solid #7c3aed`
                        : "1px solid #d1d5db",
                    background:
                      ratings[elem.id] === option.value ? "#7c3aed" : "white",
                    color:
                      ratings[elem.id] === option.value ? "white" : "#6b7280",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Reflection textarea */}
      <div style={{ marginBottom: "16px" }}>
        <label
          style={{
            display: "block",
            fontSize: "12px",
            fontWeight: 500,
            color: "#6b7280",
            marginBottom: "6px",
          }}
        >
          What&apos;s one thing you noticed about yourself as a learner?
        </label>
        <textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          placeholder="Optional..."
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #d1d5db",
            fontSize: "13px",
            fontFamily: "inherit",
            resize: "vertical",
            minHeight: "80px",
            outline: "none",
          }}
        />
      </div>

      {/* Error message */}
      {error && (
        <div style={{ marginBottom: "10px", padding: "8px 12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "12px" }}>
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!allRated || loading}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "none",
          background: allRated && !loading ? "#7c3aed" : "#d1d5db",
          color: "white",
          fontSize: "13px",
          fontWeight: 600,
          cursor: allRated && !loading ? "pointer" : "not-allowed",
          transition: "all 0.2s",
        }}
      >
        {loading ? "Saving..." : "Complete Reflection"}
      </button>
    </div>
  );
}
