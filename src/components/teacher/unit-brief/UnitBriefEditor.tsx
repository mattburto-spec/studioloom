"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
} from "@/types/unit-brief";
import { DesignConstraintsEditor } from "./DesignConstraintsEditor";
import { AmendmentsEditor } from "./AmendmentsEditor";

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
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    async (patch: { brief_text?: string | null; constraints?: UnitBriefConstraints }) => {
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
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">
          Brief &amp; Constraints
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          The scenario your students reference all unit. Edit the brief once,
          then append amendments (&quot;v2.0 — add LEDs&quot;) instead of
          rewriting in place.
        </p>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {saveError}
        </div>
      )}
      {saving && (
        <div className="mb-4 text-xs text-gray-500" aria-live="polite">
          Saving…
        </div>
      )}

      {/* Section 1 — Brief prose */}
      <section className="mb-8">
        <label
          htmlFor="brief_text"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Brief
        </label>
        <textarea
          id="brief_text"
          value={briefText}
          onChange={(e) => setBriefText(e.target.value)}
          onBlur={handleBriefTextBlur}
          placeholder="Describe the scenario, the client, the brief students are designing for…"
          rows={8}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Saved when you leave the field.
        </p>
      </section>

      {/* Section 2 — Constraints (Design only) */}
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

      {/* Section 3 — Amendments */}
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
