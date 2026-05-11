"use client";

import { useEffect, useMemo, useRef } from "react";
import { tokenize } from "./tokenize";
import { useStudentSupportSettings } from "./useStudentSupportSettings";
import { useStudent } from "@/app/(student)/student-context";
import { useParams } from "next/navigation";
import { useTapAWord } from "./TapAWordProvider";
import { tapLog } from "./debug";

/**
 * TappableText — wraps an educational text string and renders each
 * tappable word as a <button> that asks the global TapAWordProvider to
 * open a definition popover.
 *
 * Round 26 (11 May 2026) — Path A architectural fix. Popover state
 * formerly lived inside this component, which meant any parent re-render
 * that destroyed TappableText also destroyed the popover. Confirmed in
 * prod 11 May: the lesson page re-renders entire activity-block tree on
 * every interaction (Path B is the open question). Lifted popover state
 * to a stable layout-level provider so the popover survives parent
 * re-renders.
 *
 * What's left in TappableText:
 *   - tokenize text into tappable / non-tappable spans
 *   - gate buttons-vs-spans on `tapAWordEnabled` (so the user literally
 *     cannot trigger an open() when teacher has disabled it)
 *   - on click, capture the button rect and call useTapAWord().open(...)
 *
 * What's gone:
 *   - openWord state
 *   - anchorEl state
 *   - useWordLookup call (popover host owns it)
 *   - WordPopover render (provider renders the singleton popover)
 *   - all the cleanup / dismiss-reason / unmount-survival defenses —
 *     no longer needed because the popover doesn't live here anymore
 *
 * Phase 2.5 + Bug 2 behaviour preserved: the provider derives classId
 * + unitId from the SAME inputs (URL params + StudentContext), so
 * per-class overrides + multi-class context disambiguation still work.
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
   * should rely on the StudentContext fallback (which the provider also
   * uses). Threaded directly to the provider's `classIdOverride`.
   */
  classId?: string;
}

export function TappableText({
  text,
  contextSentence,
  className,
  classId: classIdProp,
}: TappableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const studentCtx = useStudent();
  const params = useParams();
  const rawParamUnitId = typeof params?.unitId === "string" ? params.unitId : undefined;
  const unitId = rawParamUnitId && UUID_RE.test(rawParamUnitId) ? rawParamUnitId : undefined;
  // Same resolution priority used by the provider — when on a unit
  // route, defer to URL-derived classId; else fall back to session
  // default. classIdProp wins always.
  const classId = classIdProp ?? (unitId ? undefined : studentCtx.classInfo?.id);

  const support = useStudentSupportSettings(classId, unitId);
  const tap = useTapAWord();

  // Gate ON support being loaded AND tapAWordEnabled being true. While
  // loading, render plain spans (avoids button flicker). When disabled,
  // also plain spans — no signal to the student that the feature exists.
  const tapEnabled =
    support.loaded && support.data ? support.data.tapAWordEnabled : false;

  // Round 25 diagnostic logs — kept for Path B investigation. Will fire
  // every time the parent re-renders AND TappableText is recreated. If
  // the lifted-popover fix works, we can leave these in place to spot
  // future regressions in the underlying parent-render bug.
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
  useEffect(() => {
    tapLog("TappableText mount", {
      instance: instanceIdRef.current,
      textPreview: text.slice(0, 40),
    });
    return () =>
      tapLog("TappableText unmount", {
        instance: instanceIdRef.current,
        textPreview: text.slice(0, 40),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>, word: string) {
    e.stopPropagation();
    tapLog("tap", {
      word,
      instance: instanceIdRef.current,
      classId,
      unitId,
      tapEnabled,
      supportLoaded: support.loaded,
    });
    tap.open({
      word,
      anchorEl: e.currentTarget,
      contextSentence,
      classIdOverride: classIdProp,
    });
  }

  const openWord = tap.openWord;

  return (
    <span className={className}>
      {tokens.map((tok, i) => {
        if (!tok.tappable || !tapEnabled) {
          return <span key={i}>{tok.text}</span>;
        }
        const isOpen =
          openWord !== null && openWord === tok.text.toLowerCase();
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => handleClick(e, tok.text)}
            className={
              "inline border-0 bg-transparent p-0 m-0 font-inherit text-inherit cursor-pointer " +
              "hover:underline hover:decoration-dotted hover:decoration-gray-400 hover:underline-offset-2 " +
              (isOpen
                ? "underline decoration-dotted decoration-gray-500 underline-offset-2"
                : "")
            }
            aria-label={`Look up ${tok.text}`}
          >
            {tok.text}
          </button>
        );
      })}
    </span>
  );
}
