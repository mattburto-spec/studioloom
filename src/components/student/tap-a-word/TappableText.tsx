"use client";

import { useMemo, useRef, useState } from "react";
import { tokenize } from "./tokenize";
import { useWordLookup } from "./useWordLookup";
import { WordPopover } from "./WordPopover";
import { useStudentSupportSettings } from "./useStudentSupportSettings";
import { useStudent } from "@/app/(student)/student-context";

/**
 * TappableText — wraps an educational text string and renders each
 * tappable word as a <button> that opens a definition popover.
 *
 * Phase 1A: plain strings, single popover, basic tokenization.
 * Phase 2A: + L1 translation slot in the popover.
 * Phase 2B: + audio buttons (English + L1 voice).
 * Phase 2.5: + teacher-controlled per-class disable. Reads
 * `tapAWordEnabled` from the support-settings hook on mount; if false,
 * renders ALL tokens as plain spans (no buttons, no hover) — students
 * see plain text, no signal that the feature exists.
 *
 * classId resolution: read from StudentContext (the student layout
 * provides classInfo). For mounts outside the student layout (e.g.
 * teacher preview, standalone tools), classInfo is null → resolver
 * runs per-student-only.
 *
 * Untappable tokens (whitespace, punctuation, URLs, 1-char tokens,
 * pure numbers) render as plain spans preserving the original text.
 */

export interface TappableTextProps {
  /** The text to render. */
  text: string;
  /**
   * Optional surrounding sentence for polysemy disambiguation.
   * Phase 1A passes this to the API but does not yet use it server-side
   * (context_hash is hardcoded to '' in the cache). Phase 2 will hash + use.
   */
  contextSentence?: string;
  /** Optional className applied to the wrapping span. */
  className?: string;
  /**
   * Optional explicit classId override — for mounts that have classId
   * available but aren't inside the student layout (rare). Most mounts
   * should rely on the StudentContext fallback.
   */
  classId?: string;
}

export function TappableText({ text, contextSentence, className, classId: classIdProp }: TappableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const studentCtx = useStudent();
  const classId = classIdProp ?? studentCtx.classInfo?.id;
  const support = useStudentSupportSettings(classId);
  const lookup = useWordLookup({ classId });
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // Phase 2.5 gate: while support settings are loading, render plain spans
  // (avoid flicker of buttons that might disappear). Once loaded, gate on
  // the resolved tapAWordEnabled flag. If disabled OR loading-failed, no
  // buttons — just plain text. Server enforces too.
  const tapEnabled =
    support.loaded && support.data ? support.data.tapAWordEnabled : false;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, word: string) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenWord(word);
    setAnchorRect(rect);
    lookup.lookup(word, contextSentence);
  }

  function handleClose() {
    setOpenWord(null);
    setAnchorRect(null);
    lookup.reset();
  }

  return (
    <span ref={containerRef} className={className}>
      {tokens.map((tok, i) => {
        // When tap-a-word is disabled (or still loading on mount), render
        // ALL tokens as plain spans — no visual signal that the feature exists.
        if (!tok.tappable || !tapEnabled) {
          return <span key={i}>{tok.text}</span>;
        }
        const isOpen = openWord !== null && openWord === tok.text.toLowerCase();
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(e, tok.text)}
            className={
              "inline border-0 bg-transparent p-0 m-0 font-inherit text-inherit cursor-pointer " +
              "hover:underline hover:decoration-dotted hover:decoration-gray-400 hover:underline-offset-2 " +
              (isOpen ? "underline decoration-dotted decoration-gray-500 underline-offset-2" : "")
            }
            aria-label={`Look up ${tok.text}`}
          >
            {tok.text}
          </button>
        );
      })}
      {openWord && anchorRect && (
        <WordPopover
          word={openWord}
          state={lookup.state}
          definition={lookup.definition}
          exampleSentence={lookup.exampleSentence}
          l1Translation={lookup.l1Translation}
          l1Target={lookup.l1Target}
          errorMessage={lookup.errorMessage}
          anchorRect={anchorRect}
          onClose={handleClose}
        />
      )}
    </span>
  );
}
