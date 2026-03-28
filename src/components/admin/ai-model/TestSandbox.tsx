"use client";

import { useState } from "react";
import type { TestInput } from "./config-helpers";
import { TestResultsView } from "./TestResultsView";

// =========================================================================
// Constants
// =========================================================================

type UnitType = "design" | "service" | "personal_project" | "inquiry";

const UNIT_TYPE_OPTIONS: { value: UnitType; label: string; icon: string; color: string }[] = [
  { value: "design", label: "Design", icon: "🛠", color: "#6366F1" },
  { value: "service", label: "Service", icon: "🤝", color: "#3B82F6" },
  { value: "personal_project", label: "Personal Project", icon: "🎯", color: "#8B5CF6" },
  { value: "inquiry", label: "Inquiry", icon: "🔎", color: "#10B981" },
];

/** Quick-fill presets for testing each unit type. Framework/criteria update dynamically — these are just defaults. */
const UNIT_TYPE_PRESETS: Record<UnitType, { topic: string; endGoal: string }> = {
  design: {
    topic: "Sustainable Packaging Design",
    endGoal: "Design and prototype a sustainable food container that reduces plastic waste",
  },
  service: {
    topic: "School Garden Community Project",
    endGoal: "Investigate food waste in the school community and take sustainable action through a school garden initiative",
  },
  personal_project: {
    topic: "Photography Portfolio",
    endGoal: "Create a curated photography portfolio exploring a personal theme, documenting the creative process and ATL skill development",
  },
  inquiry: {
    topic: "Water: A Shared Resource",
    endGoal: "Investigate how access to clean water varies globally and create an awareness campaign for the school community",
  },
};

export const FRAMEWORKS = [
  { value: "IB_MYP", label: "IB MYP Design", criteria: ["A", "B", "C", "D"] },
  { value: "IB_MYP_SERVICE", label: "IB MYP Community Project", criteria: ["A", "B", "C", "D"] },
  { value: "IB_CAS", label: "IB DP CAS", criteria: ["LO1", "LO2", "LO3", "LO4", "LO5", "LO6", "LO7"] },
  { value: "GCSE_DT", label: "GCSE Design & Technology", criteria: ["AO1", "AO2", "AO3", "AO4"] },
  { value: "A_LEVEL_DT", label: "A-Level Design & Technology", criteria: ["C1", "C2", "C3"] },
  { value: "IGCSE_DT", label: "Cambridge IGCSE DT", criteria: ["AO1", "AO2", "AO3"] },
  { value: "ACARA_DT", label: "Australian Curriculum DT", criteria: ["KU", "PPS"] },
  { value: "NESA_DT", label: "NSW Design & Technology (NESA)", criteria: ["DP", "Pr", "Ev"] },
  { value: "VIC_DT", label: "Victorian Curriculum DT", criteria: ["TS", "TC", "CDS"] },
  { value: "PLTW", label: "Project Lead The Way (US)", criteria: ["Design", "Build", "Test", "Present"] },
];

export const LESSON_TYPES = [
  { value: "research", label: "Research", icon: "🔍" },
  { value: "ideation", label: "Ideation", icon: "💡" },
  { value: "skills-demo", label: "Skills Demo", icon: "🛠" },
  { value: "making", label: "Making", icon: "🏗" },
  { value: "testing", label: "Testing", icon: "🧪" },
  { value: "critique", label: "Critique", icon: "📋" },
  { value: "community-action", label: "Community Action", icon: "🤝" },
  { value: "reflection", label: "Reflection", icon: "🪞" },
  { value: "investigation", label: "Investigation", icon: "🔬" },
  { value: "presentation", label: "Presentation", icon: "📊" },
];

const GRADE_OPTIONS = [
  "Year 1 (Grade 6)",
  "Year 2 (Grade 7)",
  "Year 3 (Grade 8)",
  "Year 4 (Grade 9)",
  "Year 5 (Grade 10)",
];

type TestMode = "skeleton" | "lesson";

// =========================================================================
// TestSandbox Component
// =========================================================================

export function TestSandbox() {
  const [testMode, setTestMode] = useState<TestMode>("skeleton");
  const [unitType, setUnitType] = useState<UnitType>("design");
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

  /** Apply a unit type preset — fills in topic and endGoal. Framework/criteria stay as currently selected. */
  const applyPreset = (type: UnitType) => {
    setUnitType(type);
    const preset = UNIT_TYPE_PRESETS[type];
    setTestInput({
      ...testInput,
      topic: preset.topic,
      endGoal: preset.endGoal,
    });
  };
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
      const sharedInput = {
        ...testInput,
        curriculumFramework: framework,
        assessmentCriteria: selectedCriteria,
      };

      if (testMode === "skeleton") {
        const res = await fetch("/api/admin/ai-model/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: {}, testInput: sharedInput }),
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
            config: {},
            testInput: {
              ...sharedInput,
              lessonType,
              unitType,
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
          <span className="text-xs text-gray-500">Test AI generation output for any unit type</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-6 pb-6">
          {/* Unit Type Selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-2">Unit Type</label>
            <div className="flex gap-2">
              {UNIT_TYPE_OPTIONS.map((ut) => (
                <button
                  key={ut.value}
                  onClick={() => applyPreset(ut.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
                    unitType === ut.value
                      ? "border-current shadow-sm"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                  style={unitType === ut.value ? { color: ut.color, borderColor: ut.color, backgroundColor: ut.color + "10" } : {}}
                >
                  <span>{ut.icon}</span>
                  <span>{ut.label}</span>
                </button>
              ))}
            </div>
          </div>

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
                Generating {UNIT_TYPE_OPTIONS.find(u => u.value === unitType)?.label} {testMode === "lesson" ? "Lesson" : "Skeleton"}...
              </>
            ) : (
              <>Generate {UNIT_TYPE_OPTIONS.find(u => u.value === unitType)?.label} {testMode === "skeleton" ? "Skeleton" : "Lesson"}</>
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
