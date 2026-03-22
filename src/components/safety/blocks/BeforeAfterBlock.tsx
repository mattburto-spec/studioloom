"use client";

import { useState, useEffect } from "react";
import type { BeforeAfterBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Icons (inline SVGs, no lucide-react)
// ============================================================================

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface BeforeAfterBlockProps {
  block: BeforeAfterBlock;
  onComplete?: () => void;
}

export default function BeforeAfterBlock({ block, onComplete }: BeforeAfterBlockProps) {
  const [isRevealed, setIsRevealed] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  // Mark complete when student has viewed both states
  useEffect(() => {
    if (isRevealed && !hasViewed) {
      setHasViewed(true);
      onComplete?.();
    }
  }, [isRevealed, hasViewed, onComplete]);

  return (
    <div style={{ background: "#1a1a2e", borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 12px" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
          {block.title}
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px" }}>
          {isRevealed ? "Compare the safe approach on the right" : "Click to reveal the correct approach"}
        </p>
      </div>

      {/* Progress indicator */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: "4px" }}>
        <div
          style={{
            height: "4px",
            flex: 1,
            borderRadius: "2px",
            background: "#dc2626",
            transition: "background 0.3s",
          }}
        />
        <div
          style={{
            height: "4px",
            flex: 1,
            borderRadius: "2px",
            background: isRevealed ? "#059669" : "#334155",
            transition: "background 0.3s",
          }}
        />
      </div>

      {/* Comparison panels */}
      <div
        style={{
          position: "relative",
          height: "420px",
          margin: "12px 16px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "2px solid #334155",
        }}
      >
        {/* Before panel (always visible, red tinted) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#fef2f2",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            zIndex: isRevealed ? 0 : 1,
            opacity: isRevealed ? 0.6 : 1,
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#dc2626",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              ✕
            </div>
            <span style={{ color: "#991b1b", fontSize: "16px", fontWeight: 700 }}>
              Dangerous Practice
            </span>
          </div>

          {/* Image or placeholder */}
          {block.before.image ? (
            <div
              style={{
                flex: 1,
                borderRadius: "8px",
                background: "#fed7d7",
                marginBottom: "12px",
                backgroundImage: `url(${block.before.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                borderRadius: "8px",
                background: "#fed7d7",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#7f1d1d",
                fontSize: "13px",
                fontStyle: "italic",
              }}
            >
              {block.before.caption}
            </div>
          )}

          {/* Hazards list */}
          <div style={{ flex: 0 }}>
            {block.before.caption && (
              <p
                style={{
                  color: "#991b1b",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
              >
                {block.before.caption}
              </p>
            )}
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {block.before.hazards.map((hazard, idx) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    marginBottom: "6px",
                    color: "#991b1b",
                    fontSize: "13px",
                  }}
                >
                  <span
                    style={{
                      color: "#dc2626",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <XIcon />
                  </span>
                  <span>{hazard}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* After panel (hidden until revealed, green tinted) */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "#f0fdf4",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            zIndex: isRevealed ? 1 : 0,
            opacity: isRevealed ? 1 : 0,
            transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: "#059669",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "16px",
              }}
            >
              ✓
            </div>
            <span style={{ color: "#166534", fontSize: "16px", fontWeight: 700 }}>
              Safe Practice
            </span>
          </div>

          {/* Image or placeholder */}
          {block.after.image ? (
            <div
              style={{
                flex: 1,
                borderRadius: "8px",
                background: "#dcfce7",
                marginBottom: "12px",
                backgroundImage: `url(${block.after.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : (
            <div
              style={{
                flex: 1,
                borderRadius: "8px",
                background: "#dcfce7",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#166534",
                fontSize: "13px",
                fontStyle: "italic",
              }}
            >
              {block.after.caption}
            </div>
          )}

          {/* Principles list */}
          <div style={{ flex: 0 }}>
            {block.after.caption && (
              <p
                style={{
                  color: "#166534",
                  fontSize: "12px",
                  fontWeight: 600,
                  marginBottom: "8px",
                  margin: 0,
                }}
              >
                {block.after.caption}
              </p>
            )}
            <ul style={{ listStyle: "none", margin: "8px 0 0", padding: 0 }}>
              {block.after.principles.map((principle, idx) => (
                <li
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    marginBottom: "6px",
                    color: "#166534",
                    fontSize: "13px",
                  }}
                >
                  <span
                    style={{
                      color: "#059669",
                      flexShrink: 0,
                      marginTop: "2px",
                    }}
                  >
                    <CheckIcon />
                  </span>
                  <span>{principle}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Slider overlay (before reveal) */}
        {!isRevealed && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: "50%",
              background: "linear-gradient(90deg, rgba(254,242,242,0) 0%, rgba(254,242,242,0.8) 100%)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Slider handle/button */}
        <button
          onClick={() => setIsRevealed(true)}
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 2,
            background: isRevealed ? "transparent" : "#fff",
            border: isRevealed ? "none" : "2px solid #4f46e5",
            padding: "12px 20px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: isRevealed ? "transparent" : "#4f46e5",
            cursor: isRevealed ? "default" : "pointer",
            transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            pointerEvents: isRevealed ? "none" : "auto",
            opacity: isRevealed ? 0 : 1,
          }}
        >
          ▶ Reveal Safe Practice
        </button>
      </div>

      {/* Key difference callout */}
      <div
        style={{
          margin: "16px",
          padding: "16px",
          borderRadius: "10px",
          background: "#eef2ff",
          borderLeft: "4px solid #4f46e5",
          opacity: isRevealed ? 1 : 0.5,
          transition: "opacity 0.5s",
        }}
      >
        <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
          <span style={{ fontSize: "18px", flexShrink: 0 }}>💡</span>
          <span style={{ color: "#3730a3", fontSize: "12px", fontWeight: 700, textTransform: "uppercase" }}>
            Key Difference
          </span>
        </div>
        <p style={{ color: "#3730a3", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
          {block.key_difference}
        </p>
      </div>

      {/* Completion state message */}
      {hasViewed && (
        <div
          style={{
            padding: "12px 16px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            margin: "8px 16px 16px",
            borderRadius: "8px",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "center",
            animation: "slideIn 0.4s ease-out",
          }}
        >
          ✓ Comparison complete
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
