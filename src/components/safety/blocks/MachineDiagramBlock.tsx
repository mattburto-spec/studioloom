"use client";

import { useState, useEffect } from "react";
import type { MachineDiagramBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Icons (inline SVGs, no lucide-react)
// ============================================================================

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 8L6 12L14 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface MachineDiagramBlockProps {
  block: MachineDiagramBlock;
  onComplete?: () => void;
}

export default function MachineDiagramBlockComponent({ block, onComplete }: MachineDiagramBlockProps) {
  const [identifiedLabels, setIdentifiedLabels] = useState<Set<string>>(new Set());
  const [expandedLabelId, setExpandedLabelId] = useState<string | null>(null);
  const isAllIdentified = identifiedLabels.size === block.labels.length;

  // Fire onComplete when all labels identified
  useEffect(() => {
    if (isAllIdentified) {
      onComplete?.();
    }
  }, [isAllIdentified, onComplete]);

  const handleLabelClick = (labelId: string) => {
    // Add to identified set
    setIdentifiedLabels((prev) => new Set([...prev, labelId]));
    // Expand to show details
    setExpandedLabelId(labelId);
  };

  const handleCloseExpanded = () => {
    setExpandedLabelId(null);
  };

  return (
    <div style={{ background: "#1a1a2e", borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 12px" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
          🔧 {block.title}
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "4px", margin: "4px 0 0" }}>
          {block.mode === "tap_to_identify" ? "Tap circles to identify parts" : "Drag labels coming soon — tap to identify instead"}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 24px 12px", display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              height: "6px",
              borderRadius: "3px",
              background: "#334155",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                width: `${(identifiedLabels.size / block.labels.length) * 100}%`,
                transition: "width 0.3s ease-out",
              }}
            />
          </div>
        </div>
        <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
          {identifiedLabels.size} of {block.labels.length}
        </span>
      </div>

      {/* Machine diagram container */}
      <div
        style={{
          position: "relative",
          margin: "16px",
          borderRadius: "12px",
          overflow: "hidden",
          border: "2px solid #334155",
          background: "#0f172a",
          aspectRatio: "16 / 10",
        }}
      >
        {/* Machine image or placeholder */}
        {block.machine_image ? (
          <div
            style={{
              width: "100%",
              height: "100%",
              backgroundImage: `url(${block.machine_image})`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              backgroundColor: "#0f172a",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontSize: "14px",
              fontStyle: "italic",
            }}
          >
            [Machine image]
          </div>
        )}

        {/* Hotspot circles (overlay) */}
        {block.labels.map((label, idx) => {
          const isIdentified = identifiedLabels.has(label.id);
          const isExpanded = expandedLabelId === label.id;

          return (
            <button
              key={label.id}
              onClick={() => handleLabelClick(label.id)}
              style={{
                position: "absolute",
                left: `${label.correct_position.x}%`,
                top: `${label.correct_position.y}%`,
                transform: "translate(-50%, -50%)",
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                border: "none",
                background: isIdentified ? "#10b981" : "#3b82f6",
                color: "#fff",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease-out",
                boxShadow: isIdentified
                  ? "0 0 12px rgba(16, 185, 129, 0.4)"
                  : "0 0 12px rgba(59, 130, 246, 0.4)",
                animation: !isIdentified ? "pulse 2s ease-in-out infinite" : "none",
              }}
              title={label.text}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Expanded label info card (overlay) */}
      {expandedLabelId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={handleCloseExpanded}
        >
          {block.labels
            .filter((l) => l.id === expandedLabelId)
            .map((label) => (
              <div
                key={label.id}
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: "#1a1a2e",
                  borderRadius: "12px",
                  border: "2px solid #334155",
                  padding: "24px",
                  maxWidth: "400px",
                  width: "90%",
                  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                  animation: "slideUp 0.3s ease-out",
                }}
              >
                {/* Close button */}
                <button
                  onClick={handleCloseExpanded}
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "transparent",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CloseIcon />
                </button>

                {/* Label title */}
                <h4 style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: "0 0 12px" }}>
                  {label.text}
                </h4>

                {/* Description */}
                <p style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: 1.6, margin: "0 0 12px" }}>
                  {label.description}
                </p>

                {/* Safety note (if present) */}
                {label.safety_note && (
                  <div
                    style={{
                      background: "#78350f",
                      borderLeft: "4px solid #f59e0b",
                      padding: "12px",
                      borderRadius: "6px",
                      marginBottom: "12px",
                    }}
                  >
                    <p
                      style={{
                        color: "#fef3c7",
                        fontSize: "12px",
                        fontWeight: 600,
                        margin: "0 0 6px",
                        textTransform: "uppercase",
                      }}
                    >
                      ⚠️ Safety Note
                    </p>
                    <p style={{ color: "#fed7aa", fontSize: "12px", margin: 0, lineHeight: 1.5 }}>
                      {label.safety_note}
                    </p>
                  </div>
                )}

                {/* Status badge */}
                <div
                  style={{
                    background: "#10b981",
                    color: "#fff",
                    padding: "8px 12px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    justifyContent: "center",
                  }}
                >
                  <CheckIcon />
                  Part identified
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Status message (bottom) */}
      <div style={{ padding: "0 24px 16px" }}>
        {!isAllIdentified && (
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            {identifiedLabels.size === 0
              ? "Start by tapping the numbered circles on the machine."
              : `${block.labels.length - identifiedLabels.size} more to go!`}
          </p>
        )}

        {isAllIdentified && (
          <div
            style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              animation: "slideIn 0.4s ease-out",
            }}
          >
            <CheckIcon />
            All parts identified!
          </div>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.7);
            transform: translate(-50%, -50%) scale(1.1);
          }
        }

        @keyframes slideUp {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

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
