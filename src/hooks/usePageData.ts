"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPageSettings, getPageColor } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { useUnitNav } from "@/contexts/UnitNavContext";
import type { Unit, StudentProgress, PageSettingsMap, PageDueDatesMap, UnitPage, PageSettings } from "@/types";

export interface UnitPageData {
  unit: Unit;
  lockedPages: string[];
  progress: StudentProgress[];
  ellLevel: number;
  finalDueDate?: string | null;
  pageDueDates?: PageDueDatesMap;
  pageSettings?: PageSettingsMap;
  studentName?: string;
}

interface UsePageDataReturn {
  data: UnitPageData | null;
  loading: boolean;
  allPages: UnitPage[];
  currentPage: UnitPage | undefined;
  enabledPages: UnitPage[];
  nextPage: UnitPage | null;
  currentSettings: PageSettings;
  pageColor: string;
}

export function usePageData(unitId: string, pageId: string): UsePageDataReturn {
  const router = useRouter();
  const unitNav = useUnitNav();

  // If UnitNavContext is available (layout already fetched data), use it
  const ctxData = unitNav?.data;

  const [localData, setLocalData] = useState<UnitPageData | null>(null);
  const [localLoading, setLocalLoading] = useState(!ctxData);

  // Only fetch if no context data available (direct navigation / deep link)
  useEffect(() => {
    if (ctxData) {
      setLocalLoading(false);
      return;
    }
    async function loadData() {
      try {
        const res = await fetch(`/api/student/unit?unitId=${unitId}`);
        if (!res.ok) {
          router.push("/dashboard");
          return;
        }
        const result = await res.json();
        setLocalData(result);
      } catch {
        router.push("/dashboard");
      } finally {
        setLocalLoading(false);
      }
    }
    loadData();
  }, [unitId, pageId, router, ctxData]);

  // Resolve data source: context first, then local fetch
  // IMPORTANT: memoize to prevent creating a new object reference every render,
  // which would cause usePageResponses to reset typed text on every keystroke
  const data: UnitPageData | null = useMemo(() => {
    if (ctxData) {
      return {
        unit: ctxData.unit,
        lockedPages: ctxData.lockedPages,
        progress: ctxData.progress,
        ellLevel: ctxData.ellLevel,
        finalDueDate: ctxData.finalDueDate,
        pageDueDates: ctxData.pageDueDates,
        pageSettings: ctxData.pageSettings,
        studentName: ctxData.studentName,
      };
    }
    return localData;
  }, [ctxData, localData]);

  const loading = ctxData ? (unitNav?.loading ?? false) : localLoading;

  // Derive page navigation state
  const allPages: UnitPage[] = data ? getPageList(data.unit.content_data) : [];
  const currentPage = allPages.find((p) => p.id === pageId);

  const enabledPages = useMemo(
    () =>
      data
        ? allPages.filter((p) => getPageSettings(data.pageSettings, p.id).enabled)
        : allPages,
    [data, allPages]
  );

  const currentEnabledIndex = enabledPages.findIndex((p) => p.id === pageId);
  const nextPage =
    currentEnabledIndex < enabledPages.length - 1
      ? enabledPages[currentEnabledIndex + 1]
      : null;

  const currentSettings = currentPage
    ? getPageSettings(data?.pageSettings, currentPage.id)
    : getPageSettings(undefined, "_");

  const pageColor = currentPage ? getPageColor(currentPage) : "#6B7280";

  // Redirect if page is disabled
  useEffect(() => {
    if (!data || !currentPage) return;
    const settings = getPageSettings(data.pageSettings, currentPage.id);
    if (!settings.enabled) {
      const pages = getPageList(data.unit.content_data);
      const firstEnabled = pages.find(
        (p) => getPageSettings(data.pageSettings, p.id).enabled
      );
      if (firstEnabled) router.push(`/unit/${unitId}/${firstEnabled.id}`);
    }
  }, [data, currentPage, router, unitId]);

  return {
    data,
    loading,
    allPages,
    currentPage,
    enabledPages,
    nextPage,
    currentSettings,
    pageColor,
  };
}
