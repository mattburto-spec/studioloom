"use client";

import { useState, useMemo } from "react";
import type { MicroStoryBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Inline SVG Icons
// ============================================================================

function ChevronDownIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckmarkIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="currentColor" />
    </svg>
  );
}

function WarningIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" fill="currentColor" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface MicroStoryBlockProps {
  block: MicroStoryBlock;
  onComplete?: () => void;
}

export default function MicroStoryBlockComponent({ block, onComplete }: MicroStoryBlockProps) {
  const [revealedPrompts, setRevealedPrompts] = useState<Set<string>>(new Set());

  // Track which prompts have been revealed
  const allPromptsRevealed = useMemo(() => {
    return revealedPrompts.size === block.analysis_prompts.length;
  }, [revealedPrompts, block.analysis_prompts.length]);

  const togglePrompt = (idx: number) => {
    const newRevealed = new Set(revealedPrompts);
    if (newRevealed.has(String(idx))) {
      newRevealed.delete(String(idx));
    } else {
      newRevealed.add(String(idx));
    }
    setRevealedPrompts(newRevealed);

    // Fire onComplete when all prompts revealed
    if (newRevealed.size === block.analysis_prompts.length && !allPromptsRevealed) {
      onComplete?.();
    }
  };

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "2px solid #e5e7eb", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 12px",
          background: "linear-gradient(135deg, #f0f4f8 0%, #f9fafb 100%)",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <span style={{ fontSize: "24px", lineHeight: 1 }}>📰</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
            Case Study
          </span>
        </div>
        <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#111827" }}>
          {block.title}
        </h2>
        {block.is_real_incident && (
          <div
            style={{
              marginTop: "10px",
              display: "inline-block",
              padding: "4px 10px",
              background: "#fef3c7",
              border: "1px solid #fbbf24",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#92400e",
            }}
          >
            Based on a real incident
          </div>
        )}
      </div>

      {/* Narrative section */}
      <div style={{ padding: "24px" }}>
        {/* Story text with left border accent */}
        <div
          style={{
            padding: "16px 18px",
            background: "#faf9f7",
            borderLeft: "4px solid #f59e0b",
            borderRadius: "4px",
            marginBottom: "24px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "15px",
              lineHeight: 1.7,
              color: "#374151",
              fontStyle: "italic",
            }}
          >
            {block.narrative}
          </p>
        </div>

        {/* Analysis prompts as accordion */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#111827",
              marginBottom: "12px",
              textTransform: "uppercase",
            }}
          >
            🤔 Analysis Prompts
          </h3>

          {block.analysis_prompts.map((prompt, idx) => {
            const isRevealed = revealedPrompts.has(String(idx));

            return (
              <div
                key={idx}
                style={{
                  marginBottom: idx < block.analysis_prompts.length - 1 ? "12px" : 0,
                  borderRadius: "8px",
                  border: `2px solid ${isRevealed ? "#d1d5db" : "#e5e7eb"}`,
                  overflow: "hidden",
                  background: isRevealed ? "#f9fafb" : "#ffffff",
                  transition: "all 0.2s ease",
                }}
              >
                {/* Prompt header button */}
                <button
                  onClick={() => togglePrompt(idx)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: isRevealed
                      ? "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)"
                      : "#ffffff",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: isRevealed ? "#1f2937" : "#6b7280",
                    transition: "all 0.2s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isRevealed
                      ? "linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)"
                      : "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isRevealed
                      ? "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)"
                      : "#ffffff";
                  }}
                >
                  {/* Number circle */}
                  <div
                    style={{
                      minWidth: "28px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: isRevealed ? "#10b981" : "#e5e7eb",
                      color: isRevealed ? "#fff" : "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {isRevealed ? <CheckmarkIcon size={14} /> : idx + 1}
                  </div>

                  {/* Question text */}
                  <span style={{ flex: 1 }}>Think about this: {prompt.question}</span>

                  {/* Chevron */}
                  <div
                    style={{
                      display: "flex",
                      color: "#9ca3af",
                      transform: isRevealed ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    <ChevronDownIcon size={18} />
                  </div>
                </button>

                {/* Revealed answer */}
                {isRevealed && (
                  <div
                    style={{
                      padding: "12px 14px 14px 56px",
                      borderTop: "2px solid #e5e7eb",
                      background: "#ffffff",
                      animation: "slideDown 0.3s ease-out",
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 12px",
                        background: "#f0f9ff",
                        borderLeft: "3px solid #0284c7",
                        borderRadius: "4px",
                        fontSize: "14px",
                        lineHeight: 1.6,
                        color: "#0c4a6e",
                      }}
                    >
                      {prompt.reveal_answer}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Key lesson callout */}
        <div
          style={{
            padding: "16px 18px",
            background: "#f3e8ff",
            border: "2px solid #d8b4fe",
            borderRadius: "8px",
            display: "flex",
            gap: "12px",
          }}
        >
          <div style={{ fontSize: "20px", flexShrink: 0, lineHeight: 1 }}>💜</div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: "0 0 6px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#6b21a8",
                textTransform: "uppercase",
              }}
            >
              Key Lesson
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "14px",
                lineHeight: 1.6,
                color: "#581c87",
                fontWeight: 500,
              }}
            >
              {block.key_lesson}
            </p>
          </div>
        </div>

        {/* Related rule badge */}
        {block.related_rule && (
          <div style={{ marginTop: "16px" }}>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#6b7280",
                textTransform: "uppercase",
              }}
            >
              Related Rule
            </p>
            <div
              style={{
                display: "inline-block",
                padding: "6px 12px",
                background: "#dbeafe",
                border: "1px solid #93c5fd",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#1e40af",
                fontWeight: 500,
              }}
            >
              📋 {block.related_rule}
            </div>
          </div>
        )}
      </div>

      {/* Completion indicator */}
      {allPromptsRevealed && (
        <div
          style={{
            padding: "12px 24px",
            background: "#f0fdf4",
            borderTop: "2px solid #bbf7d0",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px",
            color: "#166534",
            fontWeight: 600,
            animation: "slideUp 0.3s ease-out",
          }}
        >
          <CheckmarkIcon size={16} />
          <span>All prompts explored — good thinking!</span>
        </div>
      )}

      {/* CSS animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideUp {
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
    </div>
  );
}
