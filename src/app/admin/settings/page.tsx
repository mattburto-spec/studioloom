"use client";

import { HARD_GUARDRAILS, DEFAULT_GUARDRAIL_CONFIG } from "@/lib/feedback/types";

const MODEL_TIERS = [
  { tier: "Tier 1 — Ingestion / Classification", model: "claude-haiku-4-5-20251001", desc: "Fast classification, PII scanning" },
  { tier: "Tier 2 — Analysis / Enrichment", model: "claude-sonnet-4-20250514", desc: "Pedagogical analysis, block enrichment" },
  { tier: "Tier 3 — Generation / Reconstruction", model: "claude-sonnet-4-20250514", desc: "Unit generation, lesson assembly" },
];

export default function SettingsPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-8">
      <h2 className="text-lg font-bold text-gray-900">Settings</h2>

      {/* Model Selection */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Model Selection per Tier</h3>
        <div className="grid gap-3">
          {MODEL_TIERS.map(({ tier, model, desc }) => (
            <div key={tier} className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">{tier}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                </div>
                <code className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono">{model}</code>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Hard Guardrails (read-only) */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Hard Guardrails</h3>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-500">Efficacy Range:</span>
              <span className="ml-2 font-medium">[{HARD_GUARDRAILS.minEfficacy}, {HARD_GUARDRAILS.maxEfficacy}]</span>
            </div>
            <div>
              <span className="text-gray-500">Max Metadata Change:</span>
              <span className="ml-2 font-medium">{HARD_GUARDRAILS.maxMetadataChangePercent}% per cycle</span>
            </div>
            <div>
              <span className="text-gray-500">Time Weight Steps:</span>
              <span className="ml-2 font-medium">{HARD_GUARDRAILS.timeWeightSteps.join(" → ")}</span>
            </div>
            <div>
              <span className="text-gray-500">Always Manual:</span>
              <span className="ml-2 font-medium">{HARD_GUARDRAILS.alwaysManualFields.join(", ")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-Approve Config (read-only) */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Auto-Approve Configuration</h3>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm space-y-2 text-sm">
          <div>
            <span className="text-gray-500">Enabled:</span>
            <span className={`ml-2 font-medium ${DEFAULT_GUARDRAIL_CONFIG.autoApproveEnabled ? "text-emerald-600" : "text-red-600"}`}>
              {DEFAULT_GUARDRAIL_CONFIG.autoApproveEnabled ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Min Evidence for Auto-Approve:</span>
            <span className="ml-2 font-medium">{DEFAULT_GUARDRAIL_CONFIG.minEvidenceForAutoApprove}</span>
          </div>
          <div>
            <span className="text-gray-500">Max Score Change:</span>
            <span className="ml-2 font-medium">±{DEFAULT_GUARDRAIL_CONFIG.maxScoreChangeForAutoApprove}</span>
          </div>
        </div>
      </section>

      {/* Feature Flags Placeholder */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Feature Flags</h3>
        <div className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm text-sm text-gray-400 text-center">
          Feature flags coming soon
        </div>
      </section>
    </div>
  );
}
