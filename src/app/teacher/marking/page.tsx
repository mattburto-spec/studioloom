"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPageList } from "@/lib/unit-adapter";
import { getGradingScale, type CurriculumFrameworkId } from "@/lib/constants";
import type { UnitContentData } from "@/types";
import { resolveClassUnitContent } from "@/lib/units/resolve-content";
import { extractTilesFromPage, tileProgress, type LessonTile } from "@/lib/grading/lesson-tiles";
import { ScorePill } from "@/components/grading/ScorePill";
import { ScoreSelector } from "@/components/grading/ScoreSelector";

export default function MarkingPage() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("class");

  if (!classId) {
    return <ClassPicker />;
  }
  return <CalibrateView classId={classId} />;
}

// ════════════════════════════════════════════════════════════════════════════
// Class picker (no-params landing — Option B per Q1.1.A)
// ════════════════════════════════════════════════════════════════════════════

interface ClassRow {
  id: string;
  name: string;
  framework: string | null;
  studentCount: number;
  unitCount: number;
}

function ClassPicker() {
  const [classes, setClasses] = useState<ClassRow[] | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data: classData } = await supabase
        .from("classes")
        .select("id, name, framework")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (!classData) {
        setClasses([]);
        return;
      }

      const ids = classData.map((c) => c.id);
      const [studentsRes, classUnitsRes] = await Promise.all([
        supabase.from("class_students").select("class_id").in("class_id", ids).eq("is_active", true),
        supabase.from("class_units").select("class_id, is_active").in("class_id", ids),
      ]);

      const studentCounts: Record<string, number> = {};
      for (const s of studentsRes.data ?? []) {
        studentCounts[s.class_id] = (studentCounts[s.class_id] || 0) + 1;
      }
      const unitCounts: Record<string, number> = {};
      for (const cu of classUnitsRes.data ?? []) {
        if (cu.is_active !== false) {
          unitCounts[cu.class_id] = (unitCounts[cu.class_id] || 0) + 1;
        }
      }

      setClasses(
        classData.map((c) => ({
          id: c.id,
          name: c.name,
          framework: c.framework,
          studentCount: studentCounts[c.id] ?? 0,
          unitCount: unitCounts[c.id] ?? 0,
        })),
      );
    })();
  }, []);

  if (classes === null) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-sm text-gray-500">Loading…</div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Marking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pick a class to start the Calibrate flow. Tiles load from the most-recently-edited unit.
        </p>
      </header>

      {classes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500">
          No active classes yet.{" "}
          <Link href="/teacher/classes" className="text-purple-600 font-semibold hover:underline">
            Create one →
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/marking?class=${c.id}`}
              className="group flex items-center justify-between gap-4 px-5 py-4 bg-white border border-gray-200 rounded-2xl hover:border-purple-300 hover:shadow-sm transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base font-bold text-gray-900 group-hover:text-purple-700 transition">
                    {c.name}
                  </span>
                  {c.framework && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                      {c.framework.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {c.studentCount} student{c.studentCount === 1 ? "" : "s"} · {c.unitCount} unit
                  {c.unitCount === 1 ? "" : "s"}
                </p>
              </div>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gray-300 group-hover:text-purple-500 transition flex-shrink-0"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Calibrate view (when ?class=X is present)
// ════════════════════════════════════════════════════════════════════════════

interface ClassDetail {
  id: string;
  name: string;
  framework: CurriculumFrameworkId | string;
  subject: string | null;
}

interface UnitDetail {
  id: string;
  title: string;
  contentData: UnitContentData | null;
}

interface StudentRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface TileGradeRow {
  id: string;
  student_id: string;
  page_id: string;
  tile_id: string;
  score: number | null;
  confirmed: boolean;
  ai_pre_score: number | null;
  criterion_keys: string[];
}

function CalibrateView({ classId }: { classId: string }) {
  const [klass, setKlass] = useState<ClassDetail | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grades, setGrades] = useState<Record<string, TileGradeRow>>({});
  const [activeTileIdx, setActiveTileIdx] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Compose a stable key for the grade map.
  const gradeKey = (studentId: string, tileId: string, pageId: string) =>
    `${studentId}::${pageId}::${tileId}`;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();

      // Class
      const { data: cls } = await supabase
        .from("classes")
        .select("id, name, framework, subject")
        .eq("id", classId)
        .single();
      if (!cls) {
        setLoadError("Class not found, or you don't have permission to view it.");
        setLoading(false);
        return;
      }
      setKlass(cls as ClassDetail);

      // All units assigned to this class, with the embedded master unit row.
      // We sort by the master unit's updated_at client-side because Supabase's
      // .order on a joined relation column is brittle across JS-client versions.
      // Filter is_active === true OR null (legacy class_unit rows pre-migration
      // sometimes have is_active = null even though the column DEFAULTs true).
      const { data: classUnitsRaw, error: cuErr } = await supabase
        .from("class_units")
        .select("unit_id, is_active, content_data, units(id, title, content_data, updated_at)")
        .eq("class_id", classId);

      if (cuErr) {
        setLoadError(`Failed to load units for this class: ${cuErr.message}`);
        setLoading(false);
        return;
      }

      type ClassUnitJoined = {
        unit_id: string;
        is_active: boolean | null;
        content_data: UnitContentData | null;
        units: { id: string; title: string; content_data: UnitContentData | null; updated_at: string } | null;
      };
      const allClassUnits = (classUnitsRaw ?? []) as ClassUnitJoined[];

      if (allClassUnits.length === 0) {
        setLoadError(
          "No units assigned to this class. Open the class page and add a unit before marking.",
        );
        setLoading(false);
        return;
      }

      // Active or unset is_active counts as active. Drop rows where the
      // joined unit row is null (orphaned class_units pointing at deleted
      // units — defensive only, shouldn't happen with FK CASCADE).
      const active = allClassUnits
        .filter((cu) => cu.is_active !== false && cu.units !== null)
        .sort((a, b) =>
          (b.units?.updated_at ?? "").localeCompare(a.units?.updated_at ?? ""),
        );

      if (active.length === 0) {
        setLoadError(
          `This class has ${allClassUnits.length} unit(s), but all are marked inactive. ` +
            `Reactivate one from the class page to start marking.`,
        );
        setLoading(false);
        return;
      }

      const cu = active[0];
      const unitRow = cu.units!;
      const masterContent = unitRow.content_data ?? ({ version: 2, pages: [] } as UnitContentData);
      const resolved = resolveClassUnitContent(masterContent, cu.content_data);

      const unitDetail: UnitDetail = {
        id: unitRow.id,
        title: unitRow.title,
        contentData: resolved,
      };
      setUnit(unitDetail);

      const pages = getPageList(resolved);
      const firstWithSections = pages.find((p) => (p.content?.sections ?? []).length > 0);
      if (!firstWithSections) {
        setLoadError("This unit has no gradeable tiles yet.");
        setLoading(false);
        return;
      }
      setActivePageId(firstWithSections.id);

      // Students enrolled in the class (junction-first, Lesson #22).
      const { data: enrolment } = await supabase
        .from("class_students")
        .select("student_id, students(id, display_name, username, avatar_url)")
        .eq("class_id", classId)
        .eq("is_active", true);

      type EnrolmentRow = {
        student_id: string;
        students: { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
      };
      const cohort: StudentRow[] = (enrolment ?? []).map((row) => {
        const r = row as EnrolmentRow;
        return {
          id: r.students.id,
          display_name: r.students.display_name,
          username: r.students.username,
          avatar_url: r.students.avatar_url,
        };
      });
      setStudents(cohort);

      // Existing grades for this class+unit.
      const { data: gradeRows } = await supabase
        .from("student_tile_grades")
        .select("id, student_id, page_id, tile_id, score, confirmed, ai_pre_score, criterion_keys")
        .eq("class_id", classId)
        .eq("unit_id", unitDetail.id);

      const map: Record<string, TileGradeRow> = {};
      for (const g of (gradeRows ?? []) as TileGradeRow[]) {
        map[gradeKey(g.student_id, g.tile_id, g.page_id)] = g;
      }
      setGrades(map);
      setLoading(false);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unexpected error loading data.");
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const activePage = useMemo(() => {
    if (!unit?.contentData || !activePageId) return undefined;
    return getPageList(unit.contentData).find((p) => p.id === activePageId);
  }, [unit, activePageId]);

  const tiles = useMemo<LessonTile[]>(() => {
    if (!activePage) return [];
    return extractTilesFromPage(activePage, {
      framework: klass?.framework ?? undefined,
      unitType: klass?.subject ?? undefined,
    });
  }, [activePage, klass]);

  const activeTile = tiles[activeTileIdx];

  const scale = useMemo(
    () => getGradingScale(klass?.framework ?? "IB_MYP"),
    [klass?.framework],
  );

  // Confirmed counts per tile for the strip progress label.
  const confirmedRows = useMemo(
    () =>
      Object.values(grades)
        .filter((g) => g.page_id === activePageId)
        .map((g) => ({ tile_id: g.tile_id, confirmed: g.confirmed })),
    [grades, activePageId],
  );

  // Resolve neutral criterion keys for the write — for G1.1.3 we trust that
  // the section's first criterionTags entry is already in the 8-key vocabulary
  // OR matches one of the framework-criterion keys. Validation is enforced
  // server-side (saveTileGrade.validateCriterionKeys + DB CHECK). The full
  // FrameworkAdapter normalisation chain is wired in G1.4.
  const NEUTRAL = new Set([
    "researching", "analysing", "designing", "creating",
    "evaluating", "reflecting", "communicating", "planning",
  ]);
  const FRAMEWORK_TO_NEUTRAL_HINT: Record<string, string[]> = {
    A: ["researching", "analysing"],
    B: ["designing"],
    C: ["creating"],
    D: ["evaluating"],
  };
  function resolveNeutralKeys(rawTags: string[]): string[] {
    const out = new Set<string>();
    for (const t of rawTags) {
      if (NEUTRAL.has(t)) {
        out.add(t);
        continue;
      }
      const hint = FRAMEWORK_TO_NEUTRAL_HINT[t];
      if (hint) hint.forEach((h) => out.add(h));
    }
    return Array.from(out);
  }

  async function saveTile(studentId: string, score: number | null, confirmed: boolean) {
    if (!klass || !unit || !activePageId || !activeTile) return;
    const key = gradeKey(studentId, activeTile.tileId, activePageId);
    setSavingKey(key);
    try {
      const criterionKeys = resolveNeutralKeys(activeTile.criterionTags);
      const res = await fetch("/api/teacher/grading/tile-grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          unit_id: unit.id,
          page_id: activePageId,
          tile_id: activeTile.tileId,
          class_id: klass.id,
          score,
          confirmed,
          criterion_keys: criterionKeys,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `Save failed (${res.status})`);
      }
      // Optimistic refresh of just this row from the response.
      const newRow = json.grade as TileGradeRow;
      setGrades((prev) => ({ ...prev, [key]: newRow }));
    } catch (err) {
      // Surface inline; full error UX in G1.2.
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 text-sm text-gray-500">
        Loading marking view…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/teacher/marking" className="text-sm text-purple-600 hover:underline">
          ← Back to classes
        </Link>
        <div className="mt-4 p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          {loadError}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="mb-6">
        <Link href="/teacher/marking" className="text-xs text-gray-500 hover:text-purple-600 transition">
          ← All classes
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-1">
          Marking · <span className="text-gray-500 font-bold">{klass?.name}</span>
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {unit?.title} · {scale.type === "percentage" ? "Percentage" : `Scale ${scale.min}–${scale.max}`}
        </p>
      </header>

      {/* Tile strip */}
      <div className="mb-6 -mx-1 overflow-x-auto">
        <div className="flex gap-2 px-1 pb-2">
          {tiles.map((tile, idx) => {
            const isActive = idx === activeTileIdx;
            const { confirmed, total } = tileProgress(tile.tileId, students.length, confirmedRows);
            return (
              <button
                key={tile.tileId}
                type="button"
                onClick={() => setActiveTileIdx(idx)}
                className={[
                  "flex-shrink-0 text-left px-3 py-2.5 rounded-xl border transition min-w-[180px] max-w-[260px]",
                  isActive
                    ? "bg-white border-purple-400 shadow-sm"
                    : "bg-white/60 border-gray-200 hover:border-gray-300",
                ].join(" ")}
                aria-pressed={isActive}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white tracking-wide"
                    style={{ background: tile.criterionColor }}
                  >
                    {tile.criterionLabel.split(" ")[0]}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                    {confirmed}/{total}
                  </span>
                </div>
                <div className="text-xs font-semibold text-gray-700 leading-snug line-clamp-2">
                  {tile.title}
                </div>
                {/* progress bar */}
                <div className="mt-1.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: total === 0 ? 0 : `${(confirmed / total) * 100}%`,
                      background: tile.criterionColor,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active tile prompt */}
      {activeTile && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-2xl">
          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
            {activeTile.criterionLabel}
          </div>
          <p className="text-sm text-gray-800 mt-1 leading-relaxed">{activeTile.title}</p>
        </div>
      )}

      {/* Per-student rows */}
      <div className="space-y-2">
        {students.length === 0 ? (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
            No students enrolled in this class yet.
          </div>
        ) : (
          students.map((s) => {
            if (!activePageId || !activeTile) return null;
            const key = gradeKey(s.id, activeTile.tileId, activePageId);
            const grade = grades[key];
            const score = grade?.score ?? null;
            const confirmed = grade?.confirmed ?? false;
            const aiPreScore = grade?.ai_pre_score ?? null;
            const isSaving = savingKey === key;
            const displayName = s.display_name?.trim() || s.username?.trim() || "(unnamed)";
            const initials = displayName
              .split(/\s+/)
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={s.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 bg-white border border-gray-200 rounded-2xl"
              >
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover bg-gray-100"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                      {initials}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                  <p className="text-[11px] text-gray-400 italic">
                    {/* AI quote slot — empty until G1.3 */}
                    AI evidence quote will appear here in G1.3.
                  </p>
                </div>

                {/* Score selector (input) */}
                <ScoreSelector
                  scale={scale}
                  value={score}
                  onChange={(next) => void saveTile(s.id, next, false)}
                  disabled={isSaving}
                />

                {/* Score pill (display) */}
                <ScorePill
                  scale={scale}
                  score={score}
                  confirmed={confirmed}
                  aiPreScore={aiPreScore}
                />

                {/* Confirm button */}
                <button
                  type="button"
                  onClick={() => {
                    if (score === null) {
                      alert("Set a score first.");
                      return;
                    }
                    void saveTile(s.id, score, !confirmed);
                  }}
                  disabled={isSaving || score === null}
                  className={[
                    "px-3 py-1.5 text-xs font-bold rounded-lg border transition",
                    confirmed
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-white text-purple-700 border-purple-200 hover:bg-purple-50",
                    isSaving || score === null ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {isSaving ? "…" : confirmed ? "Confirmed" : "Confirm"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
