"use client";

import { useState } from "react";

/**
 * OpenStudioBanner — appears at the top of the unit page when Open Studio is unlocked.
 *
 * Shows: status badge, focus area input, session timer, check-in countdown.
 * Also handles the "start session" flow when unlocked but no active session.
 */

interface OpenStudioBannerProps {
  /** Whether Open Studio is unlocked for this student+unit */
  unlocked: boolean;
  /** Active session data, or null if no session yet */
  activeSession: {
    id: string;
    session_number: number;
    focus_area: string | null;
    started_at: string;
  } | null;
  /** Teacher's note on unlock */
  teacherNote: string | null;
  /** Latest check-in message from AI */
  checkInMessage: string | null;
  /** Dismiss the check-in message */
  onDismissCheckIn: () => void;
  /** Start a new session */
  onStartSession: (focusArea?: string) => void;
  /** End the current session */
  onEndSession: (reflection?: string) => void;
  /** Update focus area */
  onUpdateFocusArea: (focusArea: string) => void;
  /** Whether Open Studio was just revoked */
  justRevoked: boolean;
}

export function OpenStudioBanner({
  unlocked,
  activeSession,
  teacherNote,
  checkInMessage,
  onDismissCheckIn,
  onStartSession,
  onEndSession,
  onUpdateFocusArea,
  justRevoked,
}: OpenStudioBannerProps) {
  const [focusInput, setFocusInput] = useState("");
  const [reflectionInput, setReflectionInput] = useState("");
  const [showEndFlow, setShowEndFlow] = useState(false);
  const [editingFocus, setEditingFocus] = useState(false);

  // Revoked state — show recalibrate message
  if (justRevoked) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          border: "1px solid #f59e0b",
          borderRadius: "12px",
          padding: "16px 20px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <span style={{ fontSize: "20px" }}>&#9888;</span>
        <div>
          <p style={{ fontWeight: 600, margin: 0, color: "#92400e" }}>
            Let&apos;s recalibrate
          </p>
          <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#78350f" }}>
            Your Open Studio access has been paused. Your mentor will guide you through the next steps.
          </p>
        </div>
      </div>
    );
  }

  if (!unlocked) return null;

  // No active session — show start flow
  if (!activeSession) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
          border: "1px solid #a78bfa",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
          <span
            style={{
              background: "#7c3aed",
              color: "white",
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Open Studio
          </span>
          <span style={{ fontSize: "14px", color: "#6d28d9" }}>
            You&apos;re working independently
          </span>
        </div>

        {teacherNote && (
          <p style={{ fontSize: "14px", color: "#5b21b6", margin: "0 0 12px 0", fontStyle: "italic" }}>
            &ldquo;{teacherNote}&rdquo;
          </p>
        )}

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            placeholder="What will you work on today?"
            value={focusInput}
            onChange={(e) => setFocusInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && focusInput.trim()) {
                onStartSession(focusInput.trim());
                setFocusInput("");
              }
            }}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid #c4b5fd",
              background: "white",
              fontSize: "14px",
              outline: "none",
            }}
          />
          <button
            onClick={() => {
              onStartSession(focusInput.trim() || undefined);
              setFocusInput("");
            }}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              background: "#7c3aed",
              color: "white",
              border: "none",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  // Active session — show status bar
  return (
    <div style={{ marginBottom: "16px" }}>
      {/* Main banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)",
          border: "1px solid #c4b5fd",
          borderRadius: checkInMessage ? "12px 12px 0 0" : "12px",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          <span
            style={{
              background: "#7c3aed",
              color: "white",
              padding: "3px 10px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}
          >
            Open Studio #{activeSession.session_number}
          </span>

          {editingFocus ? (
            <input
              type="text"
              defaultValue={activeSession.focus_area || ""}
              autoFocus
              onBlur={(e) => {
                if (e.target.value.trim()) {
                  onUpdateFocusArea(e.target.value.trim());
                }
                setEditingFocus(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Escape") {
                  setEditingFocus(false);
                }
              }}
              style={{
                flex: 1,
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #c4b5fd",
                fontSize: "13px",
                outline: "none",
              }}
            />
          ) : (
            <span
              onClick={() => setEditingFocus(true)}
              style={{
                fontSize: "13px",
                color: "#6d28d9",
                cursor: "pointer",
                borderBottom: "1px dashed #a78bfa",
              }}
              title="Click to edit focus area"
            >
              {activeSession.focus_area || "No focus set — click to add"}
            </span>
          )}
        </div>

        {showEndFlow ? (
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Quick reflection (optional)"
              value={reflectionInput}
              onChange={(e) => setReflectionInput(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid #c4b5fd",
                fontSize: "13px",
                width: "200px",
                outline: "none",
              }}
            />
            <button
              onClick={() => {
                onEndSession(reflectionInput || undefined);
                setReflectionInput("");
                setShowEndFlow(false);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "#dc2626",
                color: "white",
                border: "none",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              End
            </button>
            <button
              onClick={() => setShowEndFlow(false)}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                fontSize: "12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowEndFlow(true)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              background: "transparent",
              color: "#7c3aed",
              border: "1px solid #c4b5fd",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            End Session
          </button>
        )}
      </div>

      {/* Check-in message (slides in below banner) */}
      {checkInMessage && (
        <div
          style={{
            background: "#faf5ff",
            border: "1px solid #c4b5fd",
            borderTop: "none",
            borderRadius: "0 0 12px 12px",
            padding: "12px 16px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
          }}
        >
          <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>&#10023;</span>
          <p style={{ margin: 0, fontSize: "14px", color: "#5b21b6", flex: 1 }}>
            {checkInMessage}
          </p>
          <button
            onClick={onDismissCheckIn}
            style={{
              background: "none",
              border: "none",
              color: "#a78bfa",
              cursor: "pointer",
              fontSize: "16px",
              padding: "0 4px",
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            &#10005;
          </button>
        </div>
      )}
    </div>
  );
}
