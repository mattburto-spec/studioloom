"use client";

import { useRouter } from "next/navigation";
import type { UnitPage } from "@/types";

interface MobileBottomNavProps {
  enabledPages: UnitPage[];
  currentPageId: string;
  unitId: string;
  pageColor: string;
  onDone: () => void;
}

export function MobileBottomNav({
  enabledPages,
  currentPageId,
  unitId,
  pageColor,
  onDone,
}: MobileBottomNavProps) {
  const router = useRouter();
  const currentIndex = enabledPages.findIndex((p) => p.id === currentPageId);
  const prevPage = currentIndex > 0 ? enabledPages[currentIndex - 1] : null;
  const nextPage = currentIndex < enabledPages.length - 1 ? enabledPages[currentIndex + 1] : null;
  const isLast = currentIndex === enabledPages.length - 1;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-border z-30 md:hidden">
      <div className="flex items-center justify-between px-4 py-2.5">
        {/* Prev */}
        {prevPage ? (
          <button
            onClick={() => router.push(`/unit/${unitId}/${prevPage.id}`)}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}

        {/* Lesson indicator */}
        <span className="text-xs font-medium text-text-secondary">
          Lesson {currentIndex + 1} of {enabledPages.length}
        </span>

        {/* Next / Done */}
        {isLast ? (
          <button
            onClick={onDone}
            className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition hover:brightness-110"
            style={{ backgroundColor: pageColor }}
          >
            Done
          </button>
        ) : nextPage ? (
          <button
            onClick={() => router.push(`/unit/${unitId}/${nextPage.id}`)}
            className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-text-secondary hover:text-text-primary transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>
    </div>
  );
}
