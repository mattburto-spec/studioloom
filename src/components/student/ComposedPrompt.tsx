"use client";

/**
 * ComposedPrompt — renders the three Lever 1 slot fields with the hybrid
 * visual spec, falling back to <MarkdownPrompt> on legacy single-blob
 * `prompt` when no slots are populated.
 *
 * Brief: docs/projects/lesson-quality-lever-1-slot-fields.md (§Renderer composition)
 *
 * Hybrid spec (Option B from chat 4 May 2026):
 *   - framing       → muted lead paragraph (color: var(--le-ink-2) / gray-500-ish)
 *   - task          → regular body, default ink color
 *   - success_signal → 🎯-prefixed bold paragraph
 *   - empty slots simply don't render — no orphan whitespace
 *
 * Two visual variants:
 *   - "standard" (default) — used in the activity prompt header context.
 *     Sized for the page-level activity surface.
 *   - "compact"  — used inside content-only blocks (info / warning / tip
 *     callouts). Smaller font; relies on the parent card's color palette.
 *
 * For non-React consumers (TextToSpeech, PDF export), see
 * src/lib/lever-1/compose-prompt.ts → composedPromptText(section).
 */

import { MarkdownPrompt } from "@/components/student/MarkdownPrompt";
import { hasSlotFields } from "@/lib/lever-1/compose-prompt";
import type { ActivitySection } from "@/types";

interface ComposedPromptProps {
  section: ActivitySection;
  /** Tappable word lookup — passes through to MarkdownPrompt per slot. Default false. */
  tappable?: boolean;
  /** Visual variant. Default "standard". */
  variant?: "standard" | "compact";
}

const FRAMING_CLASS_STANDARD =
  "text-base md:text-lg text-gray-500 leading-relaxed";
const TASK_CLASS_STANDARD =
  "text-lg md:text-xl font-semibold text-gray-900 leading-snug";
const SIGNAL_CLASS_STANDARD =
  "text-base md:text-lg font-semibold text-gray-900 leading-snug";

const FRAMING_CLASS_COMPACT = "text-xs text-gray-500 leading-relaxed";
const TASK_CLASS_COMPACT = "text-sm text-gray-700 leading-relaxed";
const SIGNAL_CLASS_COMPACT = "text-sm font-semibold text-gray-900 leading-snug";

export function ComposedPrompt({
  section,
  tappable = false,
  variant = "standard",
}: ComposedPromptProps) {
  // Legacy fallback — when ALL three slots are null/empty, render the
  // single-blob `prompt` via the existing MarkdownPrompt unchanged.
  // Preserves behaviour for un-migrated activity_blocks + JSONB sections.
  if (!hasSlotFields(section)) {
    return <MarkdownPrompt text={section.prompt || ""} tappable={tappable} />;
  }

  const framing = (section.framing || "").trim();
  const task = (section.task || "").trim();
  const signal = (section.success_signal || "").trim();

  const isCompact = variant === "compact";
  const framingClass = isCompact ? FRAMING_CLASS_COMPACT : FRAMING_CLASS_STANDARD;
  const taskClass = isCompact ? TASK_CLASS_COMPACT : TASK_CLASS_STANDARD;
  const signalClass = isCompact ? SIGNAL_CLASS_COMPACT : SIGNAL_CLASS_STANDARD;

  return (
    <div className="space-y-3" data-testid="composed-prompt">
      {framing && (
        <div className={framingClass} data-testid="composed-prompt-framing">
          <MarkdownPrompt text={framing} tappable={tappable} />
        </div>
      )}
      {task && (
        <div className={taskClass} data-testid="composed-prompt-task">
          <MarkdownPrompt text={task} tappable={tappable} />
        </div>
      )}
      {signal && (
        <div
          className={`${signalClass} flex items-start gap-2`}
          data-testid="composed-prompt-success-signal"
        >
          <span aria-hidden="true" className="flex-shrink-0">
            🎯
          </span>
          <span className="flex-1">
            <MarkdownPrompt text={signal} tappable={tappable} />
          </span>
        </div>
      )}
    </div>
  );
}
