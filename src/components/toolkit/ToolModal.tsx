"use client";

import { useState, useEffect } from "react";
import { Suspense } from "react";
import dynamic from "next/dynamic";

interface ToolModalProps {
  toolId: string;
  challenge?: string;
  sessionId?: string;
  onClose: () => void;
}

/**
 * ToolModal
 *
 * Full-screen modal overlay for rendering toolkit tools in standalone mode.
 * - Dark overlay with tool component inside
 * - Close button (X) in top-right, saves progress before closing
 * - Escape key to close
 * - Tools can optionally auto-close via their onComplete callback
 */
export function ToolModal({
  toolId,
  challenge,
  sessionId,
  onClose,
}: ToolModalProps) {
  const [isClosing, setIsClosing] = useState(false);

  // Map toolId to dynamic component
  const ToolComponent = getDynamicToolComponent(toolId);

  // Auto-close after tool completion (with brief delay for animation)
  const handleToolComplete = (data: any) => {
    // Tool completed successfully - close after brief animation
    setTimeout(() => {
      handleClose();
    }, 1000);
  };

  // Handle Escape key
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  }

  if (!ToolComponent) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-6 text-center">
          <p className="text-text-secondary">Tool not found</p>
          <button
            onClick={handleClose}
            className="mt-4 px-4 py-2 bg-accent-blue text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
      onClick={handleClose}
    >
      {/* Modal container */}
      <div
        className={`relative w-full h-full max-w-6xl bg-white rounded-lg shadow-2xl overflow-auto transition-all duration-300 ${
          isClosing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-white hover:bg-surface-alt flex items-center justify-center text-text-secondary hover:text-text-primary transition shadow-md"
          aria-label="Close modal"
          title="Close (Esc)"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Tool component */}
        <Suspense fallback={<ToolLoadingFallback />}>
          <ToolComponent
            toolId={toolId}
            mode="standalone"
            challenge={challenge}
            sessionId={sessionId}
            onComplete={handleToolComplete}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ToolLoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin">
          <div
            className="w-8 h-8 border-4 border-surface-alt border-t-accent-blue rounded-full"
            style={{ borderTopColor: "rgb(123, 47, 242)" }}
          />
        </div>
        <p className="text-text-secondary mt-3">Loading tool...</p>
      </div>
    </div>
  );
}

/**
 * Get the dynamic component for a tool ID
 * Uses Next.js dynamic imports with ssr: false to avoid hydration issues
 */
function dynamicTool(importFn: () => Promise<any>, exportName: string) {
  return dynamic(
    () => importFn().then((m) => ({ default: m[exportName] })),
    { loading: () => <ToolLoadingFallback />, ssr: false }
  );
}

function getDynamicToolComponent(toolId: string) {
  const toolMap: Record<string, any> = {
    "scamper":              dynamicTool(() => import("./ScamperTool"), "ScamperTool"),
    "six-thinking-hats":    dynamicTool(() => import("./SixHatsTool"), "SixHatsTool"),
    "pmi-chart":            dynamicTool(() => import("./PmiChartTool"), "PmiChartTool"),
    "five-whys":            dynamicTool(() => import("./FiveWhysTool"), "FiveWhysTool"),
    "empathy-map":          dynamicTool(() => import("./EmpathyMapTool"), "EmpathyMapTool"),
    "decision-matrix":      dynamicTool(() => import("./DecisionMatrixTool"), "DecisionMatrixTool"),
    "how-might-we":         dynamicTool(() => import("./HowMightWeTool"), "HowMightWeTool"),
    "reverse-brainstorm":   dynamicTool(() => import("./ReverseBrainstormTool"), "ReverseBrainstormTool"),
    "swot-analysis":        dynamicTool(() => import("./SwotAnalysisTool"), "SwotAnalysisTool"),
    "stakeholder-map":      dynamicTool(() => import("./StakeholderMapTool"), "StakeholderMapTool"),
    "lotus-diagram":        dynamicTool(() => import("./LotusDiagramTool"), "LotusDiagramTool"),
    "affinity-diagram":     dynamicTool(() => import("./AffinityDiagramTool"), "AffinityDiagramTool"),
    "morphological-chart":  dynamicTool(() => import("./MorphologicalChartTool"), "MorphologicalChartTool"),
    "mind-map":             dynamicTool(() => import("./MindMapTool"), "MindMapTool"),
    "brainstorm-web":       dynamicTool(() => import("./BrainstormWebTool"), "BrainstormWebTool"),
    "feedback-capture-grid": dynamicTool(() => import("./FeedbackCaptureGridTool"), "FeedbackCaptureGridTool"),
    "journey-map":          dynamicTool(() => import("./JourneyMapTool"), "JourneyMapTool"),
    "systems-map":          dynamicTool(() => import("./SystemsMapTool"), "SystemsMapTool"),
    "user-persona":         dynamicTool(() => import("./UserPersonaTool"), "UserPersonaTool"),
    "fishbone-diagram":     dynamicTool(() => import("./FishboneTool"), "FishboneTool"),
    "biomimicry-cards":     dynamicTool(() => import("./BiomimicryTool"), "BiomimicryTool"),
    "pairwise-comparison":  dynamicTool(() => import("./PairwiseComparisonTool"), "PairwiseComparisonTool"),
    "impact-effort-matrix": dynamicTool(() => import("./ImpactEffortMatrixTool"), "ImpactEffortMatrixTool"),
    "pov-statement":        dynamicTool(() => import("./PointOfViewTool"), "PointOfViewTool"),
    "design-specification": dynamicTool(() => import("./DesignSpecificationTool"), "DesignSpecificationTool"),
    "dot-voting":           dynamicTool(() => import("./DotVotingTool"), "DotVotingTool"),
    "quick-sketch":         dynamicTool(() => import("./QuickSketchTool"), "QuickSketchTool"),
  };

  return toolMap[toolId] || null;
}
