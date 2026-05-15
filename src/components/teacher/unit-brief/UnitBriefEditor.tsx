"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  LockableField,
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
  UnitBriefLocks,
} from "@/types/unit-brief";
import { LOCKABLE_FIELDS } from "@/types/unit-brief";
import { DesignConstraintsEditor } from "./DesignConstraintsEditor";
import { AmendmentsEditor } from "./AmendmentsEditor";
import { DiagramUploader } from "./DiagramUploader";
import { LockToggle } from "./LockToggle";

interface UnitBriefEditorProps {
  unitId: string;
  unitTitle: string | null;
  unitType: string;
}

const GENERIC_CONSTRAINTS: UnitBriefConstraints = {
  archetype: "generic",
  data: {},
};

/**
 * Teacher Brief & Constraints editor. One row per unit; partial-patch
 * upserts via POST /api/teacher/unit-brief. Save-on-blur for text
 * fields, save-on-change for chip-pickers and repeaters. Amendments
 * are append-only (POST /api/teacher/unit-brief/amendments).
 */
export function UnitBriefEditor({
  unitId,
  unitTitle,
  unitType,
}: UnitBriefEditorProps) {
  const isDesignUnit = unitType === "design";

  const [briefText, setBriefText] = useState<string>("");
  const [constraints, setConstraints] = useState<UnitBriefConstraints>(
    isDesignUnit ? { archetype: "design", data: {} } : GENERIC_CONSTRAINTS,
  );
  const [amendments, setAmendments] = useState<UnitBriefAmendment[]>([]);
  const [diagramUrl, setDiagramUrl] = useState<string | null>(null);
  const [locks, setLocks] = useState<UnitBriefLocks>({});
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Initial fetch — brief + amendments in parallel
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/teacher/unit-brief?unitId=${encodeURIComponent(unitId)}`).then(
        (r) => r.json(),
      ),
      fetch(
        `/api/teacher/unit-brief/amendments?unitId=${encodeURIComponent(unitId)}`,
      ).then((r) => r.json()),
    ])
      .then(([briefRes, amendmentsRes]) => {
        if (cancelled) return;
        if (briefRes.brief) {
          const b: UnitBrief = briefRes.brief;
          setBriefText(b.brief_text ?? "");
          setDiagramUrl(b.diagram_url ?? null);
          setLocks(b.locks ?? {});
          // Coerce stored constraints to the right archetype for this unit type.
          if (isDesignUnit && b.constraints.archetype === "design") {
            setConstraints(b.constraints);
          } else if (isDesignUnit) {
            setConstraints({ archetype: "design", data: {} });
          } else {
            setConstraints(GENERIC_CONSTRAINTS);
          }
        }
        if (Array.isArray(amendmentsRes.amendments)) {
          setAmendments(amendmentsRes.amendments);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSaveError("Failed to load brief — refresh to retry.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId, isDesignUnit]);

  // Partial-patch save. Patch is a subset of the brief shape; server
  // merges with existing row.
  const savePatch = useCallback(
    async (patch: {
      brief_text?: string | null;
      constraints?: UnitBriefConstraints;
      locks?: UnitBriefLocks;
    }) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/teacher/unit-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...patch }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSaveError(data.error ?? `Save failed (${res.status})`);
          return false;
        }
        setLastSavedAt(new Date());
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [unitId],
  );

  const handleBriefTextBlur = useCallback(() => {
    void savePatch({ brief_text: briefText.length === 0 ? null : briefText });
  }, [briefText, savePatch]);

  const handleConstraintsChange = useCallback(
    (next: UnitBriefConstraints) => {
      setConstraints(next);
      void savePatch({ constraints: next });
    },
    [savePatch],
  );

  // Per-field lock toggle (Phase F.B). Flips `locks[field]` and saves
  // the whole locks map (server canonicalises — false / absent both
  // mean unlocked, so it's safe to keep `false` keys in flight here).
  const handleToggleLock = useCallback(
    (field: LockableField, next: boolean) => {
      setLocks((prev) => {
        const nextLocks: UnitBriefLocks = { ...prev };
        if (next) {
          nextLocks[field] = true;
        } else {
          delete nextLocks[field];
        }
        void savePatch({ locks: nextLocks });
        return nextLocks;
      });
    },
    [savePatch],
  );

  // Bulk lock / unlock — post-F.E polish. Sets every lockable field
  // in one save (saves one round-trip vs toggling each individually).
  const handleLockAll = useCallback(() => {
    const nextLocks: UnitBriefLocks = {};
    for (const field of LOCKABLE_FIELDS) {
      nextLocks[field] = true;
    }
    setLocks(nextLocks);
    void savePatch({ locks: nextLocks });
  }, [savePatch]);

  const handleUnlockAll = useCallback(() => {
    const nextLocks: UnitBriefLocks = {};
    setLocks(nextLocks);
    void savePatch({ locks: nextLocks });
  }, [savePatch]);

  // For the "X of Y locked" indicator and disabling redundant bulk
  // actions.
  const lockedCount = Object.values(locks).filter((v) => v === true).length;
  const totalLockable = LOCKABLE_FIELDS.length;
  const allLocked = lockedCount === totalLockable;
  const noneLocked = lockedCount === 0;

  const handleAddAmendment = useCallback(
    async (input: { version_label: string; title: string; body: string }) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch("/api/teacher/unit-brief/amendments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unitId, ...input }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSaveError(data.error ?? `Failed to add amendment (${res.status})`);
          return false;
        }
        const data = await res.json();
        setAmendments((prev) => [data.amendment, ...prev]);
        setLastSavedAt(new Date());
        return true;
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to add amendment");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [unitId],
  );

  if (loading) {
    return (
      <div className="p-8 text-gray-500" data-testid="brief-editor-loading">
        Loading brief…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <Link
          href={`/teacher/units/${unitId}`}
          className="text-sm text-indigo-600 hover:text-indigo-800"
        >
          ← Back to {unitTitle ?? "unit"}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900">
            Brief &amp; Constraints
          </h1>
          <SaveStatusPill
            saving={saving}
            saveError={saveError}
            lastSavedAt={lastSavedAt}
          />
        </div>
        <p className="mt-1 text-sm text-gray-600">
          The scenario your students reference all unit. Edit the brief once,
          then append amendments (&quot;v2.0 — add LEDs&quot;) instead of
          rewriting in place. Changes save automatically when you leave a field
          or toggle a chip.
        </p>
      </div>

      {/* Phase F.B explainer banner — explain the locks model + Open default.
          Post-F.E polish: Lock all / Open all bulk buttons + live count. */}
      <div className="mb-6 rounded border border-purple-200 bg-purple-50 p-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-purple-900">
            <strong>🔒 Locks</strong>
            <span className="ml-1 font-medium" data-testid="locks-count-summary">
              ({lockedCount} of {totalLockable} locked)
            </span>
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handleLockAll}
              disabled={allLocked || saving}
              data-testid="locks-lock-all"
              className="inline-flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white ring-1 ring-inset ring-purple-700 hover:bg-purple-700 disabled:opacity-40"
            >
              <span aria-hidden="true">🔒</span> Lock all
            </button>
            <button
              type="button"
              onClick={handleUnlockAll}
              disabled={noneLocked || saving}
              data-testid="locks-unlock-all"
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-40"
            >
              <span aria-hidden="true">🔓</span> Open all
            </button>
          </div>
        </div>
        <p className="text-xs text-purple-900">
          Every field is <em>Open</em> by default — students can fill or override.
          Lock fields that are non-negotiable; open fields are the spaces students
          get to author.
        </p>
      </div>

      {/* Section 1 — Brief prose */}
      <section className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <label htmlFor="brief_text" className="text-sm font-medium text-gray-700">
            Brief
          </label>
          <LockToggle
            field="brief_text"
            locked={locks["brief_text"] === true}
            onToggle={handleToggleLock}
            disabled={saving}
          />
        </div>
        <textarea
          id="brief_text"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          onBlur={handleBriefTextBlur}
          placeholder="Describe the scenario, the client, the brief students are designing for…"
          rows={8}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </section>

      {/* Section 2 — Spec diagram (upload / preview / replace / remove) */}
      <DiagramUploader
        unitId={unitId}
        diagramUrl={diagramUrl}
        onUploaded={(next) => {
          setDiagramUrl(next);
          setLastSavedAt(new Date());
          setSaveError(null);
        }}
        onError={(msg) => setSaveError(msg)}
        disabled={saving}
        lockToggle={
          <LockToggle
            field="diagram_url"
            locked={locks["diagram_url"] === true}
            onToggle={handleToggleLock}
            disabled={saving}
          />
        }
      />

      {/* Section 3 — Constraints (Design only) */}
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-700">
          Constraints
        </h2>
        {isDesignUnit && constraints.archetype === "design" ? (
          <DesignConstraintsEditor
            value={constraints.data}
            onChange={(nextData) =>
              handleConstraintsChange({ archetype: "design", data: nextData })
            }
            locks={locks}
            onToggleLock={handleToggleLock}
            disabled={saving}
          />
        ) : (
          <p
            className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
            data-testid="non-design-fallback-banner"
          >
            Structured constraints are available for Design units. This unit
            (type: <strong>{unitType}</strong>) uses prose-only brief — keep
            the constraints in the brief field above.
          </p>
        )}
      </section>

      {/* Section 4 — Amendments */}
      <section>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Amendments</h2>
        <AmendmentsEditor
          amendments={amendments}
          onAdd={handleAddAmendment}
          disabled={saving}
        />
      </section>
    </div>
  );
}

interface SaveStatusPillProps {
  saving: boolean;
  saveError: string | null;
  lastSavedAt: Date | null;
}

/**
 * Persistent save-status indicator next to the page heading. Three states
 * visible from a glance: saving / saved / error. Idle (no save yet) is
 * hidden so a fresh editor session doesn't shout a misleading "Saved ✓".
 */
function SaveStatusPill({ saving, saveError, lastSavedAt }: SaveStatusPillProps) {
  if (saveError) {
    return (
      <span
        role="alert"
        data-testid="save-status-error"
        className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800 ring-1 ring-inset ring-red-300"
      >
        <span aria-hidden="true">✗</span> {saveError}
      </span>
    );
  }
  if (saving) {
    return (
      <span
        aria-live="polite"
        data-testid="save-status-saving"
        className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 ring-1 ring-inset ring-indigo-200"
      >
        <span aria-hidden="true" className="animate-pulse">●</span> Saving…
      </span>
    );
  }
  if (lastSavedAt) {
    return (
      <span
        aria-live="polite"
        data-testid="save-status-saved"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200"
      >
        <span aria-hidden="true">✓</span> Saved
      </span>
    );
  }
  return null;
}
