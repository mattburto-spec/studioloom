"use client";

import { useState } from "react";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";
import type { DesignConstraints } from "@/types/unit-brief";

interface DesignConstraintsEditorProps {
  value: DesignConstraints;
  onChange: (next: DesignConstraints) => void;
}

/**
 * Section 2 of the Brief & Constraints editor. Renders 6 fields that
 * shape the Design archetype: dimensions, materials whitelist, budget,
 * audience, must_include, must_avoid. Save-on-blur for text fields;
 * save-on-toggle for the chip multi-select; save-on-blur for repeater
 * entries.
 */
export function DesignConstraintsEditor({
  value,
  onChange,
}: DesignConstraintsEditorProps) {
  const setField = <K extends keyof DesignConstraints>(
    key: K,
    next: DesignConstraints[K],
  ) => {
    const cleaned = { ...value };
    if (
      next === undefined ||
      next === "" ||
      (Array.isArray(next) && next.length === 0)
    ) {
      delete cleaned[key];
    } else {
      cleaned[key] = next;
    }
    onChange(cleaned);
  };

  const toggleMaterial = (chipId: string) => {
    const list = value.materials_whitelist ?? [];
    const next = list.includes(chipId)
      ? list.filter((id) => id !== chipId)
      : [...list, chipId];
    setField("materials_whitelist", next);
  };

  return (
    <div className="space-y-4 rounded border border-gray-200 p-4">
      {/* Dimensions */}
      <FieldText
        id="cstr_dimensions"
        label="Dimensions"
        placeholder='e.g. "max 200mm any axis"'
        value={value.dimensions ?? ""}
        onCommit={(v) => setField("dimensions", v)}
      />

      {/* Materials whitelist */}
      <div>
        <div className="mb-2 text-sm font-medium text-gray-700">
          Materials whitelist
        </div>
        <div className="flex flex-wrap gap-2">
          {MATERIALS_CHIPS.map((chip) => {
            const selected = (value.materials_whitelist ?? []).includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleMaterial(chip.id)}
                aria-pressed={selected}
                data-testid={`material-chip-${chip.id}`}
                className={`rounded-full border px-3 py-1 text-xs ${
                  selected
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="mr-1">{chip.emoji}</span>
                {chip.label}
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Pick the materials students are allowed to use. Leave empty for no
          restriction.
        </p>
      </div>

      {/* Budget */}
      <FieldText
        id="cstr_budget"
        label="Budget"
        placeholder='e.g. "≤ AUD $20"'
        value={value.budget ?? ""}
        onCommit={(v) => setField("budget", v)}
      />

      {/* Audience */}
      <FieldText
        id="cstr_audience"
        label="Audience"
        placeholder='e.g. "Year 7 students"'
        value={value.audience ?? ""}
        onCommit={(v) => setField("audience", v)}
      />

      {/* Must include */}
      <Repeater
        label="Must include"
        placeholder='e.g. "a moving part"'
        items={value.must_include ?? []}
        onChange={(next) => setField("must_include", next)}
        testIdPrefix="must-include"
      />

      {/* Must avoid */}
      <Repeater
        label="Must avoid"
        placeholder='e.g. "batteries"'
        items={value.must_avoid ?? []}
        onChange={(next) => setField("must_avoid", next)}
        testIdPrefix="must-avoid"
      />
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

interface FieldTextProps {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onCommit: (next: string) => void;
}

function FieldText({ id, label, placeholder, value, onCommit }: FieldTextProps) {
  // Editor parent gates rendering on loading=false, so this mounts with
  // the fetched value already in place — no external-sync hook needed.
  const [local, setLocal] = useState(value);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={local}
        placeholder={placeholder}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

interface RepeaterProps {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (next: string[]) => void;
  testIdPrefix: string;
}

function Repeater({
  label,
  placeholder,
  items,
  onChange,
  testIdPrefix,
}: RepeaterProps) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    onChange([...items, trimmed]);
    setDraft("");
  };
  const removeAt = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };
  return (
    <div>
      <div className="mb-1 text-sm font-medium text-gray-700">{label}</div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-1" data-testid={`${testIdPrefix}-list`}>
          {items.map((item, idx) => (
            <li
              key={`${item}-${idx}`}
              className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm"
            >
              <span className="break-words">{item}</span>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                aria-label={`Remove ${item}`}
                data-testid={`${testIdPrefix}-remove-${idx}`}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          data-testid={`${testIdPrefix}-input`}
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={add}
          data-testid={`${testIdPrefix}-add`}
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-300"
          disabled={draft.trim().length === 0}
        >
          Add
        </button>
      </div>
    </div>
  );
}
