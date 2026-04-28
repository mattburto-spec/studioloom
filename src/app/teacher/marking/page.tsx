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
  ai_quote?: string | null;
  ai_confidence?: number | null;
  ai_reasoning?: string | null;
  criterion_keys: string[];
  override_note?: string | null;
}

function CalibrateView({ classId }: { classId: string }) {
  const [klass, setKlass] = useState<ClassDetail | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [grades, setGrades] = useState<Record<string, TileGradeRow>>({});
  // student_progress.responses, keyed: studentId → tileId → response text.
  const [responses, setResponses] = useState<Record<string, Record<string, string>>>({});
  const [activeTileIdx, setActiveTileIdx] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [overrideNoteDraft, setOverrideNoteDraft] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [aiBatchRunning, setAiBatchRunning] = useState(false);
  const [aiBatchSummary, setAiBatchSummary] = useState<string | null>(null);

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
        .select(
          "id, student_id, page_id, tile_id, score, confirmed, ai_pre_score, ai_quote, ai_confidence, ai_reasoning, criterion_keys, override_note",
        )
        .eq("class_id", classId)
        .eq("unit_id", unitDetail.id);

      const map: Record<string, TileGradeRow> = {};
      const noteDraftMap: Record<string, string> = {};
      for (const g of (gradeRows ?? []) as (TileGradeRow & { override_note?: string | null })[]) {
        const k = gradeKey(g.student_id, g.tile_id, g.page_id);
        map[k] = g;
        if (g.override_note) noteDraftMap[k] = g.override_note;
      }
      setGrades(map);
      setOverrideNoteDraft(noteDraftMap);

      // Student responses for the active page (drives the override panel's
      // "see the actual work" view). Keyed by tile_id matching response keys
      // produced by the student page (`activity_<id>` / `section_<idx>`).
      const cohortIds = cohort.map((s) => s.id);
      if (cohortIds.length > 0) {
        const { data: progressRows } = await supabase
          .from("student_progress")
          .select("student_id, page_id, responses")
          .eq("unit_id", unitDetail.id)
          .eq("page_id", firstWithSections.id)
          .in("student_id", cohortIds);

        type ProgressRow = {
          student_id: string;
          page_id: string;
          responses: Record<string, unknown> | null;
        };
        const responseMap: Record<string, Record<string, string>> = {};
        for (const p of (progressRows ?? []) as ProgressRow[]) {
          if (!p.responses || typeof p.responses !== "object") continue;
          const stringResponses: Record<string, string> = {};
          for (const [k, v] of Object.entries(p.responses)) {
            if (typeof v === "string") stringResponses[k] = v;
          }
          responseMap[p.student_id] = stringResponses;
        }
        setResponses(responseMap);
      }

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

  async function saveTile(
    studentId: string,
    score: number | null,
    confirmed: boolean,
    extras: { override_note?: string | null } = {},
  ) {
    if (!klass || !unit || !activePageId || !activeTile) return;
    const key = gradeKey(studentId, activeTile.tileId, activePageId);
    setSavingKey(key);
    try {
      const criterionKeys = resolveNeutralKeys(activeTile.criterionTags);
      const payload: Record<string, unknown> = {
        student_id: studentId,
        unit_id: unit.id,
        page_id: activePageId,
        tile_id: activeTile.tileId,
        class_id: klass.id,
        score,
        confirmed,
        criterion_keys: criterionKeys,
      };
      if (extras.override_note !== undefined) payload.override_note = extras.override_note;
      const res = await fetch("/api/teacher/grading/tile-grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `Save failed (${res.status})`);
      }
      // Optimistic refresh of just this row from the response.
      const newRow = json.grade as TileGradeRow;
      setGrades((prev) => ({ ...prev, [key]: newRow }));
      // If the override_note round-tripped, sync the draft state so the
      // textarea no longer shows "Unsaved" after a successful save.
      if (extras.override_note !== undefined) {
        setOverrideNoteDraft((prev) => ({
          ...prev,
          [key]: newRow.override_note ?? "",
        }));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function runAiPrescoreBatch() {
    if (!klass || !unit || !activePageId || !activeTile) return;
    if (students.length === 0) return;
    setAiBatchRunning(true);
    setAiBatchSummary(null);
    try {
      const res = await fetch("/api/teacher/grading/tile-grades/ai-prescore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          class_id: klass.id,
          unit_id: unit.id,
          page_id: activePageId,
          tile_id: activeTile.tileId,
          student_ids: students.map((s) => s.id),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? `AI batch failed (${res.status})`);
      }
      type Result = {
        student_id: string;
        ok: boolean;
        error?: string;
      };
      const results = (json.results as Result[]) ?? [];
      const okCount = results.filter((r) => r.ok).length;
      const errCount = results.length - okCount;
      setAiBatchSummary(
        errCount === 0
          ? `AI suggested ${okCount} score${okCount === 1 ? "" : "s"}.`
          : `AI suggested ${okCount}; ${errCount} failed (see console).`,
      );
      if (errCount > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          "[ai-prescore] failures:",
          results.filter((r) => !r.ok),
        );
      }
      // Reload grades from DB so ai_pre_score / ai_quote / ai_confidence
      // populate via the same shape the loader uses.
      await loadAll();
    } catch (err) {
      setAiBatchSummary(err instanceof Error ? err.message : "AI batch failed");
    } finally {
      setAiBatchRunning(false);
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

      {/* Active tile prompt + AI batch trigger */}
      {activeTile && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400">
                {activeTile.criterionLabel}
              </div>
              <p className="text-sm text-gray-800 mt-1 leading-relaxed">{activeTile.title}</p>
            </div>
            <button
              type="button"
              onClick={() => void runAiPrescoreBatch()}
              disabled={aiBatchRunning || students.length === 0}
              className={[
                "flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border transition",
                aiBatchRunning
                  ? "bg-purple-50 text-purple-400 border-purple-200 cursor-wait"
                  : "bg-gradient-to-br from-purple-600 to-violet-600 text-white border-purple-700 hover:from-purple-700 hover:to-violet-700 shadow-sm",
                students.length === 0 ? "opacity-50 cursor-not-allowed" : "",
              ].join(" ")}
              title="Run Haiku 4.5 across the cohort. Suggestions are unconfirmed until you Confirm each row."
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
              </svg>
              {aiBatchRunning ? "Suggesting…" : `AI suggest (${students.length})`}
            </button>
          </div>
          {aiBatchSummary && (
            <p className="mt-2 text-[11px] text-gray-500 italic">{aiBatchSummary}</p>
          )}
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
            const isExpanded = expandedStudentId === s.id;
            const responseText = responses[s.id]?.[activeTile.tileId] ?? "";
            const noteDraft = overrideNoteDraft[key] ?? "";
            const persistedNote =
              ((grade as TileGradeRow & { override_note?: string | null })
                ?.override_note ?? "") || "";
            const noteDirty = noteDraft !== persistedNote;
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
                className={[
                  "bg-white border rounded-2xl transition-shadow",
                  isExpanded ? "border-purple-300 shadow-md" : "border-gray-200",
                ].join(" ")}
              >
                {/* ── Compact row ── */}
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3">
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
                    {grade?.ai_quote ? (
                      <p
                        className="text-[11px] text-purple-700 italic line-clamp-1"
                        title={grade.ai_reasoning ?? undefined}
                      >
                        <span aria-hidden="true">✦ </span>&ldquo;{grade.ai_quote}&rdquo;
                      </p>
                    ) : (
                      <p className="text-[11px] text-gray-400 italic line-clamp-1">
                        {responseText
                          ? `"${responseText.slice(0, 90)}${responseText.length > 90 ? "…" : ""}"`
                          : "No submission yet"}
                      </p>
                    )}
                  </div>

                  <ScoreSelector
                    scale={scale}
                    value={score}
                    onChange={(next) => void saveTile(s.id, next, false)}
                    disabled={isSaving}
                  />

                  <ScorePill
                    scale={scale}
                    score={score}
                    confirmed={confirmed}
                    aiPreScore={aiPreScore}
                  />

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

                  {/* Expand chevron */}
                  <button
                    type="button"
                    onClick={() => setExpandedStudentId(isExpanded ? null : s.id)}
                    className="w-7 h-7 rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition flex items-center justify-center"
                    aria-label={isExpanded ? "Collapse details" : "Expand details"}
                    aria-expanded={isExpanded}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>

                {/* ── Override panel (G1.2) ── */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50/40 rounded-b-2xl">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5">
                      {/* Student work */}
                      <div>
                        <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                          Student response
                        </div>
                        {responseText ? (
                          <div className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap bg-white border border-gray-200 rounded-xl p-4 max-h-[420px] overflow-y-auto">
                            {responseText}
                          </div>
                        ) : (
                          <div className="text-sm italic text-gray-500 bg-white border border-dashed border-gray-300 rounded-xl p-4">
                            {displayName} hasn&rsquo;t submitted on this tile yet.
                          </div>
                        )}
                      </div>

                      {/* Score + note column */}
                      <div className="space-y-4">
                        {grade?.ai_pre_score !== null && grade?.ai_pre_score !== undefined && (
                          <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase text-purple-700 mb-1">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
                              </svg>
                              AI suggestion
                              {typeof grade.ai_confidence === "number" && (
                                <span className="ml-auto text-[10px] font-mono text-purple-500">
                                  conf {Math.round(grade.ai_confidence * 100)}%
                                </span>
                              )}
                            </div>
                            {grade.ai_quote && (
                              <p className="text-xs italic text-gray-800 leading-relaxed">
                                &ldquo;{grade.ai_quote}&rdquo;
                              </p>
                            )}
                            {grade.ai_reasoning && (
                              <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed">
                                {grade.ai_reasoning}
                              </p>
                            )}
                            {typeof grade.ai_pre_score === "number" && score !== grade.ai_pre_score && (
                              <button
                                type="button"
                                onClick={() => void saveTile(s.id, grade.ai_pre_score!, true)}
                                disabled={isSaving}
                                className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-md bg-white border border-purple-300 text-purple-700 hover:bg-purple-50 transition disabled:opacity-50"
                              >
                                Accept AI ({grade.ai_pre_score})
                              </button>
                            )}
                          </div>
                        )}

                        <div>
                          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                            Score
                          </div>
                          <ScoreSelector
                            scale={scale}
                            value={score}
                            onChange={(next) => void saveTile(s.id, next, false)}
                            disabled={isSaving}
                          />
                        </div>

                        <div>
                          <div className="text-[10px] font-bold tracking-wider uppercase text-gray-400 mb-2">
                            Override note <span className="font-normal lowercase tracking-normal text-gray-400">(private to you)</span>
                          </div>
                          <textarea
                            value={noteDraft}
                            onChange={(e) =>
                              setOverrideNoteDraft((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="Why this score over what the rubric defaults to? Anchored to specific evidence is best."
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          />
                          <div className="flex items-center justify-end gap-2 mt-2">
                            {noteDirty && (
                              <span className="text-[11px] text-amber-600 font-semibold">Unsaved</span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                void saveTile(s.id, score, confirmed, {
                                  override_note: noteDraft.trim() === "" ? null : noteDraft,
                                })
                              }
                              disabled={isSaving || !noteDirty}
                              className={[
                                "px-3 py-1.5 text-xs font-bold rounded-lg transition",
                                noteDirty
                                  ? "bg-purple-600 text-white hover:bg-purple-700"
                                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
                              ].join(" ")}
                            >
                              {isSaving ? "Saving…" : "Save note"}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-end pt-2 border-t border-gray-200">
                          <button
                            type="button"
                            onClick={() => setExpandedStudentId(null)}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-700 transition"
                          >
                            Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
