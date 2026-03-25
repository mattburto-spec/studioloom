"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { UnitContentData } from "@/types";

type SaveStatus = "idle" | "saving" | "saved" | "error";
type EditMode = "all" | "class";

interface UseAutoSaveProps {
  unitId: string;
  classId: string;
  content: UnitContentData;
  editMode: EditMode;
}

/**
 * useAutoSave — Debounced auto-save hook for lesson editor
 *
 * Automatically saves content when it changes (800ms debounce).
 * Routes saves to different endpoints based on editMode:
 *   - "class" → PATCH /api/teacher/class-units/content (fork-on-write, existing)
 *   - "all"   → PATCH /api/teacher/units/[unitId]/content (direct master update)
 *
 * Returns the current save status ("idle" | "saving" | "saved" | "error").
 */
export function useAutoSave({
  unitId,
  classId,
  content,
  editMode,
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
        let response: Response;

        if (editMode === "all") {
          // Direct master update — all non-forked classes see this immediately
          response = await fetch(`/api/teacher/units/${unitId}/content`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content_data: dataToSave }),
          });
        } else {
          // Class-local fork-on-write (existing behavior)
          response = await fetch("/api/teacher/class-units/content", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              unitId,
              classId,
              content_data: dataToSave,
            }),
          });
        }

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
    [unitId, classId, editMode]
  );

  // Debounced save on content change
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(() => {
      save(content);
    }, 800);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [content, save]);

  return saveStatus;
}
