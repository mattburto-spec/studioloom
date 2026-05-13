"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { UnitBrief, UnitBriefAmendment } from "@/types/unit-brief";
import { BriefDrawer } from "./BriefDrawer";

/**
 * Persistent student-side chip in the BoldTopNav. Visible on any
 * /unit/[unitId]/* route when the unit has a brief authored. Clicking
 * opens the BriefDrawer.
 *
 * Lazy fetch — runs on mount once per unitId. No drawer-state coupling
 * to URL (Phase C spec: "Drawer state: local React state. No URL
 * deeplink in v1.").
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
  const [loadedForUnitId, setLoadedForUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) {
      setBrief(null);
      setAmendments([]);
      setLoadedForUnitId(null);
      return;
    }
    if (loadedForUnitId === unitId) return;

    let cancelled = false;
    void fetch(
      `/api/student/unit-brief?unitId=${encodeURIComponent(unitId)}`,
    )
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          // 403 (not enrolled) / 404 / 500 — just hide the chip rather
          // than surfacing an error in the nav chrome. The brief is a
          // convenience surface; failing silently is the right UX.
          setBrief(null);
          setAmendments([]);
          setLoadedForUnitId(unitId);
          return;
        }
        const data = await res.json();
        setBrief(data.brief ?? null);
        setAmendments(Array.isArray(data.amendments) ? data.amendments : []);
        setLoadedForUnitId(unitId);
      })
      .catch(() => {
        if (cancelled) return;
        setBrief(null);
        setAmendments([]);
        setLoadedForUnitId(unitId);
      });

    return () => {
      cancelled = true;
    };
  }, [unitId, loadedForUnitId]);

  if (!unitId || !brief) return null;

  const versionLabel = `Brief v1.${amendments.length}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="brief-chip"
        title="Open brief and constraints"
        className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1.5 text-[12.5px] font-semibold text-purple-800 hover:bg-purple-200 transition"
      >
        <span aria-hidden="true">📋</span>
        <span>{versionLabel}</span>
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
