"use client";

/* Student projects inline editor (Phase 13a-5).
 *
 * One row per enrolled student. Columns: title · central idea ·
 * theme · mentor. Auto-save per row, debounced 600ms. Row status
 * indicator (saving / saved / error) sits in the right gutter.
 *
 * `current_phase` lives on the row in the API + DB but is NOT
 * editable here — it's an output (derived from student work + AI
 * analysis), not an input the teacher hand-sets. Reduces teacher
 * cognitive load + avoids drift between teacher's mental model and
 * the system's source of truth.
 *
 * Data layer:
 *  - GET  /api/teacher/student-projects?classId=…&unitId=…
 *      returns one entry per enrolled student (placeholder rows for
 *      students without a project yet — id === null).
 *  - POST /api/teacher/student-projects
 *      partial-merge upsert on (student_id, class_id, unit_id).
 *  - GET  /api/teacher/teachers/list
 *      same-school teachers for the mentor picker. Will swap to the
 *      Mentor Manager pool once that ships (see
 *      docs/projects/mentor-manager.md). FK on the row stays the
 *      same — this is just where the picker pulls from.
 *
 * Sort is alphabetical by display name (server-side), so adding a
 * project doesn't reshuffle rows. Empty roster → "Enrol students
 * first" banner per the 13a brief Don't-stop-for list.
 */

import { useCallback, useEffect, useRef, useState } from "react";

type ProjectPhase = "wonder" | "findout" | "make" | "share" | "reflect";

interface StudentProject {
  id: string | null;
  student_id: string;
  student_display_name: string;
  class_id: string;
  unit_id: string;
  title: string | null;
  central_idea: string | null;
  lines_of_inquiry: string[] | null;
  transdisciplinary_theme: string | null;
  mentor_teacher_id: string | null;
  current_phase: ProjectPhase | null;
  updated_at: string | null;
}

interface TeacherOption {
  id: string;
  name: string;
  email: string;
}

type RowSaveState = "idle" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE_MS = 600;

export function StudentProjectsCard({
  classId,
  unitId,
}: {
  classId: string;
  unitId: string;
}) {
  const [projects, setProjects] = useState<StudentProject[] | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Per-row save state, keyed by student_id (stable across saves; the
  // row's `id` flips from null → uuid on first save, but student_id
  // is the durable key).
  const [rowState, setRowState] = useState<Record<string, RowSaveState>>({});

  // Debounce timers per student_id so each row's edits coalesce
  // independently — typing in one row doesn't reset another's timer.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // ──────────────────────────────────────────────────────────────
  // Load roster + teachers
  // ──────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [projectsRes, teachersRes] = await Promise.all([
        fetch(
          `/api/teacher/student-projects?classId=${classId}&unitId=${unitId}`,
        ),
        fetch(`/api/teacher/teachers/list`),
      ]);

      if (!projectsRes.ok) {
        setLoadError(`Failed to load projects (${projectsRes.status})`);
        return;
      }
      const projJson: { projects: StudentProject[] } = await projectsRes.json();
      setProjects(projJson.projects);

      // Teachers list is non-critical — if it fails, the picker
      // degrades gracefully to a disabled select.
      if (teachersRes.ok) {
        const tJson: { teachers: TeacherOption[] } = await teachersRes.json();
        setTeachers(tJson.teachers);
      }
    } catch {
      setLoadError("Failed to load");
    }
  }, [classId, unitId]);

  useEffect(() => {
    load();
  }, [load]);

  // Cleanup any pending timers on unmount so we don't write into a
  // stale component.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Save: per-row debounced POST
  // ──────────────────────────────────────────────────────────────
  const flush = useCallback(
    async (project: StudentProject, patch: Partial<StudentProject>) => {
      setRowState((s) => ({ ...s, [project.student_id]: "saving" }));
      try {
        const res = await fetch("/api/teacher/student-projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            studentId: project.student_id,
            classId,
            unitId,
            ...patch,
          }),
        });
        if (!res.ok) {
          setRowState((s) => ({ ...s, [project.student_id]: "error" }));
          return;
        }
        const json: { project: StudentProject } = await res.json();
        // Merge server's authoritative row back so id, updated_at land.
        setProjects((curr) =>
          (curr ?? []).map((p) =>
            p.student_id === project.student_id
              ? {
                  ...p,
                  id: json.project.id,
                  updated_at: json.project.updated_at,
                }
              : p,
          ),
        );
        setRowState((s) => ({ ...s, [project.student_id]: "saved" }));
        // Settle "saved" pip back to idle after a moment.
        setTimeout(() => {
          setRowState((s) =>
            s[project.student_id] === "saved"
              ? { ...s, [project.student_id]: "idle" }
              : s,
          );
        }, 1500);
      } catch {
        setRowState((s) => ({ ...s, [project.student_id]: "error" }));
      }
    },
    [classId, unitId],
  );

  /** Schedule a save for a row — coalesces rapid edits. */
  const scheduleSave = useCallback(
    (project: StudentProject, patch: Partial<StudentProject>) => {
      const existing = timersRef.current.get(project.student_id);
      if (existing) clearTimeout(existing);
      const t = setTimeout(() => {
        timersRef.current.delete(project.student_id);
        flush(project, patch);
      }, SAVE_DEBOUNCE_MS);
      timersRef.current.set(project.student_id, t);
    },
    [flush],
  );

  /** Apply a local edit + schedule a save. The patch is what we
   *  send to the server (partial), `local` is what we merge into
   *  client state. */
  const editRow = useCallback(
    (
      project: StudentProject,
      local: Partial<StudentProject>,
      patch: Partial<StudentProject>,
    ) => {
      setProjects((curr) =>
        (curr ?? []).map((p) =>
          p.student_id === project.student_id ? { ...p, ...local } : p,
        ),
      );
      scheduleSave(project, patch);
    },
    [scheduleSave],
  );

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────
  if (projects === null && !loadError) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 bg-gray-200 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded" />
          <div className="h-10 w-full bg-gray-100 rounded" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Student projects
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            One row per enrolled student. Edits auto-save.
          </p>
        </div>
      </div>

      {loadError && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {loadError}
        </div>
      )}

      {projects && projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center">
          <div className="text-3xl mb-2">👥</div>
          <h3 className="text-sm font-bold text-gray-900">
            No students enrolled yet
          </h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Enrol students into this class first, then come back here to
            seed each project.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-gray-500 border-b border-gray-200">
                <th className="px-2 py-2 w-[140px]">Student</th>
                <th className="px-2 py-2">Project title</th>
                <th className="px-2 py-2">Central idea</th>
                <th className="px-2 py-2 w-[150px]">Theme</th>
                <th className="px-2 py-2 w-[170px]">Mentor</th>
                <th className="px-2 py-2 w-[28px]" aria-label="Save status" />
              </tr>
            </thead>
            <tbody>
              {(projects ?? []).map((p) => (
                <ProjectRow
                  key={p.student_id}
                  project={p}
                  teachers={teachers}
                  saveState={rowState[p.student_id] ?? "idle"}
                  onEdit={editRow}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// One row — receives the project + change handler, owns nothing.
// Keeping inputs uncontrolled-feel via value={... ?? ""} so empty
// state stays visually clean.
// ────────────────────────────────────────────────────────────────
function ProjectRow({
  project,
  teachers,
  saveState,
  onEdit,
}: {
  project: StudentProject;
  teachers: TeacherOption[];
  saveState: RowSaveState;
  onEdit: (
    project: StudentProject,
    local: Partial<StudentProject>,
    patch: Partial<StudentProject>,
  ) => void;
}) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0 align-top">
      <td className="px-2 py-2">
        <div className="text-[13px] font-semibold text-gray-900 truncate">
          {project.student_display_name}
        </div>
      </td>

      <td className="px-2 py-2">
        <input
          type="text"
          value={project.title ?? ""}
          placeholder="e.g. Plastic in the Yangtze"
          onChange={(e) => {
            const v = e.target.value || null;
            onEdit(project, { title: v }, { title: v });
          }}
          className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </td>

      <td className="px-2 py-2">
        <textarea
          value={project.central_idea ?? ""}
          rows={1}
          placeholder="Big idea — one sentence"
          onChange={(e) => {
            const v = e.target.value || null;
            onEdit(project, { central_idea: v }, { central_idea: v });
          }}
          className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px] resize-y min-h-[34px] focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </td>

      <td className="px-2 py-2">
        <input
          type="text"
          value={project.transdisciplinary_theme ?? ""}
          placeholder="e.g. Sharing the Planet"
          onChange={(e) => {
            const v = e.target.value || null;
            onEdit(
              project,
              { transdisciplinary_theme: v },
              { transdisciplinary_theme: v },
            );
          }}
          className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
      </td>

      <td className="px-2 py-2">
        <select
          value={project.mentor_teacher_id ?? ""}
          disabled={teachers.length === 0}
          onChange={(e) => {
            const v = e.target.value || null;
            onEdit(
              project,
              { mentor_teacher_id: v },
              { mentor_teacher_id: v },
            );
          }}
          className="w-full bg-white border border-gray-200 rounded-md px-2 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">— Unassigned —</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-2 py-2 text-center">
        <SaveStatusPip state={saveState} />
      </td>
    </tr>
  );
}

/** Tiny visual indicator — empty when idle, dot when saving, ✓ when
 *  saved, ! when error. Keeps the table compact. */
function SaveStatusPip({ state }: { state: RowSaveState }) {
  if (state === "saving") {
    return (
      <span
        className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse"
        title="Saving…"
        aria-label="Saving"
      />
    );
  }
  if (state === "saved") {
    return (
      <span
        className="text-[12px] font-bold text-emerald-600"
        title="Saved"
        aria-label="Saved"
      >
        ✓
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className="text-[12px] font-bold text-rose-600"
        title="Save failed"
        aria-label="Save failed"
      >
        !
      </span>
    );
  }
  return <span aria-hidden className="inline-block w-2 h-2" />;
}
