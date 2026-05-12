"use client";

// ArchetypeOverridesEditor — REUSABLE editor for any archetype-aware
// block. Renders an accordion of archetype rows; each row shows the
// current task (truncated) and expands to per-archetype textareas for
// framing / task / success_signal / examples (newline-separated) /
// prompts (newline-separated). "Reset to default" clears the override
// for that archetype. "+ Add archetype" appends a new entry from a
// suggestion list.
//
// Not Inspiration-Board-specific: drop this into any block's config
// panel and pass the block's archetype_overrides + onChange.
//
// Convention: keys are stable archetype IDs from
// PRODUCT_BRIEF_ARCHETYPES + optional card-slug keys for brief-specific
// variants. We surface both in the suggestion list.

import { useMemo, useState } from "react";

export interface ArchetypeOverrideEntry {
  framing?: string;
  task?: string;
  success_signal?: string;
  examples?: string[];
  prompts?: string[];
  [key: string]: unknown;
}

export type ArchetypeOverridesMap = Record<string, ArchetypeOverrideEntry>;

interface ArchetypeOption {
  id: string;
  label: string;
}

// Suggestion list — surfaced when teachers click "+ Add archetype".
// Card-slug entries appear at the bottom under a divider.
const ARCHETYPE_SUGGESTIONS: ArchetypeOption[] = [
  { id: "toy-design", label: "Toy / Game Design" },
  { id: "architecture-interior", label: "Architecture / Interior" },
  { id: "film-video", label: "Film / Video" },
  { id: "app-digital-tool", label: "App / Digital Tool" },
  { id: "fashion-wearable", label: "Fashion / Wearable" },
  { id: "event-service-performance", label: "Event / Service / Performance" },
];

const CARD_SLUG_SUGGESTIONS: ArchetypeOption[] = [
  { id: "g8-brief-designer-mentor", label: "G8 brief: Designer Mentor" },
  { id: "g8-brief-studio-theme", label: "G8 brief: Studio Theme" },
  { id: "g8-brief-scaffold", label: "G8 brief: Scaffold" },
  { id: "g8-brief-1m2-space", label: "G8 brief: 1m² Space" },
  { id: "g8-brief-desktop-object", label: "G8 brief: Desktop Object" },
  { id: "g8-brief-board-game", label: "G8 brief: Board Game" },
];

interface Props {
  overrides: ArchetypeOverridesMap | undefined;
  onChange: (next: ArchetypeOverridesMap) => void;
}

export default function ArchetypeOverridesEditor({ overrides, onChange }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const map = overrides ?? {};
  const entries = useMemo(() => Object.entries(map), [map]);

  const labelFor = (id: string): string => {
    return (
      ARCHETYPE_SUGGESTIONS.find((s) => s.id === id)?.label ??
      CARD_SLUG_SUGGESTIONS.find((s) => s.id === id)?.label ??
      id
    );
  };

  const isCardSlug = (id: string) =>
    CARD_SLUG_SUGGESTIONS.some((s) => s.id === id);

  function update(archetypeId: string, patch: ArchetypeOverrideEntry) {
    const next: ArchetypeOverridesMap = { ...map };
    next[archetypeId] = { ...next[archetypeId], ...patch };
    // Strip undefined to keep payload clean
    const entry = next[archetypeId];
    for (const k of Object.keys(entry)) {
      if (entry[k] === undefined || entry[k] === "") {
        delete entry[k];
      }
    }
    onChange(next);
  }

  function reset(archetypeId: string) {
    if (!window.confirm(`Reset "${labelFor(archetypeId)}" to base content?`))
      return;
    const next: ArchetypeOverridesMap = { ...map };
    delete next[archetypeId];
    onChange(next);
  }

  function addArchetype(id: string) {
    if (map[id]) return;
    onChange({ ...map, [id]: {} });
    setExpanded(id);
    setShowAddMenu(false);
  }

  // Only show suggestions that don't already have an entry.
  const availableArchetypes = ARCHETYPE_SUGGESTIONS.filter((s) => !map[s.id]);
  const availableCardSlugs = CARD_SLUG_SUGGESTIONS.filter((s) => !map[s.id]);

  return (
    <div className="rounded-lg border border-pink-200 bg-pink-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <span>🎭</span>
          <label className="text-[12px] font-bold text-pink-900">
            Archetype overrides ({entries.length})
          </label>
        </div>
        <button
          type="button"
          onClick={() => setShowAddMenu((v) => !v)}
          className="rounded-full bg-pink-600 px-2.5 py-0.5 text-[11px] font-bold text-white hover:bg-pink-700"
        >
          + Add
        </button>
      </div>

      <p className="mb-2 text-[10.5px] leading-snug text-pink-700">
        Per-project framing variants. Students see the override for their
        archetype; everyone else sees the base block content. Universal
        archetypes match Product Brief IDs; card-slug entries match
        specific Choice Cards seeded picks.
      </p>

      {showAddMenu && (
        <div className="mb-2 max-h-48 overflow-auto rounded-lg border border-pink-200 bg-white p-2 text-[11px]">
          {availableArchetypes.length === 0 && availableCardSlugs.length === 0 ? (
            <div className="px-2 py-3 text-center text-zinc-500">
              All built-in archetypes already have an entry.
            </div>
          ) : (
            <>
              {availableArchetypes.length > 0 && (
                <div className="mb-1">
                  <div className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    Archetypes
                  </div>
                  {availableArchetypes.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => addArchetype(opt.id)}
                      className="block w-full rounded px-1.5 py-1 text-left hover:bg-pink-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
              {availableCardSlugs.length > 0 && (
                <div>
                  <div className="border-t border-zinc-100 px-1.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    G8 card-slug overrides
                  </div>
                  {availableCardSlugs.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => addArchetype(opt.id)}
                      className="block w-full rounded px-1.5 py-1 text-left hover:bg-pink-50"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {entries.length === 0 && !showAddMenu && (
        <div className="rounded border border-dashed border-pink-200 bg-white p-2 text-[11px] text-pink-700">
          No overrides yet. Click + Add to vary framing/task per archetype.
        </div>
      )}

      <div className="space-y-1.5">
        {entries.map(([id, entry]) => {
          const isOpen = expanded === id;
          return (
            <div
              key={id}
              className="rounded border border-pink-200 bg-white"
            >
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : id)}
                className="flex w-full items-start justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-pink-50/60"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-pink-900">
                    {isCardSlug(id) && "🎯 "}
                    {labelFor(id)}
                  </div>
                  <div className="truncate text-[11px] text-zinc-600">
                    {entry.task ?? entry.framing ?? "No override fields set yet"}
                  </div>
                </div>
                <span className="text-[11px] text-zinc-500">
                  {isOpen ? "▲" : "▼"}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-zinc-100 p-2.5">
                  <Field
                    label="Framing"
                    placeholder="Optional context that sets up the activity"
                    value={entry.framing ?? ""}
                    onChange={(v) => update(id, { framing: v })}
                  />
                  <Field
                    label="Task"
                    placeholder="The student-facing instruction"
                    value={entry.task ?? ""}
                    onChange={(v) => update(id, { task: v })}
                  />
                  <Field
                    label="Success signal"
                    placeholder="What good looks like"
                    value={entry.success_signal ?? ""}
                    onChange={(v) => update(id, { success_signal: v })}
                  />
                  <Field
                    label="Examples (one per line)"
                    placeholder="Optional"
                    value={(entry.examples ?? []).join("\n")}
                    rows={3}
                    onChange={(v) =>
                      update(id, {
                        examples: v.split("\n").map((s) => s.trim()).filter(Boolean),
                      })
                    }
                  />
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => reset(id)}
                      className="text-[11px] font-semibold text-rose-700 hover:underline"
                    >
                      Reset to default
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-wide text-zinc-600">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-md border border-zinc-200 px-2 py-1.5 text-[12px] focus:border-pink-400 focus:outline-none"
      />
    </div>
  );
}
