"use client";

import { useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
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
 * Bug 2 (28 Apr 2026): when mounted on a /unit/[unitId]/... route, auto-
 * detects unitId from URL params and passes it to the support-settings
 * + word-lookup hooks. Server then derives the (verified) classId via
 * class_units × class_students — fixes the multi-class case where
 * StudentContext's session-default classId was for a different class than
 * the lesson's. Explicit `classId` prop still wins.
 *
 * classId resolution priority:
 *   1. classId prop (explicit override)
 *   2. unitId from URL → server resolves the right class
 *   3. classInfo.id from StudentContext (session default)
 *
 * Untappable tokens (whitespace, punctuation, URLs, 1-char tokens,
 * pure numbers) render as plain spans preserving the original text.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // useParams returns a record of dynamic segments; on /unit/[unitId]/[pageId]
  // routes this is { unitId, pageId }. UUID-validate to ignore non-UUID
  // segment values that other routes might surface.
  const params = useParams();
  const rawParamUnitId = typeof params?.unitId === "string" ? params.unitId : undefined;
  const unitId = rawParamUnitId && UUID_RE.test(rawParamUnitId) ? rawParamUnitId : undefined;
  // classId prop wins (explicit caller); else fall back to the session
  // default. unitId, when present, lets the server cross-check + derive
  // the right class even if the session default points elsewhere.
  const classId = classIdProp ?? studentCtx.classInfo?.id;
  const support = useStudentSupportSettings(classId, unitId);
  const lookup = useWordLookup({ classId, unitId });
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
          imageUrl={lookup.imageUrl}
          errorMessage={lookup.errorMessage}
          anchorRect={anchorRect}
          onClose={handleClose}
        />
      )}
    </span>
  );
}
