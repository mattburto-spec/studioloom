"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  GRADING_SCALES,
  type CriterionKey,
  type GradingScale,
  getGradingScale,
} from "@/lib/constants";
import { getCriterionLabels } from "@/lib/frameworks/adapter";
import type { FrameworkId } from "@/lib/frameworks/adapter";
import { getCriterionColor } from "@/lib/frameworks/render-helpers";
import { getPageList, isV3 } from "@/lib/unit-adapter";
import type { Student, Unit, UnitPage, StudentProgress } from "@/types";
import type {
  AssessmentRecord,
  CriterionScore,
  AssessmentTag,
  AssessmentTarget,
  AssessmentRecordRow,
} from "@/types/assessment";
import { getYearLevelNumber } from "@/lib/utils/year-level";
import IntegrityReport from "@/components/teacher/IntegrityReport";
import type { IntegrityMetadata } from "@/components/student/MonitoredTextarea";
import { analyzeIntegrity } from "@/lib/integrity/analyze-integrity";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// NOTE: MYP-specific criterion tags are in getFrameworkTags() below.
// Other frameworks use UNIVERSAL_TAGS only until framework-specific tags are defined.

const UNIVERSAL_TAGS: AssessmentTag[] = [
  "exceeds_expectations",
  "needs_support",
  "significant_improvement",
  "regression",
];

const TAG_LABELS: Record<AssessmentTag, string> = {
  strong_research: "Strong Research",
  weak_justification: "Weak Justification",
  creative_ideas: "Creative Ideas",
  limited_range: "Limited Range",
  strong_technique: "Strong Technique",
  poor_planning: "Poor Planning",
  honest_evaluation: "Honest Evaluation",
  superficial_evaluation: "Superficial Evaluation",
  exceeds_expectations: "Exceeds Expectations",
  needs_support: "Needs Support",
  significant_improvement: "Significant Improvement",
  regression: "Regression",
};

// Framework-specific tags — MYP has criterion-specific tags, others use universal only
function getFrameworkTags(framework: string): Record<string, AssessmentTag[]> {
  if (framework === "IB_MYP") {
    return {
      A: ["strong_research", "weak_justification"],
      B: ["creative_ideas", "limited_range"],
      C: ["strong_technique", "poor_planning"],
      D: ["honest_evaluation", "superficial_evaluation"],
    };
  }
  // Other frameworks: no criterion-specific tags yet, only universal
  return {};
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GradingPage({
  params,
}: {
  params: Promise<{ classId: string; unitId: string }>;
}) {
  const { classId, unitId } = use(params);
  const [students, setStudents] = useState<Student[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [className, setClassName] = useState("");
  const [unitPages, setUnitPages] = useState<UnitPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFramework, setClassFramework] = useState<string>("IB_MYP");

  // Assessment state
  const [assessments, setAssessments] = useState<
    Map<string, AssessmentRecord>
  >(new Map());
  const [assessmentIds, setAssessmentIds] = useState<Map<string, string>>(
    new Map()
  );
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null
  );

  // Current editing state (derived from selected student's assessment)
  const [currentScores, setCurrentScores] = useState<
    Map<string, CriterionScore>
  >(new Map());
  const [overallGrade, setOverallGrade] = useState<number | undefined>();
  const [teacherComments, setTeacherComments] = useState("");
  const [strengths, setStrengths] = useState<string[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<string[]>([]);
  const [targets, setTargets] = useState<AssessmentTarget[]>([]);
  const [moderationStatus, setModerationStatus] = useState<
    "unmoderated" | "moderated" | "adjusted"
  >("unmoderated");
  const [moderationNotes, setModerationNotes] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [evidencePageId, setEvidencePageId] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<Record<
    string,
    string
  > | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceIntegrity, setEvidenceIntegrity] = useState<Record<string, IntegrityMetadata> | null>(null);

  // Progress data for evidence
  const [progressMap, setProgressMap] = useState<
    Record<string, Record<string, StudentProgress>>
  >({});

  const scale = getGradingScale(classFramework);

  // ── Data Loading ──

  const loadData = useCallback(async () => {
    const supabase = createClient();

    const [classRes, unitRes, classUnitRes] = await Promise.all([
      supabase.from("classes").select("name, framework").eq("id", classId).single(),
      supabase.from("units").select("*").eq("id", unitId).single(),
      supabase
        .from("class_units")
        .select("content_data")
        .eq("unit_id", unitId)
        .eq("class_id", classId)
        .maybeSingle(),
    ]);

    // Fetch students via class_students junction (migration 041)
    const { data: junctionRows } = await supabase
      .from("class_students")
      .select("student_id")
      .eq("class_id", classId);
    const junctionIds = junctionRows?.map((r: { student_id: string }) => r.student_id) || [];

    let studentList: Student[] = [];
    if (junctionIds.length > 0) {
      const { data: studentsData } = await supabase
        .from("students")
        .select("*")
        .in("id", junctionIds)
        .order("display_name");
      studentList = studentsData || [];
    }
    // Fallback: if junction returned nothing, try legacy class_id FK
    if (studentList.length === 0) {
      const { data: legacyStudents } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("display_name");
      studentList = legacyStudents || [];
    }

    setClassName(classRes.data?.name || "");
    setClassFramework(classRes.data?.framework || "IB_MYP");
    setStudents(studentList);
    setUnit(unitRes.data);

    // Resolve content: class fork → master fallback
    const resolvedContent = classUnitRes?.data?.content_data ?? unitRes.data?.content_data;
    const pages = resolvedContent
      ? getPageList(resolvedContent)
      : [];
    setUnitPages(pages);

    // Fetch existing assessments
    const assessRes = await fetch(
      `/api/teacher/assessments?classId=${classId}&unitId=${unitId}`
    );
    if (assessRes.ok) {
      const { assessments: rows } = (await assessRes.json()) as {
        assessments: AssessmentRecordRow[];
      };
      const map = new Map<string, AssessmentRecord>();
      const idMap = new Map<string, string>();
      for (const row of rows) {
        map.set(row.student_id, row.data as AssessmentRecord);
        idMap.set(row.student_id, row.id);
      }
      setAssessments(map);
      setAssessmentIds(idMap);
    }

    // Fetch progress for evidence
    const studentIds = studentList.map((s: Student) => s.id);
    if (studentIds.length > 0) {
      const { data: progress } = await supabase
        .from("student_progress")
        .select("*")
        .eq("unit_id", unitId)
        .in("student_id", studentIds);

      const pMap: Record<string, Record<string, StudentProgress>> = {};
      for (const p of progress || []) {
        if (!pMap[p.student_id]) pMap[p.student_id] = {};
        pMap[p.student_id][p.page_id] = p;
      }
      setProgressMap(pMap);
    }

    // Auto-select first student
    if (studentList.length > 0) {
      setSelectedStudentId(studentList[0].id);
    }

    setLoading(false);
  }, [classId, unitId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Load assessment into form when student changes ──

  useEffect(() => {
    if (!selectedStudentId) return;
    const existing = assessments.get(selectedStudentId);
    if (existing) {
      const scoreMap = new Map<string, CriterionScore>();
      for (const cs of existing.criterion_scores || []) {
        scoreMap.set(cs.criterion_key, cs);
      }
      setCurrentScores(scoreMap);
      setOverallGrade(existing.overall_grade);
      setTeacherComments(existing.teacher_comments || "");
      setStrengths(existing.strengths || []);
      setAreasForImprovement(existing.areas_for_improvement || []);
      setTargets(existing.targets || []);
      setModerationStatus(existing.moderation_status || "unmoderated");
      setModerationNotes(existing.moderation_notes || "");
    } else {
      // Blank state
      setCurrentScores(new Map());
      setOverallGrade(undefined);
      setTeacherComments("");
      setStrengths([]);
      setAreasForImprovement([]);
      setTargets([]);
      setModerationStatus("unmoderated");
      setModerationNotes("");
    }
    setDirty(false);
    setEvidencePageId(null);
  }, [selectedStudentId, assessments]);

  // ── Helpers ──

  function getCriterionScore(key: string): CriterionScore {
    return (
      currentScores.get(key) || {
        criterion_key: key,
        level: 0,
      }
    );
  }

  function updateCriterionScore(key: string, updates: Partial<CriterionScore>) {
    setCurrentScores((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) || { criterion_key: key, level: 0 };
      next.set(key, { ...existing, ...updates });
      return next;
    });
    setDirty(true);
  }

  // Determine criteria to grade against — via FrameworkAdapter.
  // Always use framework's registered criteria so labels match the class framework,
  // regardless of what criterion keys appear in the unit content (which may be MYP legacy).
  const fwId: FrameworkId =
    (classFramework as FrameworkId | null | undefined) ?? "IB_MYP";
  const unitCriteria: string[] = (() => {
    const labels = getCriterionLabels(fwId);
    if (labels.length > 0) {
      return labels.map((l) => l.short);
    }
    // Fallback: extract from unit content (shouldn't happen if framework is valid)
    const uniqueCriteria = new Set<string>();
    unitPages.forEach((p) => {
      (p.content?.sections || []).forEach((s: any) => {
        (s.criterionTags || []).forEach((t: string) => uniqueCriteria.add(t));
      });
    });
    unitPages.filter((p) => p.type === "strand" && p.criterion).forEach((p) => {
      if (p.criterion) uniqueCriteria.add(p.criterion);
    });
    unitPages.forEach((p) => {
      if ((p as any).criterion) uniqueCriteria.add((p as any).criterion);
    });
    return Array.from(uniqueCriteria);
  })();

  function getStudentStatus(studentId: string): "ungraded" | "draft" | "published" {
    const a = assessments.get(studentId);
    if (!a) return "ungraded";
    return a.is_draft ? "draft" : "published";
  }

  // ── Save ──

  async function saveAssessment(isDraft: boolean) {
    if (!selectedStudentId) return;
    setSaving(true);

    const record: AssessmentRecord = {
      id: assessmentIds.get(selectedStudentId) || crypto.randomUUID(),
      student_id: selectedStudentId,
      unit_id: unitId,
      class_id: classId,
      teacher_id: "", // set server-side
      criterion_scores: Array.from(currentScores.values()).filter(
        (cs) => cs.level > 0
      ),
      overall_grade: overallGrade,
      teacher_comments: teacherComments || undefined,
      strengths: strengths.filter(Boolean),
      areas_for_improvement: areasForImprovement.filter(Boolean),
      targets: targets.length > 0 ? targets : undefined,
      assessed_at: new Date().toISOString(),
      is_draft: isDraft,
      moderation_status:
        moderationStatus !== "unmoderated" ? moderationStatus : undefined,
      moderation_notes: moderationNotes || undefined,
    };

    try {
      const res = await fetch("/api/teacher/assessments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: selectedStudentId,
          unit_id: unitId,
          class_id: classId,
          data: record,
          is_draft: isDraft,
        }),
      });

      if (res.ok) {
        const { assessment } = await res.json();
        setAssessments((prev) => {
          const next = new Map(prev);
          next.set(selectedStudentId, assessment.data as AssessmentRecord);
          return next;
        });
        setAssessmentIds((prev) => {
          const next = new Map(prev);
          next.set(selectedStudentId, assessment.id);
          return next;
        });
        setDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silently fail for now
    }

    setSaving(false);
  }

  // ── Student Navigation ──

  function navigateStudent(direction: -1 | 1) {
    if (!selectedStudentId) return;
    const idx = students.findIndex((s) => s.id === selectedStudentId);
    const next = idx + direction;
    if (next >= 0 && next < students.length) {
      setSelectedStudentId(students[next].id);
    }
  }

  // ── Evidence Panel ──

  async function loadEvidence(pageId: string) {
    if (!selectedStudentId) return;
    setEvidencePageId(pageId);
    setEvidenceLoading(true);
    setEvidenceData(null);
    setEvidenceIntegrity(null);

    const progress = progressMap[selectedStudentId]?.[pageId];
    if (progress?.responses) {
      setEvidenceData(progress.responses as Record<string, string>);
    } else {
      setEvidenceData({});
    }
    // Load integrity metadata if available (migration 054)
    const integrityRaw = (progress as unknown as Record<string, unknown>)?.integrity_metadata;
    if (integrityRaw && typeof integrityRaw === "object") {
      setEvidenceIntegrity(integrityRaw as Record<string, IntegrityMetadata>);
    }
    setEvidenceLoading(false);
  }

  // ── Render ──

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </main>
    );
  }

  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  const selectedIdx = students.findIndex((s) => s.id === selectedStudentId);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
        <Link href="/teacher/dashboard" className="hover:text-text-primary transition">
          Dashboard
        </Link>
        <span>›</span>
        <Link
          href={`/teacher/classes/${classId}`}
          className="hover:text-text-primary transition"
        >
          {className}
        </Link>
        <span>›</span>
        <span className="text-text-primary">Grading</span>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-1">
        {unit?.title || "Unit Grading"}
      </h1>
      <p className="text-text-secondary text-sm mb-6">
        {students.length} students · {unitCriteria.length} criteria
      </p>

      {students.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-text-secondary">No students in this class yet.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* ── Student Sidebar ── */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-border overflow-hidden sticky top-20">
              <div className="px-3 py-2 border-b border-border">
                <h3 className="text-xs font-semibold text-text-secondary uppercase">
                  Students
                </h3>
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/50">
                {students.map((s) => {
                  const status = getStudentStatus(s.id);
                  const isSelected = s.id === selectedStudentId;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelectedStudentId(s.id)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2 transition ${
                        isSelected
                          ? "bg-accent-blue/5 border-l-2 border-accent-blue"
                          : "hover:bg-surface-alt border-l-2 border-transparent"
                      }`}
                    >
                      <span className="text-sm font-medium text-text-primary truncate flex-1 flex items-center gap-1.5">
                        {s.display_name || s.username}
                        {(() => {
                          const ylNum = getYearLevelNumber(s.graduation_year);
                          return ylNum ? (
                            <span className="text-[9px] font-bold text-indigo-400" title={`Year ${ylNum}`}>
                              {ylNum}
                            </span>
                          ) : null;
                        })()}
                      </span>
                      <StatusBadge status={status} />
                    </button>
                  );
                })}
              </div>
              {/* Prev/Next */}
              <div className="px-3 py-2 border-t border-border flex gap-2">
                <button
                  onClick={() => navigateStudent(-1)}
                  disabled={selectedIdx <= 0}
                  className="flex-1 py-1.5 text-xs font-medium rounded bg-surface-alt text-text-secondary hover:bg-gray-200 transition disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => navigateStudent(1)}
                  disabled={selectedIdx >= students.length - 1}
                  className="flex-1 py-1.5 text-xs font-medium rounded bg-surface-alt text-text-secondary hover:bg-gray-200 transition disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>

          {/* ── Main Grading Form ── */}
          <div className="flex-1 min-w-0 space-y-6">
            {selectedStudent ? (
              <>
                {/* Header */}
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-text-primary">
                    {selectedStudent.display_name || selectedStudent.username}
                  </h2>
                  {(() => {
                    const ylNum = getYearLevelNumber(selectedStudent.graduation_year);
                    return ylNum ? (
                      <span className="text-sm font-bold text-indigo-400" title={`Year ${ylNum}`}>
                        {ylNum}
                      </span>
                    ) : null;
                  })()}
                  <StatusBadge status={getStudentStatus(selectedStudent.id)} />
                </div>

                {/* Student Work Quick-View */}
                {unitPages.length > 0 && (
                  <div className="bg-white rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Student Work</h3>
                      {evidencePageId && (
                        <button onClick={() => setEvidencePageId(null)} className="text-xs text-accent-blue hover:underline">Close panel</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {unitPages.map((page) => {
                        const progress = progressMap[selectedStudent.id]?.[page.id];
                        const hasResponses = progress?.responses && typeof progress.responses === "object" && Object.keys(progress.responses as Record<string, unknown>).length > 0;
                        const rawP = progress as unknown as Record<string, unknown>;
                        const hasIntegrity: boolean = !!(rawP?.integrity_metadata && typeof rawP.integrity_metadata === "object" && Object.keys(rawP.integrity_metadata as Record<string, unknown>).length > 0);
                        const isActive = evidencePageId === page.id;
                        return (
                          <button
                            key={page.id}
                            onClick={() => loadEvidence(page.id)}
                            className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition border ${
                              isActive
                                ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                                : hasResponses
                                ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                                : "bg-gray-50 border-gray-200 text-gray-400"
                            }`}
                            title={`${page.title || page.id}${hasIntegrity ? " • Integrity data" : ""}`}
                          >
                            {page.title || page.id}
                            {hasIntegrity && (
                              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-1 ring-white" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {!evidencePageId && (
                      <p className="text-[11px] text-text-secondary mt-2">Click a lesson to view student responses and integrity data</p>
                    )}
                  </div>
                )}

                {/* Criterion Sections */}
                {unitCriteria.map((key) => (
                  <CriterionSection
                    key={key}
                    criterionKey={key}
                    score={getCriterionScore(key)}
                    scale={scale}
                    unitPages={
                      unit && isV3(unit.content_data)
                        ? unitPages.filter((p) =>
                            (p.content?.sections || []).some((s) =>
                              s.criterionTags?.includes(key)
                            )
                          )
                        : unitPages.filter((p) => p.criterion === key)
                    }
                    onChange={(updates) => updateCriterionScore(key, updates)}
                    onViewEvidence={loadEvidence}
                    setDirty={setDirty}
                    framework={classFramework}
                  />
                ))}

                {/* Overall Section */}
                <div className="bg-white rounded-xl border border-border p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Overall Assessment
                  </h3>

                  {/* Overall grade */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-2">
                      Overall Grade
                    </label>
                    <LevelPicker
                      scale={scale}
                      value={overallGrade}
                      onChange={(v) => {
                        setOverallGrade(v);
                        setDirty(true);
                      }}
                      accentColor="#1B3A5C"
                    />
                  </div>

                  {/* Teacher comments */}
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Comments
                    </label>
                    <textarea
                      value={teacherComments}
                      onChange={(e) => {
                        setTeacherComments(e.target.value);
                        setDirty(true);
                      }}
                      placeholder="Overall feedback for this student..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 resize-none"
                    />
                  </div>

                  {/* Strengths */}
                  <TextListEditor
                    label="Strengths"
                    items={strengths}
                    onChange={(items) => {
                      setStrengths(items);
                      setDirty(true);
                    }}
                    placeholder="e.g., Thorough research with multiple sources"
                    accentColor="#2DA05E"
                  />

                  {/* Areas for improvement */}
                  <TextListEditor
                    label="Areas for Improvement"
                    items={areasForImprovement}
                    onChange={(items) => {
                      setAreasForImprovement(items);
                      setDirty(true);
                    }}
                    placeholder="e.g., Test prototypes before evaluating"
                    accentColor="#E86F2C"
                  />
                </div>

                {/* Targets Section */}
                <TargetsSection
                  targets={targets}
                  onChange={(t) => {
                    setTargets(t);
                    setDirty(true);
                  }}
                  criteria={unitCriteria}
                  scale={scale}
                />

                {/* Moderation Section */}
                <ModerationSection
                  status={moderationStatus}
                  notes={moderationNotes}
                  onStatusChange={(s) => {
                    setModerationStatus(s);
                    setDirty(true);
                  }}
                  onNotesChange={(n) => {
                    setModerationNotes(n);
                    setDirty(true);
                  }}
                />

                {/* Save Bar */}
                <div className="sticky bottom-0 bg-white border-t border-border py-3 px-5 -mx-0 flex items-center justify-end gap-3 rounded-b-xl">
                  {saved && (
                    <span className="text-sm text-accent-green font-medium">
                      Saved!
                    </span>
                  )}
                  {dirty && (
                    <span className="text-xs text-amber-500">Unsaved changes</span>
                  )}
                  <button
                    onClick={() => saveAssessment(true)}
                    disabled={saving}
                    className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-alt transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button
                    onClick={() => saveAssessment(false)}
                    disabled={saving}
                    className="px-4 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-50"
                  >
                    {saving ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center text-text-secondary">
                Select a student to begin grading
              </div>
            )}
          </div>

          {/* ── Evidence Panel (slide-out) ── */}
          {evidencePageId && (
            <div className="w-96 shrink-0">
              <div className="bg-white rounded-xl border border-border sticky top-20 max-h-[80vh] overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Evidence: Page {evidencePageId}
                    </h3>
                    <p className="text-xs text-text-secondary">
                      {unitPages.find((p) => p.id === evidencePageId)?.title}
                    </p>
                  </div>
                  <button
                    onClick={() => setEvidencePageId(null)}
                    className="w-6 h-6 rounded-full hover:bg-surface-alt flex items-center justify-center text-text-secondary text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="px-4 py-3 overflow-y-auto flex-1">
                  {evidenceLoading ? (
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-16 bg-gray-200 rounded" />
                    </div>
                  ) : !evidenceData ||
                    Object.keys(evidenceData).length === 0 ? (
                    <p className="text-sm text-text-secondary text-center py-6">
                      No responses yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(evidenceData)
                        .filter(([key]) => !key.startsWith("_tracking_"))
                        .map(([key, value]) => {
                        let label = key;
                        if (key.startsWith("section_"))
                          label = `Response ${parseInt(key.replace("section_", "")) + 1}`;
                        else if (key.startsWith("activity_"))
                          label = `Response (${key.replace("activity_", "").slice(0, 6)})`;
                        else if (key.startsWith("reflection_"))
                          label = `Reflection ${parseInt(key.replace("reflection_", "")) + 1}`;
                        else if (key === "freeform") label = "Notes";

                        // Safety: skip non-string values (toolkit JSON, tracking objects)
                        const displayValue = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value).slice(0, 200) + "…" : String(value ?? "—");

                        return (
                          <div key={key}>
                            <p className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-0.5">
                              {label}
                            </p>
                            <div className="bg-surface-alt rounded-lg p-2.5">
                              <p className="text-sm text-text-primary whitespace-pre-wrap">
                                {displayValue === "true"
                                  ? "✓"
                                  : displayValue === "false"
                                  ? "☐"
                                  : displayValue || "—"}
                              </p>
                            </div>

                            {/* Show per-response integrity report if metadata exists for this key */}
                            {evidenceIntegrity?.[key] && (
                              <div className="mt-2 border-t border-gray-100 pt-2">
                                <IntegrityReport
                                  metadata={evidenceIntegrity[key]}
                                  responseText={typeof value === "string" ? value : undefined}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Aggregate integrity summary if any integrity data exists */}
                      {evidenceIntegrity && Object.keys(evidenceIntegrity).length > 0 && (
                        <div className="mt-4 pt-4 border-t-2 border-gray-200">
                          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">
                            Writing Integrity Summary
                          </p>
                          {Object.entries(evidenceIntegrity).map(([key, meta]) => {
                            const analysis = analyzeIntegrity(meta);
                            return (
                              <div key={`integrity-badge-${key}`} className="flex items-center gap-2 mb-1.5">
                                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${
                                  analysis.score >= 70 ? "bg-green-100 text-green-700" :
                                  analysis.score >= 40 ? "bg-amber-100 text-amber-700" :
                                  "bg-red-100 text-red-700"
                                }`}>
                                  {analysis.score}
                                </span>
                                <span className="text-xs text-gray-600">{key.replace("activity_", "").replace("section_", "Response ")}</span>
                                {analysis.flags.length > 0 && (
                                  <span className="text-xs text-red-500">{analysis.flags.length} flag{analysis.flags.length > 1 ? "s" : ""}</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
}: {
  status: "ungraded" | "draft" | "published";
}) {
  if (status === "published")
    return (
      <span className="px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green text-[10px] font-semibold">
        ✓ Graded
      </span>
    );
  if (status === "draft")
    return (
      <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold">
        Draft
      </span>
    );
  return null;
}

// ---------------------------------------------------------------------------
// Adaptive Level Picker
// ---------------------------------------------------------------------------

function LevelPicker({
  scale,
  value,
  onChange,
  accentColor,
  small,
}: {
  scale: GradingScale;
  value: number | undefined;
  onChange: (v: number) => void;
  accentColor: string;
  small?: boolean;
}) {
  const range = scale.max - scale.min + 1;

  // Small numeric range (≤10): button row
  if (scale.type === "numeric" && range <= 10) {
    return (
      <div className="flex gap-1.5">
        {Array.from({ length: range }, (_, i) => scale.min + i).map((v) => {
          const isSelected = v === value;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`rounded-full font-medium transition ${
                small ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
              }`}
              style={
                isSelected
                  ? { backgroundColor: accentColor, color: "white" }
                  : { backgroundColor: "#f3f4f6", color: "#6b7280" }
              }
            >
              {scale.displayAsLabel && scale.labels
                ? scale.labels[v - scale.min]
                : v}
            </button>
          );
        })}
        {value !== undefined && (
          <button
            onClick={() => onChange(0)}
            className={`rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 transition ${
              small ? "w-6 h-6 text-[10px]" : "w-8 h-8 text-xs"
            }`}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>
    );
  }

  // Letter grades: button row
  if (scale.type === "letter" && scale.labels) {
    return (
      <div className="flex gap-1.5">
        {scale.labels.map((label, i) => {
          const v = scale.min + i;
          const isSelected = v === value;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`rounded-lg font-semibold transition ${
                small ? "px-2 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
              }`}
              style={
                isSelected
                  ? { backgroundColor: accentColor, color: "white" }
                  : { backgroundColor: "#f3f4f6", color: "#6b7280" }
              }
            >
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  // Large numeric range (percentage, etc.): number input
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={scale.min}
        max={scale.max}
        step={scale.step}
        value={value ?? ""}
        onChange={(e) => {
          const v = parseInt(e.target.value);
          if (!isNaN(v) && v >= scale.min && v <= scale.max) onChange(v);
        }}
        placeholder={`${scale.min}–${scale.max}`}
        className={`border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/30 ${
          small ? "w-16 px-2 py-1 text-xs" : "w-20 px-3 py-1.5 text-sm"
        }`}
      />
      {value !== undefined && (
        <span className="text-sm text-text-secondary">
          {scale.formatDisplay(value)}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criterion Section
// ---------------------------------------------------------------------------

function CriterionSection({
  criterionKey,
  score,
  scale,
  unitPages,
  onChange,
  onViewEvidence,
  setDirty,
  framework,
}: {
  criterionKey: string;
  score: CriterionScore;
  scale: GradingScale;
  unitPages: UnitPage[];
  onChange: (updates: Partial<CriterionScore>) => void;
  onViewEvidence: (pageId: string) => void;
  setDirty: (v: boolean) => void;
  framework: string;
}) {
  const [showStrands, setShowStrands] = useState(false);
  // Resolve criterion display via FrameworkAdapter
  const criterion = (() => {
    const fwLabels = getCriterionLabels(
      (framework as FrameworkId | null | undefined) ?? "IB_MYP"
    );
    const match = fwLabels.find((l) => l.short === criterionKey);
    const color = getCriterionColor(
      criterionKey,
      (framework as FrameworkId | null | undefined) ?? "IB_MYP"
    );
    return match
      ? { key: criterionKey, name: match.name, color }
      : { key: criterionKey, name: criterionKey, color: "#6366F1" };
  })();
  const fwTags = getFrameworkTags(framework);
  const criterionTags = fwTags[criterionKey] || [];
  const allTags = [...criterionTags, ...UNIVERSAL_TAGS];

  return (
    <div className="bg-white rounded-xl border border-border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: criterion.color }}
        >
          {criterionKey}
        </span>
        <h3 className="text-sm font-semibold text-text-primary">
          {criterion.name}
        </h3>
        {score.level > 0 && (
          <span
            className="ml-auto text-sm font-bold"
            style={{ color: criterion.color }}
          >
            {scale.formatDisplay(score.level)}
          </span>
        )}
      </div>

      {/* Level Picker */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Level
        </label>
        <LevelPicker
          scale={scale}
          value={score.level > 0 ? score.level : undefined}
          onChange={(v) => onChange({ level: v })}
          accentColor={criterion.color}
        />
      </div>

      {/* Strand Scores (collapsible) */}
      {unitPages.length > 1 && (
        <div>
          <button
            onClick={() => setShowStrands(!showStrands)}
            className="text-xs text-accent-blue hover:underline flex items-center gap-1"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showStrands ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Strand scores ({unitPages.length})
          </button>
          {showStrands && (
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-border">
              {unitPages.map((page) => {
                const strandIdx = page.strandIndex || 0;
                const strandValue = score.strand_scores?.[strandIdx];
                return (
                  <div key={page.id} className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary w-24 truncate">
                      {page.id}: {page.title}
                    </span>
                    <LevelPicker
                      scale={scale}
                      value={strandValue}
                      onChange={(v) => {
                        const newStrands = { ...(score.strand_scores || {}) };
                        if (v === 0) delete newStrands[strandIdx];
                        else newStrands[strandIdx] = v;
                        onChange({ strand_scores: newStrands });
                      }}
                      accentColor={criterion.color}
                      small
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Comment */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">
          Comment
        </label>
        <textarea
          value={score.comment || ""}
          onChange={(e) => {
            onChange({ comment: e.target.value });
            setDirty(true);
          }}
          placeholder={`Comment on Criterion ${criterionKey}...`}
          rows={2}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 resize-none"
        />
      </div>

      {/* Evidence Links */}
      {unitPages.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">
            Evidence from
          </label>
          <div className="flex flex-wrap gap-1.5">
            {unitPages.map((page) => {
              const isLinked = score.evidence_page_ids?.includes(page.id);
              return (
                <div key={page.id} className="flex items-center gap-0.5">
                  <button
                    onClick={() => {
                      const current = score.evidence_page_ids || [];
                      const next = isLinked
                        ? current.filter((id) => id !== page.id)
                        : [...current, page.id];
                      onChange({ evidence_page_ids: next });
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition"
                    style={
                      isLinked
                        ? {
                            backgroundColor: criterion.color + "20",
                            color: criterion.color,
                          }
                        : { backgroundColor: "#f3f4f6", color: "#9ca3af" }
                    }
                  >
                    {page.id}
                  </button>
                  {isLinked && (
                    <button
                      onClick={() => onViewEvidence(page.id)}
                      className="text-[10px] text-accent-blue hover:underline"
                    >
                      View
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">
          Tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const isSelected = score.tags?.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => {
                  const current = score.tags || [];
                  const next = isSelected
                    ? current.filter((t) => t !== tag)
                    : [...current, tag];
                  onChange({ tags: next });
                }}
                className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition ${
                  isSelected
                    ? "bg-dark-blue text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                {TAG_LABELS[tag]}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text List Editor (strengths / areas for improvement)
// ---------------------------------------------------------------------------

function TextListEditor({
  label,
  items,
  onChange,
  placeholder,
  accentColor,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  accentColor: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1.5">
        {label}
      </label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
              className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue/30"
              placeholder={placeholder}
            />
            <button
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="text-xs text-text-secondary hover:text-red-500"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...items, ""])}
          className="text-xs text-accent-blue hover:underline"
        >
          + Add {label.toLowerCase().replace(/s$/, "")}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Targets Section
// ---------------------------------------------------------------------------

function TargetsSection({
  targets,
  onChange,
  criteria,
  scale,
}: {
  targets: AssessmentTarget[];
  onChange: (targets: AssessmentTarget[]) => void;
  criteria: CriterionKey[];
  scale: GradingScale;
}) {
  const [expanded, setExpanded] = useState(targets.length > 0);

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-alt/30 transition"
      >
        <h3 className="text-sm font-semibold text-text-primary">
          Targets {targets.length > 0 && `(${targets.length})`}
        </h3>
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          {targets.map((target, i) => (
            <div
              key={i}
              className="border border-border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <select
                  value={target.criterion_key}
                  onChange={(e) => {
                    const next = [...targets];
                    next[i] = { ...next[i], criterion_key: e.target.value };
                    onChange(next);
                  }}
                  className="px-2 py-1 text-xs border border-border rounded focus:outline-none"
                >
                  {criteria.map((k) => (
                    <option key={k} value={k}>
                      Criterion {k}
                    </option>
                  ))}
                </select>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer ${
                    target.status === "achieved"
                      ? "bg-accent-green/10 text-accent-green"
                      : target.status === "in_progress"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-text-secondary"
                  }`}
                  onClick={() => {
                    const cycle: AssessmentTarget["status"][] = [
                      "set",
                      "in_progress",
                      "achieved",
                    ];
                    const idx = cycle.indexOf(target.status);
                    const next = [...targets];
                    next[i] = {
                      ...next[i],
                      status: cycle[(idx + 1) % cycle.length],
                    };
                    onChange(next);
                  }}
                >
                  {target.status}
                </span>
                <button
                  onClick={() => onChange(targets.filter((_, j) => j !== i))}
                  className="ml-auto text-xs text-text-secondary hover:text-red-500"
                >
                  ✕
                </button>
              </div>
              <input
                value={target.target}
                onChange={(e) => {
                  const next = [...targets];
                  next[i] = { ...next[i], target: e.target.value };
                  onChange(next);
                }}
                placeholder="Describe the target..."
                className="w-full px-2 py-1.5 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue/30"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-secondary">
                  Target level:
                </span>
                <LevelPicker
                  scale={scale}
                  value={target.target_level}
                  onChange={(v) => {
                    const next = [...targets];
                    next[i] = { ...next[i], target_level: v };
                    onChange(next);
                  }}
                  accentColor="#1B3A5C"
                  small
                />
              </div>
            </div>
          ))}
          <button
            onClick={() =>
              onChange([
                ...targets,
                {
                  criterion_key: criteria[0] || "A",
                  target: "",
                  status: "set",
                  set_at: new Date().toISOString(),
                },
              ])
            }
            className="text-xs text-accent-blue hover:underline"
          >
            + Add target
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation Section
// ---------------------------------------------------------------------------

function ModerationSection({
  status,
  notes,
  onStatusChange,
  onNotesChange,
}: {
  status: "unmoderated" | "moderated" | "adjusted";
  notes: string;
  onStatusChange: (s: "unmoderated" | "moderated" | "adjusted") => void;
  onNotesChange: (n: string) => void;
}) {
  const [expanded, setExpanded] = useState(status !== "unmoderated");

  return (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-alt/30 transition"
      >
        <h3 className="text-sm font-semibold text-text-primary">Moderation</h3>
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3">
          <div className="flex gap-1.5">
            {(
              ["unmoderated", "moderated", "adjusted"] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(s)}
                className={`px-3 py-1 text-xs rounded-lg font-medium transition ${
                  status === s
                    ? "bg-dark-blue text-white"
                    : "bg-gray-100 text-text-secondary hover:bg-gray-200"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {status !== "unmoderated" && (
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Moderation notes..."
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 resize-none"
            />
          )}
        </div>
      )}
    </div>
  );
}
