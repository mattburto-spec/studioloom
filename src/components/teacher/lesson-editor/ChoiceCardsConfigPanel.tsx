"use client";

// Choice Cards — inline config panel in the lesson editor.
//
// Renders inside ActivityBlock.tsx when the section's responseType is
// "choice-cards". Surfaces:
//   - Layout chip picker (Grid functional in v1; Fan/Stack greyed → FU)
//   - Selection mode (Single only in v1; Multi greyed → FU)
//   - "Include pitch-your-own card" toggle
//   - Selected cards summary + "Pick cards for this deck" button
//
// Modal lives in ChoiceCardsLibraryPicker.

import { useEffect, useState } from "react";
import type { ChoiceCardsBlockConfig } from "./BlockPalette.types";
import ChoiceCardsLibraryPicker from "./ChoiceCardsLibraryPicker";

interface CardSummary {
  id: string;
  label: string;
  emoji: string | null;
  bg_color: string | null;
  image_url: string | null;
}

interface Props {
  config: ChoiceCardsBlockConfig | undefined;
  onUpdate: (next: ChoiceCardsBlockConfig) => void;
}

const DEFAULT_CONFIG: ChoiceCardsBlockConfig = {
  cardIds: [],
  selectionMode: "single",
  showPitchYourOwn: false,
  layout: "grid",
};

export default function ChoiceCardsConfigPanel({ config, onUpdate }: Props) {
  const cfg = config ?? DEFAULT_CONFIG;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [summaries, setSummaries] = useState<CardSummary[]>([]);

  // Fetch lightweight summaries for the selected cards so the panel can
  // show emoji + label chips. Uses the teacher library endpoint with
  // exact-id filtering via the q parameter is too loose; instead we
  // fetch the full library matching the configured tags and filter
  // client-side. v1 trick — `tags=` empty pulls all, capped at 200.
  useEffect(() => {
    let cancelled = false;
    if (cfg.cardIds.length === 0) {
      setSummaries([]);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/teacher/choice-cards/library`, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const byId = new Map<string, CardSummary>(
          (data.cards ?? []).map((c: CardSummary) => [c.id, c]),
        );
        setSummaries(
          cfg.cardIds.map((id) => byId.get(id)).filter((c): c is CardSummary => !!c),
        );
      } catch {
        // non-fatal — summaries just stay empty
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [cfg.cardIds]);

  function removeCard(id: string) {
    onUpdate({ ...cfg, cardIds: cfg.cardIds.filter((cid) => cid !== id) });
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
      <div className="flex items-center gap-1.5">
        <span>🃏</span>
        <label className="text-[12px] font-bold text-emerald-900">Choice Cards deck</label>
      </div>

      {/* Layout chip picker */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-800">Layout</div>
        <div className="flex gap-1.5">
          {(["grid", "fan", "stack"] as const).map((layout) => {
            const active = cfg.layout === layout;
            const disabled = layout !== "grid"; // v1 only Grid
            return (
              <button
                key={layout}
                type="button"
                disabled={disabled}
                onClick={() => onUpdate({ ...cfg, layout })}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-emerald-800 hover:bg-emerald-100"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                title={disabled ? "Coming soon" : undefined}
              >
                {layout}
                {disabled && " — soon"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection mode */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-800">Selection</div>
        <div className="flex gap-1.5">
          {(["single", "multi"] as const).map((mode) => {
            const active = cfg.selectionMode === mode;
            const disabled = mode === "multi";
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                onClick={() => onUpdate({ ...cfg, selectionMode: mode })}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  active
                    ? "bg-emerald-600 text-white"
                    : "bg-white text-emerald-800 hover:bg-emerald-100"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                title={disabled ? "Coming soon" : undefined}
              >
                {mode}
                {disabled && " — soon"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pitch-your-own toggle */}
      <label className="flex items-center gap-2 text-[12px] text-emerald-900">
        <input
          type="checkbox"
          checked={cfg.showPitchYourOwn}
          onChange={(e) => onUpdate({ ...cfg, showPitchYourOwn: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
        />
        <span>
          <strong>Include &quot;pitch your own&quot;</strong> — adds a dashed card for students with a different idea
        </span>
      </label>

      {/* Selected cards summary */}
      <div>
        <div className="mb-1 text-[11px] uppercase tracking-wide text-emerald-800">
          Cards in deck ({cfg.cardIds.length})
        </div>
        {cfg.cardIds.length === 0 ? (
          <div className="rounded border border-dashed border-emerald-300 bg-white p-2 text-[11px] text-emerald-700">
            No cards yet. Click below to pick from the library or create new ones.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cfg.cardIds.map((id) => {
              const s = summaries.find((sm) => sm.id === id);
              return (
                <div
                  key={id}
                  className="group inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] text-emerald-900"
                >
                  <span>{s?.emoji ?? "🃏"}</span>
                  <span>{s?.label ?? id}</span>
                  <button
                    type="button"
                    onClick={() => removeCard(id)}
                    className="ml-0.5 hidden text-rose-600 hover:text-rose-800 group-hover:inline"
                    aria-label={`Remove ${s?.label ?? id}`}
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-bold text-white hover:bg-emerald-700"
        >
          {cfg.cardIds.length === 0 ? "Pick cards for this deck" : "Edit deck"}
        </button>
      </div>

      <ChoiceCardsLibraryPicker
        open={pickerOpen}
        selectedIds={cfg.cardIds}
        onClose={() => setPickerOpen(false)}
        onSave={(cardIds) => {
          onUpdate({ ...cfg, cardIds });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
