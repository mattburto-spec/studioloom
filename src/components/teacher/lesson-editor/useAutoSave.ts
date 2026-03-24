"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { UnitContentData } from "@/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface UseAutoSaveProps {
  unitId: string;
  classId: string;
  content: UnitContentData;
}

/**
 * useAutoSave — Debounced auto-save hook for lesson editor
 *
 * Automatically saves content to the fork-on-write API when it changes.
 * Debounced at 800ms to avoid excessive API calls.
 * Returns the current save status ("idle" | "saving" | "saved" | "error").
 *
 * The server-side content API handles fork-on-write automatically —
 * this hook just sends the full content_data.
 */
export function useAutoSave({
  unitId,
  classId,
  content,
}: UseAutoSaveProps): SaveStatus {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousContentRef = useRef<UnitContentData | null>(null);

  const save = useCallback(
    async (dataToSave: UnitContentData) => {
      // Early return if content hasn't actually changed
      if (
        JSON.stringify(previousContentRef.current) ===
        JSON.stringify(dataToSave)
      ) {
        return;
      }

      setSaveStatus("saving");

      try {
        const response = await fetch("/api/teacher/class-units/content", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId,
            classId,
            content_data: dataToSave,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.error("[useAutoSave] save failed:", data.error || response.statusText);
          setSaveStatus("error");
          return;
        }

        previousContentRef.current = structuredClone(dataToSave);
        setSaveStatus("saved");

        // Auto-reset to "idle" after 2 seconds
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("[useAutoSave] save error:", error);
        setSaveStatus("error");
      }
    },
    [unitId, classId]
  );

  // Debounced save on content change
  useEffect(() => {
    // Clear any pending save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Schedule a new save
    saveTimerRef.current = setTimeout(() => {
      save(content);
    }, 800);

    // Cleanup on unmount
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [content, save]);

  return saveStatus;
}
