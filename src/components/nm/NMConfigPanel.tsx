"use client";

import { useState } from "react";
import {
  NM_COMPETENCIES,
  AGENCY_ELEMENTS,
  NMUnitConfig,
  getElementsForCompetency,
} from "@/lib/nm/constants";

interface NMConfigPanelProps {
  unitId: string;
  pages: Array<{ id: string; title: string }>;
  currentConfig: NMUnitConfig | null;
  onSave: (config: NMUnitConfig) => void;
}

type Step = "competency" | "elements" | "checkpoints";

const STEPS: { key: Step; label: string; num: number }[] = [
  { key: "competency", label: "Competency", num: 1 },
  { key: "elements", label: "Elements", num: 2 },
  { key: "checkpoints", label: "Checkpoints", num: 3 },
];

export function NMConfigPanel({
  unitId,
  pages,
  currentConfig,
  onSave,
}: NMConfigPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(currentConfig?.enabled ?? false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [step, setStep] = useState<Step>("competency");

  const [selectedCompetency, setSelectedCompetency] = useState(
    currentConfig?.competencies?.[0] ?? "agency_in_learning"
  );
  const [selectedElements, setSelectedElements] = useState<string[]>(
    currentConfig?.elements ?? []
  );
  const [checkpoints, setCheckpoints] = useState(
    currentConfig?.checkpoints ?? {}
  );
  const [checkpointElements, setCheckpointElements] = useState<Record<string, string[]>>(
    Object.entries(currentConfig?.checkpoints ?? {}).reduce(
      (acc, [pageId, config]) => {
        acc[pageId] = config.elements;
        return acc;
      },
      {} as Record<string, string[]>
    )
  );

  const availableElements = getElementsForCompetency(selectedCompetency);

  const handleToggleElement = (elementId: string) => {
    setSelectedElements((prev) =>
      prev.includes(elementId) ? prev.filter((id) => id !== elementId) : [...prev, elementId]
    );
  };

  const handleToggleCheckpoint = (pageId: string) => {
    if (checkpoints[pageId]) {
      const c = { ...checkpoints };
      delete c[pageId];
      setCheckpoints(c);
      const e = { ...checkpointElements };
      delete e[pageId];
      setCheckpointElements(e);
    } else {
      setCheckpoints({ ...checkpoints, [pageId]: { elements: selectedElements } });
      setCheckpointElements({ ...checkpointElements, [pageId]: selectedElements });
    }
  };

  const handleCheckpointElementToggle = (pageId: string, elementId: string) => {
    const current = checkpointElements[pageId] || [];
    const updated = current.includes(elementId)
      ? current.filter((id) => id !== elementId)
      : [...current, elementId];
    setCheckpointElements({ ...checkpointElements, [pageId]: updated });
    setCheckpoints({ ...checkpoints, [pageId]: { elements: updated } });
  };

  const handleSave = async () => {
    const config: NMUnitConfig = {
      enabled,
      competencies: enabled ? [selectedCompetency] : [],
      elements: enabled ? selectedElements : [],
      checkpoints: enabled ? checkpoints : {},
    };
    setSaving(true);
    setSaveStatus("idle");
    try {
      await onSave(config);
      setSaveStatus("saved");
      setTimeout(() => {
        setExpanded(false);
        setSaveStatus("idle");
        setStep("competency");
      }, 1200);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const canAdvanceFromElements = selectedElements.length > 0;
  const checkpointCount = Object.keys(checkpoints).length;

  const currentStepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div
      style={{
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        marginBottom: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          cursor: "pointer",
          background: enabled ? "#f0f4ff" : "#f9fafb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: enabled ? "#4f46e5" : "#1f2937" }}>
            New Metrics
          </h3>
          {enabled && (
            <span style={{ fontSize: "12px", background: "#4f46e5", color: "white", padding: "2px 8px", borderRadius: "999px" }}>
              Enabled
            </span>
          )}
          {enabled && selectedElements.length > 0 && (
            <span style={{ fontSize: "11px", color: "#6b7280" }}>
              {selectedElements.length} elements · {checkpointCount} checkpoint{checkpointCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEnabled(!enabled);
            if (!enabled) { setExpanded(true); setStep("competency"); }
          }}
          style={{
            position: "relative", width: "44px", height: "24px", borderRadius: "999px",
            border: "none", background: enabled ? "#4f46e5" : "#d1d5db", cursor: "pointer", padding: 0,
          }}
        >
          <div style={{
            position: "absolute", top: "2px", left: enabled ? "22px" : "2px",
            width: "20px", height: "20px", borderRadius: "999px", background: "white", transition: "left 0.2s",
          }} />
        </button>
      </div>

      {/* Wizard content */}
      {expanded && enabled && (
        <div style={{ borderTop: "1px solid #e5e7eb" }}>
          {/* Step indicator */}
          <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: "4px", background: "#fafbfc" }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <button
                  onClick={() => {
                    if (s.key === "elements" && step === "competency") return;
                    if (s.key === "checkpoints" && selectedElements.length === 0) return;
                    setStep(s.key);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px",
                    borderRadius: "999px", border: "none", cursor: "pointer",
                    background: step === s.key ? "#4f46e5" : i < currentStepIndex ? "#e0e7ff" : "#f3f4f6",
                    color: step === s.key ? "white" : i < currentStepIndex ? "#4f46e5" : "#9ca3af",
                    fontSize: "12px", fontWeight: step === s.key ? 600 : 500,
                    transition: "all 0.2s",
                  }}
                >
                  <span style={{
                    width: "18px", height: "18px", borderRadius: "999px", display: "flex",
                    alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700,
                    background: step === s.key ? "rgba(255,255,255,0.25)" : "transparent",
                  }}>
                    {i < currentStepIndex ? "✓" : s.num}
                  </span>
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div style={{ width: "16px", height: "1px", background: i < currentStepIndex ? "#a5b4fc" : "#e5e7eb" }} />
                )}
              </div>
            ))}
          </div>

          <div style={{ padding: "16px" }}>
            {/* STEP 1: Competency */}
            {step === "competency" && (
              <div>
                <p style={{ fontSize: "13px", color: "#6b7280", marginTop: 0, marginBottom: "12px" }}>
                  Which competency will students reflect on during this unit?
                </p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {NM_COMPETENCIES.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCompetency(c.id);
                        setSelectedElements([]);
                      }}
                      style={{
                        textAlign: "left", padding: "12px 14px", borderRadius: "10px",
                        border: selectedCompetency === c.id ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                        background: selectedCompetency === c.id ? "#f0f4ff" : "white",
                        cursor: "pointer", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: "14px", fontWeight: 600, color: selectedCompetency === c.id ? "#4f46e5" : "#1f2937", marginBottom: "2px" }}>
                        {c.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>{c.description}</div>
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setStep("elements")}
                    style={{
                      padding: "8px 20px", borderRadius: "8px", border: "none",
                      background: "#4f46e5", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Next: Pick Elements →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Elements */}
            {step === "elements" && (
              <div>
                <p style={{ fontSize: "13px", color: "#6b7280", marginTop: 0, marginBottom: "12px" }}>
                  Which elements should students reflect on? Pick 2-4 for best results.
                </p>
                <div style={{ display: "grid", gap: "8px" }}>
                  {availableElements.map((elem) => {
                    const selected = selectedElements.includes(elem.id);
                    return (
                      <button
                        key={elem.id}
                        onClick={() => handleToggleElement(elem.id)}
                        style={{
                          textAlign: "left", display: "flex", alignItems: "flex-start", gap: "10px",
                          padding: "10px 12px", borderRadius: "10px",
                          border: selected ? "2px solid #4f46e5" : "1px solid #e5e7eb",
                          background: selected ? "#f0f4ff" : "white",
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        <div style={{
                          flexShrink: 0, width: "20px", height: "20px", borderRadius: "4px",
                          border: selected ? "none" : "2px solid #d1d5db",
                          background: selected ? "#4f46e5" : "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "white", fontSize: "12px", marginTop: "1px",
                        }}>
                          {selected && "✓"}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: "13px", fontWeight: 500, color: "#1f2937" }}>{elem.name}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{elem.studentDescription}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedElements.length > 0 && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#4f46e5", fontWeight: 500 }}>
                    {selectedElements.length} selected
                  </div>
                )}
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
                  <button
                    onClick={() => setStep("competency")}
                    style={{
                      padding: "8px 16px", borderRadius: "8px",
                      border: "1px solid #d1d5db", background: "white",
                      fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep("checkpoints")}
                    disabled={!canAdvanceFromElements}
                    style={{
                      padding: "8px 20px", borderRadius: "8px", border: "none",
                      background: canAdvanceFromElements ? "#4f46e5" : "#d1d5db",
                      color: "white", fontSize: "13px", fontWeight: 600,
                      cursor: canAdvanceFromElements ? "pointer" : "not-allowed",
                    }}
                  >
                    Next: Place Checkpoints →
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Checkpoints */}
            {step === "checkpoints" && (
              <div>
                <p style={{ fontSize: "13px", color: "#6b7280", marginTop: 0, marginBottom: "12px" }}>
                  Which lessons should include a student reflection checkpoint? We recommend 1-3 across the unit.
                </p>
                <div style={{ display: "grid", gap: "6px" }}>
                  {pages.map((page) => {
                    const isCP = !!checkpoints[page.id];
                    return (
                      <div key={page.id} style={{ borderRadius: "10px", border: "1px solid #e5e7eb", background: isCP ? "#f0f4ff" : "white", overflow: "hidden" }}>
                        <button
                          onClick={() => handleToggleCheckpoint(page.id)}
                          style={{
                            width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: "10px",
                            padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer",
                          }}
                        >
                          <div style={{
                            flexShrink: 0, width: "20px", height: "20px", borderRadius: "4px",
                            border: isCP ? "none" : "2px solid #d1d5db",
                            background: isCP ? "#4f46e5" : "white",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "white", fontSize: "12px",
                          }}>
                            {isCP && "✓"}
                          </div>
                          <span style={{ fontSize: "13px", fontWeight: 500, color: "#1f2937" }}>{page.title}</span>
                        </button>
                        {/* Per-checkpoint element toggle */}
                        {isCP && (
                          <div style={{ padding: "6px 12px 10px 42px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {availableElements.filter(e => selectedElements.includes(e.id)).map((elem) => {
                              const active = (checkpointElements[page.id] || []).includes(elem.id);
                              return (
                                <button
                                  key={elem.id}
                                  onClick={() => handleCheckpointElementToggle(page.id, elem.id)}
                                  style={{
                                    padding: "3px 10px", borderRadius: "999px", fontSize: "11px", fontWeight: 500,
                                    border: active ? "1px solid #4f46e5" : "1px solid #d1d5db",
                                    background: active ? "#e0e7ff" : "white",
                                    color: active ? "#4338ca" : "#6b7280",
                                    cursor: "pointer", transition: "all 0.15s",
                                  }}
                                >
                                  {elem.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {checkpointCount > 0 && (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#4f46e5", fontWeight: 500 }}>
                    {checkpointCount} checkpoint{checkpointCount !== 1 ? "s" : ""} placed
                  </div>
                )}
                <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
                  <button
                    onClick={() => setStep("elements")}
                    style={{
                      padding: "8px 16px", borderRadius: "8px",
                      border: "1px solid #d1d5db", background: "white",
                      fontSize: "13px", fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                      padding: "8px 24px", borderRadius: "8px", border: "none",
                      background: saveStatus === "saved" ? "#059669" : saveStatus === "error" ? "#dc2626" : "#4f46e5",
                      color: "white", fontSize: "13px", fontWeight: 600,
                      cursor: saving ? "wait" : "pointer",
                      opacity: saving ? 0.7 : 1, transition: "background 0.2s",
                    }}
                  >
                    {saving ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Failed — retry" : "Save Configuration"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
