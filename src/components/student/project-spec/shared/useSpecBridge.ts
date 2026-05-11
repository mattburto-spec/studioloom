"use client";

/**
 * useSpecBridge — pushes a per-block summary string through the
 * standard ResponseInput `onChange` channel whenever the block's
 * canonical state changes.
 *
 * This is what makes Project Spec block submissions discoverable
 * on the marking page (which keys tile detection off non-empty
 * strings in student_progress.responses[tileId]).
 *
 * CRITICAL: onChange is captured via ref, NOT a dep array. The
 * parent (UnitPageView → ActivityCard → ResponseInput) creates a
 * new onResponseChange closure on every render — putting onChange
 * in the dep array caused an infinite render loop that froze the
 * entire lesson page (verified bug 2026-05-11, see PR #184).
 *
 * Pattern banked across the v2 block family.
 */

import { useEffect, useRef } from "react";

/**
 * @param state Block's canonical state (null while loading).
 * @param onChange Standard ResponseInput onChange — may be undefined.
 * @param buildSummary Pure function building the summary string from
 *   state. Return null to skip pushing (e.g. archetype not yet picked).
 */
export function useSpecBridge<S>(
  state: S | null,
  onChange: ((value: string) => void) | undefined,
  buildSummary: (state: S) => string | null,
): void {
  const onChangeRef = useRef(onChange);
  // Ref-sync effect runs every render so onChangeRef always holds the
  // latest closure. Intentionally no deps — must fire on every parent
  // re-render.
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Main effect fires only when state changes. onChange ref is read
  // through onChangeRef.current so changing onChange identity does NOT
  // cause this effect to re-fire (which would create a render loop).
  useEffect(() => {
    if (!state) return;
    const summary = buildSummary(state);
    if (summary !== null) onChangeRef.current?.(summary);
  }, [state]);
}
