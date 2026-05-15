"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  DesignConstraints,
  DesignDimensions,
  DimensionUnit,
  EffectiveBriefField,
  EffectiveBriefFieldSource,
  StudentBrief,
  UnitBrief,
  UnitBriefAmendment,
  UnitBriefConstraints,
} from "@/types/unit-brief";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";
import {
  type CardTemplate,
  computeEffectiveBrief,
} from "@/lib/unit-brief/effective";

interface BriefDrawerProps {
  open: boolean;
  unitBrief: UnitBrief | null;
  cardTemplate: CardTemplate | null;
  studentBrief: StudentBrief | null;
  amendments: UnitBriefAmendment[];
  /**
   * Save the student's override patch. Caller (BriefChip) POSTs to
   * /api/student/unit-brief and updates state on success. The drawer
   * only invokes this for UNLOCKED fields — locked fields render
   * read-only with no save affordance.
   */
  onSaveOverride: (patch: {
    brief_text?: string | null;
    constraints?: UnitBriefConstraints;
  }) => Promise<void>;
  onClose: () => void;
}

const MATERIAL_LABEL_BY_ID = new Map(
  MATERIALS_CHIPS.map((c) => [c.id as string, c.label]),
);

/**
 * Student-facing brief surface (Phase F.D — editable mode).
 *
 * Renders the EFFECTIVE brief computed from three sources:
 *   - Class-shared unit_brief (teacher)
 *   - Picked choice card's brief template (teacher, per-card)
 *   - Student's own student_brief overrides
 *
 * Each field renders either:
 *   - LOCKED: read-only display with 🔒 + source attribution
 *     ("Locked by your teacher" or "Locked by your project card").
 *   - UNLOCKED: editable input. Pre-fills from the template starter
 *     when no student override exists; saves student edits to
 *     student_briefs via onSaveOverride.
 *
 * Slide-in from the right at 700px max-width. Portal-mounted at
 * document.body to escape ancestor containing blocks (Lesson #89).
 * Drawer state is local React state — no URL deeplink in v1.
 */
export function BriefDrawer({
  open,
  unitBrief,
  cardTemplate,
  studentBrief,
  amendments,
  onSaveOverride,
  onClose,
}: BriefDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape — lazy listener.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Merge the 3 sources whenever they change.
  const effective = useMemo(
    () => computeEffectiveBrief({ unitBrief, cardTemplate, studentBrief }),
    [unitBrief, cardTemplate, studentBrief],
  );

  // Current student override state — separate from `effective` so
  // editable inputs can save partial patches without losing local
  // state. Initialised from studentBrief; updated optimistically on save.
  const studentDesignData: DesignConstraints = useMemo(() => {
    if (!studentBrief) return {};
    return studentBrief.constraints.archetype === "design"
      ? studentBrief.constraints.data
      : {};
  }, [studentBrief]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saveBriefText = useCallback(
    async (next: string) => {
      setSaving(true);
      setSaveError(null);
      try {
        await onSaveOverride({ brief_text: next.length === 0 ? null : next });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [onSaveOverride],
  );

  // Saves a constraints patch — merges with current student overrides
  // so we don't blow away other fields. Server also merges, but the
  // optimistic UI relies on this being right too.
  const saveConstraints = useCallback(
    async (patch: Partial<DesignConstraints>) => {
      setSaving(true);
      setSaveError(null);
      try {
        const nextData: DesignConstraints = { ...studentDesignData };
        for (const [k, v] of Object.entries(patch)) {
          const key = k as keyof DesignConstraints;
          if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
            delete nextData[key];
          } else {
            // Type-erased assignment — DesignConstraints is a discriminated
            // union of field types; per-key Partial is awkward to express.
            (nextData as Record<string, unknown>)[key] = v;
          }
        }
        await onSaveOverride({
          constraints: { archetype: "design", data: nextData },
        });
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [onSaveOverride, studentDesignData],
  );

  if (!open || !mounted) return null;

  // Diagram never has a card source in v1 and is teacher-only — locked
  // iff unit_brief.locks.diagram_url. Render conditionally.
  const showDiagram =
    effective.diagram_url.value !== null &&
    effective.diagram_url.value !== undefined;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Brief and constraints"
      data-testid="brief-drawer"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close brief drawer"
        data-testid="brief-drawer-backdrop"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative h-full w-full max-w-[700px] overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            <span aria-hidden="true" className="mr-2">📋</span>
            Brief &amp; Constraints
          </h2>
          <div className="flex items-center gap-2">
            {saving && (
              <span
                aria-live="polite"
                data-testid="brief-drawer-saving"
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800"
              >
                Saving…
              </span>
            )}
            {saveError && (
              <span
                role="alert"
                data-testid="brief-drawer-save-error"
                className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-800"
              >
                ✗ {saveError}
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              data-testid="brief-drawer-close"
              className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
        </div>

        {cardTemplate && (
          <div className="border-b border-gray-200 bg-purple-50 px-6 py-2 text-xs text-purple-900">
            <strong>Your project:</strong> {cardTemplate.cardLabel}. Locked
            fields below are your project's non-negotiables — the rest is
            yours to fill in.
          </div>
        )}

        <div className="space-y-6 px-6 py-5">
          {/* Section 1 — Brief prose */}
          <section>
            <FieldHeader label="Brief" field={effective.brief_text} />
            {effective.brief_text.locked ? (
              <ReadOnlyTextBlock
                value={effective.brief_text.value}
                emptyText="Your teacher hasn't written the scenario yet."
                testId="brief-drawer-prose"
              />
            ) : (
              <EditableTextarea
                value={effective.brief_text.value ?? ""}
                placeholder="Author your brief here…"
                onCommit={saveBriefText}
                testId="brief-drawer-prose-editable"
              />
            )}
          </section>

          {/* Section 2 — Spec diagram (teacher-only in v1) */}
          {showDiagram && effective.diagram_url.value && (
            <section>
              <FieldHeader label="Spec diagram" field={effective.diagram_url} />
              <div className="overflow-hidden rounded border border-gray-200 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={effective.diagram_url.value}
                  alt="Spec diagram"
                  data-testid="brief-drawer-diagram"
                  className="block max-h-[480px] w-full object-contain"
                />
              </div>
            </section>
          )}

          {/* Section 3 — Constraints */}
          <section data-testid="brief-drawer-constraints">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Constraints
            </h3>
            <div className="space-y-4 rounded border border-gray-200 p-4">
              <DimensionsRow
                field={effective.constraints.dimensions}
                onCommit={(next) => saveConstraints({ dimensions: next })}
              />
              <MaterialsRow
                field={effective.constraints.materials_whitelist}
                onCommit={(next) =>
                  saveConstraints({ materials_whitelist: next })
                }
              />
              <TextRow
                label="Budget"
                placeholder='e.g. "≤ AUD $20"'
                field={effective.constraints.budget}
                onCommit={(next) => saveConstraints({ budget: next ?? undefined })}
                testId="brief-drawer-budget"
              />
              <TextRow
                label="Audience"
                placeholder='e.g. "Year 7 students"'
                field={effective.constraints.audience}
                onCommit={(next) => saveConstraints({ audience: next ?? undefined })}
                testId="brief-drawer-audience"
              />
              <ListRow
                label="Must include"
                placeholder='e.g. "a moving part"'
                field={effective.constraints.must_include}
                onCommit={(next) => saveConstraints({ must_include: next })}
                testIdPrefix="brief-drawer-must-include"
              />
              <ListRow
                label="Must avoid"
                placeholder='e.g. "batteries"'
                field={effective.constraints.must_avoid}
                onCommit={(next) => saveConstraints({ must_avoid: next })}
                testIdPrefix="brief-drawer-must-avoid"
              />
            </div>
          </section>

          {/* Section 4 — Amendments (read-only, oldest-first) */}
          {amendments.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Amendments
              </h3>
              <ul
                className="space-y-3"
                data-testid="brief-drawer-amendments"
              >
                {amendments.map((a) => (
                  <li
                    key={a.id}
                    data-testid={`brief-drawer-amendment-${a.id}`}
                    className="rounded border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        {a.version_label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {a.title}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">
                        {formatDate(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                      {a.body}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Field header + source attribution ────────────────────────────────

function FieldHeader<T>({
  label,
  field,
}: {
  label: string;
  field: EffectiveBriefField<T>;
}) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </h3>
      {field.locked && (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800"
          data-testid="field-locked-badge"
        >
          <span aria-hidden="true">🔒</span>
          {sourceLabel(field.source)}
        </span>
      )}
      {!field.locked && field.source === "student" && (
        <span className="text-[10px] uppercase tracking-wide text-emerald-700">
          your edit
        </span>
      )}
      {!field.locked &&
        (field.source === "card" || field.source === "teacher") &&
        field.value !== null && (
          <span className="text-[10px] uppercase tracking-wide text-gray-400">
            starter — yours to refine
          </span>
        )}
    </div>
  );
}

function sourceLabel(source: EffectiveBriefFieldSource): string {
  switch (source) {
    case "card":
      return "by your project";
    case "teacher":
      return "by your teacher";
    case "student":
      return "your edit";
    case "empty":
      return "";
  }
}

// ─── Read-only / editable primitives ──────────────────────────────────

function ReadOnlyTextBlock({
  value,
  emptyText,
  testId,
}: {
  value: string | null;
  emptyText: string;
  testId?: string;
}) {
  if (!value || value.length === 0) {
    return (
      <p
        className="text-sm italic text-gray-500"
        data-testid={testId ? `${testId}-empty` : undefined}
      >
        {emptyText}
      </p>
    );
  }
  return (
    <p
      className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800"
      data-testid={testId}
    >
      {value}
    </p>
  );
}

function EditableTextarea({
  value,
  placeholder,
  onCommit,
  testId,
}: {
  value: string;
  placeholder: string;
  onCommit: (next: string) => Promise<void>;
  testId?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <textarea
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) void onCommit(local);
      }}
      placeholder={placeholder}
      rows={6}
      data-testid={testId}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}

// ─── Per-constraint rows ─────────────────────────────────────────────

function TextRow({
  label,
  placeholder,
  field,
  onCommit,
  testId,
}: {
  label: string;
  placeholder: string;
  field: EffectiveBriefField<string>;
  onCommit: (next: string | null) => Promise<void>;
  testId: string;
}) {
  return (
    <div>
      <FieldHeader label={label} field={field} />
      {field.locked ? (
        <ReadOnlyTextBlock
          value={field.value}
          emptyText="—"
          testId={`${testId}-locked`}
        />
      ) : (
        <TextInputCommit
          value={field.value ?? ""}
          placeholder={placeholder}
          onCommit={(v) => onCommit(v.length === 0 ? null : v)}
          testId={`${testId}-input`}
        />
      )}
    </div>
  );
}

function TextInputCommit({
  value,
  placeholder,
  onCommit,
  testId,
}: {
  value: string;
  placeholder?: string;
  onCommit: (next: string) => Promise<void>;
  testId?: string;
}) {
  const [local, setLocal] = useState(value);
  return (
    <input
      type="text"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        if (local !== value) void onCommit(local);
      }}
      placeholder={placeholder}
      data-testid={testId}
      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  );
}

function DimensionsRow({
  field,
  onCommit,
}: {
  field: EffectiveBriefField<DesignDimensions>;
  onCommit: (next: DesignDimensions | undefined) => Promise<void>;
}) {
  return (
    <div>
      <FieldHeader label="Dimensions" field={field} />
      {field.locked ? (
        <ReadOnlyTextBlock
          value={field.value ? formatDimensions(field.value) : null}
          emptyText="—"
          testId="brief-drawer-dimensions-locked"
        />
      ) : (
        <DimensionsEditor initial={field.value ?? null} onCommit={onCommit} />
      )}
    </div>
  );
}

function DimensionsEditor({
  initial,
  onCommit,
}: {
  initial: DesignDimensions | null;
  onCommit: (next: DesignDimensions | undefined) => Promise<void>;
}) {
  const [h, setH] = useState<string>(initial?.h?.toString() ?? "");
  const [w, setW] = useState<string>(initial?.w?.toString() ?? "");
  const [d, setD] = useState<string>(initial?.d?.toString() ?? "");
  const [unit, setUnit] = useState<DimensionUnit>(initial?.unit ?? "mm");

  const buildNext = (overrides: Partial<{ h: string; w: string; d: string; unit: DimensionUnit }>): DesignDimensions | undefined => {
    const next: DesignDimensions = {};
    const parsed = (s: string): number | undefined => {
      const trimmed = s.trim();
      if (trimmed.length === 0) return undefined;
      const n = Number(trimmed);
      return Number.isFinite(n) && n >= 0 ? n : undefined;
    };
    const hN = parsed(overrides.h ?? h);
    const wN = parsed(overrides.w ?? w);
    const dN = parsed(overrides.d ?? d);
    if (hN !== undefined) next.h = hN;
    if (wN !== undefined) next.w = wN;
    if (dN !== undefined) next.d = dN;
    if (next.h !== undefined || next.w !== undefined || next.d !== undefined) {
      next.unit = overrides.unit ?? unit;
      return next;
    }
    return undefined;
  };

  const commit = () => void onCommit(buildNext({}));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DimensionInput id="sd_h" label="H" value={h} onChange={setH} onBlur={commit} />
      <span aria-hidden="true" className="text-gray-400">×</span>
      <DimensionInput id="sd_w" label="W" value={w} onChange={setW} onBlur={commit} />
      <span aria-hidden="true" className="text-gray-400">×</span>
      <DimensionInput id="sd_d" label="D" value={d} onChange={setD} onBlur={commit} />
      <select
        aria-label="Dimension unit"
        data-testid="brief-drawer-dim-unit"
        value={unit}
        onChange={(e) => {
          const next = e.target.value as DimensionUnit;
          setUnit(next);
          void onCommit(buildNext({ unit: next }));
        }}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        <option value="mm">mm</option>
        <option value="cm">cm</option>
        <option value="in">in</option>
      </select>
    </div>
  );
}

function DimensionInput({
  id,
  label,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-1 text-sm text-gray-700">
      <span className="text-xs font-medium uppercase text-gray-500">{label}</span>
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

function MaterialsRow({
  field,
  onCommit,
}: {
  field: EffectiveBriefField<string[]>;
  onCommit: (next: string[]) => Promise<void>;
}) {
  if (field.locked) {
    return (
      <div>
        <FieldHeader label="Materials" field={field} />
        {field.value && field.value.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {field.value.map((m) => (
              <span
                key={m}
                className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-700"
              >
                {MATERIAL_LABEL_BY_ID.get(m) ?? m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-gray-500">—</p>
        )}
      </div>
    );
  }

  // Editable — chip picker + custom add
  const list: string[] = field.value ?? [];
  return (
    <div>
      <FieldHeader label="Materials" field={field} />
      <MaterialsEditor value={list} onCommit={onCommit} />
    </div>
  );
}

function MaterialsEditor({
  value,
  onCommit,
}: {
  value: string[];
  onCommit: (next: string[]) => Promise<void>;
}) {
  const CATALOGUE_IDS: Set<string> = new Set(
    MATERIALS_CHIPS.map((chip) => chip.id),
  );
  const [customDraft, setCustomDraft] = useState("");
  const customEntries = value.filter((v) => !CATALOGUE_IDS.has(v));

  const toggleChip = (id: string) => {
    const next = value.includes(id)
      ? value.filter((v) => v !== id)
      : [...value, id];
    void onCommit(next);
  };
  const addCustom = () => {
    const trimmed = customDraft.trim();
    if (trimmed.length === 0) return;
    if (customEntries.includes(trimmed)) {
      setCustomDraft("");
      return;
    }
    void onCommit([...value, trimmed]);
    setCustomDraft("");
  };
  const removeCustom = (entry: string) => {
    void onCommit(value.filter((v) => v !== entry));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {MATERIALS_CHIPS.map((chip) => {
          const selected = value.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggleChip(chip.id)}
              aria-pressed={selected}
              data-testid={`brief-drawer-material-chip-${chip.id}`}
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
            data-testid={`brief-drawer-material-custom-${entry}`}
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
          placeholder='Add custom material'
          onChange={(e) => setCustomDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          data-testid="brief-drawer-material-custom-input"
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={customDraft.trim().length === 0}
          data-testid="brief-drawer-material-custom-add"
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}

function ListRow({
  label,
  placeholder,
  field,
  onCommit,
  testIdPrefix,
}: {
  label: string;
  placeholder: string;
  field: EffectiveBriefField<string[]>;
  onCommit: (next: string[]) => Promise<void>;
  testIdPrefix: string;
}) {
  return (
    <div>
      <FieldHeader label={label} field={field} />
      {field.locked ? (
        field.value && field.value.length > 0 ? (
          <ul
            className="list-disc pl-5 text-sm text-gray-800"
            data-testid={`${testIdPrefix}-locked`}
          >
            {field.value.map((m, i) => (
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm italic text-gray-500">—</p>
        )
      ) : (
        <RepeaterEditor
          items={field.value ?? []}
          placeholder={placeholder}
          onCommit={onCommit}
          testIdPrefix={testIdPrefix}
        />
      )}
    </div>
  );
}

function RepeaterEditor({
  items,
  placeholder,
  onCommit,
  testIdPrefix,
}: {
  items: string[];
  placeholder: string;
  onCommit: (next: string[]) => Promise<void>;
  testIdPrefix: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    void onCommit([...items, trimmed]);
    setDraft("");
  };
  const removeAt = (idx: number) => {
    void onCommit(items.filter((_, i) => i !== idx));
  };
  return (
    <div>
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
          disabled={draft.trim().length === 0}
          data-testid={`${testIdPrefix}-add`}
          className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Formatters ──────────────────────────────────────────────────────

function formatDimensions(d: DesignDimensions): string {
  const parts: string[] = [];
  if (typeof d.h === "number") parts.push(`H ${d.h}`);
  if (typeof d.w === "number") parts.push(`W ${d.w}`);
  if (typeof d.d === "number") parts.push(`D ${d.d}`);
  if (parts.length === 0) return "—";
  const u = d.unit ?? "mm";
  return `${parts.join(" × ")} ${u}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}
