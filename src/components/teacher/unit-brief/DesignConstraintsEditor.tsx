"use client";

import { type ReactNode, useState } from "react";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";
import type {
  DesignConstraints,
  DesignDimensions,
  DimensionUnit,
  LockableField,
  UnitBriefLocks,
} from "@/types/unit-brief";
import { LockToggle } from "./LockToggle";

interface DesignConstraintsEditorProps {
  value: DesignConstraints;
  onChange: (next: DesignConstraints) => void;
  // Phase F.B — per-field lock toggles. Optional so the component
  // still works in contexts that don't render locks (none today, but
  // tests + storybook may want the simpler shape).
  locks?: UnitBriefLocks;
  onToggleLock?: (field: LockableField, next: boolean) => void;
  disabled?: boolean;
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
  locks,
  onToggleLock,
  disabled,
}: DesignConstraintsEditorProps) {
  // Helper: render the lock toggle for a given field path, or null when
  // the parent didn't pass locks props (legacy callers / future re-use).
  const renderLockToggle = (field: LockableField) => {
    if (!locks || !onToggleLock) return null;
    return (
      <LockToggle
        field={field}
        locked={locks[field] === true}
        onToggle={onToggleLock}
        disabled={disabled}
      />
    );
  };

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
      {/* Dimensions — structured H × W × D + unit */}
      <DimensionsField
        value={value.dimensions}
        onCommit={(next) => setField("dimensions", next)}
        lockToggle={renderLockToggle("constraints.dimensions")}
      />

      {/* Materials whitelist — chips from the catalogue + custom entries */}
      <MaterialsField
        value={value.materials_whitelist ?? []}
        onChange={(next) => setField("materials_whitelist", next)}
        onToggleChip={toggleMaterial}
        lockToggle={renderLockToggle("constraints.materials_whitelist")}
      />


      {/* Budget */}
      <FieldText
        id="cstr_budget"
        label="Budget"
        placeholder='e.g. "≤ AUD $20"'
        value={value.budget ?? ""}
        onCommit={(v) => setField("budget", v)}
        lockToggle={renderLockToggle("constraints.budget")}
      />

      {/* Audience */}
      <FieldText
        id="cstr_audience"
        label="Audience"
        placeholder='e.g. "Year 7 students"'
        value={value.audience ?? ""}
        onCommit={(v) => setField("audience", v)}
        lockToggle={renderLockToggle("constraints.audience")}
      />

      {/* Must include */}
      <Repeater
        label="Must include"
        placeholder='e.g. "a moving part"'
        items={value.must_include ?? []}
        onChange={(next) => setField("must_include", next)}
        testIdPrefix="must-include"
        lockToggle={renderLockToggle("constraints.must_include")}
      />

      {/* Must avoid */}
      <Repeater
        label="Must avoid"
        placeholder='e.g. "batteries"'
        items={value.must_avoid ?? []}
        onChange={(next) => setField("must_avoid", next)}
        testIdPrefix="must-avoid"
        lockToggle={renderLockToggle("constraints.must_avoid")}
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
  lockToggle?: ReactNode;
}

function FieldText({ id, label, placeholder, value, onCommit, lockToggle }: FieldTextProps) {
  // Editor parent gates rendering on loading=false, so this mounts with
  // the fetched value already in place — no external-sync hook needed.
  const [local, setLocal] = useState(value);
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        {lockToggle}
      </div>
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
  lockToggle?: ReactNode;
}

function Repeater({
  label,
  placeholder,
  items,
  onChange,
  testIdPrefix,
  lockToggle,
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
      <div className="mb-1 flex items-center gap-2">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {lockToggle}
      </div>
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

// ─── MaterialsField ──────────────────────────────────────────────────
// Catalogue chips (from MATERIALS_CHIPS) + free-text custom entries.
// Both kinds live in the same `materials_whitelist: string[]` — entries
// whose value matches a catalogue id render as catalogue chips; the
// rest render as gray "custom" chips.

// MATERIALS_CHIPS is `as const`, so naive Set inference produces a
// literal-string union and `.has(arbitrary)` fails to typecheck. Widen
// to Set<string> here because we're checking against user-typed customs.
const CATALOGUE_IDS: Set<string> = new Set(MATERIALS_CHIPS.map((chip) => chip.id));

interface MaterialsFieldProps {
  value: string[];
  onChange: (next: string[]) => void;
  onToggleChip: (chipId: string) => void;
  lockToggle?: ReactNode;
}

function MaterialsField({ value, onChange, onToggleChip, lockToggle }: MaterialsFieldProps) {
  const [customDraft, setCustomDraft] = useState("");

  const customEntries = value.filter((v) => !CATALOGUE_IDS.has(v));

  const addCustom = () => {
    const trimmed = customDraft.trim();
    if (trimmed.length === 0) return;
    // Don't dedupe against catalogue ids — teacher might type "Cardboard"
    // (display label) which differs from "cardboard" (id). Dedupe only
    // among existing custom entries.
    if (customEntries.includes(trimmed)) {
      setCustomDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setCustomDraft("");
  };

  const removeCustom = (entry: string) => {
    onChange(value.filter((v) => v !== entry));
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <div className="text-sm font-medium text-gray-700">
          Materials whitelist
        </div>
        {lockToggle}
      </div>
      <div className="flex flex-wrap gap-2">
        {MATERIALS_CHIPS.map((chip) => {
          const selected = value.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onToggleChip(chip.id)}
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
        {customEntries.map((entry) => (
          <span
            key={`custom-${entry}`}
            data-testid={`material-custom-${entry}`}
            className="inline-flex items-center gap-1 rounded-full border border-gray-400 bg-gray-100 px-3 py-1 text-xs text-gray-800"
          >
            <span aria-hidden="true">✎</span>
            <span>{entry}</span>
            <button
              type="button"
              onClick={() => removeCustom(entry)}
              aria-label={`Remove ${entry}`}
              className="ml-1 text-gray-500 hover:text-red-600"
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="text"
          value={customDraft}
          placeholder='Add a custom material, e.g. "CNC MDF 12mm"'
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          data-testid="material-custom-input"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={customDraft.trim().length === 0}
          data-testid="material-custom-add"
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          Add
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Pick from the catalogue or add your own. Leave empty for no
        restriction.
      </p>
    </div>
  );
}

// ─── DimensionsField ─────────────────────────────────────────────────
// Three numeric inputs (H × W × D) plus a unit dropdown (mm / cm / in).
// All axes optional — when the teacher clears all three, the parent
// receives `undefined` and the dimensions key is removed from the
// stored constraints object (mirrors the array-empty cleanup pattern).
// Save-on-blur per axis; unit changes save immediately.

const DIMENSION_UNITS: DimensionUnit[] = ["mm", "cm", "in"];

interface DimensionsFieldProps {
  value: DesignDimensions | undefined;
  onCommit: (next: DesignDimensions | undefined) => void;
  lockToggle?: ReactNode;
}

function DimensionsField({ value, onCommit, lockToggle }: DimensionsFieldProps) {
  // Mirror parent-shaped local state so blur-commit logic is straightforward.
  const [h, setH] = useState<string>(value?.h?.toString() ?? "");
  const [w, setW] = useState<string>(value?.w?.toString() ?? "");
  const [d, setD] = useState<string>(value?.d?.toString() ?? "");
  const [unit, setUnit] = useState<DimensionUnit>(value?.unit ?? "mm");

  const buildNext = (
    overrides: Partial<{ h: string; w: string; d: string; unit: DimensionUnit }>,
  ): DesignDimensions | undefined => {
    const next: DesignDimensions = {};
    const hVal = overrides.h ?? h;
    const wVal = overrides.w ?? w;
    const dVal = overrides.d ?? d;
    const uVal = overrides.unit ?? unit;
    const parsed = (s: string): number | undefined => {
      const trimmed = s.trim();
      if (trimmed.length === 0) return undefined;
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const hN = parsed(hVal);
    const wN = parsed(wVal);
    const dN = parsed(dVal);
    if (hN !== undefined) next.h = hN;
    if (wN !== undefined) next.w = wN;
    if (dN !== undefined) next.d = dN;
    if (next.h !== undefined || next.w !== undefined || next.d !== undefined) {
      next.unit = uVal;
      return next;
    }
    // All axes empty → clear the dimensions key entirely.
    return undefined;
  };

  const commit = (
    overrides: Partial<{ h: string; w: string; d: string; unit: DimensionUnit }> = {},
  ) => {
    onCommit(buildNext(overrides));
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <div className="text-sm font-medium text-gray-700">Dimensions</div>
        {lockToggle}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <AxisInput
          id="cstr_dim_h"
          label="H"
          value={h}
          onChange={setH}
          onBlur={() => commit()}
        />
        <span aria-hidden="true" className="text-gray-400">×</span>
        <AxisInput
          id="cstr_dim_w"
          label="W"
          value={w}
          onChange={setW}
          onBlur={() => commit()}
        />
        <span aria-hidden="true" className="text-gray-400">×</span>
        <AxisInput
          id="cstr_dim_d"
          label="D"
          value={d}
          onChange={setD}
          onBlur={() => commit()}
        />
        <select
          aria-label="Dimension unit"
          data-testid="cstr_dim_unit"
          value={unit}
          onChange={(e) => {
            const next = e.target.value as DimensionUnit;
            setUnit(next);
            commit({ unit: next });
          }}
          className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {DIMENSION_UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Leave any axis blank for "no constraint". Saved when you leave the
        field.
      </p>
    </div>
  );
}

interface AxisInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  onBlur: () => void;
}

function AxisInput({ id, label, value, onChange, onBlur }: AxisInputProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-1 text-sm text-gray-700">
      <span className="text-xs font-medium uppercase text-gray-500">
        {label}
      </span>
      <input
        id={id}
        type="number"
        min={0}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        data-testid={id}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </label>
  );
}
