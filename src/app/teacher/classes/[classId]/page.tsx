"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ELL_LEVELS } from "@/lib/constants";
import type { Class, Student, Unit, ClassUnit } from "@/types";
import type { EllLevel } from "@/lib/constants";

// Avatar gradient helper — deterministic by name hash
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #667eea, #764ba2)",
  "linear-gradient(135deg, #f093fb, #f5576c)",
  "linear-gradient(135deg, #4facfe, #00f2fe)",
  "linear-gradient(135deg, #43e97b, #38f9d7)",
  "linear-gradient(135deg, #fa709a, #fee140)",
  "linear-gradient(135deg, #a18cd1, #fbc2eb)",
  "linear-gradient(135deg, #fccb90, #d57eeb)",
  "linear-gradient(135deg, #e0c3fc, #8ec5fc)",
];
function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// Year level ↔ graduation year conversion
// Assumes a student in Year N finishes secondary school at Year 12/13 (depends on system).
// For simplicity, we use Year 13 as the final year (IB MYP/DP system, also works for AU Year 12).
// The "current academic year" is derived from today's date — after July we're in the next academic year.
const FINAL_YEAR = 13; // MYP/DP: Year 13 is final. AU: Year 12. We use 13 for IB schools.
const YEAR_LEVELS = [6, 7, 8, 9, 10, 11, 12, 13]; // MYP starts at Year 6

function currentAcademicEndYear(): number {
  const now = new Date();
  // If we're past July, the current academic year ends next calendar year
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

function yearLevelToGradYear(yearLevel: number): number {
  const endYear = currentAcademicEndYear();
  return endYear + (FINAL_YEAR - yearLevel);
}

function gradYearToYearLevel(gradYear: number): number | null {
  const endYear = currentAcademicEndYear();
  const level = FINAL_YEAR - (gradYear - endYear);
  if (level < 1 || level > FINAL_YEAR) return null;
  return level;
}

const ELL_COLORS: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: "#DBEAFE", color: "#1E40AF", label: "ELL 1 — Entering" },
  2: { bg: "#FEF3C7", color: "#92400E", label: "ELL 2 — Developing" },
  3: { bg: "#D1FAE5", color: "#065F46", label: "ELL 3 — Bridging" },
};

interface StudentProgress {
  student_id: string;
  completed_pages: number;
  total_pages: number;
}

interface StudioStatus {
  student_id: string;
  status: string;
}

interface BadgeEarned {
  student_id: string;
  badge_id: string;
}

interface LMSClassOption {
  id: string;
  name: string;
}

interface SyncResult {
  created: number;
  updated: number;
  unchanged: number;
  total: number;
}

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = use(params);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [classUnits, setClassUnits] = useState<ClassUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newYearLevel, setNewYearLevel] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "single" | "bulk">("existing");
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState<{ added: number; skipped: string[] } | null>(null);
  const [rosterStudents, setRosterStudents] = useState<Array<{ id: string; username: string; display_name: string | null; graduation_year: number | null; last_class_name: string | null; last_class_id: string | null }>>([]);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterGradFilter, setRosterGradFilter] = useState<string>("all"); // "all" or graduation year string
  const [rosterGroupBy, setRosterGroupBy] = useState<"class" | "year" | "none">("class");
  const [enrollingIds, setEnrollingIds] = useState<Set<string>>(new Set());

  // Cohort / term state
  const [terms, setTerms] = useState<Array<{ id: string; academic_year: string; term_name: string; term_order: number; start_date: string | null; end_date: string | null }>>([]);
  const [currentTermId, setCurrentTermId] = useState<string | null>(null); // active term for this class's enrollments
  const [showNewCohort, setShowNewCohort] = useState(false);
  const [newCohortTermId, setNewCohortTermId] = useState("");
  const [newTermName, setNewTermName] = useState("");
  const [newTermYear, setNewTermYear] = useState(new Date().getFullYear().toString());
  const [showCreateTerm, setShowCreateTerm] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [pastCohorts, setPastCohorts] = useState<Array<{ term_id: string | null; term_name: string; academic_year: string; students: Array<{ id: string; username: string; display_name: string | null; enrolled_at: string; unenrolled_at: string | null }> }>>([]);
  const [showPastCohorts, setShowPastCohorts] = useState(false);

  // Student enrichment data
  const [studioMap, setStudioMap] = useState<Map<string, string>>(new Map());
  const [badgeMap, setBadgeMap] = useState<Map<string, number>>(new Map());
  const [progressMap, setProgressMap] = useState<Map<string, { completed: number; total: number }>>(new Map());
  const [studentSearch, setStudentSearch] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // LMS sync state
  const [hasIntegration, setHasIntegration] = useState(false);
  const [lmsClasses, setLmsClasses] = useState<LMSClassOption[]>([]);
  const [selectedLmsClass, setSelectedLmsClass] = useState("");
  const [loadingLmsClasses, setLoadingLmsClasses] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState("");

  useEffect(() => {
    loadData();
    checkIntegration();
    loadTermsAndCohorts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function loadData() {
    const supabase = createClient();

    const [classRes, studentsRes, unitsRes, classUnitsRes] = await Promise.all([
      supabase.from("classes").select("*").eq("id", classId).single(),
      // Fetch students via class_students junction (migration 041), with legacy fallback
      supabase.from("class_students").select("student_id, ell_level_override, students(*)").eq("class_id", classId).eq("is_active", true),
      supabase.from("units").select("*").order("title"),
      supabase.from("class_units").select("*").eq("class_id", classId),
    ]);

    // Map junction results to Student[] (with ELL override)
    let studentList: Student[] = [];
    if (studentsRes.data && studentsRes.data.length > 0) {
      studentList = studentsRes.data
        .filter((row: any) => row.students)
        .map((row: any) => {
          const s = row.students as Student;
          if (row.ell_level_override != null) s.ell_level = row.ell_level_override;
          return s;
        });
    }
    // Legacy fallback: if junction returned nothing, try old class_id query
    if (studentList.length === 0 && !studentsRes.error) {
      const supabase2 = createClient();
      const { data: legacyStudents } = await supabase2.from("students").select("*").eq("class_id", classId).order("username");
      if (legacyStudents && legacyStudents.length > 0) studentList = legacyStudents as Student[];
    }
    setClassInfo(classRes.data);
    setStudents(studentList);
    setAllUnits(unitsRes.data || []);
    setClassUnits(classUnitsRes.data || []);

    // Fetch enrichment data for all students in this class
    if (studentList.length > 0) {
      const studentIds = studentList.map((s) => s.id);
      const [studioRes, badgeRes, progressRes] = await Promise.all([
        supabase.from("open_studio_status").select("student_id, status").in("student_id", studentIds).eq("status", "unlocked"),
        supabase.from("student_badges").select("student_id, badge_id").in("student_id", studentIds).eq("status", "earned"),
        supabase.from("student_progress").select("student_id, completed_pages, total_pages").in("student_id", studentIds),
      ]);

      // Build studio map
      const sm = new Map<string, string>();
      for (const s of (studioRes.data || []) as StudioStatus[]) {
        sm.set(s.student_id, s.status);
      }
      setStudioMap(sm);

      // Build badge count map
      const bm = new Map<string, number>();
      for (const b of (badgeRes.data || []) as BadgeEarned[]) {
        bm.set(b.student_id, (bm.get(b.student_id) || 0) + 1);
      }
      setBadgeMap(bm);

      // Build progress map (aggregate across all units)
      const pm = new Map<string, { completed: number; total: number }>();
      for (const p of (progressRes.data || []) as StudentProgress[]) {
        const existing = pm.get(p.student_id) || { completed: 0, total: 0 };
        existing.completed += p.completed_pages || 0;
        existing.total += p.total_pages || 0;
        pm.set(p.student_id, existing);
      }
      setProgressMap(pm);
    }

    setLoading(false);
  }

  async function addStudent() {
    if (!newUsername.trim()) return;
    setAdding(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setAdding(false); return; }

    // Check if student already exists for this teacher
    const { data: existing } = await supabase
      .from("students")
      .select("id")
      .eq("author_teacher_id", user.id)
      .eq("username", newUsername.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      // Student exists — just enroll in this class
      await supabase.from("class_students").upsert({
        student_id: existing.id,
        class_id: classId,
        is_active: true,
        enrolled_at: new Date().toISOString(),
        unenrolled_at: null,
        term_id: currentTermId,
      }, { onConflict: "student_id,class_id" });
      // Update legacy class_id
      await supabase.from("students").update({ class_id: classId }).eq("id", existing.id);
    } else {
      // Create new student + enroll
      const { data: student, error } = await supabase.from("students").insert({
        username: newUsername.trim().toLowerCase(),
        display_name: newDisplayName.trim() || null,
        graduation_year: newYearLevel ? yearLevelToGradYear(Number(newYearLevel)) : null,
        class_id: classId,
        author_teacher_id: user.id,
      }).select().single();

      if (error || !student) { setAdding(false); return; }

      // Create enrollment
      await supabase.from("class_students").insert({
        student_id: student.id,
        class_id: classId,
        is_active: true,
        term_id: currentTermId,
      });
    }

    setNewUsername("");
    setNewDisplayName("");
    setShowAddStudent(false);
    loadData();
    setAdding(false);
  }

  async function addStudentsBulk() {
    if (!bulkText.trim()) return;
    setAdding(true);
    setBulkResult(null);

    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const { data: { user } } = await createClient().auth.getUser();
    const teacherId = user?.id;
    const existingUsernames = new Set(students.map((s) => s.username.toLowerCase()));
    const skipped: string[] = [];
    const toInsert: { username: string; display_name: string | null; class_id: string; author_teacher_id: string | null }[] = [];

    for (const line of lines) {
      // Support formats:
      // "username, Display Name"
      // "username\tDisplay Name"
      // "Display Name" (auto-generate username)
      // "username"
      let username: string;
      let displayName: string | null = null;

      // Check for comma or tab separator
      const separatorMatch = line.match(/^([^,\t]+)[,\t]\s*(.+)$/);
      if (separatorMatch) {
        username = separatorMatch[1].trim().toLowerCase().replace(/\s+/g, "");
        displayName = separatorMatch[2].trim();
      } else if (line.includes(" ")) {
        // "John Smith" → username "jsmith", display name "John Smith"
        displayName = line;
        const parts = line.toLowerCase().split(/\s+/);
        username = parts.length >= 2
          ? parts[0][0] + parts[parts.length - 1]
          : parts[0];
        username = username.replace(/[^a-z0-9]/g, "");
      } else {
        username = line.toLowerCase().replace(/[^a-z0-9._-]/g, "");
      }

      if (!username) {
        skipped.push(line);
        continue;
      }

      // Check for duplicates (existing + within this batch)
      if (existingUsernames.has(username) || toInsert.some((s) => s.username === username)) {
        skipped.push(`${line} (duplicate: ${username})`);
        continue;
      }

      toInsert.push({
        username,
        display_name: displayName || null,
        class_id: classId,
        author_teacher_id: teacherId || null,
      });
    }

    if (toInsert.length > 0) {
      const supabase = createClient();
      const { data: inserted, error } = await supabase.from("students").insert(toInsert).select("id");
      if (error) {
        setBulkResult({ added: 0, skipped: [`Database error: ${error.message}`] });
        setAdding(false);
        return;
      }
      // Create enrollments for all newly inserted students
      if (inserted && inserted.length > 0) {
        await supabase.from("class_students").insert(
          inserted.map((s: { id: string }) => ({
            student_id: s.id,
            class_id: classId,
            is_active: true,
          }))
        );
      }
    }

    setBulkResult({ added: toInsert.length, skipped });

    if (toInsert.length > 0) {
      loadData();
    }

    if (skipped.length === 0 && toInsert.length > 0) {
      setBulkText("");
      // Auto-close after a short delay on full success
      setTimeout(() => {
        setShowAddStudent(false);
        setBulkResult(null);
        setAddMode("single");
      }, 1500);
    }

    setAdding(false);
  }

  async function updateEllLevel(studentId: string, level: EllLevel) {
    const supabase = createClient();
    await supabase
      .from("students")
      .update({ ell_level: level })
      .eq("id", studentId);

    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, ell_level: level } : s))
    );
  }

  async function toggleUnit(unitId: string, isActive: boolean) {
    const supabase = createClient();
    const existing = classUnits.find((cu) => cu.unit_id === unitId);

    // Optimistic update for instant feedback
    setClassUnits((prev) => {
      const idx = prev.findIndex((cu) => cu.unit_id === unitId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], is_active: isActive };
        return updated;
      }
      // Add a new entry optimistically
      return [...prev, { class_id: classId, unit_id: unitId, is_active: isActive } as ClassUnit];
    });

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("class_units")
        .update({ is_active: isActive })
        .eq("class_id", classId)
        .eq("unit_id", unitId));
    } else {
      ({ error } = await supabase.from("class_units").insert({
        class_id: classId,
        unit_id: unitId,
        is_active: isActive,
      }));
    }

    if (error) {
      console.error("toggleUnit error:", error);
      // Revert optimistic update on failure
      loadData();
    }
  }

  async function removeStudent(studentId: string) {
    const supabase = createClient();
    // Soft unenroll — student persists in teacher roster
    await supabase
      .from("class_students")
      .update({ is_active: false, unenrolled_at: new Date().toISOString() })
      .eq("student_id", studentId)
      .eq("class_id", classId);
    // Update legacy class_id to next active enrollment (or null)
    const { data: activeEnrollments } = await supabase
      .from("class_students")
      .select("class_id")
      .eq("student_id", studentId)
      .eq("is_active", true)
      .limit(1);
    await supabase
      .from("students")
      .update({ class_id: activeEnrollments?.[0]?.class_id || null })
      .eq("id", studentId);
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    setRemovingId(null);
  }

  async function loadRosterStudents() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch all students owned by this teacher
    const { data: allStudents } = await supabase
      .from("students")
      .select("id, username, display_name, graduation_year")
      .eq("author_teacher_id", user.id)
      .order("display_name");

    if (!allStudents || allStudents.length === 0) {
      setRosterStudents([]);
      return;
    }

    // Fetch most recent active enrollment per student to get "last class" info
    // Using class_students join with classes to get class name
    const studentIds = allStudents.map(s => s.id);
    const { data: enrollments } = await supabase
      .from("class_students")
      .select("student_id, class_id, enrolled_at, classes(name)")
      .in("student_id", studentIds)
      .eq("is_active", true)
      .order("enrolled_at", { ascending: false });

    // Build map: student_id → most recent class info (first enrollment per student since ordered desc)
    const lastClassMap = new Map<string, { name: string; id: string }>();
    if (enrollments) {
      for (const e of (enrollments as unknown as Array<{ student_id: string; class_id: string; classes: { name: string } | null }>)) {
        if (!lastClassMap.has(e.student_id) && e.classes) {
          lastClassMap.set(e.student_id, { name: e.classes.name, id: e.class_id });
        }
      }
    }

    setRosterStudents(allStudents.map(s => ({
      ...s,
      last_class_name: lastClassMap.get(s.id)?.name || null,
      last_class_id: lastClassMap.get(s.id)?.id || null,
    })));
  }

  async function enrollExisting(sid: string) {
    setEnrollingIds((prev) => new Set(prev).add(sid));
    const supabase = createClient();
    await supabase.from("class_students").upsert({
      student_id: sid,
      class_id: classId,
      is_active: true,
      enrolled_at: new Date().toISOString(),
      unenrolled_at: null,
      term_id: currentTermId,
    }, { onConflict: "student_id,class_id" });
    await supabase.from("students").update({ class_id: classId }).eq("id", sid);
    setEnrollingIds((prev) => { const n = new Set(prev); n.delete(sid); return n; });
    loadData();
  }

  async function loadTermsAndCohorts() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Load all terms for this teacher
    const { data: termsData } = await supabase
      .from("school_calendar_terms")
      .select("*")
      .eq("teacher_id", user.id)
      .order("academic_year", { ascending: false })
      .order("term_order");
    setTerms(termsData || []);

    // Find current term: the term_id of active enrollments in this class
    const { data: activeEnrollment } = await supabase
      .from("class_students")
      .select("term_id")
      .eq("class_id", classId)
      .eq("is_active", true)
      .not("term_id", "is", null)
      .limit(1);
    setCurrentTermId(activeEnrollment?.[0]?.term_id || null);

    // Load past cohorts: inactive enrollments grouped by term
    const { data: pastEnrollments } = await supabase
      .from("class_students")
      .select("term_id, enrolled_at, unenrolled_at, students(id, username, display_name)")
      .eq("class_id", classId)
      .eq("is_active", false)
      .order("unenrolled_at", { ascending: false });

    if (pastEnrollments && pastEnrollments.length > 0) {
      // Group by term_id
      const groupMap = new Map<string, typeof pastCohorts[0]>();
      for (const row of pastEnrollments as any[]) {
        const tid = row.term_id || "no-term";
        if (!groupMap.has(tid)) {
          // Find term name
          const term = (termsData || []).find((t: any) => t.id === row.term_id);
          groupMap.set(tid, {
            term_id: row.term_id,
            term_name: term?.term_name || "Untagged",
            academic_year: term?.academic_year || "",
            students: [],
          });
        }
        const group = groupMap.get(tid)!;
        if (row.students) {
          group.students.push({
            ...(row.students as any),
            enrolled_at: row.enrolled_at,
            unenrolled_at: row.unenrolled_at,
          });
        }
      }
      setPastCohorts(Array.from(groupMap.values()));
    } else {
      setPastCohorts([]);
    }
  }

  async function createTermAndReturn(): Promise<string | null> {
    if (!newTermName.trim() || !newTermYear.trim()) return null;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: term, error } = await supabase
      .from("school_calendar_terms")
      .insert({
        teacher_id: user.id,
        academic_year: newTermYear.trim(),
        term_name: newTermName.trim(),
        term_order: terms.length + 1,
      })
      .select()
      .single();

    if (error || !term) return null;
    setTerms((prev) => [term, ...prev]);
    setNewTermName("");
    setShowCreateTerm(false);
    return term.id;
  }

  async function rotateCohort() {
    let termId = newCohortTermId;

    // If creating a new term inline, do that first
    if (showCreateTerm) {
      const created = await createTermAndReturn();
      if (!created) return;
      termId = created;
    }

    if (!termId) return;
    setRotating(true);

    const supabase = createClient();

    // 1. Tag all current active enrollments with the current term (if they don't have one)
    if (currentTermId) {
      // Already tagged — skip
    } else {
      // Find which term the old cohort belonged to, or leave as-is
    }

    // 2. Unenroll ALL active students from this class
    await supabase
      .from("class_students")
      .update({ is_active: false, unenrolled_at: new Date().toISOString() })
      .eq("class_id", classId)
      .eq("is_active", true);

    // 3. Update legacy class_id to null for those students
    const currentStudentIds = students.map((s) => s.id);
    if (currentStudentIds.length > 0) {
      // For each, set class_id to their next active enrollment or null
      for (const sid of currentStudentIds) {
        const { data: otherActive } = await supabase
          .from("class_students")
          .select("class_id")
          .eq("student_id", sid)
          .eq("is_active", true)
          .neq("class_id", classId)
          .limit(1);
        await supabase
          .from("students")
          .update({ class_id: otherActive?.[0]?.class_id || null })
          .eq("id", sid);
      }
    }

    // 4. Set the new term as current
    setCurrentTermId(termId);
    setNewCohortTermId("");
    setShowNewCohort(false);
    setRotating(false);

    // Refresh everything
    loadData();
    loadTermsAndCohorts();

    // Open the Add Student modal so teacher can add the new batch
    setTimeout(() => {
      setShowAddStudent(true);
      setAddMode("existing");
      loadRosterStudents();
    }, 300);
  }

  // Set term_id on new enrollments
  async function enrollExistingWithTerm(sid: string) {
    setEnrollingIds((prev) => new Set(prev).add(sid));
    const supabase = createClient();
    await supabase.from("class_students").upsert({
      student_id: sid,
      class_id: classId,
      is_active: true,
      enrolled_at: new Date().toISOString(),
      unenrolled_at: null,
      term_id: currentTermId,
    }, { onConflict: "student_id,class_id" });
    await supabase.from("students").update({ class_id: classId }).eq("id", sid);
    setEnrollingIds((prev) => { const n = new Set(prev); n.delete(sid); return n; });
    loadData();
  }

  async function checkIntegration() {
    try {
      const res = await fetch("/api/teacher/integrations");
      const data = await res.json();
      setHasIntegration(!!data.integration?.has_api_token);
    } catch {
      // Integration not configured — that's fine
    }
  }

  async function loadLmsClasses() {
    setLoadingLmsClasses(true);
    setSyncError("");
    try {
      const res = await fetch("/api/teacher/integrations/classes");
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || "Failed to load LMS classes");
        return;
      }
      setLmsClasses(data.classes || []);
    } catch {
      setSyncError("Network error loading LMS classes");
    } finally {
      setLoadingLmsClasses(false);
    }
  }

  async function syncStudents(overrideClassId?: string) {
    const lmsClassId = overrideClassId || selectedLmsClass;
    if (!lmsClassId) return;
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);

    try {
      const res = await fetch("/api/teacher/integrations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId,
          externalClassId: lmsClassId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setSyncError(data.error || "Sync failed");
        return;
      }

      setSyncResult(data.summary);
      loadData(); // Refresh student list
    } catch {
      setSyncError("Network error during sync");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse h-8 w-48 bg-gray-200 rounded mb-8" />
      </main>
    );
  }

  // Filtered students
  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.trim().toLowerCase();
    return (
      s.username.toLowerCase().includes(q) ||
      (s.display_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-2">
        <Link
          href="/teacher/classes"
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          &larr; All Classes
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900">
            {classInfo?.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-sm">Class Code:</span>
            <span className="font-mono font-semibold text-sm px-2.5 py-0.5 rounded-lg" style={{ background: "#DBEAFE", color: "#1E40AF" }}>
              {classInfo?.code}
            </span>
          </div>
        </div>
      </div>

      {/* Cohort / Term Banner */}
      <section className="mb-6 bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#F3E8FF" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {currentTermId
                    ? (() => { const t = terms.find((t) => t.id === currentTermId); return t ? `${t.term_name} ${t.academic_year}` : "Current Cohort"; })()
                    : "No term set"}
                </span>
                {students.length > 0 && (
                  <span className="text-xs text-gray-400">{students.length} student{students.length !== 1 ? "s" : ""}</span>
                )}
              </div>
              {!currentTermId && terms.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">Assign a term to track cohort history</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Term selector if no term set yet */}
            {!currentTermId && terms.length > 0 && (
              <select
                onChange={async (e) => {
                  const tid = e.target.value;
                  if (!tid) return;
                  setCurrentTermId(tid);
                  // Update all active enrollments with this term
                  const supabase = createClient();
                  await supabase
                    .from("class_students")
                    .update({ term_id: tid })
                    .eq("class_id", classId)
                    .eq("is_active", true);
                }}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                defaultValue=""
              >
                <option value="">Set term...</option>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.term_name} {t.academic_year}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowNewCohort(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition border border-purple-200 text-purple-600 hover:bg-purple-50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 11-6.219-8.56"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              New Semester
            </button>
          </div>
        </div>
      </section>

      {/* New Cohort Modal */}
      {showNewCohort && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewCohort(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Start New Semester</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will unenroll all {students.length} current student{students.length !== 1 ? "s" : ""} (their data is preserved) and let you add the next cohort.
            </p>

            {!showCreateTerm ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Select term for the new cohort</label>
                  <select
                    value={newCohortTermId}
                    onChange={(e) => setNewCohortTermId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-400"
                  >
                    <option value="">Choose a term...</option>
                    {terms.map((t) => (
                      <option key={t.id} value={t.id}>{t.term_name} {t.academic_year}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setShowCreateTerm(true)}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  + Create a new term
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-purple-50 rounded-xl p-4">
                <p className="text-xs font-bold text-purple-700">New Term</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Name</label>
                    <input
                      type="text"
                      value={newTermName}
                      onChange={(e) => setNewTermName(e.target.value)}
                      placeholder="e.g. Semester 2"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Year</label>
                    <input
                      type="text"
                      value={newTermYear}
                      onChange={(e) => setNewTermYear(e.target.value)}
                      placeholder="2026"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                    />
                  </div>
                </div>
                <button
                  onClick={() => { setShowCreateTerm(false); setNewTermName(""); }}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  ← Pick existing term instead
                </button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setShowNewCohort(false); setShowCreateTerm(false); setNewCohortTermId(""); }} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition">Cancel</button>
              <button
                disabled={rotating || (!newCohortTermId && !showCreateTerm) || (showCreateTerm && !newTermName.trim())}
                onClick={rotateCohort}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                {rotating ? "Rotating..." : `Unenroll ${students.length} & Start Fresh`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past Cohorts */}
      {pastCohorts.length > 0 && (
        <section className="mb-6">
          <button
            onClick={() => setShowPastCohorts(!showPastCohorts)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition mb-3"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${showPastCohorts ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            Past Cohorts
            <span className="text-xs font-normal text-gray-400">({pastCohorts.length} semester{pastCohorts.length !== 1 ? "s" : ""})</span>
          </button>

          {showPastCohorts && (
            <div className="space-y-3">
              {pastCohorts.map((cohort, idx) => (
                <div key={cohort.term_id || idx} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-700">{cohort.term_name}</span>
                      {cohort.academic_year && <span className="text-xs text-gray-400">{cohort.academic_year}</span>}
                    </div>
                    <span className="text-xs text-gray-400">{cohort.students.length} student{cohort.students.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="px-5 py-2">
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {cohort.students.map((s) => (
                        <Link
                          key={s.id}
                          href={`/teacher/students/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-purple-300 hover:text-purple-600 transition"
                        >
                          {s.display_name || s.username}
                        </Link>
                      ))}
                    </div>
                    {cohort.students[0]?.enrolled_at && (
                      <p className="text-[10px] text-gray-400 mt-1 pb-1">
                        {new Date(cohort.students[0].enrolled_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                        {cohort.students[0].unenrolled_at && ` — ${new Date(cohort.students[0].unenrolled_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* LMS Sync Section */}
      {hasIntegration && (
        <section className="mb-6 bg-white rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-blue">
                <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
              </svg>
              <h3 className="text-sm font-semibold text-text-primary">LMS Sync</h3>
            </div>
            {classInfo?.last_synced_at && (
              <span className="text-xs text-text-secondary">
                Last synced: {new Date(classInfo.last_synced_at).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {lmsClasses.length === 0 ? (
              <button
                onClick={loadLmsClasses}
                disabled={loadingLmsClasses}
                className="px-3 py-1.5 text-sm bg-accent-blue/10 text-accent-blue rounded-lg hover:bg-accent-blue/20 transition disabled:opacity-50"
              >
                {loadingLmsClasses ? "Loading..." : classInfo?.external_class_id ? "Change LMS Class" : "Link LMS Class"}
              </button>
            ) : (
              <>
                <select
                  value={selectedLmsClass}
                  onChange={(e) => setSelectedLmsClass(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue"
                >
                  <option value="">Select LMS class...</option>
                  {lmsClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => syncStudents()}
                  disabled={!selectedLmsClass || syncing}
                  className="px-3 py-1.5 text-sm bg-accent-green text-white rounded-lg hover:bg-accent-green/90 transition disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Sync Students"}
                </button>
              </>
            )}

            {classInfo?.external_class_id && lmsClasses.length === 0 && (
              <button
                onClick={() => syncStudents(classInfo.external_class_id!)}
                disabled={syncing}
                className="px-3 py-1.5 text-sm bg-accent-green text-white rounded-lg hover:bg-accent-green/90 transition disabled:opacity-50"
                title="Re-sync with previously linked class"
              >
                {syncing ? "Syncing..." : "Re-sync"}
              </button>
            )}
          </div>

          {syncError && (
            <p className="text-xs text-red-500 mt-2">{syncError}</p>
          )}

          {syncResult && (
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span className="text-accent-green font-medium">{syncResult.created} created</span>
              <span className="text-accent-blue font-medium">{syncResult.updated} updated</span>
              <span className="text-text-secondary">{syncResult.unchanged} unchanged</span>
              <span className="text-text-secondary">({syncResult.total} total)</span>
            </div>
          )}
        </section>
      )}

      {/* Students Section */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Students
            <span className="text-sm font-normal text-gray-400">({students.length})</span>
          </h2>
          <button
            onClick={() => { setShowAddStudent(true); setAddMode("existing"); loadRosterStudents(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm hover:opacity-90 transition"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
            Add Student
          </button>
        </div>

        {/* Search bar for students */}
        {students.length > 3 && (
          <div className="mb-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent bg-white"
              />
            </div>
          </div>
        )}

        {showAddStudent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold mb-4">Add Students</h3>

              {/* Mode tabs */}
              <div className="flex gap-1 bg-surface-alt rounded-lg p-1 mb-4">
                <button
                  onClick={() => { setAddMode("existing"); setBulkResult(null); loadRosterStudents(); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    addMode === "existing"
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Existing
                </button>
                <button
                  onClick={() => { setAddMode("single"); setBulkResult(null); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    addMode === "single"
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  New
                </button>
                <button
                  onClick={() => { setAddMode("bulk"); setBulkResult(null); }}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition ${
                    addMode === "bulk"
                      ? "bg-white text-text-primary shadow-sm"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  Bulk
                </button>
              </div>

              {addMode === "existing" ? (
                <>
                  {/* Search + filters */}
                  <div className="space-y-2 mb-3">
                    <input
                      type="text"
                      value={rosterSearch}
                      onChange={(e) => setRosterSearch(e.target.value)}
                      placeholder="Search by name or username..."
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-transparent"
                      autoFocus
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Graduation year filter */}
                      {(() => {
                        const gradYears = [...new Set(rosterStudents.map(s => s.graduation_year).filter((y): y is number => y != null))].sort();
                        if (gradYears.length === 0) return null;
                        // Convert to year levels for display
                        const yearOptions = gradYears.map(gy => ({ gradYear: gy, level: gradYearToYearLevel(gy) })).filter(o => o.level != null);
                        if (yearOptions.length === 0) return null;
                        return (
                          <select
                            value={rosterGradFilter}
                            onChange={(e) => setRosterGradFilter(e.target.value)}
                            className="px-2.5 py-1.5 border border-border rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300"
                          >
                            <option value="all">All year levels</option>
                            {yearOptions.map(o => (
                              <option key={o.gradYear} value={String(o.gradYear)}>Year {o.level}</option>
                            ))}
                            <option value="unset">No year set</option>
                          </select>
                        );
                      })()}
                      {/* Group by toggle */}
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 text-xs">
                        <button
                          onClick={() => setRosterGroupBy("class")}
                          className={`px-2.5 py-1 rounded-md transition ${rosterGroupBy === "class" ? "bg-white shadow-sm text-text-primary font-medium" : "text-text-tertiary"}`}
                        >
                          By class
                        </button>
                        <button
                          onClick={() => setRosterGroupBy("year")}
                          className={`px-2.5 py-1 rounded-md transition ${rosterGroupBy === "year" ? "bg-white shadow-sm text-text-primary font-medium" : "text-text-tertiary"}`}
                        >
                          By year
                        </button>
                        <button
                          onClick={() => setRosterGroupBy("none")}
                          className={`px-2.5 py-1 rounded-md transition ${rosterGroupBy === "none" ? "bg-white shadow-sm text-text-primary font-medium" : "text-text-tertiary"}`}
                        >
                          All
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Student list — grouped */}
                  <div className="max-h-72 overflow-y-auto">
                    {(() => {
                      const currentIds = new Set(students.map((s) => s.id));
                      const q = rosterSearch.toLowerCase();

                      // Apply filters
                      let filtered = rosterStudents.filter((s) => {
                        if (currentIds.has(s.id)) return false;
                        if (q && !s.username.toLowerCase().includes(q) && !(s.display_name || "").toLowerCase().includes(q)) return false;
                        if (rosterGradFilter === "unset") return s.graduation_year == null;
                        if (rosterGradFilter !== "all") return s.graduation_year === Number(rosterGradFilter);
                        return true;
                      });

                      if (filtered.length === 0) {
                        return (
                          <p className="text-sm text-gray-500 text-center py-4">
                            {rosterStudents.length === 0 ? "No students in your roster yet." : "No matching students found."}
                          </p>
                        );
                      }

                      // Group students
                      const groups = new Map<string, typeof filtered>();
                      if (rosterGroupBy === "class") {
                        for (const s of filtered) {
                          const key = s.last_class_name || "No class";
                          if (!groups.has(key)) groups.set(key, []);
                          groups.get(key)!.push(s);
                        }
                      } else if (rosterGroupBy === "year") {
                        for (const s of filtered) {
                          const level = s.graduation_year ? gradYearToYearLevel(s.graduation_year) : null;
                          const key = level ? `Year ${level}` : "No year set";
                          if (!groups.has(key)) groups.set(key, []);
                          groups.get(key)!.push(s);
                        }
                      } else {
                        groups.set("", filtered);
                      }

                      // Render function for a student row
                      const renderStudent = (s: typeof filtered[0]) => (
                        <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition group">
                          <div className="min-w-0 flex-1">
                            <span className="text-sm font-medium text-gray-900">{s.display_name || s.username}</span>
                            {s.display_name && <span className="text-xs text-gray-400 ml-1.5">@{s.username}</span>}
                            {rosterGroupBy !== "year" && s.graduation_year && gradYearToYearLevel(s.graduation_year) && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">Yr {gradYearToYearLevel(s.graduation_year)}</span>
                            )}
                            {rosterGroupBy !== "class" && s.last_class_name && (
                              <span className="ml-1.5 text-[10px] text-text-tertiary">{s.last_class_name}</span>
                            )}
                          </div>
                          <button
                            onClick={() => enrollExisting(s.id)}
                            disabled={enrollingIds.has(s.id)}
                            className="px-3 py-1 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition disabled:opacity-50 flex-shrink-0"
                          >
                            {enrollingIds.has(s.id) ? "Adding..." : "Add"}
                          </button>
                        </div>
                      );

                      // Render groups
                      return Array.from(groups.entries()).map(([groupName, groupStudents]) => (
                        <div key={groupName || "all"}>
                          {groupName && (
                            <div className="flex items-center gap-2 px-3 py-1.5 mt-1 first:mt-0">
                              <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{groupName}</span>
                              <span className="text-[10px] text-text-tertiary">({groupStudents.length})</span>
                              {/* Add all button for groups */}
                              {groupStudents.length > 1 && (
                                <button
                                  onClick={() => groupStudents.forEach(s => { if (!enrollingIds.has(s.id)) enrollExisting(s.id); })}
                                  className="ml-auto text-[10px] text-purple-500 hover:text-purple-700 font-medium transition"
                                >
                                  Add all
                                </button>
                              )}
                            </div>
                          )}
                          <div className="space-y-0.5">
                            {groupStudents.map(renderStudent)}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => { setShowAddStudent(false); setBulkResult(null); setAddMode("existing"); setRosterSearch(""); setRosterGradFilter("all"); }}
                      className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
                    >
                      Done
                    </button>
                  </div>
                </>
              ) : addMode === "single" ? (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Username (required)
                      </label>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="e.g. jsmith"
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Display Name (optional)
                      </label>
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        placeholder="e.g. John Smith"
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">
                        Current Year Level (optional)
                      </label>
                      <select
                        value={newYearLevel}
                        onChange={(e) => setNewYearLevel(e.target.value)}
                        className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent text-sm"
                      >
                        <option value="">— Select —</option>
                        {YEAR_LEVELS.map(y => (
                          <option key={y} value={String(y)}>Year {y}</option>
                        ))}
                      </select>
                      <p className="text-xs text-text-tertiary mt-1">Auto-advances each academic year based on your school calendar</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setShowAddStudent(false); setBulkResult(null); setAddMode("single"); }}
                      className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addStudent}
                      disabled={!newUsername.trim() || adding}
                      className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
                    >
                      {adding ? "Adding..." : "Add"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                      Paste student list (one per line)
                    </label>
                    <textarea
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`John Smith\nJane Doe\njsmith, John Smith\njdoe, Jane Doe`}
                      rows={8}
                      className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue focus:border-transparent text-sm font-mono resize-none"
                      autoFocus
                    />
                    <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                      Accepted formats per line:<br />
                      <span className="font-mono text-text-primary">Full Name</span> — auto-generates username<br />
                      <span className="font-mono text-text-primary">username, Display Name</span> — comma-separated<br />
                      <span className="font-mono text-text-primary">username</span> — no display name
                    </p>
                  </div>

                  {bulkResult && (
                    <div className="mt-3 p-3 rounded-lg bg-surface-alt text-sm">
                      {bulkResult.added > 0 && (
                        <p className="text-accent-green font-medium">
                          {bulkResult.added} student{bulkResult.added !== 1 ? "s" : ""} added
                        </p>
                      )}
                      {bulkResult.skipped.length > 0 && (
                        <div className="mt-1">
                          <p className="text-amber-600 font-medium">
                            {bulkResult.skipped.length} skipped:
                          </p>
                          <ul className="text-xs text-text-secondary mt-0.5 space-y-0.5">
                            {bulkResult.skipped.map((s, i) => (
                              <li key={i} className="font-mono">{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setShowAddStudent(false); setBulkText(""); setBulkResult(null); setAddMode("single"); }}
                      className="flex-1 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addStudentsBulk}
                      disabled={!bulkText.trim() || adding}
                      className="flex-1 py-2 bg-accent-blue text-white rounded-lg text-sm font-medium hover:bg-accent-blue/90 transition disabled:opacity-40"
                    >
                      {adding ? "Adding..." : `Add ${bulkText.trim() ? bulkText.trim().split("\n").filter((l) => l.trim()).length : 0} Students`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {students.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "#F3E8FF" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            </div>
            <p className="text-gray-700 font-semibold">No students yet</p>
            <p className="text-gray-400 text-sm mt-1">Add students so they can log in with the class code.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredStudents.map((student) => {
              const studioStatus = studioMap.get(student.id);
              const badges = badgeMap.get(student.id) || 0;
              const progress = progressMap.get(student.id);
              const progressPct = progress && progress.total > 0
                ? Math.round((progress.completed / progress.total) * 100)
                : 0;
              const displayName = student.display_name || student.username;
              const initials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
              const ellInfo = student.ell_level ? ELL_COLORS[student.ell_level as number] : null;

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-2xl border border-gray-100 hover:shadow-sm transition-shadow group"
                >
                  <div className="flex items-center gap-4 px-4 py-3">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: avatarGradient(displayName) }}
                    >
                      {initials}
                    </div>

                    {/* Name + username */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {student.display_name || <span className="text-gray-400 italic">No name</span>}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">@{student.username}</span>
                      </div>
                      {/* Status badges */}
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {/* ELL badge */}
                        {ellInfo && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: ellInfo.bg, color: ellInfo.color }}
                            title={ellInfo.label}
                          >
                            ELL {student.ell_level}
                          </span>
                        )}
                        {/* Studio badge */}
                        {studioStatus && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                            style={{ background: "linear-gradient(135deg, #06B6D4, #8B5CF6, #EC4899)" }}
                          >
                            Studio
                          </span>
                        )}
                        {/* Safety badges */}
                        {badges > 0 && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "#FEF3C7", color: "#92400E" }}
                          >
                            {badges} badge{badges !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress bar */}
                    {progress && progress.total > 0 && (
                      <div className="hidden md:block w-28 flex-shrink-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] font-semibold text-gray-900">{progressPct}%</span>
                          <span className="text-[10px] text-gray-400">{progress.completed}/{progress.total}</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progressPct}%`,
                              background: progressPct === 100
                                ? "#059669"
                                : progressPct >= 50
                                  ? "linear-gradient(90deg, #7C3AED, #EC4899)"
                                  : "#D1D5DB",
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* ELL selector */}
                    <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                      <span className="text-[10px] text-gray-400 mr-1">ELL</span>
                      {([1, 2, 3] as EllLevel[]).map((level) => (
                        <button
                          key={level}
                          onClick={() => updateEllLevel(student.id, level)}
                          className="w-7 h-7 rounded-full text-[11px] font-bold transition"
                          style={student.ell_level === level ? {
                            background: ELL_COLORS[level]?.color || "#2563EB",
                            color: "white",
                          } : {
                            background: "#F3F4F6",
                            color: "#9CA3AF",
                          }}
                          title={ELL_LEVELS[level].label}
                        >
                          {level}
                        </button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Link
                        href={`/teacher/students/${student.id}`}
                        className="px-2.5 py-1.5 text-[11px] font-semibold rounded-lg transition"
                        style={{ background: "#F3E8FF", color: "#7C3AED" }}
                      >
                        Profile
                      </Link>
                      <button
                        onClick={() => setRemovingId(student.id)}
                        className="px-2 py-1.5 text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition opacity-0 group-hover:opacity-100"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* No search results */}
            {filteredStudents.length === 0 && students.length > 0 && (
              <div className="bg-white rounded-2xl p-6 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No students match "{studentSearch}"</p>
              </div>
            )}
          </div>
        )}

        {/* Remove confirmation */}
        {removingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
              <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: "#FEE2E2" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" y1="8" x2="23" y2="8"/></svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 text-center">Remove Student?</h3>
              <p className="text-sm text-gray-500 text-center mt-1">
                This will remove <span className="font-semibold">{students.find((s) => s.id === removingId)?.display_name || students.find((s) => s.id === removingId)?.username}</span> from this class. Their progress data will be preserved.
              </p>
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setRemovingId(null)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => removeStudent(removingId)}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Units Section — Current + History */}
      <UnitsSection
        allUnits={allUnits}
        classUnits={classUnits}
        classId={classId}
        onToggle={toggleUnit}
      />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Units Section — Current Units + Unit History
// ---------------------------------------------------------------------------

function UnitsSection({
  allUnits,
  classUnits,
  classId,
  onToggle,
}: {
  allUnits: Unit[];
  classUnits: ClassUnit[];
  classId: string;
  onToggle: (unitId: string, isActive: boolean) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  // Split into current (active class_units) and inactive/unassigned
  const currentUnits: Array<{ unit: Unit; cu: ClassUnit }> = [];
  const historyUnits: Array<{ unit: Unit; cu?: ClassUnit }> = [];

  for (const unit of allUnits) {
    const cu = classUnits.find((c) => c.unit_id === unit.id);
    if (cu?.is_active) {
      currentUnits.push({ unit, cu });
    } else if (cu) {
      // Was assigned but now inactive — history
      historyUnits.push({ unit, cu });
    }
    // Units never assigned to this class are not shown
  }

  // Unassigned units (never had a class_units record) — for the "Add Unit" picker
  const unassignedUnits = allUnits.filter(
    (u) => !classUnits.some((cu) => cu.unit_id === u.id)
  );

  return (
    <section className="space-y-6">
      {/* ── Current Units ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Current Units
            {currentUnits.length > 0 && (
              <span className="text-sm font-normal text-text-tertiary ml-1">({currentUnits.length})</span>
            )}
          </h2>
        </div>

        {currentUnits.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mx-auto mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14m-7-7h14" />
              </svg>
            </div>
            <p className="text-sm text-text-secondary mb-1">No active units for this class.</p>
            <p className="text-xs text-text-tertiary">Activate a unit below or assign one from the Units page.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentUnits.map(({ unit, cu }) => (
              <div
                key={unit.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-text-primary leading-snug">{unit.title}</h3>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      </div>
                      {unit.description && (
                        <p className="text-sm text-text-secondary mt-1 line-clamp-2">{unit.description}</p>
                      )}
                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-text-tertiary">
                        {Boolean((unit as unknown as Record<string, unknown>).grade_level) && (
                          <span>{String((unit as unknown as Record<string, unknown>).grade_level)}</span>
                        )}
                        {Boolean((unit as unknown as Record<string, unknown>).estimated_duration) && (
                          <span>{String((unit as unknown as Record<string, unknown>).estimated_duration)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    <Link
                      href={`/teacher/teach/${unit.id}?classId=${classId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl text-white shadow-sm transition hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #7C3AED, #6D28D9)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                      Teach
                    </Link>
                    <Link
                      href={`/teacher/units/${unit.id}/class/${classId}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Manage
                    </Link>
                    <Link
                      href={`/teacher/classes/${classId}/progress/${unit.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Progress
                    </Link>
                    <Link
                      href={`/teacher/classes/${classId}/grading/${unit.id}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Grade
                    </Link>
                    <Link
                      href={`/teacher/units/${unit.id}/class/${classId}/edit`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-gray-200 text-text-secondary transition hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <div className="ml-auto">
                      <button
                        onClick={() => onToggle(unit.id, false)}
                        className="text-xs text-text-tertiary hover:text-red-500 transition px-2 py-1"
                      >
                        Deactivate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Unit ── */}
      {unassignedUnits.length > 0 && (
        <AddUnitPicker units={unassignedUnits} onActivate={(unitId) => onToggle(unitId, true)} />
      )}

      {/* ── Unit History ── */}
      {historyUnits.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition mb-3"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform duration-200 ${showHistory ? "rotate-90" : ""}`}
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            {/* clock icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            Unit History
            <span className="text-xs font-normal text-gray-400">({historyUnits.length} past unit{historyUnits.length !== 1 ? "s" : ""})</span>
          </button>

          {showHistory && (
            <div className="space-y-2 pl-1">
              {historyUnits.map(({ unit, cu }) => {
                // Format date from class_unit timestamps
                const dateStr = cu?.updated_at || cu?.created_at;
                const formattedDate = dateStr
                  ? new Date(dateStr).toLocaleDateString("en-AU", { month: "short", year: "numeric" })
                  : null;
                // Count lessons
                const cd = unit.content_data as Record<string, unknown> | null;
                const lessonCount = (cd && Array.isArray((cd as { pages?: unknown[] }).pages)) ? (cd as { pages: unknown[] }).pages.length : 0;

                return (
                  <div
                    key={unit.id}
                    className="group bg-gray-50 rounded-xl px-5 py-3 flex items-center gap-4 border border-gray-100 hover:border-gray-200 transition"
                  >
                    {/* Date badge */}
                    <div className="shrink-0 w-16 text-center">
                      {formattedDate ? (
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{formattedDate}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>

                    {/* Unit name + lesson count */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-600 truncate">{unit.title}</p>
                      {lessonCount > 0 && (
                        <p className="text-xs text-gray-400 mt-0.5">{lessonCount} lesson{lessonCount !== 1 ? "s" : ""}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Link
                        href={`/teacher/classes/${classId}/progress/${unit.id}`}
                        className="text-xs text-gray-400 hover:text-gray-600 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
                      >
                        Progress
                      </Link>
                      <Link
                        href={`/teacher/classes/${classId}/grading/${unit.id}`}
                        className="text-xs text-gray-400 hover:text-gray-600 transition px-2.5 py-1.5 rounded-lg hover:bg-gray-100"
                      >
                        Grades
                      </Link>
                      <Link
                        href={`/teacher/units/${unit.id}`}
                        className="text-xs text-blue-500 hover:text-blue-600 transition px-2.5 py-1.5 rounded-lg hover:bg-blue-50 font-medium"
                        title="Assign this unit to another class"
                      >
                        {/* share/reuse icon */}
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
                          </svg>
                          Reuse
                        </span>
                      </Link>
                      <button
                        onClick={() => onToggle(unit.id, true)}
                        className="text-xs font-medium text-purple-500 hover:text-purple-600 transition px-2.5 py-1.5 rounded-lg hover:bg-purple-50"
                      >
                        Reactivate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Add Unit Picker — collapsible dropdown to assign new units
// ---------------------------------------------------------------------------

function AddUnitPicker({
  units,
  onActivate,
}: {
  units: Unit[];
  onActivate: (unitId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 hover:text-purple-700 transition px-1"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 5v14m-7-7h14" />
        </svg>
        Add a unit to this class
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          className={`transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {units.map((unit) => (
            <div
              key={unit.id}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between hover:border-purple-200 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">{unit.title}</p>
                {unit.description && (
                  <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{unit.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  onActivate(unit.id);
                  setOpen(false);
                }}
                className="text-sm font-semibold text-purple-600 hover:text-purple-700 transition px-3 py-1.5 rounded-lg hover:bg-purple-50 shrink-0"
              >
                + Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
