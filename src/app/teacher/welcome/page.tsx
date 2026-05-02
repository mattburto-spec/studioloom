"use client";

/**
 * /teacher/welcome — First-login onboarding wizard.
 *
 * Phase 1B of the ShipReady build plan. Teachers invited from
 * `/admin/teachers` land here on their first login because the teacher layout
 * redirect (in `src/app/teacher/layout.tsx`) pushes everyone with a NULL
 * `teachers.onboarded_at` to this route. Migration 083 adds that column.
 *
 * 5 visual steps (timetable-first flow, up to 6 logical steps):
 *   1. About you — name + school picker.
 *   2. Your timetable — upload photo (AI parse), paste iCal link, or skip.
 *   3. Your classes — from timetable (editable list + frameworks) OR manual
 *      create-first-class if timetable was skipped.
 *   3b. Calibrate (photo path only) — optional calendar link to keep
 *      schedule synced with holidays/cycle days. Skippable to Settings.
 *      iCal path auto-skips this step since they already have a link.
 *   4. Add students — roster paste for one class. Skippable.
 *   5. You're ready — class codes + printable student list + starter CTAs.
 *      "Go to dashboard" marks onboarded.
 *
 * Every step except the credentials screen is reversible via Back. Leaving
 * the page mid-flow is fine — the layout will pull them back here on their
 * next visit because `onboarded_at` stays NULL until the final
 * `/api/teacher/welcome/complete` call.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseRosterFile } from "@/lib/roster/parse-csv";
import { SchoolPicker, type PickerSchool } from "@/components/schools/SchoolPicker";

type Step = "name" | "timetable" | "classes" | "calibrate" | "roster" | "credentials";

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
  originalName: string;
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
  { id: "IB_PYP", label: "IB PYP", desc: "Primary Years - Exhibition" },
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

  // Phase 4.2 — domain-based auto-suggest. Populated from lookup-by-domain
  // call when the teacher's email maps to a verified school_domains row.
  //
  // Phase 4.7b-2 — banner is now TIER-AWARE:
  //   - subscription_tier='school' → "ask IT to invite you" (no auto-join);
  //     button creates a teacher_access_requests row + shows "request sent"
  //   - subscription_tier='free'|'pro' → no banner (target is someone's
  //     personal school; not joinable). UI never sees this case because
  //     personal schools don't have school_domains rows, but defence-in-depth.
  //   - subscription_tier='pilot'|'starter' → fall through to legacy
  //     "Use this school" auto-join behaviour (pre-tier-aware seed schools)
  const [domainSuggestion, setDomainSuggestion] = useState<{
    id: string;
    name: string;
    subscription_tier: string;
  } | null>(null);
  const [domainSuggestionDismissed, setDomainSuggestionDismissed] = useState(false);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [accessRequestSending, setAccessRequestSending] = useState(false);
  // Phase 4.3.y Bug B fix — track in-flight school_id persistence so we can
  // disable Next while the PATCH is mid-flight + surface failures inline.
  const [persistingSchool, setPersistingSchool] = useState(false);

  /**
   * Phase 4.3.y Bug B fix — persist teacher's school selection immediately.
   *
   * Without this, schools.school_id stays NULL until the wizard's step-5
   * /api/teacher/welcome/complete call. But step-3 create-class requires
   * a school context — every fresh teacher hit "Teacher missing school
   * context" 500 because the wizard delayed persistence to the end.
   *
   * Returns true on success, false on failure. Caller decides how to
   * surface failures (Next button blocks navigation; banner shows error).
   */
  const persistSchoolId = useCallback(
    async (schoolId: string | null): Promise<boolean> => {
      setPersistingSchool(true);
      try {
        const res = await fetch("/api/teacher/school", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId }),
        });
        if (!res.ok) {
          console.error(
            "[welcome] failed to persist school_id:",
            res.status,
            await res.text().catch(() => "")
          );
          return false;
        }
        return true;
      } catch (err) {
        console.error("[welcome] school persist error:", err);
        return false;
      } finally {
        setPersistingSchool(false);
      }
    },
    []
  );

  // Timetable (step 2)
  const [timetableMethod, setTimetableMethod] = useState<
    null | "photo" | "ical" | "skip"
  >(null);
  const [timetableUploading, setTimetableUploading] = useState(false);
  const [parseResult, setParseResult] = useState<TimetableParseResult | null>(null);
  const timetableFileRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  // iCal path
  const [icalUrl, setIcalUrl] = useState("");
  const [icalLoading, setIcalLoading] = useState(false);
  const [icalHolidays, setIcalHolidays] = useState<
    Array<{ date: string; label: string }>
  >([]);

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
  const [rosterChoice, setRosterChoice] = useState(false);
  const [savedRosterClassIds, setSavedRosterClassIds] = useState<Set<string>>(
    new Set()
  );

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
        } else if (user.email) {
          // Phase 4.2 — domain-based auto-suggest. Only fires when the
          // teacher hasn't already attached to a school. Free-email
          // domains are blocklisted at the DB level, so we don't filter
          // here — just trust the API response.
          const emailDomain = user.email.split("@")[1]?.toLowerCase();
          if (emailDomain) {
            try {
              const lookupRes = await fetch(
                `/api/schools/lookup-by-domain?domain=${encodeURIComponent(
                  emailDomain
                )}`
              );
              if (lookupRes.ok) {
                const json = await lookupRes.json();
                if (json?.match?.id && json?.match?.name) {
                  // Phase 4.7b-2 — only surface the banner for school-tier
                  // and legacy seed (pilot/starter) targets. free/pro
                  // schools are personal schools; not joinable.
                  const tier = json.match.subscription_tier ?? "pilot";
                  if (tier !== "free" && tier !== "pro") {
                    setDomainSuggestion({
                      id: json.match.id,
                      name: json.match.name,
                      subscription_tier: tier,
                    });
                  }
                }
              }
            } catch {
              // Silent — suggestion is a nice-to-have; falling back to
              // the regular search picker is fine.
            }
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
  // Simulated progress for timetable upload (~50s AI processing)
  // Curve: fast start → steady middle → slow crawl → jumps to 100 on finish
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!timetableUploading) {
      // When done (success or error), snap to 100 briefly then reset
      if (uploadProgress > 0 && uploadProgress < 100) {
        setUploadProgress(100);
        const reset = setTimeout(() => setUploadProgress(0), 600);
        return () => clearTimeout(reset);
      }
      return;
    }

    setUploadProgress(0);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000; // seconds
      let pct: number;
      if (elapsed < 5) {
        // 0–5s: fast ramp to 15% (immediate feedback)
        pct = (elapsed / 5) * 15;
      } else if (elapsed < 15) {
        // 5–15s: steady to 40%
        pct = 15 + ((elapsed - 5) / 10) * 25;
      } else if (elapsed < 30) {
        // 15–30s: moderate to 65%
        pct = 40 + ((elapsed - 15) / 15) * 25;
      } else if (elapsed < 50) {
        // 30–50s: slow crawl to 85%
        pct = 65 + ((elapsed - 30) / 20) * 20;
      } else {
        // 50s+: inch toward 92% max (never hits 100 on its own)
        pct = Math.min(92, 85 + (elapsed - 50) * 0.3);
      }
      setUploadProgress(Math.round(pct));
    }, 300);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetableUploading]);

  const uploadStageLabel = useCallback((pct: number) => {
    if (pct < 10) return "Uploading image...";
    if (pct < 30) return "Reading timetable structure...";
    if (pct < 55) return "Detecting classes and periods...";
    if (pct < 75) return "Identifying teaching slots...";
    if (pct < 90) return "Building your schedule...";
    return "Almost there...";
  }, []);

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
            originalName: dc.name,
            framework: "IB_MYP",
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
  // Step 2b: iCal import
  // ---------------------------------------------------------------------

  async function handleIcalImport() {
    if (!icalUrl.trim()) {
      setError("Paste your calendar link first.");
      return;
    }
    setError(null);
    setIcalLoading(true);

    try {
      const res = await fetch("/api/teacher/timetable/import-ical", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ical_url: icalUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Calendar import failed");
        return;
      }

      // The iCal link's purpose is importing holidays and cycle-day
      // markers — NOT matching classes. Classes come from the timetable
      // photo upload or manual creation. So holidays found = success.

      const holidays = data.holidayDetails || [];
      const excludedDates = data.excludedDates || [];
      setIcalHolidays(holidays);

      // If cycleDayEvents were found (rare — some school calendars tag
      // "Day 1", "Day 2" etc.), also extract those for the class list.
      const cycleDayMarkers = data.cycleDayEvents || [];

      // Bonus: if the calendar happens to contain class-level events,
      // extract them so the teacher can skip the timetable photo step.
      // But this is a bonus — the primary value is holidays.
      const classNames = new Map<string, number>();
      for (const m of data.meetings || []) {
        const key = m.className || m.class_name;
        if (key) classNames.set(key, (classNames.get(key) || 0) + 1);
      }

      if (classNames.size > 0) {
        const inferredCycleLength = cycleDayMarkers.length > 0
          ? Math.max(...cycleDayMarkers.map((m: { day: number }) => m.day))
          : 0;

        setDetectedClasses(
          Array.from(classNames.entries()).map(([name, count]) => ({
            name,
            originalName: name,
            grade: "",
            occurrences: count,
            is_teaching: true,
            framework: "IB_MYP",
            include: true,
          }))
        );

        setParseResult({
          cycle_length: inferredCycleLength || 5,
          periods: [],
          entries: (data.meetings || []).map(
            (m: { day?: number; period?: number; className?: string; class_name?: string; room?: string }) => ({
              day: m.day || 1,
              period: m.period || 1,
              class_name: m.className || m.class_name || "",
              grade_level: "",
              room: m.room || "",
              is_teaching: true,
              classification: "teaching",
              classification_reason: "From calendar",
            })
          ),
          detected_classes: [],
          ai_notes: `Imported from calendar. ${data.totalEvents || 0} events found, ${excludedDates.length} holidays detected.`,
        });
      } else if (holidays.length === 0 && excludedDates.length === 0) {
        // Truly empty — no holidays AND no classes. That's unusual.
        setError(
          `We found ${data.totalEvents || 0} events but couldn't detect any holidays or schedule data. ` +
          `Check that this is your school calendar (not a personal calendar).`
        );
      }
      // If holidays were found but no classes — that's the normal case.
      // icalHolidays is already set, the UI will show the success state.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Calendar import failed");
    } finally {
      setIcalLoading(false);
    }
  }

  // ---------------------------------------------------------------------
  // Step 3: Create classes (from timetable or manual)
  // ---------------------------------------------------------------------

  async function handleCreateClassesFromTimetable() {
    if (!parseResult) return;
    setError(null);
    setSaving(true);

    const includedClasses = detectedClasses.filter(
      (dc) => dc.include && dc.name.trim()
    );
    if (includedClasses.length === 0) {
      setError("Include at least one class with a name.");
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
            original_name: dc.originalName || undefined,
          })),
          timetable: {
            cycle_length: parseResult.cycle_length,
            periods: parseResult.periods,
            entries: parseResult.entries,
            ...(icalUrl.trim() && { ical_url: icalUrl.trim() }),
            ...(icalHolidays.length > 0 && {
              excluded_dates: icalHolidays.map((h) => h.date),
            }),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `Setup failed (HTTP ${res.status})`);
        return;
      }
      setCreatedClasses(data.classes || []);
      // iCal users already have a calendar link — skip calibration.
      // Photo users need a nudge to add one for proper schedule sync.
      setStep(timetableMethod === "ical" ? "roster" : "calibrate");
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
      setCreatedStudents((prev) => [...prev, ...(data.students || [])]);
      setRosterSkipped((prev) => [...prev, ...(data.skipped || [])]);
      setSavedRosterClassIds(
        (prev) => new Set([...prev, rosterClass.classId])
      );
      setRosterText("");
      setUploadInfo(null);
      // Single class? Advance automatically. Multi-class? Stay so they can do others.
      if (createdClasses.length <= 1) {
        setStep("credentials");
      }
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
        : step === "classes" || step === "calibrate"
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
              A few quick questions and you&apos;ll be ready to teach. You can
              change anything later.
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
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                What should we call you?
              </h2>
              <p className="text-sm text-gray-500">
                This appears on your dashboard, gradebooks, and anywhere
                students see your name.
              </p>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ms Burton"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
              autoFocus
            />

            {/* School appears once they've typed a name — progressive disclosure */}
            {name.trim().length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Which school are you at?{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>

                {/* Phase 4.2 + 4.7b-2 — tier-aware domain auto-suggest banner */}
                {domainSuggestion &&
                  !selectedSchool &&
                  !domainSuggestionDismissed &&
                  domainSuggestion.subscription_tier === "school" && (
                    <div className="mb-3 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                      <div className="text-xl leading-none">🏫</div>
                      <div className="flex-1 min-w-0">
                        {accessRequestSent ? (
                          <>
                            <p className="text-sm font-medium text-gray-900">
                              Access request sent to {domainSuggestion.name}.
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Your school admin will review your request. You
                              can continue setting up a personal workspace
                              while you wait — they can transfer your work
                              into the school account once approved.
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium text-gray-900">
                              {domainSuggestion.name} uses Loominary
                            </p>
                            <p className="text-xs text-gray-600 mt-0.5">
                              Your school is on a Loominary School plan.
                              Joining requires an invitation from your school
                              admin (usually IT). Request access below, or
                              continue with a personal workspace for now.
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                type="button"
                                disabled={accessRequestSending}
                                onClick={async () => {
                                  setAccessRequestSending(true);
                                  setError(null);
                                  try {
                                    const res = await fetch(
                                      "/api/teacher/welcome/request-school-access",
                                      {
                                        method: "POST",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          school_id: domainSuggestion.id,
                                        }),
                                      }
                                    );
                                    if (!res.ok && res.status !== 409) {
                                      const txt = await res.text();
                                      throw new Error(
                                        `Request failed (${res.status}): ${txt}`
                                      );
                                    }
                                    // 409 (duplicate) is fine — already sent
                                    setAccessRequestSent(true);
                                  } catch (e) {
                                    setError(
                                      `Couldn't send request: ${e instanceof Error ? e.message : "unknown"}`
                                    );
                                  } finally {
                                    setAccessRequestSending(false);
                                  }
                                }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                              >
                                {accessRequestSending
                                  ? "Sending…"
                                  : "Request access"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDomainSuggestionDismissed(true)
                                }
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                Continue without
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                {/* Legacy auto-join banner — pilot/starter tier only.
                    Will be retired when all seed schools are tier-flipped. */}
                {domainSuggestion &&
                  !selectedSchool &&
                  !domainSuggestionDismissed &&
                  domainSuggestion.subscription_tier !== "school" && (
                    <div className="mb-3 flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3">
                      <div className="text-xl leading-none">🎯</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          We found your school: {domainSuggestion.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Based on your email domain. You can search instead if
                          that&apos;s not right.
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={persistingSchool}
                            onClick={async () => {
                              // Re-fetch full school row for the picker shape
                              const supabase = createClient();
                              const { data } = await supabase
                                .from("schools")
                                .select(
                                  "id, name, city, country, ib_programmes, verified, source"
                                )
                                .eq("id", domainSuggestion.id)
                                .maybeSingle();
                              if (!data) {
                                setError(
                                  "Couldn't load that school. Please pick from the search instead."
                                );
                                return;
                              }
                              // Phase 4.3.y Bug B fix — persist school_id NOW
                              // so step-3 create-class has a school context.
                              const ok = await persistSchoolId(data.id);
                              if (!ok) {
                                setError(
                                  "Couldn't save your school. Please try again or use the search picker."
                                );
                                return;
                              }
                              setSelectedSchool(data as PickerSchool);
                              setDomainSuggestionDismissed(true);
                              setError(null);
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors"
                          >
                            {persistingSchool ? "Saving…" : "Use this school"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDomainSuggestionDismissed(true)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            Search instead
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                <SchoolPicker
                  value={selectedSchool}
                  onChange={setSelectedSchool}
                  placeholder="Start typing your school's name..."
                />
                <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
                  This helps connect you with co-teachers later. Can&apos;t find
                  yours? Pick &ldquo;Add it&rdquo; at the bottom.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  if (!name.trim()) {
                    setError("Please enter a name.");
                    return;
                  }
                  // Phase 4.3.y Bug B fix — if the teacher picked a school
                  // via SchoolPicker but didn't go through the banner path,
                  // persist their selection now (Next button is the moment
                  // of commit). Skip if school_id is already in sync (e.g.
                  // banner click already persisted) — but cheap to retry.
                  if (selectedSchool) {
                    const ok = await persistSchoolId(selectedSchool.id);
                    if (!ok) {
                      setError(
                        "Couldn't save your school. Please try again."
                      );
                      return;
                    }
                  }
                  setError(null);
                  setStep("timetable");
                }}
                disabled={!name.trim() || persistingSchool}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
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
        {/* Step 2: Your timetable — conversational branching flow         */}
        {/* ============================================================= */}
        {step === "timetable" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <input
              ref={timetableFileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleTimetableUpload}
              className="hidden"
            />

            {/* ── Phase 1: Method choice (no result yet) ── */}
            {!parseResult && !timetableMethod && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Let&apos;s set up your schedule
                  </h2>
                  <p className="text-sm text-gray-500">
                    This powers your daily class view, lesson scheduling, and
                    due dates. How would you like to get started?
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <button
                    onClick={() => {
                      setTimetableMethod("photo");
                      timetableFileRef.current?.click();
                    }}
                    disabled={timetableUploading}
                    className="group text-left rounded-xl border-2 border-purple-200 hover:border-purple-400 p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                        }}
                      >
                        <CameraIcon white />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">
                            Upload a photo of my timetable
                          </span>
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                            Fastest
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Snap a photo or screenshot. AI reads it and creates
                          your classes automatically.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setTimetableMethod("ical")}
                    className="group text-left rounded-xl border-2 border-gray-200 hover:border-blue-300 p-4 transition-all hover:shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                        <CalendarLinkIcon />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900">
                          Paste a calendar link
                        </span>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Got an iCal or Outlook calendar URL? We&apos;ll
                          import holidays so your cycle days stay accurate.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTimetableMethod("skip");
                      setError(null);
                      setStep("classes");
                    }}
                    className="group text-left rounded-xl border-2 border-gray-100 hover:border-gray-200 p-4 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors shrink-0">
                        <SkipIcon />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-600">
                          I&apos;ll set this up later
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">
                          You can always add your timetable from Settings.
                          You&apos;ll create classes manually next.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setError(null);
                    setStep("name");
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Back
                </button>
              </>
            )}

            {/* ── Phase 1b: Photo uploading state ── */}
            {!parseResult && timetableMethod === "photo" && (
              <>
                {timetableUploading ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    {/* Progress bar */}
                    <div className="w-full max-w-xs">
                      <div className="h-2 rounded-full bg-purple-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${uploadProgress}%`,
                            background: "linear-gradient(90deg, #7B2FF2, #A855F7)",
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-purple-700 font-medium">
                          {uploadStageLabel(uploadProgress)}
                        </span>
                        <span className="text-xs text-purple-400 font-mono tabular-nums">
                          {uploadProgress}%
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-gray-400 mt-1">
                      AI is reading your timetable — this usually takes 30–60 seconds
                    </span>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 mb-1">
                        Upload your timetable
                      </h2>
                      <p className="text-sm text-gray-500">
                        Take a photo or screenshot of your timetable. We accept
                        PNG, JPG, or PDF.
                      </p>
                    </div>
                    <div
                      onClick={() => timetableFileRef.current?.click()}
                      className="border-2 border-dashed border-purple-200 rounded-xl p-10 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition-all"
                    >
                      <CameraIcon large />
                      <p className="text-sm font-medium text-gray-700 mt-3">
                        Click to upload
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        We&apos;ll read it with AI and create your classes
                        automatically
                      </p>
                    </div>
                    <button
                      onClick={() => setTimetableMethod(null)}
                      className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Back
                    </button>
                  </>
                )}
              </>
            )}

            {/* ── Phase 1c: iCal URL input ── */}
            {!parseResult && timetableMethod === "ical" && icalHolidays.length === 0 && (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Paste your calendar link
                  </h2>
                  <p className="text-sm text-gray-500">
                    This is usually an iCal (.ics) URL from your school&apos;s
                    Outlook, Google Calendar, or ManageBac. We&apos;ll import
                    holidays so your cycle days stay accurate.
                  </p>
                </div>

                <div>
                  <input
                    type="url"
                    value={icalUrl}
                    onChange={(e) => setIcalUrl(e.target.value)}
                    placeholder="https://outlook.office365.com/owa/calendar/..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all text-sm font-mono"
                    autoFocus
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                    Look for &quot;Subscribe to calendar&quot; or
                    &quot;Share calendar link&quot; in your school&apos;s calendar
                    app. The URL usually ends in <code>.ics</code>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleIcalImport}
                    disabled={icalLoading || !icalUrl.trim()}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                    style={{
                      background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                      boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    {icalLoading ? "Importing..." : "Import calendar"}
                    {!icalLoading && <ArrowRight />}
                  </button>
                  <button
                    onClick={() => {
                      setTimetableMethod(null);
                      setIcalUrl("");
                      setError(null);
                    }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Back
                  </button>
                </div>

                <div className="rounded-lg bg-blue-50/50 border border-blue-100 px-4 py-3">
                  <p className="text-[11px] text-blue-600 font-medium mb-1">
                    Don&apos;t have a calendar link?
                  </p>
                  <p className="text-[11px] text-gray-500">
                    No worries — go back and try uploading a photo of your
                    timetable instead. You can always add a calendar link
                    later in Settings to keep cycle days accurate.
                  </p>
                </div>
              </>
            )}

            {/* ── Phase 1d: iCal success — holidays imported, no classes ── */}
            {/* Normal case: school calendars have holidays but not individual class periods */}
            {!parseResult && timetableMethod === "ical" && icalHolidays.length > 0 && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  <span className="font-semibold">Calendar linked</span>
                  {" \u2014 "}{icalHolidays.length} holiday{icalHolidays.length !== 1 ? "s" : ""} imported.
                  Cycle days will stay accurate through holidays and schedule changes.
                </div>

                <div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">
                    Now let&apos;s set up your classes
                  </h2>
                  <p className="text-sm text-gray-500">
                    Your calendar has holidays but not individual class
                    periods — that&apos;s normal. You&apos;ll create your
                    classes in the next step.
                  </p>
                </div>

                <div className="flex items-center gap-3">
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
                    Continue
                    <ArrowRight />
                  </button>
                  <button
                    onClick={() => {
                      setTimetableMethod(null);
                      setIcalUrl("");
                      setIcalHolidays([]);
                      setError(null);
                    }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Start over
                  </button>
                </div>
              </>
            )}

            {/* ── Phase 2: Results (from photo or iCal) ── */}
            {parseResult && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                  <span className="font-semibold">
                    {timetableMethod === "ical" ? "Calendar imported" : `Detected ${parseResult.cycle_length}-day cycle`}
                  </span>
                  {timetableMethod !== "ical" && (
                    <>
                      {" with "}
                      <span className="font-semibold">
                        {teachingSlotCount} teaching slot{teachingSlotCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {icalHolidays.length > 0 && (
                    <span className="text-green-600">
                      {" \u00b7 "}{icalHolidays.length} holiday{icalHolidays.length !== 1 ? "s" : ""} imported
                    </span>
                  )}
                </div>

                {/* Editable class list */}
                {detectedClasses.length > 0 && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 mb-0.5">
                        Your classes
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        Untick non-teaching entries, edit names, pick a
                        framework, or add a class.
                      </p>
                    </div>

                    <div className="space-y-2">
                      {detectedClasses.map((dc, i) => (
                        <div
                          key={i}
                          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-all ${
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
                              next[i] = {
                                ...next[i],
                                include: e.target.checked,
                              };
                              setDetectedClasses(next);
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 shrink-0"
                          />

                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={dc.name}
                              onChange={(e) => {
                                const next = [...detectedClasses];
                                next[i] = {
                                  ...next[i],
                                  name: e.target.value,
                                };
                                setDetectedClasses(next);
                              }}
                              disabled={!dc.include}
                              placeholder="Class name"
                              className="w-full text-sm font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-purple-400 focus:outline-none focus:ring-0 px-0 py-0.5 disabled:text-gray-400 transition-colors placeholder:text-gray-300 placeholder:font-normal"
                            />
                            <div className="text-[11px] text-gray-400 mt-0.5">
                              {dc.grade ? (
                                <>{dc.grade} &middot; </>
                              ) : null}
                              {dc.occurrences > 0 ? (
                                <>{dc.occurrences}x per cycle</>
                              ) : (
                                !dc.grade && (
                                  <span className="text-purple-400 italic">
                                    Added manually
                                  </span>
                                )
                              )}
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
                              next[i] = {
                                ...next[i],
                                framework: e.target.value,
                              };
                              setDetectedClasses(next);
                            }}
                            disabled={!dc.include}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium bg-white disabled:bg-gray-50 disabled:text-gray-400 shrink-0"
                          >
                            {FRAMEWORKS.map((fw) => (
                              <option key={fw.id} value={fw.id}>
                                {fw.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => {
                              setDetectedClasses(
                                detectedClasses.filter(
                                  (_, idx) => idx !== i
                                )
                              );
                            }}
                            className="text-gray-300 hover:text-red-400 transition-colors p-0.5 shrink-0"
                            title="Remove"
                          >
                            <XIcon />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setDetectedClasses([
                          ...detectedClasses,
                          {
                            name: "",
                            originalName: "",
                            grade: "",
                            occurrences: 0,
                            is_teaching: true,
                            framework: "IB_MYP",
                            include: true,
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      <PlusIcon /> Add a class
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-1">
                  {detectedClasses.length > 0 && (
                    <button
                      onClick={handleCreateClassesFromTimetable}
                      disabled={
                        saving ||
                        detectedClasses.filter(
                          (dc) => dc.include && dc.name.trim()
                        ).length === 0
                      }
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                      style={{
                        background:
                          "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                        boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                      }}
                    >
                      {saving
                        ? "Creating..."
                        : `Create ${
                            detectedClasses.filter(
                              (dc) => dc.include && dc.name.trim()
                            ).length
                          } class${
                            detectedClasses.filter(
                              (dc) => dc.include && dc.name.trim()
                            ).length !== 1
                              ? "es"
                              : ""
                          }`}
                      {!saving && <ArrowRight />}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setParseResult(null);
                      setDetectedClasses([]);
                      setTimetableMethod(null);
                      setIcalUrl("");
                      setIcalHolidays([]);
                      setError(null);
                    }}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Start over
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 3: Your classes                                           */}
        {/* ============================================================= */}
        {/* ============================================================= */}
        {/* Step 3: Create first class (manual — timetable was skipped)    */}
        {/* ============================================================= */}
        {step === "classes" && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Let&apos;s add a class
              </h2>
              <p className="text-sm text-gray-500">
                You can add more classes later. We&apos;ll generate a join
                code students use to enroll.
              </p>
            </div>

            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Grade 8 Design"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all text-sm"
              autoFocus
            />

            {/* Framework appears once they've typed a name — progressive disclosure */}
            {className.trim().length > 0 && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Which curriculum framework?
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
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    How long are your periods?
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
              </>
            )}

            <div className="flex items-center gap-3">
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
                  setTimetableMethod(null);
                  setStep("timetable");
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 3b: Calibrate schedule (timetable-photo path only)        */}
        {/* ============================================================= */}
        {step === "calibrate" && timetableMethod !== "ical" && createdClasses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            {/* Success banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
              <span className="font-semibold">
                {createdClasses.length === 1
                  ? `${createdClasses[0].className} created`
                  : `${createdClasses.length} classes created`}
              </span>
              {" from your timetable \u2014 nice!"}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Keep your cycle days accurate?
              </h2>
              <p className="text-sm text-gray-500">
                We know which classes are on each day of your cycle. But
                without a calendar link, holidays and schedule changes can
                make the cycle day drift — so Day 5 might show as Day 6
                after a long weekend.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => {
                  setTimetableMethod("ical");
                }}
                className="group text-left rounded-xl border-2 border-blue-200 hover:border-blue-400 p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors shrink-0">
                    <CalendarLinkIcon />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900">
                        Add a calendar link
                      </span>
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        Recommended
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Paste an iCal link from Outlook, Google Calendar, or
                      ManageBac. Holidays are imported so cycle days stay
                      correct.
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setStep("roster")}
                className="group text-left rounded-xl border-2 border-gray-100 hover:border-gray-200 p-4 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors shrink-0">
                    <SkipIcon />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-600">
                      I&apos;ll do this later in Settings
                    </span>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Your schedule will work, but cycle days may drift
                      after holidays. Fix it anytime in Settings &rarr; Timetable.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Calibrate step — iCal input (shown when they chose "Add a calendar link") */}
        {step === "calibrate" && timetableMethod === "ical" && createdClasses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">
                Paste your calendar link
              </h3>
              <p className="text-[11px] text-gray-500">
                Look for &quot;Subscribe to calendar&quot; or &quot;Share
                calendar link&quot; in your school&apos;s calendar app. The
                URL usually ends in <code>.ics</code>
              </p>
            </div>

            <input
              type="url"
              value={icalUrl}
              onChange={(e) => setIcalUrl(e.target.value)}
              placeholder="https://outlook.office365.com/owa/calendar/..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all text-sm font-mono"
              autoFocus
            />

            {icalHolidays.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
                <span className="font-semibold">Calendar linked</span>
                {" \u2014 "}{icalHolidays.length} holiday{icalHolidays.length !== 1 ? "s" : ""} imported.
                Cycle days will stay accurate through holidays and schedule changes.
              </div>
            )}

            <div className="flex items-center gap-3">
              {icalHolidays.length > 0 ? (
                <button
                  onClick={() => {
                    // Save the iCal URL + holidays to the existing timetable
                    fetch("/api/teacher/timetable", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ical_url: icalUrl.trim(),
                        excluded_dates: icalHolidays.map((h) => h.date),
                        source: "ical",
                      }),
                    }).catch(() => {});
                    setStep("roster");
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                    boxShadow: "0 4px 14px rgba(123, 47, 242, 0.3)",
                  }}
                >
                  Continue
                  <ArrowRight />
                </button>
              ) : (
                <button
                  onClick={async () => {
                    // Import iCal and save to existing timetable
                    await handleIcalImport();
                  }}
                  disabled={icalLoading || !icalUrl.trim()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                    boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)",
                  }}
                >
                  {icalLoading ? "Importing..." : "Import calendar"}
                  {!icalLoading && <ArrowRight />}
                </button>
              )}
              <button
                onClick={() => {
                  setTimetableMethod("photo"); // Reset back to photo so choice cards show
                  setIcalUrl("");
                  setIcalHolidays([]);
                  setError(null);
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 4: Add students (roster)                                  */}
        {/* ============================================================= */}
        {step === "roster" && createdClasses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            {/* Success banner */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-sm text-green-800">
              <span className="font-semibold">
                {createdClasses.length === 1
                  ? `${createdClasses[0].className} created`
                  : `${createdClasses.length} classes created`}
              </span>
              {" \u2014 nice work!"}
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                Do you want to add students now?
              </h2>
              <p className="text-sm text-gray-500">
                You can paste a class list or upload a CSV. Students will be
                able to log in right away.
              </p>
            </div>

            {!rosterChoice ? (
              /* ── Choice gate — card style ── */
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={() => setRosterChoice(true)}
                  className="group text-left rounded-xl border-2 border-purple-200 hover:border-purple-400 p-4 transition-all hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background:
                          "linear-gradient(135deg, #7B2FF2, #5C16C5)",
                      }}
                    >
                      <RosterIcon />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-900">
                        Yes, add students now
                      </span>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Paste names or upload a CSV. Takes about 30 seconds
                        per class.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setStep("credentials")}
                  className="group text-left rounded-xl border-2 border-gray-100 hover:border-gray-200 p-4 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-gray-100 transition-colors shrink-0">
                      <SkipIcon />
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600">
                        I&apos;ll add them later
                      </span>
                      <p className="text-xs text-gray-400 mt-0.5">
                        You can add students anytime from each class page.
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            ) : (
              /* ── Roster form ── */
              <>
                {/* Saved indicator */}
                {savedRosterClassIds.size > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-700">
                    Students added to:{" "}
                    {createdClasses
                      .filter((c) => savedRosterClassIds.has(c.classId))
                      .map((c) => c.className)
                      .join(", ")}
                  </div>
                )}

                {/* Class picker (only if multiple classes) */}
                {createdClasses.length > 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      Add students to
                    </label>
                    <select
                      value={rosterClassIndex}
                      onChange={(e) =>
                        setRosterClassIndex(Number(e.target.value))
                      }
                      className="border border-gray-200 rounded-xl px-3 py-2 text-sm w-full"
                    >
                      {createdClasses.map((cls, i) => (
                        <option key={cls.classId} value={i}>
                          {cls.className} ({cls.classCode})
                          {savedRosterClassIds.has(cls.classId) ? " ✓" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-500">
                      Roster
                      {rosterClass && createdClasses.length > 1 && (
                        <span className="text-gray-400 font-normal">
                          {" "}
                          for {rosterClass.className}
                        </span>
                      )}
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
                    usernames from full names (e.g. &ldquo;John Smith&rdquo;{" "}
                    &rarr; <code>jsmith</code>). CSV uploads recognise columns
                    like <code>Name</code>, <code>First Name</code>/
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
                    {saving
                      ? "Adding..."
                      : `Add to ${rosterClass?.className || "class"}`}
                    {!saving && <ArrowRight />}
                  </button>
                  <button
                    onClick={() => setStep("credentials")}
                    className="text-sm text-gray-500 hover:text-gray-700 transition-colors underline underline-offset-2"
                  >
                    {savedRosterClassIds.size > 0
                      ? "Done \u2014 see class codes"
                      : "Skip for now"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ============================================================= */}
        {/* Step 5: Credentials + starter paths                           */}
        {/* ============================================================= */}
        {step === "credentials" && createdClasses.length > 0 && (
          <div className="bg-white rounded-2xl p-6 border border-border shadow-sm space-y-5">
            {/* Celebration header */}
            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                <CheckBadge large />
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-1">
                You&apos;re all set!
              </h2>
              <p className="text-sm text-gray-500">
                {createdClasses.length === 1
                  ? `Your class "${createdClasses[0].className}" is ready to go.`
                  : `Your ${createdClasses.length} classes are ready to go.`}
                {createdStudents.length > 0 &&
                  ` ${createdStudents.length} student account${createdStudents.length !== 1 ? "s" : ""} created.`}
              </p>
            </div>

            {/* Compact class summary — collapsible if many classes */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-semibold">Class</th>
                    <th className="text-left px-3 py-1.5 font-semibold">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {createdClasses.map((cls) => (
                    <tr key={cls.classId} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-900">{cls.className}</td>
                      <td className="px-3 py-1.5 font-mono text-purple-700 font-semibold tracking-wide">{cls.classCode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Class codes are on each class page — share with students when
              you&apos;re ready.
            </p>

            {/* Student list (only if they added any) */}
            {createdStudents.length > 0 && (
              <div>
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

            {/* What's next — integrated into same card */}
            <div className="pt-3 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                What would you like to do first?
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Pick one — you can always do the others later.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                    Create a unit with AI
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Describe what you want to teach and we&apos;ll draft a full
                    unit in minutes.
                  </div>
                </button>

                <button
                  onClick={() =>
                    completeAndGo("/teacher/library/import")
                  }
                  disabled={saving}
                  className="group text-left bg-white rounded-xl border-2 border-gray-200 hover:border-gray-300 p-4 transition-all hover:shadow-md disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-purple-50 transition-colors">
                      <UploadUnitIcon />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gray-900 mb-0.5">
                    Upload existing unit
                  </div>
                  <div className="text-xs text-gray-500 leading-relaxed">
                    Paste or upload a unit plan you already have and
                    we&apos;ll import it.
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
                    Look around first. Your classes are ready whenever you
                    want to come back.
                  </div>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-gray-400 text-center">
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

function CheckBadge({ large }: { large?: boolean } = {}) {
  const s = large ? 24 : 16;
  return (
    <svg
      width={s}
      height={s}
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

function RosterIcon() {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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

function UploadUnitIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="12" y2="12" />
      <line x1="15" y1="15" x2="12" y2="12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CameraIcon({ large, white }: { large?: boolean; white?: boolean } = {}) {
  const s = large ? 28 : 18;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={white ? "white" : "#7C3AED"}
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

function CalendarLinkIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#3B82F6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9CA3AF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
    </svg>
  );
}
