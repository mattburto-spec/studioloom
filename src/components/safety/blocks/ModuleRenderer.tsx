"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
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

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 10L9 13L14 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
// Block Type Helpers
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
    case "micro_story": return "#ec4899";
    case "step_by_step": return "#f97316";
    case "machine_diagram": return "#0ea5e9";
    case "video_embed": return "#ef4444";
    default: return "#94a3b8";
  }
}

function blockTypeEmoji(type: string): string {
  switch (type) {
    case "spot_the_hazard": return "⚠️";
    case "scenario": return "🎭";
    case "before_after": return "🔄";
    case "key_concept": return "💡";
    case "comprehension_check": return "✅";
    case "micro_story": return "📖";
    case "step_by_step": return "📋";
    case "machine_diagram": return "🔧";
    case "video_embed": return "🎥";
    default: return "📝";
  }
}

// ============================================================================
// Module Renderer Component — Vertical Stacking
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

  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());
  const [comprehensionResults, setComprehensionResults] = useState<Array<{ correct: boolean }>>([]);
  const [moduleComplete, setModuleComplete] = useState(false);
  const [startTime] = useState(Date.now());

  // Refs for scrolling newly revealed blocks into view
  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [lastUnlocked, setLastUnlocked] = useState(-1);

  const totalBlocks = blocks.length;
  const completedCount = completedSet.size;
  const progressPct = totalBlocks > 0 ? Math.round((completedCount / totalBlocks) * 100) : 0;

  // The highest block index that is unlocked (visible)
  // Block 0 is always unlocked. Each subsequent block unlocks when the previous is completed.
  const unlockedUpTo = useMemo(() => {
    if (allowSkip) return totalBlocks - 1;
    let maxUnlocked = 0;
    for (let i = 0; i < totalBlocks - 1; i++) {
      if (completedSet.has(i)) {
        maxUnlocked = i + 1;
      } else {
        break;
      }
    }
    return maxUnlocked;
  }, [completedSet, totalBlocks, allowSkip]);

  // Scroll newly unlocked block into view
  useEffect(() => {
    if (unlockedUpTo > lastUnlocked && unlockedUpTo > 0) {
      setLastUnlocked(unlockedUpTo);
      // Small delay to let the DOM render the new block
      setTimeout(() => {
        const el = blockRefs.current.get(unlockedUpTo);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [unlockedUpTo, lastUnlocked]);

  // Mark a block as complete
  const handleBlockComplete = useCallback((blockIndex: number, extra?: { correct?: boolean }) => {
    setCompletedSet(prev => {
      const next = new Set(prev);
      next.add(blockIndex);

      // Check if this was the last block
      if (next.size >= totalBlocks) {
        // Defer module completion to next tick so state settles
        setTimeout(() => {
          setModuleComplete(true);
          const results: ModuleResults = {
            totalBlocks,
            completedBlocks: totalBlocks,
            comprehensionScore: {
              correct: 0, // Will be filled by comprehension results
              total: 0,
            },
            timeSpentMs: Date.now() - startTime,
          };
          onModuleComplete?.(results);
        }, 300);
      }

      return next;
    });

    if (extra?.correct !== undefined) {
      setComprehensionResults(prev => [...prev, { correct: extra.correct! }]);
    }
  }, [totalBlocks, startTime, onModuleComplete]);

  if (blocks.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400">
        <p>No learning materials available for this badge yet.</p>
      </div>
    );
  }

  // ==================== Completion Banner ====================
  if (moduleComplete) {
    const compCorrect = comprehensionResults.filter(r => r.correct).length;
    const compTotal = comprehensionResults.length;
    const timeSec = Math.round((Date.now() - startTime) / 1000);
    const timeMin = Math.floor(timeSec / 60);
    const timeFmt = timeMin > 0 ? `${timeMin}m ${timeSec % 60}s` : `${timeSec}s`;

    return (
      <div>
        <style>{keyframes}</style>
        {/* Show all completed blocks */}
        {blocks.map((block, i) => (
          <div key={i} className="mb-6 opacity-60">
            <CompletedBlockHeader index={i} block={block} />
          </div>
        ))}

        {/* Completion card */}
        <div
          className="rounded-2xl p-8 text-center mt-8 border-2"
          style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)",
            borderColor: "#4338ca",
            animation: "completePulse 2s ease-in-out",
          }}
        >
          <div className="text-yellow-400 mb-4 flex justify-center">
            <TrophyIcon />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Module Complete!
          </h2>
          <p className="text-indigo-200 mb-6">
            You&apos;ve completed all {totalBlocks} learning activities.
          </p>

          <div className="flex justify-center gap-4 flex-wrap mb-6">
            <div className="bg-white/10 rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-yellow-400 text-2xl font-bold">{totalBlocks}</div>
              <div className="text-gray-400 text-xs">Activities</div>
            </div>

            {compTotal > 0 && (
              <div className="bg-white/10 rounded-xl px-5 py-3 min-w-[90px]">
                <div className={`text-2xl font-bold ${compCorrect === compTotal ? "text-green-400" : "text-yellow-400"}`}>
                  {compCorrect}/{compTotal}
                </div>
                <div className="text-gray-400 text-xs">Quiz Score</div>
              </div>
            )}

            <div className="bg-white/10 rounded-xl px-5 py-3 min-w-[90px]">
              <div className="text-indigo-300 text-2xl font-bold">{timeFmt}</div>
              <div className="text-gray-400 text-xs">Time</div>
            </div>
          </div>

          <p className="text-indigo-300 text-sm">
            You&apos;re ready to take the safety quiz!
          </p>
        </div>
      </div>
    );
  }

  // ==================== Main Render — Vertical Stack ====================
  return (
    <div>
      <style>{keyframes}</style>

      {/* ---- Sticky Progress Bar ---- */}
      {showProgress && (
        <div className="sticky top-[52px] z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100 -mx-6 px-6 py-3 mb-6">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${progressPct}%`,
                  background: progressPct === 100
                    ? "#10b981"
                    : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                }}
              />
            </div>
            <span className="text-xs font-semibold text-gray-500 w-10 text-right">
              {progressPct}%
            </span>
          </div>
          <div className="text-xs text-gray-400">
            {completedCount} of {totalBlocks} sections complete
          </div>
        </div>
      )}

      {/* ---- All Visible Blocks (stacked vertically) ---- */}
      {blocks.map((block, i) => {
        const isCompleted = completedSet.has(i);
        const isUnlocked = i <= unlockedUpTo;
        const isLatest = i === unlockedUpTo && !isCompleted;
        const color = blockTypeColor(block.type);

        // Locked block — show placeholder
        if (!isUnlocked) {
          return (
            <div
              key={i}
              className="mb-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-5 flex items-center gap-3"
            >
              <div className="text-gray-300">
                <LockIcon />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-400">
                  Section {i + 1} — {blockTypeLabel(block.type)}
                </span>
                <p className="text-xs text-gray-300 mt-0.5">
                  Complete the section above to unlock
                </p>
              </div>
            </div>
          );
        }

        // Completed block — show collapsed summary
        if (isCompleted && !isLatest) {
          return (
            <div key={i} className="mb-4">
              <CompletedBlockHeader index={i} block={block} />
            </div>
          );
        }

        // Active block — show full content
        return (
          <div
            key={i}
            ref={(el) => { if (el) blockRefs.current.set(i, el); }}
            className="mb-6"
            style={i > 0 ? { animation: "moduleSlideIn 0.4s ease-out" } : undefined}
          >
            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {i + 1}
              </div>
              <div>
                <span
                  className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-white mb-0.5"
                  style={{ backgroundColor: color }}
                >
                  {blockTypeLabel(block.type)}
                </span>
                {block.title && (
                  <h3 className="text-base font-semibold text-gray-900">{block.title}</h3>
                )}
              </div>
            </div>

            {/* Block content */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              {renderBlock(block, (extra) => handleBlockComplete(i, extra))}
            </div>

            {/* Completed indicator (appears after completing this block) */}
            {isCompleted && (
              <div className="flex items-center gap-2 mt-3 text-green-600 text-sm font-medium">
                <CheckCircleIcon />
                Section complete
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// Completed Block Header — compact collapsed view
// ============================================================================

function CompletedBlockHeader({ index, block }: { index: number; block: ContentBlock }) {
  const color = blockTypeColor(block.type);
  return (
    <div className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
      <div className="text-green-500 flex-shrink-0">
        <CheckCircleIcon />
      </div>
      <span className="text-sm text-gray-500">
        <span className="font-semibold text-gray-700">Section {index + 1}</span>
        {" — "}
        <span
          className="inline-block px-1.5 py-0.5 rounded text-xs font-medium text-white"
          style={{ backgroundColor: color }}
        >
          {blockTypeLabel(block.type)}
        </span>
        {block.title && (
          <span className="ml-1.5 text-gray-600">{block.title}</span>
        )}
      </span>
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
