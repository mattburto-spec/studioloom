"use client";

import React from "react";
import { SaveIndicator, type SaveState } from "../shared";

type ButtonId = "bold" | "italic" | "ul" | "ol" | "quote";

type Props = {
  onCommand: (id: ButtonId) => void;
  saveState: SaveState;
  /** Map of button-id → "is the current selection inside this format" */
  active?: Partial<Record<ButtonId, boolean>>;
};

type Cfg = { id: ButtonId; label: string; icon: React.ReactNode };

const BUTTONS: Cfg[] = [
  {
    id: "bold",
    label: "Bold",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M4 2.5h4.25c1.65 0 3 1.07 3 2.65 0 1.05-.6 1.95-1.5 2.4 1.15.4 1.95 1.4 1.95 2.6 0 1.7-1.4 2.85-3.2 2.85H4V2.5Zm2.05 4.4h2.05c.85 0 1.45-.55 1.45-1.35 0-.8-.6-1.3-1.45-1.3H6.05V6.9Zm0 4.55h2.4c.95 0 1.55-.6 1.55-1.45s-.6-1.4-1.55-1.4H6.05v2.85Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "italic",
    label: "Italic",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 2.5h6V4h-2.1l-2.4 8H9.5v1.5h-6V12h2.1l2.4-8H6V2.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "ul",
    label: "Bulleted list",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="2.5" cy="4" r="1.2" fill="currentColor" />
        <circle cx="2.5" cy="8" r="1.2" fill="currentColor" />
        <circle cx="2.5" cy="12" r="1.2" fill="currentColor" />
        <rect x="6" y="3.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
        <rect x="6" y="7.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
        <rect x="6" y="11.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "ol",
    label: "Numbered list",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <text x="0.5" y="5.6" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="system-ui">1.</text>
        <text x="0.5" y="9.6" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="system-ui">2.</text>
        <text x="0.5" y="13.6" fontSize="4.5" fontWeight="700" fill="currentColor" fontFamily="system-ui">3.</text>
        <rect x="5.8" y="3.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
        <rect x="5.8" y="7.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
        <rect x="5.8" y="11.3" width="8" height="1.4" rx="0.7" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "quote",
    label: "Blockquote",
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M3 11V8.4c0-1.7 1-3 2.5-3.6V6c-.7.4-1 .9-1 1.6h1V11H3Zm5 0V8.4c0-1.7 1-3 2.5-3.6V6c-.7.4-1 .9-1 1.6h1V11H8Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
];

export function Toolbar({ onCommand, saveState, active = {} }: Props) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        background: "#F7F6F2",
        borderTopLeftRadius: "var(--sl-radius-2xl)",
        borderTopRightRadius: "var(--sl-radius-2xl)",
        borderBottom: "1px solid #EBE9E2",
        padding: "8px 12px",
      }}
      // Keep selection alive when toolbar buttons are clicked.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-1" role="toolbar" aria-label="Formatting">
        {BUTTONS.map((b) => {
          const isActive = active[b.id] ?? false;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onCommand(b.id)}
              aria-label={b.label}
              aria-pressed={isActive}
              title={b.label}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 0,
                background: isActive ? "white" : "transparent",
                color: isActive ? "var(--sl-fg-primary)" : "var(--sl-fg-body)",
                boxShadow: isActive ? "0 1px 2px rgba(15,14,12,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 150ms ease, color 150ms ease",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "white";
                  e.currentTarget.style.color = "var(--sl-fg-primary)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--sl-fg-body)";
                }
              }}
            >
              {b.icon}
            </button>
          );
        })}
      </div>

      <SaveIndicator state={saveState} />
    </div>
  );
}

export type { ButtonId };
