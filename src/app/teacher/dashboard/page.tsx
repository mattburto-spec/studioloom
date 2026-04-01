"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { generateClassCode, timeAgo } from "@/lib/utils";
import { useTeacher } from "../teacher-context";
import type { DashboardData, DashboardInsight } from "@/types/dashboard";
import type { TeacherStyleProfile } from "@/types/teacher-style";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TeacherDashboard() {
  const { teacher } = useTeacher();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassFramework, setNewClassFramework] = useState("myp_design");
  const [creating, setCreating] = useState(false);
  const [styleProfile, setStyleProfile] = useState<TeacherStyleProfile | null>(null);

  const loadDashboard = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch("/api/teacher/dashboard");
      if (!res.ok) throw new Error("Failed to load dashboard");
      const json: DashboardData = await res.json();
      setData(json);
      setLastRefresh(new Date());
      setError(null);
    } catch {
      if (!background) setError("Failed to load dashboard data");
    } finally {
      if (!background) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(false);
    const interval = setInterval(() => loadDashboard(true), 300_000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  // Load teacher style profile
  useEffect(() => {
    if (!teacher) return;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("teachers")
          .select("style_profile")
          .eq("id", teacher.id)
          .maybeSingle();
        if (data?.style_profile) {
          setStyleProfile(data.style_profile as TeacherStyleProfile);
        }
      } catch {
        // no profile yet — fine
      }
    })();
  }, [teacher]);

  async function createClass() {
    if (!newClassName.trim() || !teacher) return;
    setCreating(true);

    const supabase = createClient();
    const code = generateClassCode();

    const { error: err } = await supabase.from("classes").insert({
      teacher_id: teacher.id,
      name: newClassName.trim(),
      code,
      framework: newClassFramework,
    });

    if (!err) {
      setNewClassName("");
      setNewClassFramework("myp_design");
      setShowCreate(false);
      loadDashboard(true);
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-24 rounded-2xl" style={{ background: "linear-gradient(135deg, #7B2FF2 0%, #4F46E5 100%)", opacity: 0.3 }} />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-4 space-y-3">
              <div className="h-48 bg-gray-100 rounded-xl" />
              <div className="h-32 bg-gray-100 rounded-xl" />
            </div>
            <div className="lg:col-span-8 space-y-3">
              <div className="h-28 bg-gray-100 rounded-xl" />
              <div className="h-28 bg-gray-100 rounded-xl" />
              <div className="h-28 bg-gray-100 rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-border">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => loadDashboard(false)}
            className="px-5 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const hasClasses = data && data.classes.length > 0;

  // Compute quick stats
  const totalStudents = data ? data.classes.reduce((sum, c) => sum + c.studentCount, 0) : 0;
  const totalUnits = data ? new Set(data.classes.flatMap(c => c.units.map(u => u.unitId))).size : 0;
  const totalClasses = data ? data.classes.length : 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-5">
      {!hasClasses ? (
        <WelcomeOnboarding
          teacherName={teacher?.name?.split(" ")[0] || ""}
          onCreateClass={() => setShowCreate(true)}
        />
      ) : (
        <>
          {/* Hero Header — gradient banner with welcome + stats */}
          <div
            className="rounded-2xl px-6 py-5 mb-5 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #7B2FF2 0%, #4F46E5 50%, #3B82F6 100%)" }}
          >
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
              backgroundSize: "60px 60px, 40px 40px",
            }} />
            <div className="relative flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Welcome back{teacher?.name ? `, ${teacher.name.split(" ")[0]}` : ""}
                </h1>
                <p className="text-white/60 text-xs mt-0.5 flex items-center gap-2">
                  {refreshing && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  )}
                  Updated {timeAgo(lastRefresh.toISOString())}
                </p>
              </div>
              <div className="flex items-center gap-5">
                <StatPill label="Classes" value={totalClasses} />
                <StatPill label="Units" value={totalUnits} />
                <StatPill label="Students" value={totalStudents} />
              </div>
            </div>
          </div>
          <TwoColumnDashboard data={data!} styleProfile={styleProfile} />
        </>
      )}

      {/* Create class modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl border border-border">
            <h2 className="text-lg font-bold text-text-primary mb-1">Create New Class</h2>
            <p className="text-sm text-text-secondary mb-4">Students will use a code to join.</p>
            <input
              type="text"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="e.g. Grade 8 Design"
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-purple/30 focus:border-brand-purple transition-all mb-4 text-sm"
              autoFocus
            />

            {/* Framework selector */}
            <label className="block text-xs font-semibold text-text-secondary mb-2">Learning Framework</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { id: "myp_design", label: "MYP Design", desc: "Design cycle", icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5", color: "#6366F1" },
                { id: "service_learning", label: "Service Learning", desc: "Community service", icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z", color: "#EC4899" },
                { id: "pyp_exhibition", label: "PYP Exhibition", desc: "Inquiry journey", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "#F59E0B" },
                { id: "personal_project", label: "Personal Project", desc: "Year 10 PP", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "#8B5CF6" },
              ].map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => setNewClassFramework(fw.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                    newClassFramework === fw.id
                      ? "border-purple-500 bg-purple-50 shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: newClassFramework === fw.id ? fw.color : "#F3F4F6" }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={newClassFramework === fw.id ? "#fff" : "#9CA3AF"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={fw.icon} />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-text-primary leading-tight">{fw.label}</div>
                    <div className="text-[10px] text-text-secondary">{fw.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-secondary hover:bg-surface-alt transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={createClass}
                disabled={!newClassName.trim() || creating}
                className="flex-1 py-2.5 text-white rounded-xl text-sm font-semibold transition disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Welcome Onboarding — shown when teacher has no classes
// ---------------------------------------------------------------------------

const FRAMEWORKS = [
  { id: "IB_MYP", label: "IB MYP", desc: "Design cycle, criteria A-D" },
  { id: "GCSE_DT", label: "GCSE D&T", desc: "AO1-AO5 assessment" },
  { id: "IGCSE_DT", label: "IGCSE D&T", desc: "Cambridge pathway" },
  { id: "A_LEVEL_DT", label: "A-Level D&T", desc: "Advanced design" },
  { id: "ACARA_DT", label: "ACARA D&T", desc: "Australian curriculum" },
  { id: "PLTW", label: "PLTW", desc: "Project Lead the Way" },
];

const PERIOD_OPTIONS = [
  { value: 40, label: "40 min" }, { value: 45, label: "45 min" },
  { value: 50, label: "50 min" }, { value: 55, label: "55 min" },
  { value: 60, label: "60 min" }, { value: 75, label: "75 min" },
  { value: 80, label: "80 min" }, { value: 90, label: "90 min" },
];

const CYCLE_OPTIONS = [
  { value: 5, label: "5-day (weekly)" }, { value: 6, label: "6-day" },
  { value: 7, label: "7-day" }, { value: 8, label: "8-day" }, { value: 10, label: "10-day" },
];

const TERM_TEMPLATES: Record<string, { label: string; names: string[] }> = {
  "4terms": { label: "4 Terms", names: ["Term 1", "Term 2", "Term 3", "Term 4"] },
  "2semesters": { label: "2 Semesters", names: ["Semester 1", "Semester 2"] },
  "3trimesters": { label: "3 Trimesters", names: ["Trimester 1", "Trimester 2", "Trimester 3"] },
};

const GRADE_OPTIONS = [
  { value: "6", label: "Year 6" }, { value: "7", label: "Year 7" },
  { value: "8", label: "Year 8" }, { value: "9", label: "Year 9" },
  { value: "10", label: "Year 10" }, { value: "11", label: "Year 11" },
  { value: "12", label: "Year 12" }, { value: "13", label: "Year 13" },
];

const SUBJECT_OPTIONS = [
  "Design", "Technology", "Engineering", "Art", "Digital Design",
  "Food Technology", "Textiles", "Woodwork", "Product Design",
];

function academicYearOptions(): string[] {
  const year = new Date().getFullYear();
  // Offer current year and next year as start years
  return [`${year - 1}-${year}`, `${year}-${year + 1}`];
}
function defaultAcademicYear(): string {
  const month = new Date().getMonth(); // 0-indexed
  const year = new Date().getFullYear();
  // Aug-Dec = new academic year already started; Jan-Jul = still in previous year's cycle
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function WelcomeOnboarding({ teacherName, onCreateClass }: { teacherName: string; onCreateClass: () => void }) {
  const [step, setStep] = useState<"choose" | "school" | "teaching" | "class">("choose");
  const [saving, setSaving] = useState(false);

  // Step 1: School basics
  const [schoolName, setSchoolName] = useState("");
  const [country, setCountry] = useState("");
  const [framework, setFramework] = useState("IB_MYP");
  const [periodMinutes, setPeriodMinutes] = useState(50);
  const [cycleLength, setCycleLength] = useState(5);
  const [termStructure, setTermStructure] = useState("4terms");
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear);

  // Step 2: Teaching preferences
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>(["Design"]);
  const [enableNM, setEnableNM] = useState(false);
  const [enableUDL, setEnableUDL] = useState(false);

  function toggleGrade(g: string) {
    setGradeLevels((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }
  function toggleSubject(s: string) {
    setSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  async function saveSchoolStep() {
    setSaving(true);
    const headers = { "Content-Type": "application/json" };
    try {
      // 1. Save profile
      await fetch("/api/teacher/profile", {
        method: "POST", headers,
        body: JSON.stringify({
          school_name: schoolName.trim() || null,
          country: country.trim() || null,
          curriculum_framework: framework,
          typical_period_minutes: periodMinutes,
          school_context: { cycle_length: cycleLength },
        }),
      });

      // 2. Create timetable (so Settings > Rotating Cycle is populated)
      await fetch("/api/teacher/timetable", {
        method: "POST", headers,
        body: JSON.stringify({ cycle_length: cycleLength }),
      }).catch(() => {});

      // 3. Create school calendar terms
      const template = TERM_TEMPLATES[termStructure];
      if (template) {
        await fetch("/api/teacher/school-calendar", {
          method: "POST", headers,
          body: JSON.stringify({
            academic_year: academicYear,
            terms: template.names.map((name, i) => ({
              term_name: name,
              term_order: i + 1,
            })),
          }),
        }).catch(() => {});
      }
    } catch {
      // Non-blocking — settings can be updated later
    }
    setSaving(false);
    setStep("teaching");
  }

  async function saveTeachingAndContinue() {
    setSaving(true);
    try {
      await fetch("/api/teacher/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName.trim() || null,
          country: country.trim() || null,
          curriculum_framework: framework,
          typical_period_minutes: periodMinutes,
          grade_levels_taught: gradeLevels,
          subjects_taught: subjects,
          school_context: { cycle_length: cycleLength },
          teacher_preferences: { enable_nm: enableNM, enable_udl: enableUDL },
        }),
      });
    } catch {
      // Non-blocking
    }
    setSaving(false);
    setStep("class");
  }

  const stepNumber = step === "school" ? 1 : step === "teaching" ? 2 : step === "class" ? 3 : 0;

  return (
    <div className="space-y-5">
      {/* Hero welcome */}
      <div
        className="rounded-2xl px-8 py-8 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #7B2FF2 0%, #4F46E5 50%, #3B82F6 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
          backgroundSize: "60px 60px, 40px 40px",
        }} />
        <div className="relative">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Welcome{teacherName ? `, ${teacherName}` : ""}!
          </h1>
          <p className="text-white/80 text-base max-w-xl leading-relaxed">
            The platform for classrooms where students make, solve, and create — with AI that supports your teaching.
          </p>
          {step === "choose" && (
            <p className="text-white/50 text-sm mt-2">Let&apos;s get you set up — it only takes a couple of minutes.</p>
          )}
          {stepNumber > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <StepDot active={stepNumber === 1} done={stepNumber > 1} label="1" />
              <div className="w-6 h-px bg-white/20" />
              <StepDot active={stepNumber === 2} done={stepNumber > 2} label="2" />
              <div className="w-6 h-px bg-white/20" />
              <StepDot active={stepNumber === 3} done={false} label="3" />
            </div>
          )}
        </div>
      </div>

      {/* Step: Choose path */}
      {step === "choose" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setStep("school")}
            className="group bg-white rounded-2xl p-6 border-2 border-purple-200 hover:border-purple-400 shadow-sm hover:shadow-md transition-all duration-200 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity"
              style={{ background: "radial-gradient(circle, #7B2FF2 0%, transparent 70%)" }} />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">Recommended</span>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Quick Setup</h3>
            <p className="text-sm text-gray-500 leading-relaxed">Tell us about your school and teaching. Takes about two minutes.</p>
          </button>

          <Link
            href="/teacher/toolkit"
            className="group bg-white rounded-2xl p-6 border-2 border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md transition-all duration-200 text-left relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 opacity-5 group-hover:opacity-10 transition-opacity"
              style={{ background: "radial-gradient(circle, #3B82F6 0%, transparent 70%)" }} />
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Explore First</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Look around and come back when you&apos;re ready. Set up from
              <span className="text-purple-600 font-medium mx-1">Settings</span>
              anytime.
            </p>
          </Link>
        </div>
      )}

      {/* Step 1: School basics */}
      {step === "school" && (
        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">About Your School</h2>
            <p className="text-sm text-gray-400">This drives lesson timing, timetable, and AI generation. Change anytime in Settings.</p>
          </div>

          {/* School name + Location row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">School Name <span className="text-gray-300 font-normal">(optional)</span></label>
              <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Nanjing International School"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Location <span className="text-gray-300 font-normal">(optional)</span></label>
              <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. China, Australia, UK"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm" />
            </div>
          </div>

          {/* Framework */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Curriculum Framework</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {FRAMEWORKS.map((fw) => (
                <button key={fw.id} onClick={() => setFramework(fw.id)}
                  className={`p-2.5 rounded-xl border-2 text-left transition-all ${framework === fw.id ? "border-purple-500 bg-purple-50 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                  <div className="text-xs font-bold text-gray-900">{fw.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{fw.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Period + Cycle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Period Length</label>
              <div className="flex flex-wrap gap-1.5">
                {PERIOD_OPTIONS.map((p) => (
                  <button key={p.value} onClick={() => setPeriodMinutes(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${periodMinutes === p.value ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Timetable Cycle</label>
              <div className="flex flex-wrap gap-1.5">
                {CYCLE_OPTIONS.map((c) => (
                  <button key={c.value} onClick={() => setCycleLength(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${cycleLength === c.value ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Academic Year + Term Structure */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Academic Year</label>
              <div className="flex flex-wrap gap-1.5">
                {academicYearOptions().map((yr) => (
                  <button key={yr} onClick={() => setAcademicYear(yr)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${academicYear === yr ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                    {yr}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">Term Structure</label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TERM_TEMPLATES).map(([key, t]) => (
                  <button key={key} onClick={() => setTermStructure(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${termStructure === key ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveSchoolStep} disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)", boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)" }}>
              {saving ? "Saving..." : "Next — Your Teaching"}
              {!saving && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
            </button>
            <button onClick={() => setStep("choose")} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Back</button>
          </div>
        </div>
      )}

      {/* Step 2: Teaching preferences */}
      {step === "teaching" && (
        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span className="text-xs font-medium text-green-600">School settings saved</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-2 mb-0.5">Your Teaching</h2>
            <p className="text-sm text-gray-400">Helps us tailor the experience. All optional.</p>
          </div>

          {/* Grade levels */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Year Levels You Teach</label>
            <div className="flex flex-wrap gap-1.5">
              {GRADE_OPTIONS.map((g) => (
                <button key={g.value} onClick={() => toggleGrade(g.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${gradeLevels.includes(g.value) ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subjects */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">Subjects You Teach</label>
            <div className="flex flex-wrap gap-1.5">
              {SUBJECT_OPTIONS.map((s) => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${subjects.includes(s) ? "bg-purple-100 text-purple-700 border border-purple-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Feature toggles */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2">Optional Features</label>
            <div className="space-y-2.5">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-200 transition-all cursor-pointer">
                <input type="checkbox" checked={enableNM} onChange={(e) => setEnableNM(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Melbourne Metrics (NM)</div>
                  <div className="text-xs text-gray-400 mt-0.5">Competency-based assessment from the University of Melbourne framework. Students self-assess, teachers observe.</div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-purple-200 transition-all cursor-pointer">
                <input type="checkbox" checked={enableUDL} onChange={(e) => setEnableUDL(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                <div>
                  <div className="text-sm font-semibold text-gray-900">Universal Design for Learning (UDL)</div>
                  <div className="text-xs text-gray-400 mt-0.5">Tag activities with CAST UDL checkpoints. Track inclusivity coverage across your units.</div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button onClick={saveTeachingAndContinue} disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)", boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)" }}>
              {saving ? "Saving..." : "Next — Create a Class"}
              {!saving && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
            </button>
            <button onClick={() => setStep("school")} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Back</button>
            <button onClick={() => setStep("class")} className="text-sm text-gray-400 hover:text-gray-600 transition-colors ml-auto">Skip</button>
          </div>
        </div>
      )}

      {/* Step 3: Create class */}
      {step === "class" && (
        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              <span className="text-xs font-medium text-green-600">Settings saved</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-2 mb-0.5">Create Your First Class</h2>
            <p className="text-sm text-gray-400">Students will use a join code to connect. You can create more classes later.</p>
          </div>

          <button onClick={onCreateClass}
            className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, #7B2FF2, #5C16C5)", boxShadow: "0 4px 14px rgba(123, 47, 242, 0.35)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m-7-7h14" />
            </svg>
            Create a Class
          </button>
          <button onClick={() => setStep("teaching")} className="ml-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">Back</button>
        </div>
      )}
    </div>
  );
}

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
        done ? "bg-green-400 text-white" : active ? "bg-white text-purple-700" : "bg-white/20 text-white/50"
      }`}
    >
      {done ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
      ) : label}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat pill — for hero header
// ---------------------------------------------------------------------------

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-white leading-none">{value}</div>
      <div className="text-[10px] text-white/50 font-medium mt-0.5">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Two-Column Dashboard — Sidebar (1/3) + Class Cards (2/3)
// ---------------------------------------------------------------------------

import { CLASS_COLORS, getClassColor, getClassGradient } from "@/lib/ui/class-colors";

// ── Unit type badge config ──
const UNIT_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  design:  { label: "DESIGN",  bg: "#0D9488", text: "#fff" },
  service: { label: "SERVICE", bg: "#EC4899", text: "#fff" },
  pp:      { label: "PP", bg: "#8B5CF6", text: "#fff" },
  inquiry: { label: "INQUIRY", bg: "#F59E0B", text: "#fff" },
};
function detectUnitType(unitType?: string, className?: string, unitTitle?: string): string {
  if (unitType) return unitType.toLowerCase();
  const text = `${className || ""} ${unitTitle || ""}`.toLowerCase();
  if (/\bservice\b/.test(text)) return "service";
  if (/\bpersonal\s*project\b|\bpp\b/.test(text)) return "pp";
  if (/\binquiry\b|\bpyp\b|\btrans\s*disc/.test(text)) return "inquiry";
  return "design";
}
function getUnitTypeBadge(type: string) {
  return UNIT_TYPE_CONFIG[type] || UNIT_TYPE_CONFIG.design;
}

// ── Deterministic photo for unit cards ──
const UNIT_PHOTOS = [
  "https://images.unsplash.com/photo-1581783898377-1c85bf937427?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504917595217-d4dc5ede4c48?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1565034946487-077786996e27?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1544717305-2782549b5136?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=400&h=300&fit=crop",
  "https://images.unsplash.com/photo-1541462608143-67571c6738dd?w=400&h=300&fit=crop",
];
function getUnitPhotoUrl(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = ((hash << 5) - hash + title.charCodeAt(i)) | 0;
  return UNIT_PHOTOS[Math.abs(hash) % UNIT_PHOTOS.length];
}

interface ScheduleEntry {
  date: string;
  cycleDay: number;
  period?: number;
  room?: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
}

function TwoColumnDashboard({
  data,
  styleProfile,
}: {
  data: DashboardData;
  styleProfile: TeacherStyleProfile | null;
}) {
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [hasTimetable, setHasTimetable] = useState(false);

  const classIndexMap = new Map<string, number>();
  data.classes.forEach((cls, idx) => classIndexMap.set(cls.id, idx));

  // Build flat list of all class-unit pairs
  const classCards: Array<{
    unitId: string; unitTitle: string; classId: string;
    className: string; classCode: string; completionPct: number;
    studentCount: number; inProgressCount: number;
    openStudioCount: number; nmEnabled: boolean; badgeRequirementCount: number;
    isForked: boolean;
    completedCount: number; notStartedCount: number;
    classIdx: number;
    unitType?: string;
    thumbnailUrl?: string;
  }> = [];
  const seen = new Set<string>();
  for (const cls of data.classes) {
    for (const u of cls.units) {
      const key = `${u.unitId}-${cls.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        classCards.push({
          unitId: u.unitId, unitTitle: u.unitTitle,
          classId: cls.id, className: cls.name, classCode: cls.code,
          completionPct: u.completionPct, studentCount: cls.studentCount,
          inProgressCount: u.inProgressCount,
          openStudioCount: u.openStudioCount ?? 0,
          nmEnabled: u.nmEnabled ?? false,
          badgeRequirementCount: u.badgeRequirementCount ?? 0,
          isForked: u.isForked ?? false,
          completedCount: u.completedCount, notStartedCount: u.notStartedCount,
          classIdx: classIndexMap.get(cls.id) ?? 0,
          unitType: u.unitType,
          thumbnailUrl: u.thumbnailUrl,
        });
      }
    }
  }
  classCards.sort((a, b) => b.inProgressCount - a.inProgressCount);

  // Fetch today's schedule
  useEffect(() => {
    (async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const res = await fetch(`/api/teacher/schedule/today?days=7&tz=${encodeURIComponent(tz)}`);
        if (!res.ok) { setScheduleLoading(false); return; }
        const schedData = await res.json();
        setHasTimetable(schedData.hasTimetable ?? false);
        setSchedule(schedData.entries || []);
      } catch {
        // fine
      } finally {
        setScheduleLoading(false);
      }
    })();
  }, []);

  const today = new Date().toLocaleDateString("en-CA");
  const todayEntries = schedule.filter((e) => e.date === today);
  const upcomingEntries = schedule.filter((e) => e.date > today).slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SIDEBAR                                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-4 space-y-4">

        {/* ── Today's Schedule ── */}
        <SidebarSection
          title="Today"
          subtitle={new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "short" })}
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>}
          accentColor="#3B82F6"
        >
          {scheduleLoading ? (
            <div className="animate-pulse space-y-2 p-3">
              <div className="h-10 bg-gray-100 rounded-lg" />
              <div className="h-10 bg-gray-100 rounded-lg" />
            </div>
          ) : !hasTimetable ? (
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary mb-2">Add your timetable to see classes here.</p>
              <Link href="/teacher/settings" className="text-xs font-semibold text-blue-600 hover:underline">Go to Settings</Link>
            </div>
          ) : todayEntries.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-text-secondary">No classes today</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {todayEntries.map((entry, idx) => {
                const cIdx = classIndexMap.get(entry.classId) ?? idx;
                const c = getClassColor(cIdx);
                return (
                  <Link
                    key={`today-${idx}`}
                    href={`/teacher/teach/${entry.unitId}?classId=${entry.classId}`}
                    className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition group"
                  >
                    <div className="w-10 h-10 rounded-lg flex flex-col items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ background: c.fill }}>
                      {entry.period ? <span>P{entry.period}</span> : <span>-</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{entry.className}</p>
                      <p className="text-[11px] text-text-secondary truncate">{entry.unitTitle}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#7C3AED" stroke="none" className="shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <polygon points="6 3 20 12 6 21 6 3" />
                    </svg>
                  </Link>
                );
              })}
            </div>
          )}
          {upcomingEntries.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">Coming up</p>
              {upcomingEntries.slice(0, 3).map((entry, idx) => {
                const cIdx = classIndexMap.get(entry.classId) ?? idx;
                const c = getClassColor(cIdx);
                const d = new Date(entry.date + "T00:00:00");
                const dayName = d.toLocaleDateString("en-AU", { weekday: "short" });
                return (
                  <div key={`up-${idx}`} className="flex items-center gap-2 py-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.fill }} />
                    <span className="text-[11px] text-text-primary truncate flex-1">{entry.className}</span>
                    <span className="text-[10px] text-text-secondary">{dayName}{entry.period ? ` P${entry.period}` : ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </SidebarSection>

        {/* ── Smart Insights ── */}
        {(data.insights ?? []).length > 0 && (
          <SidebarSection
            title="Insights"
            subtitle={`${(data.insights ?? []).length} item${(data.insights ?? []).length !== 1 ? "s" : ""}`}
            icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" /></svg>}
            accentColor="#7C3AED"
          >
            <div className="divide-y divide-gray-100">
              {(data.insights ?? []).slice(0, 6).map((insight, idx) => (
                <InsightRow key={`insight-${idx}`} insight={insight} />
              ))}
              {(data.insights ?? []).length > 6 && (
                <p className="text-[10px] text-text-secondary text-center py-2">+{(data.insights ?? []).length - 6} more</p>
              )}
            </div>
          </SidebarSection>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MAIN — Class-unit cards                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-8 space-y-4">
        {classCards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <p className="text-sm text-text-secondary">No units assigned to classes yet. Create a unit and assign it to get started.</p>
          </div>
        ) : (
          classCards.map((u) => {
            const c = getClassColor(u.classIdx);
            const detectedType = detectUnitType(u.unitType, u.className, u.unitTitle);
            const typeBadge = getUnitTypeBadge(detectedType);
            const photoUrl = u.thumbnailUrl || getUnitPhotoUrl(u.unitTitle);
            return (
              <div
                key={`card-${u.unitId}-${u.classId}`}
                className="group bg-white rounded-xl overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                style={{
                  border: "1px solid #e5e7eb",
                  borderLeft: `4px solid ${c.fill}`,
                }}
              >
                {/* Type-colored top accent line */}
                <div className="h-1" style={{ background: `linear-gradient(90deg, ${typeBadge.bg}, ${typeBadge.bg}80)` }} />

                <div className="flex items-stretch">
                  {/* Photo thumbnail */}
                  <Link
                    href={`/teacher/units/${u.unitId}/class/${u.classId}`}
                    className="w-40 shrink-0 relative overflow-hidden"
                    style={{ minHeight: "120px" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    {/* Unit type pill — bottom of photo */}
                    <span
                      className="absolute bottom-2 left-2 text-[10px] font-black tracking-wider px-2 py-0.5 rounded"
                      style={{ background: typeBadge.bg, color: typeBadge.text }}
                    >
                      {typeBadge.label}
                    </span>
                  </Link>

                  <div className="flex-1 px-5 py-4 flex flex-col min-w-0">
                    {/* Top row: class name + student count + badges */}
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold truncate" style={{ color: c.fill }}>
                        {u.className}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {u.studentCount} student{u.studentCount !== 1 ? "s" : ""}
                      </span>
                      {/* Feature badges inline */}
                      <div className="flex items-center gap-1 ml-auto shrink-0">
                        {u.nmEnabled && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded text-[7px] font-black"
                            style={{ background: "#FF2D78", color: "#fff", fontFamily: "'Arial Black', sans-serif" }}
                            title="New Metrics enabled"
                          >
                            NM
                          </span>
                        )}
                        {u.badgeRequirementCount > 0 && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded"
                            style={{ background: "#FEF3C7" }}
                            title={`${u.badgeRequirementCount} safety badge${u.badgeRequirementCount !== 1 ? "s" : ""} required`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#F59E0B" stroke="#92400E" strokeWidth="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                          </span>
                        )}
                        {u.openStudioCount > 0 && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded"
                            style={{ background: "#F3E8FF" }}
                            title={`${u.openStudioCount} in Open Studio`}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Unit title */}
                    <Link href={`/teacher/units/${u.unitId}/class/${u.classId}`} className="text-base font-extrabold text-text-primary leading-snug tracking-tight hover:text-purple-700 transition truncate">
                      {u.unitTitle}
                    </Link>

                    {/* Progress bar + action buttons */}
                    <div className="flex items-center gap-3 mt-auto pt-2">
                      {/* Progress bar */}
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(u.completionPct, 2)}%`,
                              background: `linear-gradient(90deg, ${c.fill}, ${c.accent})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 tabular-nums w-7 text-right shrink-0">
                          {Math.round(u.completionPct)}%
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          href={`/teacher/teach/${u.unitId}?classId=${u.classId}`}
                          className="inline-flex items-center gap-1 text-xs font-bold px-3.5 py-2 rounded-lg text-white transition hover:opacity-90 hover:shadow-md"
                          style={{ background: `linear-gradient(135deg, ${c.fill}, ${c.accent})` }}
                        >
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="white" stroke="none"><polygon points="6 3 20 12 6 21 6 3" /></svg>
                          Teach
                        </Link>
                        <Link
                          href={`/teacher/units/${u.unitId}/class/${u.classId}`}
                          className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        >
                          Hub
                        </Link>
                        <Link
                          href={`/teacher/units/${u.unitId}/class/${u.classId}/edit`}
                          className="inline-flex items-center text-xs font-semibold px-3 py-2 rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                        >
                          Edit
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* ── Classes with no units assigned ── */}
        {(() => {
          const emptyClasses = data.classes.filter(c => c.units.length === 0);
          if (emptyClasses.length === 0) return null;
          return (
            <div className="mt-4 bg-gray-50 rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-text-secondary mb-2">Classes without units</p>
              <div className="flex flex-wrap gap-2">
                {emptyClasses.map(cls => (
                  <div
                    key={cls.id}
                    className="inline-flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: getClassColor(classIndexMap.get(cls.id) ?? 0).fill }}
                    />
                    <span className="font-medium text-text-primary">{cls.name}</span>
                    <span className="text-text-secondary text-xs">{cls.studentCount} student{cls.studentCount !== 1 ? "s" : ""}</span>
                    <Link
                      href="/teacher/units"
                      className="text-xs font-medium text-violet-600 hover:text-violet-800 ml-1"
                    >
                      Assign unit →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsightRow
// ---------------------------------------------------------------------------

const INSIGHT_ICONS: Record<string, React.ReactNode> = {
  integrity_flag: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
  integrity_warning: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
  ),
  stale_unmarked: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
  ),
  unit_complete: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
  ),
  stuck_student: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" /><line x1="9" y1="9" x2="9.01" y2="9" /><line x1="15" y1="9" x2="15.01" y2="9" /></svg>
  ),
  recent_completion: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
  ),
};

function InsightRow({ insight }: { insight: DashboardInsight }) {
  return (
    <Link
      href={insight.href}
      className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 transition text-xs group"
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: insight.accentColor + "18", color: insight.accentColor }}
      >
        {INSIGHT_ICONS[insight.type] || INSIGHT_ICONS.recent_completion}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-text-primary leading-tight truncate">{insight.title}</p>
        <p className="text-[10px] text-text-secondary truncate mt-0.5">{insight.subtitle}</p>
      </div>
      <span className="text-[10px] text-text-secondary whitespace-nowrap shrink-0">
        {timeAgo(insight.timestamp)}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// SidebarSection
// ---------------------------------------------------------------------------

function SidebarSection({
  title,
  subtitle,
  icon,
  accentColor,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 border-b border-gray-100 flex items-center gap-2.5" style={{ background: "#f8f9fb" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: accentColor + "15", color: accentColor }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-text-primary">{title}</p>
          {subtitle && <p className="text-[10px] text-text-secondary truncate">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}
