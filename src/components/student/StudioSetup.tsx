"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { MENTORS, MENTOR_IDS, type MentorId } from "@/lib/student/mentors";
import { THEMES, type ThemeId } from "@/lib/student/themes";
import { themeForMentor } from "@/lib/student/onboarding-images";
import { VisualPicksScreen } from "./VisualPicksScreen";

// ============================================================================
// "Set Up Your Studio" — First-login onboarding experience.
//
// Round 27 (7 May 2026, NIS Class 1 day): trimmed from 4 screens → 2.
// Per Matt: "remove the parts of the student onboarding that ask to choose
// the different design styles from a picture and the mentor."
//
// 2 screens (live):
//   1. Mentor Conversation (Learning Profile questions, skippable)
//      → 5 sub-steps: languages / confidence / working / feedback /
//        learning_diffs
//   2. Welcome Reveal (quick dashboard preview)
//
// Default mentor = "kit" (warm + hands-on, the most agnostic of the three).
// Default theme = "warm" (auto-derived from kit via themeForMentor).
// Both are still editable via the Settings cog post-onboarding — students
// who care about the mentor can change later, students who don't never
// have to think about it.
//
// Why we kept the JSX for the removed screens: dead branches don't render
// (Screen state never enters "visualPicks" or "mentor"), and the v2
// Designer Mentor spec re-introduces a richer version of those screens.
// Easier to gate them via initial-state than rip the rendering code out.
//
// Metaphor: setting up your own design studio workspace.
// Mental model: character creation in a game.
// ============================================================================

// --- Inline SVG Icons (no lucide-react in project) ---

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const SkipIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="13 17 18 12 13 7" /><polyline points="6 17 11 12 6 7" />
  </svg>
);

// --- Common language/country data (shared with StudentIntakeSurvey) ---

const COMMON_LANGUAGES = [
  "English", "Mandarin", "Korean", "Japanese", "Spanish",
  "French", "German", "Arabic", "Hindi", "Portuguese",
  "Dutch", "Thai", "Vietnamese", "Indonesian", "Italian",
];

const LEARNING_DIFFERENCES = [
  { id: "adhd", label: "ADHD", desc: "Focus can be tricky" },
  { id: "dyslexia", label: "Dyslexia", desc: "Reading/writing" },
  { id: "anxiety", label: "Anxiety", desc: "Worry about school" },
  { id: "autism", label: "Autism / ASD", desc: "Process differently" },
  { id: "dyscalculia", label: "Dyscalculia", desc: "Numbers" },
  { id: "other", label: "Something else", desc: "" },
];

const CONFIDENCE_LEVELS = [
  { value: 1, emoji: "😰", label: "Pretty nervous" },
  { value: 2, emoji: "😬", label: "A bit unsure" },
  { value: 3, emoji: "🤷", label: "Somewhere in the middle" },
  { value: 4, emoji: "😊", label: "Feeling good" },
  { value: 5, emoji: "🤩", label: "Love it!" },
] as const;

// ============================================================================
// Props & Types
// ============================================================================

interface StudioSetupProps {
  studentName: string;
  onComplete: (data: {
    mentorId: MentorId;
    themeId: ThemeId;
    learningProfile: LearningProfileData | null;
    /** Visual-picks tile IDs from screen 1 — persisted for v2 rematch */
    onboardingPicks: string[];
  }) => void;
}

interface LearningProfileData {
  languages_at_home: string[];
  countries_lived_in: string[];
  design_confidence: 1 | 2 | 3 | 4 | 5;
  working_style: "solo" | "partner" | "small_group";
  feedback_preference: "private" | "public";
  learning_differences: string[];
}

type Screen = "visualPicks" | "mentor" | "conversation" | "welcome";

// Conversation sub-steps
type ConvoStep = "languages" | "confidence" | "working" | "feedback" | "learning_diffs";
const CONVO_STEPS: ConvoStep[] = ["languages", "confidence", "working", "feedback", "learning_diffs"];

// ============================================================================
// Component
// ============================================================================

export function StudioSetup({ studentName, onComplete }: StudioSetupProps) {
  // --- Screen state ---
  // Round 27 — start directly at the conversation screen with kit/warm
  // pre-selected. The visualPicks + mentor screens are bypassed.
  const [screen, setScreen] = useState<Screen>("conversation");
  const [selectedMentor, setSelectedMentor] = useState<MentorId | null>("kit");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId | null>("warm");

  // --- Visual picks state (Screen 1, retained for v2 reactivation) ---
  // Persisted to students.onboarding_picks (migration 20260504225635) so the
  // v2 Designer Mentor System can re-run cosine-similarity matching against
  // the 20-designer pool without re-onboarding existing students. Stays as
  // an empty array in round 27 — the column accepts empty arrays.
  const [pickedImageIds, setPickedImageIds] = useState<string[]>([]);
  // Round 27 — no longer surfaced; declared so existing handlers compile.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [suggestedMentor, setSuggestedMentor] = useState<MentorId | null>(null);

  // --- Conversation state ---
  const [convoStep, setConvoStep] = useState(0);
  const [mentorReaction, setMentorReaction] = useState<string | null>(null);
  const [showReaction, setShowReaction] = useState(false);

  // --- Learning profile answers ---
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLang, setCustomLang] = useState("");
  const [designConfidence, setDesignConfidence] = useState<number>(0);
  const [workingStyle, setWorkingStyle] = useState<"solo" | "partner" | "small_group" | null>(null);
  const [feedbackPref, setFeedbackPref] = useState<"private" | "public" | null>(null);
  const [learningDiffs, setLearningDiffs] = useState<string[]>([]);

  // --- Saving state ---
  const [saving, setSaving] = useState(false);

  // --- Refs ---
  const containerRef = useRef<HTMLDivElement>(null);

  const mentor = selectedMentor ? MENTORS[selectedMentor] : null;
  const theme = selectedTheme ? THEMES[selectedTheme] : null;

  // --- Show mentor reaction with animation ---
  const showMentorReaction = useCallback((text: string) => {
    setMentorReaction(text);
    setShowReaction(false);
    // Small delay for animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setShowReaction(true));
    });
  }, []);

  // Round 27 — fire the mentor greeting on mount (used to fire from
  // proceedFromMentor when the student exited the picker, but now the
  // picker is bypassed). Empty deps array so it only runs once.
  useEffect(() => {
    if (!mentor) return;
    showMentorReaction(
      `Hey ${studentName.split(" ")[0]}! ${mentor.greeting} Let me ask you a few quick things.`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Navigation ---
  const handleVisualPicksComplete = useCallback(
    (result: { pickedIds: string[]; suggested: MentorId }) => {
      setPickedImageIds(result.pickedIds);
      setSuggestedMentor(result.suggested);
      // Pre-select the suggested mentor — student can still change on next screen.
      setSelectedMentor(result.suggested);
      setScreen("mentor");
    },
    []
  );

  const proceedFromMentor = useCallback(() => {
    if (!selectedMentor) return;
    // Auto-derive theme from mentor — students no longer pick a theme in v1.
    const themeId = themeForMentor(selectedMentor);
    setSelectedTheme(themeId);
    const mentorDef = MENTORS[selectedMentor];
    setScreen("conversation");
    setConvoStep(0);
    // Mentor's first question
    showMentorReaction(
      `Hey ${studentName.split(" ")[0]}! ${mentorDef.greeting} Let me ask you a few quick things.`
    );
  }, [selectedMentor, studentName, showMentorReaction]);

  const skipToWelcome = useCallback(() => {
    if (selectedMentor && !selectedTheme) {
      setSelectedTheme(themeForMentor(selectedMentor));
    }
    setScreen("welcome");
  }, [selectedMentor, selectedTheme]);

  const advanceConvo = useCallback(() => {
    if (convoStep < CONVO_STEPS.length - 1) {
      setConvoStep((s) => s + 1);
      setMentorReaction(null);
      setShowReaction(false);
    } else {
      // All questions answered — go to welcome
      setScreen("welcome");
    }
  }, [convoStep]);

  // --- Trigger mentor reaction on answer ---
  const reactToConfidence = useCallback((val: number) => {
    setDesignConfidence(val);
    if (mentor) {
      showMentorReaction(mentor.reactions.designConfidence[val as 1 | 2 | 3 | 4 | 5]);
    }
  }, [mentor, showMentorReaction]);

  const reactToWorkingStyle = useCallback((val: "solo" | "partner" | "small_group") => {
    setWorkingStyle(val);
    if (mentor) {
      showMentorReaction(mentor.reactions.workingStyle[val]);
    }
  }, [mentor, showMentorReaction]);

  const reactToFeedback = useCallback((val: "private" | "public") => {
    setFeedbackPref(val);
    if (mentor) {
      showMentorReaction(mentor.reactions.feedbackPreference[val]);
    }
  }, [mentor, showMentorReaction]);

  // --- Final save ---
  const handleComplete = useCallback(async () => {
    if (!selectedMentor) return;
    setSaving(true);

    // Theme is auto-derived from mentor in v1; fall back if somehow not set.
    const themeId: ThemeId = selectedTheme ?? themeForMentor(selectedMentor);

    // Build learning profile if any questions answered
    const hasProfile = languages.length > 0 || designConfidence > 0 || workingStyle || feedbackPref;
    const profile: LearningProfileData | null = hasProfile
      ? {
          languages_at_home: languages.length > 0 ? languages : ["English"],
          countries_lived_in: [],
          design_confidence: (designConfidence || 3) as 1 | 2 | 3 | 4 | 5,
          working_style: workingStyle || "solo",
          feedback_preference: feedbackPref || "private",
          learning_differences: learningDiffs,
        }
      : null;

    onComplete({
      mentorId: selectedMentor,
      themeId,
      learningProfile: profile,
      onboardingPicks: pickedImageIds,
    });
  }, [selectedMentor, selectedTheme, pickedImageIds, languages, designConfidence, workingStyle, feedbackPref, learningDiffs, onComplete]);

  // --- Auto-advance after reaction shown for single-choice questions ---
  useEffect(() => {
    if (!showReaction || !mentorReaction) return;
    const currentStep = CONVO_STEPS[convoStep];
    // For single-choice questions, auto-advance after showing reaction
    if (["confidence", "working", "feedback"].includes(currentStep)) {
      const timer = setTimeout(() => advanceConvo(), 1800);
      return () => clearTimeout(timer);
    }
  }, [showReaction, mentorReaction, convoStep, advanceConvo]);

  // ============================================================================
  // Render
  // ============================================================================

  // Keep the dark dramatic background for picks / mentor / conversation —
  // the light themes (warm, clean) would make the white text on those screens
  // unreadable. The theme bg only previews on the welcome reveal, which is
  // intentionally designed to show the student a taste of their studio.
  const bgStyle = (screen === "welcome" && theme)
    ? { background: theme.tokens["--st-bg"] }
    : { background: "linear-gradient(135deg, #0F0F1A 0%, #1A1A3E 50%, #0F0F1A 100%)" };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-start overflow-y-auto"
      style={{
        ...bgStyle,
        transition: "background 0.6s ease",
      }}
    >
      {/* Progress dots — round 27 trimmed to the 2 live screens. */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-50">
        {(["conversation", "welcome"] as Screen[]).map((s, i) => (
          <div
            key={s}
            className="rounded-full transition-all duration-500"
            style={{
              width: screen === s ? 24 : 8,
              height: 8,
              background: screen === s
                ? (mentor?.accent || "#7B2FF2")
                : (["conversation", "welcome"].indexOf(screen) > i
                    ? (mentor?.accent || "#7B2FF2")
                    : "rgba(255,255,255,0.2)"),
              opacity: screen === s ? 1 : 0.6,
            }}
          />
        ))}
      </div>

      {/* ============ Screen 1: Visual Picks ============ */}
      {screen === "visualPicks" && (
        <VisualPicksScreen onComplete={handleVisualPicksComplete} />
      )}

      {/* ============ Screen 2: Choose Your Mentor ============ */}
      {screen === "mentor" && (
        <div className="w-full max-w-3xl mx-auto px-4 py-16 animate-fadeIn">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              Choose your mentor
            </h1>
            {suggestedMentor ? (
              <p className="text-white/70 text-base">
                Based on your picks,{" "}
                <strong style={{ color: MENTORS[suggestedMentor].accent }}>
                  {MENTORS[suggestedMentor].name}
                </strong>{" "}
                feels like a natural match — but pick whoever speaks to you.
              </p>
            ) : (
              <p className="text-white/60 text-base">
                Choose a mentor to guide you through your design journey
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {MENTOR_IDS.map((id) => {
              const m = MENTORS[id];
              const isSelected = selectedMentor === id;
              return (
                <button
                  key={id}
                  onClick={() => setSelectedMentor(id)}
                  className="relative rounded-2xl p-5 text-left transition-all duration-300 group overflow-hidden"
                  style={{
                    background: isSelected ? m.gradient : "rgba(255,255,255,0.06)",
                    border: isSelected ? `2px solid ${m.accent}` : "2px solid rgba(255,255,255,0.08)",
                    transform: isSelected ? "scale(1.02)" : "scale(1)",
                    boxShadow: isSelected ? `0 8px 32px ${m.accent}30` : "none",
                  }}
                >
                  {/* Selection check */}
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-white">
                      <CheckIcon />
                    </div>
                  )}

                  {/* Mentor avatar */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl overflow-hidden"
                      style={{
                        background: isSelected ? "rgba(255,255,255,0.2)" : `${m.accent}18`,
                        border: `2px solid ${isSelected ? "rgba(255,255,255,0.3)" : m.accent + "30"}`,
                      }}
                    >
                      {m.image ? (
                        <img src={m.image} alt={m.name} className="w-full h-full object-cover" />
                      ) : (
                        m.emoji
                      )}
                    </div>
                    <div>
                      <h3
                        className="text-lg font-bold"
                        style={{ color: isSelected ? "white" : "#F1F1F4" }}
                      >
                        {m.name}
                      </h3>
                      <p
                        className="text-xs font-medium"
                        style={{ color: isSelected ? "rgba(255,255,255,0.7)" : m.accent }}
                      >
                        {m.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Personality traits */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {m.traits.map((trait) => (
                      <span
                        key={trait}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.15)" : `${m.accent}12`,
                          color: isSelected ? "white" : m.accent,
                        }}
                      >
                        {trait}
                      </span>
                    ))}
                  </div>

                  {/* Speech bubble */}
                  <div
                    className="rounded-xl px-3 py-2.5 text-sm italic leading-relaxed"
                    style={{
                      background: isSelected ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.08)",
                      color: isSelected ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    &ldquo;{m.greeting}&rdquo;
                  </div>
                </button>
              );
            })}
          </div>

          {/* Continue button */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={() => setScreen("visualPicks")}
              className="px-5 py-2.5 rounded-xl text-white/50 hover:text-white/80 text-sm font-medium transition-colors"
            >
              Back
            </button>
            <button
              onClick={proceedFromMentor}
              disabled={!selectedMentor}
              className="px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: mentor?.accent || "#7B2FF2",
                color: "white",
                boxShadow: selectedMentor ? `0 4px 20px ${mentor?.accent}40` : "none",
              }}
            >
              Continue <ArrowRight />
            </button>
          </div>
        </div>
      )}

      {/* Theme picker removed in v1 — theme auto-derives from mentor.
          See onboarding-images.ts → MENTOR_THEME_MAP. v2 (Designer Mentor
          System) brings back per-mentor theme assignment via the 20-designer
          system; settings cog still exposes the full theme picker today. */}

      {/* ============ Screen 3: Mentor Conversation ============ */}
      {screen === "conversation" && mentor && (
        <div className="w-full max-w-lg mx-auto px-4 py-16 animate-fadeIn">
          {/* Skip link */}
          <button
            onClick={skipToWelcome}
            className="fixed top-6 right-6 flex items-center gap-1 text-xs font-medium transition-colors z-50"
            style={{ color: theme ? theme.preview.textSecondary : "rgba(255,255,255,0.4)" }}
          >
            Skip to my studio <SkipIcon />
          </button>

          {/* Mentor avatar + name */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl overflow-hidden"
              style={{ background: `${mentor.accent}20`, border: `2px solid ${mentor.accent}40` }}
            >
              {mentor.image ? (
                <img src={mentor.image} alt={mentor.name} className="w-full h-full object-cover" />
              ) : (
                mentor.emoji
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{mentor.name}</p>
              <p className="text-xs" style={{ color: mentor.accent }}>{mentor.tagline}</p>
            </div>
          </div>

          {/* Mentor reaction bubble */}
          {mentorReaction && (
            <div
              className="rounded-2xl px-4 py-3 mb-6 text-sm leading-relaxed transition-all duration-500"
              style={{
                background: `${mentor.accent}15`,
                border: `1px solid ${mentor.accent}25`,
                color: "rgba(255,255,255,0.85)",
                opacity: showReaction ? 1 : 0,
                transform: showReaction ? "translateY(0)" : "translateY(8px)",
              }}
            >
              {mentorReaction}
            </div>
          )}

          {/* Progress indicator */}
          <div className="flex gap-1 mb-6">
            {CONVO_STEPS.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-all duration-500"
                style={{
                  background: i <= convoStep ? mentor.accent : "rgba(255,255,255,0.1)",
                }}
              />
            ))}
          </div>

          {/* Question cards */}
          {CONVO_STEPS[convoStep] === "languages" && (
            <ConvoCard title="What languages do you speak at home?" hint="Tap all that apply">
              <div className="flex flex-wrap gap-2">
                {COMMON_LANGUAGES.map((lang) => (
                  <PillButton
                    key={lang}
                    label={lang}
                    selected={languages.includes(lang)}
                    accent={mentor.accent}
                    onClick={() => {
                      setLanguages((prev) =>
                        prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                      );
                    }}
                  />
                ))}
              </div>
              {/* Custom language input */}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={customLang}
                  onChange={(e) => setCustomLang(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customLang.trim()) {
                      setLanguages((prev) => [...prev, customLang.trim()]);
                      setCustomLang("");
                    }
                  }}
                  placeholder="Other language..."
                  className="flex-1 rounded-xl px-3 py-2 text-sm bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
                />
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => {
                    if (languages.length > 0 && mentor) {
                      showMentorReaction(mentor.reactions.languages(languages));
                      setTimeout(advanceConvo, 1800);
                    } else {
                      advanceConvo();
                    }
                  }}
                  disabled={languages.length === 0}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-30 transition-all"
                  style={{ background: mentor.accent }}
                >
                  Next
                </button>
              </div>
            </ConvoCard>
          )}

          {CONVO_STEPS[convoStep] === "confidence" && (
            <ConvoCard title="How do you feel about design right now?" hint="No wrong answers">
              <div className="grid grid-cols-5 gap-2">
                {CONFIDENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => reactToConfidence(level.value)}
                    className="flex flex-col items-center gap-1 rounded-xl py-3 transition-all duration-300"
                    style={{
                      background: designConfidence === level.value ? `${mentor.accent}20` : "rgba(255,255,255,0.08)",
                      border: designConfidence === level.value ? `2px solid ${mentor.accent}` : "2px solid rgba(255,255,255,0.12)",
                      transform: designConfidence === level.value ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    <span className="text-2xl">{level.emoji}</span>
                    <span className="text-[10px] text-white/70 text-center leading-tight">{level.label}</span>
                  </button>
                ))}
              </div>
            </ConvoCard>
          )}

          {CONVO_STEPS[convoStep] === "working" && (
            <ConvoCard title="How do you prefer to work?" hint="You'll get plenty of all styles">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { id: "solo" as const, emoji: "🐺", label: "Solo", desc: "On my own" },
                  { id: "partner" as const, emoji: "🤝", label: "Partner", desc: "With one person" },
                  { id: "small_group" as const, emoji: "👥", label: "Group", desc: "Small team" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => reactToWorkingStyle(opt.id)}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-4 transition-all duration-300"
                    style={{
                      background: workingStyle === opt.id ? `${mentor.accent}20` : "rgba(255,255,255,0.08)",
                      border: workingStyle === opt.id ? `2px solid ${mentor.accent}` : "2px solid rgba(255,255,255,0.12)",
                      transform: workingStyle === opt.id ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-sm font-semibold text-white">{opt.label}</span>
                    <span className="text-[10px] text-white/60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </ConvoCard>
          )}

          {CONVO_STEPS[convoStep] === "feedback" && (
            <ConvoCard title="How do you prefer to get feedback?" hint="We adapt to you">
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: "private" as const, emoji: "🔒", label: "Private", desc: "Just between me and my mentor" },
                  { id: "public" as const, emoji: "🎤", label: "Open", desc: "Happy with group critique" },
                ] as const).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => reactToFeedback(opt.id)}
                    className="flex flex-col items-center gap-1.5 rounded-xl py-4 px-3 transition-all duration-300"
                    style={{
                      background: feedbackPref === opt.id ? `${mentor.accent}20` : "rgba(255,255,255,0.08)",
                      border: feedbackPref === opt.id ? `2px solid ${mentor.accent}` : "2px solid rgba(255,255,255,0.12)",
                      transform: feedbackPref === opt.id ? "scale(1.04)" : "scale(1)",
                    }}
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <span className="text-sm font-semibold text-white">{opt.label}</span>
                    <span className="text-[10px] text-white/60 text-center">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </ConvoCard>
          )}

          {CONVO_STEPS[convoStep] === "learning_diffs" && (
            <ConvoCard
              title="Anything I should know about how you learn?"
              hint="100% optional — most students skip this and that's totally fine."
            >
              {/* "Nothing to share" tile — sits at the front of the grid
                  so the "skip" path is visually equivalent to the other
                  pills, not hidden in a footnote. 13 May 2026 — Matt
                  smoke: a student felt they had to pick something even
                  though they had nothing to share. The faint
                  bottom-left link wasn't carrying enough signal. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => advanceConvo()}
                  className={`px-4 py-3 rounded-xl text-sm font-semibold transition-all border-2 col-span-2 ${
                    learningDiffs.length === 0
                      ? "bg-white/10 border-white/30 text-white hover:bg-white/15"
                      : "bg-transparent border-white/10 text-white/40 hover:text-white/60 hover:border-white/20"
                  }`}
                >
                  ✓ Nothing to share — skip this
                </button>
                {LEARNING_DIFFERENCES.map((diff) => (
                  <PillButton
                    key={diff.id}
                    label={diff.label}
                    selected={learningDiffs.includes(diff.id)}
                    accent={mentor.accent}
                    onClick={() => {
                      setLearningDiffs((prev) =>
                        prev.includes(diff.id) ? prev.filter((d) => d !== diff.id) : [...prev, diff.id]
                      );
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end mt-4">
                <button
                  onClick={() => {
                    if (learningDiffs.length > 0 && mentor) {
                      showMentorReaction(mentor.reactions.learningDiffs(learningDiffs));
                      setTimeout(advanceConvo, 2000);
                    } else {
                      advanceConvo();
                    }
                  }}
                  disabled={learningDiffs.length === 0}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all ${
                    learningDiffs.length === 0 ? "opacity-30 cursor-not-allowed" : ""
                  }`}
                  style={{ background: mentor.accent }}
                >
                  Done
                </button>
              </div>
            </ConvoCard>
          )}
        </div>
      )}

      {/* ============ Screen 4: Welcome Reveal ============ */}
      {screen === "welcome" && mentor && (
        <div className="w-full max-w-md mx-auto px-4 py-16 text-center animate-fadeIn">
          {/* Mentor avatar large */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 overflow-hidden"
            style={{
              background: `${mentor.accent}20`,
              border: `3px solid ${mentor.accent}40`,
              boxShadow: `0 8px 32px ${mentor.accent}20`,
            }}
          >
            {mentor.image ? (
              <img src={mentor.image} alt={mentor.name} className="w-full h-full object-cover" />
            ) : (
              mentor.emoji
            )}
          </div>

          {/* Welcome message */}
          <h1
            className="text-2xl md:text-3xl font-bold mb-3"
            style={{ color: theme?.preview.text === "#1A1A2E" ? "white" : (theme?.preview.text || "white") }}
          >
            {mentor.reactions.welcome}
          </h1>

          {/* Summary chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${mentor.accent}20`, color: mentor.accent }}
            >
              {mentor.name} — {mentor.tagline}
            </span>
          </div>

          {/* Enter button */}
          <button
            onClick={handleComplete}
            disabled={saving}
            className="px-10 py-3.5 rounded-xl font-bold text-base flex items-center gap-2 mx-auto transition-all duration-300 disabled:opacity-50"
            style={{
              background: mentor.gradient,
              color: "white",
              boxShadow: `0 8px 32px ${mentor.accent}30`,
            }}
          >
            {saving ? "Setting up..." : "Enter My Studio"} {!saving && <ArrowRight />}
          </button>
        </div>
      )}

      {/* Fade-in animation */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function ConvoCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-5 animate-fadeIn" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
      <h2 className="text-lg font-bold text-white mb-1">{title}</h2>
      <p className="text-xs text-white/50 mb-4">{hint}</p>
      {children}
    </div>
  );
}

function PillButton({
  label,
  selected,
  accent,
  onClick,
}: {
  label: string;
  selected: boolean;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
      style={{
        background: selected ? `${accent}25` : "rgba(255,255,255,0.08)",
        border: selected ? `1.5px solid ${accent}` : "1.5px solid rgba(255,255,255,0.15)",
        color: selected ? "white" : "rgba(255,255,255,0.75)",
      }}
    >
      {label}
    </button>
  );
}
