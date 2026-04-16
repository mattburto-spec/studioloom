"use client";

/**
 * /teacher/welcome — First-login onboarding wizard.
 *
 * Phase 1B of the ShipReady build plan. Teachers invited from
 * `/admin/teachers` land here on their first login because the teacher layout
 * redirect (in `src/app/teacher/layout.tsx`) pushes everyone with a NULL
 * `teachers.onboarded_at` to this route. Migration 083 adds that column.
 *
 * 5 steps:
 *   1. Confirm name — prefilled from `teachers.name` (set from the invite's
 *      raw_user_meta_data.name). Editable.
 *   2. Create first class — name, framework, period length.
 *   3. Timetable — upload photo (AI parse), manual grid, or iCal. Skippable.
 *   4. Roster paste — optional. Teachers can skip and add students later.
 *   5. Credentials — class code + printable student list + starter-path CTAs
 *      (generate with AI or start blank). "Go to dashboard" marks onboarded.
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
import {
  TimetableGrid,
  type ClassMeetingEntry,
} from "@/components/teacher/TimetableGrid";

type Step = "name" | "class" | "timetable" | "roster" | "credentials";

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

// Keep in sync with VALID_FRAMEWORKS in /api/teacher/welcome/create-class.
const FRAMEWORKS = [
  { id: "IB_MYP", label: "IB MYP", desc: "Design cycle · Criteria A–D" },
  { id: "GCSE_DT", label: "GCSE D&T", desc: "AO1–AO5 assessment" },
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

  // Class
  const [className, setClassName] = useState("");
  const [framework, setFramework] = useState("IB_MYP");
  const [periodMinutes, setPeriodMinutes] = useState(60);
  const [createdClass, setCreatedClass] = useState<CreatedClass | null>(null);

  // Roster
  const [rosterText, setRosterText] = useState("");
  const [createdStudents, setCreatedStudents] = useState<CreatedStudent[]>([]);
  const [rosterSkipped, setRosterSkipped] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadInfo, setUploadInfo] = useState<{
    filename: string;
    count: number;
    usedHeaders: boolean;
  } | null>(null);

  // Timetable
  const [timetableMode, setTimetableMode] = useState<
    "pick" | "upload" | "manual" | "ical"
  >("pick");
  const [cycleLength, setCycleLength] = useState(5);
  const [anchorDate, setAnchorDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [anchorCycleDay, setAnchorCycleDay] = useState(1);
  const [classMeetings, setClassMeetings] = useState<ClassMeetingEntry[]>([]);
  const [icalUrl, setIcalUrl] = useState("");
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [timetableUploading, setTimetableUploading] = useState(false);
  const [timetableSaved, setTimetableSaved] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiParseResult, setAiParseResult] = useState<any>(null);
  const timetableFileRef = useRef<HTMLInputElement>(null);

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
  // Actions
  // ---------------------------------------------------------------------

  // -------------------------------------------------------------------
  // Timetable handlers
  // -------------------------------------------------------------------

  async function handleTimetablePhotoUpload(
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
      const data = await res.json();
      setAiParseResult(data);
      setCycleLength(data.cycle_length || 5);

      // Convert AI entries into ClassMeetingEntry format
      if (data.entries?.length && createdClass) {
        const meetings: ClassMeetingEntry[] = data.entries
          .filter((e: { is_teaching: boolean }) => e.is_teaching)
          .map((e: { day: number; period: number }) => ({
            class_id: createdClass.classId,
            cycle_day: e.day,
            period_number: e.period,
          }));
        setClassMeetings(meetings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setTimetableUploading(false);
      if (timetableFileRef.current) timetableFileRef.current.value = "";
    }
  }

  async function handleIcalImport() {
    if (!icalUrl.trim()) return;
    setError(null);
    setTimetableUploading(true);

    try {
      const res = await fetch("/api/teacher/timetable/import-ical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_url: icalUrl.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "iCal import failed");
      }
      const data = await res.json();

      // Convert meetings to ClassMeetingEntry with the created class
      if (data.meetings?.length && createdClass) {
        const meetings: ClassMeetingEntry[] = data.meetings.map(
          (m: { cycle_day: number; period_number?: number }) => ({
            class_id: createdClass.classId,
            cycle_day: m.cycle_day,
            period_number: m.period_number || "",
          })
        );
        setClassMeetings(meetings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setTimetableUploading(false);
    }
  }

  async function handleSaveTimetable() {
    setTimetableSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/teacher/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_length: cycleLength,
          anchor_date: anchorDate,
          anchor_cycle_day: anchorCycleDay,
          meetings: classMeetings,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Save failed");
      }
      setTimetableSaved(true);
      setStep("roster");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setTimetableSaving(false);
    }
  }

  async function handleCreateClass() {
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
      setCreatedClass({
        classId: data.classId,
        classCode: data.classCode,
        className: className.trim(),
      });
      setStep("timetable");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddRoster() {
    if (!createdClass) return;
    setError(null);
    setSaving(true);

    // Parse lines now so the user sees the preview before we submit. The
    // server re-parses and handles dedup — we just hand it raw name/username
    // pairs.
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
          classId: createdClass.classId,
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
   *
   * If the teacher already has text in the box, append rather than replace —
   * lets them combine a SIS export with a few manually-typed names.
   */
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    // 1 MB guard — a class of 500 students in CSV form is only ~25 KB, so
    // anything larger is almost certainly the wrong file.
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

      // Append to existing text if the textarea isn't empty, so uploads don't
      // clobber manual entries.
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
      // Reset so the same file can be re-selected (change event won't fire
      // for the same value).
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearUploadInfo() {
    setUploadInfo(null);
  }

  /**
   * Fire the /complete endpoint to flip `onboarded_at`, then navigate to the
   * given destination. Target is either the dashboard or the create-unit
   * flow depending on which CTA the teacher picks on the credentials step.
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
      // Non-blocking — the layout will redirect them back here if it didn't
      // stick, which lets them retry from the credentials screen.
      console.warn("[welcome] complete failed:", err);
    } finally {
      // Full navigation (not router.push) so the layout re-fetches the teacher
      // and picks up the new onboarded_at without a stale cached value.
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
          <span className="text-sm text-text-secondary">Loading…</span>
        </div>
      </div>
    );
  }

  const stepNumber =
    step === "name"
      ? 1
      : step === "class"
        ? 2
        : step === "timetable"
          ? 3
          : step === "roster"
            ? 4
            : 5;

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

        {/* Step 1: Confirm name + pick school */}
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
              placeholder="Start typing your school's name…"
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
                  setStep("class");
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                Next — Create your first class
                <ArrowRight />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: First class */}
        {step === "class" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Your first class</h2>
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
                    <div className="text-xs font-bold text-gray-900">{fw.label}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{fw.desc}</div>
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
                onClick={handleCreateClass}
                disabled={saving || !className.trim()}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                style={{
                  background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                  boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                }}
              >
                {saving ? "Creating…" : "Create class"}
                {!saving && <ArrowRight />}
              </button>
              <button
                onClick={() => {
                  setError(null);
                  setStep("name");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Timetable */}
        {step === "timetable" && createdClass && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CheckBadge />
                <span className="text-xs font-medium text-green-600">
                  {createdClass.className} created — join code{" "}
                  <code className="font-mono font-bold">
                    {createdClass.classCode}
                  </code>
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Your timetable
              </h2>
              <p className="text-sm text-gray-500">
                Tell us when you teach so we can show today&apos;s and
                tomorrow&apos;s classes on your dashboard.
              </p>
            </div>

            {/* Mode picker */}
            {timetableMode === "pick" && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTimetableMode("upload")}
                  className="text-left p-4 rounded-xl border-2 border-purple-200 hover:border-purple-400 bg-white transition-all hover:shadow-md"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                    <CameraIcon />
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    Upload a photo
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Snap a photo of your printed timetable and we&apos;ll read it
                    automatically.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimetableMode("manual")}
                  className="text-left p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 bg-white transition-all hover:shadow-md"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                    <GridIcon />
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    Enter manually
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Set your cycle length and click cells to add class meetings.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTimetableMode("ical")}
                  className="text-left p-4 rounded-xl border-2 border-gray-200 hover:border-gray-300 bg-white transition-all hover:shadow-md"
                >
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-2">
                    <CalendarIcon />
                  </div>
                  <div className="text-sm font-bold text-gray-900">
                    Import calendar
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                    Paste an Outlook 365, Google Calendar, or .ics URL.
                  </div>
                </button>
              </div>
            )}

            {/* Upload mode */}
            {timetableMode === "upload" && (
              <div className="space-y-4">
                <input
                  ref={timetableFileRef}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleTimetablePhotoUpload}
                  className="hidden"
                />

                {!aiParseResult ? (
                  <div
                    onClick={() => timetableFileRef.current?.click()}
                    className="border-2 border-dashed border-purple-200 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-all"
                  >
                    {timetableUploading ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-purple-700 font-medium">
                          Reading your timetable…
                        </span>
                      </div>
                    ) : (
                      <>
                        <CameraIcon large />
                        <p className="text-sm font-medium text-gray-700 mt-2">
                          Click to upload a photo or PDF
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          We&apos;ll extract your schedule automatically
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
                      <span className="font-semibold">
                        ✓ Detected {aiParseResult.cycle_length}-day cycle
                      </span>
                      {aiParseResult.entries?.length > 0 && (
                        <span>
                          {" "}
                          with{" "}
                          {
                            aiParseResult.entries.filter(
                              (e: { is_teaching: boolean }) => e.is_teaching
                            ).length
                          }{" "}
                          teaching slots
                        </span>
                      )}
                    </div>

                    {/* Cycle length control */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-gray-500">
                        Cycle length
                      </label>
                      <select
                        value={cycleLength}
                        onChange={(e) =>
                          setCycleLength(Number(e.target.value))
                        }
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                      >
                        {Array.from({ length: 19 }, (_, i) => i + 2).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n} days
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <TimetableGrid
                      cycleLength={cycleLength}
                      meetings={classMeetings}
                      classes={[
                        {
                          id: createdClass.classId,
                          name: createdClass.className,
                        },
                      ]}
                      onMeetingsChange={setClassMeetings}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Manual mode */}
            {timetableMode === "manual" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Days in cycle
                    </label>
                    <select
                      value={cycleLength}
                      onChange={(e) =>
                        setCycleLength(Number(e.target.value))
                      }
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    >
                      {Array.from({ length: 19 }, (_, i) => i + 2).map(
                        (n) => (
                          <option key={n} value={n}>
                            {n} days
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Anchor date
                    </label>
                    <input
                      type="date"
                      value={anchorDate}
                      onChange={(e) => setAnchorDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      That date is Day…
                    </label>
                    <select
                      value={anchorCycleDay}
                      onChange={(e) =>
                        setAnchorCycleDay(Number(e.target.value))
                      }
                      className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                    >
                      {Array.from({ length: cycleLength }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={n}>
                            Day {n}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <TimetableGrid
                  cycleLength={cycleLength}
                  meetings={classMeetings}
                  classes={[
                    {
                      id: createdClass.classId,
                      name: createdClass.className,
                    },
                  ]}
                  onMeetingsChange={setClassMeetings}
                />
              </div>
            )}

            {/* iCal mode */}
            {timetableMode === "ical" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    Calendar URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={icalUrl}
                      onChange={(e) => setIcalUrl(e.target.value)}
                      placeholder="https://outlook.office365.com/owa/calendar/…"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
                    />
                    <button
                      onClick={handleIcalImport}
                      disabled={timetableUploading || !icalUrl.trim()}
                      className="px-4 py-2.5 text-sm font-semibold text-white rounded-xl disabled:opacity-50"
                      style={{
                        background:
                          "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      }}
                    >
                      {timetableUploading ? "Importing…" : "Import"}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Works with Outlook 365, Google Calendar, and any .ics URL.
                  </p>
                </div>

                {classMeetings.length > 0 && (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
                      ✓ Found {classMeetings.length} class meeting
                      {classMeetings.length !== 1 ? "s" : ""}
                    </div>
                    <TimetableGrid
                      cycleLength={cycleLength}
                      meetings={classMeetings}
                      classes={[
                        {
                          id: createdClass.classId,
                          name: createdClass.className,
                        },
                      ]}
                      onMeetingsChange={setClassMeetings}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Bottom buttons */}
            <div className="flex items-center gap-3 pt-1">
              {timetableMode !== "pick" && classMeetings.length > 0 && (
                <button
                  onClick={handleSaveTimetable}
                  disabled={timetableSaving}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                    boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                  }}
                >
                  {timetableSaving ? "Saving…" : "Save timetable"}
                  {!timetableSaving && <ArrowRight />}
                </button>
              )}
              {timetableMode !== "pick" && (
                <button
                  onClick={() => {
                    setTimetableMode("pick");
                    setAiParseResult(null);
                    setClassMeetings([]);
                    setError(null);
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  ← Back to options
                </button>
              )}
              <button
                onClick={() => {
                  setError(null);
                  setStep("roster");
                }}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
              >
                Skip — set up in Settings
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Roster */}
        {step === "roster" && createdClass && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <CheckBadge />
                <span className="text-xs font-medium text-green-600">
                  {createdClass.className} created — join code{" "}
                  <code className="font-mono font-bold">{createdClass.classCode}</code>
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Add your students</h2>
              <p className="text-sm text-gray-500">
                Paste one per line. You can always add more later from the class page.
              </p>
            </div>

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
                    <span className="font-semibold">✓ Loaded {uploadInfo.count} student{uploadInfo.count !== 1 ? "s" : ""}</span>
                    {" from "}
                    <span className="font-mono text-green-900">{uploadInfo.filename}</span>
                    {uploadInfo.usedHeaders && (
                      <span className="text-green-600"> (using column headers)</span>
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
                placeholder={`John Smith\nMaria Garcia\njdoe, Jane Doe\n\n— or click “Upload CSV” to import from a file`}
                rows={8}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm font-mono"
              />
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                Accepts <code>Full Name</code>, <code>username</code>, or{" "}
                <code>username, Full Name</code>. We&apos;ll auto-generate
                usernames from full names (e.g. &ldquo;John Smith&rdquo; → <code>jsmith</code>).
                CSV uploads recognise columns like <code>Name</code>, <code>First Name</code>/<code>Last Name</code>, <code>Username</code>, <code>Email</code>.
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
                {saving ? "Adding…" : "Add students"}
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

        {/* Step 5: Credentials + starter paths */}
        {step === "credentials" && createdClass && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <CheckBadge />
                <span className="text-xs font-medium text-green-600">Ready to teach</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Share this with your class
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Students join with the class code, then log in with their
                username.{" "}
                {createdStudents.length > 0 &&
                  `We've created ${createdStudents.length} student account${createdStudents.length !== 1 ? "s" : ""}.`}
              </p>

              {/* Code card */}
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 px-5 py-4 mb-4">
                <div className="text-[11px] font-semibold text-purple-600 uppercase tracking-wide mb-0.5">
                  Class code
                </div>
                <div className="text-3xl font-bold font-mono text-purple-900 tracking-wider">
                  {createdClass.classCode}
                </div>
                <div className="text-xs text-purple-500 mt-0.5">
                  {createdClass.className}
                </div>
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
                          <th className="text-left px-3 py-1.5 font-semibold">Name</th>
                          <th className="text-left px-3 py-1.5 font-semibold">Username</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdStudents.map((s) => (
                          <tr key={s.id} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 text-gray-900">
                              {s.displayName || "—"}
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
                      {rosterSkipped.length} line{rosterSkipped.length !== 1 ? "s" : ""} skipped
                      (duplicate usernames or empty). You can add them later
                      from the class page.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Starter paths — Phase 1B-3 */}
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
                      `/teacher/units/create?classId=${createdClass.classId}`
                    )
                  }
                  disabled={saving}
                  className="group text-left bg-white rounded-xl border-2 border-purple-200 hover:border-purple-400 p-4 transition-all hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      }}
                    >
                      <SparkleIcon />
                    </div>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Recommended
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-0.5">
                    Generate your first unit with AI
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
                    Look around first. Your class is ready whenever you want to
                    come back.
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

        {/* Footer — debug note for dev. Remove before shipping if not useful. */}
        {teacherId && (
          <p className="text-[10px] text-gray-300 text-center mt-6">
            Teacher ID: <span className="font-mono">{teacherId.slice(0, 8)}…</span>
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
      {done ? "✓" : label}
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
      stroke={large ? "#7C3AED" : "#7C3AED"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2563EB"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#059669"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
