"use client";

import { CURRICULUM_FRAMEWORKS, type CurriculumFrameworkId } from "@/lib/constants";
import type { KnowledgeItemCurriculum } from "@/types/knowledge-library";

type CurriculumRow = Omit<KnowledgeItemCurriculum, "id" | "item_id">;

interface CurriculumMapperProps {
  value: CurriculumRow[];
  onChange: (curricula: CurriculumRow[]) => void;
}

const FRAMEWORK_OPTIONS = Object.values(CURRICULUM_FRAMEWORKS);

export default function CurriculumMapper({
  value,
  onChange,
}: CurriculumMapperProps) {
  function addRow() {
    const usedFrameworks = new Set(value.map((c) => c.framework));
    const next = FRAMEWORK_OPTIONS.find((f) => !usedFrameworks.has(f.id));
    if (!next) return; // All frameworks already mapped

    onChange([
      ...value,
      {
        framework: next.id,
        criteria: [],
        strand: null,
        topic: null,
        year_group: null,
        textbook_ref: null,
      },
    ]);
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function updateRow(index: number, updates: Partial<CurriculumRow>) {
    onChange(
      value.map((row, i) => (i === index ? { ...row, ...updates } : row))
    );
  }

  function toggleCriterion(index: number, criterion: string) {
    const row = value[index];
    const criteria = row.criteria.includes(criterion)
      ? row.criteria.filter((c) => c !== criterion)
      : [...row.criteria, criterion];
    updateRow(index, { criteria });
  }

  function getFramework(id: string) {
    return CURRICULUM_FRAMEWORKS[id as CurriculumFrameworkId];
  }

  return (
    <div className="space-y-3">
      {value.map((row, i) => {
        const fw = getFramework(row.framework);
        if (!fw) return null;

        return (
          <div
            key={`${row.framework}-${i}`}
            className="border border-border rounded-lg p-3 bg-gray-50/50"
          >
            <div className="flex items-center justify-between mb-2">
              <select
                value={row.framework}
                onChange={(e) => {
                  updateRow(i, { framework: e.target.value, criteria: [] });
                }}
                className="text-sm border border-border rounded-lg px-2 py-1 bg-white text-text-primary"
              >
                {FRAMEWORK_OPTIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-text-secondary/40 hover:text-red-400 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Criteria checkboxes */}
            <div className="flex flex-wrap gap-2 mb-2">
              {fw.criteria.map((c) => (
                <label
                  key={c}
                  className={`flex items-center gap-1 text-xs cursor-pointer px-2.5 py-1 rounded-lg border transition ${
                    row.criteria.includes(c)
                      ? "border-brand-purple bg-brand-purple/5 text-brand-purple"
                      : "border-border text-text-secondary hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={row.criteria.includes(c)}
                    onChange={() => toggleCriterion(i, c)}
                    className="hidden"
                  />
                  <span className="font-medium">{c}</span>
                  {fw.criteriaLabels[c] && (
                    <span className="text-text-secondary/60 hidden sm:inline">
                      — {fw.criteriaLabels[c]}
                    </span>
                  )}
                </label>
              ))}
            </div>

            {/* Optional fields */}
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={row.strand || ""}
                onChange={(e) => updateRow(i, { strand: e.target.value || null })}
                placeholder="Strand"
                className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary placeholder:text-text-secondary/40"
              />
              <input
                type="text"
                value={row.topic || ""}
                onChange={(e) => updateRow(i, { topic: e.target.value || null })}
                placeholder="Topic"
                className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary placeholder:text-text-secondary/40"
              />
              <input
                type="text"
                value={row.year_group || ""}
                onChange={(e) => updateRow(i, { year_group: e.target.value || null })}
                placeholder="Year group"
                className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary placeholder:text-text-secondary/40"
              />
              <input
                type="text"
                value={row.textbook_ref || ""}
                onChange={(e) => updateRow(i, { textbook_ref: e.target.value || null })}
                placeholder="Textbook ref"
                className="text-xs border border-border rounded px-2 py-1 bg-white text-text-primary placeholder:text-text-secondary/40"
              />
            </div>
          </div>
        );
      })}

      {value.length < FRAMEWORK_OPTIONS.length && (
        <button
          type="button"
          onClick={addRow}
          className="w-full py-2 border border-dashed border-border rounded-lg text-xs text-text-secondary hover:border-brand-purple hover:text-brand-purple transition"
        >
          + Add curriculum mapping
        </button>
      )}
    </div>
  );
}
