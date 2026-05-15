"use client";

// AI brief-assist modal — post-F.E polish.
//
// Teacher clicks "✨ AI assist" in the brief editor → this modal opens.
// They write a short prompt → click Generate → Haiku proposes a
// brief_text + structured constraints via tool-use. Each suggested
// field has an "Apply" toggle (default ON) so the teacher can opt in
// per field. "Apply selected" calls onApply with the patch; modal
// closes.
//
// Portal-mounted at document.body (Lesson #89).

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MATERIALS_CHIPS } from "@/lib/project-spec/archetypes";
import type {
  DesignConstraints,
  DesignDimensions,
  UnitBriefConstraints,
} from "@/types/unit-brief";

interface Props {
  open: boolean;
  unitId: string;
  onApply: (patch: {
    brief_text?: string;
    constraints?: UnitBriefConstraints;
  }) => Promise<void>;
  onClose: () => void;
}

interface Suggestion {
  brief_text: string | null;
  constraints: UnitBriefConstraints;
}

const MATERIAL_LABEL_BY_ID = new Map(
  MATERIALS_CHIPS.map((c) => [c.id as string, c.label]),
);

// Stable union of selectable constraint keys + brief_text — the apply-
// checkbox state is keyed on these.
type SelectableField =
  | "brief_text"
  | "dimensions"
  | "materials_whitelist"
  | "budget"
  | "audience"
  | "must_include"
  | "must_avoid";

export function AIBriefAssistModal({
  open,
  unitId,
  onApply,
  onClose,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [selected, setSelected] = useState<Set<SelectableField>>(new Set());
  const [applying, setApplying] = useState(false);

  // Reset when reopened.
  useEffect(() => {
    if (!open) return;
    setPrompt("");
    setSuggestion(null);
    setSelected(new Set());
    setError(null);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (trimmed.length === 0) {
      setError("Tell the AI what you want help with.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/unit-brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitId, prompt: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Generation failed (${res.status})`);
        return;
      }
      const data = await res.json();
      const s = data.suggestion as Suggestion | undefined;
      if (!s) {
        setError("Empty proposal from AI — try a different prompt.");
        return;
      }
      setSuggestion(s);
      // Default: select every field that actually has a value, so the
      // teacher can hit Apply immediately.
      const next = new Set<SelectableField>();
      if (s.brief_text && s.brief_text.length > 0) next.add("brief_text");
      if (s.constraints.archetype === "design") {
        const d = s.constraints.data;
        if (d.dimensions) next.add("dimensions");
        if (d.materials_whitelist && d.materials_whitelist.length > 0)
          next.add("materials_whitelist");
        if (d.budget && d.budget.length > 0) next.add("budget");
        if (d.audience && d.audience.length > 0) next.add("audience");
        if (d.must_include && d.must_include.length > 0)
          next.add("must_include");
        if (d.must_avoid && d.must_avoid.length > 0) next.add("must_avoid");
      }
      setSelected(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [prompt, unitId]);

  const toggleField = (field: SelectableField) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const apply = useCallback(async () => {
    if (!suggestion) return;
    setApplying(true);
    setError(null);
    try {
      const patch: { brief_text?: string; constraints?: UnitBriefConstraints } = {};
      if (selected.has("brief_text") && suggestion.brief_text) {
        patch.brief_text = suggestion.brief_text;
      }

      // Constraints: build a partial out of just the selected fields.
      const sourceData =
        suggestion.constraints.archetype === "design"
          ? suggestion.constraints.data
          : {};
      const nextData: DesignConstraints = {};
      let anyConstraintSelected = false;
      const copyIfSelected = <K extends keyof DesignConstraints>(
        field: SelectableField,
        key: K,
      ) => {
        if (selected.has(field) && sourceData[key] !== undefined) {
          nextData[key] = sourceData[key];
          anyConstraintSelected = true;
        }
      };
      copyIfSelected("dimensions", "dimensions");
      copyIfSelected("materials_whitelist", "materials_whitelist");
      copyIfSelected("budget", "budget");
      copyIfSelected("audience", "audience");
      copyIfSelected("must_include", "must_include");
      copyIfSelected("must_avoid", "must_avoid");

      if (anyConstraintSelected) {
        patch.constraints = { archetype: "design", data: nextData };
      }

      if (Object.keys(patch).length === 0) {
        setError("Select at least one field to apply.");
        setApplying(false);
        return;
      }

      await onApply(patch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }, [suggestion, selected, onApply, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="AI brief assist"
      data-testid="ai-brief-assist-modal"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        data-testid="ai-brief-assist-backdrop"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <div className="relative flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              ✨ AI brief assist
            </h2>
            <p className="text-xs text-gray-600">
              Describe what you want — the AI reads your unit context + current
              draft + your request, then proposes brief text + constraints.
              Apply per field or regenerate with a different prompt.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="ai-brief-assist-close"
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {error && (
            <div
              role="alert"
              data-testid="ai-brief-assist-error"
              className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          <section className="mb-4">
            <label
              htmlFor="ai_brief_prompt"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              What do you want help with?
            </label>
            <textarea
              id="ai_brief_prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Draft a brief for designing a sustainable lunch box for Year 7. Budget ≤ $20. Locked must be recycled materials."
              rows={4}
              data-testid="ai-brief-assist-prompt"
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </section>

          {suggestion && (
            <section className="mb-2">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Suggestion — pick which to apply
              </h3>
              <div
                className="space-y-2 rounded border border-gray-200 p-3"
                data-testid="ai-brief-assist-suggestion"
              >
                {suggestion.brief_text && suggestion.brief_text.length > 0 && (
                  <SelectableRow
                    field="brief_text"
                    label="Brief"
                    value={
                      <p className="whitespace-pre-wrap text-gray-800">
                        {suggestion.brief_text}
                      </p>
                    }
                    selected={selected.has("brief_text")}
                    onToggle={toggleField}
                  />
                )}
                {suggestion.constraints.archetype === "design" &&
                  renderConstraintRows(
                    suggestion.constraints.data,
                    selected,
                    toggleField,
                  )}
              </div>
            </section>
          )}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-gray-200 px-6 py-3">
          <div className="text-xs text-gray-500">
            {generating
              ? "Generating…"
              : suggestion
                ? `${selected.size} field${selected.size === 1 ? "" : "s"} selected.`
                : "AI uses your unit's title, description, and current draft as context."}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={generating || applying}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            {suggestion ? (
              <>
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={generating || applying || prompt.trim().length === 0}
                  data-testid="ai-brief-assist-regenerate"
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {generating ? "Regenerating…" : "Regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => void apply()}
                  disabled={applying || generating || selected.size === 0}
                  data-testid="ai-brief-assist-apply"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-gray-300"
                >
                  {applying ? "Applying…" : "Apply selected"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void generate()}
                disabled={generating || prompt.trim().length === 0}
                data-testid="ai-brief-assist-generate"
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-gray-300"
              >
                {generating ? "Generating…" : "✨ Generate"}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function renderConstraintRows(
  data: DesignConstraints,
  selected: Set<SelectableField>,
  toggle: (f: SelectableField) => void,
) {
  const rows: React.ReactNode[] = [];
  if (data.dimensions) {
    rows.push(
      <SelectableRow
        key="dimensions"
        field="dimensions"
        label="Dimensions"
        value={<span>{formatDimensions(data.dimensions)}</span>}
        selected={selected.has("dimensions")}
        onToggle={toggle}
      />,
    );
  }
  if (data.materials_whitelist && data.materials_whitelist.length > 0) {
    rows.push(
      <SelectableRow
        key="materials_whitelist"
        field="materials_whitelist"
        label="Materials"
        value={
          <div className="flex flex-wrap gap-1.5">
            {data.materials_whitelist.map((m) => (
              <span
                key={m}
                className="rounded-full border border-gray-300 bg-white px-2 py-0.5 text-xs"
              >
                {MATERIAL_LABEL_BY_ID.get(m) ?? m}
              </span>
            ))}
          </div>
        }
        selected={selected.has("materials_whitelist")}
        onToggle={toggle}
      />,
    );
  }
  if (data.budget && data.budget.length > 0) {
    rows.push(
      <SelectableRow
        key="budget"
        field="budget"
        label="Budget"
        value={<span>{data.budget}</span>}
        selected={selected.has("budget")}
        onToggle={toggle}
      />,
    );
  }
  if (data.audience && data.audience.length > 0) {
    rows.push(
      <SelectableRow
        key="audience"
        field="audience"
        label="Audience"
        value={<span>{data.audience}</span>}
        selected={selected.has("audience")}
        onToggle={toggle}
      />,
    );
  }
  if (data.must_include && data.must_include.length > 0) {
    rows.push(
      <SelectableRow
        key="must_include"
        field="must_include"
        label="Must include"
        value={
          <ul className="list-disc pl-5">
            {data.must_include.map((m, i) => (
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        }
        selected={selected.has("must_include")}
        onToggle={toggle}
      />,
    );
  }
  if (data.must_avoid && data.must_avoid.length > 0) {
    rows.push(
      <SelectableRow
        key="must_avoid"
        field="must_avoid"
        label="Must avoid"
        value={
          <ul className="list-disc pl-5">
            {data.must_avoid.map((m, i) => (
              <li key={`${m}-${i}`}>{m}</li>
            ))}
          </ul>
        }
        selected={selected.has("must_avoid")}
        onToggle={toggle}
      />,
    );
  }
  return rows;
}

function SelectableRow({
  field,
  label,
  value,
  selected,
  onToggle,
}: {
  field: SelectableField;
  label: string;
  value: React.ReactNode;
  selected: boolean;
  onToggle: (f: SelectableField) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-start gap-3 rounded p-2 text-sm hover:bg-gray-50"
      data-testid={`ai-brief-assist-row-${field}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(field)}
        data-testid={`ai-brief-assist-toggle-${field}`}
        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className="mt-0.5 text-sm text-gray-800">{value}</div>
      </div>
    </label>
  );
}

function formatDimensions(d: DesignDimensions): string {
  const parts: string[] = [];
  if (typeof d.h === "number") parts.push(`H ${d.h}`);
  if (typeof d.w === "number") parts.push(`W ${d.w}`);
  if (typeof d.d === "number") parts.push(`D ${d.d}`);
  if (parts.length === 0) return "—";
  return `${parts.join(" × ")} ${d.unit ?? "mm"}`;
}
