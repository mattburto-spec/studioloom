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

interface AvailableUnit {
  unit_id: string;
  title: string;
  isYours: boolean;
  is_published: boolean;
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
  const [available, setAvailable] = useState<AvailableUnit[]>([]);
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

        // Available units (17 May 2026) — units the teacher authored OR
        // units that are published, NOT already on this class. Matches
        // the set_active_unit RPC's ownership gate so any row here is
        // safe to "Make active". Capped at 40; the units listing page
        // is the deeper browse surface for libraries with more.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const existingIds = new Set(mapped.map((m) => m.unit_id));
        const { data: avData, error: avErr } = await supabase
          .from("units")
          .select("id, title, author_teacher_id, is_published, updated_at")
          .or(`author_teacher_id.eq.${user.id},is_published.eq.true`)
          .order("updated_at", { ascending: false })
          .limit(80);
        if (cancelled) return;
        if (avErr) {
          // Non-fatal — the active + past sections still render.
          console.error("[ClassUnitsPage] available-units fetch failed:", avErr);
        } else {
          const filtered: AvailableUnit[] = (avData || [])
            .filter((u) => !existingIds.has(u.id))
            .slice(0, 40)
            .map((u) => ({
              unit_id: u.id,
              title: u.title || "(untitled unit)",
              isYours: u.author_teacher_id === user.id,
              is_published: !!u.is_published,
            }));
          setAvailable(filtered);
        }
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
        Currently active + past units. Click a unit to open its canvas,
        re-activate a past unit, or pick one from your authored / library
        units to assign + activate in one click.
      </p>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-16 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
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
          {/* Past units — always rendered (Matt's 17 May smoke flagged
              that hiding the section when empty made the page look
              broken: he arrived expecting to see history and saw
              nothing labelled as such). Empty-state copy explains
              where past rows come from + that pre-soft-toggle
              removes (before May 2026) hard-deleted the rows. */}
          <section>
            <div className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary mb-2">
              Past units ({past.length})
            </div>
            {past.length === 0 ? (
              <div
                data-testid="class-units-past-empty"
                className="rounded-xl border border-dashed border-border bg-surface-alt/40 px-4 py-4 text-xs text-text-secondary leading-relaxed"
              >
                No past units on this class yet. Units appear here after
                you swap to a different one — the previous unit moves to
                history with its content + per-class settings preserved
                so you can re-open it any time.
                {rows.length === 1 && (
                  <>
                    {" "}
                    <span className="text-text-tertiary">
                      (If you removed units before May 2026 they were
                      hard-deleted by the older code path and won&apos;t
                      appear — only soft-toggled rows survive here.)
                    </span>
                  </>
                )}
              </div>
            ) : (
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
            )}
          </section>
          <section>
            <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">
              Other units you can assign
            </div>
            <p className="text-[11px] text-text-secondary mb-2">
              Your authored units and library favourites. Pick one to
              assign and make active on this class.
            </p>
            {available.length === 0 ? (
              <div
                data-testid="class-units-available-empty"
                className="rounded-xl border border-dashed border-border bg-surface-alt/40 p-6 text-center text-sm text-text-secondary"
              >
                {rows.length === 0
                  ? "No units yet — this class has never had one assigned and you don't have any authored or published units to pull from."
                  : "No other units available."}{" "}
                <Link href="/teacher/units" className="text-purple-600 font-medium hover:underline">
                  Browse the units library →
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {available.map((opt) => (
                    <AvailableUnitRow
                      key={opt.unit_id}
                      option={opt}
                      activatingId={activatingId}
                      onMakeActive={makeActive}
                    />
                  ))}
                </div>
                <div className="mt-3 text-center">
                  <Link
                    href="/teacher/units"
                    className="text-xs text-purple-600 font-medium hover:underline"
                  >
                    Browse more in the units library →
                  </Link>
                </div>
              </>
            )}
          </section>
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

function AvailableUnitRow({
  option,
  activatingId,
  onMakeActive,
}: {
  option: AvailableUnit;
  activatingId: string | null;
  onMakeActive: (unitId: string) => void;
}) {
  const isActivating = activatingId === option.unit_id;
  const isBusy = activatingId !== null;
  return (
    <div
      data-testid={`class-units-available-row-${option.unit_id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-white hover:bg-surface-alt transition"
    >
      <div className="flex-1 min-w-0">
        <Link
          href={`/teacher/units/${option.unit_id}`}
          className="text-sm font-semibold text-text-primary hover:text-purple-700 transition truncate inline-block max-w-full"
        >
          {option.title}
        </Link>
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          {option.isYours && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
              Yours
            </span>
          )}
          {!option.isYours && option.is_published && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
              Library
            </span>
          )}
          <span className="text-[11px] text-text-secondary">
            Not yet on this class
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onMakeActive(option.unit_id)}
        disabled={isBusy}
        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isActivating ? "Assigning…" : "Make active"}
      </button>
    </div>
  );
}
