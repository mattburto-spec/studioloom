"use client";

import { useState } from "react";
import type { ResponseType } from "@/types";
import type { IntegrityMetadata } from "./MonitoredTextarea";
import { RichTextResponse } from "@/components/lesson";
import { DecisionMatrix } from "./DecisionMatrix";
import { PMIFramework } from "./PMIFramework";
import { PairwiseComparison } from "./PairwiseComparison";
import { TradeOffSliders } from "./TradeOffSliders";
import { UploadInput } from "./UploadInput";
import { VoiceInput } from "./VoiceInput";
import { LinkInput } from "./LinkInput";
import { ToolkitResponseInput } from "./ToolkitResponseInput";
import StructuredPromptsResponse from "./StructuredPromptsResponse";
import { MultiQuestionResponse } from "@/components/lesson";
import type { StructuredPromptsConfig } from "@/lib/structured-prompts/types";
import ProjectSpecResponse from "./project-spec/ProjectSpecResponse";
import ProductBriefResponse from "./product-brief/ProductBriefResponse";
import UserProfileResponse from "./user-profile/UserProfileResponse";
import SuccessCriteriaResponse from "./success-criteria/SuccessCriteriaResponse";

interface ResponseInputProps {
  sectionIndex: number;
  responseType: ResponseType;
  value: string;
  onChange: (value: string) => void;
  sentenceStarters?: string[];
  placeholder?: string;
  unitId?: string;
  pageId?: string;
  allowedTypes?: ("text" | "upload" | "voice" | "link")[];
  toolId?: string;
  toolChallenge?: string;
  /** For structured-prompts responseType (AG.1): the prompts array authored on the activity block. */
  prompts?: StructuredPromptsConfig;
  /** For structured-prompts responseType: require a photo before submit. Default false. */
  requirePhoto?: boolean;
  /** For structured-prompts responseType (AG.2.4): when true, after save, fire-and-forget append a Kanban backlog card from the "next" prompt's response. Default false. */
  autoCreateKanbanCardOnSave?: boolean;
  /** LIS.C — opt into the stepper layout (MultiQuestionResponse) for this section. Default undefined → existing all-at-once StructuredPromptsResponse. */
  promptsLayout?: "stepper";
  /** Round 11 — explicit-save flow that bypasses the lesson autosave debounce. */
  onSaveResponseImmediate?: (value: string) => Promise<void>;
  /** For structured-prompts responseType: callback fired after successful save (e.g. to seed AG.2 Kanban from the "next" prompt). */
  onStructuredPromptsSaved?: (saved: { content: string; nextMove: string | null }) => void;
  /** Enable integrity monitoring on text input (for academic integrity tracking) */
  enableIntegrityMonitoring?: boolean;
  /** Callback to receive integrity metadata from MonitoredTextarea */
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;
}

const TYPE_OPTIONS: { type: ResponseType; label: string; icon: string }[] = [
  { type: "text", label: "Text", icon: "✏️" },
  { type: "upload", label: "Upload", icon: "📎" },
  { type: "voice", label: "Voice", icon: "🎤" },
  { type: "link", label: "Link", icon: "🔗" },
];

export function ResponseInput({
  prompts,
  requirePhoto,
  autoCreateKanbanCardOnSave,
  promptsLayout,
  onSaveResponseImmediate,
  onStructuredPromptsSaved,
  sectionIndex,
  responseType,
  value,
  onChange,
  sentenceStarters,
  placeholder = "Type your response here...",
  unitId,
  pageId,
  allowedTypes,
  toolId,
  toolChallenge,
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
}: ResponseInputProps) {
  // Filter type options based on allowed types
  const typeOptions = allowedTypes
    ? TYPE_OPTIONS.filter((opt) =>
        allowedTypes.includes(opt.type as "text" | "upload" | "voice" | "link")
      )
    : TYPE_OPTIONS;

  const [activeType, setActiveType] = useState<ResponseType>(
    responseType === "multi"
      ? typeOptions.length > 0
        ? (typeOptions[0].type as ResponseType)
        : "text"
      : responseType
  );

  return (
    <div className="space-y-2">
      {/* Response type selector for multi */}
      {responseType === "multi" && typeOptions.length > 1 && (
        <div className="flex gap-1">
          {typeOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => setActiveType(opt.type)}
              className={`px-3 py-1 text-xs rounded-full transition ${
                activeType === opt.type
                  ? "bg-accent-blue text-white"
                  : "bg-surface-alt text-text-secondary hover:bg-gray-200"
              }`}
            >
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Sentence starters */}
      {sentenceStarters &&
        sentenceStarters.length > 0 &&
        activeType === "text" && (
          <div className="flex flex-wrap gap-1.5">
            {sentenceStarters.map((starter, i) => (
              <button
                key={i}
                onClick={() => {
                  if (!value.includes(starter)) {
                    onChange(value ? `${value}\n${starter}` : starter);
                  }
                }}
                className="px-2.5 py-1 text-xs bg-accent-blue/10 text-accent-blue rounded-full hover:bg-accent-blue/20 transition"
              >
                {starter}
              </button>
            ))}
          </div>
        )}

      {/* Text input — LIS.B auto-replace. RichTextResponse handles BOTH
          integrity-monitored and plain text via the same component. The
          integrity hook is enabled when enableIntegrityMonitoring=true,
          contributing the same IntegrityMetadata callback shape that
          MonitoredTextarea used to. portfolioToggle is forced off here —
          PortfolioCaptureAffordance handles that surface separately. */}
      {(activeType === "text" ||
        (responseType === "text" &&
          (responseType as string) !== "multi")) && (
        <RichTextResponse
          id={`response-${sectionIndex}`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          enableIntegrityMonitoring={enableIntegrityMonitoring}
          onIntegrityUpdate={onIntegrityUpdate}
          portfolioToggle={false}
        />
      )}

      {/* Upload */}
      {activeType === "upload" && (
        <UploadInput
          value={value}
          onChange={onChange}
          unitId={unitId}
          pageId={pageId}
          sectionIndex={sectionIndex}
        />
      )}

      {/* Voice */}
      {activeType === "voice" && (
        <VoiceInput
          value={value}
          onChange={onChange}
          unitId={unitId}
          pageId={pageId}
          sectionIndex={sectionIndex}
        />
      )}

      {/* Link */}
      {activeType === "link" && <LinkInput value={value} onChange={onChange} />}

      {/* Built-in response types */}
      {activeType === "decision-matrix" && (
        <DecisionMatrix value={value} onChange={onChange} />
      )}
      {activeType === "pmi" && (
        <PMIFramework value={value} onChange={onChange} />
      )}
      {activeType === "pairwise" && (
        <PairwiseComparison value={value} onChange={onChange} />
      )}
      {activeType === "trade-off-sliders" && (
        <TradeOffSliders value={value} onChange={onChange} />
      )}

      {/* Toolkit tools — data-driven rendering */}
      {responseType === "toolkit-tool" && toolId && (
        <ToolkitResponseInput
          toolId={toolId}
          challenge={toolChallenge}
          onChange={onChange}
        />
      )}

      {/* Project Spec v1 — lesson-page activity that walks students
          through an archetype picker (Toy/Architecture) + 7 questions.
          Canonical state lives in student_unit_project_specs (own table,
          own API). We thread onChange so the component can push a
          readable summary into student_progress.responses — that's what
          makes the spec discoverable on the marking page (tile detection
          keys off non-empty response strings). value is ignored: the
          component re-loads canonical state from its own API on mount. */}
      {responseType === "project-spec" && unitId && (
        <ProjectSpecResponse
          unitId={unitId}
          sectionIndex={sectionIndex}
          onChange={onChange}
        />
      )}

      {/* Project Spec v2 — Product Brief block (archetype-driven, 9 slots
          covering name, pitch, mechanism, primary+secondary material,
          scale, constraints, precedents, technical risks). Storage in
          student_unit_product_briefs. */}
      {responseType === "product-brief" && unitId && (
        <ProductBriefResponse
          unitId={unitId}
          sectionIndex={sectionIndex}
          onChange={onChange}
        />
      )}

      {/* Project Spec v2 — User Profile block (universal, 8 slots
          covering name, age band, context, problem, alternatives, unique
          value, optional photo, optional quote). Storage in
          student_unit_user_profiles. Slot 7 photos in the dedicated
          user-profile-photos bucket. */}
      {responseType === "user-profile" && unitId && (
        <UserProfileResponse
          unitId={unitId}
          sectionIndex={sectionIndex}
          onChange={onChange}
        />
      )}

      {/* Project Spec v2 — Success Criteria block (universal, 5 slots
          covering observable signal, measurement protocol, test setup,
          failure mode, iteration trigger). Storage in
          student_unit_success_criteria. */}
      {responseType === "success-criteria" && unitId && (
        <SuccessCriteriaResponse
          unitId={unitId}
          sectionIndex={sectionIndex}
          onChange={onChange}
        />
      )}

      {/* AG.1 — structured-prompts. LIS.C dispatch: when section opts in
          via promptsLayout="stepper", route to MultiQuestionResponse
          (one-question-at-a-time, criterion-coloured). Otherwise the
          existing all-at-once StructuredPromptsResponse. Both paths
          share the same persistence contract (composeContent +
          /api/student/portfolio + onSaveImmediate + kanban). */}
      {responseType === "structured-prompts" &&
        prompts &&
        unitId &&
        pageId &&
        (promptsLayout === "stepper" ? (
          <MultiQuestionResponse
            fields={prompts}
            unitId={unitId}
            pageId={pageId}
            sectionIndex={sectionIndex}
            requirePhoto={requirePhoto}
            autoCreateKanbanCardOnSave={autoCreateKanbanCardOnSave}
            savedValue={value}
            onChange={onChange}
            onSaveImmediate={onSaveResponseImmediate}
            onSaved={onStructuredPromptsSaved}
            enableIntegrityMonitoring={enableIntegrityMonitoring}
            onIntegrityUpdate={onIntegrityUpdate}
          />
        ) : (
          <StructuredPromptsResponse
            prompts={prompts}
            unitId={unitId}
            pageId={pageId}
            sectionIndex={sectionIndex}
            requirePhoto={requirePhoto}
            autoCreateKanbanCardOnSave={autoCreateKanbanCardOnSave}
            savedValue={value}
            onChange={onChange}
            onSaveImmediate={onSaveResponseImmediate}
            onSaved={onStructuredPromptsSaved}
            enableIntegrityMonitoring={enableIntegrityMonitoring}
            onIntegrityUpdate={onIntegrityUpdate}
          />
        ))}
    </div>
  );
}
