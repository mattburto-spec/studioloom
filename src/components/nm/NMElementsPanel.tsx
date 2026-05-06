"use client";

/**
 * NMElementsPanel — slim teacher-facing setup for NM elements.
 *
 * Replaces the 3-step NMConfigPanel wizard for the Metrics tab. The
 * student-side flow (which lessons collect surveys) lives in the
 * lesson editor's "New Metrics" block category. This panel is just
 * "which elements am I tracking in this unit?".
 *
 * Why this exists (round 8, 6 May 2026): Matt removed the heavy
 * NMConfigPanel from the Metrics tab on 4 May (Lever-MM declutter)
 * and pushed checkpoint authoring into the lesson editor. But there
 * was no way left for a teacher to ADJUST which elements show up in
 * the teaching-mode observation popup or the student survey. This
 * gap broke the end-to-end NM setup flow. Filed + closed as
 * FU-AGENCY-NM-SETUP-RESTORE.
 */

import { useState, useMemo } from "react";
import {
  AGENCY_ELEMENTS,
  NM_COMPETENCIES,
  getElementsForCompetency,
  type NMUnitConfig,
} from "@/lib/nm/constants";

interface NMElementsPanelProps {
  currentConfig: NMUnitConfig;
  /** Called with the new config — parent persists via /api/teacher/nm-config. */
  onSave: (next: NMUnitConfig) => Promise<void> | void;
}

export function NMElementsPanel({
  currentConfig,
  onSave,
}: NMElementsPanelProps) {
  const initialCompetency =
    currentConfig.competencies?.[0] ?? "agency_in_learning";

  const [enabled, setEnabled] = useState(currentConfig.enabled ?? false);
  const [competency, setCompetency] = useState(initialCompetency);
  const [selectedElements, setSelectedElements] = useState<string[]>(
    currentConfig.elements ?? []
  );
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const availableElements = useMemo(() => {
    const elements = getElementsForCompetency(competency);
    return elements.length > 0 ? elements : AGENCY_ELEMENTS;
  }, [competency]);

  const dirty =
    enabled !== (currentConfig.enabled ?? false) ||
    competency !== initialCompetency ||
    !sameSet(selectedElements, currentConfig.elements ?? []);

  function toggleElement(id: string) {
    setSelectedElements((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setSaveStatus("idle");
  }

  function selectAll() {
    setSelectedElements(availableElements.map((e) => e.id));
    setSaveStatus("idle");
  }

  function clearAll() {
    setSelectedElements([]);
    setSaveStatus("idle");
  }

  async function handleSave() {
    setSaving(true);
    setErrorMsg(null);
    setSaveStatus("idle");
    try {
      // Preserve existing checkpoints — they live in the lesson editor
      // surface; this panel only controls competency + elements.
      const next: NMUnitConfig = {
        enabled,
        competencies: enabled ? [competency] : [],
        elements: enabled ? selectedElements : [],
        checkpoints: currentConfig.checkpoints ?? {},
      };
      await onSave(next);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err: unknown) {
      setSaveStatus("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Save failed. Try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-5"
      data-testid="nm-elements-panel"
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-bold text-gray-900 leading-tight">
            Three Cs / Agency elements
          </h3>
          <p className="text-[11.5px] text-gray-600 mt-1 leading-snug">
            Choose which elements you&apos;ll track for this class+unit.
            These appear in the teacher observation popup and in any New
            Metrics survey blocks added to lessons. Per-lesson checkpoint
            setup (when students see the survey) is in the{" "}
            <strong>lesson editor → Blocks → New Metrics</strong> category.
          </p>
        </div>

        {/* Enable / disable toggle */}
        <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
          <span className="text-[10.5px] uppercase tracking-wide font-bold text-gray-700">
            {enabled ? "Tracking on" : "Tracking off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => {
              setEnabled((v) => !v);
              setSaveStatus("idle");
            }}
            className={
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors " +
              (enabled ? "bg-violet-600" : "bg-gray-300")
            }
            data-testid="nm-elements-toggle"
          >
            <span
              className={
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform " +
                (enabled ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </button>
        </label>
      </header>

      {/* Competency selector — only shows when more than one competency
          is offered. v1 has 7; we let the teacher pick but default to
          agency_in_learning since that's the Cowork Three Cs anchor. */}
      <div className="mb-4">
        <label className="block">
          <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide block mb-1.5">
            Competency
          </span>
          <select
            value={competency}
            onChange={(e) => {
              setCompetency(e.target.value);
              // Drop element selections that don't belong to the new competency
              const next = getElementsForCompetency(e.target.value);
              const validIds = new Set(next.map((x) => x.id));
              setSelectedElements((prev) => prev.filter((id) => validIds.has(id)));
              setSaveStatus("idle");
            }}
            disabled={!enabled}
            className="w-full text-[12px] px-3 py-1.5 bg-white border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-300 focus:border-violet-500 disabled:bg-gray-50 disabled:text-gray-400"
            data-testid="nm-elements-competency"
          >
            {NM_COMPETENCIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-[10.5px] text-gray-500 mt-1">
            v1 supports one competency per unit. Pick the one most aligned with
            your unit&apos;s learning goals.
          </p>
        </label>
      </div>

      {/* Element checkboxes */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10.5px] font-semibold text-gray-700 uppercase tracking-wide">
            Track these elements ({selectedElements.length} of{" "}
            {availableElements.length})
          </span>
          <div className="flex items-center gap-2 text-[10.5px]">
            <button
              type="button"
              onClick={selectAll}
              disabled={!enabled}
              className="text-violet-700 hover:text-violet-900 disabled:text-gray-400 underline underline-offset-2"
              data-testid="nm-elements-select-all"
            >
              Select all
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={clearAll}
              disabled={!enabled}
              className="text-gray-600 hover:text-gray-900 disabled:text-gray-400 underline underline-offset-2"
              data-testid="nm-elements-clear-all"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
          {availableElements.map((el) => {
            const checked = selectedElements.includes(el.id);
            return (
              <label
                key={el.id}
                className={
                  "flex items-start gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors " +
                  (!enabled
                    ? "bg-gray-50 border-gray-200 cursor-not-allowed opacity-60"
                    : checked
                    ? "bg-violet-50 border-violet-300"
                    : "bg-white border-gray-200 hover:border-violet-300 hover:bg-violet-50/40")
                }
                style={
                  enabled && checked
                    ? { borderLeft: `4px solid ${el.color}` }
                    : undefined
                }
                data-testid={`nm-elements-row-${el.id}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleElement(el.id)}
                  disabled={!enabled}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                  data-testid={`nm-elements-checkbox-${el.id}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold text-gray-900 leading-snug">
                    {el.name}
                  </div>
                  <div className="text-[10.5px] text-gray-500 leading-snug">
                    {el.studentDescription}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Save row */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
        <span
          className={
            "text-[11px] " +
            (saveStatus === "saved"
              ? "text-emerald-700 font-semibold"
              : saveStatus === "error"
              ? "text-rose-700"
              : "text-gray-500")
          }
        >
          {saveStatus === "saved"
            ? "✓ Saved"
            : saveStatus === "error"
            ? errorMsg ?? "Save failed."
            : dirty
            ? "Unsaved changes"
            : "Up to date"}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className={
            "text-[12px] px-4 py-1.5 rounded font-semibold transition-colors " +
            (saving || !dirty
              ? "bg-violet-300 text-white cursor-not-allowed"
              : "bg-violet-600 text-white hover:bg-violet-700")
          }
          data-testid="nm-elements-save"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((x) => setA.has(x));
}
