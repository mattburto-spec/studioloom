"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveUnit } from "@/lib/classes/active-unit";

// ---------------------------------------------------------------------------
// Past units on this class (DT canvas Phase 3.4 Step 3, 16 May 2026).
// Linked from the canvas-header kebab "Past units on this class" item.
// Lists ALL class_units for the class — both active and soft-removed past
// rows. Each row links to that unit's canvas; past rows have a "Make active"
// button that fires the public.set_active_unit RPC + navigates to the new
// active canvas.
//
// Same data shape as ChangeUnitModal (Phase 3.3 Step 2) but rendered as a
// full page with more breathing room — better for browsing a long history
// of past units on a class. The modal stays for the quick mid-canvas swap.
// ---------------------------------------------------------------------------

interface ClassUnitRow {
  unit_id: string;
  is_active: boolean;
  forked_at: string | null;
  title: string;
  unit_type: string | null;
  is_published: boolean | null;
}

export default function ClassUnitsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const router = useRouter();
  const [className, setClassName] = useState("");
  const [rows, setRows] = useState<ClassUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        // NOTE (17 May 2026): `units.unit_type` is omitted from this
        // select because prod is missing migration 051 (
        // FU-PROD-MIGRATION-BACKLOG-AUDIT — P1 in the master CLAUDE.md
        // index). Display layer falls back to "design" via
        // `unit_type ?? "design"`. Re-add when migration 051 lands on
        // prod. `is_published` is also dropped — wasn't rendered in
        // the row UI; the ownership decision lives on the server-side
        // set_active_unit RPC (migration 20260516052310) not here.
        const [classRes, cuRes] = await Promise.all([
          supabase.from("classes").select("name").eq("id", classId).single(),
          supabase
            .from("class_units")
            .select("unit_id, is_active, forked_at, units(title)")
            .eq("class_id", classId)
            .order("is_active", { ascending: false })
            .order("forked_at", { ascending: false, nullsFirst: false }),
        ]);
        if (cancelled) return;
        if (classRes.data?.name) setClassName(classRes.data.name);
        if (cuRes.error) {
          setError(`Failed to load units: ${cuRes.error.message}`);
          return;
        }
        const mapped: ClassUnitRow[] = (cuRes.data || []).map((r: { unit_id: string; is_active: boolean; forked_at: string | null; units: { title: string } | { title: string }[] | null }) => {
          const u = Array.isArray(r.units) ? r.units[0] : r.units;
          return {
            unit_id: r.unit_id,
            is_active: r.is_active,
            forked_at: r.forked_at,
            title: u?.title || "(untitled unit)",
            unit_type: null,
            is_published: null,
          };
        });
        setRows(mapped);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load units");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [classId]);

  async function makeActive(targetUnitId: string) {
    setActivatingId(targetUnitId);
    setError(null);
    try {
      const supabase = createClient();
      const result = await setActiveUnit(supabase, classId, targetUnitId);
      if (!result.ok) {
        if (result.code === "42501") {
          setError("You don't have permission to attach that unit to this class. The unit must be one you authored or one that's published.");
        } else if (result.code === "23505") {
          setError("Another active unit on this class blocked the swap. Refresh and try again.");
        } else {
          setError(`Failed: ${result.error}`);
        }
        return;
      }
      router.push(`/teacher/units/${targetUnitId}/class/${classId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setActivatingId(null);
    }
  }

  const active = rows.find((r) => r.is_active);
  const past = rows.filter((r) => !r.is_active);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <Link href={`/teacher/classes/${classId}`} className="hover:text-text-primary transition">
          {className || "Class"}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="text-text-primary font-medium">Past units</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-1">
        Units on {className || "this class"}
      </h1>
      <p className="text-sm text-text-secondary mb-6">
        Currently active + past units. Click a unit to open its canvas, or
        re-activate a past unit to bring it to the front.
      </p>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-sm text-text-secondary">
            No units have ever been assigned to this class.
          </p>
          <Link
            href={`/teacher/classes/${classId}`}
            className="mt-3 inline-block text-purple-600 text-sm font-medium hover:underline"
          >
            ← Back to class
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {active && (
            <section>
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">
                Currently active
              </div>
              <UnitRow
                row={active}
                classId={classId}
                activatingId={activatingId}
                onMakeActive={makeActive}
              />
            </section>
          )}
          {past.length > 0 && (
            <section>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
                Past units ({past.length})
              </div>
              <div className="space-y-2">
                {past.map((r) => (
                  <UnitRow
                    key={r.unit_id}
                    row={r}
                    classId={classId}
                    activatingId={activatingId}
                    onMakeActive={makeActive}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {error && (
        <div
          data-testid="class-units-error"
          role="alert"
          className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
        >
          {error}
        </div>
      )}
    </main>
  );
}

function UnitRow({
  row,
  classId,
  activatingId,
  onMakeActive,
}: {
  row: ClassUnitRow;
  classId: string;
  activatingId: string | null;
  onMakeActive: (unitId: string) => void;
}) {
  const isActivating = activatingId === row.unit_id;
  const isBusy = activatingId !== null;
  return (
    <div
      data-testid={`class-units-row-${row.unit_id}`}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        row.is_active ? "border-emerald-200 bg-emerald-50/40" : "border-border bg-white hover:bg-surface-alt"
      } transition`}
    >
      <div className="flex-1 min-w-0">
        <Link
          href={`/teacher/units/${row.unit_id}/class/${classId}`}
          className="text-sm font-semibold text-text-primary hover:text-purple-700 transition truncate inline-block max-w-full"
        >
          {row.title}
        </Link>
        <p className="text-[11px] text-text-secondary mt-0.5">
          {row.unit_type ?? "design"} ·{" "}
          {row.is_active ? "active on this class" : "past"}
          {row.forked_at && (
            <> · forked {new Date(row.forked_at).toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" })}</>
          )}
        </p>
      </div>
      {row.is_active ? (
        <span className="text-[11px] font-semibold text-emerald-700 px-2.5 py-1 rounded-full bg-emerald-100">
          On screen
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMakeActive(row.unit_id)}
          disabled={isBusy}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActivating ? "Switching…" : "Make active"}
        </button>
      )}
    </div>
  );
}
