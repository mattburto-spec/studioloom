"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SaveIndicator, useAutoSave } from "../shared";
import { StepStrip } from "./StepStrip";
import { StarterChip } from "./StarterChip";
import { ProgressRing } from "./ProgressRing";
import {
  CRITERION_COLOR,
  CRITERION_HEX,
  type MultiQuestionField,
  type MultiQuestionValues,
} from "./types";

export type {
  Criterion,
  MultiQuestionField,
  MultiQuestionValues,
} from "./types";

type Props = {
  fields: MultiQuestionField[];
  /** Optional initial values (id → text). */
  initialValues?: MultiQuestionValues;
  /** Debounced auto-save (default ~700ms after last keystroke). */
  onSave?: (values: MultiQuestionValues) => void | Promise<void>;
  /** Final submit, only callable once all fields meet their targets. */
  onSubmit: (values: MultiQuestionValues) => void | Promise<void>;
  /** Optional className applied to the outer card. */
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
  fields,
  initialValues,
  onSave,
  onSubmit,
  className = "",
}: Props) {
  const [values, setValues] = useState<MultiQuestionValues>(() =>
    computeValues(fields, initialValues),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const { state: saveState, flushNow } = useAutoSave({
    value: values,
    onSave: onSave ?? (() => {}),
    disabled: !onSave,
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
    setValues((v) => ({ ...v, [field.id]: text }));
  };

  const insertStarter = (starter: string) => {
    const next = value.length === 0 ? starter : `${value.trimEnd()} ${starter}`;
    update(next.slice(0, field.max));
    textareaRef.current?.focus();
  };

  const goNext = async () => {
    if (!targetMet) return;
    if (isLast) {
      setSubmitting(true);
      try {
        await flushNow();
        await onSubmit(values);
      } finally {
        setSubmitting(false);
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
  };

  const accent = CRITERION_COLOR[field.criterion];
  const accentHex = CRITERION_HEX[field.criterion];

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
            }}
            onBlur={(e) => {
              e.currentTarget.parentElement!.style.boxShadow = "0 1px 2px rgba(15,14,12,0.03)";
              e.currentTarget.parentElement!.style.borderColor = "#E5E7EB";
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

        <SaveIndicator state={saveState} />

        <button
          type="button"
          onClick={() => void goNext()}
          disabled={isLast ? !allComplete || submitting : !targetMet}
          title={
            isLast
              ? !allComplete
                ? "Complete every step before submitting."
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
              (isLast ? !allComplete || submitting : !targetMet) ? "not-allowed" : "pointer",
            color: "white",
            background: isLast
              ? allComplete
                ? "var(--sl-primary)"
                : "#D1D5DB"
              : targetMet
              ? accent
              : "#D1D5DB",
            transition: "background 200ms ease, transform 150ms ease",
          }}
        >
          {isLast ? (submitting ? "Submitting…" : "Submit reflection") : "Continue →"}
        </button>
      </div>
    </div>
  );
}
