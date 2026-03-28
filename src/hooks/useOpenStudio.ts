"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useOpenStudio — manages Open Studio state for a student within a unit.
 *
 * Handles:
 * - Polling Open Studio status
 * - Starting/ending sessions
 * - Periodic check-in timer (configurable interval)
 * - Drift detection timer (triggers after inactivity)
 * - Activity tracking (resets drift timer on meaningful activity)
 */

interface OpenStudioState {
  unlocked: boolean;
  status: "locked" | "unlocked" | "revoked";
  statusId?: string;
  teacherNote: string | null;
  checkInIntervalMin: number;
  unlockedAt: string | null;
  activeSession: ActiveSession | null;
}

interface ActiveSession {
  id: string;
  session_number: number;
  focus_area: string | null;
  started_at: string;
  ai_interactions: number;
  check_in_count: number;
  drift_flags: Array<{ level: string; message: string; timestamp: string }>;
}

interface CheckInResult {
  response: string | null;
  interactionType: string;
  driftFlag?: { level: string; message: string };
  silentFlag?: boolean;
}

interface UseOpenStudioReturn {
  /** Current Open Studio state */
  state: OpenStudioState | null;
  /** Whether data is loading */
  loading: boolean;
  /** Start an Open Studio session */
  startSession: (focusArea?: string) => Promise<void>;
  /** End the current session */
  endSession: (reflection?: string) => Promise<void>;
  /** Update the focus area */
  updateFocusArea: (focusArea: string) => Promise<void>;
  /** Log an activity (resets drift timer) */
  logActivity: (type: string, description: string) => void;
  /** Latest check-in message from AI */
  checkInMessage: string | null;
  /** Dismiss the check-in message */
  dismissCheckIn: () => void;
  /** Whether revocation just happened (show recalibrate message) */
  justRevoked: boolean;
}

const DRIFT_INACTIVITY_THRESHOLD_MIN = 10;

export function useOpenStudio(unitId: string | null): UseOpenStudioReturn {
  const [state, setState] = useState<OpenStudioState | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [justRevoked, setJustRevoked] = useState(false);

  // Timer refs
  const checkInTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const checkInCountRef = useRef(0);

  // Fetch Open Studio status
  const fetchStatus = useCallback(async () => {
    if (!unitId) return;

    try {
      const res = await fetch(`/api/student/open-studio/status?unitId=${unitId}`);
      if (!res.ok) return;
      const data: OpenStudioState = await res.json();

      setState((prev) => {
        // Detect revocation
        if (prev?.status === "unlocked" && data.status === "revoked") {
          setJustRevoked(true);
          setTimeout(() => setJustRevoked(false), 10000);
        }
        return data;
      });
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [unitId]);

  // Initial fetch + periodic refresh (pauses when tab hidden)
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      fetchStatus();
    }, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") fetchStatus(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchStatus]);

  // Trigger a check-in
  const triggerCheckIn = useCallback(
    async (type: "check_in" | "drift_check" | "documentation_nudge" | "alignment_check") => {
      if (!state?.activeSession || !unitId) return;

      const minutesSinceActivity = Math.round(
        (Date.now() - lastActivityRef.current) / 60_000
      );

      try {
        const res = await fetch("/api/student/open-studio/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.activeSession.id,
            unitId,
            interactionType: type,
            minutesSinceActivity,
          }),
        });

        if (!res.ok) return;
        const data: CheckInResult = await res.json();

        // Only show message to student if not a silent flag
        if (!data.silentFlag && data.response) {
          setCheckInMessage(data.response);
        }

        // If revoked due to drift, refresh status
        if (data.driftFlag?.level === "silent") {
          setTimeout(fetchStatus, 2000);
        }
      } catch {
        // Non-critical
      }
    },
    [state?.activeSession, unitId, fetchStatus]
  );

  // Clean up timers when session ends
  useEffect(() => {
    if (!state?.unlocked || !state.activeSession) {
      if (checkInTimerRef.current) clearInterval(checkInTimerRef.current);
      if (driftTimerRef.current) clearTimeout(driftTimerRef.current);
    }
    // Note: Periodic check-ins are disabled — they will be driven by the
    // student's journey plan (built during Discovery/Planning) rather than
    // a crude repeating timer. Drift detection (inactivity) remains active.
  }, [state?.unlocked, state?.activeSession]);

  // Set up drift detection (resets on activity)
  const resetDriftTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (driftTimerRef.current) clearTimeout(driftTimerRef.current);

    if (!state?.unlocked || !state?.activeSession) return;

    driftTimerRef.current = setTimeout(() => {
      triggerCheckIn("drift_check");
    }, DRIFT_INACTIVITY_THRESHOLD_MIN * 60 * 1000);
  }, [state?.unlocked, state?.activeSession, triggerCheckIn]);

  // Start session
  const startSession = useCallback(
    async (focusArea?: string) => {
      if (!unitId) return;

      try {
        const res = await fetch("/api/student/open-studio/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, focusArea }),
        });

        if (res.ok) {
          checkInCountRef.current = 0;
          lastActivityRef.current = Date.now();
          await fetchStatus();
        }
      } catch {
        // Non-critical
      }
    },
    [unitId, fetchStatus]
  );

  // End session
  const endSession = useCallback(
    async (reflection?: string) => {
      if (!state?.activeSession) return;

      try {
        await fetch("/api/student/open-studio/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.activeSession.id,
            reflection,
            end: true,
          }),
        });

        await fetchStatus();
      } catch {
        // Non-critical
      }
    },
    [state?.activeSession, fetchStatus]
  );

  // Update focus area
  const updateFocusArea = useCallback(
    async (focusArea: string) => {
      if (!state?.activeSession) return;

      try {
        await fetch("/api/student/open-studio/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: state.activeSession.id,
            focusArea,
          }),
        });
      } catch {
        // Non-critical
      }
    },
    [state?.activeSession]
  );

  // Log activity (resets drift timer)
  const logActivity = useCallback(
    (type: string, description: string) => {
      resetDriftTimer();

      if (!state?.activeSession) return;

      // Fire-and-forget
      fetch("/api/student/open-studio/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: state.activeSession.id,
          activityEntry: { type, description },
        }),
      }).catch(() => {});
    },
    [state?.activeSession, resetDriftTimer]
  );

  const dismissCheckIn = useCallback(() => {
    setCheckInMessage(null);
  }, []);

  return {
    state,
    loading,
    startSession,
    endSession,
    updateFocusArea,
    logActivity,
    checkInMessage,
    dismissCheckIn,
    justRevoked,
  };
}
