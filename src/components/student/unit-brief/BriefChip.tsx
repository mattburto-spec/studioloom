"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { UnitBrief, UnitBriefAmendment } from "@/types/unit-brief";
import { BriefDrawer } from "./BriefDrawer";

/**
 * Persistent student-side chip in the LessonSidebar. Visible on any
 * /unit/[unitId]/* route when the unit has a brief authored. Clicking
 * opens the BriefDrawer.
 *
 * Fetch lifecycle (Phase D):
 *  - On mount / unitId change → fetch once to hydrate the chip label.
 *  - On each drawer open → refetch so amendments the teacher added
 *    mid-session show up after the student reopens the drawer. The
 *    chip label updates after the refetch returns, so a student who
 *    opens-then-closes the drawer notices "Brief v1.1 → Brief v1.2"
 *    naturally on the next visit. No push from server (Phase D spec:
 *    "If teacher adds amendment v2.0 while student has drawer open,
 *    student doesn't see it until they close + reopen.").
 *
 * Chip label is "Brief v1.<amendments.length>" — so a brand-new brief
 * with no amendments reads "Brief v1.0", the first amendment yields
 * "Brief v1.1", second "Brief v1.2", and so on. The version pill on
 * the chip is self-documenting; we deliberately don't add a separate
 * "updated" badge (Phase C spec).
 */
export function BriefChip() {
  const params = useParams();
  const unitIdParam = params?.unitId;
  const unitId =
    typeof unitIdParam === "string"
      ? unitIdParam
      : Array.isArray(unitIdParam)
        ? unitIdParam[0]
        : null;

  const [brief, setBrief] = useState<UnitBrief | null>(null);
  const [amendments, setAmendments] = useState<UnitBriefAmendment[]>([]);
  const [open, setOpen] = useState(false);

  // Stable fetch helper. Failures hide the chip silently — the brief
  // is a convenience surface, errors in the nav chrome are worse UX
  // than an absent chip.
  const refetch = useCallback(async () => {
    if (!unitId) {
      setBrief(null);
      setAmendments([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/student/unit-brief?unitId=${encodeURIComponent(unitId)}`,
      );
      if (!res.ok) {
        setBrief(null);
        setAmendments([]);
        return;
      }
      const data = await res.json();
      setBrief(data.brief ?? null);
      setAmendments(Array.isArray(data.amendments) ? data.amendments : []);
    } catch {
      setBrief(null);
      setAmendments([]);
    }
  }, [unitId]);

  // Initial hydration on mount / unit change. useEffect's dep tracking
  // already dedupes — only fires when unitId actually changes.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Refetch when the drawer opens (Phase D — catch amendments added
  // since the last fetch). Early-return on close + when there's no
  // unit so we don't run extra requests on close transitions.
  useEffect(() => {
    if (!open || !unitId) return;
    void refetch();
  }, [open, unitId, refetch]);

  if (!unitId || !brief) return null;

  const versionLabel = `Brief v1.${amendments.length}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="brief-chip"
        aria-label={`Open ${versionLabel} and constraints`}
        className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 text-purple-800 text-[12.5px] font-semibold hover:bg-purple-100 transition border border-purple-200/60"
      >
        <span aria-hidden="true">📋</span>
        <span className="flex-1 text-left">{versionLabel}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-shrink-0 opacity-60"
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <BriefDrawer
        open={open}
        brief={brief}
        amendments={amendments}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
