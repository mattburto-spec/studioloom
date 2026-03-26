"use client";

import { useState, useCallback } from "react";

// ============================================================================
// Common languages for international schools (MYP context)
// ============================================================================

const COMMON_LANGUAGES = [
  "English", "Mandarin", "Korean", "Japanese", "Spanish",
  "French", "German", "Arabic", "Hindi", "Portuguese",
  "Dutch", "Thai", "Vietnamese", "Indonesian", "Italian",
];

const COMMON_COUNTRIES = [
  "Australia", "China", "South Korea", "Japan", "USA",
  "UK", "Singapore", "India", "Germany", "France",
  "Canada", "Thailand", "Hong Kong", "New Zealand", "Brazil",
  "Netherlands", "UAE", "Taiwan", "Indonesia", "Malaysia",
];

// ============================================================================
// Component
// ============================================================================

interface StudentIntakeSurveyProps {
  studentName: string;
  onComplete: () => void;
}

export function StudentIntakeSurvey({ studentName, onComplete }: StudentIntakeSurveyProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLang, setCustomLang] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [customCountry, setCustomCountry] = useState("");
  const [feedbackPref, setFeedbackPref] = useState<"private" | "public" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleItem = useCallback((list: string[], item: string, setter: (v: string[]) => void) => {
    setter(
      list.includes(item) ? list.filter((i) => i !== item) : [...list, item]
    );
  }, []);

  const addCustom = useCallback((value: string, list: string[], setter: (v: string[]) => void, clearInput: () => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
    clearInput();
  }, []);

  async function handleSubmit() {
    if (!feedbackPref) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/student/learning-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          languages_at_home: languages,
          countries_lived_in: countries,
          feedback_preference: feedbackPref,
        }),
      });

      if (res.ok || res.status === 409) {
        // 409 = already completed, still fine
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

  const firstName = studentName.split(" ")[0] || "there";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-6 pt-6 pb-4"
          style={{
            background: "linear-gradient(135deg, #7B2FF2 0%, #5C16C5 50%, #3B0D99 100%)",
          }}
        >
          <p className="text-white/70 text-sm mb-1">Quick intro</p>
          <h2 className="text-white text-xl font-bold">
            {step === 1 && `Hey ${firstName} — what languages do you speak at home?`}
            {step === 2 && "Where have you lived?"}
            {step === 3 && "One more — how do you like getting feedback?"}
          </h2>
          <p className="text-white/50 text-xs mt-2">
            This helps us personalise your experience. Takes 30 seconds.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 border-b border-gray-100">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: s === step ? 32 : 8,
                background: s <= step
                  ? "linear-gradient(90deg, #7B2FF2, #a855f7)"
                  : "#e2e8f0",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 min-h-[260px]">
          {/* Step 1: Languages */}
          {step === 1 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Tap all that apply — including languages you&apos;re still learning
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {COMMON_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => toggleItem(languages, lang, setLanguages)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      languages.includes(lang)
                        ? "bg-purple-100 text-purple-700 ring-2 ring-purple-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              {/* Custom entry */}
              <div className="flex gap-2">
                <input
                  value={customLang}
                  onChange={(e) => setCustomLang(e.target.value)}
                  placeholder="Other language..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addCustom(customLang, languages, setLanguages, () => setCustomLang(""));
                    }
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
              {/* Selected custom languages */}
              {languages.filter((l) => !COMMON_LANGUAGES.includes(l)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {languages.filter((l) => !COMMON_LANGUAGES.includes(l)).map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-700"
                    >
                      {lang}
                      <button
                        onClick={() => setLanguages((prev) => prev.filter((l) => l !== lang))}
                        className="hover:text-purple-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Countries */}
          {step === 2 && (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                Tap countries you&apos;ve lived in — even briefly
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {COMMON_COUNTRIES.map((country) => (
                  <button
                    key={country}
                    onClick={() => toggleItem(countries, country, setCountries)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      countries.includes(country)
                        ? "bg-blue-100 text-blue-700 ring-2 ring-blue-300"
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
                    if (e.key === "Enter") {
                      addCustom(customCountry, countries, setCountries, () => setCustomCountry(""));
                    }
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
                      <button
                        onClick={() => setCountries((prev) => prev.filter((c) => c !== country))}
                        className="hover:text-blue-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Feedback preference */}
          {step === 3 && (
            <div>
              <p className="text-sm text-gray-500 mb-5">
                There&apos;s no right answer — this just helps your AI mentor know how to work with you
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => setFeedbackPref("private")}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    feedbackPref === "private"
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">🔒</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        I prefer getting feedback privately
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        I&apos;d rather get comments and suggestions just between me and my teacher or AI mentor
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setFeedbackPref("public")}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    feedbackPref === "public"
                      ? "border-purple-400 bg-purple-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">💬</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        I&apos;m comfortable with feedback in front of others
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        I don&apos;t mind sharing my work and hearing feedback during class discussions or critiques
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
            >
              ← Back
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              disabled={step === 1 && languages.length === 0}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              style={{
                background: "linear-gradient(135deg, #7B2FF2, #a855f7)",
              }}
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!feedbackPref || saving}
              className="px-5 py-2.5 rounded-full text-sm font-medium text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              style={{
                background: "linear-gradient(135deg, #7B2FF2, #a855f7)",
              }}
            >
              {saving ? "Saving..." : "Done ✓"}
            </button>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center pb-4">{error}</p>
        )}
      </div>
    </div>
  );
}
