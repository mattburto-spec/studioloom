"use client";

/**
 * AssignClassesToLabModal — Phase 8.1d-3 (PH8-FU-CLASS-LAB-ASSIGN).
 *
 * Lets the teacher pick which of their classes use this lab as their
 * default. Multi-select checkbox list. Save fires N PATCHes (one per
 * class whose state changed) — could batch but N is small (a teacher
 * has maybe 4-8 classes), and PATCH per class is more atomic.
 *
 * Save is non-destructive on classes already pointing at OTHER labs:
 *   - tick → class.default_lab_id = this lab (overrides any prior)
 *   - untick → class.default_lab_id = null (legacy "show all" mode)
 *
 * Doesn't try to be a class CRUD page — just this one operation.
 */

import * as React from "react";

interface ClassRow {
  id: string;
  name: string;
  code: string;
  default_lab_id: string | null;
}

interface Props {
  labId: string;
  labName: string;
  onClose: () => void;
  onSaved: () => void;
}

interface LoadState {
  kind: "loading" | "ready" | "error";
  classes: ClassRow[];
  errorMessage: string | null;
}

export function AssignClassesToLabModal({
  labId,
  labName,
  onClose,
  onSaved,
}: Props) {
  const [loadState, setLoadState] = React.useState<LoadState>({
    kind: "loading",
    classes: [],
    errorMessage: null,
  });
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/teacher/fabrication/classes", {
          credentials: "same-origin",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          if (!cancelled) {
            setLoadState({
              kind: "error",
              classes: [],
              errorMessage:
                body.error || `Couldn't load classes (HTTP ${res.status})`,
            });
          }
          return;
        }
        const data = (await res.json()) as { classes: ClassRow[] };
        if (cancelled) return;
        const classes = data.classes ?? [];
        setLoadState({ kind: "ready", classes, errorMessage: null });
        // Pre-tick classes already pointing at this lab.
        const initial = new Set<string>();
        for (const c of classes) {
          if (c.default_lab_id === labId) initial.add(c.id);
        }
        setPicked(initial);
      } catch (e) {
        if (!cancelled) {
          setLoadState({
            kind: "error",
            classes: [],
            errorMessage: e instanceof Error ? e.message : "Network error",
          });
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [labId]);

  function togglePick(classId: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  async function save() {
    if (loadState.kind !== "ready") return;
    setSubmitting(true);

    // Build the list of changes: classes whose desired state differs
    // from the current state.
    const changes: Array<{ classId: string; defaultLabId: string | null }> = [];
    for (const c of loadState.classes) {
      const wantsThisLab = picked.has(c.id);
      const currentlyThisLab = c.default_lab_id === labId;
      if (wantsThisLab && !currentlyThisLab) {
        changes.push({ classId: c.id, defaultLabId: labId });
      } else if (!wantsThisLab && currentlyThisLab) {
        changes.push({ classId: c.id, defaultLabId: null });
      }
    }

    if (changes.length === 0) {
      onClose();
      return;
    }

    try {
      for (const change of changes) {
        const res = await fetch(
          `/api/teacher/fabrication/classes/${change.classId}/default-lab`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ defaultLabId: change.defaultLabId }),
          }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "" }));
          alert(
            body.error || `Update failed for class ${change.classId} (HTTP ${res.status})`
          );
          setSubmitting(false);
          return;
        }
      }
      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Classes using "{labName}"
        </h2>
        <p className="text-sm text-gray-600">
          Tick each class whose students should see this lab's machines
          when they upload. Untick to fall back to "show all teacher
          machines" (legacy mode).
        </p>

        {loadState.kind === "loading" && (
          <p className="text-sm text-gray-500 italic">Loading classes…</p>
        )}

        {loadState.kind === "error" && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {loadState.errorMessage}
          </div>
        )}

        {loadState.kind === "ready" && loadState.classes.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            You don't have any classes yet.
          </p>
        )}

        {loadState.kind === "ready" && loadState.classes.length > 0 && (
          <ul className="space-y-1.5">
            {loadState.classes.map((c) => {
              const otherLabId =
                c.default_lab_id && c.default_lab_id !== labId
                  ? c.default_lab_id
                  : null;
              return (
                <li key={c.id}>
                  <label className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={picked.has(c.id)}
                      onChange={() => togglePick(c.id)}
                      className="mt-0.5"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-900">
                        {c.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({c.code})
                      </span>
                      {otherLabId && (
                        <span className="block text-xs text-amber-700 mt-0.5">
                          Currently using a different lab — ticking will move
                          it here.
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-sm px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={submitting || loadState.kind !== "ready"}
            className="text-sm px-3 py-1.5 rounded bg-brand-purple text-white hover:bg-brand-purple/90 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
