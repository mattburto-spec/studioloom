"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { LMSProviderType } from "@/types";
import { SchoolCalendarSetup } from "@/components/teacher/SchoolCalendarSetup";

type SettingsTab = "general" | "school" | "lms" | "ai";

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
    Promise.all([loadIntegration(), loadAiSettings(), loadProfile()]).then(() =>
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

          {/* ── 2. Timetable ── */}
          <section className="bg-white rounded-xl p-6 border border-border">
            <h2 className="text-lg font-semibold text-text-primary mb-1">Timetable</h2>
            <p className="text-sm text-text-secondary mb-5">Period lengths drive lesson timing and the Workshop Model.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="mt-4">
                <label className="block text-sm font-medium text-text-secondary mb-1">Double period length (minutes)</label>
                <input type="number" value={doublePeriodMinutes} onChange={(e) => setDoublePeriodMinutes(Number(e.target.value))} min={40} max={240} className="w-48 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30" />
                <p className="text-xs text-text-secondary/60 mt-1">Often not exactly 2x — e.g. 50 min singles = 95 min doubles</p>
              </div>
            )}
          </section>

          {/* ── 3. School Calendar ── */}
          <SchoolCalendarSetup />

          {/* ── 4. Workshop Spaces & Safety ── */}
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

          {/* ── 5. Tools & Machines ── */}
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

          {/* ── 6. Software ── */}
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

          {/* ── 7. New Metrics ── */}
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
                <p>Everything here feeds the AI. Period lengths drive lesson timing. Equipment lists ensure activities are realistic. Safety badge requirements gate student access to workshops. New Metrics controls whether competency assessment appears across the platform.</p>
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
        </div>
      )}
    </main>
  );
}
