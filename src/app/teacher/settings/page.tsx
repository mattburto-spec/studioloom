"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { LMSProviderType } from "@/types";
import { SchoolCalendarSetup } from "@/components/teacher/SchoolCalendarSetup";
import ICalPreview from "@/components/teacher/ICalPreview";
import type { ICalImportData, CycleConfig } from "@/components/teacher/ICalPreview";
import { TimetableGrid } from "@/components/teacher/TimetableGrid";
import type { ClassMeetingEntry } from "@/components/teacher/TimetableGrid";

type SettingsTab = "general" | "school" | "timetable" | "workshop" | "lms" | "ai";

/* ── Common D&T tools/machines (checkbox presets) ── */
const COMMON_TOOLS: { category: string; items: string[] }[] = [
  { category: "Hand Tools", items: ["Coping saw", "Tenon saw", "Files & rasps", "Chisels", "Hammers", "Pliers", "Screwdrivers", "Hand drill", "Craft knife", "Scissors", "Hot glue gun", "Soldering iron"] },
  { category: "Power Tools", items: ["Pillar drill", "Band saw", "Scroll saw", "Belt/disc sander", "Bench grinder", "Jigsaw"] },
  { category: "Machines", items: ["Laser cutter", "3D printer (FDM)", "3D printer (resin)", "CNC router", "Vinyl cutter", "Vacuum former", "Strip heater", "Sewing machine", "Overlocker", "Sublimation press", "Heat press"] },
];

const COMMON_SOFTWARE: { category: string; items: string[] }[] = [
  { category: "CAD / 3D", items: ["TinkerCAD", "Fusion 360", "OnShape", "SketchUp", "SolidWorks", "Inventor"] },
  { category: "2D / Vector", items: ["Adobe Illustrator", "Inkscape", "CorelDRAW", "Canva"] },
  { category: "Graphics / Image", items: ["Adobe Photoshop", "GIMP", "Procreate", "Figma"] },
  { category: "Coding / Electronics", items: ["Arduino IDE", "micro:bit MakeCode", "Scratch", "MIT App Inventor"] },
  { category: "Media / Other", items: ["Adobe Premiere", "iMovie", "Google Slides", "PowerPoint"] },
];

/* ── Workshop spaces with linked safety badges ── */
const WORKSHOP_PRESETS: { space: string; linkedBadge: string; badgeLabel: string }[] = [
  { space: "General Workshop", linkedBadge: "general-workshop-safety", badgeLabel: "General Workshop Safety" },
  { space: "Wood Workshop", linkedBadge: "wood-workshop-safety", badgeLabel: "Wood Workshop Safety" },
  { space: "Metal Workshop", linkedBadge: "metal-workshop-safety", badgeLabel: "Metal Workshop Safety" },
  { space: "Plastics / Composites Room", linkedBadge: "plastics-composites-safety", badgeLabel: "Plastics & Composites Safety" },
  { space: "Electronics Lab", linkedBadge: "electronics-soldering-safety", badgeLabel: "Electronics & Soldering Safety" },
  { space: "Laser Cutter Room", linkedBadge: "laser-cutter-safety", badgeLabel: "Laser Cutter Safety" },
  { space: "CAD Lab", linkedBadge: "", badgeLabel: "" },
  { space: "Textiles Room", linkedBadge: "", badgeLabel: "" },
];

const TABS: { key: SettingsTab; label: string; icon: string }[] = [
  { key: "general", label: "General", icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" },
  { key: "school", label: "School & Teaching", icon: "M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4M5 21V10.5M19 21V10.5" },
  { key: "timetable", label: "Timetable", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { key: "workshop", label: "Workshop & Equipment", icon: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" },
  { key: "lms", label: "LMS Integration", icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" },
  { key: "ai", label: "AI Generator", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
];

interface IntegrationConfig {
  id: string;
  provider: LMSProviderType;
  subdomain: string | null;
  lti_consumer_key: string | null;
  has_api_token: boolean;
  created_at: string;
  updated_at: string;
}

interface AIConfig {
  provider: string;
  api_endpoint: string;
  model_name: string;
  has_api_key: boolean;
}

const PROVIDER_OPTIONS: { value: LMSProviderType; label: string; hint: string }[] = [
  { value: "managebac", label: "ManageBac", hint: "e.g. myschool.managebac.com" },
];

export default function TeacherSettingsPage() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "general";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [loading, setLoading] = useState(true);

  // LMS state
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<IntegrationConfig | null>(null);
  const [provider, setProvider] = useState<LMSProviderType>("managebac");
  const [subdomain, setSubdomain] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [ltiKey, setLtiKey] = useState("");
  const [ltiSecret, setLtiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copied, setCopied] = useState("");

  // School/teaching profile state
  const [schoolName, setSchoolName] = useState("");
  const [country, setCountry] = useState("");
  const [curriculumFramework, setCurriculumFramework] = useState("");
  const [periodMinutes, setPeriodMinutes] = useState<number>(50);
  const [subjectsTaught, setSubjectsTaught] = useState("");
  const [gradeLevelsTaught, setGradeLevelsTaught] = useState("");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [customTools, setCustomTools] = useState("");
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);
  const [customSoftware, setCustomSoftware] = useState("");
  const [selectedSpaces, setSelectedSpaces] = useState<string[]>([]);
  const [customSpaces, setCustomSpaces] = useState("");
  const [spaceBadgeRequirements, setSpaceBadgeRequirements] = useState<Record<string, boolean>>({});
  const [hasDoubles, setHasDoubles] = useState(false);
  const [doublePeriodMinutes, setDoublePeriodMinutes] = useState<number>(100);
  const [studentAgeMin, setStudentAgeMin] = useState<number>(11);
  const [studentAgeMax, setStudentAgeMax] = useState<number>(16);
  const [useNewMetrics, setUseNewMetrics] = useState(false);
  const [teachingStyle, setTeachingStyle] = useState("");
  const [yearsExperience, setYearsExperience] = useState<number | "">("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Timetable / cycle state
  const [cycleLength, setCycleLength] = useState<number>(5);
  const [anchorDate, setAnchorDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [anchorCycleDay, setAnchorCycleDay] = useState<number>(1);
  const [resetEachTerm, setResetEachTerm] = useState(false);
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  const [savingTimetable, setSavingTimetable] = useState(false);
  const [timetableSuccess, setTimetableSuccess] = useState("");
  const [timetableError, setTimetableError] = useState("");
  const [classMeetings, setClassMeetings] = useState<Array<{ class_id: string; cycle_day: number; period_number?: number; room?: string }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [excludedDates, setExcludedDates] = useState<string[]>([]);
  const [newExcludedDate, setNewExcludedDate] = useState("");
  const [newExcludedLabel, setNewExcludedLabel] = useState("");
  const [showManualSetup, setShowManualSetup] = useState(false);
  // iCal import
  const [icalUrl, setIcalUrl] = useState("");
  const [icalParsing, setIcalParsing] = useState(false);
  const [icalMessage, setIcalMessage] = useState("");
  const [icalPreviewData, setIcalPreviewData] = useState<ICalImportData | null>(null);
  // AI timetable upload state
  const [aiUploading, setAiUploading] = useState(false);
  const [aiUploadError, setAiUploadError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiParseResult, setAiParseResult] = useState<any>(null);
  // Track teacher overrides on AI classification (entry index → boolean)
  const [aiClassOverrides, setAiClassOverrides] = useState<Record<number, boolean>>({});
  const [aiConfirming, setAiConfirming] = useState(false);

  // Temp state for adding a meeting
  const [newMeetingClassId, setNewMeetingClassId] = useState("");
  const [newMeetingCycleDay, setNewMeetingCycleDay] = useState<number>(1);
  const [newMeetingPeriod, setNewMeetingPeriod] = useState<number | "">("");
  const [newMeetingRoom, setNewMeetingRoom] = useState("");

  // AI state
  const [aiConfig, setAiConfig] = useState<AIConfig | null>(null);
  const [aiProvider, setAiProvider] = useState("openai-compatible");
  const [aiEndpoint, setAiEndpoint] = useState("https://api.openai.com/v1");
  const [aiModel, setAiModel] = useState("gpt-4o-mini");
  const [aiApiKey, setAiApiKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [aiSuccess, setAiSuccess] = useState("");
  const [aiError, setAiError] = useState("");
  const [testingAi, setTestingAi] = useState(false);

  useEffect(() => {
    Promise.all([loadIntegration(), loadAiSettings(), loadProfile(), loadTimetable(), loadClasses()]).then(() =>
      setLoading(false)
    );
  }, []);

  async function loadIntegration() {
    try {
      const res = await fetch("/api/teacher/integrations");
      const data = await res.json();
      if (data.integration) {
        setIntegration(data.integration);
        setProvider(data.integration.provider);
        setSubdomain(data.integration.subdomain || "");
        setLtiKey(data.integration.lti_consumer_key || "");
      }
    } catch {
      // silent
    }
  }

  async function loadAiSettings() {
    try {
      const res = await fetch("/api/teacher/ai-settings");
      const data = await res.json();
      if (data.settings) {
        setAiConfig(data.settings);
        setAiProvider(data.settings.provider);
        setAiEndpoint(data.settings.api_endpoint);
        setAiModel(data.settings.model_name);
      }
    } catch {
      // silent
    }
  }

  async function loadProfile() {
    try {
      const res = await fetch("/api/teacher/profile");
      const data = await res.json();
      if (data.profile) {
        const p = data.profile;
        setSchoolName(p.school_name || "");
        setCountry(p.country || "");
        setCurriculumFramework(p.curriculum_framework || "");
        setPeriodMinutes(p.typical_period_minutes || 50);
        setSubjectsTaught((p.subjects_taught || []).join(", "));
        setGradeLevelsTaught((p.grade_levels_taught || []).join(", "));
        // Unpack JSONB fields
        const sc = p.school_context || {};
        // Separate preset items from custom items for tools
        const allTools: string[] = sc.available_tools || [];
        const presetToolNames = COMMON_TOOLS.flatMap((c) => c.items);
        setSelectedTools(allTools.filter((t: string) => presetToolNames.includes(t)));
        setCustomTools(allTools.filter((t: string) => !presetToolNames.includes(t)).join(", "));
        // Same for software
        const allSw: string[] = sc.available_software || [];
        const presetSwNames = COMMON_SOFTWARE.flatMap((c) => c.items);
        setSelectedSoftware(allSw.filter((s: string) => presetSwNames.includes(s)));
        setCustomSoftware(allSw.filter((s: string) => !presetSwNames.includes(s)).join(", "));
        // Workshop spaces
        const allSpaces: string[] = sc.workshop_spaces || [];
        const presetSpaceNames = WORKSHOP_PRESETS.map((w) => w.space);
        setSelectedSpaces(allSpaces.filter((s: string) => presetSpaceNames.includes(s)));
        setCustomSpaces(allSpaces.filter((s: string) => !presetSpaceNames.includes(s)).join(", "));
        // Badge requirements per space
        const badgeReqs: Record<string, boolean> = {};
        const reqMap = sc.workshop_badge_requirements || {};
        for (const preset of WORKSHOP_PRESETS) {
          if (preset.linkedBadge && reqMap[preset.space]?.includes(preset.linkedBadge)) {
            badgeReqs[preset.space] = true;
          }
        }
        setSpaceBadgeRequirements(badgeReqs);
        // Doubles
        setHasDoubles(sc.has_double_periods || false);
        setDoublePeriodMinutes(sc.double_period_minutes || 100);
        // Student ages
        const ages = sc.default_student_ages || {};
        setStudentAgeMin(ages.min || 11);
        setStudentAgeMax(ages.max || 16);
        // New Metrics
        setUseNewMetrics(sc.use_new_metrics || false);
        const tp = p.teacher_preferences || {};
        setTeachingStyle(tp.classroom_management_style || "");
        setYearsExperience(tp.years_experience || "");
        setProfileLoaded(true);
      }
    } catch {
      // silent — table might not exist yet
    }
  }

  async function loadTimetable() {
    try {
      const res = await fetch("/api/teacher/timetable");
      if (!res.ok) return;
      const data = await res.json();
      if (data.timetable) {
        setCycleLength(data.timetable.cycle_length || 5);
        setAnchorDate(data.timetable.anchor_date || new Date().toISOString().split("T")[0]);
        setAnchorCycleDay(data.timetable.anchor_cycle_day || 1);
        setResetEachTerm(data.timetable.reset_each_term || false);
        setExcludedDates(data.timetable.excluded_dates || []);
        setIcalUrl(data.timetable.ical_url || "");
        setTimetableLoaded(true);
      }
      if (data.meetings) {
        setClassMeetings(data.meetings.map((m: { class_id: string; cycle_day: number; period_number?: number; room?: string }) => ({
          class_id: m.class_id,
          cycle_day: m.cycle_day,
          period_number: m.period_number,
          room: m.room,
        })));
        // Auto-expand manual section if meetings or custom anchor exist
        if (data.meetings.length > 0 || (data.timetable?.anchor_date && !data.timetable?.ical_url)) {
          setShowManualSetup(true);
        }
      }
    } catch {
      // silent — table might not exist yet
    }
  }

  async function loadClasses() {
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("classes").select("id, name").eq("author_teacher_id", user.id).order("name");
      if (data) setClasses(data);
    } catch {
      // silent
    }
  }

  async function handleSaveTimetable() {
    setSavingTimetable(true);
    setTimetableError("");
    setTimetableSuccess("");

    try {
      const res = await fetch("/api/teacher/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycle_length: cycleLength,
          anchor_date: anchorDate,
          anchor_cycle_day: anchorCycleDay,
          reset_each_term: resetEachTerm,
          excluded_dates: excludedDates,
          ical_url: icalUrl || null,
          meetings: classMeetings,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setTimetableError(data.error || "Failed to save timetable");
        return;
      }

      setTimetableSuccess("Timetable saved!");
      setTimetableLoaded(true);
      setTimeout(() => setTimetableSuccess(""), 3000);
    } catch {
      setTimetableError("Network error");
    } finally {
      setSavingTimetable(false);
    }
  }

  function addMeeting() {
    if (!newMeetingClassId) return;
    setClassMeetings([
      ...classMeetings,
      {
        class_id: newMeetingClassId,
        cycle_day: newMeetingCycleDay,
        period_number: newMeetingPeriod || undefined,
        room: newMeetingRoom || undefined,
      },
    ]);
    setNewMeetingCycleDay(1);
    setNewMeetingPeriod("");
    setNewMeetingRoom("");
  }

  function removeMeeting(index: number) {
    setClassMeetings(classMeetings.filter((_, i) => i !== index));
  }

  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");

    const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

    try {
      const res = await fetch("/api/teacher/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName.trim() || null,
          country: country.trim() || null,
          curriculum_framework: curriculumFramework || null,
          typical_period_minutes: periodMinutes || null,
          subjects_taught: splitList(subjectsTaught),
          grade_levels_taught: splitList(gradeLevelsTaught),
          school_context: {
            workshop_spaces: [...selectedSpaces, ...splitList(customSpaces)],
            available_tools: [...selectedTools, ...splitList(customTools)],
            available_software: [...selectedSoftware, ...splitList(customSoftware)],
            has_double_periods: hasDoubles,
            double_period_minutes: doublePeriodMinutes,
            workshop_badge_requirements: Object.fromEntries(
              WORKSHOP_PRESETS
                .filter((p) => selectedSpaces.includes(p.space) && p.linkedBadge && spaceBadgeRequirements[p.space])
                .map((p) => [p.space, [p.linkedBadge]])
            ),
            default_student_ages: { min: studentAgeMin, max: studentAgeMax },
            use_new_metrics: useNewMetrics,
          },
          teacher_preferences: {
            classroom_management_style: teachingStyle.trim() || null,
            years_experience: yearsExperience || null,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setProfileError(data.error || "Failed to save");
        return;
      }

      setProfileSuccess("School & teaching profile saved!");
      setProfileLoaded(true);
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch {
      setProfileError("Network error. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveLms() {
    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/teacher/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          subdomain: subdomain.trim(),
          apiToken: apiToken.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Failed to save");
        return;
      }

      setLtiKey(data.lti_consumer_key || ltiKey);
      if (data.lti_consumer_secret) {
        setLtiSecret(data.lti_consumer_secret);
        setShowSecret(true);
        setSuccessMsg("Settings saved! LTI credentials generated. Copy the secret below.");
      } else {
        setSuccessMsg("Settings saved successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
      setApiToken("");
      await loadIntegration();
    } catch {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAi() {
    setSavingAi(true);
    setAiError("");
    setAiSuccess("");

    try {
      const res = await fetch("/api/teacher/ai-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: aiProvider,
          apiEndpoint: aiEndpoint.trim(),
          modelName: aiModel.trim(),
          apiKey: aiApiKey.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || "Failed to save");
        return;
      }

      setAiSuccess("AI settings saved!");
      setAiApiKey("");
      setTimeout(() => setAiSuccess(""), 3000);
      await loadAiSettings();
    } catch {
      setAiError("Network error. Please try again.");
    } finally {
      setSavingAi(false);
    }
  }

  async function testAiConnection() {
    setTestingAi(true);
    setAiError("");
    setAiSuccess("");

    try {
      const res = await fetch("/api/teacher/generate-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wizardInput: {
            title: "Test",
            gradeLevel: "Year 3 (Grade 8)",
            durationWeeks: 6,
            topic: "Test connection",
            globalContext: "Scientific and technical innovation",
            keyConcept: "Systems",
            relatedConcepts: ["Function"],
            statementOfInquiry: "Test",
            criteriaFocus: { A: "light", B: "light", C: "light", D: "light" },
            atlSkills: [],
            specificSkills: [],
            resourceUrls: [],
            specialRequirements: "",
          },
          criterion: "A",
        }),
      });

      if (res.ok) {
        setAiSuccess("Connection successful! AI is working.");
      } else {
        const data = await res.json();
        setAiError(data.error || "Connection failed");
      }
    } catch {
      setAiError("Could not reach the AI provider");
    } finally {
      setTestingAi(false);
    }
  }

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </main>
    );
  }

  const launchUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/auth/lti/launch`
      : "/api/auth/lti/launch";

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-text-primary mb-6">Settings</h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === tab.key
                ? "border-accent-blue text-accent-blue"
                : "border-transparent text-text-secondary hover:text-text-primary hover:border-gray-300"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== GENERAL TAB ==================== */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              About StudioLoom
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              MYP Design Process platform for portfolio tracking, unit management, and student assessment.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">Version</span>
                <span className="font-medium text-text-primary">1.0.0</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">LMS Connected</span>
                <span className="font-medium text-text-primary">
                  {integration ? "Yes" : "Not configured"}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-text-secondary">AI Provider</span>
                <span className="font-medium text-text-primary">
                  {aiConfig ? `${aiConfig.model_name}` : "Not configured"}
                </span>
              </div>
            </div>
          </section>

          {/* Quick setup cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setActiveTab("school")}
              className="bg-white rounded-xl p-5 border border-border text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-brand-purple/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4M5 21V10.5M19 21V10.5" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">School & Teaching</p>
                  <p className="text-xs text-text-secondary">Enrich AI with your context</p>
                </div>
              </div>
              {profileLoaded ? (
                <span className="text-xs text-accent-green font-medium">Configured</span>
              ) : (
                <span className="text-xs text-amber-500 font-medium">Set up recommended</span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("lms")}
              className="bg-white rounded-xl p-5 border border-border text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E86AB" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">LMS Integration</p>
                  <p className="text-xs text-text-secondary">Sync students & enable SSO</p>
                </div>
              </div>
              {integration ? (
                <span className="text-xs text-accent-green font-medium">Connected</span>
              ) : (
                <span className="text-xs text-text-secondary">Not configured</span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("ai")}
              className="bg-white rounded-xl p-5 border border-border text-left hover:shadow-md transition"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8B2FC9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">AI Generator</p>
                  <p className="text-xs text-text-secondary">Power the unit creation wizard</p>
                </div>
              </div>
              {aiConfig?.has_api_key ? (
                <span className="text-xs text-accent-green font-medium">Connected</span>
              ) : (
                <span className="text-xs text-text-secondary">Not configured</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ==================== SCHOOL & TEACHING TAB ==================== */}
      {activeTab === "school" && (
        <div className="space-y-6">

          {/* ── 1. School Context ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">School Context</h2>
            <p className="text-sm text-text-secondary mb-5">Basic info that shapes all AI-generated content.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">School name</label>
                <input type="text" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="e.g. Dubai International Academy" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Country</label>
                <input type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. UAE, UK, Australia" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Curriculum framework</label>
                <select value={curriculumFramework} onChange={(e) => setCurriculumFramework(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30">
                  <option value="">Select...</option>
                  <option value="IB_MYP">IB MYP</option>
                  <option value="GCSE_DT">UK GCSE Design & Technology</option>
                  <option value="ALEVEL_DT">UK A-Level Design & Technology</option>
                  <option value="IGCSE_DT">Cambridge IGCSE Design & Technology</option>
                  <option value="ACARA_DT">Australian D&T (ACARA)</option>
                  <option value="VCE_DT">VCE Product Design & Technology</option>
                  <option value="PLTW">US PLTW</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Subjects taught</label>
                <input type="text" value={subjectsTaught} onChange={(e) => setSubjectsTaught(e.target.value)} placeholder="Product Design, Textiles, Digital Design" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <p className="text-xs text-text-secondary/60 mt-1">Comma-separated</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Year/grade levels</label>
                <input type="text" value={gradeLevelsTaught} onChange={(e) => setGradeLevelsTaught(e.target.value)} placeholder="Year 7, Year 8, MYP 4" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <p className="text-xs text-text-secondary/60 mt-1">Comma-separated</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Student age range</label>
                <div className="flex items-center gap-2">
                  <input type="number" value={studentAgeMin} onChange={(e) => setStudentAgeMin(Number(e.target.value))} min={5} max={20} className="w-20 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                  <span className="text-text-secondary text-sm">to</span>
                  <input type="number" value={studentAgeMax} onChange={(e) => setStudentAgeMax(Number(e.target.value))} min={5} max={20} className="w-20 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                  <span className="text-xs text-text-secondary/60">years</span>
                </div>
                <p className="text-xs text-text-secondary/60 mt-1">Used for instruction caps (1+age rule)</p>
              </div>
            </div>
          </section>

          {/* ── 2. Period Lengths ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Period Lengths</h2>
            <p className="text-sm text-text-secondary mb-5">Period lengths drive lesson timing. Full timetable setup is in the Timetable tab.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Single period (minutes)</label>
                <input type="number" value={periodMinutes} onChange={(e) => setPeriodMinutes(Number(e.target.value))} min={20} max={120} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Double periods?</label>
                <div className="flex items-center gap-3 mt-1.5">
                  <button type="button" onClick={() => setHasDoubles(!hasDoubles)} className={`relative w-11 h-6 rounded-full transition-colors ${hasDoubles ? "bg-brand-purple" : "bg-gray-300"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${hasDoubles ? "translate-x-5" : ""}`} />
                  </button>
                  <span className="text-sm text-text-secondary">{hasDoubles ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
            {hasDoubles && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Double period length (minutes)</label>
                <input type="number" value={doublePeriodMinutes} onChange={(e) => setDoublePeriodMinutes(Number(e.target.value))} min={40} max={240} className="w-48 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <p className="text-xs text-text-secondary/60 mt-1">Often not exactly 2x — e.g. 50 min singles = 95 min doubles</p>
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button onClick={() => setActiveTab("timetable")} className="text-sm text-brand-purple hover:text-brand-purple/80 font-medium transition flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Set up your timetable
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </section>

          {/* ── 3. Academic Calendar (Terms / Semesters) ── */}
          <div>
            <div className="mb-2 px-1">
              <p className="text-xs text-text-tertiary">Define <strong>when your terms or semesters start and end</strong>. This is different from your class timetable — set that up in the <button onClick={() => setActiveTab("timetable")} className="text-brand-purple hover:underline font-medium">Timetable</button> tab.</p>
            </div>
            <SchoolCalendarSetup />
          </div>

          {/* ── 4. New Metrics ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">New Metrics</h2>
                <p className="text-sm text-text-secondary">Enable the University of Melbourne competency assessment framework across your classes.</p>
              </div>
              <button
                onClick={() => setUseNewMetrics(!useNewMetrics)}
                className="relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200"
                style={{ background: useNewMetrics ? "#7B2FF2" : "#D1D5DB" }}
                role="switch"
                aria-checked={useNewMetrics}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
                  style={{ transform: useNewMetrics ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>
            {useNewMetrics && (
              <div className="mt-4 p-3 rounded-lg" style={{ background: "rgba(123,47,242,0.05)", border: "1px solid rgba(123,47,242,0.15)" }}>
                <p className="text-sm text-text-secondary">Student self-assessment pulse and teacher observation snap will appear on checkpoint pages. Configure which competencies to track per class in each unit&apos;s class settings.</p>
              </div>
            )}
          </section>

          {/* ── 8. Teaching Style ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Teaching Style</h2>
            <p className="text-sm text-text-secondary mb-5">Helps the AI match your approach.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Years of experience</label>
                <input type="number" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value ? Number(e.target.value) : "")} min={0} max={50} placeholder="e.g. 8" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Classroom management style</label>
                <input type="text" value={teachingStyle} onChange={(e) => setTeachingStyle(e.target.value)} placeholder="e.g. Relaxed workshop, Structured rotations" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
            </div>
          </section>

          {/* ── Save ── */}
          <div className="flex items-center gap-3">
            <button onClick={handleSaveProfile} disabled={savingProfile} className="px-6 py-2.5 gradient-cta text-white rounded-lg text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition disabled:opacity-50">
              {savingProfile ? "Saving..." : profileLoaded ? "Update Profile" : "Save Profile"}
            </button>
            {profileSuccess && <span className="text-sm text-accent-green font-medium">{profileSuccess}</span>}
            {profileError && <span className="text-sm text-red-500">{profileError}</span>}
          </div>

          {/* Info note */}
          <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-xl p-4">
            <div className="flex gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-1">Why this matters</p>
                <p>Everything here feeds the AI. Period lengths and cycle settings drive lesson timing. The school calendar enables term-based scheduling. New Metrics controls whether competency assessment appears across the platform. Workshop equipment is in its own tab.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TIMETABLE TAB ==================== */}
      {activeTab === "timetable" && (
        <div className="space-y-6">

          {/* ── 1. Smart Import (AI) ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-purple to-brand-pink flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-0.5">Smart Import</h2>
                <p className="text-sm text-text-secondary">Upload a screenshot or PDF of your timetable. AI will extract your cycle, periods, and classes automatically.</p>
              </div>
            </div>

            {/* Upload area */}
            {!aiParseResult && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-brand-purple/40 transition-colors">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                <p className="text-sm text-text-secondary mb-3">Drop your timetable image or PDF here</p>
                <label className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition ${aiUploading ? "bg-gray-100 text-gray-400" : "bg-brand-purple text-white hover:bg-brand-purple/90"}`}>
                  {aiUploading ? (
                    <>
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4m0 12v4m-8-10h4m12 0h4m-5.66-5.66l-2.83 2.83m-5.02 5.02l-2.83 2.83m0-11.31l2.83 2.83m5.02 5.02l2.83 2.83" /></svg>
                      Analysing timetable...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                      Choose file
                    </>
                  )}
                  <input
                    type="file"
                    accept="application/pdf,image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={aiUploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAiUploading(true);
                      setAiUploadError("");
                      setAiParseResult(null);
                      setAiClassOverrides({});
                      try {
                        const formData = new FormData();
                        formData.append("file", file);
                        const res = await fetch("/api/teacher/timetable/parse-upload", {
                          method: "POST",
                          body: formData,
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setAiUploadError(data.error || "Failed to parse timetable");
                          return;
                        }
                        setAiParseResult(data);
                        // Initialize overrides from AI classifications
                        const overrides: Record<number, boolean> = {};
                        data.entries?.forEach((entry: { is_teaching: boolean }, i: number) => {
                          overrides[i] = entry.is_teaching;
                        });
                        setAiClassOverrides(overrides);
                      } catch {
                        setAiUploadError("Upload failed. Please try again.");
                      } finally {
                        setAiUploading(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
                <p className="text-xs text-text-secondary/60 mt-2">PDF, PNG, JPG, or WebP — max 10 MB</p>
              </div>
            )}

            {aiUploadError && (
              <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-700">{aiUploadError}</p>
              </div>
            )}

            {/* AI Parse Results — Review & Confirm */}
            {aiParseResult && (
              <div className="space-y-5">
                {/* Summary bar */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-green-50 border border-green-200">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-green-800">Timetable parsed!</span>
                    <span className="text-green-700 ml-2">
                      {aiParseResult.cycle_length}-day cycle
                      {aiParseResult.periods?.length > 0 && ` · ${aiParseResult.periods.length} periods`}
                      {aiParseResult.entries?.length > 0 && ` · ${aiParseResult.entries.length} entries found`}
                    </span>
                  </div>
                  <button onClick={() => { setAiParseResult(null); setAiClassOverrides({}); }} className="text-xs text-green-600 hover:text-green-800 font-medium">Upload different</button>
                </div>

                {/* School/teacher info if detected */}
                {(aiParseResult.school_name || aiParseResult.teacher_name) && (
                  <div className="flex gap-4 text-xs text-text-secondary">
                    {aiParseResult.school_name && <span>School: <strong className="text-text-primary">{aiParseResult.school_name}</strong></span>}
                    {aiParseResult.teacher_name && <span>Teacher: <strong className="text-text-primary">{aiParseResult.teacher_name}</strong></span>}
                  </div>
                )}

                {/* Periods detected */}
                {aiParseResult.periods?.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary mb-2">Periods detected</h3>
                    <div className="flex flex-wrap gap-2">
                      {aiParseResult.periods.map((p: { period_number: number; start_time?: string; end_time?: string; duration_minutes?: number }) => (
                        <span key={p.period_number} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                          P{p.period_number}
                          {p.start_time && p.end_time && <span className="text-blue-500">({p.start_time}–{p.end_time})</span>}
                          {p.duration_minutes && <span className="text-blue-400">{p.duration_minutes}min</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Entries table with teaching/non-teaching toggles */}
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-1">Schedule entries</h3>
                  <p className="text-xs text-text-secondary mb-3">Review the AI classifications below. Toggle entries to mark them as teaching classes or non-teaching activities.</p>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Day</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Period</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Entry</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Time</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">Room</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold text-text-secondary">Teaching?</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">AI Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiParseResult.entries?.map((entry: { day: number; period: number; class_name: string; grade_level?: string; room?: string; start_time?: string; end_time?: string; is_teaching: boolean; classification_reason?: string }, idx: number) => {
                          const isTeaching = aiClassOverrides[idx] ?? entry.is_teaching;
                          return (
                            <tr key={idx} className={`border-b border-border last:border-b-0 ${isTeaching ? "bg-white" : "bg-gray-50/50"}`}>
                              <td className="px-3 py-2 text-text-secondary">Day {entry.day}</td>
                              <td className="px-3 py-2 text-text-secondary">P{entry.period}</td>
                              <td className="px-3 py-2 font-medium text-text-primary">
                                {entry.class_name}
                                {entry.grade_level && <span className="ml-1.5 text-xs text-text-secondary">({entry.grade_level})</span>}
                              </td>
                              <td className="px-3 py-2 text-text-secondary text-xs">
                                {entry.start_time && entry.end_time ? `${entry.start_time}–${entry.end_time}` : "—"}
                              </td>
                              <td className="px-3 py-2 text-text-secondary text-xs">{entry.room || "—"}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => setAiClassOverrides(prev => ({ ...prev, [idx]: !isTeaching }))}
                                  className={`relative w-10 h-5 rounded-full transition-colors ${isTeaching ? "bg-brand-purple" : "bg-gray-300"}`}
                                >
                                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isTeaching ? "translate-x-5" : ""}`} />
                                </button>
                              </td>
                              <td className="px-3 py-2 text-xs text-text-tertiary max-w-[200px] truncate">{entry.classification_reason || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* AI notes */}
                {aiParseResult.ai_notes && (
                  <div className="p-3 rounded-lg bg-brand-purple/5 border border-brand-purple/15">
                    <p className="text-xs text-text-secondary"><strong className="text-text-primary">AI notes:</strong> {aiParseResult.ai_notes}</p>
                  </div>
                )}

                {/* Confirm & Apply button */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={async () => {
                      setAiConfirming(true);
                      try {
                        // Apply parsed data to timetable state
                        if (aiParseResult.cycle_length) setCycleLength(aiParseResult.cycle_length);

                        // Set period duration from first period if available
                        if (aiParseResult.periods?.length > 0) {
                          const firstPeriod = aiParseResult.periods[0];
                          if (firstPeriod.duration_minutes) setPeriodMinutes(firstPeriod.duration_minutes);
                        }

                        // Build class meetings from teaching entries only
                        const teachingEntries = aiParseResult.entries?.filter((_: unknown, i: number) => aiClassOverrides[i]) || [];

                        // Group unique class names from teaching entries
                        const uniqueClassNames = [...new Set(teachingEntries.map((e: { class_name: string }) => e.class_name))] as string[];

                        // Match to existing classes or inform about unmatched
                        const classNameToId: Record<string, string> = {};
                        for (const name of uniqueClassNames) {
                          // Try to match by name (case-insensitive partial match)
                          const match = classes.find(c =>
                            c.name.toLowerCase().includes(name.toLowerCase()) ||
                            name.toLowerCase().includes(c.name.toLowerCase())
                          );
                          if (match) classNameToId[name] = match.id;
                        }

                        // Build meetings array
                        const newMeetings = teachingEntries
                          .filter((e: { class_name: string }) => classNameToId[e.class_name])
                          .map((e: { class_name: string; day: number; period: number; room?: string }) => ({
                            class_id: classNameToId[e.class_name],
                            cycle_day: e.day,
                            period_number: e.period,
                            room: e.room || undefined,
                          }));

                        setClassMeetings(newMeetings);

                        // Unmatched classes warning
                        const unmatched = uniqueClassNames.filter(n => !classNameToId[n]);
                        if (unmatched.length > 0) {
                          setTimetableSuccess(`Applied! ${unmatched.length} class(es) not matched to existing classes: ${unmatched.join(", ")}. Create them first, then re-import.`);
                        } else {
                          setTimetableSuccess(`Applied ${newMeetings.length} class meetings from ${uniqueClassNames.length} classes across ${aiParseResult.cycle_length}-day cycle!`);
                        }
                        setTimeout(() => setTimetableSuccess(""), 8000);

                        // Auto-expand manual setup so teacher can see the result
                        setShowManualSetup(true);

                        // Clear the AI result
                        setAiParseResult(null);
                        setAiClassOverrides({});
                      } finally {
                        setAiConfirming(false);
                      }
                    }}
                    disabled={aiConfirming}
                    className="px-5 py-2.5 rounded-lg text-sm font-medium bg-brand-purple text-white hover:bg-brand-purple/90 transition disabled:opacity-50"
                  >
                    {aiConfirming ? "Applying..." : "Confirm & Apply to Timetable"}
                  </button>
                  <button
                    onClick={() => { setAiParseResult(null); setAiClassOverrides({}); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-text-tertiary hover:text-text-primary transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── 2. iCal Class Schedule Import ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
              Import Class Schedule from Calendar Feed
            </h2>
            <p className="text-sm text-text-secondary mb-1">Import your <strong>class timetable</strong> from an iCal feed — this tells StudioLoom which classes you teach on which days.</p>
            <p className="text-xs text-text-tertiary mb-4">This is <em>not</em> your academic calendar (terms/semesters). Set that up in the <button onClick={() => setActiveTab("school")} className="text-brand-purple hover:underline font-medium">School &amp; Teaching</button> tab.</p>

            <div className="flex items-end gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-text-secondary mb-1">Timetable / class schedule iCal feed URL (.ics)</label>
                <input type="url" value={icalUrl} onChange={(e) => setIcalUrl(e.target.value)} placeholder="https://school.managebac.com/calendar/feed/timetable.ics" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              </div>
              <button
                onClick={async () => {
                  if (!icalUrl) return;
                  setIcalParsing(true);
                  setIcalMessage("");
                  try {
                    const res = await fetch("/api/teacher/timetable/import-ical", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ical_url: icalUrl }),
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setIcalMessage(data.error || "Import failed");
                      return;
                    }
                    setClassMeetings(data.meetings || []);
                    setExcludedDates(data.excludedDates || []);
                    if (data.cycleDayEvents?.length) {
                      const first = data.cycleDayEvents[0];
                      setAnchorDate(first.date);
                      setAnchorCycleDay(first.cycleDay);
                      const maxDay = Math.max(...data.cycleDayEvents.map((e: { cycleDay: number }) => e.cycleDay));
                      if (maxDay >= 2 && maxDay <= 20) setCycleLength(maxDay);
                    } else if (data.classEventDates?.length) {
                      const sorted = [...data.classEventDates].sort((a: {date:string}, b: {date:string}) => a.date.localeCompare(b.date));
                      setAnchorDate(sorted[0].date);
                      setAnchorCycleDay(1);
                    }
                    const cycleDayCount = data.cycleDayEvents?.length || 0;
                    let msg = `Imported ${data.totalEvents || 0} events`;
                    if (cycleDayCount > 0) msg += ` — found ${cycleDayCount} cycle day markers`;
                    msg += " — see preview below";
                    setIcalMessage(msg);
                    setIcalPreviewData(data as ICalImportData);
                  } catch {
                    setIcalMessage("Network error");
                  } finally {
                    setIcalParsing(false);
                  }
                }}
                disabled={!icalUrl || icalParsing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition disabled:opacity-40 border border-blue-200 whitespace-nowrap"
              >
                {icalParsing ? "Parsing..." : "Import"}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-text-tertiary">or</span>
              <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-50 text-text-secondary hover:bg-gray-100 transition border border-gray-200">
                Upload .ics file
                <input
                  type="file"
                  accept=".ics,.ical"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setIcalParsing(true);
                    setIcalMessage("");
                    try {
                      const text = await file.text();
                      const res = await fetch("/api/teacher/timetable/import-ical", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ical_content: text }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        setIcalMessage(data.error || "Import failed");
                        return;
                      }
                      setClassMeetings(data.meetings || []);
                      setExcludedDates(data.excludedDates || []);
                      if (data.cycleDayEvents?.length) {
                        const first = data.cycleDayEvents[0];
                        setAnchorDate(first.date);
                        setAnchorCycleDay(first.cycleDay);
                        const maxDay = Math.max(...data.cycleDayEvents.map((e: { cycleDay: number }) => e.cycleDay));
                        if (maxDay >= 2 && maxDay <= 20) setCycleLength(maxDay);
                      } else if (data.classEventDates?.length) {
                        const sorted = [...data.classEventDates].sort((a: {date:string}, b: {date:string}) => a.date.localeCompare(b.date));
                        setAnchorDate(sorted[0].date);
                        setAnchorCycleDay(1);
                      }
                      const cycleDayCount = data.cycleDayEvents?.length || 0;
                      let msg = `Imported ${data.totalEvents || 0} events`;
                      if (cycleDayCount > 0) msg += ` — found ${cycleDayCount} cycle day markers`;
                      msg += " — see preview below";
                      setIcalMessage(msg);
                      setIcalPreviewData(data as ICalImportData);
                    } catch {
                      setIcalMessage("Upload failed");
                    } finally {
                      setIcalParsing(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>

            {icalMessage && (
              <p className={`mt-2 text-xs font-medium ${icalMessage.includes("Imported") || icalMessage.includes("events") ? "text-accent-green" : "text-amber-600"}`}>
                {icalMessage}
              </p>
            )}

            {icalPreviewData && (
              <ICalPreview
                data={icalPreviewData}
                classNames={classes}
                cycleConfig={{ cycleLength, anchorDate, anchorCycleDay, excludedDates }}
                onClose={() => setIcalPreviewData(null)}
              />
            )}
          </section>

          {/* ── 3. Cycle & Manual Setup ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Cycle Configuration</h2>
            <p className="text-sm text-text-secondary mb-5">Set your school&apos;s rotating cycle. This lets StudioLoom calculate lesson dates.</p>

            <div className="max-w-xs mb-5">
              <label className="block text-sm font-medium text-text-secondary mb-1">Cycle length (days)</label>
              <input type="number" value={cycleLength} onChange={(e) => { setCycleLength(Number(e.target.value)); if (anchorCycleDay > Number(e.target.value)) setAnchorCycleDay(1); }} min={2} max={20} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              <p className="text-xs text-text-secondary/60 mt-1">5 = standard week, 6/8/10 = rotating</p>
            </div>

            {/* Manual setup — collapsed by default */}
            <div className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setShowManualSetup(!showManualSetup)}
                className="flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors w-full"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showManualSetup ? "rotate-90" : ""}`}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {showManualSetup ? "Hide" : "Show"} manual setup
                <span className="font-normal text-text-tertiary">— anchor date, class meetings, non-school days</span>
              </button>

              {showManualSetup && (
                <div className="mt-4 space-y-5">
                  {/* Anchor date + cycle day */}
                  <div>
                    <h4 className="text-xs font-semibold text-text-primary mb-3">Cycle anchor</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Anchor date</label>
                        <input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                        <p className="text-xs text-text-secondary/60 mt-1">A date you know the cycle day of</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">That date was Day...</label>
                        <select value={anchorCycleDay} onChange={(e) => setAnchorCycleDay(Number(e.target.value))} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30">
                          {Array.from({ length: cycleLength }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>Day {d}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => setResetEachTerm(!resetEachTerm)} className={`relative w-11 h-6 rounded-full transition-colors ${resetEachTerm ? "bg-brand-purple" : "bg-gray-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${resetEachTerm ? "translate-x-5" : ""}`} />
                      </button>
                      <span className="text-sm text-text-secondary">Reset cycle to Day 1 at the start of each term</span>
                    </div>
                  </div>

                  {/* Class meetings — visual timetable grid */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-semibold text-text-primary mb-1">When do your classes meet?</h4>
                    <p className="text-xs text-text-secondary mb-3">Click any cell to add or remove a class. Or use the quick-add row below the grid.</p>
                    {classes.length > 0 ? (
                      <TimetableGrid
                        cycleLength={cycleLength}
                        meetings={classMeetings as ClassMeetingEntry[]}
                        classes={classes}
                        onMeetingsChange={(newMeetings) => setClassMeetings(newMeetings)}
                      />
                    ) : (
                      <p className="text-sm text-text-secondary">Create classes first to add meeting times.</p>
                    )}
                  </div>

                  {/* Excluded dates (holidays) */}
                  <div className="border-t border-border pt-4">
                    <h4 className="text-xs font-semibold text-text-primary mb-1">Non-School Days</h4>
                    <p className="text-xs text-text-secondary mb-3">Add holidays, PD days, or any dates the cycle skips.</p>
                    {excludedDates.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {excludedDates.map((d, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                            {d}
                            <button onClick={() => setExcludedDates(excludedDates.filter((_, j) => j !== i))} className="hover:text-red-600 ml-0.5">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Date</label>
                        <input type="date" value={newExcludedDate} onChange={(e) => setNewExcludedDate(e.target.value)} className="px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                      </div>
                      <div>
                        <label className="block text-xs text-text-secondary mb-1">Label (opt.)</label>
                        <input type="text" value={newExcludedLabel} onChange={(e) => setNewExcludedLabel(e.target.value)} placeholder="e.g. Easter Monday" className="w-40 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                      </div>
                      <button
                        onClick={() => {
                          if (!newExcludedDate) return;
                          const label = newExcludedLabel ? `${newExcludedDate} (${newExcludedLabel})` : newExcludedDate;
                          if (!excludedDates.includes(newExcludedDate) && !excludedDates.includes(label)) {
                            setExcludedDates([...excludedDates, newExcludedLabel ? label : newExcludedDate]);
                          }
                          setNewExcludedDate("");
                          setNewExcludedLabel("");
                        }}
                        disabled={!newExcludedDate}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition disabled:opacity-40 border border-amber-200"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Save timetable */}
            <div className="flex items-center gap-3 mt-5">
              <button onClick={handleSaveTimetable} disabled={savingTimetable} className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-purple text-white hover:bg-brand-purple/90 transition disabled:opacity-50">
                {savingTimetable ? "Saving..." : timetableLoaded ? "Update Timetable" : "Save Timetable"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setClassMeetings([]);
                  setExcludedDates([]);
                  setAnchorDate(new Date().toISOString().split("T")[0]);
                  setAnchorCycleDay(1);
                  setIcalUrl("");
                  setIcalPreviewData(null);
                  setIcalMessage("");
                  setShowManualSetup(false);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-text-tertiary hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
              >
                Clear all
              </button>
              {timetableSuccess && <span className="text-sm text-accent-green font-medium">{timetableSuccess}</span>}
              {timetableError && <span className="text-sm text-red-500">{timetableError}</span>}
            </div>
          </section>

          {/* Info note */}
          <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-xl p-4">
            <div className="flex gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-1">How timetable import works</p>
                <p>Upload a timetable image/PDF and AI will detect your cycle length, period structure, and classes. It automatically identifies teaching classes vs non-teaching activities (advisory, duty, etc.). You can override any classification before saving. The schedule is used to calculate lesson dates across your units.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== WORKSHOP & EQUIPMENT TAB ==================== */}
      {activeTab === "workshop" && (
        <div className="space-y-6">

          {/* ── 1. Workshop Spaces & Safety ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Workshop Spaces</h2>
            <p className="text-sm text-text-secondary mb-5">Which spaces do you have? Tick to require a safety badge before students can work there.</p>
            <div className="space-y-2 mb-4">
              {WORKSHOP_PRESETS.map((ws) => (
                <div key={ws.space} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition">
                  <input type="checkbox" id={`space-${ws.space}`} checked={selectedSpaces.includes(ws.space)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSpaces([...selectedSpaces, ws.space]);
                        if (ws.linkedBadge) setSpaceBadgeRequirements((prev) => ({ ...prev, [ws.space]: true }));
                      } else {
                        setSelectedSpaces(selectedSpaces.filter((s) => s !== ws.space));
                        setSpaceBadgeRequirements((prev) => { const next = { ...prev }; delete next[ws.space]; return next; });
                      }
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-brand-purple focus:ring-brand-purple/30" />
                  <label htmlFor={`space-${ws.space}`} className="text-sm font-medium text-text-primary flex-1 cursor-pointer">{ws.space}</label>
                  {ws.linkedBadge && selectedSpaces.includes(ws.space) && (
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={spaceBadgeRequirements[ws.space] || false}
                        onChange={(e) => setSpaceBadgeRequirements((prev) => ({ ...prev, [ws.space]: e.target.checked }))}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500/30" />
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                        {ws.badgeLabel}
                      </span>
                    </label>
                  )}
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Other spaces</label>
              <input type="text" value={customSpaces} onChange={(e) => setCustomSpaces(e.target.value)} placeholder="e.g. Ceramics room, Print lab" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              <p className="text-xs text-text-secondary/60 mt-1">Comma-separated</p>
            </div>
          </section>

          {/* ── 2. Tools & Machines ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Tools & Machines</h2>
            <p className="text-sm text-text-secondary mb-5">The AI only suggests activities using equipment you actually have.</p>
            {COMMON_TOOLS.map((cat) => (
              <div key={cat.category} className="mb-4">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{cat.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((tool) => {
                    const on = selectedTools.includes(tool);
                    return (
                      <button key={tool} type="button" onClick={() => setSelectedTools(on ? selectedTools.filter((t) => t !== tool) : [...selectedTools, tool])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? "bg-brand-purple/10 border-brand-purple/30 text-brand-purple" : "bg-gray-50 border-gray-200 text-text-secondary hover:border-gray-300"}`}>
                        {on && <span className="mr-1">✓</span>}{tool}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">Other tools</label>
              <input type="text" value={customTools} onChange={(e) => setCustomTools(e.target.value)} placeholder="e.g. Pottery wheel, Kiln, Embroidery machine" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              <p className="text-xs text-text-secondary/60 mt-1">Comma-separated</p>
            </div>
          </section>

          {/* ── 3. Software ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Software</h2>
            <p className="text-sm text-text-secondary mb-5">Software available on school devices.</p>
            {COMMON_SOFTWARE.map((cat) => (
              <div key={cat.category} className="mb-4">
                <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-2">{cat.category}</h3>
                <div className="flex flex-wrap gap-2">
                  {cat.items.map((sw) => {
                    const on = selectedSoftware.includes(sw);
                    return (
                      <button key={sw} type="button" onClick={() => setSelectedSoftware(on ? selectedSoftware.filter((s) => s !== sw) : [...selectedSoftware, sw])}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${on ? "bg-accent-blue/10 border-accent-blue/30 text-accent-blue" : "bg-gray-50 border-gray-200 text-text-secondary hover:border-gray-300"}`}>
                        {on && <span className="mr-1">✓</span>}{sw}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">Other software</label>
              <input type="text" value={customSoftware} onChange={(e) => setCustomSoftware(e.target.value)} placeholder="e.g. Cura, LightBurn, Cricut Design Space" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
              <p className="text-xs text-text-secondary/60 mt-1">Comma-separated</p>
            </div>
          </section>

          {/* ── Save (shared with profile) ── */}
          <div className="flex items-center gap-3">
            <button onClick={handleSaveProfile} disabled={savingProfile} className="px-6 py-2.5 gradient-cta text-white rounded-lg text-sm font-medium shadow-md shadow-brand-pink/20 hover:opacity-90 transition disabled:opacity-50">
              {savingProfile ? "Saving..." : "Save Equipment"}
            </button>
            {profileSuccess && <span className="text-sm text-accent-green font-medium">{profileSuccess}</span>}
            {profileError && <span className="text-sm text-red-500">{profileError}</span>}
          </div>

          <div className="bg-brand-purple/5 border border-brand-purple/15 rounded-xl p-4">
            <div className="flex gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7B2FF2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <div className="text-sm text-text-secondary">
                <p className="font-medium text-text-primary mb-1">Why this matters</p>
                <p>Equipment lists ensure the AI only suggests activities using tools you actually have. Safety badge requirements gate student access to workshops.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== LMS TAB ==================== */}
      {activeTab === "lms" && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              LMS Provider
            </h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Select your LMS
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as LMSProviderType)}
                className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              >
                {PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                School subdomain
              </label>
              <input
                type="text"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder={
                  PROVIDER_OPTIONS.find((o) => o.value === provider)?.hint ||
                  "myschool"
                }
                className="w-full max-w-md px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              />
              <p className="text-xs text-text-secondary mt-1">
                The subdomain of your school&apos;s{" "}
                {PROVIDER_OPTIONS.find((o) => o.value === provider)?.label} URL
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                API Token
              </label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder={
                  integration?.has_api_token
                    ? "••••••••  (token saved — enter new one to update)"
                    : "Paste your API token"
                }
                className="w-full max-w-md px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              />
              <p className="text-xs text-text-secondary mt-1">
                {provider === "managebac"
                  ? "Find this in ManageBac → Settings → API Settings → Generate Token"
                  : "Your API access token"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveLms}
                disabled={saving || !subdomain.trim()}
                className="px-6 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : integration
                    ? "Update Settings"
                    : "Save & Generate LTI Credentials"}
              </button>
              {successMsg && (
                <span className="text-sm text-accent-green font-medium">
                  {successMsg}
                </span>
              )}
              {errorMsg && (
                <span className="text-sm text-red-500">{errorMsg}</span>
              )}
            </div>
          </section>

          {/* LTI Credentials */}
          {ltiKey && (
            <section className="bg-white rounded-xl p-6 border border-border">
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                LTI 1.1 Credentials
              </h2>
              <p className="text-sm text-text-secondary mb-4">
                Enter these in your LMS to enable student single sign-on (SSO).
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Launch URL
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-50 border border-border rounded text-sm font-mono truncate">
                      {launchUrl}
                    </code>
                    <button
                      onClick={() => copyToClipboard(launchUrl, "url")}
                      className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded transition"
                    >
                      {copied === "url" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Consumer Key
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-gray-50 border border-border rounded text-sm font-mono truncate">
                      {ltiKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(ltiKey, "key")}
                      className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded transition"
                    >
                      {copied === "key" ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>

                {showSecret && ltiSecret && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="block text-xs font-semibold text-amber-700 mb-1">
                      Consumer Secret (copy now — shown only once)
                    </label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded text-sm font-mono truncate">
                        {ltiSecret}
                      </code>
                      <button
                        onClick={() => copyToClipboard(ltiSecret, "secret")}
                        className="px-3 py-2 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 rounded transition"
                      >
                        {copied === "secret" ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                )}

                {!showSecret && (
                  <p className="text-xs text-text-secondary italic">
                    Consumer secret was shown when first generated. If you lost
                    it, contact support to regenerate.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* Setup instructions */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Setup Instructions
            </h2>

            {provider === "managebac" && (
              <div className="space-y-3 text-sm text-text-secondary">
                <h3 className="font-semibold text-text-primary">
                  ManageBac Setup
                </h3>
                <ol className="list-decimal list-inside space-y-2">
                  <li>
                    <strong>Get your API token:</strong> ManageBac → Settings →
                    API Settings → Generate Token
                  </li>
                  <li>
                    <strong>Enter credentials above</strong> and click Save
                  </li>
                  <li>
                    <strong>Set up LTI in ManageBac:</strong> Settings → External
                    Tools → Add Tool → Enter the Launch URL, Consumer Key, and
                    Consumer Secret
                  </li>
                  <li>
                    <strong>Add custom parameter:</strong>{" "}
                    <code className="bg-gray-100 px-1 rounded">
                      custom_studioloom_class=YOUR_CLASS_CODE
                    </code>
                  </li>
                  <li>
                    <strong>Sync students:</strong> Go to your class page →
                    Link your ManageBac class → Click &quot;Sync Students&quot;
                  </li>
                  <li>
                    <strong>Test SSO:</strong> Students click the StudioLoom link
                    in ManageBac
                  </li>
                </ol>
              </div>
            )}

            {provider !== "managebac" && (
              <p className="text-sm text-text-secondary">
                Support for{" "}
                {PROVIDER_OPTIONS.find((o) => o.value === provider)?.label} is
                coming soon. The LTI credentials above will work with any LTI
                1.1 compatible LMS.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ==================== AI TAB ==================== */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">
              AI Unit Generator
            </h2>
            <p className="text-sm text-text-secondary mb-4">
              Connect an AI provider to power the unit creation wizard.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Provider
              </label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const newProvider = e.target.value;
                  setAiProvider(newProvider);
                  if (newProvider === "anthropic") {
                    setAiEndpoint("https://api.anthropic.com/v1");
                    setAiModel("claude-sonnet-4-6");
                  } else {
                    setAiEndpoint("https://api.openai.com/v1");
                    setAiModel("gpt-4o-mini");
                  }
                }}
                className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              >
                <option value="anthropic">Anthropic Claude</option>
                <option value="openai-compatible">OpenAI Compatible</option>
              </select>
            </div>

            {aiProvider === "openai-compatible" && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  API Endpoint
                </label>
                <input
                  type="text"
                  value={aiEndpoint}
                  onChange={(e) => setAiEndpoint(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="w-full max-w-md px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
                />
                <p className="text-xs text-text-secondary mt-1">
                  Common endpoints: OpenAI (api.openai.com/v1), DeepSeek
                  (api.deepseek.com), Groq (api.groq.com/openai/v1)
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                Model Name
              </label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder={aiProvider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini"}
                className="w-full max-w-xs px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              />
              <p className="text-xs text-text-secondary mt-1">
                {aiProvider === "anthropic"
                  ? "e.g. claude-sonnet-4-6, claude-haiku-4-5"
                  : "e.g. gpt-4o-mini, deepseek-chat, qwen-plus, llama-3.1-70b-versatile"}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-text-secondary mb-1">
                API Key
              </label>
              <input
                type="password"
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={
                  aiConfig?.has_api_key
                    ? "••••••••  (key saved — enter new one to update)"
                    : "Paste your API key"
                }
                className="w-full max-w-md px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveAi}
                disabled={savingAi || (!aiApiKey.trim() && !aiConfig)}
                className="px-6 py-2 bg-dark-blue text-white rounded-lg text-sm font-medium hover:bg-dark-blue/90 transition disabled:opacity-50"
              >
                {savingAi
                  ? "Saving..."
                  : aiConfig
                    ? "Update Settings"
                    : "Save Settings"}
              </button>

              {aiConfig?.has_api_key && (
                <button
                  onClick={testAiConnection}
                  disabled={testingAi}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-alt transition disabled:opacity-50"
                >
                  {testingAi ? "Testing..." : "Test Connection"}
                </button>
              )}

              {aiSuccess && (
                <span className="text-sm text-accent-green font-medium">
                  {aiSuccess}
                </span>
              )}
              {aiError && (
                <span className="text-sm text-red-500">{aiError}</span>
              )}
            </div>
          </section>

          {/* Link to advanced AI controls */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Advanced AI Controls</h2>
                <p className="text-sm text-text-secondary">Fine-tune emphasis dials, test generation, and configure AI behaviour in detail.</p>
              </div>
              <a
                href="/admin/ai-model"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
              >
                Open AI Config
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M17 17V7H7" /></svg>
              </a>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
