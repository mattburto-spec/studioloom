"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CRITERIA, type CriterionKey } from "@/lib/constants";
import { getPageList } from "@/lib/unit-adapter";
import { JourneyMap } from "@/components/student/JourneyMap";
import { SkillsCerts, type SkillCert } from "@/components/student/BadgeWall";
import { StatsStrip } from "@/components/student/StatsStrip";
import { computeStats, type BadgeInput } from "@/lib/badges/compute-badges";
import type { Unit, StudentProgress, UnitPage } from "@/types";

/**
 * Teacher Per-Student Dashboard View
 *
 * Shows the same dashboard layout a student sees, with teacher overlays:
 * - Workshop certifications with grant/revoke toggles
 * - Progress per unit with JourneyMap
 * - Stats strip
 * - Integrity flags (future)
 *
 * URL: /teacher/students/[studentId]
 */

interface UnitWithProgress extends Unit {
  progress: StudentProgress[];
}

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

export default function TeacherStudentView({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const [student, setStudent] = useState<{ display_name: string; username: string; class_id: string } | null>(null);
  const [className, setClassName] = useState("");
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [safetyCerts, setSafetyCerts] = useState<Array<{ cert_type: string; granted_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Get student info
      const { data: studentData } = await supabase
        .from("students")
        .select("display_name, username, class_id")
        .eq("id", studentId)
        .single();

      if (!studentData) {
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // Get class name
      const { data: classData } = await supabase
        .from("classes")
        .select("name")
        .eq("id", studentData.class_id)
        .single();

      setClassName(classData?.name || "");

      // Get units assigned to this class
      const { data: classUnits } = await supabase
        .from("class_units")
        .select("unit_id")
        .eq("class_id", studentData.class_id)
        .eq("is_active", true);

      const unitIds = (classUnits || []).map((cu: { unit_id: string }) => cu.unit_id);

      if (unitIds.length > 0) {
        const [unitsRes, progressRes] = await Promise.all([
          supabase.from("units").select("id, title, description, thumbnail_url, content_data").in("id", unitIds),
          supabase.from("student_progress").select("*").eq("student_id", studentId).in("unit_id", unitIds),
        ]);

        const unitsWithProgress = (unitsRes.data || []).map((unit: Unit) => ({
          ...unit,
          progress: (progressRes.data || []).filter((p: StudentProgress) => p.unit_id === unit.id),
        }));

        setUnits(unitsWithProgress);
      }

      // Get safety certs
      const { data: certs } = await supabase
        .from("safety_certifications")
        .select("cert_type, granted_at")
        .eq("student_id", studentId);

      setSafetyCerts(certs || []);
      setLoading(false);
    }
    load();
  }, [studentId]);

  // Stats computation
  const stats = useMemo(() => {
    const allProgress = units.flatMap((unit) => {
      const pages = getPageList(unit.content_data);
      return unit.progress.map((p) => {
        const page = pages.find((pg: UnitPage) => pg.id === p.page_id);
        return {
          page_id: p.page_id,
          criterion: page?.criterion,
          status: p.status,
          time_spent: p.time_spent,
          updated_at: p.updated_at,
        };
      });
    });
    const input: BadgeInput = {
      progress: allProgress,
      toolSessions: [],
      safetyCerts: [],
      studioStatus: [],
      studioSessions: [],
      studioProfiles: [],
    };
    return computeStats(input);
  }, [units]);

  // Skill certs
  const skillCerts: SkillCert[] = useMemo(() => {
    return WORKSHOP_SKILLS.map((skill) => {
      const cert = safetyCerts.find((c) => c.cert_type === skill.id);
      return {
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        earned: !!cert,
        grantedAt: cert?.granted_at || null,
      };
    });
  }, [safetyCerts]);

  function getCompletionPercent(unit: Unit, progress: StudentProgress[]): number {
    const unitPages = getPageList(unit.content_data);
    if (unitPages.length === 0) return 0;
    const complete = progress.filter((p) => p.status === "complete").length;
    return Math.round((complete / unitPages.length) * 100);
  }

  function getCriterionProgress(unitPages: UnitPage[], progress: StudentProgress[], criterion: string) {
    const criterionPages = unitPages.filter((p) => p.type === "strand" && p.criterion === criterion);
    if (criterionPages.length === 0) return null;
    const completed = criterionPages.filter((p) =>
      progress.some((pr) => pr.page_id === p.id && pr.status === "complete")
    ).length;
    return { completed, total: criterionPages.length };
  }

  if (loading) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-10 bg-gray-200 rounded w-64" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="max-w-4xl mx-auto px-6 py-8">
        <p className="text-text-secondary">Student not found.</p>
        <Link href="/teacher/dashboard" className="text-purple-600 text-sm mt-2 inline-block">
          ← Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-text-secondary mb-4">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-text-primary font-medium">
          {student.display_name || student.username}
        </span>
      </div>

      {/* Header with teacher badge */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-text-primary">
              {student.display_name || student.username}
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-600 rounded-full">
              Teacher View
            </span>
          </div>
          <p className="text-sm text-text-secondary">{className}</p>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="mb-5">
        <StatsStrip stats={stats} />
      </div>

      {/* Workshop Certs */}
      <div className="mb-6">
        <SkillsCerts certs={skillCerts} />
      </div>

      {/* Per-Unit Progress */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-text-primary mb-4">Unit Progress</h2>
        {units.length === 0 ? (
          <p className="text-sm text-text-secondary">No active units assigned.</p>
        ) : (
          <div className="space-y-4">
            {units.map((unit) => {
              const unitPages = getPageList(unit.content_data);
              const percent = getCompletionPercent(unit, unit.progress);
              const criterionKeys: CriterionKey[] = ["A", "B", "C", "D"];

              let currentCriterion: CriterionKey | null = null;
              for (const key of criterionKeys) {
                const cp = getCriterionProgress(unitPages, unit.progress, key);
                if (cp && cp.completed < cp.total) {
                  currentCriterion = key;
                  break;
                }
              }

              const zones = criterionKeys.map((key) => {
                const cp = getCriterionProgress(unitPages, unit.progress, key);
                return {
                  criterion: key,
                  name: CRITERIA[key].name,
                  color: CRITERIA[key].color,
                  pagesComplete: cp?.completed || 0,
                  pagesTotal: cp?.total || 0,
                  isCurrent: key === currentCriterion,
                };
              });

              return (
                <div key={unit.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-text-primary">{unit.title}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{percent}% complete</p>
                    </div>
                    <Link
                      href={`/teacher/classes/${student.class_id}/progress/${unit.id}`}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Full progress →
                    </Link>
                  </div>
                  <JourneyMap zones={zones} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
