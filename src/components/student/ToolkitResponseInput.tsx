"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// ---------------------------------------------------------------------------
// Dynamic import helper — same pattern as ToolModal.tsx
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
function dynamicTool(importFn: () => Promise<any>, exportName: string) {
  return dynamic(
    () => importFn().then((m: any) => ({ default: m[exportName] })),
    { ssr: false }
  );
}

// ---------------------------------------------------------------------------
// All 27 interactive toolkit tools (code-split, loaded on demand)
// ---------------------------------------------------------------------------

const TOOL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  "scamper":              dynamicTool(() => import("@/components/toolkit/ScamperTool"), "ScamperTool"),
  "six-thinking-hats":    dynamicTool(() => import("@/components/toolkit/SixHatsTool"), "SixHatsTool"),
  "pmi-chart":            dynamicTool(() => import("@/components/toolkit/PmiChartTool"), "PmiChartTool"),
  "five-whys":            dynamicTool(() => import("@/components/toolkit/FiveWhysTool"), "FiveWhysTool"),
  "empathy-map":          dynamicTool(() => import("@/components/toolkit/EmpathyMapTool"), "EmpathyMapTool"),
  "decision-matrix":      dynamicTool(() => import("@/components/toolkit/DecisionMatrixTool"), "DecisionMatrixTool"),
  "how-might-we":         dynamicTool(() => import("@/components/toolkit/HowMightWeTool"), "HowMightWeTool"),
  "reverse-brainstorm":   dynamicTool(() => import("@/components/toolkit/ReverseBrainstormTool"), "ReverseBrainstormTool"),
  "swot-analysis":        dynamicTool(() => import("@/components/toolkit/SwotAnalysisTool"), "SwotAnalysisTool"),
  "stakeholder-map":      dynamicTool(() => import("@/components/toolkit/StakeholderMapTool"), "StakeholderMapTool"),
  "lotus-diagram":        dynamicTool(() => import("@/components/toolkit/LotusDiagramTool"), "LotusDiagramTool"),
  "affinity-diagram":     dynamicTool(() => import("@/components/toolkit/AffinityDiagramTool"), "AffinityDiagramTool"),
  "morphological-chart":  dynamicTool(() => import("@/components/toolkit/MorphologicalChartTool"), "MorphologicalChartTool"),
  "mind-map":             dynamicTool(() => import("@/components/toolkit/MindMapTool"), "MindMapTool"),
  "brainstorm-web":       dynamicTool(() => import("@/components/toolkit/BrainstormWebTool"), "BrainstormWebTool"),
  "feedback-capture-grid": dynamicTool(() => import("@/components/toolkit/FeedbackCaptureGridTool"), "FeedbackCaptureGridTool"),
  "journey-map":          dynamicTool(() => import("@/components/toolkit/JourneyMapTool"), "JourneyMapTool"),
  "systems-map":          dynamicTool(() => import("@/components/toolkit/SystemsMapTool"), "SystemsMapTool"),
  "user-persona":         dynamicTool(() => import("@/components/toolkit/UserPersonaTool"), "UserPersonaTool"),
  "fishbone-diagram":     dynamicTool(() => import("@/components/toolkit/FishboneTool"), "FishboneTool"),
  "biomimicry-cards":     dynamicTool(() => import("@/components/toolkit/BiomimicryTool"), "BiomimicryTool"),
  "pairwise-comparison":  dynamicTool(() => import("@/components/toolkit/PairwiseComparisonTool"), "PairwiseComparisonTool"),
  "impact-effort-matrix": dynamicTool(() => import("@/components/toolkit/ImpactEffortMatrixTool"), "ImpactEffortMatrixTool"),
  "pov-statement":        dynamicTool(() => import("@/components/toolkit/PointOfViewTool"), "PointOfViewTool"),
  "design-specification": dynamicTool(() => import("@/components/toolkit/DesignSpecificationTool"), "DesignSpecificationTool"),
  "dot-voting":           dynamicTool(() => import("@/components/toolkit/DotVotingTool"), "DotVotingTool"),
  "quick-sketch":         dynamicTool(() => import("@/components/toolkit/QuickSketchTool"), "QuickSketchTool"),
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ToolkitResponseInputProps {
  toolId: string;
  challenge?: string;
  onChange: (value: string) => void;
}

/**
 * Renders the correct toolkit tool component inline within a lesson activity.
 *
 * All tools render in `embedded` mode — state is piped back via onChange as
 * JSON string, saved in student_progress alongside other activity responses.
 * This means tool data is scoped to (student, unit, page, activity) and can
 * be referenced by other activities in the same unit.
 */
export function ToolkitResponseInput({
  toolId,
  challenge,
  onChange,
}: ToolkitResponseInputProps) {
  const ToolComponent = TOOL_COMPONENTS[toolId];

  if (!ToolComponent) {
    return (
      <div className="border border-border rounded-lg p-4 text-center text-text-secondary text-sm">
        Unknown toolkit tool: <strong>{toolId}</strong>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-4 text-center text-text-secondary text-sm animate-pulse">
          Loading tool...
        </div>
      }
    >
      <ToolComponent
        toolId={toolId}
        mode="embedded"
        challenge={challenge}
        onSave={(state: any) => {
          onChange(JSON.stringify({ type: "toolkit-tool", toolId, state }));
        }}
        onComplete={(data: any) => {
          onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
        }}
      />
    </Suspense>
  );
}
/* eslint-enable @typescript-eslint/no-explicit-any */
