"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Per-activity tracking data stored alongside responses in student_progress.
 * Keys are prefixed with `_tracking_` to avoid collision with response keys.
 */
export interface ActivityTrackingData {
  /** Seconds the activity was visible/focused */
  time_spent_seconds: number;
  /** Number of times the response was modified (non-empty saves) */
  attempt_number: number;
  /** Effort signals computed client-side */
  effort_signals: {
    /** Total word count of the response */
    word_count: number;
    /** Number of distinct editing sessions (pauses > 10s between keystrokes) */
    editing_sessions: number;
    /** Whether the student revised a previous non-empty response */
    has_revisions: boolean;
    /** Ratio of time visible to time with input focus (0-1) — low = distracted */
    focus_ratio: number;
  };
  /** ISO timestamp of first interaction */
  first_interaction_at?: string;
  /** ISO timestamp of last interaction */
  last_interaction_at?: string;
}

interface ActivityTimerState {
  /** When the activity became visible (ms since epoch), or null if not visible */
  visibleSince: number | null;
  /** Accumulated visible time in seconds */
  accumulatedSeconds: number;
  /** When the activity last had focus/interaction */
  lastInteractionAt: number | null;
  /** First interaction timestamp */
  firstInteractionAt: number | null;
  /** Number of editing sessions (gaps > 10s) */
  editingSessions: number;
  /** Last keystroke timestamp for gap detection */
  lastKeystrokeAt: number | null;
  /** Previous response value (for revision detection) */
  previousValue: string;
  /** Number of times response was modified */
  attemptNumber: number;
  /** Whether a non-empty previous response was revised */
  hasRevisions: boolean;
  /** Pending response value waiting for commit (debounce timer) */
  pendingValue: string | null;
  /** Timer ID for debounced response commit */
  commitTimerId: NodeJS.Timeout | null;
}

const EDITING_GAP_MS = 10_000; // 10 seconds = new editing session
const MAX_VISIBLE_SECONDS = 3600; // Cap at 1 hour per activity
const FLUSH_INTERVAL_MS = 15_000; // Update tracking data every 15 seconds

/**
 * Hook for tracking per-activity engagement metrics.
 * Uses IntersectionObserver for visibility-based time tracking.
 *
 * Usage:
 * 1. Call `registerActivity(key)` for each activity section
 * 2. Pass `getObserverRef(key)` as ref to each activity's container div
 * 3. Call `recordInteraction(key)` on keystroke/input events
 * 4. Call `getTrackingPayload()` before saving to get the tracking data
 */
export function useActivityTracking(
  pageId: string,
  initialResponses: Record<string, string>
) {
  const timersRef = useRef<Map<string, ActivityTimerState>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const [trackingData, setTrackingData] = useState<Record<string, ActivityTrackingData>>({});
  const trackingDataRef = useRef(trackingData);
  trackingDataRef.current = trackingData;

  // Reset on page change
  useEffect(() => {
    // Clean up any pending timers from previous page
    Array.from(timersRef.current.values()).forEach((timer) => {
      if (timer.commitTimerId) {
        clearTimeout(timer.commitTimerId);
      }
    });

    timersRef.current = new Map();
    setTrackingData({});

    // Initialize timers from any initial response values (for revision detection)
    for (const [key, val] of Object.entries(initialResponses)) {
      if (key.startsWith("_tracking_")) continue; // skip tracking keys
      timersRef.current.set(key, {
        visibleSince: null,
        accumulatedSeconds: 0,
        lastInteractionAt: null,
        firstInteractionAt: null,
        editingSessions: 0,
        lastKeystrokeAt: null,
        previousValue: typeof val === "string" ? val : JSON.stringify(val ?? ""),
        attemptNumber: val ? 1 : 0, // If there's already a response, it's attempt 1
        hasRevisions: false,
        pendingValue: null,
        commitTimerId: null,
      });
    }
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set up IntersectionObserver
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const now = Date.now();
        for (const entry of entries) {
          const key = entry.target.getAttribute("data-activity-key");
          if (!key) continue;

          const timer = timersRef.current.get(key);
          if (!timer) continue;

          if (entry.isIntersecting) {
            // Activity became visible — start timer
            if (!timer.visibleSince) {
              timer.visibleSince = now;
            }
          } else {
            // Activity left viewport — accumulate time
            if (timer.visibleSince) {
              const elapsed = (now - timer.visibleSince) / 1000;
              timer.accumulatedSeconds = Math.min(
                timer.accumulatedSeconds + elapsed,
                MAX_VISIBLE_SECONDS
              );
              timer.visibleSince = null;
            }
          }
        }
      },
      { threshold: 0.3 } // 30% visible counts as "in view"
    );

    // Observe any elements already registered
    Array.from(elementMapRef.current.values()).forEach((el) => {
      observerRef.current!.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, [pageId]);

  // Periodic flush: compute current tracking data every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      flushTrackingData();
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Register an activity for tracking. Call once per activity key.
   */
  const registerActivity = useCallback((key: string) => {
    if (!timersRef.current.has(key)) {
      timersRef.current.set(key, {
        visibleSince: null,
        accumulatedSeconds: 0,
        lastInteractionAt: null,
        firstInteractionAt: null,
        editingSessions: 0,
        lastKeystrokeAt: null,
        previousValue: "",
        attemptNumber: 0,
        hasRevisions: false,
        pendingValue: null,
        commitTimerId: null,
      });
    }
  }, []);

  /**
   * Returns a callback ref for the activity container element.
   * Attach to the outermost div of each activity section.
   */
  const getObserverRef = useCallback((key: string) => {
    return (el: HTMLElement | null) => {
      const prev = elementMapRef.current.get(key);
      if (prev && observerRef.current) {
        observerRef.current.unobserve(prev);
      }

      if (el) {
        el.setAttribute("data-activity-key", key);
        elementMapRef.current.set(key, el);
        if (observerRef.current) {
          observerRef.current.observe(el);
        }
      } else {
        elementMapRef.current.delete(key);
      }
    };
  }, []);

  /**
   * Record that the student interacted with an activity (keystroke, click, etc.).
   * This drives editing session detection and focus ratio.
   */
  const recordInteraction = useCallback((key: string) => {
    const timer = timersRef.current.get(key);
    if (!timer) return;

    const now = Date.now();

    if (!timer.firstInteractionAt) {
      timer.firstInteractionAt = now;
    }
    timer.lastInteractionAt = now;

    // Detect new editing session (gap > 10s since last keystroke)
    if (timer.lastKeystrokeAt && (now - timer.lastKeystrokeAt) > EDITING_GAP_MS) {
      timer.editingSessions += 1;
    } else if (!timer.lastKeystrokeAt) {
      timer.editingSessions = 1; // First editing session
    }
    timer.lastKeystrokeAt = now;
  }, []);

  /**
   * Record that a response value changed via keystroke/input.
   * Queues a debounced commit that only fires after 2 seconds of no keystrokes.
   * This prevents incrementing attempt_number on every keystroke.
   */
  const recordResponseChange = useCallback((key: string, newValue: string) => {
    const timer = timersRef.current.get(key);
    if (!timer) return;

    // Queue the pending value
    timer.pendingValue = newValue;

    // Cancel any existing debounce timer
    if (timer.commitTimerId) {
      clearTimeout(timer.commitTimerId);
    }

    // Set up a new debounce timer: commit after 2 seconds of inactivity
    timer.commitTimerId = setTimeout(() => {
      const committedTimer = timersRef.current.get(key);
      if (!committedTimer || committedTimer.pendingValue === null) return;

      // Trim the values for comparison
      const newTrimmed = committedTimer.pendingValue.trim();
      const prevTrimmed = committedTimer.previousValue.trim();

      // Only increment attempt_number if the committed value differs from the previously committed value
      if (newTrimmed && newTrimmed !== prevTrimmed) {
        // If there was a previous non-empty committed value, this is a revision
        if (prevTrimmed) {
          committedTimer.hasRevisions = true;
        }
        committedTimer.attemptNumber += 1;
      }

      // Update previousValue to the new committed value
      committedTimer.previousValue = committedTimer.pendingValue;
      committedTimer.pendingValue = null;
      committedTimer.commitTimerId = null;
    }, 2000); // 2 second debounce
  }, []);

  /**
   * Compute and update tracking data for all activities.
   * Called periodically and before saves.
   */
  const flushTrackingData = useCallback(() => {
    const now = Date.now();
    const updated: Record<string, ActivityTrackingData> = {};

    Array.from(timersRef.current.entries()).forEach(([key, timer]) => {
      // Compute current accumulated time (including currently-visible time)
      let totalSeconds = timer.accumulatedSeconds;
      if (timer.visibleSince) {
        totalSeconds += (now - timer.visibleSince) / 1000;
      }
      totalSeconds = Math.min(totalSeconds, MAX_VISIBLE_SECONDS);

      // Compute focus ratio: time with interaction / time visible
      let focusRatio = 0;
      if (totalSeconds > 0 && timer.firstInteractionAt && timer.lastInteractionAt) {
        const interactionSpan = (timer.lastInteractionAt - timer.firstInteractionAt) / 1000;
        focusRatio = Math.min(interactionSpan / totalSeconds, 1);
      }

      // Word count from previous value (latest response)
      const wordCount = timer.previousValue.trim()
        ? timer.previousValue.trim().split(/\s+/).length
        : 0;

      updated[key] = {
        time_spent_seconds: Math.round(totalSeconds),
        attempt_number: timer.attemptNumber,
        effort_signals: {
          word_count: wordCount,
          editing_sessions: timer.editingSessions,
          has_revisions: timer.hasRevisions,
          focus_ratio: Math.round(focusRatio * 100) / 100,
        },
        ...(timer.firstInteractionAt && {
          first_interaction_at: new Date(timer.firstInteractionAt).toISOString(),
        }),
        ...(timer.lastInteractionAt && {
          last_interaction_at: new Date(timer.lastInteractionAt).toISOString(),
        }),
      };
    });

    setTrackingData(updated);
    return updated;
  }, []);

  /**
   * Get the tracking payload to merge into the save request.
   * Returns a record with `_tracking_<activityKey>` keys.
   */
  const getTrackingPayload = useCallback((): Record<string, ActivityTrackingData> => {
    const latest = flushTrackingData();
    const payload: Record<string, ActivityTrackingData> = {};
    for (const [key, data] of Object.entries(latest)) {
      // Only include activities that had some engagement
      if (data.time_spent_seconds > 0 || data.attempt_number > 0) {
        payload[`_tracking_${key}`] = data;
      }
    }
    return payload;
  }, [flushTrackingData]);

  return {
    registerActivity,
    getObserverRef,
    recordInteraction,
    recordResponseChange,
    getTrackingPayload,
    trackingData,
  };
}
