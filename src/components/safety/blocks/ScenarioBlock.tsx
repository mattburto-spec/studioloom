"use client";

import { useState, useCallback } from "react";
import type { ScenarioBlock as ScenarioBlockType } from "@/lib/safety/content-blocks";

// ============================================================================
// Inline SVG Icons
// ============================================================================

function CheckmarkIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 6L9 17L4 12"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M18 6L6 18M6 6L18 18"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 6L15 12L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ScenarioBlockProps {
  block: ScenarioBlockType;
  onComplete?: () => void;
}

interface BranchState {
  id: string;
  choice_text: string;
  is_correct: boolean;
  feedback: string;
  consequence?: string;
  next_branch_id?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ScenarioBlock({ block, onComplete }: ScenarioBlockProps) {
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<BranchState | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [completedChoices, setCompletedChoices] = useState<Set<string>>(new Set());
  const [hasCompletedScenario, setHasCompletedScenario] = useState(false);

  // Get branches for current level
  const currentBranches = currentBranchId
    ? block.branches.filter((b) => b.next_branch_id === currentBranchId || b.id === currentBranchId)
    : block.branches.filter((b) => !b.next_branch_id);

  const handleChoiceClick = useCallback(
    (choice: BranchState) => {
      setSelectedChoiceId(choice.id);
      setSelectedBranch(choice);
      setShowResult(true);
      setIsCorrect(choice.is_correct);

      const newCompleted = new Set(completedChoices);
      newCompleted.add(choice.id);
      setCompletedChoices(newCompleted);

      // Auto-advance to next branch after delay if there's a next branch
      if (choice.next_branch_id) {
        setTimeout(() => {
          setCurrentBranchId(choice.next_branch_id);
          setSelectedChoiceId(null);
          setShowResult(false);
        }, 2000);
      } else if (choice.is_correct) {
        // Complete scenario if correct and no next branch
        setTimeout(() => {
          setHasCompletedScenario(true);
          onComplete?.();
        }, 2000);
      }
    },
    [completedChoices, onComplete]
  );

  const handleTryAgain = () => {
    setShowResult(false);
    setSelectedChoiceId(null);
    setSelectedBranch(null);
  };

  const handleReset = () => {
    setCurrentBranchId(null);
    setSelectedChoiceId(null);
    setSelectedBranch(null);
    setShowResult(false);
    setCompletedChoices(new Set());
    setHasCompletedScenario(false);
  };

  return (
    <div style={{ background: "#1a1a2e", borderRadius: "16px", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #334155" }}>
        <h3 style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
          {block.title}
        </h3>
        {currentBranchId && (
          <p style={{ color: "#94a3b8", fontSize: "12px", margin: 0 }}>
            Step {completedChoices.size + 1}
          </p>
        )}
      </div>

      {/* Scenario Setup (only show on first screen) */}
      {!currentBranchId && (
        <div style={{ padding: "24px", borderBottom: "1px solid #334155" }}>
          <p style={{ color: "#cbd5e1", fontSize: "15px", lineHeight: 1.6, margin: 0 }}>
            {block.setup}
          </p>
          {block.illustration && (
            <div
              style={{
                marginTop: "16px",
                borderRadius: "8px",
                overflow: "hidden",
                background: "#0f172a",
                height: "200px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={block.illustration}
                alt="Scenario illustration"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
        </div>
      )}

      {/* Choices Section */}
      {!hasCompletedScenario && (
        <div style={{ padding: "24px", minHeight: "200px" }}>
          {/* Branching prompt */}
          {currentBranchId && selectedBranch && !showResult && (
            <p style={{ color: "#cbd5e1", fontSize: "14px", lineHeight: 1.6, margin: "0 0 20px" }}>
              {selectedBranch.consequence || "What happens next?"}
            </p>
          )}

          {/* Result display */}
          {showResult && selectedBranch && (
            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "20px",
                background: isCorrect ? "#064e3b" : "#7f1d1d",
                border: `2px solid ${isCorrect ? "#10b981" : "#ef4444"}`,
                animation: "slideIn 0.3s ease-out",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div
                  style={{
                    color: isCorrect ? "#10b981" : "#ef4444",
                    display: "flex",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {isCorrect ? <CheckmarkIcon /> : <XIcon />}
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      color: isCorrect ? "#d1fae5" : "#fee2e2",
                      fontSize: "14px",
                      fontWeight: 600,
                      margin: "0 0 6px",
                    }}
                  >
                    {isCorrect ? "Correct!" : "Not quite right."}
                  </p>
                  <p
                    style={{
                      color: isCorrect ? "#d1fae5" : "#fee2e2",
                      fontSize: "13px",
                      lineHeight: 1.5,
                      margin: 0,
                    }}
                  >
                    {selectedBranch.feedback}
                  </p>
                </div>
              </div>

              {/* Try again button for wrong answers */}
              {!isCorrect && !selectedBranch.next_branch_id && (
                <button
                  onClick={handleTryAgain}
                  style={{
                    marginTop: "12px",
                    background: "#7f1d1d",
                    border: "1px solid #ef4444",
                    color: "#fecaca",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#991b1b";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "#7f1d1d";
                  }}
                >
                  Try another choice
                </button>
              )}
            </div>
          )}

          {/* Choice cards */}
          {!showResult && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {currentBranches.map((choice) => {
                const isSelected = selectedChoiceId === choice.id;
                const isCompleted = completedChoices.has(choice.id);
                return (
                  <button
                    key={choice.id}
                    onClick={() => handleChoiceClick(choice)}
                    disabled={showResult || hasCompletedScenario}
                    style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "2px solid #334155",
                      background: isSelected
                        ? choice.is_correct
                          ? "#064e3b"
                          : "#7f1d1d"
                        : "#0f172a",
                      color: isSelected
                        ? choice.is_correct
                          ? "#d1fae5"
                          : "#fee2e2"
                        : "#cbd5e1",
                      textAlign: "left",
                      cursor: hasCompletedScenario ? "default" : "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      opacity: isCompleted && !isSelected ? 0.6 : 1,
                      fontSize: "15px",
                      fontWeight: 500,
                      position: "relative",
                      overflow: "hidden",
                    }}
                    onMouseOver={(e) => {
                      if (!showResult && !hasCompletedScenario) {
                        e.currentTarget.style.borderColor = isSelected ? "inherit" : "#475569";
                        e.currentTarget.style.background = isSelected
                          ? e.currentTarget.style.background
                          : "#1e293b";
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!showResult && !hasCompletedScenario) {
                        e.currentTarget.style.borderColor = "#334155";
                        e.currentTarget.style.background = isSelected
                          ? choice.is_correct
                            ? "#064e3b"
                            : "#7f1d1d"
                          : "#0f172a";
                      }
                    }}
                  >
                    <span>{choice.choice_text}</span>
                    <div style={{ color: "inherit", opacity: 0.7 }}>
                      <ChevronRightIcon />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Completion State */}
      {hasCompletedScenario && (
        <div style={{ padding: "24px" }}>
          <div
            style={{
              background: "linear-gradient(135deg, #059669, #10b981)",
              borderRadius: "12px",
              padding: "24px",
              color: "#fff",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: "40px",
                marginBottom: "12px",
                animation: "scaleIn 0.5s ease-out",
              }}
            >
              ✓
            </div>
            <h4 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px" }}>
              Scenario Complete!
            </h4>
            <p style={{ fontSize: "13px", opacity: 0.9, margin: "0 0 16px", lineHeight: 1.5 }}>
              You made all the right choices. Good decision-making protects you and others in the workshop.
            </p>
            <button
              onClick={handleReset}
              style={{
                background: "rgba(255,255,255,0.2)",
                border: "1px solid rgba(255,255,255,0.4)",
                color: "#fff",
                padding: "10px 20px",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.2)";
              }}
            >
              Replay scenario
            </button>
          </div>
        </div>
      )}

      {/* Step indicator */}
      {currentBranchId && !hasCompletedScenario && (
        <div style={{ padding: "0 24px 16px", display: "flex", gap: "4px", justifyContent: "center" }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div
              key={idx}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background:
                  idx < completedChoices.size
                    ? "#10b981"
                    : idx === completedChoices.size
                      ? "#6366f1"
                      : "#334155",
                transition: "background 0.3s",
              }}
            />
          ))}
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

        @keyframes scaleIn {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
