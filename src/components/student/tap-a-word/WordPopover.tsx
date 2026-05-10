"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { LookupState } from "./useWordLookup";
import { tapLog } from "./debug";

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
  /**
   * The button element the popover is anchored to. Element-not-rect lets
   * us re-measure on every render + on scroll/resize so the popover stays
   * glued to the word even when surrounding layout shifts (lazy images
   * loading, ScrollReveal animations, textareas growing). Round 2 fix
   * after Matt's "still a bit flaky" report on 4 May 2026.
   */
  anchorEl: HTMLElement;
  onClose: () => void;
  /** Optional retry handler — surfaced as a "Retry" button in the error state. */
  onRetry?: () => void;
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
  anchorEl,
  onClose,
  onRetry,
}: WordPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  // Live anchor position. Re-measured on every render plus on scroll +
  // resize. Stored in viewport coords (no scroll offset) because the
  // popover uses position: fixed.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Stable refs for handlers used inside the global listeners. The parent
  // (TappableText) recreates `onClose` on every render, so binding the
  // listener directly to it would tear down + rebuild the click-outside
  // listener on every state transition (loading→loaded). That churn is the
  // most likely cause of the "popover says 'Looking up…' then disappears"
  // bug Matt reported on 4 May 2026 — a stray mousedown landing in the
  // listener-rebuild gap, or a stale closure firing after a fast re-render.
  // With refs, the effect runs ONCE per mount and reads the latest onClose
  // / state values when the listener fires.
  const onCloseRef = useRef(onClose);
  const stateRef = useRef(state);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Round 24 (6 May 2026) — grace period after the lookup transitions to
  // a terminal state (loaded / error). Per Matt: "sometimes pops up for
  // a sec and then disappears". Cache hits resolve in <100ms, by which
  // time a student's cursor or finger may already be moving — the next
  // mousedown anywhere outside the popover dismisses it before they
  // read the definition. We stamp the moment we hit a terminal state
  // and gate the click-outside dismissal on a 500ms minimum-readable
  // window. Esc still dismisses immediately (deliberate user intent).
  const terminalAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (state === "loaded" || state === "error") {
      if (terminalAtRef.current === null) {
        terminalAtRef.current = Date.now();
      }
    } else {
      terminalAtRef.current = null;
    }
  }, [state]);

  // SSR safety: createPortal needs document — only render after mount.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Live anchor positioning. The previous round used a static
  // POPOVER_H_BUDGET = 280px to decide whether to flip above the word.
  // That over-flipped: a "Looking up…" popover is only ~50px tall, so a
  // word near the bottom of the viewport would get flipped 280px above
  // its true position even though the actual popover would have fit
  // below. Caught in Matt's 4 May screenshot — "starting" near the
  // bottom rendered with its popover up near the page header.
  //
  // Fix: measure the popover's REAL bounding rect (offsetHeight/Width)
  // after each render, and re-measure via ResizeObserver when the
  // popover's content grows (loading→loaded adds the definition +
  // example + optional image, ~doubling height). The observer attaches
  // in a separate effect that runs AFTER the popover element is in the
  // DOM (useLayoutEffect's first run computes initial pos with default
  // 60px estimate; once pos is set the popover renders; then the
  // observer effect attaches and re-measures with the actual size).
  const computePosition = useCallback(() => {
    if (!anchorEl) return;
    const r = anchorEl.getBoundingClientRect();
    const pop = popoverRef.current;
    // Defaults are sane for the very first paint before popoverRef
    // attaches. ResizeObserver will fire on mount and re-position with
    // real measurements, so this is just a transient initial estimate.
    const popH = pop?.offsetHeight || 60;
    const popW = pop?.offsetWidth || 320;
    const MARGIN = 8;
    let top = r.bottom + 6;
    let left = r.left;
    if (left + popW > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, window.innerWidth - popW - MARGIN);
    }
    // Flip above ONLY if the actual popover would overflow below.
    if (top + popH > window.innerHeight - MARGIN) {
      const flipped = r.top - 6 - popH;
      if (flipped > MARGIN) top = flipped;
      // else: leave below; browser lets it bleed past the edge, but
      // the popover stays anchored to the word visually.
    }
    setPos({ top, left });
  }, [anchorEl]);

  // Initial measurement — runs synchronously during layout so there's
  // no flash at (0,0). popoverRef.current is null on this first pass
  // because the popover hasn't rendered yet (it's gated on pos being
  // non-null). The default 60px estimate is fine for the loading state.
  useLayoutEffect(() => {
    computePosition();
  }, [computePosition]);

  // Scroll + resize listeners — keep the popover glued to the anchor
  // when surrounding layout shifts. Capture phase catches scrolling
  // inside any ancestor scroll container (chat panels, sidebars).
  useEffect(() => {
    if (!anchorEl) return;
    window.addEventListener("scroll", computePosition, true);
    window.addEventListener("resize", computePosition);
    return () => {
      window.removeEventListener("scroll", computePosition, true);
      window.removeEventListener("resize", computePosition);
    };
  }, [anchorEl, computePosition]);

  // ResizeObserver — re-position when the popover's OWN content grows.
  // Critical for the loading→loaded transition: the popover starts at
  // ~50px ("Looking up…") and grows to ~200-280px (definition + image).
  // Without this, a word near the viewport bottom gets positioned for
  // the small popover, then the loaded popover overflows offscreen.
  // Runs in useEffect (post-paint) so popoverRef.current is populated.
  // Re-runs on every pos change — that's a self-converging loop because
  // once the actual size is measured, computePosition produces the same
  // pos value and React skips the re-render.
  useEffect(() => {
    const node = popoverRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => computePosition());
    ro.observe(node);
    return () => ro.disconnect();
  }, [pos, computePosition]);

  // Reset image-failed flag when the image URL changes (new word tapped).
  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  // Diagnostic: log every mount + unmount of the popover. The 4-outcome
  // bug Matt reported on 11 May 2026 needs visibility into whether the
  // popover is unmounting or just rendering invisible. These two logs
  // pin that down: see "popover mount" without "popover unmount" → it's
  // there but invisible (positioning bug); see both → something is
  // genuinely killing it (click-outside / state reset / parent unmount).
  useEffect(() => {
    tapLog("popover mount", { word });
    return () => tapLog("popover unmount", { word });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Esc — runs ONCE per mount via stable ref.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        tapLog("dismiss via Esc", { word });
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on click outside the popover — runs ONCE per mount via stable ref.
  // Guards against dismissing while the lookup is still in-flight: students
  // shouldn't lose their definition mid-fetch from a stray click on the
  // page. They can still dismiss via Esc or by tapping outside once the
  // result has arrived.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Don't dismiss while loading — wait for the definition (or error) to land.
      if (stateRef.current === "loading") {
        tapLog("click-outside ignored: loading", { word });
        return;
      }
      // Round 24 — minimum 500ms readable window after entering a
      // terminal state. Defends against the cache-hit-and-cursor-
      // already-moved race that made the popover feel flaky.
      const terminalAt = terminalAtRef.current;
      if (terminalAt !== null && Date.now() - terminalAt < 500) {
        tapLog("click-outside ignored: grace window", {
          word,
          ms_since_terminal: Date.now() - terminalAt,
        });
        return;
      }
      const node = popoverRef.current;
      if (!node) {
        tapLog("click-outside ignored: no popover ref", { word });
        return;
      }
      if (e.target instanceof Node && !node.contains(e.target)) {
        const targetTag =
          e.target instanceof Element ? e.target.tagName : "unknown";
        tapLog("dismiss via click-outside", {
          word,
          target_tag: targetTag,
          state: stateRef.current,
        });
        onCloseRef.current();
      }
    };
    // Defer to next tick so the click that opened the popover doesn't immediately close it.
    const t = setTimeout(() => window.addEventListener("mousedown", onClick), 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  if (!mounted || typeof document === "undefined" || !pos) return null;

  // position: fixed → coords are viewport-relative. Independent of any
  // ancestor's transform/filter/will-change (which would otherwise create
  // a containing block and break absolute positioning math). This is the
  // structural fix for "popover floats off the word after layout shift" —
  // the useLayoutEffect above re-measures live on scroll/resize so it
  // tracks the anchor instead of decaying to a stale rect.
  const maxWidth = 320;

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Definition of ${word}`}
      className="fixed z-50 rounded-lg border border-gray-200 bg-white shadow-lg p-3 text-sm"
      style={{ top: pos.top, left: pos.left, maxWidth }}
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
      {/* Defense-in-depth: never render an empty popover. If state somehow
          reads as 'loaded' but definition is missing (shouldn't happen — the
          hook downgrades to error in that case — but if any future regression
          breaks that invariant, this prevents the popover blanking out and
          looking like a spontaneous dismissal). */}
      {state === "loaded" && !definition && (
        <div className="text-gray-500 text-xs italic">
          No definition available.
        </div>
      )}
      {state === "error" && (
        <div className="text-xs">
          <div className="text-red-600">
            {errorMessage || "Couldn't load definition."}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="mt-1.5 text-blue-600 hover:text-blue-800 underline underline-offset-2 font-medium"
            >
              Retry
            </button>
          )}
        </div>
      )}
      {/* Idle is the hook's pre-lookup state. The popover should never
          render with state==='idle' (handleClick fires lookup synchronously
          before React commits the new openWord), but if any future ordering
          regression breaks that invariant, show a friendly message instead
          of a blank popover that looks like a spontaneous dismissal. */}
      {state === "idle" && (
        <div className="text-gray-500 text-xs italic">Tap again to look up.</div>
      )}
    </div>,
    document.body
  );
}
