"use client";

import { useState, useCallback, useMemo } from "react";
import type { ContentBlock, LearningModule } from "@/lib/safety/content-blocks";
import { getBlocksFromBadge } from "@/lib/safety/content-blocks";
import SpotTheHazard from "./SpotTheHazard";
import ScenarioBlock from "./ScenarioBlock";
import BeforeAfterBlock from "./BeforeAfterBlock";
import KeyConceptBlock from "./KeyConceptBlock";
import ComprehensionCheckBlock from "./ComprehensionCheckBlock";
import VideoEmbedBlock from "./VideoEmbedBlock";
import MachineDiagramBlock from "./MachineDiagramBlock";
import MicroStoryBlock from "./MicroStoryBlock";
import StepByStepBlock from "./StepByStepBlock";

// ============================================================================
// Types
// ============================================================================

interface ModuleRendererProps {
  /** Full learning module with badge_id and blocks */
  module?: LearningModule;
  /** OR pass blocks directly (for backward compat with old learn_content) */
  blocks?: ContentBlock[];
  /** OR pass a badge object and we'll extract blocks automatically */
  badge?: {
    learning_blocks?: ContentBlock[];
    learn_content?: Array<{ title: string; content: string; icon: string }>;
  };
  /** Called when all blocks are completed */
  onModuleComplete?: (results: ModuleResults) => void;
  /** Show progress bar (default true) */
  showProgress?: boolean;
  /** Allow skipping ahead (default false — must complete in order) */
  allowSkip?: boolean;
}

export interface ModuleResults {
  totalBlocks: number;
  completedBlocks: number;
  comprehensionScore: { correct: number; total: number };
  hazardsFound?: number;
  timeSpentMs: number;
}

// ============================================================================
// Inline SVG Icons
// ============================================================================

function ChevronLeftIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
      <path d="M12 8H28V18C28 23.5 24.4 28 20 28C15.6 28 12 23.5 12 18V8Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12H8C8 16 9.5 18 12 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 12H32C32 16 30.5 18 28 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 28V32" stroke="currentColor" strokeWidth="2" />
      <path d="M14 32H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ============================================================================
// CSS Keyframes
// ============================================================================

const keyframes = `
@keyframes moduleSlideIn {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes completePulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}
@keyframes progressFill {
  from { width: 0%; }
}
@keyframes confetti {
  0% { transform: translateY(0) rotate(0deg); opacity: 1; }
  100% { transform: translateY(-60px) rotate(360deg); opacity: 0; }
}
`;

// ============================================================================
// Block Type Label
// ============================================================================

function blockTypeLabel(type: string): string {
  switch (type) {
    case "spot_the_hazard": return "Spot the Hazard";
    case "scenario": return "Scenario";
    case "before_after": return "Before & After";
    case "key_concept": return "Key Concept";
    case "comprehension_check": return "Quick Check";
    case "micro_story": return "Case Study";
    case "step_by_step": return "Step by Step";
    case "machine_diagram": return "Diagram";
    case "video_embed": return "Video";
    default: return "Activity";
  }
}

function blockTypeColor(type: string): string {
  switch (type) {
    case "spot_the_hazard": return "#f59e0b";
    case "scenario": return "#8b5cf6";
    case "before_after": return "#06b6d4";
    case "key_concept": return "#6366f1";
    case "comprehension_check": return "#10b981";
    default: return "#94a3b8";
  }
}

// ============================================================================
// Module Renderer Component
// ============================================================================

export default function ModuleRenderer({
  module,
  blocks: blocksProp,
  badge,
  onModuleComplete,
  showProgress = true,
  allowSkip = false,
}: ModuleRendererProps) {
  // Resolve blocks from whatever source is provided
  const blocks = useMemo(() => {
    if (module?.blocks?.length) return module.blocks;
    if (blocksProp?.length) return blocksProp;
    if (badge) return getBlocksFromBadge(badge);
    return [];
  }, [module, blocksProp, badge]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [comprehensionResults, setComprehensionResults] = useState<Array<{ correct: boolean }>>([]);
  const [moduleComplete, setModuleComplete] = useState(false);
  const [startTime] = useState(Date.now());

  const totalBlocks = blocks.length;
  const completedCount = completedSet.size;
  const progressPct = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0;
  const currentBlock = blocks[currentIndex] ?? null;

  // Mark current block as complete
  const handleBlockComplete = useCallback((extra?: { correct?: boolean }) => {
    setCompletedSet(prev => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });

    if (extra?.correct !== undefined) {
      setComprehensionResults(prev => [...prev, { correct: extra.correct! }]);
    }
  }, [currentIndex]);

  // Navigate to next block
  const goNext = useCallback(() => {
    if (currentIndex < totalBlocks - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (completedSet.size >= totalBlocks - 1 || completedSet.has(currentIndex)) {
      // All blocks done (current one might just have been completed)
      setModuleComplete(true);
      const results: ModuleResults = {
        totalBlocks,
        completedBlocks: completedSet.size + (completedSet.has(currentIndex) ? 0 : 1),
        comprehensionScore: {
          correct: comprehensionResults.filter(r => r.correct).length,
          total: comprehensionResults.length,
        },
        timeSpentMs: Date.now() - startTime,
      };
      onModuleComplete?.(results);
    }
  }, [currentIndex, totalBlocks, completedSet, comprehensionResults, startTime, onModuleComplete]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const canGoNext = allowSkip || completedSet.has(currentIndex);

  if (blocks.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#94a3b8" }}>
        <p>No learning materials available for this badge yet.</p>
      </div>
    );
  }

  // ==================== Completion Screen ====================
  if (moduleComplete) {
    const compScore = comprehensionResults.length > 0
      ? comprehensionResults.filter(r => r.correct).length
      : null;
    const compTotal = comprehensionResults.length;
    const timeSec = Math.round((Date.now() - startTime) / 1000);
    const timeMin = Math.floor(timeSec / 60);
    const timeFmt = timeMin > 0 ? `${timeMin}m ${timeSec % 60}s` : `${timeSec}s`;

    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>
        <style>{keyframes}</style>
        <div style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
          borderRadius: 16,
          padding: "40px 32px",
          textAlign: "center",
          animation: "completePulse 2s ease-in-out",
          border: "2px solid #4338ca",
        }}>
          <div style={{ color: "#fbbf24", marginBottom: 16 }}>
            <TrophyIcon />
          </div>
          <h2 style={{ color: "#fff", fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>
            Module Complete!
          </h2>
          <p style={{ color: "#c7d2fe", fontSize: 16, margin: "0 0 24px" }}>
            You&apos;ve completed all {totalBlocks} learning activities.
          </p>

          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            flexWrap: "wrap",
            marginBottom: 24,
          }}>
            <div style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 24px",
              minWidth: 100,
            }}>
              <div style={{ color: "#fbbf24", fontSize: 28, fontWeight: 700 }}>{totalBlocks}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Activities</div>
            </div>

            {compScore !== null && (
              <div style={{
                background: "rgba(255,255,255,0.08)",
                borderRadius: 12,
                padding: "16px 24px",
                minWidth: 100,
              }}>
                <div style={{
                  color: compScore === compTotal ? "#10b981" : "#f59e0b",
                  fontSize: 28,
                  fontWeight: 700,
                }}>{compScore}/{compTotal}</div>
                <div style={{ color: "#94a3b8", fontSize: 13 }}>Quiz Score</div>
              </div>
            )}

            <div style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: 12,
              padding: "16px 24px",
              minWidth: 100,
            }}>
              <div style={{ color: "#818cf8", fontSize: 28, fontWeight: 700 }}>{timeFmt}</div>
              <div style={{ color: "#94a3b8", fontSize: 13 }}>Time</div>
            </div>
          </div>

          <p style={{ color: "#a5b4fc", fontSize: 14 }}>
            You&apos;re ready to take the safety quiz!
          </p>
        </div>
      </div>
    );
  }

  // ==================== Main Render ====================
  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <style>{keyframes}</style>

      {/* ---- Progress Bar ---- */}
      {showProgress && (
        <div style={{ padding: "16px 16px 0" }}>
          {/* Step dots */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 8,
            flexWrap: "wrap",
          }}>
            {blocks.map((block, i) => {
              const isCompleted = completedSet.has(i);
              const isCurrent = i === currentIndex;
              const color = blockTypeColor(block.type);
              return (
                <button
                  key={i}
                  onClick={() => (allowSkip || completedSet.has(i) || i <= currentIndex) && setCurrentIndex(i)}
                  style={{
                    width: isCurrent ? 28 : 20,
                    height: 8,
                    borderRadius: 4,
                    border: "none",
                    background: isCompleted ? "#10b981" : isCurrent ? color : "#334155",
                    cursor: (allowSkip || completedSet.has(i) || i <= currentIndex) ? "pointer" : "default",
                    transition: "all 0.2s ease",
                    opacity: i > currentIndex && !completedSet.has(i) && !allowSkip ? 0.4 : 1,
                  }}
                  title={`${blockTypeLabel(block.type)}${isCompleted ? " (completed)" : ""}`}
                />
              );
            })}
          </div>

          {/* Progress text */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            color: "#94a3b8",
          }}>
            <span>
              <span style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                background: blockTypeColor(currentBlock?.type ?? ""),
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                marginRight: 8,
              }}>
                {blockTypeLabel(currentBlock?.type ?? "")}
              </span>
              {currentIndex + 1} of {totalBlocks}
            </span>
            <span style={{ color: "#10b981" }}>
              {completedCount} completed
            </span>
          </div>
        </div>
      )}

      {/* ---- Current Block ---- */}
      <div
        key={currentIndex}
        style={{ animation: "moduleSlideIn 0.3s ease-out" }}
      >
        {renderBlock(currentBlock, handleBlockComplete)}
      </div>

      {/* ---- Navigation ---- */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px",
        borderTop: "1px solid #1e293b",
        marginTop: 8,
      }}>
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "transparent",
            color: currentIndex === 0 ? "#475569" : "#e2e8f0",
            cursor: currentIndex === 0 ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <ChevronLeftIcon /> Previous
        </button>

        {completedSet.has(currentIndex) && (
          <span style={{ color: "#10b981", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircleIcon /> Done
          </span>
        )}

        <button
          onClick={goNext}
          disabled={!canGoNext}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "8px 20px",
            borderRadius: 8,
            border: "none",
            background: canGoNext
              ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
              : "#1e293b",
            color: canGoNext ? "#fff" : "#475569",
            cursor: canGoNext ? "pointer" : "not-allowed",
            fontSize: 14,
            fontWeight: 600,
            transition: "all 0.2s ease",
          }}
        >
          {currentIndex === totalBlocks - 1 ? "Finish" : "Next"} <ChevronRightIcon />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Block Router
// ============================================================================

function renderBlock(
  block: ContentBlock | null,
  onComplete: (extra?: { correct?: boolean }) => void,
) {
  if (!block) return null;

  switch (block.type) {
    case "spot_the_hazard":
      return <SpotTheHazard block={block} onComplete={() => onComplete()} />;
    case "scenario":
      return <ScenarioBlock block={block} onComplete={() => onComplete()} />;
    case "before_after":
      return <BeforeAfterBlock block={block} onComplete={() => onComplete()} />;
    case "key_concept":
      return <KeyConceptBlock block={block} onComplete={() => onComplete()} />;
    case "comprehension_check":
      return (
        <ComprehensionCheckBlock
          block={block}
          onComplete={(correct) => onComplete({ correct })}
        />
      );
    case "video_embed":
      return <VideoEmbedBlock block={block} onComplete={() => onComplete()} />;
    case "machine_diagram":
      return <MachineDiagramBlock block={block} onComplete={() => onComplete()} />;
    case "micro_story":
      return <MicroStoryBlock block={block} onComplete={() => onComplete()} />;
    case "step_by_step":
      return <StepByStepBlock block={block} onComplete={() => onComplete()} />;
    default:
      return null;
  }
}
