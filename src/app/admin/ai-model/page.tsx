"use client";

import { useState, useEffect, useReducer } from "react";
import type {
  AIModelConfig,
  ResolvedModelConfig,
  CategoryMeta,
  SliderMeta,
} from "@/types/ai-model-config";
import {
  CATEGORY_META,
  TIMING_CATEGORY_META,
  DEFAULT_MODEL_CONFIG,
} from "@/lib/ai/model-config-defaults";
import { AIControlPanel } from "@/components/admin/AIControlPanel";

// =========================================================================
// Types
// =========================================================================

type CategoryKey = keyof AIModelConfig | "timingProfiles";

interface TestInput {
  topic: string;
  gradeLevel: string;
  endGoal: string;
  lessonCount: number;
  lessonLengthMinutes: number;
}

type Action =
  | { type: "SET_FULL"; config: ResolvedModelConfig }
  | { type: "SET_SLIDER"; category: string; key: string; value: number }
  | { type: "SET_TIMING"; year: number; field: string; value: number }
  | { type: "RESET_CATEGORY"; category: string }
  | { type: "RESET_ALL" };

// =========================================================================
// Reducer
// =========================================================================

function configReducer(state: ResolvedModelConfig, action: Action): ResolvedModelConfig {
  switch (action.type) {
    case "SET_FULL":
      return action.config;

    case "SET_SLIDER": {
      const cat = action.category as keyof ResolvedModelConfig;
      const current = state[cat];
      if (typeof current === "object" && current !== null && !Array.isArray(current)) {
        return {
          ...state,
          [cat]: { ...current, [action.key]: action.value },
        };
      }
      return state;
    }

    case "SET_TIMING": {
      const profiles = { ...state.timingProfiles };
      if (profiles[action.year]) {
        profiles[action.year] = {
          ...profiles[action.year],
          [action.field]: action.value,
        };
      }
      return { ...state, timingProfiles: profiles };
    }

    case "RESET_CATEGORY": {
      const cat = action.category as keyof ResolvedModelConfig;
      return {
        ...state,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [cat]: (DEFAULT_MODEL_CONFIG as unknown as Record<string, any>)[cat],
      };
    }

    case "RESET_ALL":
      return { ...DEFAULT_MODEL_CONFIG };

    default:
      return state;
  }
}

// =========================================================================
// Helper: compute diff (only non-default values)
// =========================================================================

function computeDiff(current: ResolvedModelConfig): AIModelConfig {
  const diff: AIModelConfig = {};
  const d = DEFAULT_MODEL_CONFIG;

  // Simple categories
  for (const cat of CATEGORY_META) {
    const key = cat.key as keyof ResolvedModelConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentCat = current[key] as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultCat = d[key] as any;
    const catDiff: Record<string, number> = {};
    let hasChanges = false;
    for (const k of Object.keys(defaultCat)) {
      if (currentCat[k] !== defaultCat[k]) {
        catDiff[k] = currentCat[k];
        hasChanges = true;
      }
    }
    if (hasChanges) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (diff as any)[key] = catDiff;
    }
  }

  // Timing profiles
  const timingDiff: Record<number, Record<string, unknown>> = {};
  let hasTimingChanges = false;
  for (const year of [1, 2, 3, 4, 5]) {
    const cur = current.timingProfiles[year];
    const def = d.timingProfiles[year];
    if (!cur || !def) continue;
    const yearDiff: Record<string, unknown> = {};
    let yearHasChanges = false;
    for (const field of Object.keys(def) as (keyof typeof def)[]) {
      if (field === "pacingNote" || field === "mypYear") continue;
      if (cur[field] !== def[field]) {
        yearDiff[field] = cur[field];
        yearHasChanges = true;
      }
    }
    if (yearHasChanges) {
      timingDiff[year] = yearDiff;
      hasTimingChanges = true;
    }
  }
  if (hasTimingChanges) {
    diff.timingProfiles = timingDiff as AIModelConfig["timingProfiles"];
  }

  return diff;
}

// =========================================================================
// Grade options
// =========================================================================

const GRADE_OPTIONS = [
  "Year 1 (Grade 6)",
  "Year 2 (Grade 7)",
  "Year 3 (Grade 8)",
  "Year 4 (Grade 9)",
  "Year 5 (Grade 10)",
];

// =========================================================================
// Components
// =========================================================================

function SliderRow({
  meta,
  value,
  onChange,
}: {
  meta: SliderMeta;
  value: number;
  onChange: (v: number) => void;
}) {
  const isDefault = value === meta.defaultValue;
  const pct = ((value - meta.min) / (meta.max - meta.min)) * 100;

  return (
    <div className="group flex items-center gap-4 py-3 px-3 rounded-xl hover:bg-white/60 transition-colors">
      <div className="w-48 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{meta.label}</span>
          {meta.effectSize && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              {meta.effectSize}
            </span>
          )}
        </div>
        {meta.description && (
          <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{meta.description}</p>
        )}
      </div>

      <div className="flex-1 relative">
        <input
          type="range"
          min={meta.min}
          max={meta.max}
          step={meta.step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-purple-600"
          style={{
            background: `linear-gradient(to right, #7C3AED ${pct}%, #E5E7EB ${pct}%)`,
          }}
        />
        {/* Default indicator */}
        {!isDefault && (
          <div
            className="absolute top-0 w-0.5 h-1.5 bg-gray-400 rounded pointer-events-none"
            style={{ left: `${((meta.defaultValue - meta.min) / (meta.max - meta.min)) * 100}%` }}
            title={`Default: ${meta.defaultValue}`}
          />
        )}
      </div>

      <div className="w-16 text-right">
        <span className={`text-sm font-mono font-semibold ${isDefault ? "text-gray-600" : "text-purple-700"}`}>
          {meta.step < 1 ? value.toFixed(2) : value}
        </span>
      </div>

      {!isDefault && (
        <button
          onClick={() => onChange(meta.defaultValue)}
          className="text-[10px] text-gray-400 hover:text-purple-600 transition-colors px-1"
          title="Reset to default"
        >
          reset
        </button>
      )}
    </div>
  );
}

function CategoryPanel({
  meta,
  values,
  onSliderChange,
  onReset,
}: {
  meta: CategoryMeta;
  values: Record<string, number>;
  onSliderChange: (key: string, value: number) => void;
  onReset: () => void;
}) {
  const changedCount = meta.sliders.filter(
    (s) => values[s.key] !== s.defaultValue
  ).length;

  // Validate relative emphasis
  const isRelativeEmphasis = meta.key === "relativeEmphasis";
  const sum = isRelativeEmphasis
    ? Object.values(values).reduce((a, b) => a + b, 0)
    : 0;
  const sumValid = !isRelativeEmphasis || Math.abs(sum - 100) <= 0.5;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{meta.label}</h2>
          <p className="text-sm text-gray-500">{meta.description}</p>
        </div>
        {changedCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-md px-3 py-1.5 hover:bg-purple-50 transition-colors"
          >
            Reset ({changedCount} changed)
          </button>
        )}
      </div>

      {isRelativeEmphasis && (
        <div className={`text-xs font-mono mb-3 px-3 py-2 rounded ${sumValid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          Total: {sum}% {sumValid ? "OK" : "(must equal 100%)"}
        </div>
      )}

      <div className="space-y-0.5">
        {meta.sliders.map((slider) => (
          <SliderRow
            key={slider.key}
            meta={slider}
            value={values[slider.key] ?? slider.defaultValue}
            onChange={(v) => onSliderChange(slider.key, v)}
          />
        ))}
      </div>
    </div>
  );
}

function TimingPanel({
  profiles,
  onTimingChange,
  onReset,
}: {
  profiles: ResolvedModelConfig["timingProfiles"];
  onTimingChange: (year: number, field: string, value: number) => void;
  onReset: () => void;
}) {
  const fields = TIMING_CATEGORY_META.fields;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{TIMING_CATEGORY_META.label}</h2>
          <p className="text-sm text-gray-500">{TIMING_CATEGORY_META.description}</p>
        </div>
        <button
          onClick={onReset}
          className="text-xs text-purple-600 hover:text-purple-800 border border-purple-200 rounded-md px-3 py-1.5 hover:bg-purple-50 transition-colors"
        >
          Reset to defaults
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 px-3 text-gray-500 font-medium">Field</th>
              {TIMING_CATEGORY_META.years.map((y) => (
                <th key={y} className="text-center py-2 px-3 text-gray-500 font-medium">
                  Year {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.key} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-2 px-3 font-medium text-gray-900 text-xs">{field.label}</td>
                {TIMING_CATEGORY_META.years.map((year) => {
                  const profile = profiles[year];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const val = profile ? (profile as any)[field.key] as number : 0;
                  const defProfile = DEFAULT_MODEL_CONFIG.timingProfiles[year];
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const defVal = defProfile ? (defProfile as any)[field.key] as number : 0;
                  const isChanged = val !== defVal;

                  return (
                    <td key={year} className="py-1 px-2 text-center">
                      <input
                        type="number"
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        value={val}
                        onChange={(e) => onTimingChange(year, field.key, parseInt(e.target.value) || 0)}
                        className={`w-14 text-center text-sm border rounded px-1 py-1 ${
                          isChanged
                            ? "border-purple-400 bg-purple-50 text-purple-700 font-semibold"
                            : "border-gray-200 text-gray-700"
                        }`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =========================================================================
// Test Results — Tabbed View (Admin / Student Preview / Thinking / JSON)
// =========================================================================

const LESSON_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  research: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  ideation: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  "skills-demo": { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  making: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  testing: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
  critique: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

const LESSON_TYPE_ICONS: Record<string, string> = {
  research: "🔍",
  ideation: "💡",
  "skills-demo": "🛠",
  making: "🏗",
  testing: "🧪",
  critique: "📋",
};

// Phase/criterion colors matching student UI
const PHASE_COLORS: Record<string, string> = {
  research: "#3B82F6", ideation: "#8B5CF6", planning: "#6366F1",
  "skills-demo": "#F59E0B", making: "#22C55E", testing: "#F97316",
  iteration: "#14B8A6", evaluation: "#F43F5E", critique: "#EC4899",
};

const CRITERION_COLORS: Record<string, string> = {
  A: "#6366F1", B: "#10B981", C: "#F59E0B", D: "#8B5CF6",
};

type ResultTab = "admin" | "student" | "thinking" | "json";
type TestMode = "skeleton" | "lesson";

const LESSON_TYPES = [
  { value: "research", label: "Research", icon: "🔍" },
  { value: "ideation", label: "Ideation", icon: "💡" },
  { value: "skills-demo", label: "Skills Demo", icon: "🛠" },
  { value: "making", label: "Making", icon: "🏗" },
  { value: "testing", label: "Testing", icon: "🧪" },
  { value: "critique", label: "Critique", icon: "📋" },
];

const FRAMEWORKS = [
  { value: "IB_MYP", label: "IB MYP Design", criteria: ["A", "B", "C", "D"] },
  { value: "GCSE_DT", label: "GCSE Design & Technology", criteria: ["AO1", "AO2", "AO3", "AO4", "AO5"] },
  { value: "ACARA_DT", label: "Australian Curriculum DT", criteria: ["KU", "P&P"] },
  { value: "PLTW", label: "Project Lead The Way (US)", criteria: ["IED", "POE", "CEA", "DE"] },
  { value: "A_LEVEL_DT", label: "A-Level Design & Technology", criteria: ["C1", "C2", "C3"] },
  { value: "IGCSE_DT", label: "Cambridge IGCSE DT", criteria: ["AO1", "AO2", "AO3"] },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TestResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const isLessonMode = result?._mode === "lesson";

  if (isLessonMode) {
    return <LessonResultsView result={result} elapsed={elapsed} />;
  }
  return <SkeletonResultsView result={result} elapsed={elapsed} />;
}

// =========================================================================
// Skeleton Results View (improved)
// =========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SkeletonResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("admin");
  const [selectedLesson, setSelectedLesson] = useState(0);
  const skeleton = result?.skeleton;
  const unit = skeleton?.unit || (skeleton?.lessons ? skeleton : null);
  const lessons = skeleton?.lessons || skeleton?.unit?.lessons;
  const tokens = result?.tokensUsed;
  const thinking = result?.thinking;

  // Compute summary stats
  const totalMinutes = lessons?.reduce((sum: number, l: { estimatedMinutes?: number }) => sum + (l.estimatedMinutes || 0), 0) || 0;
  const typeCounts: Record<string, number> = {};
  const criteriaCovered = new Set<string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  lessons?.forEach((l: any) => {
    if (l.lessonType) typeCounts[l.lessonType] = (typeCounts[l.lessonType] || 0) + 1;
    const criteria = Array.isArray(l.criteriaEmphasis) ? l.criteriaEmphasis : [];
    criteria.forEach((c: string) => criteriaCovered.add(c));
  });

  const tabs: { key: ResultTab; label: string; icon: string; show: boolean }[] = [
    { key: "admin", label: "Admin", icon: "⚙️", show: true },
    { key: "student", label: "Student Preview", icon: "👤", show: !!lessons?.length },
    { key: "thinking", label: "AI Thinking", icon: "💡", show: !!thinking },
    { key: "json", label: "Raw JSON", icon: "{}", show: true },
  ];

  return (
    <div className="mt-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
          ⏱ {(elapsed / 1000).toFixed(1)}s
        </span>
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
          🔤 {tokens ? `${tokens.input_tokens + tokens.output_tokens} tokens` : "—"}
        </span>
        {lessons?.length > 0 && (
          <>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📚 {lessons.length} lessons
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              ⏱ {totalMinutes}min total
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📊 Criteria: {Array.from(criteriaCovered).sort().join(", ") || "—"}
            </span>
          </>
        )}
      </div>

      {/* Lesson Type Distribution */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {Object.entries(typeCounts).map(([type, count]) => {
            const tc = LESSON_TYPE_COLORS[type] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
            const icon = LESSON_TYPE_ICONS[type] || "📄";
            return (
              <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
                {icon} {type} x{count}
              </span>
            );
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-0">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.key
                ? "bg-white text-purple-700 border border-gray-200 border-b-white -mb-px"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border border-t-0 border-gray-200 rounded-b-xl bg-white">

        {/* ── ADMIN VIEW ── */}
        {activeTab === "admin" && lessons?.length && (
          <div className="p-4 space-y-3">
            {/* Unit Card */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-5 text-white">
              <h4 className="font-bold text-lg mb-1">
                {(unit?.title || "Test Skeleton")?.replace("Test: ", "")}
              </h4>
              <p className="text-purple-200 text-sm mb-3">{unit?.endGoal || ""}</p>
              <div className="flex gap-4 text-xs text-purple-200">
                <span>{lessons.length} lessons</span>
                <span>•</span>
                <span>{totalMinutes}min total</span>
              </div>
              {unit?.narrativeArc && (
                <p className="mt-3 text-xs text-purple-100 leading-relaxed border-t border-purple-500 pt-3">
                  <span className="font-semibold text-purple-200">Narrative Arc: </span>
                  {unit.narrativeArc}
                </p>
              )}
            </div>

            {/* Lesson Cards */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {lessons.map((lesson: any, i: number) => {
              const tc = LESSON_TYPE_COLORS[lesson.lessonType] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
              const icon = LESSON_TYPE_ICONS[lesson.lessonType] || "📄";
              return (
                <div key={i} className={`border ${tc.border} rounded-lg overflow-hidden`}>
                  <div className={`${tc.bg} px-4 py-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">{lesson.lessonNumber}. {lesson.title}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.text} border ${tc.border}`}>
                        {icon} {lesson.lessonType}
                      </span>
                      <span className="text-xs text-gray-500">{lesson.estimatedMinutes}min</span>
                      {lesson.phase && <span className="text-xs text-gray-400">• {lesson.phase}</span>}
                      {(Array.isArray(lesson.criteriaEmphasis) ? lesson.criteriaEmphasis : typeof lesson.criteriaEmphasis === "string" ? [lesson.criteriaEmphasis] : []).map((c: string) => (
                        <span key={c} className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-gray-200 text-xs font-bold text-purple-600">{c}</span>
                      ))}
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2.5 bg-white">
                    {(lesson.drivingQuestion || lesson.keyDrivingQuestion) && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Driving Question</span>
                        <p className="text-sm text-gray-700 italic mt-0.5">{lesson.drivingQuestion || lesson.keyDrivingQuestion}</p>
                      </div>
                    )}
                    {lesson.learningIntention && (
                      <div className="bg-purple-50 rounded-lg px-3 py-2.5">
                        <div className="flex items-start gap-2">
                          <span className="text-purple-500 mt-0.5 text-sm">🎯</span>
                          <div className="flex-1">
                            <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Learning Intention</span>
                            <p className="text-sm text-purple-900 mt-0.5">{lesson.learningIntention}</p>
                          </div>
                        </div>
                        {lesson.successCriteria?.length > 0 && (
                          <div className="mt-2 ml-6 space-y-1">
                            <span className="text-xs font-semibold text-purple-600">Success Criteria:</span>
                            {lesson.successCriteria.map((sc: string, j: number) => (
                              <div key={j} className="flex items-start gap-1.5 text-xs text-purple-800">
                                <span className="text-purple-400 mt-0.5">✓</span><span>{sc}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex gap-4 flex-wrap">
                      {lesson.cumulativeVocab?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">Vocab:</span>
                          {lesson.cumulativeVocab.map((v: string) => (
                            <span key={v} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{v}</span>
                          ))}
                        </div>
                      )}
                      {lesson.cumulativeSkills?.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-semibold text-gray-500">Skills:</span>
                          {lesson.cumulativeSkills.map((s: string) => (
                            <span key={s} className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded text-xs">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {lesson.activityHints?.length > 0 && (
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Activities</span>
                        <div className="mt-1.5 space-y-1.5">
                          {lesson.activityHints.map((hint: string, j: number) => (
                            <div key={j} className="flex items-start gap-2">
                              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold flex items-center justify-center mt-0.5">{j + 1}</span>
                              <span className="text-sm text-gray-700">{hint}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STUDENT PREVIEW ── */}
        {activeTab === "student" && lessons?.length && (
          <div className="flex">
            {/* Mini Sidebar */}
            <div className="w-48 min-h-[400px] bg-gradient-to-b from-[#7B2FF2] to-[#4A0FB0] p-3 flex-shrink-0">
              <div className="mb-4">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Unit</p>
                <p className="text-xs font-bold text-white leading-tight">
                  {(unit?.title || "Test Skeleton")?.replace("Test: ", "")}
                </p>
                {/* Progress bar */}
                <div className="mt-2 h-1 bg-white/10 rounded-full">
                  <div className="h-1 bg-emerald-400 rounded-full" style={{ width: "0%" }} />
                </div>
              </div>
              <div className="space-y-0.5">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {lessons.map((lesson: any, i: number) => {
                  const isActive = i === selectedLesson;
                  const phaseColor = PHASE_COLORS[lesson.lessonType] || "#9CA3AF";
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedLesson(i)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                        isActive ? "bg-white/15" : "hover:bg-white/5"
                      }`}
                      style={isActive ? { borderLeft: `3px solid ${phaseColor}` } : { borderLeft: "3px solid transparent" }}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isActive ? "border-white bg-white/20" : "border-white/30"
                      }`}>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                      <span className={`truncate ${isActive ? "text-white font-medium" : "text-white/60"}`}>
                        {lesson.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Lesson Content Preview */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lesson: any = lessons[selectedLesson];
              if (!lesson) return null;
              const criteria = Array.isArray(lesson.criteriaEmphasis) ? lesson.criteriaEmphasis : typeof lesson.criteriaEmphasis === "string" ? [lesson.criteriaEmphasis] : [];
              const pageColor = CRITERION_COLORS[criteria[0]] || PHASE_COLORS[lesson.lessonType] || "#7B2FF2";
              return (
                <div className="flex-1 min-w-0">
                  {/* Hero Header */}
                  <div className="px-8 pt-8 pb-6" style={{ background: `linear-gradient(135deg, ${pageColor}, ${pageColor}dd)` }}>
                    <p className="text-xs font-medium text-white/60 mb-1">Lesson {lesson.lessonNumber} of {lessons.length}</p>
                    <h2 className="text-2xl font-extrabold text-white mb-3">{lesson.title}</h2>
                    <div className="flex gap-2 flex-wrap">
                      {criteria.map((c: string) => (
                        <span key={c} className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-white/20">
                          Criterion {c}
                        </span>
                      ))}
                      {lesson.lessonType && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white bg-white/20">
                          {LESSON_TYPE_ICONS[lesson.lessonType]} {lesson.lessonType}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Learning Objectives Block */}
                  <div className="px-8 py-4" style={{ backgroundColor: `${pageColor}15` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: `${pageColor}99` }}>
                      Learning Objectives
                    </p>
                    <p className="text-base font-medium leading-relaxed" style={{ color: pageColor }}>
                      {lesson.learningIntention || "Students will explore and develop their understanding..."}
                    </p>
                  </div>

                  {/* Main Content Area */}
                  <div className="px-8 py-6 space-y-6 max-w-2xl">
                    {/* Driving Question */}
                    {(lesson.drivingQuestion || lesson.keyDrivingQuestion) && (
                      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-1">Driving Question</p>
                        <p className="text-sm text-blue-800 italic">{lesson.drivingQuestion || lesson.keyDrivingQuestion}</p>
                      </div>
                    )}

                    {/* Success Criteria */}
                    {lesson.successCriteria?.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Success Criteria</p>
                        <div className="space-y-2">
                          {lesson.successCriteria.map((sc: string, j: number) => (
                            <div key={j} className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded border-2 border-gray-300 flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700">{sc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Vocab Warmup */}
                    {lesson.cumulativeVocab?.length > 0 && (
                      <div className="border border-gray-200 rounded-2xl p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary</p>
                        <div className="flex gap-2 flex-wrap">
                          {lesson.cumulativeVocab.map((v: string) => (
                            <span key={v} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Activity Hints as Simulated Activities */}
                    {lesson.activityHints?.length > 0 && (
                      <div className="space-y-4">
                        {lesson.activityHints.map((hint: string, j: number) => (
                          <div key={j}>
                            {/* Section Divider */}
                            <div className="flex items-center justify-center my-4">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: pageColor }}>
                                {j + 1}
                              </div>
                            </div>
                            {/* Activity Card */}
                            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                              <p className="text-base font-semibold text-gray-900 mb-2">{hint}</p>
                              <div className="h-1 w-16 rounded-full mb-4" style={{ backgroundColor: pageColor }} />
                              {/* Simulated response area */}
                              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                                <p className="text-xs text-gray-400">Student response area</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Complete Button */}
                    <div className="pt-4 pb-2">
                      <button
                        className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg"
                        style={{ backgroundColor: pageColor }}
                        disabled
                      >
                        Complete & Continue →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── AI THINKING ── */}
        {activeTab === "thinking" && thinking && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500 text-lg">💡</span>
              <span className="text-sm font-semibold text-gray-900">AI Reasoning Process</span>
              <span className="text-xs text-gray-400 ml-auto">
                {thinking.length > 1000 ? `${(thinking.length / 1000).toFixed(1)}k chars` : `${thinking.length} chars`}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{thinking}</p>
            </div>
          </div>
        )}

        {/* ── RAW JSON ── */}
        {activeTab === "json" && (
          <pre className="p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {/* Fallback if no lessons parsed */}
        {activeTab === "admin" && !lessons?.length && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">Could not parse lesson structure. Showing raw output:</p>
            <pre className="bg-gray-50 text-gray-700 text-xs p-4 rounded-lg font-mono whitespace-pre-wrap">
              {JSON.stringify(result?.skeleton || result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Single Lesson Results View (full content)
// =========================================================================

const RESPONSE_TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  text: { label: "Written Response", icon: "✏️" },
  upload: { label: "File Upload", icon: "📎" },
  voice: { label: "Voice Recording", icon: "🎤" },
  link: { label: "Link Submission", icon: "🔗" },
  multi: { label: "Multiple Choice", icon: "☑️" },
  "decision-matrix": { label: "Decision Matrix", icon: "📊" },
  pmi: { label: "PMI Framework", icon: "➕" },
  pairwise: { label: "Pairwise Comparison", icon: "⚖️" },
  "trade-off-sliders": { label: "Trade-off Sliders", icon: "🎚️" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LessonResultsView({ result, elapsed }: { result: any; elapsed: number }) {
  const [activeTab, setActiveTab] = useState<ResultTab>("admin");
  const lesson = result?.lesson;
  const tokens = result?.tokensUsed;
  const thinking = result?.thinking;

  const sections = lesson?.sections || [];
  const sectionCount = sections.length;
  const responseTypes = sections.map((s: { responseType?: string }) => s.responseType).filter(Boolean);
  const hasScaffolding = sections.some((s: { scaffolding?: unknown }) => s.scaffolding);
  const portfolioCount = sections.filter((s: { portfolioCapture?: boolean }) => s.portfolioCapture).length;

  const tabs: { key: ResultTab; label: string; icon: string; show: boolean }[] = [
    { key: "admin", label: "Content Review", icon: "⚙️", show: true },
    { key: "student", label: "Student Preview", icon: "👤", show: !!lesson },
    { key: "thinking", label: "AI Thinking", icon: "💡", show: !!thinking },
    { key: "json", label: "Raw JSON", icon: "{}", show: true },
  ];

  return (
    <div className="mt-4">
      {/* Stats Bar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full text-xs font-medium">
          ⏱ {(elapsed / 1000).toFixed(1)}s
        </span>
        <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
          🔤 {tokens ? `${tokens.input_tokens + tokens.output_tokens} tokens` : "—"}
        </span>
        {lesson && (
          <>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📝 {sectionCount} sections
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              🎒 {hasScaffolding ? "ELL scaffolding" : "No scaffolding"}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full text-xs font-medium">
              📸 {portfolioCount} portfolio captures
            </span>
          </>
        )}
      </div>

      {/* Response Type Distribution */}
      {responseTypes.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {responseTypes.map((rt: string, i: number) => {
            const info = RESPONSE_TYPE_LABELS[rt] || { label: rt, icon: "📄" };
            return (
              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                {info.icon} {info.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-0">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.key
                ? "bg-white text-purple-700 border border-gray-200 border-b-white -mb-px"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border border-t-0 border-gray-200 rounded-b-xl bg-white">

        {/* ── CONTENT REVIEW (Admin) ── */}
        {activeTab === "admin" && lesson && (
          <div className="p-4 space-y-4">
            {/* Lesson Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-800 rounded-xl p-5 text-white">
              <h4 className="font-bold text-lg mb-1">{lesson.title}</h4>
              <p className="text-purple-200 text-sm">{lesson.learningGoal}</p>
            </div>

            {/* Vocab Warmup */}
            {lesson.vocabWarmup?.terms?.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary Warmup</h5>
                <div className="space-y-2">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {lesson.vocabWarmup.terms.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-sm font-semibold border border-purple-100 flex-shrink-0">
                        {t.term}
                      </span>
                      <div className="text-sm text-gray-600">
                        <span>{t.definition}</span>
                        {t.example && <span className="text-gray-400 ml-1">— e.g. {t.example}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {lesson.vocabWarmup.activity && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">Activity: </span>
                    <span className="text-xs font-medium text-purple-600">{lesson.vocabWarmup.activity.type}</span>
                  </div>
                )}
              </div>
            )}

            {/* Introduction */}
            {lesson.introduction?.text && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Introduction</h5>
                <p className="text-sm text-gray-700 leading-relaxed">{lesson.introduction.text}</p>
              </div>
            )}

            {/* Sections — the main content */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {sections.map((section: any, i: number) => {
              const rtInfo = RESPONSE_TYPE_LABELS[section.responseType] || { label: section.responseType, icon: "📄" };
              const criterionTags = section.criterionTags || [];
              return (
                <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Section Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-900 flex-1">Section {i + 1}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                      {rtInfo.icon} {rtInfo.label}
                    </span>
                    {section.durationMinutes && (
                      <span className="text-xs text-gray-500">{section.durationMinutes}min</span>
                    )}
                    {section.portfolioCapture && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        📸 Portfolio
                      </span>
                    )}
                    {criterionTags.map((c: string) => (
                      <span key={c} className="inline-flex items-center justify-center w-5 h-5 rounded bg-white border border-gray-200 text-xs font-bold text-purple-600">{c}</span>
                    ))}
                  </div>

                  {/* Section Content */}
                  <div className="px-4 py-3 space-y-3">
                    {/* Prompt */}
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Student Prompt</span>
                      <p className="text-sm text-gray-800 mt-1 leading-relaxed whitespace-pre-wrap">{section.prompt}</p>
                    </div>

                    {/* Example Response */}
                    {section.exampleResponse && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Example Response</span>
                        <p className="text-sm text-emerald-800 mt-1 leading-relaxed">{section.exampleResponse}</p>
                      </div>
                    )}

                    {/* ELL Scaffolding */}
                    {section.scaffolding && (
                      <div className="grid grid-cols-3 gap-3">
                        {section.scaffolding.ell1 && (
                          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">ELL 1 — Support</span>
                            {section.scaffolding.ell1.sentenceStarters?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell1.sentenceStarters.map((s: string, j: number) => (
                                  <p key={j} className="text-xs text-blue-800 italic">{s}</p>
                                ))}
                              </div>
                            )}
                            {section.scaffolding.ell1.hints?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell1.hints.map((h: string, j: number) => (
                                  <p key={j} className="text-xs text-blue-700">💡 {h}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.scaffolding.ell2 && (
                          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">ELL 2 — Guided</span>
                            {section.scaffolding.ell2.sentenceStarters?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell2.sentenceStarters.map((s: string, j: number) => (
                                  <p key={j} className="text-xs text-amber-800 italic">{s}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {section.scaffolding.ell3 && (
                          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">ELL 3 — Extension</span>
                            {section.scaffolding.ell3.extensionPrompts?.length > 0 && (
                              <div className="mt-1.5 space-y-1">
                                {section.scaffolding.ell3.extensionPrompts.map((p: string, j: number) => (
                                  <p key={j} className="text-xs text-emerald-800">🚀 {p}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Reflection */}
            {lesson.reflection && (
              <div className="border border-gray-200 rounded-lg p-4 bg-indigo-50">
                <h5 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-2">
                  Reflection ({lesson.reflection.type || "short-response"})
                </h5>
                {lesson.reflection.items?.length > 0 && (
                  <div className="space-y-1.5">
                    {lesson.reflection.items.map((item: string, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-indigo-400 mt-0.5 text-sm">💭</span>
                        <span className="text-sm text-indigo-800">{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENT PREVIEW ── */}
        {activeTab === "student" && lesson && (
          <div className="max-w-2xl mx-auto">
            {/* Hero Header */}
            <div className="px-8 pt-8 pb-6 bg-gradient-to-br from-[#7B2FF2] to-[#5B1FD2]">
              <h2 className="text-2xl font-extrabold text-white mb-2">{lesson.title}</h2>
              <p className="text-sm text-purple-200">{lesson.learningGoal}</p>
            </div>

            <div className="px-8 py-6 space-y-6">
              {/* Vocab Warmup */}
              {lesson.vocabWarmup?.terms?.length > 0 && (
                <div className="border border-gray-200 rounded-2xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">📖 Vocabulary</p>
                  <div className="flex gap-2 flex-wrap">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {lesson.vocabWarmup.terms.map((t: any) => (
                      <span key={t.term} className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium border border-purple-100">
                        {t.term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Introduction */}
              {lesson.introduction?.text && (
                <p className="text-sm text-gray-700 leading-relaxed">{lesson.introduction.text}</p>
              )}

              {/* Sections */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {sections.map((section: any, i: number) => {
                const rtInfo = RESPONSE_TYPE_LABELS[section.responseType] || { label: section.responseType, icon: "📄" };
                return (
                  <div key={i}>
                    <div className="flex items-center justify-center my-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-[#7B2FF2]">
                        {i + 1}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                      <p className="text-base font-semibold text-gray-900 mb-2 whitespace-pre-wrap">{section.prompt}</p>
                      <div className="h-1 w-16 rounded-full mb-3 bg-[#7B2FF2]" />

                      {/* Scaffolding toggle hint */}
                      {section.scaffolding && (
                        <p className="text-xs text-purple-500 mb-3">💡 Scaffolding available (ELL 1/2/3)</p>
                      )}

                      {/* Response area */}
                      <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                        <p className="text-xs text-gray-400">{rtInfo.icon} {rtInfo.label}</p>
                        {section.durationMinutes && (
                          <p className="text-[10px] text-gray-300 mt-1">~{section.durationMinutes} minutes</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Reflection */}
              {lesson.reflection?.items?.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-3">💭 Reflection</p>
                  <div className="space-y-3">
                    {lesson.reflection.items.map((item: string, i: number) => (
                      <div key={i}>
                        <p className="text-sm text-indigo-800 mb-2">{item}</p>
                        <div className="border-2 border-dashed border-indigo-200 rounded-lg p-4 text-center">
                          <p className="text-xs text-indigo-300">Your reflection</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complete Button */}
              <div className="pt-4 pb-2">
                <button className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-lg bg-[#7B2FF2]" disabled>
                  Complete & Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── AI THINKING ── */}
        {activeTab === "thinking" && thinking && (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-amber-500 text-lg">💡</span>
              <span className="text-sm font-semibold text-gray-900">AI Reasoning Process</span>
              <span className="text-xs text-gray-400 ml-auto">
                {thinking.length > 1000 ? `${(thinking.length / 1000).toFixed(1)}k chars` : `${thinking.length} chars`}
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
              <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{thinking}</p>
            </div>
          </div>
        )}

        {/* ── RAW JSON ── */}
        {activeTab === "json" && (
          <pre className="p-4 text-xs text-gray-700 font-mono whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {/* Fallback */}
        {activeTab === "admin" && !lesson && (
          <div className="p-4">
            <p className="text-sm text-gray-500 mb-2">Could not parse lesson content. Showing raw output:</p>
            <pre className="bg-gray-50 text-gray-700 text-xs p-4 rounded-lg font-mono whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function TestSandbox({
  config,
}: {
  config: ResolvedModelConfig;
}) {
  const [testMode, setTestMode] = useState<TestMode>("skeleton");
  const [testInput, setTestInput] = useState<TestInput>({
    topic: "Sustainable Packaging Design",
    gradeLevel: "Year 3 (Grade 8)",
    endGoal: "Design and prototype a sustainable food container that reduces plastic waste",
    lessonCount: 4,
    lessonLengthMinutes: 50,
  });
  const [lessonType, setLessonType] = useState("research");
  const [framework, setFramework] = useState("IB_MYP");
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>(["A", "B", "C", "D"]);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result, setResult] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  const runTest = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    const start = Date.now();

    try {
      const diff = computeDiff(config);

      const sharedInput = {
        ...testInput,
        curriculumFramework: framework,
        assessmentCriteria: selectedCriteria,
      };

      if (testMode === "skeleton") {
        const res = await fetch("/api/admin/ai-model/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: diff, testInput: sharedInput }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Test failed");
        }
        const data = await res.json();
        setResult({ ...data, _mode: "skeleton" });
        setElapsed(data.elapsed || (Date.now() - start));
      } else {
        const res = await fetch("/api/admin/ai-model/test-lesson", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            config: diff,
            testInput: {
              ...sharedInput,
              lessonType,
            },
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Test failed");
        }
        const data = await res.json();
        setResult({ ...data, _mode: "lesson" });
        setElapsed(data.elapsed || (Date.now() - start));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t bg-white" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-alt/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span className="font-semibold text-gray-900">Test Sandbox</span>
          <span className="text-xs text-gray-500">Generate test content with current settings</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Mode Toggle */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
            <button
              onClick={() => setTestMode("skeleton")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                testMode === "skeleton"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Unit Skeleton
            </button>
            <button
              onClick={() => setTestMode("lesson")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                testMode === "lesson"
                  ? "bg-white text-purple-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Single Lesson
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Topic</label>
              <input
                type="text"
                value={testInput.topic}
                onChange={(e) => setTestInput({ ...testInput, topic: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Grade Level</label>
              <select
                value={testInput.gradeLevel}
                onChange={(e) => setTestInput({ ...testInput, gradeLevel: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">End Goal</label>
              <input
                type="text"
                value={testInput.endGoal}
                onChange={(e) => setTestInput({ ...testInput, endGoal: e.target.value })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Curriculum Framework</label>
              <select
                value={framework}
                onChange={(e) => {
                  const fw = e.target.value;
                  setFramework(fw);
                  const fwData = FRAMEWORKS.find(f => f.value === fw);
                  if (fwData) setSelectedCriteria([...fwData.criteria]);
                }}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {FRAMEWORKS.map((fw) => (
                  <option key={fw.value} value={fw.value}>{fw.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assessment Criteria</label>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {FRAMEWORKS.find(f => f.value === framework)?.criteria.map((c) => {
                  const isSelected = selectedCriteria.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          if (selectedCriteria.length > 1) {
                            setSelectedCriteria(selectedCriteria.filter(sc => sc !== c));
                          }
                        } else {
                          setSelectedCriteria([...selectedCriteria, c]);
                        }
                      }}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
                        isSelected
                          ? "bg-purple-100 text-purple-700 border-purple-300"
                          : "bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {testMode === "skeleton" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lessons</label>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={testInput.lessonCount}
                  onChange={(e) => setTestInput({ ...testInput, lessonCount: parseInt(e.target.value) || 4 })}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Lesson Type</label>
                <select
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  {LESSON_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{lt.icon} {lt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Lesson Length (min)</label>
              <input
                type="number"
                min={30}
                max={120}
                step={5}
                value={testInput.lessonLengthMinutes}
                onChange={(e) => setTestInput({ ...testInput, lessonLengthMinutes: parseInt(e.target.value) || 50 })}
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <button
            onClick={runTest}
            disabled={loading}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
                Generating{testMode === "lesson" ? " Full Lesson" : " Skeleton"}...
              </>
            ) : (
              <>{testMode === "skeleton" ? "Generate Unit Skeleton" : "Generate Full Lesson"}</>
            )}
          </button>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg">{error}</div>
          )}

          {result && (
            <TestResultsView result={result} elapsed={elapsed} />
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================================
// Main Page
// =========================================================================

export default function AIModelAdminPage() {
  const [config, dispatch] = useReducer(configReducer, DEFAULT_MODEL_CONFIG);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("generationEmphasis");
  const [viewMode, setViewMode] = useState<"macro" | "micro">("macro");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // Load config on mount
  useEffect(() => {
    fetch("/api/admin/ai-model")
      .then((res) => {
        if (res.status === 403) throw new Error("Not authorized");
        return res.json();
      })
      .then((data) => {
        if (data.resolved) {
          dispatch({ type: "SET_FULL", config: data.resolved });
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Track changes
  useEffect(() => {
    const diff = computeDiff(config);
    setHasChanges(Object.keys(diff).length > 0);
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const diff = computeDiff(config);
      const res = await fetch("/api/admin/ai-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: diff }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Save failed");
      }
      setSaveMsg("Saved successfully");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error === "Not authorized") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">You don&apos;t have permission to access the AI model configuration.</p>
        </div>
      </div>
    );
  }

  // Build all categories: timing is special, rest are normal
  const allCategories: { key: CategoryKey; label: string; icon: string }[] = [
    ...CATEGORY_META.map((c) => ({ key: c.key as CategoryKey, label: c.label, icon: c.icon })),
  ];
  // Insert timing after generationEmphasis
  allCategories.splice(1, 0, {
    key: "timingProfiles",
    label: TIMING_CATEGORY_META.label,
    icon: TIMING_CATEGORY_META.icon,
  });

  const activeMeta = CATEGORY_META.find((c) => c.key === activeCategory);

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>
      {/* Action bar */}
      <div
        className="px-6 py-3 flex items-center justify-between shrink-0 border-b"
        style={{ borderColor: "rgba(0,0,0,0.06)", background: "rgba(255,255,255,0.6)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-base font-bold text-gray-900">AI Model Configuration</h1>
          {/* Macro / Micro toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode("macro")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "macro"
                  ? "bg-white text-brand-purple shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Macro
            </button>
            <button
              onClick={() => setViewMode("micro")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "micro"
                  ? "bg-white text-brand-purple shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Micro
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className="text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-lg">{saveMsg}</span>
          )}
          {error && error !== "Not authorized" && (
            <span className="text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-lg">{error}</span>
          )}
          <button
            onClick={() => dispatch({ type: "RESET_ALL" })}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors font-medium"
          >
            Reset All
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="text-xs font-semibold text-white rounded-xl px-4 py-2 disabled:opacity-40 transition-all flex items-center gap-2"
            style={{ background: hasChanges ? "linear-gradient(135deg, #7B2FF2, #5C16C5)" : "#D1D5DB" }}
          >
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "No Changes"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ MACRO VIEW ═══ */}
        {viewMode === "macro" && (
          <div className="flex-1 overflow-y-auto bg-surface-alt">
            <div className="max-w-5xl mx-auto px-6 py-8">
              <AIControlPanel
                onMacroChange={(macro) => {
                  // Map macro values → micro sliders in real-time
                  const s = macro.teachingStyle / 100; // 0=teacher-led, 1=student-led
                  const t = macro.theoryPracticalBalance / 100; // 0=theory, 1=practical
                  const sc = macro.scaffoldingLevel / 100; // 0=max support, 1=minimal
                  const cr = macro.critiqueIntensity / 100; // 0=light, 1=heavy

                  // Generation emphasis dials
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "scaffoldingFade", value: Math.round(3 + s * 7) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "selfAssessment", value: Math.round(3 + s * 7) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "productiveFailure", value: Math.round(2 + s * 6) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "teacherNotes", value: Math.round(8 - s * 5) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "ellScaffolding", value: Math.round(8 - sc * 5) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "critiqueCulture", value: Math.round(2 + cr * 8) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "safetyCulture", value: Math.round(3 + t * 5) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "digitalPhysicalBalance", value: Math.round(2 + t * 6) });
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "portfolioCapture", value: Math.round(2 + cr * 4) });

                  // Quality weights
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "scaffolding_fade", value: Math.round(3 + sc * 7) });
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "critique_culture", value: Math.round(2 + cr * 8) });
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "digital_physical_balance", value: Math.round(2 + t * 6) });

                  // Relative emphasis
                  dispatch({ type: "SET_SLIDER", category: "relativeEmphasis", key: "teacherInput", value: Math.round(45 - s * 20) });
                  dispatch({ type: "SET_SLIDER", category: "relativeEmphasis", key: "pedagogicalIntelligence", value: Math.round(15 + s * 15) });
                }}
                onSave={async () => {
                  // Save via the existing API
                  await handleSave();
                }}
              />
            </div>

            {/* Test sandbox still available in macro mode */}
            <TestSandbox config={config} />
          </div>
        )}

        {/* ═══ MICRO VIEW ═══ */}
        {viewMode === "micro" && <>
        {/* Sidebar */}
        <nav className="w-56 bg-white border-r py-3 overflow-y-auto shrink-0" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          <div className="px-3 space-y-0.5">
            {allCategories.map((cat) => {
              const isActive = activeCategory === cat.key;
              return (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-all duration-150"
                  style={{
                    borderRadius: 10,
                    color: isActive ? "#7B2FF2" : "#6B7280",
                    background: isActive ? "rgba(123,47,242,0.08)" : "transparent",
                    fontWeight: isActive ? 600 : 400,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "rgba(0,0,0,0.03)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ opacity: isActive ? 1 : 0.5 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={cat.icon} />
                  </svg>
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Panel content */}
        <div className="flex-1 overflow-y-auto bg-surface-alt">
          <div className="max-w-3xl mx-auto p-6">
            {activeCategory === "timingProfiles" ? (
              <TimingPanel
                profiles={config.timingProfiles}
                onTimingChange={(year, field, value) =>
                  dispatch({ type: "SET_TIMING", year, field, value })
                }
                onReset={() => dispatch({ type: "RESET_CATEGORY", category: "timingProfiles" })}
              />
            ) : activeMeta ? (
              <CategoryPanel
                meta={activeMeta}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                values={config[activeMeta.key as keyof ResolvedModelConfig] as any}
                onSliderChange={(key, value) =>
                  dispatch({ type: "SET_SLIDER", category: activeMeta.key, key, value })
                }
                onReset={() => dispatch({ type: "RESET_CATEGORY", category: activeMeta.key })}
              />
            ) : null}
          </div>

          {/* Test sandbox flows in the same scroll area */}
          <TestSandbox config={config} />
        </div>
        </>}
      </div>
    </div>
  );
}
