"use client";

import { useState, useEffect } from "react";

interface ClassInfo {
  id: string;
  name: string;
  teacher_id: string;
  teacherName: string;
  framework: string | null;
  subject: string | null;
  studentCount: number;
  created_at: string;
}

export default function SchoolsPage() {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/schools")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setClasses(data.classes || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-gray-500">Loading schools...</p></div>;
  if (error) return <div className="max-w-7xl mx-auto px-6 py-8"><p className="text-sm text-red-600">Error: {error}</p></div>;

  // Group by teacher
  const byTeacher = new Map<string, ClassInfo[]>();
  for (const c of classes) {
    const key = c.teacherName;
    if (!byTeacher.has(key)) byTeacher.set(key, []);
    byTeacher.get(key)!.push(c);
  }

  const totalStudents = classes.reduce((s, c) => s + c.studentCount, 0);

  // Framework distribution
  const frameworkCounts: Record<string, number> = {};
  for (const c of classes) {
    const fw = c.framework || "unset";
    frameworkCounts[fw] = (frameworkCounts[fw] || 0) + 1;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Schools</h2>
        <p className="text-sm text-gray-500">School → Class → Teacher hierarchy</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 font-medium">School entity not yet built</p>
        <p className="text-xs text-amber-700 mt-1">
          Showing flat class list grouped by teacher. School/organization entities tracked in FU-P.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Teachers</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{byTeacher.size}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Classes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{classes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Students</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalStudents}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Frameworks</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(frameworkCounts).map(([fw, count]) => (
              <span key={fw} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-700 rounded">
                {fw} ({count})
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {Array.from(byTeacher.entries()).map(([teacher, teacherClasses]) => (
          <div key={teacher} className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">{teacher}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {teacherClasses.map((c) => (
                <div key={c.id} className="px-3 py-2 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {c.framework && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded">{c.framework}</span>
                    )}
                    {c.subject && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">{c.subject}</span>
                    )}
                    <span className="text-xs text-gray-500">{c.studentCount} students</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
