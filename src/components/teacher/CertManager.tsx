"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * Workshop skill certifications that teachers can grant.
 * These match the WORKSHOP_SKILLS array in the student dashboard.
 */
const WORKSHOP_SKILLS = [
  { id: "general-workshop", name: "Workshop Safety", icon: "🛡️" },
  { id: "laser-cutter", name: "Laser Cutter", icon: "⚡" },
  { id: "3d-printer", name: "3D Printer", icon: "🖨️" },
  { id: "soldering", name: "Soldering", icon: "🔥" },
  { id: "hand-tools", name: "Hand Tools", icon: "🔧" },
  { id: "power-tools", name: "Power Tools", icon: "⚙️" },
  { id: "cad-101", name: "CAD Modelling", icon: "📐" },
  { id: "sewing-machine", name: "Sewing Machine", icon: "🧵" },
];

interface StudentCert {
  student_id: string;
  cert_type: string;
  granted_at: string;
}

interface Student {
  student_id: string;
  display_name: string;
  username: string;
}

interface CertManagerProps {
  classId: string;
  students: Student[];
}

/**
 * Teacher UI for granting/revoking workshop skill certifications.
 * Shows a matrix of students × skills with toggle switches.
 */
export function CertManager({ classId, students }: CertManagerProps) {
  const [certs, setCerts] = useState<StudentCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // "studentId:certType" being toggled

  const loadCerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/teacher/safety-certs?classId=${classId}`);
      if (res.ok) {
        const data = await res.json();
        setCerts(data.certs || []);
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadCerts();
  }, [loadCerts]);

  function hasCert(studentId: string, certType: string): boolean {
    return certs.some((c) => c.student_id === studentId && c.cert_type === certType);
  }

  async function toggleCert(studentId: string, certType: string) {
    const key = `${studentId}:${certType}`;
    if (saving) return; // Prevent double-click
    setSaving(key);

    const hasIt = hasCert(studentId, certType);

    try {
      if (hasIt) {
        // Revoke
        const res = await fetch("/api/teacher/safety-certs", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, certType }),
        });
        if (res.ok) {
          setCerts((prev) => prev.filter((c) => !(c.student_id === studentId && c.cert_type === certType)));
        }
      } else {
        // Grant
        const res = await fetch("/api/teacher/safety-certs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, classId, certType }),
        });
        if (res.ok) {
          const data = await res.json();
          setCerts((prev) => [
            ...prev,
            { student_id: studentId, cert_type: certType, granted_at: data.cert?.granted_at || new Date().toISOString() },
          ]);
        }
      }
    } catch {
      /* silent */
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="h-40 bg-gray-100 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-base text-gray-900 flex items-center gap-2">
          <span>🛡️</span> Workshop Certifications
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Click to grant or revoke skills. Students see earned certs on their dashboard.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs uppercase tracking-wider sticky left-0 bg-gray-50/50">
                Student
              </th>
              {WORKSHOP_SKILLS.map((skill) => (
                <th
                  key={skill.id}
                  className="text-center px-2 py-2.5 font-medium text-gray-500 text-xs whitespace-nowrap"
                  title={skill.name}
                >
                  <span className="text-base">{skill.icon}</span>
                  <br />
                  <span className="text-[10px]">{skill.name.split(" ")[0]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, i) => (
              <tr
                key={student.student_id}
                className={`border-b border-gray-50 ${i % 2 === 0 ? "" : "bg-gray-50/30"}`}
              >
                <td className="px-4 py-2 font-medium text-gray-800 text-sm whitespace-nowrap sticky left-0 bg-inherit">
                  {student.display_name || student.username}
                </td>
                {WORKSHOP_SKILLS.map((skill) => {
                  const certified = hasCert(student.student_id, skill.id);
                  const isToggling = saving === `${student.student_id}:${skill.id}`;

                  return (
                    <td key={skill.id} className="text-center px-2 py-2">
                      <button
                        onClick={() => toggleCert(student.student_id, skill.id)}
                        disabled={!!saving}
                        className={`w-8 h-8 rounded-lg transition-all duration-200 flex items-center justify-center mx-auto ${
                          isToggling
                            ? "bg-gray-100 animate-pulse"
                            : certified
                              ? "bg-green-100 hover:bg-green-200 border border-green-300"
                              : "bg-gray-100 hover:bg-gray-200 border border-gray-200"
                        }`}
                        title={
                          certified
                            ? `Revoke ${skill.name} from ${student.display_name || student.username}`
                            : `Grant ${skill.name} to ${student.display_name || student.username}`
                        }
                      >
                        {isToggling ? (
                          <span className="text-gray-400 text-xs">…</span>
                        ) : certified ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#10B981">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                          </svg>
                        ) : (
                          <span className="w-3 h-3 rounded-full border-2 border-gray-300" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {students.length === 0 && (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">
          No students in this class yet.
        </div>
      )}
    </div>
  );
}
