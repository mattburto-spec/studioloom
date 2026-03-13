"use client";

import { useState, useEffect, useCallback } from "react";
import type { UnitPage, ActivitySection, StudentProgress } from "@/types";
import type { UnitPageData } from "./usePageData";

interface UsePageResponsesReturn {
  responses: Record<string, string>;
  setResponses: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  saving: boolean;
  showSaveToast: boolean;
  saveProgress: (newStatus?: string, opts?: { silent?: boolean }) => Promise<void>;
}

export function usePageResponses(
  unitId: string,
  pageId: string,
  currentPage: UnitPage | undefined,
  data: UnitPageData | null
): UsePageResponsesReturn {
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);

  // Load saved responses when data arrives
  useEffect(() => {
    if (!data) return;
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
        // Use activityId key for v4 timeline units, fall back to section index
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

  const saveProgress = useCallback(
    async (newStatus?: string, { silent = false }: { silent?: boolean } = {}) => {
      if (!currentPage) return;
      setSaving(true);
      try {
        const res = await fetch("/api/student/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId,
            pageId: currentPage.id,
            status: newStatus || "in_progress",
            responses,
          }),
        });
        if (res.ok && !silent) {
          setShowSaveToast(true);
          setTimeout(() => setShowSaveToast(false), 1500);
          const sections = currentPage.content?.sections;
          if (sections) {
            syncPortfolioCaptures(sections, responses, currentPage.id);
          }
        }
      } finally {
        setSaving(false);
      }
    },
    [unitId, currentPage, responses, syncPortfolioCaptures]
  );

  // Auto-save on response changes (debounced, silent)
  useEffect(() => {
    if (!data || Object.keys(responses).length === 0) return;
    const timer = setTimeout(() => {
      saveProgress(undefined, { silent: true });
    }, 2000);
    return () => clearTimeout(timer);
  }, [responses, data, saveProgress]);

  // Mark page as in_progress on first visit
  useEffect(() => {
    if (!data || !currentPage) return;
    const pageProgress = data.progress.find(
      (p) => p.page_id === currentPage.id
    );
    if (!pageProgress || pageProgress.status === "not_started") {
      saveProgress("in_progress", { silent: true });
    }
  }, [data, currentPage, saveProgress]);

  return { responses, setResponses, saving, showSaveToast, saveProgress };
}
