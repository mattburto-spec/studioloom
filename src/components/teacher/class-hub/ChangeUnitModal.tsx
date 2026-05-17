"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setActiveUnit } from "@/lib/classes/active-unit";

// ---------------------------------------------------------------------------
// ChangeUnitModal — pick a different unit to make active on this class
// (DT canvas Phase 3.3 Step 2, 16 May 2026; "Other units" section added
// 17 May 2026 after smoke flagged the no-add path).
//
// Sections:
//   1. Currently active           — the single is_active=true class_units row
//   2. Past units on this class   — soft-removed (is_active=false) class_units
//   3. Other units you can assign — units authored by the teacher OR published
//                                    in the library, NOT already on this class
//
// "Make active" on any row fires the atomic public.set_active_unit RPC
// (migration 20260515220845 + ownership-check 20260516052310). The RPC
// uses INSERT ON CONFLICT so creating the class_units row for an
// "other unit" + activating it happens in one transaction.
// ---------------------------------------------------------------------------

interface ClassUnitOption {
  unit_id: string;
  is_active: boolean;
  forked_at: string | null;
  title: string;
  unit_type: string | null;
}

interface AvailableUnit {
  unit_id: string;
  title: string;
  isYours: boolean;
  is_published: boolean;
}

interface ChangeUnitModalProps {
  classId: string;
  currentUnitId: string;
  className: string;
  onClose: () => void;
}

export default function ChangeUnitModal({
  classId,
  currentUnitId,
  className,
  onClose,
}: ChangeUnitModalProps) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<ClassUnitOption[]>([]);
  const [available, setAvailable] = useState<AvailableUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Load all class_units for this class (active + soft-removed).
  // Direct supabase query — RLS gates access to rows the teacher
  // owns. Joins units for title + unit_type.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        // NOTE (17 May 2026): `units.unit_type` is omitted from this
        // select because prod is missing migration 051 (
        // FU-PROD-MIGRATION-BACKLOG-AUDIT — P1 in the master CLAUDE.md
        // index). The display layer falls back to "design" via
        // `unit_type ?? "design"` — Matt's pilot is design-only so the
        // fallback is correct. Re-add `unit_type` to the select when
        // migration 051 lands on prod.
        const { data, error: qErr } = await supabase
          .from("class_units")
          .select("unit_id, is_active, forked_at, units(title)")
          .eq("class_id", classId)
          .order("is_active", { ascending: false })
          .order("forked_at", { ascending: false, nullsFirst: false });
        if (cancelled) return;
        if (qErr) {
          setError(`Failed to load units: ${qErr.message}`);
          return;
        }
        const rows: ClassUnitOption[] = (data || []).map((r: { unit_id: string; is_active: boolean; forked_at: string | null; units: { title: string } | { title: string }[] | null }) => {
          // supabase-js types the joined row as object | array depending
          // on FK cardinality. units is single per class_unit row but the
          // generated types may report array. Normalise.
          const u = Array.isArray(r.units) ? r.units[0] : r.units;
          return {
            unit_id: r.unit_id,
            is_active: r.is_active,
            forked_at: r.forked_at,
            title: u?.title || "(untitled unit)",
            unit_type: null,
          };
        });
        setOptions(rows);

        // Second query — "Other units you can assign". Matches the
        // set_active_unit RPC's ownership gate (migration
        // 20260516052310): units the teacher authored OR units that are
        // published in the library. Excludes anything already on this
        // class (active or past). Capped at 50 to keep the modal usable
        // even for teachers with large libraries; the units listing
        // page is the deeper browse surface.
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const existingIds = new Set(rows.map((r) => r.unit_id));
        const { data: avData, error: avErr } = await supabase
          .from("units")
          .select("id, title, author_teacher_id, is_published, updated_at")
          .or(`author_teacher_id.eq.${user.id},is_published.eq.true`)
          .order("updated_at", { ascending: false })
          .limit(80);
        if (cancelled) return;
        if (avErr) {
          // Non-fatal — currently-active + past sections still render.
          console.error("[ChangeUnitModal] available-units fetch failed:", avErr);
        } else {
          const filtered: AvailableUnit[] = (avData || [])
            .filter((u) => !existingIds.has(u.id))
            .slice(0, 30)
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
    if (targetUnitId === currentUnitId) {
      // Already active — close instead of round-tripping the RPC.
      onClose();
      return;
    }
    setActivatingId(targetUnitId);
    setError(null);
    try {
      const supabase = createClient();
      const result = await setActiveUnit(supabase, classId, targetUnitId);
      if (!result.ok) {
        // SQLSTATE-mapped friendly errors
        if (result.code === "42501") {
          setError("You don't have permission to attach that unit to this class. The unit must be one you authored or one that's published.");
        } else if (result.code === "23505") {
          setError("Another active unit on this class blocked the swap. Refresh and try again.");
        } else {
          setError(`Failed: ${result.error}`);
        }
        return;
      }
      // Success — navigate to the new unit's canvas.
      router.push(`/teacher/units/${targetUnitId}/class/${classId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setActivatingId(null);
    }
  }

  const active = options.find((o) => o.is_active);
  const past = options.filter((o) => !o.is_active);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          data-testid="change-unit-modal"
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-gray-200 shrink-0 flex items-center justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900">Change unit</h2>
              <p className="text-xs text-gray-500 truncate">
                Pick a different unit to make active on{className ? ` ${className}` : " this class"}.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close change-unit modal"
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            {loading ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-14 bg-gray-100 rounded-lg" />
                <div className="h-14 bg-gray-100 rounded-lg" />
              </div>
            ) : (
              <>
                {active && (
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">
                      Currently active
                    </div>
                    <UnitRow
                      option={active}
                      isCurrent={active.unit_id === currentUnitId}
                      activatingId={activatingId}
                      onMakeActive={makeActive}
                    />
                  </div>
                )}
                {/* Past units — always rendered with explicit empty
                    state. Matches the Past units sub-route so the modal
                    + page tell the same story when history is empty. */}
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">
                    Past units on this class
                  </div>
                  {past.length === 0 ? (
                    <div
                      data-testid="change-unit-past-empty"
                      className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 text-[11px] text-gray-500 leading-relaxed"
                    >
                      No past units yet — swapping the active unit moves
                      the current one here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {past.map((opt) => (
                        <UnitRow
                          key={opt.unit_id}
                          option={opt}
                          isCurrent={opt.unit_id === currentUnitId}
                          activatingId={activatingId}
                          onMakeActive={makeActive}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600 mb-1">
                    Other units you can assign
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Pick one to assign + make active — your authored units and library favourites.
                  </p>
                  {available.length === 0 ? (
                    <div
                      data-testid="change-unit-available-empty"
                      className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-4 text-center text-xs text-gray-500"
                    >
                      No other units available.{" "}
                      <a href="/teacher/units" className="text-purple-600 font-medium hover:underline">
                        Browse the units library →
                      </a>
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
                        <a
                          href="/teacher/units"
                          className="text-[11px] text-purple-600 font-medium hover:underline"
                        >
                          Browse more in the units library →
                        </a>
                      </div>
                    </>
                  )}
                </div>
                {options.length === 0 && available.length === 0 && (
                  <p
                    data-testid="change-unit-modal-empty"
                    className="text-sm text-gray-500 text-center py-2"
                  >
                    No units have ever been assigned to this class, and you
                    don&apos;t have any authored or published units yet.
                  </p>
                )}
              </>
            )}

            {error && (
              <div
                data-testid="change-unit-modal-error"
                role="alert"
                className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700"
              >
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function UnitRow({
  option,
  isCurrent,
  activatingId,
  onMakeActive,
}: {
  option: ClassUnitOption;
  isCurrent: boolean;
  activatingId: string | null;
  onMakeActive: (unitId: string) => void;
}) {
  const isActivating = activatingId === option.unit_id;
  return (
    <div
      data-testid={`change-unit-row-${option.unit_id}`}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
        isCurrent ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-white hover:bg-gray-50"
      } transition`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{option.title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">
          {option.unit_type ?? "design"} · {option.is_active ? "active" : "past"}
          {option.forked_at && (
            <> · forked {new Date(option.forked_at).toLocaleDateString("en-AU", { month: "short", day: "numeric" })}</>
          )}
        </p>
      </div>
      {isCurrent ? (
        <span className="text-[11px] font-semibold text-emerald-700 px-2 py-1 rounded-full bg-emerald-100">
          On screen
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onMakeActive(option.unit_id)}
          disabled={activatingId !== null}
          className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActivating ? "Switching…" : option.is_active ? "Re-open" : "Make active"}
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
  return (
    <div
      data-testid={`change-unit-available-row-${option.unit_id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{option.title}</p>
        <div className="mt-0.5 flex items-center gap-2">
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
          <span className="text-[11px] text-gray-500">
            Not yet on this class
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onMakeActive(option.unit_id)}
        disabled={activatingId !== null}
        className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isActivating ? "Assigning…" : "Make active"}
      </button>
    </div>
  );
}
