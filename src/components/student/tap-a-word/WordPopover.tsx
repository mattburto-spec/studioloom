"use client";

import { useEffect, useRef } from "react";
import type { LookupState } from "./useWordLookup";

/**
 * WordPopover — presentational. State is owned by the parent (TappableText).
 *
 * Phase 1A: definition + example only. Phase 2 will add L1 translation,
 * audio button, and image slot. Keep the structure flat so additional
 * slots can be inserted without restructuring.
 *
 * Positioning: absolute below the anchor rect. Caller passes anchorRect
 * (in viewport coordinates). The popover positions itself in document
 * coordinates with a small offset.
 *
 * Closes on:
 *  - Esc key
 *  - Click outside
 *  - Caller calls onClose for any other reason
 */

export interface WordPopoverProps {
  word: string;
  state: LookupState;
  definition: string | null;
  exampleSentence: string | null;
  errorMessage: string | null;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function WordPopover({
  word,
  state,
  definition,
  exampleSentence,
  errorMessage,
  anchorRect,
  onClose,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on Esc.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Close on click outside the popover.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const node = popoverRef.current;
      if (!node) return;
      if (e.target instanceof Node && !node.contains(e.target)) {
        onClose();
      }
    };
    // Defer to next tick so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onClick);
    };
  }, [onClose]);

  // Position: below anchor, document coordinates.
  const top = anchorRect.bottom + window.scrollY + 6;
  const left = anchorRect.left + window.scrollX;
  const maxWidth = 320;

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Definition of ${word}`}
      className="absolute z-50 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm"
      style={{ top, left, maxWidth }}
    >
      <div className="font-semibold text-gray-900 mb-1">{word}</div>
      {state === "loading" && (
        <div className="text-gray-500 italic" aria-live="polite">
          Looking up…
        </div>
      )}
      {state === "loaded" && definition && (
        <>
          <div className="text-gray-800">{definition}</div>
          {exampleSentence && (
            <div className="text-gray-500 italic mt-1.5 text-xs">{exampleSentence}</div>
          )}
        </>
      )}
      {state === "error" && (
        <div className="text-red-600 text-xs">
          {errorMessage || "Couldn't load definition. Tap to try again."}
        </div>
      )}
    </div>
  );
}
