"use client";

import { useState, useMemo } from "react";
import type { StepByStepBlock } from "@/lib/safety/content-blocks";

// ============================================================================
// Inline SVG Icons
// ============================================================================

function ChevronRightIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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

function HelpCircleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16V12M12 8H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface StepByStepBlockProps {
  block: StepByStepBlock;
  onComplete?: () => void;
}

export default function StepByStepBlockComponent({ block, onComplete }: StepByStepBlockProps) {
  const [revealedStepCount, setRevealedStepCount] = useState(1); // Start with step 1 visible
  const [acknowledgedCheckpoints, setAcknowledgedCheckpoints] = useState<Set<number>>(new Set());

  const totalSteps = block.steps.length;

  // Calculate progress
  const progress = useMemo(() => {
    return Math.round((revealedStepCount / totalSteps) * 100);
  }, [revealedStepCount, totalSteps]);

  // Check if all steps revealed
  const allRevealed = revealedStepCount >= totalSteps;

  // Check if we can advance (current step must have checkpoint acknowledged or no checkpoint)
  const canAdvance = useMemo(() => {
    const currentStep = block.steps[revealedStepCount - 1];
    if (!currentStep) return false;

    if (currentStep.checkpoint) {
      return acknowledgedCheckpoints.has(revealedStepCount - 1);
    }
    return true;
  }, [revealedStepCount, acknowledgedCheckpoints, block.steps]);

  const handleNextStep = () => {
    if (revealedStepCount < totalSteps) {
      setRevealedStepCount(prev => prev + 1);
    } else if (allRevealed && !acknowledgedCheckpoints.has(totalSteps - 1)) {
      // Last step with no checkpoint — advance and trigger completion
      onComplete?.();
    }
  };

  const acknowledgeCheckpoint = (stepIdx: number) => {
    const newAcknowledged = new Set(acknowledgedCheckpoints);
    newAcknowledged.add(stepIdx);
    setAcknowledgedCheckpoints(newAcknowledged);

    // If this is the last step, trigger completion on next button click
    if (stepIdx === totalSteps - 1) {
      onComplete?.();
    }
  };

  // Fire onComplete when all steps revealed
  if (allRevealed && revealedStepCount === totalSteps && !acknowledgedCheckpoints.has(totalSteps - 1)) {
    // No checkpoint on last step — auto-complete
    const currentStep = block.steps[totalSteps - 1];
    if (!currentStep.checkpoint) {
      onComplete?.();
    }
  }

  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "2px solid #e5e7eb", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 24px 16px",
          background: "linear-gradient(135deg, #f0f4f8 0%, #f9fafb 100%)",
          borderBottom: "2px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
          <span style={{ fontSize: "24px", lineHeight: 1 }}>📋</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>
            Step by Step
          </span>
        </div>
        <h2 style={{ margin: "0 0 12px", fontSize: "20px", fontWeight: 700, color: "#111827" }}>
          {block.title}
        </h2>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ flex: 1, height: "6px", background: "#e5e7eb", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)",
                width: `${progress}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#4b5563",
              whiteSpace: "nowrap",
            }}
          >
            Step {revealedStepCount} of {totalSteps}
          </span>
        </div>
      </div>

      {/* Steps container */}
      <div style={{ padding: "24px" }}>
        {block.steps.map((step, idx) => {
          const isRevealed = idx < revealedStepCount;
          const isCurrentStep = idx === revealedStepCount - 1;
          const isCompleted = idx < revealedStepCount - 1;
          const hasCheckpoint = !!step.checkpoint;
          const checkpointAcknowledged = acknowledgedCheckpoints.has(idx);

          return (
            <div
              key={idx}
              style={{
                marginBottom: idx < totalSteps - 1 ? "24px" : 0,
                opacity: isRevealed ? 1 : 0.4,
                transition: "opacity 0.3s ease",
              }}
            >
              {/* Step header with number and connection line */}
              <div style={{ display: "flex", gap: "16px", marginBottom: "12px" }}>
                {/* Number circle */}
                <div
                  style={{
                    minWidth: "40px",
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: isCompleted
                      ? "#10b981"
                      : isCurrentStep
                        ? "#3b82f6"
                        : "#e5e7eb",
                    color: isCompleted ? "#fff" : isCurrentStep ? "#fff" : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    fontWeight: 700,
                    flexShrink: 0,
                    boxShadow: isCurrentStep ? "0 0 0 3px rgba(59, 130, 246, 0.1)" : "none",
                  }}
                >
                  {isCompleted ? <CheckmarkIcon size={18} /> : step.number}
                </div>

                {/* Instruction text */}
                <div style={{ flex: 1, paddingTop: "2px" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "15px",
                      fontWeight: isCurrentStep ? 600 : 500,
                      color: isCurrentStep ? "#111827" : "#6b7280",
                      lineHeight: 1.5,
                    }}
                  >
                    {step.instruction}
                  </p>
                </div>
              </div>

              {/* Step content (revealed only when current or completed) */}
              {isRevealed && (
                <div style={{ marginLeft: "56px", animation: "slideDown 0.3s ease-out" }}>
                  {/* Image placeholder */}
                  {step.image && (
                    <div
                      style={{
                        marginBottom: "12px",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "#f3f4f6",
                        aspectRatio: "16 / 9",
                        backgroundImage: `url(${step.image})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        border: "2px solid #e5e7eb",
                      }}
                    />
                  )}

                  {/* Warning box */}
                  {step.warning && (
                    <div
                      style={{
                        marginBottom: "12px",
                        padding: "12px 14px",
                        background: "#fef2f2",
                        border: "2px solid #fca5a5",
                        borderRadius: "8px",
                        display: "flex",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          color: "#dc2626",
                          display: "flex",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        <WarningIcon size={18} />
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          color: "#7f1d1d",
                          lineHeight: 1.5,
                          fontWeight: 500,
                        }}
                      >
                        {step.warning}
                      </p>
                    </div>
                  )}

                  {/* Checkpoint question */}
                  {step.checkpoint && isCurrentStep && (
                    <div
                      style={{
                        marginBottom: "12px",
                        padding: "14px",
                        background: "#f0fdf4",
                        border: "2px solid #86efac",
                        borderRadius: "8px",
                        display: "flex",
                        gap: "12px",
                      }}
                    >
                      <div
                        style={{
                          color: "#15803d",
                          display: "flex",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        <HelpCircleIcon size={18} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            margin: "0 0 10px",
                            fontSize: "13px",
                            fontWeight: 700,
                            color: "#166534",
                            textTransform: "uppercase",
                          }}
                        >
                          🤔 Check your understanding
                        </p>
                        <p
                          style={{
                            margin: "0 0 10px",
                            fontSize: "13px",
                            color: "#166534",
                            lineHeight: 1.5,
                          }}
                        >
                          {step.checkpoint}
                        </p>
                        <button
                          onClick={() => acknowledgeCheckpoint(idx)}
                          style={{
                            padding: "6px 12px",
                            background: checkpointAcknowledged
                              ? "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
                              : "#22c55e",
                            border: checkpointAcknowledged ? "2px solid #6ee7b7" : "none",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            color: checkpointAcknowledged ? "#166534" : "#fff",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                          disabled={checkpointAcknowledged}
                          onMouseEnter={(e) => {
                            if (!checkpointAcknowledged) {
                              e.currentTarget.style.background = "#16a34a";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!checkpointAcknowledged) {
                              e.currentTarget.style.background = "#22c55e";
                            }
                          }}
                        >
                          {checkpointAcknowledged ? "✓ Got it" : "I understand"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Connecting line (not on last step) */}
              {idx < totalSteps - 1 && (
                <div
                  style={{
                    marginLeft: "19px",
                    width: "2px",
                    height: "12px",
                    background: isRevealed ? "#e5e7eb" : "#f3f4f6",
                    transition: "background 0.3s ease",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div
        style={{
          padding: "16px 24px",
          background: "#f9fafb",
          borderTop: "2px solid #e5e7eb",
          display: "flex",
          justifyContent: "flex-end",
          gap: "12px",
        }}
      >
        {!allRevealed && (
          <button
            onClick={handleNextStep}
            disabled={!canAdvance}
            style={{
              padding: "10px 18px",
              background: canAdvance
                ? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
                : "#d1d5db",
              border: "none",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              cursor: canAdvance ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              if (canAdvance) {
                e.currentTarget.style.background = "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.3)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            Next Step
            <ChevronRightIcon size={14} />
          </button>
        )}

        {allRevealed && (
          <div
            style={{
              padding: "10px 18px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "slideUp 0.3s ease-out",
            }}
          >
            <CheckmarkIcon size={16} />
            All steps complete
          </div>
        )}
      </div>

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
