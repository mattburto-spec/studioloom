"use client";

import { useState, useEffect } from "react";

interface Teacher {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  classCount: number;
  unitCount: number;
}

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/teachers")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setTeachers(data.teachers || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading teachers...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Teachers</h2>
        <p className="text-sm text-gray-500">{teachers.length} registered teacher{teachers.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Classes</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Units</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Last Active</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No teachers registered</td></tr>
            )}
            {teachers.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-medium text-gray-900">{t.name || "—"}</td>
                <td className="px-4 py-2 text-gray-600">{t.email || "—"}</td>
                <td className="px-4 py-2 text-right text-gray-600">{t.classCount}</td>
                <td className="px-4 py-2 text-right text-gray-600">{t.unitCount}</td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {new Date(t.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
