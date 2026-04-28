"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LookupState } from "./useWordLookup";

/**
 * WordPopover — presentational. State is owned by the parent (TappableText).
 *
 * Phase 1A: definition + example.
 * Phase 2A: + L1 translation slot (rendered only when l1Translation is non-null
 * and l1Target is a non-'en' supported code).
 * Phase 2B: speaker buttons added (English on word, L1 on translation) but
 * REMOVED 28 Apr 2026 per Matt's feedback — block-level read-aloud already
 * handles the English case, single-word L1 audio audience is too narrow to
 * justify the visual noise. `useTextToSpeech` hook preserved for future
 * surfaces; can be re-introduced here if learning support specialists later
 * say heritage-learner workflows want word-level L1 pronunciation.
 * Phase 2C: + image slot.
 *
 * Rendering: portaled to document.body so the popover escapes any
 * clipped-overflow ancestor (chat scroll containers, collapsed panels,
 * sidebar drawers — all common on the 5 mount surfaces).
 *
 * Positioning: absolute below the anchor rect in document coordinates.
 *
 * Closes on Esc, click outside, or caller's onClose.
 */

export interface WordPopoverProps {
  word: string;
  state: LookupState;
  definition: string | null;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
  /** Phase 2C: optional curated image URL. Slot hidden when null OR if the image fails to load. */
  imageUrl: string | null;
  errorMessage: string | null;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function WordPopover({
  word,
  state,
  definition,
  exampleSentence,
  l1Translation,
  l1Target,
  imageUrl,
  errorMessage,
  anchorRect,
  onClose,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  // SSR safety: createPortal needs document — only render after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset image-failed flag when the image URL changes (new word tapped).
  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

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

  if (!mounted || typeof document === "undefined") return null;

  // Position: below anchor, document coordinates.
  const top = anchorRect.bottom + window.scrollY + 6;
  const left = anchorRect.left + window.scrollX;
  const maxWidth = 320;

  return createPortal(
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
          {l1Translation && l1Target && l1Target !== "en" && (
            <div
              className="mt-1.5 text-base font-medium text-blue-700"
              lang={l1Target}
              aria-label={`Translation in ${l1Target}`}
            >
              {l1Translation}
            </div>
          )}
          {exampleSentence && (
            <div className="text-gray-500 italic mt-1.5 text-xs">{exampleSentence}</div>
          )}
          {imageUrl && !imageFailed && (
            <img
              src={imageUrl}
              alt={`Illustration of ${word}`}
              loading="lazy"
              className="mt-2 max-h-32 w-auto rounded border border-gray-200"
              onError={() => setImageFailed(true)}
            />
          )}
        </>
      )}
      {state === "error" && (
        <div className="text-red-600 text-xs">
          {errorMessage || "Couldn't load definition. Tap to try again."}
        </div>
      )}
    </div>,
    document.body
  );
}
