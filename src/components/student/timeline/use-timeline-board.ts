/**
 * AG.3.4 — Timeline board orchestration hook (pure logic per Lesson #71).
 *
 * Wraps:
 *   - useReducer over timelineReducer
 *   - Initial fetch via loadTimelineState
 *   - Debounced autosave via saveTimelineState (only when state is dirty)
 *
 * Mirrors useKanbanBoard exactly for consistency.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  timelineReducer,
  type TimelineAction,
  type TimelineClock,
} from "@/lib/unit-tools/timeline/reducer";
import {
  emptyTimelineState,
  type TimelineState,
} from "@/lib/unit-tools/timeline/types";
import {
  loadTimelineState,
  saveTimelineState,
  TimelineApiError,
} from "@/lib/unit-tools/timeline/client";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface SaveState {
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: string | null;
  error: string | null;
}

const SAVE_DEBOUNCE_MS = 800;

export interface UseTimelineBoardOptions {
  unitId: string;
  clock?: TimelineClock;
}

export interface UseTimelineBoardResult {
  state: TimelineState;
  loadStatus: LoadStatus;
  loadError: string | null;
  save: SaveState;
  dispatch: (action: TimelineAction) => void;
  flushSave: () => Promise<void>;
}

export function useTimelineBoard(
  options: UseTimelineBoardOptions
): UseTimelineBoardResult {
  const { unitId, clock } = options;

  const [state, baseDispatch] = useReducer(
    (s: TimelineState, a: TimelineAction) => timelineReducer(s, a, clock),
    emptyTimelineState()
  );

  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>({
    isSaving: false,
    isDirty: false,
    lastSavedAt: null,
    error: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const initialLoadingRef = useRef(true);
  const saveTimerRef = useRef<number | null>(null);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
    initialLoadingRef.current = true;
    loadTimelineState(unitId)
      .then((result) => {
        if (cancelled) return;
        baseDispatch({ type: "loadState", state: result.timeline });
        setLoadStatus("ready");
        Promise.resolve().then(() => {
          initialLoadingRef.current = false;
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadStatus("error");
        setLoadError(
          err instanceof TimelineApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load Timeline"
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
      const result = await saveTimelineState(unitId, snapshot);
      baseDispatch({ type: "loadState", state: result.timeline });
      setSave({
        isSaving: false,
        isDirty: false,
        lastSavedAt: new Date().toISOString(),
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof TimelineApiError
          ? err.details.length > 0
            ? `${err.message}: ${err.details.join("; ")}`
            : err.message
          : err instanceof Error
            ? err.message
            : "Save failed";
      setSave((s) => ({ ...s, isSaving: false, error: msg }));
    }
  }, [unitId]);

  const dispatch = useCallback(
    (action: TimelineAction) => {
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

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return { state, loadStatus, loadError, save, dispatch, flushSave };
}
