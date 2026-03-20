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
  const [selectedCompetency, setSelectedCompetency] = useState(
    currentConfig?.competencies?.[0] ?? "agency_in_learning"
  );
  const [selectedElements, setSelectedElements] = useState<string[]>(
    currentConfig?.elements ?? []
  );
  const [checkpoints, setCheckpoints] = useState(
    currentConfig?.checkpoints ?? {}
  );
  const [checkpointElements, setCheckpointElements] = useState<
    Record<string, string[]>
  >(
    Object.entries(currentConfig?.checkpoints ?? {}).reduce(
      (acc, [pageId, config]) => {
        acc[pageId] = config.elements;
        return acc;
      },
      {} as Record<string, string[]>
    )
  );

  const competencyOptions = NM_COMPETENCIES;
  const availableElements = getElementsForCompetency(selectedCompetency);

  const handleToggleElement = (elementId: string) => {
    setSelectedElements((prev) =>
      prev.includes(elementId)
        ? prev.filter((id) => id !== elementId)
        : [...prev, elementId]
    );
  };

  const handleToggleCheckpoint = (pageId: string) => {
    if (checkpoints[pageId]) {
      const newCheckpoints = { ...checkpoints };
      delete newCheckpoints[pageId];
      setCheckpoints(newCheckpoints);
      const newElements = { ...checkpointElements };
      delete newElements[pageId];
      setCheckpointElements(newElements);
    } else {
      setCheckpoints({ ...checkpoints, [pageId]: { elements: selectedElements } });
      setCheckpointElements({
        ...checkpointElements,
        [pageId]: selectedElements,
      });
    }
  };

  const handleCheckpointElementToggle = (pageId: string, elementId: string) => {
    const current = checkpointElements[pageId] || [];
    const updated = current.includes(elementId)
      ? current.filter((id) => id !== elementId)
      : [...current, elementId];
    setCheckpointElements({ ...checkpointElements, [pageId]: updated });
    setCheckpoints({
      ...checkpoints,
      [pageId]: { elements: updated },
    });
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
      }, 1200);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

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
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 600,
              color: enabled ? "#4f46e5" : "#1f2937",
            }}
          >
            New Metrics
          </h3>
          {enabled && (
            <span
              style={{
                fontSize: "12px",
                background: "#4f46e5",
                color: "white",
                padding: "2px 8px",
                borderRadius: "999px",
              }}
            >
              Enabled
            </span>
          )}
        </div>

        {/* Toggle switch */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEnabled(!enabled);
            if (!enabled) setExpanded(true);
          }}
          style={{
            position: "relative",
            width: "44px",
            height: "24px",
            borderRadius: "999px",
            border: "none",
            background: enabled ? "#4f46e5" : "#d1d5db",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: enabled ? "22px" : "2px",
              width: "20px",
              height: "20px",
              borderRadius: "999px",
              background: "white",
              transition: "left 0.2s",
            }}
          />
        </button>
      </div>

      {/* Content */}
      {expanded && enabled && (
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
          {/* Competency selector */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "6px",
              }}
            >
              Competency
            </label>
            <select
              value={selectedCompetency}
              onChange={(e) => {
                setSelectedCompetency(e.target.value);
                setSelectedElements([]);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                fontSize: "14px",
                background: "white",
              }}
            >
              {competencyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p
              style={{
                fontSize: "12px",
                color: "#6b7280",
                margin: "6px 0 0 0",
              }}
            >
              {competencyOptions.find((c) => c.id === selectedCompetency)?.description}
            </p>
          </div>

          {/* Element picker */}
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "13px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "8px",
              }}
            >
              Assessment Elements
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "8px",
              }}
            >
              {availableElements.map((elem) => (
                <label
                  key={elem.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: selectedElements.includes(elem.id)
                      ? "1px solid #4f46e5"
                      : "1px solid #e5e7eb",
                    background: selectedElements.includes(elem.id)
                      ? "#f0f4ff"
                      : "white",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedElements.includes(elem.id)}
                    onChange={() => handleToggleElement(elem.id)}
                    style={{
                      marginTop: "2px",
                      cursor: "pointer",
                      width: "16px",
                      height: "16px",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: "#1f2937",
                      }}
                    >
                      {elem.name}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6b7280",
                        marginTop: "2px",
                      }}
                    >
                      {elem.studentDescription}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Checkpoint placer */}
          {selectedElements.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "8px",
                }}
              >
                Assessment Checkpoints
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                {pages.map((page) => {
                  const isCheckpoint = !!checkpoints[page.id];
                  return (
                    <div
                      key={page.id}
                      style={{
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        background: isCheckpoint ? "#f0f4ff" : "white",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "10px 12px",
                          borderBottom: isCheckpoint ? "1px solid #e5e7eb" : "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCheckpoint}
                          onChange={() => handleToggleCheckpoint(page.id)}
                          style={{
                            cursor: "pointer",
                            width: "16px",
                            height: "16px",
                          }}
                        />
                        <label
                          style={{
                            flex: 1,
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "#1f2937",
                            cursor: "pointer",
                          }}
                        >
                          {page.title}
                        </label>
                      </div>

                      {/* Sub-elements selector for this checkpoint */}
                      {isCheckpoint && (
                        <div style={{ padding: "8px 12px" }}>
                          {availableElements.map((elem) => (
                            <label
                              key={elem.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "6px 0",
                                fontSize: "12px",
                                cursor: "pointer",
                                color: "#6b7280",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={(checkpointElements[page.id] || []).includes(
                                  elem.id
                                )}
                                onChange={() =>
                                  handleCheckpointElementToggle(page.id, elem.id)
                                }
                                style={{
                                  cursor: "pointer",
                                  width: "14px",
                                  height: "14px",
                                }}
                              />
                              {elem.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Save button */}
          <div
            style={{
              marginTop: "16px",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
            }}
          >
            <button
              onClick={() => setExpanded(false)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #d1d5db",
                background: "white",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: saveStatus === "saved" ? "#059669" : saveStatus === "error" ? "#dc2626" : "#4f46e5",
                color: "white",
                fontSize: "13px",
                fontWeight: 600,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
                transition: "background 0.2s",
              }}
            >
              {saving ? "Saving..." : saveStatus === "saved" ? "Saved!" : saveStatus === "error" ? "Failed — try again" : "Save Configuration"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
