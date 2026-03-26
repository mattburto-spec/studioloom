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
import { getYearLevelNumber, yearLevelToGraduationYear, YEAR_LEVEL_OPTIONS } from "@/lib/utils/year-level";
import { StudentDiscoveryProfile } from "@/components/teacher/StudentDiscoveryProfile";

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
  const [student, setStudent] = useState<{ display_name: string; username: string; class_id: string | null; graduation_year: number | null } | null>(null);
  const [enrollments, setEnrollments] = useState<Array<{ class_id: string; class_name: string; is_active: boolean; enrolled_at: string; unenrolled_at: string | null; term_id: string | null; term_name: string | null; academic_year: string | null }>>([]);
  const [allClasses, setAllClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<UnitWithProgress[]>([]);
  const [safetyCerts, setSafetyCerts] = useState<Array<{ cert_type: string; granted_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);
  const [assignClassId, setAssignClassId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "discovery">("overview");
  const [hasDiscovery, setHasDiscovery] = useState(false);

  async function loadAll() {
    const supabase = createClient();

    // Get student info
    const { data: studentData } = await supabase
      .from("students")
      .select("display_name, username, class_id, graduation_year")
      .eq("id", studentId)
      .single();

    if (!studentData) {
      setLoading(false);
      return;
    }

    setStudent(studentData);

    // Get all enrollments for this student (active + past) with term info
    const { data: enrollmentRows } = await supabase
      .from("class_students")
      .select("class_id, is_active, enrolled_at, unenrolled_at, term_id, classes(name), school_calendar_terms(term_name, academic_year)")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false });

    const parsedEnrollments = (enrollmentRows || []).map((row: any) => ({
      class_id: row.class_id,
      class_name: (row.classes as any)?.name || "Unknown",
      is_active: row.is_active,
      enrolled_at: row.enrolled_at,
      unenrolled_at: row.unenrolled_at,
      term_id: row.term_id || null,
      term_name: (row.school_calendar_terms as any)?.term_name || null,
      academic_year: (row.school_calendar_terms as any)?.academic_year || null,
    }));
    setEnrollments(parsedEnrollments);

    // Get all teacher's classes (for assign dropdown)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name")
        .eq("teacher_id", user.id)
        .order("name");
      setAllClasses(classes || []);
    }

    // Get units from ALL active enrollments
    const activeClassIds = parsedEnrollments
      .filter((e: any) => e.is_active)
      .map((e: any) => e.class_id);
    // Also include legacy class_id
    if (studentData.class_id && !activeClassIds.includes(studentData.class_id)) {
      activeClassIds.push(studentData.class_id);
    }

    if (activeClassIds.length > 0) {
      const { data: classUnitsData } = await supabase
        .from("class_units")
        .select("unit_id")
        .in("class_id", activeClassIds)
        .eq("is_active", true);

      const unitIds = [...new Set((classUnitsData || []).map((cu: { unit_id: string }) => cu.unit_id))];

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
    }

    // Get safety certs
    const { data: certs } = await supabase
      .from("safety_certifications")
      .select("cert_type, granted_at")
      .eq("student_id", studentId);

    setSafetyCerts(certs || []);

    // Check if student has any discovery data (for tab visibility)
    const { data: discoveryData } = await supabase
      .from("discovery_sessions")
      .select("id, profile")
      .eq("student_id", studentId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setHasDiscovery(
      !!discoveryData?.profile &&
      (discoveryData.profile as any).lastStationCompleted >= 2
    );

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  async function assignToClass() {
    if (!assignClassId) return;
    setAssigning(true);
    const supabase = createClient();
    await supabase.from("class_students").upsert({
      student_id: studentId,
      class_id: assignClassId,
      is_active: true,
      enrolled_at: new Date().toISOString(),
      unenrolled_at: null,
    }, { onConflict: "student_id,class_id" });
    // Update legacy class_id
    await supabase.from("students").update({ class_id: assignClassId }).eq("id", studentId);
    setAssigning(false);
    setShowAssign(false);
    setAssignClassId("");
    loadAll();
  }

  async function unenrollFromClass(classId: string) {
    const supabase = createClient();
    await supabase
      .from("class_students")
      .update({ is_active: false, unenrolled_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("class_id", classId);
    // Update legacy class_id to next active or null
    const { data: activeEnrollments } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .neq("class_id", classId)
      .limit(1);
    await supabase
      .from("students")
      .update({ class_id: activeEnrollments?.[0]?.class_id || null })
      .eq("id", studentId);
    loadAll();
  }

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
            <h1 className="text-2xl font-extrabold text-gray-900">
              {student.display_name || student.username}
            </h1>
            {getYearLevelNumber(student.graduation_year) && (
              <span className="text-sm font-bold text-indigo-400" title={`Year ${getYearLevelNumber(student.graduation_year)}`}>
                {getYearLevelNumber(student.graduation_year)}
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-600 rounded-full">
              Teacher View
            </span>
          </div>
          <p className="text-sm text-gray-500">@{student.username}</p>
        </div>

        {/* Year level picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500">Year Level</label>
          <select
            value={getYearLevelNumber(student.graduation_year) || ""}
            onChange={async (e) => {
              const yearLevel = Number(e.target.value);
              if (!yearLevel) return;
              const gradYear = yearLevelToGraduationYear(yearLevel);
              const supabase = createClient();
              await supabase
                .from("students")
                .update({ graduation_year: gradYear })
                .eq("id", studentId);
              setStudent({ ...student, graduation_year: gradYear });
            }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
          >
            <option value="">Not set</option>
            {YEAR_LEVEL_OPTIONS.map((yl) => (
              <option key={yl} value={yl}>Year {yl}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-sm font-semibold transition-colors relative ${
            activeTab === "overview"
              ? "text-purple-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Overview
          {activeTab === "overview" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
          )}
        </button>
        {hasDiscovery && (
          <button
            onClick={() => setActiveTab("discovery")}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors relative flex items-center gap-1.5 ${
              activeTab === "discovery"
                ? "text-purple-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>🧭</span> Discovery Profile
            {activeTab === "discovery" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 rounded-full" />
            )}
          </button>
        )}
      </div>

      {/* ─── Discovery Tab ─────────────────────────────────── */}
      {activeTab === "discovery" && hasDiscovery && (
        <StudentDiscoveryProfile studentId={studentId} defaultExpanded />
      )}

      {/* ─── Overview Tab ──────────────────────────────────── */}
      {activeTab === "overview" && <>

      {/* Enrollment History Timeline */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-gray-900">Enrollment History</h2>
          <button
            onClick={() => setShowAssign(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Assign to Class
          </button>
        </div>

        {enrollments.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
            <p className="text-sm text-gray-500">Not enrolled in any classes yet.</p>
            <button
              onClick={() => setShowAssign(true)}
              className="mt-2 text-sm font-medium text-purple-600 hover:text-purple-700 transition"
            >
              Assign to a class →
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Term</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Class</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Dates</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e, idx) => (
                  <tr key={`${e.class_id}-${idx}`} className={`border-b border-gray-50 last:border-0 ${!e.is_active ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3">
                      {e.term_name ? (
                        <div>
                          <span className="font-medium text-gray-800">{e.term_name}</span>
                          {e.academic_year && (
                            <span className="block text-[11px] text-gray-400">{e.academic_year}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/teacher/classes/${e.class_id}`}
                        className="font-semibold text-gray-900 hover:text-purple-600 transition"
                      >
                        {e.class_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(e.enrolled_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                      {e.unenrolled_at && (
                        <span> — {new Date(e.unenrolled_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {e.is_active ? (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700 rounded-full">Active</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 rounded-full">Completed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.is_active && (
                        <button
                          onClick={() => unenrollFromClass(e.class_id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium transition"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign to Class Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Assign to Class</h3>
            <p className="text-sm text-gray-500 mb-4">Choose a class to enroll {student.display_name || student.username} in.</p>

            {(() => {
              const enrolledIds = new Set(enrollments.filter((e) => e.is_active).map((e) => e.class_id));
              const available = allClasses.filter((c) => !enrolledIds.has(c.id));
              if (available.length === 0) {
                return <p className="text-sm text-gray-500">Already enrolled in all your classes.</p>;
              }
              return (
                <select
                  value={assignClassId}
                  onChange={(e) => setAssignClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400 mb-4"
                >
                  <option value="">Select a class...</option>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              );
            })()}

            <div className="flex items-center justify-end gap-2">
              <button onClick={() => { setShowAssign(false); setAssignClassId(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">Cancel</button>
              <button
                disabled={!assignClassId || assigning}
                onClick={assignToClass}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                {assigning ? "Enrolling..." : "Enroll"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    {(() => {
                      const activeClassId = enrollments.find((e) => e.is_active)?.class_id || student.class_id;
                      return activeClassId ? (
                        <Link
                          href={`/teacher/classes/${activeClassId}/progress/${unit.id}`}
                          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                        >
                          Full progress →
                        </Link>
                      ) : null;
                    })()}
                  </div>
                  <JourneyMap zones={zones} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      </>}
    </main>
  );
}
