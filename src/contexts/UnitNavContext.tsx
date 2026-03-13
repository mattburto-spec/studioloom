"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getPageSettings, getPageColor } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import type { Unit, UnitPage, StudentProgress, PageSettingsMap, PageDueDatesMap, PageSettings } from "@/types";

export interface UnitNavData {
  unit: Unit;
  allPages: UnitPage[];
  enabledPages: UnitPage[];
  progress: StudentProgress[];
  lockedPages: string[];
  ellLevel: number;
  pageSettings?: PageSettingsMap;
  pageDueDates?: PageDueDatesMap;
  studentName?: string;
  finalDueDate?: string | null;
}

interface UnitNavContextValue {
  data: UnitNavData | null;
  loading: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  refreshProgress: () => Promise<void>;
  // Derived helpers for the current page
  getPageData: (pageId: string) => {
    currentPage: UnitPage | undefined;
    currentIndex: number;
    nextPage: UnitPage | null;
    currentSettings: PageSettings;
    pageColor: string;
  };
}

const UnitNavCtx = createContext<UnitNavContextValue | null>(null);

export function useUnitNav() {
  return useContext(UnitNavCtx);
}

export function UnitNavProvider({
  unitId,
  children,
}: {
  unitId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [rawData, setRawData] = useState<{
    unit: Unit;
    lockedPages: string[];
    progress: StudentProgress[];
    ellLevel: number;
    finalDueDate?: string | null;
    pageDueDates?: PageDueDatesMap;
    pageSettings?: PageSettingsMap;
    studentName?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/student/unit?unitId=${unitId}`);
      if (!res.ok) {
        router.push("/dashboard");
        return;
      }
      const result = await res.json();
      setRawData(result);
    } catch {
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [unitId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshProgress = useCallback(async () => {
    // Re-fetch just progress (lightweight refresh)
    try {
      const res = await fetch(`/api/student/unit?unitId=${unitId}`);
      if (res.ok) {
        const result = await res.json();
        setRawData(result);
      }
    } catch {
      // silent — sidebar just won't update
    }
  }, [unitId]);

  const data: UnitNavData | null = useMemo(() => {
    if (!rawData) return null;
    const allPages = getPageList(rawData.unit.content_data);
    const enabledPages = allPages.filter(
      (p) => getPageSettings(rawData.pageSettings, p.id).enabled
    );
    return {
      unit: rawData.unit,
      allPages,
      enabledPages,
      progress: rawData.progress,
      lockedPages: rawData.lockedPages,
      ellLevel: rawData.ellLevel,
      pageSettings: rawData.pageSettings,
      pageDueDates: rawData.pageDueDates,
      studentName: rawData.studentName,
      finalDueDate: rawData.finalDueDate,
    };
  }, [rawData]);

  const getPageData = useCallback(
    (pageId: string) => {
      if (!data) {
        return {
          currentPage: undefined,
          currentIndex: -1,
          nextPage: null,
          currentSettings: getPageSettings(undefined, "_"),
          pageColor: "#6B7280",
        };
      }
      const currentPage = data.allPages.find((p) => p.id === pageId);
      const currentIndex = data.enabledPages.findIndex((p) => p.id === pageId);
      const nextPage =
        currentIndex < data.enabledPages.length - 1
          ? data.enabledPages[currentIndex + 1]
          : null;
      const currentSettings = currentPage
        ? getPageSettings(data.pageSettings, currentPage.id)
        : getPageSettings(undefined, "_");
      const pageColor = currentPage ? getPageColor(currentPage) : "#6B7280";

      return { currentPage, currentIndex, nextPage, currentSettings, pageColor };
    },
    [data]
  );

  const value: UnitNavContextValue = useMemo(
    () => ({
      data,
      loading,
      sidebarOpen,
      setSidebarOpen,
      refreshProgress,
      getPageData,
    }),
    [data, loading, sidebarOpen, refreshProgress, getPageData]
  );

  return <UnitNavCtx.Provider value={value}>{children}</UnitNavCtx.Provider>;
}
