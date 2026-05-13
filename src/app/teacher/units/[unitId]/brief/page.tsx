"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { UnitBriefEditor } from "@/components/teacher/unit-brief/UnitBriefEditor";

/**
 * Teacher Brief & Constraints editor page. Fetches the unit's basic
 * metadata (title, unit_type) to decide whether the Design constraints
 * section renders. The editor itself fetches the brief + amendments
 * via /api/teacher/unit-brief* endpoints.
 */
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
    <UnitBriefEditor
      unitId={unitId}
      unitTitle={unitTitle}
      unitType={unitType}
    />
  );
}
