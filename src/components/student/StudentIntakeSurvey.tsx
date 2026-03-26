"use client";

import { useState, useCallback } from "react";

// ============================================================================
// Research-backed 6-question intake survey
// docs/research/student-influence-factors.md
//
// Questions ranked by research impact:
//   1. Languages at home (ELL scaffolding) — d=moderate, moderates peer learning
//   2. Countries lived in (cultural framing) — TCK strengths, collectivist signals
//   3. Design confidence (self-efficacy) — d=0.92, HIGHEST effect size
//   4. Working style (solo/partner/group) — collectivist/individualist d=0.35
//   5. Feedback preference (private/public) — relationship quality d=0.57
//   6. Learning differences (optional) — UDL accommodation, never shared
// ============================================================================

const COMMON_LANGUAGES = [
  "English", "Mandarin", "Korean", "Japanese", "Spanish",
  "French", "German", "Arabic", "Hindi", "Portuguese",
  "Dutch", "Thai", "Vietnamese", "Indonesian", "Italian",
  "Russian", "Turkish", "Cantonese", "Malay", "Swedish",
];

const COMMON_COUNTRIES = [
  "Australia", "China", "South Korea", "Japan", "USA",
  "UK", "Singapore", "India", "Germany", "France",
  "Canada", "Thailand", "Hong Kong", "New Zealand", "Brazil",
  "Netherlands", "UAE", "Taiwan", "Indonesia", "Malaysia",
  "Sweden", "Switzerland", "South Africa", "Mexico", "Philippines",
];

const LEARNING_DIFFERENCES = [
  { id: "adhd", label: "ADHD", desc: "I find it hard to focus for long periods" },
  { id: "dyslexia", label: "Dyslexia", desc: "Reading and writing can be tricky" },
  { id: "dyscalculia", label: "Dyscalculia", desc: "Numbers and math are challenging" },
  { id: "autism", label: "Autism / ASD", desc: "I process the world differently" },
  { id: "anxiety", label: "Anxiety", desc: "I sometimes feel really worried about schoolwork" },
  { id: "other", label: "Something else", desc: "I have a different learning difference" },
];

// Step configuration — colors, icons, and personality
const STEPS = [
  { color: "#7B2FF2", gradient: "linear-gradient(135deg, #7B2FF2 0%, #5C16C5 100%)", icon: "🗣️" },
  { color: "#2563EB", gradient: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)", icon: "🌍" },
  { color: "#F59E0B", gradient: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)", icon: "💪" },
  { color: "#10B981", gradient: "linear-gradient(135deg, #10B981 0%, #059669 100%)", icon: "🤝" },
  { color: "#8B5CF6", gradient: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)", icon: "💬" },
  { color: "#EC4899", gradient: "linear-gradient(135deg, #EC4899 0%, #DB2777 100%)", icon: "🧠" },
] as const;

const TOTAL_STEPS = 6;

// ============================================================================
// Component
// ============================================================================

interface StudentIntakeSurveyProps {
  studentName: string;
  onComplete: () => void;
}

export function StudentIntakeSurvey({ studentName, onComplete }: StudentIntakeSurveyProps) {
  const [step, setStep] = useState(1);
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLang, setCustomLang] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [customCountry, setCustomCountry] = useState("");
  const [designConfidence, setDesignConfidence] = useState<number>(0); // 1-5, 0 = not selected
  const [workingStyle, setWorkingStyle] = useState<"solo" | "partner" | "small_group" | null>(null);
  const [feedbackPref, setFeedbackPref] = useState<"private" | "public" | null>(null);
  const [learningDiffs, setLearningDiffs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }, []);

  const addCustom = useCallback((value: string, list: string[], setter: (v: string[]) => void, clearInput: () => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
    clearInput();
  }, []);

  const firstName = studentName.split(" ")[0] || "there";
  const stepConfig = STEPS[step - 1];

  // Can we advance from the current step?
  const canAdvance =
    (step === 1 && languages.length > 0) ||
    (step === 2) || // countries optional
    (step === 3 && designConfidence > 0) ||
    (step === 4 && workingStyle !== null) ||
    (step === 5 && feedbackPref !== null) ||
    (step === 6); // learning diffs always optional

  async function handleSubmit() {
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/student/learning-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages_at_home: languages,
          countries_lived_in: countries,
          design_confidence: designConfidence,
          working_style: workingStyle,
          feedback_preference: feedbackPref,
          learning_differences: learningDiffs,
        }),
      });

      if (res.ok || res.status === 409) {
        onComplete();
      } else {
        const data = await res.json();
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Connection error — please try again");
    } finally {
      setSaving(false);
    }
  }

  // ---- Step headers ----
  const headers: Record<number, { title: string; subtitle: string }> = {
    1: { title: `Hey ${firstName}! What languages do you speak at home?`, subtitle: "This helps your AI mentor adapt to you. Tap all that apply." },
    2: { title: "Where in the world have you lived?", subtitle: "Even briefly counts! This helps us celebrate your unique perspective." },
    3: { title: "How do you feel about design projects?", subtitle: "There\u2019s no wrong answer \u2014 this helps us meet you where you are." },
    4: { title: "How do you like to work?", subtitle: "When you have a big project, what\u2019s your natural style?" },
    5: { title: "How do you prefer getting feedback?", subtitle: "This changes how your AI mentor and teacher talk to you." },
    6: { title: "One more thing \u2014 totally optional", subtitle: "If any of these apply to you, it helps us set things up better. Skip if you like." },
  };

  const h = headers[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{
          animation: "fadeSlideUp 0.3s ease-out",
        }}
      >
        {/* Animated header */}
        <div className="px-6 pt-6 pb-4 relative overflow-hidden" style={{ background: stepConfig.gradient }}>
          {/* Decorative circles */}
          <div
            className="absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-20"
            style={{ background: "white" }}
          />
          <div
            className="absolute -right-2 top-8 w-12 h-12 rounded-full opacity-10"
            style={{ background: "white" }}
          />

          <div className="relative">
            <span className="text-3xl mb-2 block">{stepConfig.icon}</span>
            <h2 className="text-white text-xl font-bold leading-tight">{h.title}</h2>
            <p className="text-white/60 text-sm mt-2">{h.subtitle}</p>
          </div>
        </div>

        {/* Progress bar — smooth, colored per step */}
        <div className="h-1 bg-gray-100 relative">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${(step / TOTAL_STEPS) * 100}%`,
              background: stepConfig.gradient,
            }}
          />
        </div>

        {/* Content area */}
        <div className="px-6 py-5 min-h-[280px] max-h-[50vh] overflow-y-auto">

          {/* ================================================================ */}
          {/* Step 1: Languages */}
          {/* ================================================================ */}
          {step === 1 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {COMMON_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleItem(languages, lang, setLanguages)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      languages.includes(lang)
                        ? "bg-purple-100 text-purple-700 ring-2 ring-purple-300 scale-105"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customLang}
                  onChange={(e) => setCustomLang(e.target.value)}
                  placeholder="Other language..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustom(customLang, languages, setLanguages, () => setCustomLang(""));
                  }}
                />
                {customLang.trim() && (
                  <button
                    onClick={() => addCustom(customLang, languages, setLanguages, () => setCustomLang(""))}
                    className="px-3 py-2 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                  >
                    Add
                  </button>
                )}
              </div>
              {languages.filter((l) => !COMMON_LANGUAGES.includes(l)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {languages.filter((l) => !COMMON_LANGUAGES.includes(l)).map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700"
                    >
                      {lang}
                      <button onClick={() => setLanguages((prev) => prev.filter((l) => l !== lang))} className="hover:text-purple-900">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Step 2: Countries */}
          {/* ================================================================ */}
          {step === 2 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {COMMON_COUNTRIES.map((country) => (
                  <button
                    key={country}
                    onClick={() => toggleItem(countries, country, setCountries)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                      countries.includes(country)
                        ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300 scale-105"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {country}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customCountry}
                  onChange={(e) => setCustomCountry(e.target.value)}
                  placeholder="Other country..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCustom(customCountry, countries, setCountries, () => setCustomCountry(""));
                  }}
                />
                {customCountry.trim() && (
                  <button
                    onClick={() => addCustom(customCountry, countries, setCountries, () => setCustomCountry(""))}
                    className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    Add
                  </button>
                )}
              </div>
              {countries.filter((c) => !COMMON_COUNTRIES.includes(c)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {countries.filter((c) => !COMMON_COUNTRIES.includes(c)).map((country) => (
                    <span
                      key={country}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700"
                    >
                      {country}
                      <button onClick={() => setCountries((prev) => prev.filter((c) => c !== country))} className="hover:text-blue-900">×</button>
                    </span>
                  ))}
                </div>
              )}
              {countries.length === 0 && (
                <p className="text-xs text-gray-400 mt-3 italic">
                  No worries if you&apos;ve only ever lived in one place — that&apos;s totally fine!
                </p>
              )}
            </div>
          )}

          {/* ================================================================ */}
          {/* Step 3: Design Confidence (self-efficacy, d=0.92) */}
          {/* ================================================================ */}
          {step === 3 && (
            <div className="space-y-4">
              {[
                { value: 1, emoji: "😰", label: "Pretty nervous", desc: "I\u2019ve never really done this before" },
                { value: 2, emoji: "😬", label: "A bit unsure", desc: "I\u2019ve tried but I don\u2019t feel confident" },
                { value: 3, emoji: "🙂", label: "Getting there", desc: "I know some stuff, still learning" },
                { value: 4, emoji: "😊", label: "Fairly confident", desc: "I\u2019ve done projects and enjoyed them" },
                { value: 5, emoji: "🤩", label: "Love it!", desc: "Design is my thing" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDesignConfidence(opt.value)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-200 ${
                    designConfidence === opt.value
                      ? "border-amber-400 bg-amber-50 scale-[1.02] shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{opt.label}</p>
                      <p className="text-sm text-gray-500">{opt.desc}</p>
                    </div>
                    {designConfidence === opt.value && (
                      <span className="ml-auto text-amber-500 flex-shrink-0">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ================================================================ */}
          {/* Step 4: Working style preference */}
          {/* ================================================================ */}
          {step === 4 && (
            <div className="space-y-3">
              {[
                {
                  value: "solo" as const,
                  emoji: "🎧",
                  label: "I like working on my own",
                  desc: "Headphones on, deep focus. I\u2019ll ask for help when I need it.",
                },
                {
                  value: "partner" as const,
                  emoji: "👫",
                  label: "I like working with a partner",
                  desc: "One other person to bounce ideas off — that\u2019s my sweet spot.",
                },
                {
                  value: "small_group" as const,
                  emoji: "👥",
                  label: "I like working in a small group",
                  desc: "A team of 3\u20134 where everyone brings different ideas.",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setWorkingStyle(opt.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                    workingStyle === opt.value
                      ? "border-emerald-400 bg-emerald-50 scale-[1.02] shadow-sm"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{opt.emoji}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900">{opt.label}</p>
                      <p className="text-sm text-gray-500">{opt.desc}</p>
                    </div>
                    {workingStyle === opt.value && (
                      <span className="ml-auto text-emerald-500 flex-shrink-0">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ================================================================ */}
          {/* Step 5: Feedback preference */}
          {/* ================================================================ */}
          {step === 5 && (
            <div className="space-y-3">
              <button
                onClick={() => setFeedbackPref("private")}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  feedbackPref === "private"
                    ? "border-violet-400 bg-violet-50 scale-[1.02] shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">🔒</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">I prefer private feedback</p>
                    <p className="text-sm text-gray-500">
                      Comments and suggestions just between me and my teacher or AI mentor
                    </p>
                  </div>
                  {feedbackPref === "private" && (
                    <span className="ml-auto text-violet-500 flex-shrink-0">✓</span>
                  )}
                </div>
              </button>

              <button
                onClick={() => setFeedbackPref("public")}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  feedbackPref === "public"
                    ? "border-violet-400 bg-violet-50 scale-[1.02] shadow-sm"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">💬</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">I&apos;m fine with feedback in front of others</p>
                    <p className="text-sm text-gray-500">
                      I don&apos;t mind sharing my work and hearing feedback during class
                    </p>
                  </div>
                  {feedbackPref === "public" && (
                    <span className="ml-auto text-violet-500 flex-shrink-0">✓</span>
                  )}
                </div>
              </button>
            </div>
          )}

          {/* ================================================================ */}
          {/* Step 6: Learning differences (optional) */}
          {/* ================================================================ */}
          {step === 6 && (
            <div>
              <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 mb-4">
                <p className="text-sm text-pink-800">
                  <strong>This is private.</strong> Only your teacher can see this, and only to help set things up for you.
                  You can skip this entirely.
                </p>
              </div>

              <div className="space-y-2">
                {LEARNING_DIFFERENCES.map((ld) => (
                  <button
                    key={ld.id}
                    onClick={() => toggleItem(learningDiffs, ld.id, setLearningDiffs)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all duration-200 ${
                      learningDiffs.includes(ld.id)
                        ? "border-pink-400 bg-pink-50"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{ld.label}</p>
                        <p className="text-xs text-gray-500">{ld.desc}</p>
                      </div>
                      {learningDiffs.includes(ld.id) && (
                        <span className="text-pink-500 flex-shrink-0 ml-2">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => { setLearningDiffs([]); }}
                className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                None of these apply to me
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-2 flex items-center justify-between border-t border-gray-100">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              onClick={() => canAdvance && setStep((s) => s + 1)}
              disabled={!canAdvance}
              className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 active:scale-100"
              style={{ background: stepConfig.gradient }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-105 active:scale-100"
              style={{ background: "linear-gradient(135deg, #10B981, #059669)" }}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                "All done! ✓"
              )}
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center pb-4 px-6">{error}</p>
        )}
      </div>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
