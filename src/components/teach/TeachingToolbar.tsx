"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ClassClock from "./ClassClock";
import QuickTimer from "./QuickTimer";
import RandomPicker from "./RandomPicker";
import GroupMaker from "./GroupMaker";
import Stopwatch from "./Stopwatch";
import NoiseMeter from "./NoiseMeter";
import QuickEdit from "./QuickEdit";
import OnTheFlyPanel from "./OnTheFlyPanel";

// ─────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────

interface TeachingToolbarProps {
  periodEndTime?: string;
  currentPhase?: string;
  phaseTimeRemaining?: number;
  unitId: string;
  pageId: string;
  lessonContent?: any;
  classId: string;
  studentCount: number;
  students?: Array<{ id: string; name: string }>;
  onProjectToScreen?: (data: any) => void;
  onPhaseSkip?: () => void;
  onLessonEdited?: () => void;
}

type ToolPanel =
  | null
  | "edit"
  | "activity"
  | "timer"
  | "picker"
  | "groups"
  | "stopwatch"
  | "noise"
  | "project";

// ─────────────────────────────────────────────────────
// Colors
// ─────────────────────────────────────────────────────

const C = {
  bg: "rgba(13, 13, 23, 0.94)",
  surface: "rgba(22, 22, 38, 0.98)",
  border: "rgba(255, 255, 255, 0.07)",
  borderHover: "rgba(124, 58, 237, 0.4)",
  accent: "#7C3AED",
  accentDim: "rgba(124, 58, 237, 0.15)",
  text: "#E5E7EB",
  textDim: "#6B7280",
  white: "#FFFFFF",
};

// ─────────────────────────────────────────────────────
// Phase colors
// ─────────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  opening: "#7C3AED",
  "Opening": "#7C3AED",
  miniLesson: "#2563EB",
  "Mini-Lesson": "#2563EB",
  "Mini Lesson": "#2563EB",
  workTime: "#16A34A",
  "Work Time": "#16A34A",
  debrief: "#D97706",
  "Debrief": "#D97706",
};

// ─────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────

export default function TeachingToolbar({
  periodEndTime,
  currentPhase = "Work Time",
  phaseTimeRemaining = 0,
  unitId,
  pageId,
  lessonContent,
  classId,
  studentCount = 0,
  students = [],
  onProjectToScreen,
  onPhaseSkip,
  onLessonEdited,
}: TeachingToolbarProps) {
  const [activePanel, setActivePanel] = useState<ToolPanel>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        toolbarRef.current &&
        !toolbarRef.current.contains(t) &&
        panelRef.current &&
        !panelRef.current.contains(t)
      ) {
        setActivePanel(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = useCallback(
    (panel: ToolPanel) => setActivePanel((prev) => (prev === panel ? null : panel)),
    []
  );

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const phaseColor = PHASE_COLORS[currentPhase] || C.accent;

  // ─── Toolbar Button ────────────────────────────────

  const Btn = ({
    icon,
    label,
    panel,
    badge,
  }: {
    icon: React.ReactNode;
    label: string;
    panel: ToolPanel;
    badge?: string;
  }) => {
    const isActive = activePanel === panel;
    return (
      <button
        onClick={() => toggle(panel)}
        title={label}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2px",
          padding: "6px 10px",
          borderRadius: "10px",
          background: isActive ? C.accentDim : "transparent",
          border: `1.5px solid ${isActive ? C.accent : "transparent"}`,
          color: isActive ? C.white : C.text,
          cursor: "pointer",
          transition: "all 0.15s ease",
          fontSize: "18px",
          minWidth: "48px",
        }}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!isActive) e.currentTarget.style.background = "transparent";
        }}
      >
        <span>{icon}</span>
        <span style={{ fontSize: "9px", fontWeight: 600, letterSpacing: "0.02em", opacity: 0.7 }}>
          {label}
        </span>
        {badge && (
          <span
            style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              background: "#EF4444",
              color: "#fff",
              fontSize: "8px",
              fontWeight: 800,
              padding: "1px 4px",
              borderRadius: "6px",
              lineHeight: 1.2,
            }}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  // ─── Classroom Tools Sub-Menu ──────────────────────

  const ToolsMenu = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
      {[
        { icon: "⏱", label: "Timer", panel: "timer" as ToolPanel },
        { icon: "🎯", label: "Picker", panel: "picker" as ToolPanel },
        { icon: "👥", label: "Groups", panel: "groups" as ToolPanel },
        { icon: "⏱️", label: "Stopwatch", panel: "stopwatch" as ToolPanel },
        { icon: "🔊", label: "Noise", panel: "noise" as ToolPanel },
      ].map((t) => (
        <button
          key={t.label}
          onClick={() => setActivePanel(t.panel)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 12px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: "10px",
            color: C.text,
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = C.accentDim;
            e.currentTarget.style.borderColor = C.borderHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.03)";
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          <span style={{ fontSize: "18px" }}>{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  );

  // ─── Panel Content ─────────────────────────────────

  const renderPanel = () => {
    const backBtn = (label: string, to: ToolPanel = null) => (
      <button
        onClick={() => setActivePanel(to)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "none",
          border: "none",
          color: C.textDim,
          fontSize: "11px",
          cursor: "pointer",
          padding: "0 0 8px",
          fontWeight: 500,
        }}
      >
        ← {label}
      </button>
    );

    switch (activePanel) {
      case "edit":
        return (
          <QuickEdit
            unitId={unitId}
            pageId={pageId}
            content={lessonContent}
            onSaved={onLessonEdited}
          />
        );

      case "activity":
        return (
          <OnTheFlyPanel
            classId={classId}
            unitId={unitId}
            pageId={pageId}
            studentCount={studentCount}
          />
        );

      case "timer":
        return (
          <>
            {backBtn("Tools", null)}
            <QuickTimer onProjectToScreen={onProjectToScreen} />
          </>
        );

      case "picker":
        return (
          <>
            {backBtn("Tools", null)}
            <RandomPicker students={students} onProjectToScreen={onProjectToScreen} />
          </>
        );

      case "groups":
        return (
          <>
            {backBtn("Tools", null)}
            <GroupMaker students={students} onProjectToScreen={onProjectToScreen} />
          </>
        );

      case "stopwatch":
        return (
          <>
            {backBtn("Tools", null)}
            <Stopwatch onProjectToScreen={onProjectToScreen} />
          </>
        );

      case "noise":
        return (
          <>
            {backBtn("Tools", null)}
            <NoiseMeter onProjectToScreen={onProjectToScreen} />
          </>
        );

      case "project":
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: C.white, marginBottom: "4px" }}>
              📺 Projector
            </div>
            <button
              onClick={() => {
                window.open(
                  `/teacher/teach/${unitId}/projector${pageId ? `?pageId=${pageId}` : ""}`,
                  "studioloom-projector",
                  "width=1280,height=720"
                );
                setActivePanel(null);
              }}
              style={{
                padding: "10px 14px",
                background: C.accent,
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Open Projector Window
            </button>
            {onPhaseSkip && (
              <button
                onClick={() => { onPhaseSkip(); setActivePanel(null); }}
                style={{
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                ⏭ Skip to Next Phase
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Tools button shows sub-menu when no specific tool is active
  const isToolActive = ["timer", "picker", "groups", "stopwatch", "noise"].includes(
    activePanel || ""
  );

  return (
    <>
      {/* ─── Panel (above toolbar) ─── */}
      {activePanel && (
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            bottom: "80px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: C.surface,
            borderRadius: "16px",
            border: `1px solid ${C.border}`,
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
            padding: "16px",
            backdropFilter: "blur(24px)",
            maxWidth: "380px",
            minWidth: "300px",
            maxHeight: "calc(100vh - 140px)",
            overflowY: "auto",
            color: C.text,
            animation: "toolPanelIn 0.15s ease-out",
          }}
        >
          {/* Arrow */}
          <div
            style={{
              position: "absolute",
              bottom: "-7px",
              left: "50%",
              transform: "translateX(-50%) rotate(45deg)",
              width: "12px",
              height: "12px",
              background: C.surface,
              borderRight: `1px solid ${C.border}`,
              borderBottom: `1px solid ${C.border}`,
            }}
          />
          {renderPanel()}
        </div>
      )}

      {/* ─── Toolbar ─── */}
      <div
        ref={toolbarRef}
        style={{
          position: "fixed",
          bottom: "12px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "8px 16px",
          background: C.bg,
          backdropFilter: "blur(24px)",
          borderRadius: "16px",
          border: `1px solid ${C.border}`,
          boxShadow: "0 -4px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.02)",
          zIndex: 150,
          fontFamily: "system-ui, -apple-system, sans-serif",
          color: C.text,
        }}
      >
        {/* Clock — always visible */}
        <ClassClock periodEndTime={periodEndTime} />

        {/* Separator */}
        <div style={{ width: "1px", height: "28px", background: C.border, margin: "0 4px" }} />

        {/* Phase indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "4px 10px",
            borderRadius: "8px",
            background: `${phaseColor}18`,
            border: `1px solid ${phaseColor}30`,
            minWidth: "120px",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: phaseColor,
              boxShadow: `0 0 6px ${phaseColor}`,
              animation: "pulse 2s infinite",
            }}
          />
          <span style={{ fontSize: "11px", fontWeight: 600, color: C.white }}>{currentPhase}</span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              fontFamily: "'Menlo', 'Monaco', monospace",
              color: phaseTimeRemaining < 60 ? "#F59E0B" : C.text,
              marginLeft: "auto",
            }}
          >
            {fmtTime(phaseTimeRemaining)}
          </span>
        </div>

        {/* Separator */}
        <div style={{ width: "1px", height: "28px", background: C.border, margin: "0 4px" }} />

        {/* Tool buttons */}
        <Btn icon="✏️" label="Edit" panel="edit" />
        <Btn icon="⚡" label="Activity" panel="activity" badge={studentCount > 0 ? undefined : undefined} />
        <Btn
          icon="🎲"
          label="Tools"
          panel={isToolActive ? activePanel : ("timer" as ToolPanel)}
        />
        <Btn icon="📺" label="Project" panel="project" />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes toolPanelIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.97); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}
