"use client";

import React from "react";

export type SaveState = "idle" | "typing" | "saving" | "saved" | "error";

type Props = {
  state: SaveState;
  className?: string;
};

const LABEL: Record<SaveState, string> = {
  idle: "",
  typing: "Unsaved",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed",
};

export function SaveIndicator({ state, className = "" }: Props) {
  if (state === "idle") return null;

  const tone =
    state === "saved"
      ? "var(--sl-accent-green)"
      : state === "error"
      ? "var(--sl-brand-pink)"
      : "var(--sl-fg-secondary)";

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        fontSize: "12px",
        fontWeight: 600,
        color: tone,
        fontFamily: "var(--sl-font-sans)",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "var(--sl-radius-pill)",
          background: tone,
          opacity: state === "saving" ? 0.5 : 1,
          animation: state === "saving" ? "save-pulse 900ms ease-in-out infinite" : undefined,
        }}
      />
      {LABEL[state]}
      <style>{`
        @keyframes save-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
