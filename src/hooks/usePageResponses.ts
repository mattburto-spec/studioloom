"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UnitPage, ActivitySection, StudentProgress } from "@/types";
import type { UnitPageData } from "./usePageData";
import type { ActivityTrackingData } from "./useActivityTracking";
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from "@/lib/content-safety/client-filter";
import type { AutonomyLevel } from "@/components/student/lesson-bold";

type SaveProgressOpts = {
  silent?: boolean;
  /** Lesson Bold Sub-Phase 3: pass an explicit autonomy level to save with this
   *  call instead of reading from autonomyRef. Avoids the React state-then-ref
   *  race when AutonomyPicker click fires save immediately after setAutonomyLevel. */
  autonomyLevelOverride?: AutonomyLevel;
};

interface UsePageResponsesReturn {
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  showSaveToast: boolean;
  saveProgress: (newStatus?: string, opts?: SaveProgressOpts) => Promise<void>;
  moderationError: string | null;
  /** Current autonomy level — null until the student picks via AutonomyPicker.
   *  Seeded from student_progress.autonomy_level on initial load. */
  autonomyLevel: AutonomyLevel | null;
  /** Sets the level locally AND fires a silent save with the new value. */
  setAutonomyLevel: (level: AutonomyLevel) => void;
}

export function usePageResponses(
  unitId: string,
  pageId: string,
  currentPage: UnitPage | undefined,
  data: UnitPageData | null,
  integrityMetadataRef?: React.RefObject<Record<string, unknown> | null>,
  getTrackingPayload?: () => Record<string, ActivityTrackingData>
): UsePageResponsesReturn {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [autonomyLevel, setAutonomyLevelState] = useState<AutonomyLevel | null>(null);

  // Keep a ref to the latest responses so saveProgress doesn't need
  // responses in its dependency array (prevents re-creation on every keystroke)
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

  // Same pattern for autonomyLevel — saveProgress reads from this ref so the
  // callback identity doesn't change when the student picks a different level.
  const autonomyRef = useRef(autonomyLevel);
  autonomyRef.current = autonomyLevel;

  // Track which pageId we've already loaded responses for,
  // so we don't overwrite user typing when data ref changes
  const loadedPageRef = useRef<string | null>(null);

  // Load saved responses when data arrives (only once per page)
  useEffect(() => {
    if (!data) return;
    // Only load from saved data on initial mount or page change
    if (loadedPageRef.current === pageId) return;
    loadedPageRef.current = pageId;

    const pageProgress = data.progress.find(
      (p: StudentProgress) => p.page_id === pageId
    );
    if (pageProgress?.responses) {
      setResponses(pageProgress.responses as Record<string, string>);
    } else {
      setResponses({});
    }

    // Seed autonomy level from saved progress (Sub-Phase 3). NULL stays null;
    // the UI's resolveAutonomyDisplay() handles the fallback to 'balanced'.
    setAutonomyLevelState(pageProgress?.autonomy_level ?? null);
  }, [data, pageId]);

  // Sync portfolio-flagged sections on explicit save (fire-and-forget)
  const syncPortfolioCaptures = useCallback(
    (sections: ActivitySection[], currentResponses: Record<string, unknown>, pId: string) => {
      for (let i = 0; i < sections.length; i++) {
        if (!sections[i].portfolioCapture) continue;
        const responseKey = sections[i].activityId ? `activity_${sections[i].activityId}` : `section_${i}`;
        const value = currentResponses[responseKey];
        if (!value || (typeof value === "string" && value.trim() === "")) continue;

        const content = typeof value === "string" ? value : JSON.stringify(value);

        let mediaUrl: string | null = null;
        let linkUrl: string | null = null;
        let linkTitle: string | null = null;
        try {
          const parsed = JSON.parse(content);
          if (parsed.type === "upload" && parsed.url) mediaUrl = parsed.url;
          if (parsed.type === "link" && parsed.url) {
            linkUrl = parsed.url;
            linkTitle = parsed.title || null;
          }
        } catch {
          // plain text
        }

        fetch("/api/student/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId,
            type: "auto",
            pageId: pId,
            sectionIndex: i,
            content,
            mediaUrl,
            linkUrl,
            linkTitle,
          }),
        }).catch(() => {});
      }
    },
    [unitId]
  );

  // saveProgress reads from responsesRef so it doesn't recreate on every keystroke
  const saveProgress = useCallback(
    async (newStatus?: string, { silent = false, autonomyLevelOverride }: SaveProgressOpts = {}) => {
      if (!currentPage) return;
      const currentResponses = responsesRef.current;
      const levelToSave = autonomyLevelOverride ?? autonomyRef.current;

      // Content safety check — concatenate all text responses
      const allText = Object.values(currentResponses).filter((v) => typeof v === "string").join(" ");
      if (allText.trim()) {
        const moderationCheck = checkClientSide(allText);
        if (!moderationCheck.ok) {
          const lang = detectLanguage(allText);
          setModerationError(MODERATION_MESSAGES[lang === "zh" ? "zh" : "en"]);
          fetch("/api/safety/log-client-block", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "student_progress",
              flags: moderationCheck.flags,
              snippet: allText.slice(0, 200),
            }),
          }).catch(() => {});
          return;
        }
      }
      setModerationError(null);

      setSaving(true);
      try {
        // Merge activity tracking data into responses (stored alongside response values in JSONB)
        let responsesWithTracking: Record<string, unknown> = currentResponses;
        if (getTrackingPayload) {
          try {
            const tracking = getTrackingPayload();
            if (Object.keys(tracking).length > 0) {
              responsesWithTracking = { ...currentResponses, ...tracking };
            }
          } catch {
            // Non-critical — don't block save if tracking fails
          }
        }

        // Include integrity metadata if available (MonitoredTextarea data)
        const payload: Record<string, unknown> = {
          unitId,
          pageId: currentPage.id,
          status: newStatus || "in_progress",
          responses: responsesWithTracking,
        };
        if (integrityMetadataRef?.current && Object.keys(integrityMetadataRef.current).length > 0) {
          payload.integrityMetadata = integrityMetadataRef.current;
        }
        if (levelToSave) {
          payload.autonomyLevel = levelToSave;
        }
        const res = await fetch("/api/student/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok && !silent) {
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 1500);
          const sections = currentPage.content?.sections;
          if (sections) {
            syncPortfolioCaptures(sections, currentResponses, currentPage.id);
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [unitId, currentPage, syncPortfolioCaptures]
  );

  // Auto-save on response changes (debounced, silent)
  useEffect(() => {
    if (!data || Object.keys(responses).length === 0) return;
    const timer = setTimeout(() => {
      saveProgress(undefined, { silent: true });
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [responses, data]);

  // Mark page as in_progress on first visit
  useEffect(() => {
    if (!data || !currentPage) return;
    const pageProgress = data.progress.find(
      (p) => p.page_id === currentPage.id
    );
    if (!pageProgress || pageProgress.status === "not_started") {
      saveProgress("in_progress", { silent: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, currentPage]);

  // Sub-Phase 3: pick + persist autonomy level. Calls saveProgress with the
  // explicit level rather than reading autonomyRef (which the React batch
  // hasn't updated yet at the time of the click).
  const setAutonomyLevel = useCallback(
    (level: AutonomyLevel) => {
      setAutonomyLevelState(level);
      void saveProgress(undefined, { silent: true, autonomyLevelOverride: level });
    },
    [saveProgress]
  );

  return {
    responses,
    setResponses,
    saving,
    showSaveToast,
    saveProgress,
    moderationError,
    autonomyLevel,
    setAutonomyLevel,
  };
}
