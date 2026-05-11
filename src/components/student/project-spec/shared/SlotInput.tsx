"use client";

/**
 * SlotInput — dispatcher for the 5 input kinds the Project Spec
 * block family supports (text, text-multifield, chip-picker,
 * size-reference, number-pair).
 *
 * Extracted from v1's ProjectSpecResponse during the v2 split.
 * Consumed by v1 + all 3 v2 blocks. Purple styling kept uniform
 * across blocks for visual coherence (the per-block accent shows
 * in the BlockPalette card + the activity-card header, not inside
 * the inputs).
 */

import type { SlotInputType, SlotValue } from "@/lib/project-spec/archetypes";

export function SlotInput({
  input,
  value,
  onChange,
}: {
  input: SlotInputType;
  value: SlotValue | null;
  onChange: (v: SlotValue | null) => void;
}) {
  if (input.kind === "text") {
    const text = value?.kind === "text" ? value.text : "";
    return (
      <textarea
        value={text}
        onChange={(e) =>
          onChange(
            e.target.value ? { kind: "text", text: e.target.value } : null,
          )
        }
        placeholder="Type here…"
        className="w-full min-h-[80px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
      />
    );
  }

  if (input.kind === "text-multifield") {
    const values =
      value?.kind === "text-multifield"
        ? value.values
        : input.fields.map(() => "");
    return (
      <div className="space-y-2">
        {input.fields.map((field, i) => (
          <div key={i}>
            <label className="block text-xs font-medium text-gray-600 mb-0.5">
              {field.label}
            </label>
            <input
              type="text"
              value={values[i] ?? ""}
              onChange={(e) => {
                const next = [...values];
                next[i] = e.target.value;
                onChange({ kind: "text-multifield", values: next });
              }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        ))}
      </div>
    );
  }

  if (input.kind === "chip-picker") {
    const primary = value?.kind === "chip" ? value.primary : null;
    const secondary = value?.kind === "chip" ? value.secondary : undefined;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {input.chips.map((chip) => {
            const selected = chip.id === primary;
            return (
              <button
                key={chip.id}
                onClick={() =>
                  onChange({ kind: "chip", primary: chip.id, secondary })
                }
                className={`px-4 py-2 rounded-full text-sm border-2 transition ${
                  selected
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                }`}
              >
                {chip.emoji ? `${chip.emoji} ` : ""}
                {chip.label}
              </button>
            );
          })}
        </div>
        {input.allowSecondary && primary && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-1">
              {input.allowSecondary.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {input.allowSecondary.chips.map((chip) => {
                const selected = chip.id === secondary;
                return (
                  <button
                    key={chip.id}
                    onClick={() =>
                      onChange({
                        kind: "chip",
                        primary,
                        secondary: selected ? undefined : chip.id,
                      })
                    }
                    className={`px-3 py-1 rounded-full text-xs border transition ${
                      selected
                        ? "border-purple-500 bg-purple-100 text-purple-900"
                        : "border-gray-300 bg-white text-gray-600 hover:border-purple-300"
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "size-reference") {
    const ref = value?.kind === "size" ? value.ref : null;
    const cm = value?.kind === "size" ? value.cm : undefined;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {input.references.map((r) => {
            const selected = r.id === ref;
            return (
              <button
                key={r.id}
                onClick={() => onChange({ kind: "size", ref: r.id, cm })}
                className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-xs transition ${
                  selected
                    ? "border-purple-600 bg-purple-50"
                    : "border-gray-200 bg-white hover:border-purple-300"
                }`}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="text-center text-gray-700">{r.label}</span>
              </button>
            );
          })}
        </div>
        {input.allowCm && ref && (
          <div className="flex gap-2 items-center">
            <span className="text-xs text-gray-600">Optional cm:</span>
            {(["w", "h", "d"] as const).map((axis) => (
              <input
                key={axis}
                type="number"
                placeholder={axis.toUpperCase()}
                value={cm?.[axis] ?? ""}
                onChange={(e) => {
                  const n = e.target.value ? Number(e.target.value) : undefined;
                  onChange({
                    kind: "size",
                    ref,
                    cm: { ...(cm ?? {}), [axis]: n },
                  });
                }}
                className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (input.kind === "multi-chip-picker") {
    const selected = value?.kind === "multi-chip" ? value.selected : [];
    const cap = input.maxSelected;
    const toggle = (id: string) => {
      const has = selected.includes(id);
      const next = has
        ? selected.filter((s) => s !== id)
        : [...selected, id];
      if (cap && next.length > cap) return; // refuse to exceed cap
      onChange(
        next.length === 0
          ? null
          : { kind: "multi-chip", selected: next },
      );
    };
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {input.chips.map((chip) => {
            const isSelected = selected.includes(chip.id);
            return (
              <button
                key={chip.id}
                onClick={() => toggle(chip.id)}
                className={`px-3 py-1.5 rounded-full text-sm border-2 transition ${
                  isSelected
                    ? "border-purple-600 bg-purple-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-400"
                }`}
              >
                {chip.emoji ? `${chip.emoji} ` : ""}
                {chip.label}
              </button>
            );
          })}
        </div>
        {cap && (
          <p className="text-xs text-gray-500">
            Pick up to {cap}. Selected: {selected.length}
          </p>
        )}
      </div>
    );
  }

  if (input.kind === "number-pair") {
    const first = value?.kind === "pair" ? value.first : NaN;
    const second = value?.kind === "pair" ? value.second : NaN;
    return (
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.firstLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(first) ? first : ""}
            min={input.firstMin}
            max={input.firstMax}
            onChange={(e) => {
              const f = Number(e.target.value);
              onChange({
                kind: "pair",
                first: f,
                second: Number.isFinite(second) ? second : 0,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        <span className="pb-2 text-gray-400">×</span>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-0.5">
            {input.secondLabel}
          </label>
          <input
            type="number"
            value={Number.isFinite(second) ? second : ""}
            min={input.secondMin}
            max={input.secondMax}
            onChange={(e) => {
              const s = Number(e.target.value);
              onChange({
                kind: "pair",
                first: Number.isFinite(first) ? first : 0,
                second: s,
              });
            }}
            className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        </div>
        {input.unit && (
          <span className="pb-2 text-sm text-gray-600">{input.unit}</span>
        )}
      </div>
    );
  }

  return null;
}
