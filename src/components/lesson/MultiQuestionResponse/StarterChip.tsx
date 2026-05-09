"use client";

import React from "react";
import { CRITERION_HEX, type Criterion } from "./types";

type Props = {
  text: string;
  criterion: Criterion;
  onInsert: (text: string) => void;
};

/**
 * Rendered as a real <button> so keyboard users can Tab into the chips
 * and press Enter to insert. Hex tints come from CRITERION_HEX so we
 * can use rgba()/border directly — var() doesn't compose with rgba.
 */
export function StarterChip({ text, criterion, onInsert }: Props) {
  const hex = CRITERION_HEX[criterion];

  return (
    <button
      type="button"
      onClick={() => onInsert(text)}
      className="inline-flex items-center gap-1 transition"
      style={{
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: "var(--sl-font-sans)",
        color: hex,
        background: `${hex}10`,
        border: `1px solid ${hex}40`,
        borderRadius: "var(--sl-radius-pill)",
        padding: "6px 12px",
        whiteSpace: "nowrap",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = `${hex}1F`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = `${hex}10`;
      }}
    >
      <span style={{ opacity: 0.7 }}>+</span>
      {text}
    </button>
  );
}
