"use client";

/* ================================================================
 * /teacher/classes/[classId]/exhibition
 *
 * PYPX Exhibition setup page. One stop for the teacher to configure
 * dates, milestones, mentor assignments, and per-student projects.
 * Entered via a gradient "Exhibition" button in the class header
 * that only renders when class.framework === "IB_PYP".
 *
 * Phase 13a-3 — this commit is the scaffold: header, breadcrumb,
 * unit picker, and placeholder cards for the Dates (13a-4) and
 * Student Projects (13a-5) sections.
 * ================================================================ */

import { useCallback, useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ClassInfo {
  id: string;
  name: string;
  framework: string | null;
}

interface UnitOption {
  id: string;
  title: string;
}

export default function ExhibitionSetupPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadClass = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Class basics
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, name, framework")
      .eq("id", classId)
      .maybeSingle();

    if (clsErr || !cls) {
      setError("Class not found");
      setLoading(false);
      return;
    }

    // PYP-only gate — deflect non-PYP teachers back to the class page.
    if (cls.framework !== "IB_PYP") {
      router.replace(`/teacher/classes/${classId}`);
      return;
    }

    setClassInfo(cls);

    // Active units for this class so the teacher can pick WHICH
    // class_unit the Exhibition config lives on. Rare to have more
    // than one, but PYP classes could run a mini-exhibition + the
    // final Exhibition in the same year.
    const { data: classUnits } = await supabase
      .from("class_units")
      .select("unit_id, units!inner(id, title)")
      .eq("class_id", classId)
      .eq("is_active", true);

    const unitOptions: UnitOption[] = (classUnits ?? [])
      .map((cu) => {
        const u = cu.units as unknown as { id: string; title: string } | null;
        return u ? { id: u.id, title: u.title } : null;
      })
      .filter((u): u is UnitOption => u !== null);

    setUnits(unitOptions);
    setSelectedUnitId(unitOptions[0]?.id ?? null);
    setLoading(false);
  }, [classId, router]);

  useEffect(() => {
    loadClass();
  }, [loadClass]);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-64 bg-gray-200 rounded" />
          <div className="h-10 w-96 bg-gray-200 rounded" />
          <div className="h-40 bg-gray-100 rounded-2xl" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
          <p className="text-rose-600 mb-4">{error}</p>
          <Link
            href="/teacher/classes"
            className="text-sm font-semibold text-purple-700 hover:underline"
          >
            ← Back to classes
          </Link>
        </div>
      </main>
    );
  }

  if (!classInfo) return null;

  return (
    <main className="max-w-5xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <nav
        className="text-sm text-gray-500 flex items-center gap-1.5 mb-3"
        aria-label="Breadcrumb"
      >
        <Link href="/teacher/classes" className="hover:text-gray-900">
          Classes
        </Link>
        <span>›</span>
        <Link
          href={`/teacher/classes/${classId}`}
          className="hover:text-gray-900"
        >
          {classInfo.name}
        </Link>
        <span>›</span>
        <span className="font-semibold text-gray-900">Exhibition</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div
            className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-[0.08em] uppercase rounded-full px-2.5 py-1 mb-2"
            style={{ background: "#FAF5FF", color: "#6B21A8" }}
          >
            <span aria-hidden>🌱</span> PYP Exhibition
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Exhibition setup
          </h1>
          <p className="text-sm text-gray-600 mt-1 max-w-xl">
            Set dates, assign mentors, and seed each student&apos;s project.
            Students take over their own inquiry from their dashboard once the
            PYPX student view ships.
          </p>
        </div>

        {/* Unit picker — hidden if only one unit */}
        {units.length > 1 && (
          <div className="shrink-0">
            <label
              htmlFor="exhibition-unit-picker"
              className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1"
            >
              Exhibition unit
            </label>
            <select
              id="exhibition-unit-picker"
              value={selectedUnitId ?? ""}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* No unit yet — guide the teacher to assign one before setting up
       *  Exhibition. */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <div className="text-4xl mb-3">📘</div>
          <h2 className="text-lg font-bold text-gray-900">
            No Exhibition unit assigned yet
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-md mx-auto">
            Assign a unit to this class from the units library, then come back
            here to set dates, mentors, and projects.
          </p>
          <Link
            href="/teacher/units"
            className="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-full text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #9333EA 0%, #C026D3 100%)",
            }}
          >
            Browse units →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Dates card — wired in 13a-4. */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Exhibition dates
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  The big day plus any milestones you want to track — rehearsal,
                  boards due, research checkpoints.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                Coming next
              </span>
            </div>
            <div className="mt-4 py-8 text-center text-sm text-gray-400 italic">
              Dates editor arrives in the next build step.
            </div>
          </section>

          {/* Student projects card — wired in 13a-5. */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  Student projects
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  One row per enrolled student — project title, central idea,
                  transdisciplinary theme, mentor, current phase.
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
                Coming next
              </span>
            </div>
            <div className="mt-4 py-8 text-center text-sm text-gray-400 italic">
              Projects table arrives in the next build step.
            </div>
          </section>

          {/* Debug footer — shows which unit we're editing. Will be
           *  subsumed into the real cards once they're wired. */}
          {selectedUnit && (
            <div className="text-[11px] text-gray-400 text-center">
              Editing Exhibition config for unit:{" "}
              <span className="font-semibold">{selectedUnit.title}</span>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
