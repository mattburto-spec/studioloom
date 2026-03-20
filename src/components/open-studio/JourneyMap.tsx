"use client";

import { motion } from "framer-motion";

export type JourneyPhase = "discovery" | "planning" | "working" | "sharing";

interface JourneyMapProps {
  currentPhase: JourneyPhase;
  completedPhases: JourneyPhase[];
  compact?: boolean; // thin bar mode (when scrolled)
  onPhaseClick?: (phase: JourneyPhase) => void;
}

const PHASES: {
  id: JourneyPhase;
  label: string;
  icon: string;
  description: string;
  color: string;
}[] = [
  {
    id: "discovery",
    label: "Discovery",
    icon: "🔭",
    description: "Who am I? What lights me up?",
    color: "#7c3aed",
  },
  {
    id: "planning",
    label: "Planning",
    icon: "🗺️",
    description: "What's the plan? Work backward from done.",
    color: "#6366f1",
  },
  {
    id: "working",
    label: "Working",
    icon: "⚡",
    description: "Making it happen. Prove it.",
    color: "#8b5cf6",
  },
  {
    id: "sharing",
    label: "Sharing",
    icon: "🎤",
    description: "Show your work. Reflect. Grow.",
    color: "#a78bfa",
  },
];

export function JourneyMap({
  currentPhase,
  completedPhases,
  compact = false,
  onPhaseClick,
}: JourneyMapProps) {
  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);

  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "8px 16px",
          background: "rgba(15, 10, 40, 0.95)",
          borderRadius: "12px",
          backdropFilter: "blur(8px)",
        }}
      >
        {PHASES.map((phase, i) => {
          const isCompleted = completedPhases.includes(phase.id);
          const isCurrent = phase.id === currentPhase;
          return (
            <div key={phase.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <motion.div
                layout
                style={{
                  width: isCurrent ? "auto" : "8px",
                  height: "8px",
                  borderRadius: isCurrent ? "12px" : "50%",
                  background: isCompleted ? "#22c55e" : isCurrent ? phase.color : "#374151",
                  padding: isCurrent ? "2px 10px" : "0",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: onPhaseClick ? "pointer" : "default",
                }}
                onClick={() => onPhaseClick?.(phase.id)}
              >
                {isCurrent && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "#fff",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {phase.icon} {phase.label}
                  </span>
                )}
              </motion.div>
              {i < PHASES.length - 1 && (
                <div
                  style={{
                    width: "12px",
                    height: "2px",
                    background: isCompleted ? "#22c55e" : "#374151",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        padding: "20px",
        background:
          "linear-gradient(135deg, rgba(15, 10, 40, 0.95), rgba(30, 20, 60, 0.95))",
        borderRadius: "20px",
        border: "1px solid rgba(124, 58, 237, 0.2)",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
      }}
    >
      {PHASES.map((phase, i) => {
        const isCompleted = completedPhases.includes(phase.id);
        const isCurrent = phase.id === currentPhase;
        const isFuture = i > currentIndex && !isCompleted;

        return (
          <motion.div
            key={phase.id}
            layout
            initial={false}
            animate={{
              flex: isCurrent ? 3 : 1,
              opacity: isFuture ? 0.4 : 1,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{
              position: "relative",
              background: isCurrent
                ? `linear-gradient(135deg, ${phase.color}22, ${phase.color}11)`
                : "transparent",
              border: isCurrent ? `1.5px solid ${phase.color}44` : "1.5px solid transparent",
              borderRadius: "16px",
              padding: isCurrent ? "16px" : "12px 8px",
              cursor:
                (isCompleted || isCurrent) && onPhaseClick ? "pointer" : "default",
              minWidth: 0,
              overflow: "hidden",
            }}
            onClick={() => (isCompleted || isCurrent) && onPhaseClick?.(phase.id)}
          >
            {/* Status indicator */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: isCurrent ? "8px" : "0",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: isCompleted
                    ? "#22c55e"
                    : isCurrent
                      ? phase.color
                      : "#374151",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {isCompleted ? "✓" : phase.icon}
              </div>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: isCurrent ? "#fff" : isCompleted ? "#a1a1aa" : "#52525b",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {phase.label}
              </span>
            </div>

            {/* Expanded content for current phase */}
            {isCurrent && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ delay: 0.1 }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "#a1a1aa",
                    margin: 0,
                    lineHeight: "1.4",
                  }}
                >
                  {phase.description}
                </p>
              </motion.div>
            )}

            {/* Connection line to next phase */}
            {i < PHASES.length - 1 && (
              <div
                style={{
                  position: "absolute",
                  right: "-8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "16px",
                  height: "2px",
                  background: isCompleted ? "#22c55e" : "#374151",
                  zIndex: 1,
                }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
