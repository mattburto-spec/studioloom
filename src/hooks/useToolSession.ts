"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from "@/lib/content-safety/client-filter";

/**
 * Configuration for creating or resuming a tool session.
 *
 * mode: "embedded" (teacher assigns tool on unit page) or "standalone" (student initiates)
 *
 * For embedded mode:
 *   - unitId, pageId are required
 *   - sectionIndex (optional) identifies which activity section contains the tool
 *
 * For standalone mode:
 *   - unitId, pageId, sectionIndex are not used
 */
export interface ToolSessionConfig {
  toolId: string;
  studentId?: string; // Optional — undefined in public mode
  mode: "embedded" | "standalone";
  challenge?: string;
  unitId?: string;
  pageId?: string;
  sectionIndex?: number;
}

/**
 * Tool session state from the database.
 */
export interface ToolSessionState {
  /** Session UUID or null if not yet created */
  sessionId: string | null;
  /** The complete tool state (steps, ideas, scores, etc.) */
  state: Record<string, unknown>;
  /** "in_progress" or "completed" */
  status: "in_progress" | "completed";
  /** Save status: idle, saving, saved (temporary), or error */
  saveStatus: "idle" | "saving" | "saved" | "error";
  /** Version number (increments with each new attempt) */
  version: number;
  /** True while fetching existing session or creating new one */
  loading: boolean;
  /** Error message if loading/saving failed */
  error: string | null;
  /** Timestamp session was started */
  startedAt: string | null;
  /** Timestamp session was completed (null if in_progress) */
  completedAt: string | null;
}

/**
 * Return value from useToolSession hook.
 */
export interface UseToolSessionReturn {
  session: ToolSessionState;
  /**
   * Update tool state. Merges with existing state and triggers debounced save.
   * Does not require you to manage the full state — just pass the fields to update.
   */
  updateState: (newState: Record<string, unknown>) => void;
  /**
   * Mark session as completed. Sets status to "completed", saves optional summary.
   */
  completeSession: (summary?: Record<string, unknown>) => Promise<void>;
  /**
   * Create a new session (version+1) for the same tool+student+page combo.
   * Used when student wants to restart the tool while preserving history.
   */
  resetSession: () => Promise<void>;
}

const DEBOUNCE_MS = 500;
const SAVE_STATUS_VISIBLE_MS = 2000;

/**
 * useToolSession — Persist and resume interactive toolkit tool work.
 *
 * Handles session lifecycle:
 * - On mount: check for existing session (resume) or prepare for lazy creation
 * - On updateState: merge state and debounce save (500ms)
 * - Optimistic UI: state updates immediately, save happens in background
 * - Save status shows "saving" → "saved" (2s) → "idle"
 *
 * Example:
 *   const { session, updateState, completeSession } = useToolSession({
 *     toolId: "scamper",
 *     studentId: "abc123",
 *     mode: "embedded",
 *     unitId: "unit-xyz",
 *     pageId: "B1",
 *     challenge: "Design a water bottle",
 *   });
 *
 *   // On first idea submission, auto-creates session
 *   updateState({ ideas: [{ text: "...", step: 1 }] });
 *
 *   // Save is debounced and shows in UI
 *   {session.saveStatus === "saving" && <p>Saving...</p>}
 *   {session.saveStatus === "saved" && <p>Saved</p>}
 *
 *   // On summary screen, mark complete
 *   await completeSession({ summary: {...} });
 *
 *   // To start fresh (version 2), call reset
 *   await resetSession();
 */
export function useToolSession(config: ToolSessionConfig): UseToolSessionReturn {
  const [sessionState, setSessionState] = useState<ToolSessionState>({
    sessionId: null,
    state: {},
    status: "in_progress",
    saveStatus: "idle",
    version: 1,
    loading: true,
    error: null,
    startedAt: null,
    completedAt: null,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingStateRef = useRef<Record<string, unknown> | null>(null);
  const hasInitializedRef = useRef(false);

  /**
   * Fetch existing session for this tool+student+page combo.
   * Returns the session ID if found and in_progress, otherwise null.
   * Returns null immediately if studentId is missing (public/unauthenticated mode).
   */
  const fetchExistingSession = useCallback(async (): Promise<string | null> => {
    // If no studentId, skip persistence (public mode)
    if (!config.studentId) {
      return null;
    }

    try {
      const queryParams = new URLSearchParams({
        toolId: config.toolId,
      });

      if (
        config.mode === "embedded" &&
        config.unitId &&
        config.pageId
      ) {
        queryParams.append("unitId", config.unitId);
        queryParams.append("pageId", config.pageId);
        if (config.sectionIndex !== undefined) {
          queryParams.append("sectionIndex", String(config.sectionIndex));
        }
      }

      const response = await fetch(
        `/api/student/tool-sessions?${queryParams.toString()}`,
        { method: "GET" }
      );

      if (!response.ok) {
        if (response.status === 404 || response.status === 401) {
          return null; // No existing session, or not authenticated
        }
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      const data = (await response.json()) as { sessionId?: string; status?: string };

      // Only resume if session exists and is in_progress
      if (data.sessionId && data.status === "in_progress") {
        return data.sessionId;
      }

      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setSessionState((prev) => ({
        ...prev,
        error: `Failed to load session: ${errorMsg}`,
        loading: false,
      }));
      return null;
    }
  }, [config.toolId, config.mode, config.unitId, config.pageId, config.sectionIndex, config.studentId]);

  /**
   * Create a new session in the database.
   * Returns null immediately if studentId is missing (public/unauthenticated mode).
   */
  const createNewSession = useCallback(
    async (initialState: Record<string, unknown>): Promise<string | null> => {
      // If no studentId, skip persistence (public mode)
      if (!config.studentId) {
        return null;
      }

      try {
        const response = await fetch("/api/student/tool-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toolId: config.toolId,
            studentId: config.studentId,
            mode: config.mode,
            challenge: config.challenge || "",
            unitId: config.unitId || null,
            pageId: config.pageId || null,
            sectionIndex: config.sectionIndex ?? null,
            state: initialState,
          } as {
            toolId: string;
            studentId: string;
            mode: string;
            challenge: string;
            unitId?: string | null;
            pageId?: string | null;
            sectionIndex?: number | null;
            state: Record<string, unknown>;
          }),
        });

        if (!response.ok) {
          // 401 = not authenticated, silently disable persistence
          if (response.status === 401) {
            return null;
          }
          throw new Error(`Failed to create session: ${response.statusText}`);
        }

        const data = (await response.json()) as { sessionId: string };
        return data.sessionId;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setSessionState((prev) => ({
          ...prev,
          error: `Failed to create session: ${errorMsg}`,
          saveStatus: "error",
        }));
        return null;
      }
    },
    [config]
  );

  /**
   * Save state to an existing session.
   */
  const saveSessionState = useCallback(
    async (
      sessionId: string,
      newState: Record<string, unknown>,
      statusOverride?: "in_progress" | "completed"
    ): Promise<boolean> => {
      try {
        const response = await fetch(`/api/student/tool-sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state: newState,
            status: statusOverride || "in_progress",
          } as { state: Record<string, unknown>; status: string }),
        });

        if (!response.ok) {
          throw new Error(`Failed to save session: ${response.statusText}`);
        }

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        setSessionState((prev) => ({
          ...prev,
          error: `Save failed: ${errorMsg}`,
          saveStatus: "error",
        }));
        return false;
      }
    },
    []
  );

  /**
   * Debounced save: coalesces rapid state updates into a single save.
   */
  const debouncedSave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSessionState((prev) => {
        if (!prev.sessionId) {
          return prev; // Session not yet created, skip save
        }
        return { ...prev, saveStatus: "saving" };
      });

      const currentState = pendingStateRef.current;
      if (!currentState) return;

      const sessionId = sessionState.sessionId;
      if (!sessionId) return;

      const success = await saveSessionState(sessionId, currentState);

      if (success) {
        setSessionState((prev) => ({ ...prev, saveStatus: "saved" }));

        // Clear "saved" status after 2 seconds
        if (saveStatusTimerRef.current) {
          clearTimeout(saveStatusTimerRef.current);
        }
        saveStatusTimerRef.current = setTimeout(() => {
          setSessionState((prev) => ({ ...prev, saveStatus: "idle" }));
        }, SAVE_STATUS_VISIBLE_MS);
      }

      debounceTimerRef.current = null;
    }, DEBOUNCE_MS);
  }, [sessionState.sessionId, saveSessionState]);

  /**
   * Initialize session on mount.
   */
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    (async () => {
      // Try to resume existing session
      const existingSessionId = await fetchExistingSession();

      if (existingSessionId) {
        // Fetch full session data
        try {
          const response = await fetch(
            `/api/student/tool-sessions/${existingSessionId}`
          );
          if (response.ok) {
            const sessionData = (await response.json()) as {
              id: string;
              state: Record<string, unknown>;
              status: string;
              version: number;
              started_at: string;
              completed_at: string | null;
            };
            setSessionState((prev) => ({
              ...prev,
              sessionId: sessionData.id,
              state: sessionData.state,
              status: sessionData.status as "in_progress" | "completed",
              version: sessionData.version,
              startedAt: sessionData.started_at,
              completedAt: sessionData.completed_at,
              loading: false,
            }));
            return;
          }
        } catch (err) {
          console.error("Failed to fetch session details:", err);
        }
      }

      // No existing session — ready for lazy creation on first updateState
      setSessionState((prev) => ({ ...prev, loading: false }));
    })();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, [fetchExistingSession]);

  /**
   * updateState — merge new state and trigger debounced save.
   * If no session exists yet, create one lazily on first call.
   */
  const updateState = useCallback(
    (newState: Record<string, unknown>) => {
      // Content safety check — extract string values from state update
      const textValues = Object.values(newState).filter((v) => typeof v === "string").join(" ");
      if (textValues.trim()) {
        const moderationCheck = checkClientSide(textValues);
        if (!moderationCheck.ok) {
          const lang = detectLanguage(textValues);
          setSessionState((prev) => ({
            ...prev,
            error: MODERATION_MESSAGES[lang === "zh" ? "zh" : "en"],
          }));
          fetch("/api/safety/log-client-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "tool_session",
              flags: moderationCheck.flags,
              snippet: textValues.slice(0, 200),
            }),
          }).catch(() => {});
          return;
        }
      }

      setSessionState((prev) => {
        const mergedState = { ...prev.state, ...newState };
        pendingStateRef.current = mergedState;

        return {
          ...prev,
          state: mergedState,
        };
      });

      // Create session lazily if needed
      if (!sessionState.sessionId && !sessionState.loading) {
        (async () => {
          const sessionId = await createNewSession(newState);
          if (sessionId) {
            setSessionState((prev) => ({
              ...prev,
              sessionId,
              startedAt: new Date().toISOString(),
            }));
          }
        })();
      } else if (sessionState.sessionId) {
        // Already have a session, trigger debounced save
        debouncedSave();
      }
    },
    [sessionState.sessionId, sessionState.loading, createNewSession, debouncedSave]
  );

  /**
   * completeSession — mark session as completed and save summary.
   * In public mode (no sessionId), silently does nothing.
   */
  const completeSession = useCallback(
    async (summary?: Record<string, unknown>) => {
      // If no sessionId (public mode), do nothing
      if (!sessionState.sessionId) {
        return;
      }

      const finalState = {
        ...sessionState.state,
        ...(summary ? { summary } : {}),
      };

      const success = await saveSessionState(
        sessionState.sessionId,
        finalState,
        "completed"
      );

      if (success) {
        setSessionState((prev) => ({
          ...prev,
          status: "completed",
          completedAt: new Date().toISOString(),
          saveStatus: "saved",
        }));

        // Clear "saved" status after 2 seconds
        if (saveStatusTimerRef.current) {
          clearTimeout(saveStatusTimerRef.current);
        }
        saveStatusTimerRef.current = setTimeout(() => {
          setSessionState((prev) => ({ ...prev, saveStatus: "idle" }));
        }, SAVE_STATUS_VISIBLE_MS);
      }
    },
    [sessionState.sessionId, sessionState.state, saveSessionState]
  );

  /**
   * resetSession — create version+1 session for the same tool+page combo.
   * In public mode, increments version in memory only.
   */
  const resetSession = useCallback(async () => {
    if (!sessionState.sessionId) {
      // Public mode: just increment version in memory
      setSessionState((prev) => ({
        ...prev,
        state: {},
        status: "in_progress",
        version: prev.version + 1,
        startedAt: new Date().toISOString(),
        completedAt: null,
        saveStatus: "idle",
        error: null,
      }));
      return;
    }

    const newSessionId = await createNewSession({});

    if (newSessionId) {
      setSessionState((prev) => ({
        ...prev,
        sessionId: newSessionId,
        state: {},
        status: "in_progress",
        version: prev.version + 1,
        startedAt: new Date().toISOString(),
        completedAt: null,
        saveStatus: "idle",
        error: null,
      }));

      pendingStateRef.current = null;
    }
  }, [sessionState.sessionId, createNewSession]);

  return {
    session: sessionState,
    updateState,
    completeSession,
    resetSession,
  };
}
