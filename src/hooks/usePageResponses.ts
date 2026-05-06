"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { UnitPage, ActivitySection, StudentProgress } from "@/types";
import type { UnitPageData } from "./usePageData";
import type { ActivityTrackingData } from "./useActivityTracking";
import { checkClientSide, MODERATION_MESSAGES, detectLanguage } from "@/lib/content-safety/client-filter";

interface UsePageResponsesReturn {
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  showSaveToast: boolean;
  saveProgress: (newStatus?: string, opts?: { silent?: boolean }) => Promise<void>;
  /**
   * Round 11 (6 May 2026) — write a single response key + value AND
   * immediately persist to /api/student/progress, bypassing the 2s
   * debounced autosave. Used by Process Journal "Save" so the journal
   * survives if the student navigates away within 2 seconds.
   */
  saveResponseImmediate: (key: string, value: string) => Promise<void>;
  moderationError: string | null;
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

  // Keep a ref to the latest responses so saveProgress doesn't need
  // responses in its dependency array (prevents re-creation on every keystroke)
  const responsesRef = useRef(responses);
  responsesRef.current = responses;

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
    async (newStatus?: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!currentPage) return;
      const currentResponses = responsesRef.current;

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

        // Phase 2 instrumentation — diagnoses the debounce/autosave race.
        // Gated behind localStorage so normal users never see it.
        // Enable in browser console: localStorage.setItem("SL_INTEGRITY_DEBUG", "1")
        if (
          typeof window !== "undefined" &&
          window.localStorage?.getItem("SL_INTEGRITY_DEBUG") === "1"
        ) {
          const ref = integrityMetadataRef?.current;
          const keys = ref ? Object.keys(ref) : [];
          const sample =
            keys.length > 0 && ref
              ? (ref as Record<string, Record<string, unknown>>)[keys[0]]
              : null;
          console.log("[integrity-debug] autosave fired", {
            pageId: currentPage.id,
            hasRef: !!ref,
            keyCount: keys.length,
            keys,
            firstKeySample: sample
              ? {
                  characterCount: sample.characterCount,
                  keystrokeCount: sample.keystrokeCount,
                  totalTimeActive: sample.totalTimeActive,
                  pasteCount: Array.isArray(sample.pasteEvents)
                    ? sample.pasteEvents.length
                    : 0,
                  snapshotCount: Array.isArray(sample.snapshots)
                    ? sample.snapshots.length
                    : 0,
                }
              : null,
          });
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

  // Round 11 — immediate save helper (bypasses the 2s debounce). Updates
  // both the ref AND state so saveProgress reads the new value, then
  // awaits the POST. Designed for explicit save buttons that mustn't
  // race the autosave (Process Journal "Save").
  const saveResponseImmediate = useCallback(
    async (key: string, value: string) => {
      const next = { ...responsesRef.current, [key]: value };
      responsesRef.current = next;
      setResponses(next);
      await saveProgress("in_progress", { silent: true });
    },
    [saveProgress]
  );

  return {
    responses,
    setResponses,
    saving,
    showSaveToast,
    saveProgress,
    saveResponseImmediate,
    moderationError,
  };
}
