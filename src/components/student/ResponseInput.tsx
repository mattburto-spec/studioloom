"use client";

import { useState } from "react";
import type { ResponseType } from "@/types";
import { MonitoredTextarea } from "./MonitoredTextarea";
import type { IntegrityMetadata } from "./MonitoredTextarea";
import { RichTextEditor } from "./RichTextEditor";
import { DecisionMatrix } from "./DecisionMatrix";
import { PMIFramework } from "./PMIFramework";
import { PairwiseComparison } from "./PairwiseComparison";
import { TradeOffSliders } from "./TradeOffSliders";
import { UploadInput } from "./UploadInput";
import { VoiceInput } from "./VoiceInput";
import { LinkInput } from "./LinkInput";
import { ToolkitResponseInput } from "./ToolkitResponseInput";
import StructuredPromptsResponse from "./StructuredPromptsResponse";
import type { StructuredPromptsConfig } from "@/lib/structured-prompts/types";

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

      {/* Text input */}
      {(activeType === "text" ||
        (responseType === "text" &&
          (responseType as string) !== "multi")) &&
        (enableIntegrityMonitoring ? (
          <MonitoredTextarea
            id={`response-${sectionIndex}`}
            value={value}
            onChange={onChange}
            onIntegrityUpdate={onIntegrityUpdate}
            placeholder={placeholder}
            rows={4}
          />
        ) : (
          <RichTextEditor
            id={`response-${sectionIndex}`}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            rows={4}
          />
        ))}

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

      {/* AG.1 — structured-prompts (journal entry, multi-prompt response) */}
      {responseType === "structured-prompts" && prompts && unitId && pageId && (
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
        />
      )}
    </div>
  );
}
