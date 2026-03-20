"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * OpenStudioClassView — teacher dashboard section for managing Open Studio.
 *
 * Shows: who has Open Studio, who is close, drift flags, one-click grant/revoke,
 * configurable check-in intervals.
 */

interface Student {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  ell_level: number;
}

interface OpenStudioStatusData {
  id: string;
  student_id: string;
  status: "locked" | "unlocked" | "revoked";
  unlocked_by: string;
  teacher_note: string | null;
  check_in_interval_min: number;
  carry_forward: boolean;
  unlocked_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
}

interface StudentRow {
  student: Student;
  openStudio: OpenStudioStatusData | null;
}

interface OpenStudioClassViewProps {
  unitId: string;
  classId: string;
}

export function OpenStudioClassView({ unitId, classId }: OpenStudioClassViewProps) {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [grantNote, setGrantNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teacher/open-studio/status?unitId=${unitId}&classId=${classId}`
      );
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [unitId, classId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const grantOpenStudio = async (studentId: string) => {
    setError(null);
    try {
      const res = await fetch("/api/teacher/open-studio/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          unitId,
          classId,
          teacherNote: grantNote || undefined,
        }),
      });
      if (res.ok) {
        setGrantingId(null);
        setGrantNote("");
        fetchStudents();
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("[OpenStudioClassView] Grant failed:", res.status, data);
        setError(data.error || `Grant failed (${res.status})`);
      }
    } catch (err) {
      console.error("[OpenStudioClassView] Network error:", err);
      setError("Network error");
    }
  };

  const revokeOpenStudio = async (statusId: string) => {
    try {
      const res = await fetch("/api/teacher/open-studio/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statusId,
          action: "revoke",
          reason: "teacher_manual",
        }),
      });
      if (res.ok) {
        fetchStudents();
      }
    } catch {
      // Handle error
    }
  };

  if (loading) {
    return <div style={{ padding: "20px", color: "#6b7280" }}>Loading Open Studio status...</div>;
  }

  const unlocked = students.filter((s) => s.openStudio?.status === "unlocked");
  const locked = students.filter((s) => !s.openStudio || s.openStudio.status !== "unlocked");

  return (
    <div style={{ padding: "20px" }}>
      <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", fontWeight: 600 }}>
        Open Studio
      </h3>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <div
          style={{
            background: "#f5f3ff",
            border: "1px solid #ddd6fe",
            borderRadius: "10px",
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#7c3aed" }}>
            {unlocked.length}
          </div>
          <div style={{ fontSize: "13px", color: "#6d28d9" }}>Unlocked</div>
        </div>
        <div
          style={{
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: "10px",
            padding: "12px 16px",
            flex: 1,
          }}
        >
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#6b7280" }}>
            {locked.length}
          </div>
          <div style={{ fontSize: "13px", color: "#6b7280" }}>Guided</div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "12px",
            fontSize: "13px",
            color: "#dc2626",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: "8px", fontWeight: 600, cursor: "pointer", background: "none", border: "none", color: "#dc2626" }}
          >
            &#10005;
          </button>
        </div>
      )}

      {/* Unlocked students */}
      {unlocked.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#7c3aed", marginBottom: "8px" }}>
            Open Studio Active
          </h4>
          {unlocked.map(({ student, openStudio }) => (
            <div
              key={student.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#faf5ff",
                borderRadius: "8px",
                marginBottom: "6px",
                border: "1px solid #ede9fe",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "999px",
                    background: "#7c3aed",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {(student.display_name || student.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>
                    {student.display_name || student.username}
                  </div>
                  {openStudio?.unlocked_at && (
                    <div style={{ fontSize: "12px", color: "#8b5cf6" }}>
                      Since {new Date(openStudio.unlocked_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Journey status — plan will be set during Discovery/Planning */}
                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "#f5f3ff",
                    fontSize: "11px",
                    color: "#7c3aed",
                    fontWeight: 500,
                  }}
                >
                  {openStudio?.check_in_interval_min ? "Awaiting journey plan" : "No plan yet"}
                </span>

                <button
                  onClick={() => openStudio && revokeOpenStudio(openStudio.id)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    background: "transparent",
                    color: "#dc2626",
                    border: "1px solid #fca5a5",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Locked students */}
      {locked.length > 0 && (
        <div>
          <h4 style={{ fontSize: "14px", fontWeight: 600, color: "#6b7280", marginBottom: "8px" }}>
            Guided Mode
          </h4>
          {locked.map(({ student, openStudio }) => (
            <div
              key={student.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 12px",
                background: "#f9fafb",
                borderRadius: "8px",
                marginBottom: "6px",
                border: "1px solid #e5e7eb",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "999px",
                    background: "#d1d5db",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {(student.display_name || student.username).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 500 }}>
                    {student.display_name || student.username}
                  </div>
                  {openStudio?.status === "revoked" && (
                    <div style={{ fontSize: "12px", color: "#f59e0b" }}>
                      Revoked — {openStudio.revoked_reason === "drift_detected" ? "drift detected" : "teacher decision"}
                    </div>
                  )}
                </div>
              </div>

              {grantingId === student.id ? (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Note (optional)"
                    value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #c4b5fd",
                      fontSize: "12px",
                      width: "140px",
                    }}
                  />
                  <button
                    onClick={() => grantOpenStudio(student.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "#7c3aed",
                      color: "white",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Grant
                  </button>
                  <button
                    onClick={() => {
                      setGrantingId(null);
                      setGrantNote("");
                    }}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background: "#e5e7eb",
                      border: "none",
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    &#10005;
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setGrantingId(student.id)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "transparent",
                    color: "#7c3aed",
                    border: "1px solid #c4b5fd",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Unlock
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
