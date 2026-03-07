"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useStudent } from "../student-context";
import { CRITERIA, PAGES } from "@/lib/constants";
import type { Unit, StudentProgress } from "@/types";

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
}

export default function StudentDashboard() {
  const { student, classInfo } = useStudent();
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUnits() {
      if (!student) return;
      try {
        const res = await fetch("/api/student/units");
        if (res.ok) {
          const data = await res.json();
          setUnits(data.units || []);
        }
      } finally {
        setLoading(false);
      }
    }
    loadUnits();
  }, [student]);

  function getCompletionPercent(progress: StudentProgress[]): number {
    if (!progress.length) return 0;
    const complete = progress.filter((p) => p.status === "complete").length;
    return Math.round((complete / 16) * 100);
  }

  function getCriterionProgress(progress: StudentProgress[], criterion: string) {
    const criterionPages = PAGES.filter((p) => p.criterion === criterion);
    const completed = criterionPages.filter((p) =>
      progress.some((pr) => pr.page_number === p.number && pr.status === "complete")
    ).length;
    return { completed, total: criterionPages.length };
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">
          Welcome back, {student?.display_name || student?.username}
        </h1>
        <p className="text-text-secondary mt-1">
          {classInfo?.name} — Choose a unit to continue
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-6 animate-pulse h-48" />
          ))}
        </div>
      ) : units.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary text-lg">No units assigned yet.</p>
          <p className="text-text-secondary/70 text-sm mt-2">
            Your teacher will assign units for you to work on.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {units.map((unit) => {
            const percent = getCompletionPercent(unit.progress);
            return (
              <Link
                key={unit.id}
                href={`/unit/${unit.id}/A1`}
                className="bg-white rounded-xl p-6 hover:shadow-md transition group"
              >
                <h2 className="font-semibold text-lg text-text-primary group-hover:text-accent-blue transition mb-2">
                  {unit.title}
                </h2>
                {unit.description && (
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                    {unit.description}
                  </p>
                )}

                {/* Criterion progress bars */}
                <div className="flex gap-1.5 mb-3">
                  {(Object.keys(CRITERIA) as Array<keyof typeof CRITERIA>).map((key) => {
                    const { completed, total } = getCriterionProgress(unit.progress, key);
                    const fillPercent = (completed / total) * 100;
                    return (
                      <div
                        key={key}
                        className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden"
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${fillPercent}%`,
                            backgroundColor: CRITERIA[key].color,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-text-secondary">
                  {percent}% complete
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
