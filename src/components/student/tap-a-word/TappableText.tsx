"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { tokenize } from "./tokenize";
import { useWordLookup } from "./useWordLookup";
import { WordPopover } from "./WordPopover";
import { useStudentSupportSettings } from "./useStudentSupportSettings";
import { useStudent } from "@/app/(student)/student-context";
import { tapLog } from "./debug";

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
  // Resolution priority:
  //   1. classIdProp — explicit caller override, trust it.
  //   2. unitId from URL — let the server derive the verified classId;
  //      we deliberately skip context.classInfo here because the layout's
  //      unit-context fetch may not have settled yet, so context could
  //      briefly hold the (wrong) session-default classId for a different
  //      class. Server resolves correctly via the unitId path.
  //   3. context.classInfo — non-unit routes fall back to session default.
  const classId = classIdProp ?? (unitId ? undefined : studentCtx.classInfo?.id);
  const support = useStudentSupportSettings(classId, unitId);
  const lookup = useWordLookup({ classId, unitId });
  const [openWord, setOpenWord] = useState<string | null>(null);
  // Store the anchor ELEMENT, not its rect. Layout can shift while the
  // popover is open (lazy images load, ScrollReveal animates a sibling,
  // textareas expand) — re-measuring on each render + on scroll/resize
  // keeps the popover glued to the word instead of floating off into
  // empty space and looking like it spontaneously dismissed. Round 2 of
  // the popover-flakiness fix Matt reported on 4 May 2026.
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // Round 25 diagnostic — TappableText itself shouldn't mount/unmount
  // unless its parent unmounts it. Log instance lifecycle so we can
  // distinguish "popover unmounted because parent went away" from
  // "popover unmounted because state went null". Bug B (11 May 2026):
  // popover mount→unmount with no dismiss reason; suspected parent
  // re-render tearing TappableText down.
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
  useEffect(() => {
    tapLog("TappableText mount", {
      instance: instanceIdRef.current,
      textPreview: text.slice(0, 40),
    });
    return () => {
      tapLog("TappableText unmount", {
        instance: instanceIdRef.current,
        textPreview: text.slice(0, 40),
      });
      // Round 25 follow-up — stack trace on unmount so we can identify
      // WHICH parent commit is destroying us. React's commit phase
      // cleans up effects synchronously, so the call stack at this
      // point traces back to the parent's render that decided to
      // unmount this subtree. Look for "page" / "ScrollReveal" /
      // "MarkdownPrompt" / "ActivityCard" frames in the trace.
      try {
        if (
          typeof window !== "undefined" &&
          window.localStorage.getItem("tap-a-word-debug") === "1"
        ) {
          // eslint-disable-next-line no-console
          console.trace(
            `[tap-a-word] unmount stack — ${instanceIdRef.current}`
          );
        }
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Round 25 diagnostic — log every transition of (openWord, anchorEl)
  // so we can see WHO nulled them when the popover unmounts. If the
  // last log before "popover unmount" is "(null, null)" we know
  // handleClose ran (silent path); if there's no transition log at all
  // before unmount, the parent unmounted TappableText entirely.
  useEffect(() => {
    tapLog("TappableText popover-state changed", {
      instance: instanceIdRef.current,
      openWord,
      anchorElPresent: !!anchorEl,
    });
  }, [openWord, anchorEl]);

  // Phase 2.5 gate: while support settings are loading, render plain spans
  // (avoid flicker of buttons that might disappear). Once loaded, gate on
  // the resolved tapAWordEnabled flag. If disabled OR loading-failed, no
  // buttons — just plain text. Server enforces too.
  const tapEnabled =
    support.loaded && support.data ? support.data.tapAWordEnabled : false;

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, word: string) {
    e.stopPropagation();
    // Tap-same-word-no-refire: if the popover is already showing this exact
    // word, treat the click as a no-op rather than tearing down state and
    // refiring. Avoids a React state-thrash that briefly flashes the
    // "Looking up…" message when the cached entry is already there.
    if (openWord !== null && openWord.toLowerCase() === word.toLowerCase()) {
      tapLog("re-tap suppressed", { word });
      return;
    }
    setOpenWord(word);
    setAnchorEl(e.currentTarget);
    lookup.lookup(word, contextSentence);
    tapLog("tap", {
      word,
      classId,
      unitId,
      tapEnabled,
      supportLoaded: support.loaded,
      supportData: support.data,
    });
  }

  function handleClose() {
    setOpenWord(null);
    setAnchorEl(null);
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
      {openWord && anchorEl && (
        <WordPopover
          word={openWord}
          state={lookup.state}
          definition={lookup.definition}
          exampleSentence={lookup.exampleSentence}
          l1Translation={lookup.l1Translation}
          l1Target={lookup.l1Target}
          imageUrl={lookup.imageUrl}
          errorMessage={lookup.errorMessage}
          anchorEl={anchorEl}
          onClose={handleClose}
          onRetry={lookup.retry}
        />
      )}
    </span>
  );
}
