"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminSettingKey } from "@/types/admin";
import type { AdminSettings } from "@/lib/admin/settings";
import { ADMIN_SETTINGS_DEFAULTS } from "@/lib/admin/settings";

const STAGE_KEYS = ["retrieve", "assemble", "gap_fill", "polish", "timing", "score"] as const;
const STAGE_LABELS: Record<string, string> = {
  retrieve: "1 — Retrieve",
  assemble: "2 — Assemble",
  gap_fill: "3 — Gap-Fill",
  polish: "4 — Polish",
  timing: "5 — Timing",
  score: "6 — Score",
};

type SaveStatus = Record<string, "idle" | "saving" | "saved" | "error">;

export default function PipelineControlsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({});

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setSettings(data.settings))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const patchSetting = useCallback(
    async (key: string, value: unknown) => {
      setSaveStatus((prev) => ({ ...prev, [key]: "saving" }));
      try {
        const res = await fetch("/api/admin/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        setSaveStatus((prev) => ({ ...prev, [key]: "saved" }));
        setTimeout(() => setSaveStatus((prev) => ({ ...prev, [key]: "idle" })), 2000);
      } catch (err) {
        setSaveStatus((prev) => ({ ...prev, [key]: "error" }));
        console.error(`[controls] Failed to save ${key}:`, err);
      }
    },
    []
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-gray-400 text-sm text-center py-12">Loading pipeline settings...</div>
      </div>
    );
  }

  if (error || !settings) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Settings backend not available.</strong> {error || "No data returned."}
          <br />
          <span className="text-red-500 text-xs mt-1 block">
            Ensure migration 077 (admin_settings) is applied. See docs/migrations-applied.md.
          </span>
        </div>
      </div>
    );
  }

  const stageEnabled = settings[AdminSettingKey.STAGE_ENABLED] as Record<string, boolean>;
  const costPerRun = settings[AdminSettingKey.COST_CEILING_PER_RUN] as number;
  const costPerDay = settings[AdminSettingKey.COST_CEILING_PER_DAY] as number;
  const modelOverride = settings[AdminSettingKey.MODEL_OVERRIDE] as Record<string, string | null>;
  const starterPatterns = settings[AdminSettingKey.STARTER_PATTERNS_ENABLED] as boolean;

  function statusBadge(key: string) {
    const s = saveStatus[key];
    if (s === "saving") return <span className="text-xs text-amber-600 ml-2">Saving...</span>;
    if (s === "saved") return <span className="text-xs text-green-600 ml-2">Saved</span>;
    if (s === "error") return <span className="text-xs text-red-600 ml-2">Error</span>;
    return null;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">
      <h2 className="text-lg font-bold text-gray-900">Pipeline Controls</h2>

      {/* Stage Toggles */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Stage Enabled
          {statusBadge(AdminSettingKey.STAGE_ENABLED)}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STAGE_KEYS.map((stage) => (
            <label
              key={stage}
              className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-3 shadow-sm cursor-pointer hover:border-purple-200 transition-colors"
            >
              <input
                type="checkbox"
                checked={stageEnabled[stage] ?? true}
                onChange={(e) => {
                  const updated = { ...stageEnabled, [stage]: e.target.checked };
                  setSettings({ ...settings, [AdminSettingKey.STAGE_ENABLED]: updated });
                  patchSetting(AdminSettingKey.STAGE_ENABLED, updated);
                }}
                className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="text-sm font-medium text-gray-900">{STAGE_LABELS[stage]}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Cost Ceilings */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Cost Ceilings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Per Run (USD)
              {statusBadge(AdminSettingKey.COST_CEILING_PER_RUN)}
            </label>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={costPerRun}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setSettings({ ...settings, [AdminSettingKey.COST_CEILING_PER_RUN]: v });
              }}
              onBlur={(e) => {
                const v = Math.min(50, Math.max(0, parseFloat(e.target.value) || 0));
                setSettings({ ...settings, [AdminSettingKey.COST_CEILING_PER_RUN]: v });
                patchSetting(AdminSettingKey.COST_CEILING_PER_RUN, v);
              }}
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
          </div>
          <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Per Day (USD)
              {statusBadge(AdminSettingKey.COST_CEILING_PER_DAY)}
            </label>
            <input
              type="number"
              min={0}
              max={1000}
              step={5}
              value={costPerDay}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setSettings({ ...settings, [AdminSettingKey.COST_CEILING_PER_DAY]: v });
              }}
              onBlur={(e) => {
                const v = Math.min(1000, Math.max(0, parseFloat(e.target.value) || 0));
                setSettings({ ...settings, [AdminSettingKey.COST_CEILING_PER_DAY]: v });
                patchSetting(AdminSettingKey.COST_CEILING_PER_DAY, v);
              }}
              className="w-full text-sm border rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </section>

      {/* Model Override */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Model Override (per stage)
          {statusBadge(AdminSettingKey.MODEL_OVERRIDE)}
        </h3>
        <div className="bg-white border border-gray-100 rounded-lg p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-3">
            Set a model ID per stage to override the default. Empty = use default. JSON format:
            <code className="ml-1 bg-gray-100 px-1 rounded">{`{ "stage_1": "claude-sonnet-4-6" }`}</code>
          </p>
          <textarea
            value={JSON.stringify(modelOverride, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                setSettings({ ...settings, [AdminSettingKey.MODEL_OVERRIDE]: parsed });
              } catch {
                // Invalid JSON — don't update state
              }
            }}
            onBlur={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                patchSetting(AdminSettingKey.MODEL_OVERRIDE, parsed);
              } catch {
                // Invalid JSON — don't save
              }
            }}
            rows={4}
            className="w-full text-xs font-mono border rounded-lg px-3 py-2"
          />
        </div>
      </section>

      {/* Starter Patterns */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Starter Patterns
          {statusBadge(AdminSettingKey.STARTER_PATTERNS_ENABLED)}
        </h3>
        <label className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-4 shadow-sm cursor-pointer hover:border-purple-200 transition-colors">
          <input
            type="checkbox"
            checked={starterPatterns}
            onChange={(e) => {
              setSettings({ ...settings, [AdminSettingKey.STARTER_PATTERNS_ENABLED]: e.target.checked });
              patchSetting(AdminSettingKey.STARTER_PATTERNS_ENABLED, e.target.checked);
            }}
            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <div>
            <span className="text-sm font-medium text-gray-900">Enable starter patterns in retrieval</span>
            <p className="text-xs text-gray-500 mt-0.5">When enabled, Stage 1 includes starter pattern blocks for new units.</p>
          </div>
        </label>
      </section>
    </div>
  );
}
