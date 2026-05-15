"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { UnitBriefEditor } from "@/components/teacher/unit-brief/UnitBriefEditor";
import { StudentBriefsTab } from "@/components/teacher/unit-brief/StudentBriefsTab";

/**
 * Teacher Brief & Constraints page. Fetches the unit's basic metadata
 * (title, unit_type) once, then renders one of two tabs:
 *   - "Brief"          — the authoring editor (UnitBriefEditor)
 *   - "Student briefs" — Phase F.E read-only review of per-student
 *                        overrides (StudentBriefsTab)
 *
 * Local tab state — no URL deeplink in v1 (deferred — students
 * shouldn't share URLs into the teacher review surface anyway).
 */
type TabKey = "brief" | "students";

export default function UnitBriefPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  const { unitId } = use(params);
  const [unitTitle, setUnitTitle] = useState<string | null>(null);
  const [unitType, setUnitType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("brief");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    // Lesson #24 + #83: prod hasn't applied migration 051 (`unit_type`
    // column) — the schema-registry lists it but `FU-PROD-MIGRATION-BACKLOG-
    // AUDIT` (P1) flags the drift. select("*") tolerates the column being
    // missing, then defaults to "design" (the only structurally-supported
    // archetype in v1; non-Design fallback banner will reactivate once 051
    // lands in prod). Don't switch to explicit column lists here without
    // probing prod first.
    void supabase
      .from("units")
      .select("*")
      .eq("id", unitId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
        } else if (!data) {
          setError("Unit not found.");
        } else {
          setUnitTitle((data.title as string | null) ?? null);
          setUnitType((data.unit_type as string | null) ?? "design");
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  if (loading) {
    return <div className="p-8 text-gray-500">Loading unit…</div>;
  }
  if (error || unitType === null) {
    return (
      <div className="p-8 text-red-600">
        {error ?? "Could not load this unit."}
      </div>
    );
  }

  return (
    <>
      {/* Tab bar — Phase F.E. Local state; no URL deeplink. Centred at
          the same max-w-3xl as the editor below so tabs align visually
          with the editor content. */}
      <div className="mx-auto max-w-3xl px-6 pt-6">
        <nav
          className="flex items-center gap-2 border-b border-gray-200"
          role="tablist"
          aria-label="Brief sections"
        >
          <TabButton
            tab="brief"
            active={tab === "brief"}
            onClick={() => setTab("brief")}
          >
            Brief
          </TabButton>
          <TabButton
            tab="students"
            active={tab === "students"}
            onClick={() => setTab("students")}
          >
            Student briefs
          </TabButton>
        </nav>
      </div>

      {tab === "brief" ? (
        <UnitBriefEditor
          unitId={unitId}
          unitTitle={unitTitle}
          unitType={unitType}
        />
      ) : (
        <div className="mx-auto max-w-3xl px-6 py-6">
          <StudentBriefsTab unitId={unitId} />
        </div>
      )}
    </>
  );
}

function TabButton({
  tab,
  active,
  onClick,
  children,
}: {
  tab: TabKey;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={`brief-tab-${tab}`}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-indigo-600 text-indigo-700"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
