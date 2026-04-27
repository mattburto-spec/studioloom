"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LookupState } from "./useWordLookup";
import { useTextToSpeech } from "./useTextToSpeech";

/**
 * WordPopover — presentational. State is owned by the parent (TappableText).
 *
 * Phase 1A: definition + example.
 * Phase 2A: + L1 translation slot (rendered only when l1Translation is non-null
 * and l1Target is a non-'en' supported code).
 * Phase 2B: + audio buttons via browser SpeechSynthesis. Two micro buttons:
 * - 🔊 next to the word — pronounces the English word with an English voice
 * - 🔊 next to the translation — pronounces the L1 translation with an L1 voice
 * Each button is rendered only if the browser has a matching voice for that
 * language; otherwise it's omitted (per spec stop-trigger: don't break the
 * popover if a voice is missing).
 * Phase 2C will add image slot.
 *
 * Rendering: portaled to document.body so the popover escapes any
 * clipped-overflow ancestor (chat scroll containers, collapsed panels,
 * sidebar drawers — all common on the 5 mount surfaces).
 *
 * Positioning: absolute below the anchor rect in document coordinates.
 *
 * Closes on Esc, click outside, or caller's onClose. Audio cancels on close.
 */

export interface WordPopoverProps {
  word: string;
  state: LookupState;
  definition: string | null;
  exampleSentence: string | null;
  l1Translation: string | null;
  l1Target: string | null;
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
  errorMessage,
  anchorRect,
  onClose,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const tts = useTextToSpeech();

  // SSR safety: createPortal needs document — only render after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cancel any in-flight audio when the popover closes (caller invokes onClose,
  // OR Esc/click-outside triggers it indirectly).
  useEffect(() => {
    return () => tts.cancel();
  }, [tts]);

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

  // Audio button availability per Phase 2B spec stop-trigger:
  // only render the button if the browser has a matching voice.
  const showEnAudio = tts.supported && tts.voiceAvailable("en");
  const showL1Audio =
    tts.supported &&
    !!l1Translation &&
    !!l1Target &&
    l1Target !== "en" &&
    tts.voiceAvailable(l1Target);

  const audioBtnClass =
    "ml-1.5 inline-flex items-center justify-center rounded p-0.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition";

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Definition of ${word}`}
      className="absolute z-50 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm"
      style={{ top, left, maxWidth }}
    >
      <div className="font-semibold text-gray-900 mb-1 flex items-center">
        <span>{word}</span>
        {showEnAudio && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tts.speak(word, "en");
            }}
            className={audioBtnClass}
            aria-label={`Pronounce ${word}`}
            title="Pronounce"
          >
            <SpeakerIcon active={tts.state === "speaking"} />
          </button>
        )}
      </div>
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
              className="mt-1.5 text-base font-medium text-blue-700 flex items-center"
              lang={l1Target}
              aria-label={`Translation in ${l1Target}`}
            >
              <span>{l1Translation}</span>
              {showL1Audio && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    tts.speak(l1Translation, l1Target);
                  }}
                  className={audioBtnClass}
                  aria-label={`Pronounce translation in ${l1Target}`}
                  title="Pronounce translation"
                >
                  <SpeakerIcon active={tts.state === "speaking"} />
                </button>
              )}
            </div>
          )}
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
    </div>,
    document.body
  );
}

/**
 * Tiny inline speaker icon — utilitarian Phase 2B (no animation library).
 * Active state shows a small wave indicator.
 */
function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h2l3-2.5v9L5 10H3V6z" fill="currentColor" />
      {active && <path d="M11 5.5a3 3 0 010 5" />}
      {active && <path d="M13 4a5 5 0 010 8" />}
    </svg>
  );
}
