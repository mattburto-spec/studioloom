"use client";

import { useState, useCallback } from "react";
import type { ComprehensionCheckBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Constants
// ============================================================================

const LETTERS = ["A", "B", "C", "D"];
const GREEN = "#10b981";
const RED = "#ef4444";
const INDIGO = "#4f46e5";
const GRAY = "#e2e8f0";
const DARK_BG = "#1a1a2e";

// ============================================================================
// Main Component
// ============================================================================

interface ComprehensionCheckBlockProps {
  block: ComprehensionCheckBlock;
  onComplete?: (correct: boolean) => void;
}

export default function ComprehensionCheckBlock({
  block,
  onComplete,
}: ComprehensionCheckBlockProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleSelectAnswer = useCallback(
    (index: number) => {
      if (revealed) return; // Don't allow changing after reveal

      setSelectedIndex(index);
      const correct = index === block.correct_index;
      setIsCorrect(correct);
      setRevealed(true);

      // Call onComplete after animation settles
      setTimeout(() => {
        onComplete?.(correct);
      }, 2000);
    },
    [block.correct_index, revealed, onComplete]
  );

  const handleGotIt = useCallback(() => {
    setSelectedIndex(null);
    setRevealed(false);
    setIsCorrect(null);
  }, []);

  return (
    <div style={{ background: DARK_BG, borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "24px 24px 16px" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
          {block.question}
        </h3>
        <p style={{ color: "#94a3b8", fontSize: "13px", marginTop: "8px", margin: "8px 0 0" }}>
          {revealed ? "" : "Select the correct answer"}
        </p>
      </div>

      {/* Answer options */}
      <div style={{ padding: "12px 24px 24px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {block.options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrectAnswer = idx === block.correct_index;
          const shouldHighlight = revealed && (isSelected || isCorrectAnswer);

          let bgColor = GRAY;
          let borderColor = "#cbd5e1";
          let textColor = "#1e293b";
          let animation = "";

          if (revealed && isSelected) {
            if (isCorrect) {
              bgColor = "#dcfce7"; // Light green
              borderColor = GREEN;
              textColor = "#166534";
              animation = "correctPulse 0.6s ease-out";
            } else {
              bgColor = "#fee2e2"; // Light red
              borderColor = RED;
              textColor = "#991b1b";
              animation = "wrongShake 0.5s ease-out";
            }
          } else if (revealed && isCorrectAnswer && !isCorrect) {
            // Show correct answer if student was wrong
            bgColor = "#dcfce7";
            borderColor = GREEN;
            textColor = "#166534";
          } else if (!revealed) {
            // Hover/interactive state
            bgColor = "#f8fafc";
            borderColor = INDIGO;
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelectAnswer(idx)}
              disabled={revealed}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                padding: "16px 18px",
                background: bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: "12px",
                cursor: revealed ? "default" : "pointer",
                fontSize: "15px",
                fontWeight: 500,
                color: textColor,
                transition: "all 0.2s ease-out",
                animation: animation,
              }}
            >
              {/* Letter badge */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background:
                    revealed && shouldHighlight
                      ? isCorrect
                        ? GREEN
                        : RED
                      : INDIGO,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "16px",
                  flexShrink: 0,
                }}
              >
                {LETTERS[idx]}
              </div>

              {/* Option text */}
              <span style={{ flex: 1, textAlign: "left" }}>{option}</span>

              {/* Checkmark or X */}
              {revealed && shouldHighlight && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    flexShrink: 0,
                  }}
                >
                  {isCorrect ? (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={GREEN}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: "24px", height: "24px", animation: "checkAppear 0.5s ease-out" }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={RED}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: "24px", height: "24px" }}
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Feedback section */}
      {revealed && (
        <div
          style={{
            padding: "16px 24px 24px",
            animation: "fadeIn 0.4s ease-out",
          }}
        >
          {/* Correct feedback */}
          {isCorrect && (
            <div
              style={{
                background: "#dcfce7",
                border: `2px solid ${GREEN}`,
                borderRadius: "12px",
                padding: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                <svg
                  viewBox="0 0 24 24"
                  fill={GREEN}
                  style={{ width: "20px", height: "20px", flexShrink: 0 }}
                >
                  <circle cx="12" cy="12" r="11" />
                </svg>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: GREEN,
                  }}
                >
                  Perfect!
                </span>
              </div>
              <p
                style={{
                  fontSize: "14px",
                  color: "#166534",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {block.feedback_correct}
              </p>
            </div>
          )}

          {/* Wrong feedback */}
          {!isCorrect && (
            <div>
              <div
                style={{
                  background: "#fee2e2",
                  border: `2px solid ${RED}`,
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <svg
                    viewBox="0 0 24 24"
                    fill={RED}
                    style={{ width: "20px", height: "20px", flexShrink: 0 }}
                  >
                    <circle cx="12" cy="12" r="11" />
                  </svg>
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: RED,
                    }}
                  >
                    Not quite
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#991b1b",
                    margin: 0,
                    lineHeight: 1.6,
                  }}
                >
                  {block.feedback_wrong}
                </p>
              </div>

              {/* Hint section if available */}
              {block.hint && (
                <div
                  style={{
                    background: "#fef3c7",
                    border: `2px solid #f59e0b`,
                    borderRadius: "12px",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#d97706"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: "18px", height: "18px", marginTop: "2px", flexShrink: 0 }}
                    >
                      <circle cx="12" cy="12" r="10" />
                      <text x="12" y="16" textAnchor="middle" fill="#d97706" fontSize="12" fontWeight="bold">
                        ?
                      </text>
                    </svg>
                    <div>
                      <p
                        style={{
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#92400e",
                          margin: "0 0 4px",
                          textTransform: "uppercase",
                        }}
                      >
                        Try thinking about...
                      </p>
                      <p
                        style={{
                          fontSize: "13px",
                          color: "#92400e",
                          margin: 0,
                          lineHeight: 1.5,
                        }}
                      >
                        {block.hint}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Got it button */}
          <button
            onClick={handleGotIt}
            style={{
              width: "100%",
              marginTop: "16px",
              padding: "12px 20px",
              background: INDIGO,
              color: "#fff",
              border: "none",
              borderRadius: "10px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s ease-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#4338ca";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = INDIGO;
            }}
          >
            Got it!
          </button>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes correctPulse {
          0% {
            background-color: #dcfce7;
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            background-color: #dcfce7;
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }

        @keyframes wrongShake {
          0% {
            transform: translateX(0);
          }
          10% {
            transform: translateX(-4px);
          }
          20% {
            transform: translateX(4px);
          }
          30% {
            transform: translateX(-4px);
          }
          40% {
            transform: translateX(4px);
          }
          50% {
            transform: translateX(-2px);
          }
          60% {
            transform: translateX(2px);
          }
          100% {
            transform: translateX(0);
          }
        }

        @keyframes checkAppear {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fadeIn {
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
