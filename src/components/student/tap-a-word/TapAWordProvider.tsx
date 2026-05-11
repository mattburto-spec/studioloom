"use client";

/**
 * TapAWordProvider — global tap-a-word host (Round 26, 11 May 2026).
 *
 * Path A of Matt's "tap-a-word still buggy" fix. The previous architecture
 * owned popover state inside each TappableText instance, so when the
 * lesson page re-rendered and unmounted its activity-block subtree (the
 * actual root cause is in the lesson page render flow — Path B), every
 * TappableText was destroyed and so was its popover. Cascade observed
 * in prod 11 May: 18+ instances unmount + remount with new IDs on each
 * tap.
 *
 * This provider lives in the (student) layout — a stable parent that
 * does NOT unmount on lesson interactions. It owns:
 *   - the globally-current `openWord` (only one popover at a time)
 *   - the captured anchor rect + (optional) anchor element
 *   - the surrounding context sentence
 *   - the `useWordLookup` hook lifecycle
 *   - one rendered `<WordPopover>` instance for the whole app
 *
 * `<TappableText>` becomes a thin renderer that:
 *   - still gates button-vs-span on tapAWordEnabled (prevents tap from
 *     even being possible when teacher disabled)
 *   - on click, computes its own button rect + calls `useTapAWord().open(...)`
 *   - owns NO popover state — survives or unmounts independently of the
 *     popover, which now lives entirely in this provider's tree
 *
 * Trade-off (intentional): single popover globally. Tapping a second word
 * while one is open replaces the first with the second. This was already
 * the practical behaviour (per-instance popovers can't co-exist visually
 * since the design only supports one open) and matches every popover/
 * tooltip system at this level of the stack.
 *
 * Anchor behaviour: `useTapAWord().open()` accepts BOTH the anchor element
 * and a captured rect. The popover prefers the live element when it's
 * still connected to the DOM; falls back to the cached rect when the
 * element has detached (which is what was triggering the bug). Best-of-both
 * — live scroll/resize tracking when the parent is stable, graceful
 * degrade-to-static when the parent re-render destroys the button.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { useStudent } from "@/app/(student)/student-context";
import { useStudentSupportSettings } from "./useStudentSupportSettings";
import { useWordLookup } from "./useWordLookup";
import { WordPopover } from "./WordPopover";
import { tapLog } from "./debug";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TapAWordContextValue {
  /**
   * Open the popover for `word` anchored at `anchorEl`. Replaces any
   * existing popover (single-popover policy). Pass `contextSentence` for
   * polysemy disambiguation in the lookup. `classIdOverride` lets a
   * caller explicitly scope to a class — most callers should leave it
   * undefined and let the provider derive from URL/context.
   */
  open: (input: {
    word: string;
    anchorEl: HTMLElement;
    contextSentence?: string;
    classIdOverride?: string;
  }) => void;
  /** Programmatically close the popover. UI normally closes via Esc / click-outside. */
  close: () => void;
  /** Currently-open word (or null). TappableText reads this to underline the matching token. */
  openWord: string | null;
}

const noopContext: TapAWordContextValue = {
  open: () => {},
  close: () => {},
  openWord: null,
};

const TapAWordContext = createContext<TapAWordContextValue>(noopContext);

export function useTapAWord(): TapAWordContextValue {
  return useContext(TapAWordContext);
}

interface OpenState {
  word: string;
  anchorEl: HTMLElement | null;
  /** Cached rect at open time. Used when anchorEl has detached from DOM. */
  anchorRectFallback: DOMRect;
  contextSentence?: string;
  /** Set when caller explicitly passed classIdOverride. */
  classIdOverride?: string;
}

export function TapAWordProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<OpenState | null>(null);

  // Derive class/unit context from URL + StudentContext, same logic
  // TappableText used to do per-instance. unitId from /unit/[unitId]
  // routes; classId falls back to StudentContext when not on a unit
  // route (the layout's effectiveClassInfo follows URL too).
  const studentCtx = useStudent();
  const params = useParams();
  const rawParamUnitId = typeof params?.unitId === "string" ? params.unitId : undefined;
  const unitId =
    rawParamUnitId && UUID_RE.test(rawParamUnitId) ? rawParamUnitId : undefined;
  const classIdFromContext = studentCtx.classInfo?.id;
  const classIdResolved = open?.classIdOverride ?? (unitId ? undefined : classIdFromContext);

  const support = useStudentSupportSettings(classIdResolved, unitId);
  const lookup = useWordLookup({ classId: classIdResolved, unitId });

  // When openWord changes, fire the lookup. The hook handles in-flight
  // aborts internally so back-to-back taps don't pile up.
  useEffect(() => {
    if (open) {
      lookup.lookup(open.word, open.contextSentence);
    } else {
      lookup.reset();
    }
    // We deliberately don't depend on `lookup` (it's a fresh callback per
    // render); only on the open identity. The hook's lookup is stable
    // enough for this pattern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.word, open?.contextSentence]);

  const openHandler = useCallback<TapAWordContextValue["open"]>((input) => {
    const rect = input.anchorEl.getBoundingClientRect();
    tapLog("provider open", {
      word: input.word,
      classIdOverride: input.classIdOverride,
    });
    setOpen({
      word: input.word.toLowerCase(),
      anchorEl: input.anchorEl,
      anchorRectFallback: rect,
      contextSentence: input.contextSentence,
      classIdOverride: input.classIdOverride,
    });
  }, []);

  const closeHandler = useCallback(() => {
    tapLog("provider close", {});
    setOpen(null);
  }, []);

  const ctxValue = useMemo<TapAWordContextValue>(
    () => ({
      open: openHandler,
      close: closeHandler,
      openWord: open?.word ?? null,
    }),
    [openHandler, closeHandler, open?.word]
  );

  // Server-side gate too — if the teacher disabled tap-a-word for this
  // student, the provider refuses to render the popover even if a stale
  // TappableText instance manages to call open(). UI gating in
  // TappableText is the primary defense; this is belt-and-braces.
  const popoverAllowed =
    !support.loaded || (support.data?.tapAWordEnabled !== false);

  return (
    <TapAWordContext.Provider value={ctxValue}>
      {children}
      {open && popoverAllowed && (
        <WordPopover
          word={open.word}
          state={lookup.state}
          definition={lookup.definition}
          exampleSentence={lookup.exampleSentence}
          l1Translation={lookup.l1Translation}
          l1Target={lookup.l1Target}
          imageUrl={lookup.imageUrl}
          errorMessage={lookup.errorMessage}
          anchorEl={open.anchorEl ?? undefined}
          anchorRectFallback={open.anchorRectFallback}
          onClose={closeHandler}
          onRetry={lookup.retry}
        />
      )}
    </TapAWordContext.Provider>
  );
}
