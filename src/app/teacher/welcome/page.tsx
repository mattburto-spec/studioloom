"use client";

/**
 * /teacher/welcome — First-login onboarding wizard.
 *
 * Phase 1B of the ShipReady build plan. Teachers invited from
 * `/admin/teachers` land here on their first login because the teacher layout
 * redirect (in `src/app/teacher/layout.tsx`) pushes everyone with a NULL
 * `teachers.onboarded_at` to this route. Migration 083 adds that column.
 *
 * 5 steps (timetable-first flow):
 *   1. About you — name + school picker.
 *   2. Your timetable — upload photo (AI parse) or skip.
 *   3. Your classes — from timetable (editable list + frameworks) OR manual
 *      create-first-class if timetable was skipped.
 *   4. Add students — roster paste for one class. Skippable.
 *   5. You're ready — class codes + printable student list + starter CTAs.
 *      "Go to dashboard" marks onboarded.
 *
 * Every step except the credentials screen is reversible via Back. Leaving
 * the page mid-flow is fine — the layout will pull them back here on their
 * next visit because `onboarded_at` stays NULL until the final
 * `/api/teacher/welcome/complete` call.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseRosterFile } from "@/lib/roster/parse-csv";
import { SchoolPicker, type PickerSchool } from "@/components/schools/SchoolPicker";

type Step = "name" | "timetable" | "classes" | "roster" | "credentials";

interface CreatedClass {
  classId: string;
  classCode: string;
  className: string;
}

interface CreatedStudent {
  id: string;
  username: string;
  displayName: string | null;
}

interface DetectedClass {
  name: string;
  grade: string;
  occurrences: number;
  is_teaching: boolean;
  framework: string;
  include: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface TimetableParseResult {
  cycle_length: number;
  periods: Array<{
    period_number: number;
    start_time: string;
    end_time: string;
    duration_minutes: number;
  }>;
  entries: Array<{
    day: number;
    period: number;
    class_name: string;
    grade_level: string;
    room: string;
    is_teaching: boolean;
    classification: string;
    classification_reason: string;
  }>;
  detected_classes: Array<{
    name: string;
    grade: string;
    occurrences: number;
    is_teaching: boolean;
  }>;
  school_name?: string;
  teacher_name?: string;
  ai_notes?: string;
}

// Keep in sync with VALID_FRAMEWORKS in /api/teacher/welcome/create-class.
const FRAMEWORKS = [
  { id: "IB_MYP", label: "IB MYP", desc: "Design cycle - Criteria A-D" },
  { id: "GCSE_DT", label: "GCSE D&T", desc: "AO1-AO5 assessment" },
  { id: "IGCSE_DT", label: "IGCSE D&T", desc: "Cambridge pathway" },
  { id: "A_LEVEL_DT", label: "A-Level D&T", desc: "Advanced design" },
  { id: "ACARA_DT", label: "ACARA D&T", desc: "Australian curriculum" },
  { id: "PLTW", label: "PLTW", desc: "Project Lead the Way" },
];

const PERIOD_OPTIONS = [40, 45, 50, 55, 60, 75, 80, 90];

export default function TeacherWelcomePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teacher identity
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loadingTeacher, setLoadingTeacher] = useState(true);

  // School (migration 085 — picker + add-your-own)
  const [selectedSchool, setSelectedSchool] = useState<PickerSchool | null>(null);

  // Timetable (step 2)
  const [timetableUploading, setTimetableUploading] = useState(false);
  const [parseResult, setParseResult] = useState<TimetableParseResult | null>(null);
  const timetableFileRef = useRef<HTMLInputElement>(null);

  // Classes (step 3 — from timetable OR manual)
  const [detectedClasses, setDetectedClasses] = useState<DetectedClass[]>([]);
  const [createdClasses, setCreatedClasses] = useState<CreatedClass[]>([]);
  // Manual fallback (when timetable skipped)
  const [className, setClassName] = useState("");
  const [framework, setFramework] = useState("IB_MYP");
  const [periodMinutes, setPeriodMinutes] = useState(60);

  // Roster (step 4)
  const [rosterClassIndex, setRosterClassIndex] = useState(0);
  const [rosterText, setRosterText] = useState("");
  const [createdStudents, setCreatedStudents] = useState<CreatedStudent[]>([]);
  const [rosterSkipped, setRosterSkipped] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadInfo, setUploadInfo] = useState<{
    filename: string;
    count: number;
    usedHeaders: boolean;
  } | null>(null);

  // Derived: the "active" class for roster
  const rosterClass = createdClasses[rosterClassIndex] ?? createdClasses[0];

  // ---------------------------------------------------------------------
  // Load teacher (prefill name from invite metadata)
  // ---------------------------------------------------------------------
  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push("/teacher/login");
          return;
        }
        const { data: teacher } = await supabase
          .from("teachers")
          .select("id, name, onboarded_at, school_id")
          .eq("id", user.id)
          .single();
        if (teacher?.onboarded_at) {
          // Already onboarded — skip the wizard entirely.
          router.push("/teacher/dashboard");
          return;
        }
        setTeacherId(teacher?.id || user.id);
        // Fall back to raw_user_meta_data.name if teachers.name is empty.
        const fallbackName =
          (user.user_metadata?.name as string | undefined) || "";
        setName(teacher?.name || fallbackName);

        // Pre-load the picker if the teacher already had a school set
        // (e.g. they left mid-wizard and came back).
        if (teacher?.school_id) {
          const { data: school } = await supabase
            .from("schools")
            .select("id, name, city, country, ib_programmes, verified, source")
            .eq("id", teacher.school_id)
            .maybeSingle();
          if (school) {
            setSelectedSchool(school as PickerSchool);
          }
        }
      } catch (err) {
        console.error("[welcome] load teacher error:", err);
      } finally {
        setLoadingTeacher(false);
      }
    }
    load();
  }, [router]);

  // ---------------------------------------------------------------------
  // Step 2: Timetable upload
  // ---------------------------------------------------------------------

  async function handleTimetableUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setTimetableUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/teacher/timetable/parse-upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Upload failed");
      }
      const data: TimetableParseResult = await res.json();
      setParseResult(data);

      // Pre-populate detectedClasses from the AI result (defensive — field
      // was missing from the API response before the fix)
      if (data.detected_classes?.length) {
        setDetectedClasses(
          data.detected_classes.map((dc) => ({
            ...dc,
            framework: "IB_MYP", // default — teacher picks in step 3
            include: dc.is_teaching,
          }))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setTimetableUploading(false);
      if (timetableFileRef.current) timetableFileRef.current.value = "";
    }
  }

  // ---------------------------------------------------------------------
  // Step 3: Create classes (from timetable or manual)
  // ---------------------------------------------------------------------

  async function handleCreateClassesFromTimetable() {
    if (!parseResult) return;
    setError(null);
    setSaving(true);

    const includedClasses = detectedClasses.filter((dc) => dc.include);
    if (includedClasses.length === 0) {
      setError("Select at least one class to create.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/teacher/welcome/setup-from-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classes: includedClasses.map((dc) => ({
            name: dc.name,
            framework: dc.framework,
          })),
          timetable: {
            cycle_length: parseResult.cycle_length,
            periods: parseResult.periods,
            entries: parseResult.entries,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Setup failed (HTTP ${res.status})`);
        return;
      }
      setCreatedClasses(data.classes || []);
      setStep("roster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateClassManual() {
    setError(null);
    if (!className.trim()) {
      setError("Class name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/welcome/create-class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: className.trim(),
          framework,
          periodLengthMinutes: periodMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Create failed (HTTP ${res.status})`);
        return;
      }
      setCreatedClasses([
        {
          classId: data.classId,
          classCode: data.classCode,
          className: className.trim(),
        },
      ]);
      setStep("roster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------
  // Step 4: Roster
  // ---------------------------------------------------------------------

  async function handleAddRoster() {
    if (!rosterClass) return;
    setError(null);
    setSaving(true);

    const lines = rosterText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const roster = lines.map((line) => {
      const sep = line.match(/^([^,\t]+)[,\t]\s*(.+)$/);
      if (sep) {
        return { username: sep[1].trim(), name: sep[2].trim() };
      }
      return { name: line };
    });

    try {
      const res = await fetch("/api/teacher/welcome/add-roster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: rosterClass.classId,
          roster,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Roster add failed (HTTP ${res.status})`);
        return;
      }
      setCreatedStudents(data.students || []);
      setRosterSkipped(data.skipped || []);
      setStep("credentials");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSkipRoster() {
    setStep("credentials");
  }

  /**
   * CSV / TSV / TXT file upload. Reads the file client-side (never hits the
   * server), runs it through parseRosterFile, then drops the normalised lines
   * into the textarea so the teacher can review + edit before submitting.
   */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > 1024 * 1024) {
      setError("File is too large (max 1MB). Split it or paste manually.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseRosterFile(text);

      if (parsed.lines.length === 0) {
        setError(
          "Couldn't find any students in that file. Check the format — one student per row, with at least a name column."
        );
        return;
      }

      setRosterText((prev) => {
        const existing = prev.trim();
        return existing
          ? `${existing}\n${parsed.lines.join("\n")}`
          : parsed.lines.join("\n");
      });

      setUploadInfo({
        filename: file.name,
        count: parsed.lines.length,
        usedHeaders: parsed.usedHeaders,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't read the file: ${err.message}`
          : "Couldn't read the file."
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearUploadInfo() {
    setUploadInfo(null);
  }

  // ---------------------------------------------------------------------
  // Step 5: Complete
  // ---------------------------------------------------------------------

  /**
   * Fire the /complete endpoint to flip `onboarded_at`, then navigate to the
   * given destination.
   */
  async function completeAndGo(destination: string) {
    setSaving(true);
    setError(null);
    try {
      await fetch("/api/teacher/welcome/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          schoolId: selectedSchool?.id || null,
        }),
      });
    } catch (err) {
      console.warn("[welcome] complete failed:", err);
    } finally {
      // Full navigation so the layout re-fetches the teacher.
      window.location.href = destination;
    }
  }

  // ---------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------

  if (loadingTeacher) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-alt">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  const stepNumber =
    step === "name"
      ? 1
      : step === "timetable"
        ? 2
        : step === "classes"
          ? 3
          : step === "roster"
            ? 4
            : 5;

  const teachingSlotCount = parseResult?.entries
    ? parseResult.entries.filter((e) => e.is_teaching).length
    : 0;

  return (
    <main className="min-h-screen bg-surface-alt">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <div
          className="rounded-2xl px-8 py-7 relative overflow-hidden mb-6"
          style={{
            background:
              "linear-gradient(135deg, #7B2FF2 0%, #4F46E5 50%, #3B82F6 100%)",
          }}
        >
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)",
              backgroundSize: "60px 60px, 40px 40px",
            }}
          />
          <div className="relative">
            <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
              Welcome to StudioLoom{name ? `, ${name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-white/80 text-sm max-w-xl">
              Five quick steps and you&apos;ll be ready to teach. You can change
              anything later from Settings.
            </p>
            <div className="flex items-center gap-2 mt-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="flex items-center gap-2">
                  <StepDot active={stepNumber === n} done={stepNumber > n} label={`${n}`} />
                  {n < 5 && <div className="w-6 h-px bg-white/20" />}
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 1: About you (name + school)                             */}
        {/* ============================================================= */}
        {step === "name" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1">About you</h2>
            <p className="text-sm text-gray-500 mb-5">
              Your name is shown on dashboards and gradebooks. Your school is
              optional — we&apos;ll use it to connect you with co-teachers later.
            </p>

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ms Burton"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm mb-5"
              autoFocus
            />

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Your school <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <SchoolPicker
              value={selectedSchool}
              onChange={setSelectedSchool}
              placeholder="Start typing your school's name..."
            />
            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
              Can&apos;t find yours? Pick &ldquo;Add it&rdquo; at the bottom of the
              list — we&apos;ll verify and share it with other teachers at your
              school.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  if (!name.trim()) {
                    setError("Please enter a name.");
                    return;
                  }
                  setError(null);
                  setStep("timetable");
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                Next
                <ArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 2: Your timetable (upload photo or skip)                  */}
        {/* ============================================================= */}
        {step === "timetable" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Your timetable
              </h2>
              <p className="text-sm text-gray-500">
                Your timetable powers lesson scheduling, due dates, and your
                daily class view. Upload it now and we&apos;ll create your
                classes from it automatically.
              </p>
            </div>

            <input
              ref={timetableFileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleTimetableUpload}
              className="hidden"
            />

            {!parseResult ? (
              <div
                onClick={() =>
                  !timetableUploading && timetableFileRef.current?.click()
                }
                className="border-2 border-dashed border-purple-200 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-all"
              >
                {timetableUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-purple-700 font-medium">
                      Reading your timetable...
                    </span>
                    <span className="text-[11px] text-gray-400">
                      This can take up to a minute for complex timetables
                    </span>
                  </div>
                ) : (
                  <>
                    <CameraIcon large />
                    <p className="text-sm font-medium text-gray-700 mt-3">
                      Upload a photo or screenshot of your timetable
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      PNG, JPG, or PDF. We&apos;ll read it and create your
                      classes automatically.
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  <span className="font-semibold">
                    Detected {parseResult.cycle_length}-day cycle
                  </span>
                  {" with "}
                  <span className="font-semibold">
                    {teachingSlotCount} teaching slots
                  </span>
                  {parseResult.detected_classes?.length > 0 && (
                    <>
                      {" across "}
                      <span className="font-semibold">
                        {
                          parseResult.detected_classes.filter(
                            (c) => c.is_teaching
                          ).length
                        }{" "}
                        classes
                      </span>
                    </>
                  )}
                </div>

                {parseResult.detected_classes?.length > 0 && (
                  <div className="text-xs text-gray-500">
                    Detected classes:{" "}
                    {parseResult.detected_classes
                      .filter((c) => c.is_teaching)
                      .map((c) => c.name)
                      .join(", ")}
                  </div>
                )}

                <button
                  onClick={() => {
                    setParseResult(null);
                    setDetectedClasses([]);
                  }}
                  className="text-xs text-purple-600 hover:text-purple-800 font-medium"
                >
                  Upload a different timetable
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              {parseResult && (
                <button
                  onClick={() => {
                    setError(null);
                    setStep("classes");
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                    boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                  }}
                >
                  Next — Confirm your classes
                  <ArrowRight />
                </button>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setStep("name");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back
              </button>
              {!parseResult && (
                <button
                  onClick={() => {
                    setError(null);
                    setParseResult(null);
                    setStep("classes");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
                >
                  Skip — I&apos;ll add it in Settings
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 3: Your classes                                           */}
        {/* ============================================================= */}
        {step === "classes" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            {parseResult && detectedClasses.length > 0 ? (
              <>
                {/* ── From timetable: detected classes list ── */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Confirm your classes
                  </h2>
                  <p className="text-sm text-gray-500">
                    We detected these from your timetable. Untick any
                    non-teaching entries and pick a curriculum framework for
                    each class.
                  </p>
                </div>

                <div className="space-y-2">
                  {detectedClasses.map((dc, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                        dc.include
                          ? "border-purple-200 bg-white"
                          : "border-gray-100 bg-gray-50 opacity-60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={dc.include}
                        onChange={(e) => {
                          const next = [...detectedClasses];
                          next[i] = { ...next[i], include: e.target.checked };
                          setDetectedClasses(next);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">
                          {dc.name}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {dc.grade} &middot; {dc.occurrences}x per cycle
                          {!dc.is_teaching && (
                            <span className="ml-1 text-amber-600 font-medium">
                              (non-teaching)
                            </span>
                          )}
                        </div>
                      </div>

                      <select
                        value={dc.framework}
                        onChange={(e) => {
                          const next = [...detectedClasses];
                          next[i] = { ...next[i], framework: e.target.value };
                          setDetectedClasses(next);
                        }}
                        disabled={!dc.include}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium bg-white disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {FRAMEWORKS.map((fw) => (
                          <option key={fw.id} value={fw.id}>
                            {fw.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleCreateClassesFromTimetable}
                    disabled={
                      saving ||
                      detectedClasses.filter((dc) => dc.include).length === 0
                    }
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                    }}
                  >
                    {saving
                      ? "Creating..."
                      : `Create ${detectedClasses.filter((dc) => dc.include).length} class${detectedClasses.filter((dc) => dc.include).length !== 1 ? "es" : ""}`}
                    {!saving && <ArrowRight />}
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      setStep("timetable");
                    }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* ── Manual: create first class (timetable was skipped) ── */}
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Your first class
                  </h2>
                  <p className="text-sm text-gray-500">
                    We&apos;ll generate a join code you can share with students.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Class name
                  </label>
                  <input
                    type="text"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="e.g. Grade 8 Design"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Curriculum framework
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FRAMEWORKS.map((fw) => (
                      <button
                        key={fw.id}
                        type="button"
                        onClick={() => setFramework(fw.id)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                          framework === fw.id
                            ? "border-purple-500 bg-purple-50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        <div className="text-xs font-bold text-gray-900">
                          {fw.label}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          {fw.desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Typical period length
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PERIOD_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPeriodMinutes(p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          periodMinutes === p
                            ? "bg-purple-100 text-purple-700 border border-purple-300"
                            : "bg-gray-50 text-gray-500 border border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {p} min
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleCreateClassManual}
                    disabled={saving || !className.trim()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                    }}
                  >
                    {saving ? "Creating..." : "Create class"}
                    {!saving && <ArrowRight />}
                  </button>
                  <button
                    onClick={() => {
                      setError(null);
                      setStep("timetable");
                    }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 4: Add students (roster)                                  */}
        {/* ============================================================= */}
        {step === "roster" && createdClasses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CheckBadge />
                <span className="text-xs font-medium text-green-600">
                  {createdClasses.length === 1
                    ? `${createdClasses[0].className} created — join code `
                    : `${createdClasses.length} classes created`}
                  {createdClasses.length === 1 && (
                    <code className="font-mono font-bold">
                      {createdClasses[0].classCode}
                    </code>
                  )}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Add your students
              </h2>
              <p className="text-sm text-gray-500">
                Paste one per line. You can always add more later from the class page.
              </p>
            </div>

            {/* Class picker (only if multiple classes) */}
            {createdClasses.length > 1 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Add students to
                </label>
                <select
                  value={rosterClassIndex}
                  onChange={(e) => setRosterClassIndex(Number(e.target.value))}
                  className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full"
                >
                  {createdClasses.map((cls, i) => (
                    <option key={cls.classId} value={i}>
                      {cls.className} ({cls.classCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500">
                  Roster
                </label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                    aria-label="Upload roster file"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
                  >
                    <UploadIcon />
                    Upload CSV
                  </button>
                </div>
              </div>

              {uploadInfo && (
                <div className="mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs">
                  <span className="text-green-800">
                    <span className="font-semibold">
                      Loaded {uploadInfo.count} student
                      {uploadInfo.count !== 1 ? "s" : ""}
                    </span>
                    {" from "}
                    <span className="font-mono text-green-900">
                      {uploadInfo.filename}
                    </span>
                    {uploadInfo.usedHeaders && (
                      <span className="text-green-600">
                        {" "}
                        (using column headers)
                      </span>
                    )}
                    . Review and edit below before adding.
                  </span>
                  <button
                    type="button"
                    onClick={clearUploadInfo}
                    className="text-green-600 hover:text-green-800 font-medium whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <textarea
                value={rosterText}
                onChange={(e) => setRosterText(e.target.value)}
                placeholder={`John Smith\nMaria Garcia\njdoe, Jane Doe\n\n— or click "Upload CSV" to import from a file`}
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                Accepts <code>Full Name</code>, <code>username</code>, or{" "}
                <code>username, Full Name</code>. We&apos;ll auto-generate
                usernames from full names (e.g. &ldquo;John Smith&rdquo; &rarr;{" "}
                <code>jsmith</code>). CSV uploads recognise columns like{" "}
                <code>Name</code>, <code>First Name</code>/
                <code>Last Name</code>, <code>Username</code>,{" "}
                <code>Email</code>.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleAddRoster}
                disabled={saving || !rosterText.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                {saving ? "Adding..." : "Add students"}
                {!saving && <ArrowRight />}
              </button>
              <button
                onClick={handleSkipRoster}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 5: Credentials + starter paths                           */}
        {/* ============================================================= */}
        {step === "credentials" && createdClasses.length > 0 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <CheckBadge />
                <span className="text-xs font-medium text-green-600">
                  Ready to teach
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Share {createdClasses.length === 1 ? "this" : "these"} with your
                class{createdClasses.length !== 1 ? "es" : ""}
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Students join with the class code, then log in with their
                username.{" "}
                {createdStudents.length > 0 &&
                  `We've created ${createdStudents.length} student account${createdStudents.length !== 1 ? "s" : ""}.`}
              </p>

              {/* Class code cards */}
              <div
                className={`grid gap-3 mb-4 ${
                  createdClasses.length === 1
                    ? "grid-cols-1"
                    : "grid-cols-1 sm:grid-cols-2"
                }`}
              >
                {createdClasses.map((cls) => (
                  <div
                    key={cls.classId}
                    className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 px-5 py-4"
                  >
                    <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-0.5">
                      Class code
                    </div>
                    <div className="text-3xl font-bold font-mono text-purple-900 tracking-wider">
                      {cls.classCode}
                    </div>
                    <div className="text-xs text-purple-500 mt-0.5">
                      {cls.className}
                    </div>
                  </div>
                ))}
              </div>

              {/* Student list */}
              {createdStudents.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Student logins
                    </span>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="text-xs text-purple-600 hover:text-purple-800 font-medium inline-flex items-center gap-1"
                    >
                      <PrinterIcon />
                      Print
                    </button>
                  </div>
                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-1.5 font-semibold">
                            Name
                          </th>
                          <th className="text-left px-3 py-1.5 font-semibold">
                            Username
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdStudents.map((s) => (
                          <tr
                            key={s.id}
                            className="border-t border-gray-100"
                          >
                            <td className="px-3 py-1.5 text-gray-900">
                              {s.displayName || "\u2014"}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-gray-700">
                              {s.username}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rosterSkipped.length > 0 && (
                    <p className="text-xs text-amber-600 mt-2">
                      {rosterSkipped.length} line
                      {rosterSkipped.length !== 1 ? "s" : ""} skipped (duplicate
                      usernames or empty). You can add them later from the class
                      page.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Starter paths */}
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                What&apos;s next?
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Pick one — you can always do the other later.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={() =>
                    completeAndGo(
                      `/teacher/units/create?classId=${createdClasses[0].classId}`
                    )
                  }
                  disabled={saving}
                  className="group text-left bg-white rounded-xl border-2 border-purple-200 hover:border-purple-400 p-4 transition-all hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background:
                          "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      }}
                    >
                      <SparkleIcon />
                    </div>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Recommended
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-0.5">
                    Create your first unit
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Describe what you want to teach and we&apos;ll draft a full
                    unit in minutes. You&apos;ll edit from there.
                  </div>
                </button>

                <button
                  onClick={() => completeAndGo("/teacher/dashboard")}
                  disabled={saving}
                  className="group text-left bg-white rounded-xl border-2 border-gray-200 hover:border-gray-300 p-4 transition-all hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                      <CompassIcon />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-0.5">
                    Explore the dashboard
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Look around first. Your classes are ready whenever you want
                    to come back.
                  </div>
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-400 text-center">
                Need help?{" "}
                <Link
                  href="/teacher/toolkit"
                  className="text-purple-600 hover:text-purple-800 font-medium"
                >
                  Browse the toolkit
                </Link>{" "}
                for ready-made lesson starters.
              </div>
            </div>
          </div>
        )}

        {/* Footer debug */}
        {teacherId && (
          <p className="text-[10px] text-gray-300 text-center mt-6">
            Teacher ID:{" "}
            <span className="font-mono">{teacherId.slice(0, 8)}...</span>
          </p>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Inline icon components
// ---------------------------------------------------------------------------

function StepDot({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  return (
    <div
      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
        done
          ? "bg-white text-purple-600"
          : active
            ? "bg-white/90 text-purple-600 ring-2 ring-white/60"
            : "bg-white/20 text-white/60"
      }`}
    >
      {done ? "\u2713" : label}
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22C55E"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function PrinterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#6B7280"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CameraIcon({ large }: { large?: boolean } = {}) {
  const s = large ? 28 : 18;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#7C3AED"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={large ? "mx-auto" : ""}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
