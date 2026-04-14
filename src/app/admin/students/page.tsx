"use client";

import { useState, useEffect } from "react";

interface StudentRow {
  hash: string;
  id: string;
  createdAt: string;
  activeClasses: number;
  totalClasses: number;
  progressEntries: number;
  hasLearningProfile: boolean;
  hasMentor: boolean;
}

export default function StudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/students")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setStudents(data.students || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading students...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  const withProfile = students.filter((s) => s.hasLearningProfile).length;
  const active = students.filter((s) => s.activeClasses > 0).length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Students</h2>
        <p className="text-sm text-gray-500">Anonymized roster — {students.length} total, {active} active, {withProfile} with learning profiles</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{students.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Active (enrolled)</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{active}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Profile Completion</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {students.length > 0 ? Math.round((withProfile / students.length) * 100) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Hash</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 uppercase">Profile</th>
              <th className="text-center px-4 py-2 text-xs font-medium text-gray-500 uppercase">Mentor</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No students</td></tr>
            )}
            {students.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{s.hash}</td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {s.activeClasses}/{s.totalClasses}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">{s.progressEntries}</td>
                <td className="px-4 py-2 text-center">
                  {s.hasLearningProfile ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {s.hasMentor ? (
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                  ) : (
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  )}
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
