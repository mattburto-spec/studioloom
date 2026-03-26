"use client";

import { useReducer, useCallback, useEffect, useRef, useState } from "react";
import type {
  DiscoveryProfile,
  DiscoveryState,
  DiscoveryMode,
  DiscoveryStation,
  AgeBand,
} from "@/lib/discovery/types";
import { createEmptyProfile } from "@/lib/discovery/types";
import { detectAgeBand } from "@/lib/discovery/content";
import {
  discoveryReducer,
  createInitialMachineState,
  canAdvance,
  getResumeState,
  getStationFromState,
  getTotalProgress,
  getStationProgress,
  type DiscoveryMachineState,
  type DiscoveryAction,
  STATION_META,
} from "@/lib/discovery/state-machine";

/**
 * useDiscoverySession — manages the full Discovery Engine lifecycle.
 *
 * Responsibilities:
 * - Load or create a session from the API on mount
 * - Drive the state machine (useReducer)
 * - Auto-save profile to DB on every state transition
 * - Debounced saves for continuous inputs (sliders, text)
 * - Resume from last completed station on page refresh
 * - Expose navigation (next/back) with guard checking
 *
 * Auto-save triggers:
 * - Every state transition (immediate)
 * - Text prompt submission (immediate)
 * - Card sort completion (immediate)
 * - Slider value change (debounced 2s)
 * - Scene click (immediate)
 * - Binary pair answer (immediate)
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 4
 */

// ─── Types ──────────────────────────────────────────────────────

interface UseDiscoverySessionOptions {
  unitId: string;
  classId?: string | null;
  ageBand: AgeBand;
  mode: DiscoveryMode;
}

interface UseDiscoverySessionReturn {
  /** Current machine state */
  machine: DiscoveryMachineState;
  /** The student's profile (accumulated data) */
  profile: DiscoveryProfile;
  /** Is the session loading from DB? */
  loading: boolean;
  /** Last save status */
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Session ID (null until created/loaded) */
  sessionId: string | null;
  /** Overall journey progress (0-100) */
  totalProgress: number;
  /** Current station progress (0-100) */
  stationProgress: number;
  /** Current station metadata */
  currentStationMeta: (typeof STATION_META)[number] | null;
  /** Whether the student can advance from current step */
  canAdvanceFromCurrent: boolean;

  // ─── Navigation ─────────────────────────────────────────────
  /** Advance to the next step (checks guards) */
  next: () => void;
  /** Go back one step */
  back: () => void;
  /** Jump to a specific step (for resume/debug) */
  goToStep: (step: DiscoveryState) => void;
  /** Mark a station as completed */
  completeStation: (station: DiscoveryStation) => void;
  /** Mark the entire journey as complete */
  completeJourney: () => void;

  // ─── Profile Updates ────────────────────────────────────────
  /** Update a station's data. Triggers auto-save. */
  updateStation: <K extends keyof DiscoveryProfile>(
    key: K,
    data: DiscoveryProfile[K],
  ) => void;
  /** Update multiple profile fields at once. Triggers auto-save. */
  updateProfile: (updates: Partial<DiscoveryProfile>) => void;
  /** Debounced profile update for continuous inputs (sliders, live text). 2s debounce. */
  updateProfileDebounced: (updates: Partial<DiscoveryProfile>) => void;
  /** Force an immediate save (bypasses debounce) */
  saveNow: () => Promise<void>;
}

// ─── Save debounce constants ────────────────────────────────────

const DEBOUNCE_MS = 2000; // For continuous inputs (sliders)
const SAVE_IMMEDIATE_DELAY = 100; // Tiny delay to batch rapid state changes

// ─── Hook Implementation ────────────────────────────────────────

export function useDiscoverySession({
  unitId,
  classId,
  ageBand,
  mode,
}: UseDiscoverySessionOptions): UseDiscoverySessionReturn {
  // ─── Core State ────────────────────────────────────────────
  const [machine, dispatch] = useReducer(
    discoveryReducer,
    createInitialMachineState(),
  );
  const [profile, setProfile] = useState<DiscoveryProfile>(() =>
    createEmptyProfile("", unitId, classId ?? null, ageBand, mode),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  // Refs for save logic (avoid stale closures)
  const profileRef = useRef(profile);
  const machineRef = useRef(machine);
  const sessionIdRef = useRef(sessionId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMountedRef = useRef(true);
  const initializedRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  useEffect(() => {
    machineRef.current = machine;
  }, [machine]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (debouncedSaveTimerRef.current)
        clearTimeout(debouncedSaveTimerRef.current);
    };
  }, []);

  // ─── API Helpers ───────────────────────────────────────────

  const saveToServer = useCallback(
    async (
      sid: string,
      state: DiscoveryState,
      prof: DiscoveryProfile,
      completed = false,
    ) => {
      try {
        setSaveStatus("saving");
        const res = await fetch("/api/discovery/session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sid,
            state,
            profile: prof,
            completed,
          }),
        });
        if (!res.ok) {
          console.error("[Discovery] Save failed:", res.status);
          if (isMountedRef.current) setSaveStatus("error");
          return;
        }
        if (isMountedRef.current) setSaveStatus("saved");
      } catch (err) {
        console.error("[Discovery] Save error:", err);
        if (isMountedRef.current) setSaveStatus("error");
      }
    },
    [],
  );

  const triggerSave = useCallback(
    (immediate = false) => {
      const sid = sessionIdRef.current;
      if (!sid) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      const delay = immediate ? SAVE_IMMEDIATE_DELAY : DEBOUNCE_MS;

      saveTimerRef.current = setTimeout(() => {
        saveToServer(
          sid,
          machineRef.current.current,
          profileRef.current,
        );
      }, delay);
    },
    [saveToServer],
  );

  // ─── Load or Create Session on Mount ───────────────────────

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    async function init() {
      try {
        // Try to load an existing session
        const loadRes = await fetch(
          `/api/discovery/session?unit_id=${encodeURIComponent(unitId)}`,
        );

        // Auto-detect age band from student's graduation year if available
        let resolvedAgeBand = ageBand;

        if (loadRes.ok) {
          const { session, graduationYear } = await loadRes.json();

          if (graduationYear) {
            resolvedAgeBand = detectAgeBand(graduationYear);
          }

          if (session && session.state !== "completed") {
            // Resume existing session
            setSessionId(session.id);
            sessionIdRef.current = session.id;
            setProfile(session.profile);
            profileRef.current = session.profile;

            const resumeState = getResumeState(session.profile);
            dispatch({ type: "RESUME", state: resumeState });
            if (isMountedRef.current) setLoading(false);
            return;
          }

          if (session && session.state === "completed") {
            // Already completed — show completed state
            setSessionId(session.id);
            sessionIdRef.current = session.id;
            setProfile(session.profile);
            profileRef.current = session.profile;
            dispatch({ type: "COMPLETE_JOURNEY" });
            if (isMountedRef.current) setLoading(false);
            return;
          }
        }

        // No existing session — create new
        const newProfile = createEmptyProfile(
          "", // studentId is set server-side from auth
          unitId,
          classId ?? null,
          resolvedAgeBand,
          mode,
        );

        const createRes = await fetch("/api/discovery/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unit_id: unitId,
            class_id: classId,
            profile: newProfile,
            mode,
          }),
        });

        if (!createRes.ok) {
          console.error("[Discovery] Failed to create session:", createRes.status);
          if (isMountedRef.current) setLoading(false);
          return;
        }

        const { session: newSession } = await createRes.json();
        setSessionId(newSession.id);
        sessionIdRef.current = newSession.id;
        setProfile(newProfile);
        profileRef.current = newProfile;
        dispatch({ type: "START" });
      } catch (err) {
        console.error("[Discovery] Init error:", err);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    }

    init();
  }, [unitId, classId, ageBand, mode]);

  // ─── Navigation ────────────────────────────────────────────

  const next = useCallback(() => {
    if (!canAdvance(machine.current, profile)) return;
    dispatch({ type: "NEXT" });
    triggerSave(true);
  }, [machine.current, profile, triggerSave]);

  const back = useCallback(() => {
    dispatch({ type: "BACK" });
    // No save on back — data already saved when it was entered
  }, []);

  const goToStep = useCallback(
    (step: DiscoveryState) => {
      dispatch({ type: "GO_TO_STEP", step });
      triggerSave(true);
    },
    [triggerSave],
  );

  const completeStation = useCallback(
    (station: DiscoveryStation) => {
      dispatch({ type: "COMPLETE_STATION", station });
      // Update lastStationCompleted in profile
      setProfile((prev) => {
        const updated = {
          ...prev,
          lastStationCompleted: Math.max(prev.lastStationCompleted, station),
        };
        profileRef.current = updated;
        return updated;
      });
      triggerSave(true);
    },
    [triggerSave],
  );

  const completeJourney = useCallback(() => {
    dispatch({ type: "COMPLETE_JOURNEY" });
    setProfile((prev) => {
      const updated = {
        ...prev,
        completedAt: new Date().toISOString(),
      };
      profileRef.current = updated;
      return updated;
    });
    // Save with completed flag
    const sid = sessionIdRef.current;
    if (sid) {
      saveToServer(sid, "completed", profileRef.current, true);
    }
  }, [saveToServer]);

  // ─── Profile Updates ───────────────────────────────────────

  const updateStation = useCallback(
    <K extends keyof DiscoveryProfile>(key: K, data: DiscoveryProfile[K]) => {
      setProfile((prev) => {
        const updated = { ...prev, [key]: data };
        profileRef.current = updated;
        return updated;
      });
      triggerSave(true);
    },
    [triggerSave],
  );

  const updateProfile = useCallback(
    (updates: Partial<DiscoveryProfile>) => {
      setProfile((prev) => {
        const updated = { ...prev, ...updates };
        profileRef.current = updated;
        return updated;
      });
      triggerSave(true);
    },
    [triggerSave],
  );

  /**
   * Debounced update for continuous inputs (sliders, live text).
   * Use this instead of updateStation for values that change rapidly.
   */
  const updateProfileDebounced = useCallback(
    (updates: Partial<DiscoveryProfile>) => {
      setProfile((prev) => {
        const updated = { ...prev, ...updates };
        profileRef.current = updated;
        return updated;
      });
      // Use longer debounce for continuous inputs
      if (debouncedSaveTimerRef.current)
        clearTimeout(debouncedSaveTimerRef.current);
      debouncedSaveTimerRef.current = setTimeout(() => {
        const sid = sessionIdRef.current;
        if (sid) {
          saveToServer(sid, machineRef.current.current, profileRef.current);
        }
      }, DEBOUNCE_MS);
    },
    [saveToServer],
  );

  const saveNow = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (debouncedSaveTimerRef.current)
      clearTimeout(debouncedSaveTimerRef.current);
    await saveToServer(
      sid,
      machineRef.current.current,
      profileRef.current,
    );
  }, [saveToServer]);

  // ─── Computed Values ───────────────────────────────────────

  const totalProgress = getTotalProgress(machine.current);
  const currentStation = getStationFromState(machine.current);
  const stationProgress = getStationProgress(machine.current, currentStation);
  const currentStationMeta = STATION_META[currentStation] ?? null;
  const canAdvanceFromCurrent = canAdvance(machine.current, profile);

  // ─── Return ────────────────────────────────────────────────

  return {
    machine,
    profile,
    loading,
    saveStatus,
    sessionId,
    totalProgress,
    stationProgress,
    currentStationMeta,
    canAdvanceFromCurrent,

    next,
    back,
    goToStep,
    completeStation,
    completeJourney,

    updateStation,
    updateProfile,
    updateProfileDebounced,
    saveNow,
  };
}

// Re-export for convenience
export type { UseDiscoverySessionReturn };
