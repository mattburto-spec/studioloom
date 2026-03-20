"use client";

import { useState, useEffect, useReducer } from "react";
import type { ResolvedModelConfig } from "@/types/ai-model-config";
import { CATEGORY_META, TIMING_CATEGORY_META, DEFAULT_MODEL_CONFIG } from "@/lib/ai/model-config-defaults";
import { AIControlPanel } from "@/components/admin/AIControlPanel";
import {
  configReducer,
  computeDiff,
  type CategoryKey,
  type Action,
} from "@/components/admin/ai-model/config-helpers";
import { CategoryPanel } from "@/components/admin/ai-model/CategoryPanel";
import { TimingPanel } from "@/components/admin/ai-model/TimingPanel";
import { TestSandbox } from "@/components/admin/ai-model/TestSandbox";

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
            onClick={() => dispatch({ type: "RESET_ALL" } as Action)}
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
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "scaffoldingFade", value: Math.round(3 + s * 7) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "selfAssessment", value: Math.round(3 + s * 7) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "productiveFailure", value: Math.round(2 + s * 6) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "teacherNotes", value: Math.round(8 - s * 5) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "ellScaffolding", value: Math.round(8 - sc * 5) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "critiqueCulture", value: Math.round(2 + cr * 8) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "safetyCulture", value: Math.round(3 + t * 5) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "digitalPhysicalBalance", value: Math.round(2 + t * 6) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "generationEmphasis", key: "portfolioCapture", value: Math.round(2 + cr * 4) } as Action);

                  // Quality weights
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "scaffolding_fade", value: Math.round(3 + sc * 7) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "critique_culture", value: Math.round(2 + cr * 8) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "qualityWeights", key: "digital_physical_balance", value: Math.round(2 + t * 6) } as Action);

                  // Relative emphasis
                  dispatch({ type: "SET_SLIDER", category: "relativeEmphasis", key: "teacherInput", value: Math.round(45 - s * 20) } as Action);
                  dispatch({ type: "SET_SLIDER", category: "relativeEmphasis", key: "pedagogicalIntelligence", value: Math.round(15 + s * 15) } as Action);
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
                  dispatch({ type: "SET_TIMING", year, field, value } as Action)
                }
                onReset={() => dispatch({ type: "RESET_CATEGORY", category: "timingProfiles" } as Action)}
              />
            ) : activeMeta ? (
              <CategoryPanel
                meta={activeMeta}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                values={config[activeMeta.key as keyof ResolvedModelConfig] as any}
                onSliderChange={(key, value) =>
                  dispatch({ type: "SET_SLIDER", category: activeMeta.key, key, value } as Action)
                }
                onReset={() => dispatch({ type: "RESET_CATEGORY", category: activeMeta.key } as Action)}
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
