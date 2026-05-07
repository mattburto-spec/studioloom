/**
 * AG.2.3b — Kanban board orchestration hook (pure logic in .ts per Lesson #71).
 *
 * Wraps:
 *   - useReducer over kanbanReducer (state + actions)
 *   - Initial fetch via loadKanbanState
 *   - Debounced auto-save via saveKanbanState (only when state is "dirty")
 *   - Save error surfacing
 *
 * The hook returns a clean interface for the React component to consume:
 *   { state, status, dispatch, save: { lastSavedAt, error, isDirty, isSaving } }
 *
 * Per Lesson #38: tests assert specific transitions (idle → loading → ready,
 * dirty flag flipping, debounce behaviour). Time-dependent paths use
 * injectable timers + clock for stable asserts.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  kanbanReducer,
  type KanbanAction,
  type KanbanClock,
} from "@/lib/unit-tools/kanban/reducer";
import { emptyKanbanState, type KanbanState } from "@/lib/unit-tools/kanban/types";
import {
  loadKanbanState,
  saveKanbanState,
  KanbanApiError,
} from "@/lib/unit-tools/kanban/client";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface SaveState {
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: string | null;
  error: string | null;
}

const SAVE_DEBOUNCE_MS = 800;

export interface UseKanbanBoardOptions {
  unitId: string;
  /** Optional: provide a clock for deterministic tests. */
  clock?: KanbanClock;
}

export interface UseKanbanBoardResult {
  state: KanbanState;
  loadStatus: LoadStatus;
  loadError: string | null;
  save: SaveState;
  dispatch: (action: KanbanAction) => void;
  /** Manually trigger an immediate save (cancels pending debounce). */
  flushSave: () => Promise<void>;
}

export function useKanbanBoard(
  options: UseKanbanBoardOptions
): UseKanbanBoardResult {
  const { unitId, clock } = options;

  // We dispatch through this wrapper so we can apply the injected clock
  // (and downstream tests can drive deterministic timestamps).
  const [state, baseDispatch] = useReducer(
    (s: KanbanState, a: KanbanAction) => kanbanReducer(s, a, clock),
    emptyKanbanState()
  );

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [save, setSave] = useState<SaveState>({
    isSaving: false,
    isDirty: false,
    lastSavedAt: null,
    error: null,
  });

  // Track most recent state for the debounced save callback
  const stateRef = useRef(state);
  stateRef.current = state;

  // Track whether we're inside the initial load (don't auto-save those)
  const initialLoadingRef = useRef(true);

  // Debounce timer
  const saveTimerRef = useRef<number | null>(null);

  // Load on mount + when unitId changes
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
    initialLoadingRef.current = true;
    loadKanbanState(unitId)
      .then((result) => {
        if (cancelled) return;
        baseDispatch({ type: "loadState", state: result.kanban });
        setLoadStatus("ready");
        // Defer the "now we can autosave" flip to next microtask so the
        // loadState dispatch above doesn't trigger an immediate save
        Promise.resolve().then(() => {
          initialLoadingRef.current = false;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadStatus("error");
        setLoadError(
          err instanceof KanbanApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load Kanban"
        );
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  const flushSave = useCallback(async (): Promise<void> => {
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const snapshot = stateRef.current;
    setSave((s) => ({ ...s, isSaving: true, error: null }));
    try {
      const result = await saveKanbanState(unitId, snapshot);
      // Round 41 (7 May 2026) — race fix. The server-canonical
      // loadState dispatch below was clobbering any drag that landed
      // DURING the save's network roundtrip. Symptom: card "flies
      // back" to its pre-snapshot position because the server response
      // doesn't know about the in-flight local change. Only apply the
      // server response if state hasn't changed since snapshot.
      // useReducer returns a new object reference on every dispatch,
      // so reference inequality is a reliable change signal.
      const stateChangedDuringSave = stateRef.current !== snapshot;
      if (!stateChangedDuringSave) {
        // Replace state with server canonical (counts re-derived server-side)
        baseDispatch({ type: "loadState", state: result.kanban });
      }
      setSave({
        isSaving: false,
        // Stay dirty if a change landed during save — the dispatch
        // that made the change already scheduled a follow-up save
        // via the debounce timer.
        isDirty: stateChangedDuringSave,
        lastSavedAt: new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof KanbanApiError
          ? err.details.length > 0
            ? `${err.message}: ${err.details.join("; ")}`
            : err.message
          : err instanceof Error
            ? err.message
            : "Save failed";
      setSave((s) => ({ ...s, isSaving: false, error: msg }));
    }
  }, [unitId]);

  // Wrapped dispatch — schedules a debounced save on every action that
  // can mutate persistent state (loadState is internal-only).
  const dispatch = useCallback(
    (action: KanbanAction) => {
      baseDispatch(action);
      if (action.type === "loadState") return;
      if (initialLoadingRef.current) return;

      setSave((s) => ({ ...s, isDirty: true }));

      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        flushSave();
      }, SAVE_DEBOUNCE_MS) as unknown as number;
    },
    [flushSave]
  );

  // Cleanup pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    state,
    loadStatus,
    loadError,
    save,
    dispatch,
    flushSave,
  };
}
