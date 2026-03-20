"use client";

/**
 * ReadinessIndicator — simple Open Studio status display for students.
 *
 * Shows whether Open Studio is unlocked or not, with a brief message.
 * Criteria-based readiness tracking is planned for a future version.
 */

interface ReadinessIndicatorProps {
  /** Whether Open Studio is currently unlocked */
  unlocked: boolean;
  /** Compact mode for inline display (e.g., student dashboard card) */
  compact?: boolean;
}

export function ReadinessIndicator({
  unlocked,
  compact = false,
}: ReadinessIndicatorProps) {
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: unlocked ? "#7c3aed" : "#d1d5db",
          }}
        />
        <span style={{ fontSize: "13px", fontWeight: 600, color: unlocked ? "#7c3aed" : "#6b7280" }}>
          {unlocked ? "Open Studio" : "Open Studio locked"}
        </span>
      </div>
    );
  }

  // Full display
  return (
    <div
      style={{
        background: unlocked ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" : "#f9fafb",
        border: `1px solid ${unlocked ? "#c4b5fd" : "#e5e7eb"}`,
        borderRadius: "12px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: unlocked ? "#7c3aed" : "#e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {unlocked ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l2 2 4-4" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
      </div>

      <div>
        <h4 style={{ margin: "0 0 2px 0", fontSize: "14px", fontWeight: 600, color: unlocked ? "#7c3aed" : "#374151" }}>
          {unlocked ? "Open Studio Unlocked" : "Open Studio"}
        </h4>
        <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
          {unlocked
            ? "You can work independently with your AI studio critic."
            : "Your teacher will unlock this when you're ready for independent work."}
        </p>
      </div>
    </div>
  );
}
