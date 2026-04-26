"use client";

/* Exhibition dates card (Phase 13a-4) — reads + writes
 * class_units.exhibition_config via /api/teacher/exhibition.
 *
 * Shape on wire:
 *   {
 *     exhibition_date: "YYYY-MM-DD" | null,
 *     milestones: [
 *       { id, label, date: "YYYY-MM-DD", type }
 *     ]
 *   }
 *
 * Mentor check-in schedule was originally in this card but moved to
 * the upcoming Mentor Manager (per-mentor, not per-class). The API
 * still accepts a payload that omits the field; existing JSONB rows
 * with a stale schedule key are dropped on next PATCH.
 *
 * Save strategy — explicit "Save" button per section so teachers don't
 * get surprised by auto-save on an every-keystroke basis. Milestones
 * array is full-array replacement server-side, so adding / removing
 * rows and then saving is safe.
 */

import { useCallback, useEffect, useState } from "react";

type MilestoneType = "rehearsal" | "deliverable" | "checkpoint" | "other";

interface Milestone {
  id: string;
  label: string;
  date: string;
  type: MilestoneType;
}

interface ExhibitionConfig {
  exhibition_date: string | null;
  milestones: Milestone[];
}

const MILESTONE_TYPES: { id: MilestoneType; label: string }[] = [
  { id: "rehearsal",   label: "Rehearsal" },
  { id: "deliverable", label: "Deliverable" },
  { id: "checkpoint",  label: "Checkpoint" },
  { id: "other",       label: "Other" },
];

/** Browser-safe stable id for new milestone rows. */
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function DatesCard({
  classId,
  unitId,
}: {
  classId: string;
  unitId: string;
}) {
  const [config, setConfig] = useState<ExhibitionConfig>({
    exhibition_date: null,
    milestones: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/exhibition?classId=${classId}&unitId=${unitId}`,
      );
      if (!res.ok) {
        // 404 = class_unit row exists but no exhibition_config yet — that's
        // fine, we just render empty state. Other 4xx/5xx = surface the
        // error.
        if (res.status === 404) {
          setConfig({
            exhibition_date: null,
            milestones: [],
          });
        } else {
          setError(`Failed to load (${res.status})`);
        }
        setLoading(false);
        return;
      }
      const json: { exhibition_config: ExhibitionConfig | null } =
        await res.json();
      setConfig({
        exhibition_date: json.exhibition_config?.exhibition_date ?? null,
        milestones: json.exhibition_config?.milestones ?? [],
      });
    } catch {
      setError("Failed to load");
    } finally {
      setLoading(false);
    }
  }, [classId, unitId]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/exhibition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          unitId,
          exhibition_date: config.exhibition_date,
          milestones: config.milestones,
        }),
      });
      if (!res.ok) {
        setError(`Save failed (${res.status})`);
      } else {
        setSavedAt(new Date());
      }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }, [classId, unitId, config]);

  function addMilestone() {
    setConfig((c) => ({
      ...c,
      milestones: [
        ...c.milestones,
        { id: newId(), label: "", date: "", type: "checkpoint" },
      ],
    }));
  }

  function updateMilestone(id: string, patch: Partial<Milestone>) {
    setConfig((c) => ({
      ...c,
      milestones: c.milestones.map((m) =>
        m.id === id ? { ...m, ...patch } : m,
      ),
    }));
  }

  function deleteMilestone(id: string) {
    setConfig((c) => ({
      ...c,
      milestones: c.milestones.filter((m) => m.id !== id),
    }));
  }

  // Sort milestones chronologically for display — empty dates sink to the
  // bottom so half-filled rows don't reshuffle unexpectedly.
  const sortedMilestones = [...config.milestones].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.localeCompare(b.date);
  });

  // Countdown pill — days between today and exhibition_date. Shown next
  // to the field when a date is set.
  let daysUntil: number | null = null;
  if (config.exhibition_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exh = new Date(config.exhibition_date + "T00:00:00");
    const diffMs = exh.getTime() - today.getTime();
    daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
  }

  if (loading) {
    return (
      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-40 bg-gray-200 rounded" />
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
            Exhibition dates
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            The big day plus any milestones you want to track — rehearsal,
            boards due, research checkpoints.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !saving && (
            <span className="text-[11px] text-emerald-600 font-semibold">
              Saved ✓
            </span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold text-white disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, #9333EA 0%, #C026D3 100%)",
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Exhibition date + countdown */}
      <div className="mb-5">
        <label
          htmlFor="exhibition-date"
          className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1"
        >
          Exhibition date
        </label>
        <div className="flex items-center gap-3">
          <input
            id="exhibition-date"
            type="date"
            value={config.exhibition_date ?? ""}
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                exhibition_date: e.target.value || null,
              }))
            }
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
          {daysUntil != null && (
            <span
              className="text-[11px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{
                background: daysUntil < 14 ? "#FEE2E2" : "#FAF5FF",
                color: daysUntil < 14 ? "#B91C1C" : "#6B21A8",
              }}
            >
              {daysUntil > 0
                ? `in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
                : daysUntil === 0
                  ? "today 🎉"
                  : `${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? "" : "s"} ago`}
            </span>
          )}
        </div>
      </div>

      {/* Milestones */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Milestones
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">
              Add rehearsals, deliverables, checkpoints — anything with a date.
            </div>
          </div>
          <button
            onClick={addMilestone}
            className="text-[12px] font-bold text-purple-700 hover:underline"
          >
            + Add milestone
          </button>
        </div>

        {sortedMilestones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-[12px] text-gray-400">
            No milestones yet. Click <span className="font-bold">+ Add milestone</span> to log the first one.
          </div>
        ) : (
          <ul className="space-y-2">
            {sortedMilestones.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[1fr_140px_120px_auto] gap-2 items-center bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
              >
                <input
                  type="text"
                  placeholder="Label (e.g. Rehearsal)"
                  value={m.label}
                  onChange={(e) =>
                    updateMilestone(m.id, { label: e.target.value })
                  }
                  className="bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <input
                  type="date"
                  value={m.date}
                  onChange={(e) =>
                    updateMilestone(m.id, { date: e.target.value })
                  }
                  className="bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
                <select
                  value={m.type}
                  onChange={(e) =>
                    updateMilestone(m.id, {
                      type: e.target.value as MilestoneType,
                    })
                  }
                  className="bg-white border border-gray-200 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  {MILESTONE_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => deleteMilestone(m.id)}
                  className="text-gray-400 hover:text-rose-600 transition px-2"
                  aria-label="Delete milestone"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
