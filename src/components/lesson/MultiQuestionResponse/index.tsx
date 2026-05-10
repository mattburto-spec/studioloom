"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SaveIndicator, useAutoSave } from "../shared";
import { useIntegrityTracking } from "@/hooks/useIntegrityTracking";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import {
  composeContent,
  parseComposedContent,
  extractNextMove,
} from "@/lib/structured-prompts/payload";
import type {
  StructuredPrompt,
  StructuredPromptsConfig,
} from "@/lib/structured-prompts/types";
import { compressImage } from "@/lib/compress-image";
import {
  checkClientImage,
  IMAGE_MODERATION_MESSAGES,
} from "@/lib/content-safety/client-image-filter";
import { StepStrip } from "./StepStrip";
import { StarterChip } from "./StarterChip";
import { ProgressRing } from "./ProgressRing";
import {
  fieldColor,
  fieldHex,
  type Criterion,
  type MultiQuestionField,
  type MultiQuestionValues,
} from "./types";

export type {
  Criterion,
  MultiQuestionField,
  MultiQuestionValues,
} from "./types";

const DEFAULT_TARGET = 80;
const DEFAULT_MAX = 800;

/**
 * Adapter — accepts either an explicit MultiQuestionField[] (storybook /
 * standalone) OR a StructuredPromptsConfig (the activity-block authoring
 * shape). Maps StructuredPrompt → MultiQuestionField, defaulting target/
 * max from softCharCap when set, and carrying through optional criterion.
 */
function adaptFields(
  fields: MultiQuestionField[] | StructuredPromptsConfig,
): MultiQuestionField[] {
  return fields.map((f) => {
    if ("target" in f && "max" in f) {
      // Already a MultiQuestionField (legacy storybook shape).
      return f;
    }
    const sp = f as StructuredPrompt & { criterion?: Criterion };
    const cap = sp.softCharCap ?? DEFAULT_MAX;
    return {
      id: sp.id,
      label: sp.label,
      helper: sp.helper,
      placeholder: sp.placeholder,
      target: Math.min(DEFAULT_TARGET, cap),
      max: cap,
      criterion: sp.criterion,
    };
  });
}

type Props = {
  /** Either explicit MultiQuestionField[] (storybook / standalone) OR StructuredPromptsConfig (production via ResponseInput). The adapter normalises both. */
  fields: MultiQuestionField[] | StructuredPromptsConfig;

  // ── Storybook / standalone mode ───────────────────────────────────────
  /** Optional initial values (id → text). Used when not in production mode. */
  initialValues?: MultiQuestionValues;
  /** Debounced auto-save in storybook mode — fires onSave after 700ms idle. Ignored when unitId is provided. */
  onSave?: (values: MultiQuestionValues) => void | Promise<void>;
  /** Storybook-mode submit. Required when no production wiring. */
  onSubmit?: (values: MultiQuestionValues) => void | Promise<void>;

  // ── Production mode (LIS.C — set by ResponseInput) ─────────────────────
  /** When set with pageId+sectionIndex, the stepper persists via the existing structured-prompts contract (portfolio API + composeContent + kanban + integrity). */
  unitId?: string;
  pageId?: string;
  sectionIndex?: number;
  /** Existing composed-content value from student_progress.responses (parsed back into per-field values on mount). */
  savedValue?: string;
  /** Writes the composed-content string back to student_progress.responses[responseKey] (Narrative aggregator reads from there). */
  onChange?: (composedContent: string) => void;
  /** Bypass-debounce save — used so a navigate-within-2s doesn't drop the entry. */
  onSaveImmediate?: (composedContent: string) => Promise<void>;
  /** Called after a successful portfolio + progress save. */
  onSaved?: (saved: { content: string; nextMove: string | null }) => void;
  /** Photo upload — when true, student must attach a photo before submit. */
  requirePhoto?: boolean;
  /** Auto-create a Kanban backlog card from the "next" prompt's response. */
  autoCreateKanbanCardOnSave?: boolean;
  /** Academic integrity tracking — paste/keystroke/focus events feed IntegrityMetadata. */
  enableIntegrityMonitoring?: boolean;
  onIntegrityUpdate?: (metadata: IntegrityMetadata) => void;

  className?: string;
};

function computeValues(fields: MultiQuestionField[], initial?: MultiQuestionValues): MultiQuestionValues {
  const out: MultiQuestionValues = {};
  for (const f of fields) {
    out[f.id] = initial?.[f.id] ?? "";
  }
  return out;
}

export function MultiQuestionResponse({
  fields: rawFields,
  initialValues,
  onSave,
  onSubmit,
  unitId,
  pageId,
  sectionIndex,
  savedValue,
  onChange,
  onSaveImmediate,
  onSaved,
  requirePhoto = false,
  autoCreateKanbanCardOnSave = false,
  enableIntegrityMonitoring = false,
  onIntegrityUpdate,
  className = "",
}: Props) {
  const fields = useMemo(() => adaptFields(rawFields), [rawFields]);
  const isProduction = !!(unitId && pageId && sectionIndex !== undefined);

  // Production mode hydrates initial values from the saved composed text;
  // legacy mode uses the explicit initialValues prop.
  const [values, setValues] = useState<MultiQuestionValues>(() => {
    if (isProduction && savedValue && savedValue.trim().length > 0) {
      // savedValue is composed-content markdown; parse it back into per-id values.
      // adaptFields already produced the StructuredPromptsConfig shape internally.
      return parseComposedContent(rawFields as StructuredPromptsConfig, savedValue);
    }
    return computeValues(fields, initialValues);
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  const photoProvided = photoFile !== null;
  const photoMissingButRequired = isProduction && requirePhoto && !photoProvided;

  // Late-arriving savedValue sync (mirrors StructuredPromptsResponse round 30):
  // on a fresh page load, savedValue starts empty while usePageData fetches
  // /api/student/progress. If the user hasn't started typing yet, hydrate
  // when savedValue arrives.
  const userHasEditedRef = useRef(false);
  useEffect(() => {
    if (!isProduction) return;
    if (savedValue && savedValue.trim().length > 0 && !userHasEditedRef.current) {
      setValues(
        parseComposedContent(rawFields as StructuredPromptsConfig, savedValue),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedValue, isProduction]);

  // Storybook autosave (legacy mode only) — disabled in production where
  // the parent autosave path owns the persistence cadence.
  const { state: saveState, flushNow } = useAutoSave({
    value: values,
    onSave: onSave ?? (() => {}),
    disabled: isProduction || !onSave,
  });

  // Integrity tracking — production-mode only. getCombinedText returns
  // the COMPOSED content (across all fields) so the IntegrityMetadata
  // characterCount / snapshots reflect the full journal.
  const integrity = useIntegrityTracking({
    enabled: isProduction && enableIntegrityMonitoring,
    onIntegrityUpdate,
    getCombinedText: useCallback(() => {
      if (!isProduction) return "";
      return composeContent(rawFields as StructuredPromptsConfig, valuesRef.current);
    }, [isProduction, rawFields]),
  });

  const completion = useMemo(
    () => fields.map((f) => (values[f.id]?.length ?? 0) >= f.target),
    [fields, values],
  );
  const allComplete = completion.every(Boolean);

  const field = fields[activeIndex];
  const value = values[field.id] ?? "";
  const isLast = activeIndex === fields.length - 1;
  const targetMet = value.length >= field.target;

  // Refocus when stepping
  useEffect(() => {
    textareaRef.current?.focus();
  }, [activeIndex]);

  const update = (text: string) => {
    if (text.length > field.max) return;
    userHasEditedRef.current = true;
    setValues((v) => ({ ...v, [field.id]: text }));
    setErrorMsg(null);
  };

  const insertStarter = (starter: string) => {
    const next = value.length === 0 ? starter : `${value.trimEnd()} ${starter}`;
    update(next.slice(0, field.max));
    textareaRef.current?.focus();
  };

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setErrorMsg(null);
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  }

  /**
   * Production submit — moderates + uploads photo, composes content,
   * writes portfolio_entries via /api/student/portfolio, fires
   * onSaveImmediate (or onChange) with the composed text so
   * student_progress.responses gets it for the Narrative aggregator,
   * and optionally appends a Kanban backlog card.
   */
  async function productionSubmit() {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let mediaUrl: string | undefined;

      if (photoFile) {
        const imageCheck = await checkClientImage(photoFile);
        if (!imageCheck.ok) {
          setErrorMsg(IMAGE_MODERATION_MESSAGES.en);
          fetch("/api/safety/log-client-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "portfolio",
              flags: imageCheck.flags,
              layer: "client_image",
            }),
          }).catch(() => {});
          setSubmitting(false);
          return;
        }

        const compressed = await compressImage(photoFile);
        const formData = new FormData();
        formData.append("file", compressed);
        formData.append("unitId", unitId!);
        formData.append("pageId", pageId!);

        const uploadRes = await fetch("/api/student/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.url) {
          setErrorMsg("Photo upload failed. Try again.");
          setSubmitting(false);
          return;
        }
        mediaUrl = uploadData.url;
      }

      const content = composeContent(
        rawFields as StructuredPromptsConfig,
        values,
      );

      const portfolioRes = await fetch("/api/student/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId,
          type: "auto",
          content,
          mediaUrl,
          pageId,
          sectionIndex,
        }),
      });

      if (!portfolioRes.ok) {
        const errBody = await portfolioRes.json().catch(() => ({}));
        setErrorMsg(errBody.error || "Save failed. Try again.");
        setSubmitting(false);
        return;
      }

      const nextMove = extractNextMove(values);

      if (autoCreateKanbanCardOnSave && nextMove) {
        import("@/lib/unit-tools/kanban/client")
          .then(({ appendBacklogCard }) =>
            appendBacklogCard(unitId!, {
              title: nextMove,
              lessonLink: {
                unit_id: unitId!,
                page_id: pageId!,
                section_index: sectionIndex!,
              },
            }),
          )
          .catch((err) => {
            console.warn("[journal] kanban auto-create failed", err);
          });
      }

      // Flush integrity metrics so the parent's ref has the latest snapshot
      // before the lesson autosave fires.
      integrity.flush();

      // Write composed content to student_progress.responses so the
      // Narrative aggregator picks it up. Prefer onSaveImmediate (bypass
      // 2s debounce) so a navigate-within-2s doesn't drop the entry.
      if (onSaveImmediate) {
        try {
          await onSaveImmediate(content);
        } catch (err) {
          console.warn("[journal] immediate progress save failed", err);
          onChange?.(content);
        }
      } else {
        onChange?.(content);
      }

      onSaved?.({ content, nextMove });

      setSavedToast("Saved to portfolio");
      clearPhoto();

      setTimeout(() => setSavedToast(null), 2500);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Save failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const goNext = async () => {
    if (!targetMet && !isLast) return;
    if (isLast) {
      if (!allComplete) return;
      if (photoMissingButRequired) {
        setErrorMsg("Please attach a photo before submitting.");
        return;
      }
      if (isProduction) {
        await productionSubmit();
      } else if (onSubmit) {
        setSubmitting(true);
        try {
          await flushNow();
          await onSubmit(values);
        } finally {
          setSubmitting(false);
        }
      }
      return;
    }
    setActiveIndex((i) => i + 1);
  };

  const goBack = () => {
    if (activeIndex === 0) return;
    setActiveIndex((i) => i - 1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void goNext();
    }
    if (isProduction && enableIntegrityMonitoring) {
      integrity.handlers.onKeyDown(e);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isProduction && enableIntegrityMonitoring) {
      integrity.handlers.onPaste(e);
    }
  };

  const accent = fieldColor(field.criterion);
  const accentHex = fieldHex(field.criterion);

  return (
    <div
      ref={cardRef}
      className={className}
      style={{
        background: "var(--sl-surface-paper)",
        borderRadius: "var(--sl-radius-2xl)",
        padding: "32px",
        fontFamily: "var(--sl-font-sans)",
        color: "var(--sl-fg-body)",
        boxShadow: "0 1px 2px rgba(15,14,12,0.04), 0 8px 24px -12px rgba(15,14,12,0.08)",
      }}
    >
      <StepStrip
        fields={fields}
        activeIndex={activeIndex}
        complete={completion}
        onJump={(i) => setActiveIndex(i)}
      />

      <div
        key={`step-${activeIndex}`}
        className="mt-6 animate-slide-up"
        style={{ animationDuration: "280ms" }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex-shrink-0 inline-flex items-center justify-center text-white tnum"
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: accent,
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
            aria-label={field.criterion}
          >
            {String(activeIndex + 1).padStart(2, "0")}
          </div>

          <div className="flex-1 min-w-0">
            <h2
              id={`mq-${field.id}-label`}
              style={{
                fontSize: 22,
                fontWeight: 800,
                lineHeight: 1.25,
                color: "var(--sl-fg-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              {field.label.replace(/\?\s*$/, "")}
              <span style={{ color: accent }}>?</span>
            </h2>
            {field.helper && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: "var(--sl-fg-secondary)",
                  maxWidth: 640,
                }}
              >
                {field.helper}
              </p>
            )}
          </div>
        </div>

        <div
          className="mt-5 transition"
          style={{
            background: "white",
            border: "1px solid #E5E7EB",
            borderRadius: "var(--sl-radius-xl)",
            boxShadow: "0 1px 2px rgba(15,14,12,0.03)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => update(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={field.placeholder}
            aria-labelledby={`mq-${field.id}-label`}
            rows={4}
            style={{
              width: "100%",
              resize: "vertical",
              minHeight: 140,
              padding: "16px 18px",
              border: 0,
              outline: 0,
              background: "transparent",
              fontFamily: "var(--sl-font-sans)",
              fontSize: 15,
              lineHeight: 1.55,
              color: "var(--sl-fg-primary)",
              caretColor: accentHex,
              borderRadius: "var(--sl-radius-xl)",
            }}
            onFocus={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = `0 0 0 3px ${accentHex}26`;
              e.currentTarget.parentElement!.style.borderColor = accentHex;
              if (isProduction && enableIntegrityMonitoring) {
                integrity.handlers.onFocus();
              }
            }}
            onBlur={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = "0 1px 2px rgba(15,14,12,0.03)";
              e.currentTarget.parentElement!.style.borderColor = "#E5E7EB";
              if (isProduction && enableIntegrityMonitoring) {
                integrity.handlers.onBlur();
              }
            }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {field.starters?.map((starter) => (
              <StarterChip
                key={starter}
                text={starter}
                criterion={field.criterion}
                onInsert={insertStarter}
              />
            ))}
          </div>
          <ProgressRing
            value={value.length}
            target={field.target}
            max={field.max}
            color={accentHex}
          />
        </div>
      </div>

      {/* Photo upload (production-mode only, last step only) */}
      {isProduction && isLast && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label
            className="inline-flex items-center gap-2 cursor-pointer"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--sl-fg-secondary)",
              padding: "8px 14px",
              borderRadius: "var(--sl-radius-pill)",
              background: "white",
              border: "1px dashed #D1D5DB",
            }}
          >
            <span aria-hidden="true">📷</span>
            <span>{photoPreview ? "Change photo" : requirePhoto ? "Attach photo" : "Add photo (optional)"}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
          </label>
          {photoPreview && (
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreview}
                alt="Preview"
                style={{
                  height: 48,
                  width: 48,
                  borderRadius: 12,
                  objectFit: "cover",
                  border: "1px solid #E5E7EB",
                }}
              />
              <button
                type="button"
                onClick={clearPhoto}
                style={{
                  fontSize: 12,
                  color: "var(--sl-fg-secondary)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Remove
              </button>
            </div>
          )}
          {requirePhoto && !photoFile && (
            <span style={{ fontSize: 12, color: "var(--sl-brand-pink)" }}>
              required
            </span>
          )}
        </div>
      )}

      {/* Error + saved toast (production-mode only) */}
      {isProduction && errorMsg && (
        <div
          role="alert"
          className="mt-4"
          style={{
            padding: "10px 14px",
            borderRadius: "var(--sl-radius-md)",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#7A1530",
            fontSize: 13,
          }}
        >
          {errorMsg}
        </div>
      )}
      {isProduction && savedToast && (
        <div
          role="status"
          aria-live="polite"
          className="mt-4"
          style={{
            padding: "10px 14px",
            borderRadius: "var(--sl-radius-md)",
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            fontSize: 13,
          }}
        >
          ✓ {savedToast}
        </div>
      )}

      <div className="mt-7 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={activeIndex === 0}
          style={{
            background: "transparent",
            border: 0,
            padding: "10px 14px",
            fontSize: 13.5,
            fontWeight: 600,
            fontFamily: "var(--sl-font-sans)",
            color: activeIndex === 0 ? "#C5C2BB" : "var(--sl-fg-secondary)",
            cursor: activeIndex === 0 ? "not-allowed" : "pointer",
          }}
          aria-label="Go to previous step"
        >
          ← Back
        </button>

        {!isProduction && <SaveIndicator state={saveState} />}

        <button
          type="button"
          onClick={() => void goNext()}
          disabled={
            isLast
              ? !allComplete || submitting || photoMissingButRequired
              : !targetMet
          }
          title={
            isLast
              ? !allComplete
                ? "Complete every step before submitting."
                : photoMissingButRequired
                ? "Attach a photo to submit."
                : isProduction
                ? "Save to portfolio"
                : "Submit reflection"
              : !targetMet
              ? `Add a little more — aim for ${field.target} characters.`
              : "Continue"
          }
          style={{
            padding: "11px 20px",
            border: 0,
            borderRadius: "var(--sl-radius-pill)",
            fontFamily: "var(--sl-font-sans)",
            fontSize: 14,
            fontWeight: 700,
            cursor:
              (isLast
                ? !allComplete || submitting || photoMissingButRequired
                : !targetMet)
                ? "not-allowed"
                : "pointer",
            color: "white",
            background: isLast
              ? allComplete && !photoMissingButRequired
                ? "var(--sl-primary)"
                : "#D1D5DB"
              : targetMet
              ? accent
              : "#D1D5DB",
            transition: "background 200ms ease, transform 150ms ease",
          }}
        >
          {isLast
            ? submitting
              ? "Saving…"
              : isProduction
              ? "Save to portfolio"
              : "Submit reflection"
            : "Continue →"}
        </button>
      </div>
    </div>
  );
}
