"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type {
  StudentBrief,
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
} from "@/types/unit-brief";
import type { CardTemplate } from "@/lib/unit-brief/effective";
import { BriefDrawer } from "./BriefDrawer";

/**
 * Persistent student-side chip in the LessonSidebar (Phase C smoke-fix
 * location, between unit title + Project Board button). Visible on any
 * /unit/[unitId]/* route when the unit has a brief authored OR the
 * student has picked a card with a brief template OR the student has
 * authored an override.
 *
 * Fetch lifecycle (Phase D + Phase F.D):
 *  - On mount / unitId change → fetch the 3 sources.
 *  - On each drawer open → refetch so teacher amendments + lock changes
 *    + new card-template fields show up after the student reopens.
 *  - On student save (Phase F.D) → optimistic local state update +
 *    server returns the new studentBrief, which replaces local state.
 *
 * Chip label is "Brief v1.<amendments.length>". Hidden when there's
 * no brief content at all (no unit_brief, no card template with brief,
 * no student override).
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

  const [unitBrief, setUnitBrief] = useState<UnitBrief | null>(null);
  const [cardTemplate, setCardTemplate] = useState<CardTemplate | null>(null);
  const [studentBrief, setStudentBrief] = useState<StudentBrief | null>(null);
  const [amendments, setAmendments] = useState<UnitBriefAmendment[]>([]);
  const [open, setOpen] = useState(false);

  const refetch = useCallback(async () => {
    if (!unitId) {
      setUnitBrief(null);
      setCardTemplate(null);
      setStudentBrief(null);
      setAmendments([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/student/unit-brief?unitId=${encodeURIComponent(unitId)}`,
      );
      if (!res.ok) {
        setUnitBrief(null);
        setCardTemplate(null);
        setStudentBrief(null);
        setAmendments([]);
        return;
      }
      const data = await res.json();
      setUnitBrief(data.brief ?? null);
      setCardTemplate(data.cardTemplate ?? null);
      setStudentBrief(data.studentBrief ?? null);
      setAmendments(Array.isArray(data.amendments) ? data.amendments : []);
    } catch {
      setUnitBrief(null);
      setCardTemplate(null);
      setStudentBrief(null);
      setAmendments([]);
    }
  }, [unitId]);

  // Hydration on mount + unit-change.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  // Refetch on drawer open (Phase D).
  useEffect(() => {
    if (!open || !unitId) return;
    void refetch();
  }, [open, unitId, refetch]);

  // Phase F.D — student save handler. Optimistic: send the patch, swap
  // in the returned row. Errors bubble to the drawer's local error
  // banner via the thrown promise.
  const saveOverride = useCallback(
    async (patch: {
      brief_text?: string | null;
      constraints?: UnitBriefConstraints;
    }) => {
      if (!unitId) return;
      const res = await fetch("/api/student/unit-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, ...patch }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Save failed (${res.status})`);
      }
      const data = await res.json();
      if (data.studentBrief) setStudentBrief(data.studentBrief);
    },
    [unitId],
  );

  if (!unitId) return null;

  // The chip is hidden when there's no brief content to show at all.
  const hasAnyContent =
    unitBrief !== null || cardTemplate !== null || studentBrief !== null;
  if (!hasAnyContent) return null;

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
        unitBrief={unitBrief}
        cardTemplate={cardTemplate}
        studentBrief={studentBrief}
        amendments={amendments}
        onSaveOverride={saveOverride}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
