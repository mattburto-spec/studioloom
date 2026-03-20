"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { ScamperTool } from "@/components/toolkit/ScamperTool";

// ---------------------------------------------------------------------------
// Dynamic imports for toolkit tools (code-split, loaded on demand)
// ---------------------------------------------------------------------------

const SixHatsTool = dynamic(
  () =>
    import("@/components/toolkit/SixHatsTool").then((m) => ({
      default: m.SixHatsTool,
    })),
  { ssr: false }
);
const PmiChartTool = dynamic(
  () =>
    import("@/components/toolkit/PmiChartTool").then((m) => ({
      default: m.PmiChartTool,
    })),
  { ssr: false }
);
const FiveWhysTool = dynamic(
  () =>
    import("@/components/toolkit/FiveWhysTool").then((m) => ({
      default: m.FiveWhysTool,
    })),
  { ssr: false }
);
const EmpathyMapTool = dynamic(
  () =>
    import("@/components/toolkit/EmpathyMapTool").then((m) => ({
      default: m.EmpathyMapTool,
    })),
  { ssr: false }
);
const DecisionMatrixToolComponent = dynamic(
  () =>
    import("@/components/toolkit/DecisionMatrixTool").then((m) => ({
      default: m.DecisionMatrixTool,
    })),
  { ssr: false }
);
const HowMightWeTool = dynamic(
  () =>
    import("@/components/toolkit/HowMightWeTool").then((m) => ({
      default: m.HowMightWeTool,
    })),
  { ssr: false }
);
const ReverseBrainstormToolComponent = dynamic(
  () =>
    import("@/components/toolkit/ReverseBrainstormTool").then((m) => ({
      default: m.ReverseBrainstormTool,
    })),
  { ssr: false }
);
const SwotAnalysisToolComponent = dynamic(
  () =>
    import("@/components/toolkit/SwotAnalysisTool").then((m) => ({
      default: m.SwotAnalysisTool,
    })),
  { ssr: false }
);
const StakeholderMapToolComponent = dynamic(
  () =>
    import("@/components/toolkit/StakeholderMapTool").then((m) => ({
      default: m.StakeholderMapTool,
    })),
  { ssr: false }
);
const LotusDiagramToolComponent = dynamic(
  () =>
    import("@/components/toolkit/LotusDiagramTool").then((m) => ({
      default: m.LotusDiagramTool,
    })),
  { ssr: false }
);
const AffinityDiagramToolComponent = dynamic(
  () =>
    import("@/components/toolkit/AffinityDiagramTool").then((m) => ({
      default: m.AffinityDiagramTool,
    })),
  { ssr: false }
);
const MorphologicalChartToolComponent = dynamic(
  () =>
    import("@/components/toolkit/MorphologicalChartTool").then((m) => ({
      default: m.MorphologicalChartTool,
    })),
  { ssr: false }
);

// ---------------------------------------------------------------------------
// Tool ID → Component mapping
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
const TOOL_COMPONENTS: Record<string, React.ComponentType<any>> = {
  scamper: ScamperTool,
  "six-thinking-hats": SixHatsTool,
  "pmi-chart": PmiChartTool,
  "five-whys": FiveWhysTool,
  "empathy-map": EmpathyMapTool,
  "decision-matrix": DecisionMatrixToolComponent,
  "how-might-we": HowMightWeTool,
  "reverse-brainstorm": ReverseBrainstormToolComponent,
  "swot-analysis": SwotAnalysisToolComponent,
  "stakeholder-map": StakeholderMapToolComponent,
  "lotus-diagram": LotusDiagramToolComponent,
  "affinity-diagram": AffinityDiagramToolComponent,
  "morphological-chart": MorphologicalChartToolComponent,
};

// Morphological chart has a different prop signature (no toolId, no onSave)
const TOOLS_WITHOUT_TOOL_ID = new Set(["morphological-chart"]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ToolkitResponseInputProps {
  toolId: string;
  challenge?: string;
  onChange: (value: string) => void;
}

/**
 * Renders the correct toolkit tool component based on toolId.
 *
 * Replaces ~200 lines of repetitive conditional rendering in ResponseInput.
 * All tools share the same onSave/onComplete → JSON.stringify → onChange pattern.
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
        Unknown toolkit tool: {toolId}
      </div>
    );
  }

  const isMinimalProps = TOOLS_WITHOUT_TOOL_ID.has(toolId);

  if (isMinimalProps) {
    return (
      <Suspense
        fallback={
          <div className="p-4 text-center text-text-secondary text-sm">
            Loading tool...
          </div>
        }
      >
        <ToolComponent
          mode="embedded"
          challenge={challenge}
          onComplete={(data: any) => {
            onChange(JSON.stringify({ type: "toolkit-tool", toolId, data }));
          }}
        />
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="p-4 text-center text-text-secondary text-sm">
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
