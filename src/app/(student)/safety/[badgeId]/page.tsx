"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "../../student-context";
import { ModuleRenderer } from "@/components/safety/blocks";
import type { ContentBlock } from "@/lib/safety/content-blocks";
import { getBlocksFromBadge } from "@/lib/safety/content-blocks";
import { BUILT_IN_BADGES } from "@/lib/safety/badge-definitions";
import { BadgeIcon } from "@/components/safety/BadgeIcon";
import {
  GENERAL_WORKSHOP_MODULE,
  HAND_TOOL_MODULE,
  FIRE_SAFETY_MODULE,
  PPE_MODULE,
  WOOD_WORKSHOP_MODULE,
  METAL_WORKSHOP_MODULE,
  PLASTICS_MODULE,
  ELECTRONICS_MODULE,
  LASER_CUTTER_MODULE,
  THREE_D_PRINTER_MODULE,
  BAND_SAW_MODULE,
} from "@/lib/safety/modules";
import type { LearningModule } from "@/lib/safety/content-blocks";

interface LearnCard {
  title: string;
  content: string;
  icon: string;
}

interface BadgeQuestion {
  id: string;
  type: "multiple_choice" | "true_false" | "scenario" | "sequence" | "match";
  topic: string;
  prompt: string;
  options?: string[];
  match_pairs?: Array<{ left: string; right: string }>;
  correct_answer: string | string[] | number[];
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  pass_threshold: number;
  question_count: number;
  expiry_months: number;
}

type Screen = "intro" | "quiz" | "results";

interface Answer {
  question_id: string;
  selected: string | string[] | number[];
  time_ms: number;
}

export default function SafetyBadgeTestPage({
  params,
}: {
  params: Promise<{ badgeId: string }>;
}) {
  const router = useRouter();
  const { student } = useStudent();
  const { badgeId } = use(params);

  // Badge data
  const [badge, setBadge] = useState<Badge | null>(null);
  const [learnCards, setLearnCards] = useState<LearnCard[]>([]);
  const [learningBlocks, setLearningBlocks] = useState<ContentBlock[]>([]);
  const [questions, setQuestions] = useState<BadgeQuestion[]>([]);
  const [loadingBadge, setLoadingBadge] = useState(true);

  // Screen state
  const [screen, setScreen] = useState<Screen>("intro");
  const [cardsViewed, setCardsViewed] = useState<Set<number>>(new Set());
  const [moduleCompleted, setModuleCompleted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<
    string | string[] | number[] | null
  >(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(
    Date.now()
  );

  // Results
  const [results, setResults] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quiz enhancements
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [streak, setStreak] = useState(0);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewQuestions, setReviewQuestions] = useState<number[]>([]);

  // Map badge slugs to rich learning modules
  const MODULE_MAP: Record<string, LearningModule> = {
    'general-workshop-safety': GENERAL_WORKSHOP_MODULE,
    'hand-tool-safety': HAND_TOOL_MODULE,
    'fire-safety-emergency': FIRE_SAFETY_MODULE,
    'ppe-fundamentals': PPE_MODULE,
    'wood-workshop-safety': WOOD_WORKSHOP_MODULE,
    'metal-workshop-safety': METAL_WORKSHOP_MODULE,
    'plastics-composites-safety': PLASTICS_MODULE,
    'electronics-soldering-safety': ELECTRONICS_MODULE,
    'laser-cutter-safety': LASER_CUTTER_MODULE,
    '3d-printer-safety': THREE_D_PRINTER_MODULE,
    'band-saw': BAND_SAW_MODULE,
  };

  // Load badge data — try API first, fall back to BUILT_IN_BADGES
  useEffect(() => {
    async function loadBadge() {
      if (!student) return;

      // Always look up built-in badge for content
      const builtIn = BUILT_IN_BADGES.find(b => b.id === badgeId || b.slug === badgeId);

      try {
        const res = await fetch(`/api/student/safety/badges/${badgeId}`);
        if (res.ok) {
          const data = await res.json();
          setBadge(data.badge);

          // Check if already earned or on cooldown
          if (data.studentStatus === "earned" || data.studentStatus === "cooldown") {
            setScreen("results");
            setResults({
              alreadyEarned: data.studentStatus === "earned",
              earnedAt: data.earnedAt,
              expiresAt: data.expiresAt,
            });
          }
        }
      } catch (err) {
        console.error("Error loading badge from API:", err);
      }

      // Use built-in badge for content (learn cards, questions, badge metadata)
      if (builtIn) {
        if (!badge) {
          setBadge({
            id: builtIn.id,
            name: builtIn.name,
            description: builtIn.description,
            icon_name: builtIn.icon_name,
            pass_threshold: builtIn.pass_threshold,
            question_count: builtIn.question_count,
            expiry_months: builtIn.expiry_months,
          });
        }
        setLearnCards(builtIn.learn_content || []);
        const blocks = getBlocksFromBadge({ learn_content: builtIn.learn_content });
        setLearningBlocks(blocks);
        setQuestions(builtIn.question_pool || []);
      } else if (!badge) {
        // Not in DB and not built-in — redirect
        router.push("/safety");
        return;
      }

      setLoadingBadge(false);
    }
    loadBadge();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student, badgeId]);

  // Track card views
  const toggleCardView = useCallback((index: number) => {
    setCardsViewed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const canStartQuiz = useMemo(
    () => {
      // If using ModuleRenderer, require module completion
      if (learningBlocks.length > 0) {
        return moduleCompleted;
      }
      // Backward compat: if using old learn cards, require 60% viewed
      return cardsViewed.size >= Math.ceil(learnCards.length * 0.6);
    },
    [moduleCompleted, learningBlocks.length, cardsViewed.size, learnCards.length]
  );

  // Start quiz
  const handleStartQuiz = () => {
    if (!canStartQuiz) return;
    setScreen("quiz");
    setQuestionStartTime(Date.now());
    setCurrentAnswer(null);
  };

  // Check if answer is correct
  const isAnswerCorrect = useCallback((): boolean => {
    const question = questions[currentQuestion];
    if (!question) return false;

    const correct = question.correct_answer;

    // Handle multiple choice, scenario, match
    if (typeof correct === "string") {
      return currentAnswer === correct;
    }

    // Handle true/false
    if (correct === "true" || correct === "false") {
      return currentAnswer === correct;
    }

    // Handle arrays (sequence — order matters)
    if (Array.isArray(correct)) {
      if (!Array.isArray(currentAnswer)) return false;
      if (currentAnswer.length !== correct.length) return false;
      return currentAnswer.every((val, i) => String(val) === String(correct[i]));
    }

    return false;
  }, [currentQuestion, currentAnswer, questions]);

  // Navigate quiz — show feedback first
  const handleAnswerSelection = async () => {
    if (currentAnswer === null || (Array.isArray(currentAnswer) && currentAnswer.length === 0)) {
      return; // Answer not selected
    }

    // Check correctness
    const isCorrect = isAnswerCorrect();
    setFeedbackCorrect(isCorrect);
    setShowFeedback(true);

    // Update streak
    if (isCorrect) {
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }
  };

  // Continue after feedback
  const handleContinueAfterFeedback = async () => {
    const time_ms = Date.now() - questionStartTime;
    const newAnswer: Answer = {
      question_id: questions[currentQuestion].id,
      selected: currentAnswer,
      time_ms,
    };
    const updatedAnswers = [...answers, newAnswer];
    setAnswers(updatedAnswers);

    // Reset feedback
    setShowFeedback(false);
    setFeedbackCorrect(false);

    // Move to next question or submit
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentAnswer(null);
      setQuestionStartTime(Date.now());
    } else {
      // Submit quiz
      await submitQuiz(updatedAnswers);
    }
  };

  // Submit quiz
  const submitQuiz = async (finalAnswers: Answer[]) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/student/safety/badges/${badgeId}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: finalAnswers,
            time_taken_seconds: Math.round(
              (Date.now() - questionStartTime) / 1000
            ),
          }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setScreen("results");
      } else {
        alert("Failed to submit quiz");
      }
    } catch (err) {
      console.error("Error submitting quiz:", err);
      alert("Error submitting quiz");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle sequence reorder (up/down buttons)
  const moveSequenceItem = (direction: "up" | "down") => {
    if (!Array.isArray(currentAnswer)) return;

    const newAnswer = [...currentAnswer];
    const indices = newAnswer.map(Number);

    if (direction === "up" && indices[0] > 0) {
      const temp = indices[0];
      const tempIdx = indices.findIndex((i) => i === temp);
      indices[tempIdx]--;
    } else if (direction === "down" && indices[indices.length - 1] < 99) {
      const temp = indices[indices.length - 1];
      const tempIdx = indices.findIndex((i) => i === temp);
      indices[tempIdx]++;
    }

    setCurrentAnswer(indices);
  };

  // Loading state
  if (loadingBadge) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading badge...</div>
      </div>
    );
  }

  if (!badge || !questions) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Badge not found</div>
      </div>
    );
  }

  // === INTRO SCREEN ===
  if (screen === "intro") {
    // Resolve learning module
    const builtIn = BUILT_IN_BADGES.find(b => b.id === badgeId || b.slug === badgeId);
    const richModule = builtIn ? MODULE_MAP[builtIn.slug] : undefined;
    const badgeColor = builtIn?.color || "#4F46E5";
    let sectionNum = 0;

    return (
      <div className="min-h-screen bg-white">
        {/* ── Sticky top nav bar (matches lesson page exactly) ── */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 truncate max-w-[50%]">
                {badge.name}
              </span>
            </div>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Dashboard
            </button>
          </div>
        </div>

        {/* ── Hero header — dark-to-color gradient (matches lesson page) ── */}
        <div className="w-full" style={{ background: `linear-gradient(135deg, #1A1A2E 0%, ${badgeColor} 100%)` }}>
          <div className="max-w-4xl mx-auto px-6 pt-6 pb-10">
            <p className="text-sm text-white/70 font-medium mb-3 uppercase tracking-wider">
              Safety Certification
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight">
              {badge.name}
            </h1>
            <div className="flex items-center gap-2 mt-5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white">
                <span className="w-2 h-2 rounded-full bg-white/60" />
                {badge.question_count} Questions
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white">
                <span className="w-2 h-2 rounded-full bg-white/60" />
                {badge.pass_threshold}% to Pass
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-white/20 text-white">
                <span className="w-2 h-2 rounded-full bg-white/60" />
                ~{richModule ? richModule.estimated_minutes : Math.max(5, Math.round(badge.question_count * 2))} min
              </span>
            </div>
          </div>
        </div>

        {/* ── Main content — white background, same width as lesson page ── */}
        <main className="max-w-4xl mx-auto px-6 py-10 pb-28">

          {/* Description block */}
          <p className="text-lg text-gray-700 leading-relaxed mb-2">
            {badge.description}
          </p>

          {/* Learning objectives (if rich module) */}
          {richModule && richModule.learning_objectives.length > 0 && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-4 my-8">
                <div className="flex-1 h-px bg-gray-200" />
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
                  style={{ backgroundColor: badgeColor }}
                >
                  {++sectionNum}
                </div>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <div
                className="rounded-2xl p-6 md:p-8 mb-2"
                style={{ backgroundColor: badgeColor + "12" }}
              >
                <h2 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: badgeColor }}>
                  Learning Objectives
                </h2>
                <ol className="space-y-3">
                  {richModule.learning_objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5"
                        style={{ backgroundColor: badgeColor }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-gray-700 leading-relaxed">{obj}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          {/* Divider before learning content */}
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-gray-200" />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm"
              style={{ backgroundColor: badgeColor }}
            >
              {++sectionNum}
            </div>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Learn section — Rich module, ModuleRenderer blocks, or fallback to old cards */}
          {(() => {
            if (richModule) {
              return (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Interactive Learning
                  </h2>
                  <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    {richModule.learning_objectives.length} learning objectives — complete all sections to unlock the test.
                  </p>
                  <ModuleRenderer
                    module={richModule}
                    onModuleComplete={() => setModuleCompleted(true)}
                    showProgress={true}
                  />
                </div>
              );
            }

            if (learningBlocks.length > 0) {
              return (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Learn First
                  </h2>
                  <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    Complete all learning modules before taking the test.
                  </p>
                  <ModuleRenderer
                    blocks={learningBlocks}
                    onModuleComplete={() => setModuleCompleted(true)}
                    showProgress={true}
                  />
                </div>
              );
            }

            // Fallback to flat learn cards
            if (learnCards.length > 0) {
              return (
                <div className="mb-8">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">
                    Learn First{" "}
                    <span className="text-sm font-normal text-gray-400">
                      ({cardsViewed.size}/{learnCards.length} read)
                    </span>
                  </h2>
                  <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                    Review at least 60% of the learning materials before taking the test.
                  </p>
                  <div className="space-y-3">
                    {learnCards.map((card, idx) => (
                      <button
                        key={idx}
                        onClick={() => toggleCardView(idx)}
                        className={`w-full text-left rounded-lg border-2 p-4 transition ${
                          cardsViewed.has(idx)
                            ? "border-opacity-40 bg-opacity-10"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        style={cardsViewed.has(idx) ? { borderColor: badgeColor, backgroundColor: badgeColor + "10" } : undefined}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">
                              {card.icon}
                            </span>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {card.title}
                              </h3>
                              {cardsViewed.has(idx) && (
                                <p className="text-gray-600 text-sm mt-2 leading-relaxed">
                                  {card.content}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className="text-gray-400 flex-shrink-0">
                            {cardsViewed.has(idx) ? "▼" : "▶"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })()}

          {/* Start Test button */}
          <button
            onClick={handleStartQuiz}
            disabled={!canStartQuiz}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-base transition shadow-sm ${
              canStartQuiz
                ? "text-white hover:opacity-90"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            style={canStartQuiz ? { backgroundColor: badgeColor } : undefined}
          >
            {canStartQuiz ? "Start Test →" : "Complete Learning First"}
          </button>
        </main>
      </div>
    );
  }

  // === QUIZ SCREEN ===
  if (screen === "quiz") {
    const question = questions[currentQuestion];
    if (!question) return null;
    const quizBadgeColor = BUILT_IN_BADGES.find(b => b.id === badgeId || b.slug === badgeId)?.color || "#4F46E5";

    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <div className="min-h-screen bg-white">
        {/* Progress bar */}
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-900">
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{ color: quizBadgeColor, backgroundColor: quizBadgeColor + "15" }}
              >
                {Math.round(progress)}% complete
              </span>
            </div>
            {/* Step dots */}
            <div className="flex items-center gap-1 mb-2">
              {questions.map((_, idx) => (
                <div
                  key={idx}
                  className="flex-1 h-2 rounded-full transition-all duration-300"
                  style={{
                    background: idx < currentQuestion
                      ? quizBadgeColor
                      : idx === currentQuestion
                      ? quizBadgeColor + "80"
                      : "#E2E8F0",
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Question content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Question meta */}
          <div className="flex items-center gap-2 mb-6 justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-600">
                {question.topic}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                question.difficulty === "easy" ? "bg-green-100 text-green-700" :
                question.difficulty === "medium" ? "bg-yellow-100 text-yellow-700" :
                "bg-red-100 text-red-700"
              }`}>
                {question.difficulty === "easy" && "🟢 Easy"}
                {question.difficulty === "medium" && "🟡 Medium"}
                {question.difficulty === "hard" && "🔴 Hard"}
              </span>
            </div>
            {streak >= 2 && (
              <span className="text-sm font-semibold text-orange-500">
                🔥 {streak}
              </span>
            )}
          </div>

          {/* Question prompt */}
          <h2 className="text-xl font-semibold text-gray-900 mb-8">
            {question.prompt}
          </h2>

          {/* Question type rendering */}
          <div className="mb-8">
            {/* Multiple Choice */}
            {question.type === "multiple_choice" && question.options && (
              <div className="space-y-3">
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentAnswer(option)}
                    className={`w-full text-left rounded-lg border-2 p-4 transition ${
                      currentAnswer === option
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          currentAnswer === option
                            ? "border-purple-600 bg-purple-600"
                            : "border-gray-300"
                        }`}
                      >
                        {currentAnswer === option && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-gray-900">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* True/False */}
            {question.type === "true_false" && (
              <div className="grid grid-cols-2 gap-4">
                {["true", "false"].map((val) => (
                  <button
                    key={val}
                    onClick={() => setCurrentAnswer(val)}
                    className={`rounded-lg border-2 p-6 font-semibold text-lg transition ${
                      currentAnswer === val
                        ? "border-purple-600 bg-purple-50 text-purple-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-900"
                    }`}
                  >
                    {val === "true" ? "True ✓" : "False ✗"}
                  </button>
                ))}
              </div>
            )}

            {/* Scenario (same as multiple choice) */}
            {question.type === "scenario" && question.options && (
              <div className="space-y-3">
                {question.options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentAnswer(option)}
                    className={`w-full text-left rounded-lg border-2 p-4 transition ${
                      currentAnswer === option
                        ? "border-purple-600 bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          currentAnswer === option
                            ? "border-purple-600 bg-purple-600"
                            : "border-gray-300"
                        }`}
                      >
                        {currentAnswer === option && (
                          <div className="w-2 h-2 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-gray-900">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Sequence (order items) */}
            {question.type === "sequence" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-4">
                  Order these steps from first to last:
                </p>
                {question.options && (
                  <div className="space-y-2">
                    {question.options.map((option, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 ${
                          Array.isArray(currentAnswer) &&
                          currentAnswer.includes(idx)
                            ? "border-purple-600 bg-purple-50"
                            : "border-gray-200"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={
                            Array.isArray(currentAnswer) &&
                            currentAnswer.includes(idx)
                          }
                          onChange={(e) => {
                            const arr = Array.isArray(currentAnswer)
                              ? [...currentAnswer]
                              : [];
                            if (e.target.checked) {
                              if (!arr.includes(idx)) arr.push(idx);
                            } else {
                              const i = arr.indexOf(idx);
                              if (i > -1) arr.splice(i, 1);
                            }
                            setCurrentAnswer(arr.length > 0 ? arr : null);
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-gray-900">{option}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Match (left-right pairs) */}
            {question.type === "match" && question.match_pairs && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">
                    Left
                  </p>
                  <div className="space-y-2">
                    {question.match_pairs.map((pair, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gray-50 rounded-lg text-sm text-gray-900"
                      >
                        {pair.left}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-3">
                    Select Match
                  </p>
                  <div className="space-y-2">
                    {question.match_pairs.map((pair, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentAnswer(idx.toString())}
                        className={`w-full text-left p-3 rounded-lg border-2 text-sm transition ${
                          currentAnswer === idx.toString()
                            ? "border-purple-600 bg-purple-50 text-purple-700"
                            : "border-gray-200 hover:border-gray-300 text-gray-900"
                        }`}
                      >
                        {pair.right}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback Section */}
          {showFeedback && (
            <div className={`mb-8 p-6 rounded-lg border-2 ${
              feedbackCorrect
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl flex-shrink-0">
                  {feedbackCorrect ? "✓" : "✗"}
                </span>
                <div className="flex-1">
                  <h3 className={`font-semibold text-lg ${
                    feedbackCorrect ? "text-green-700" : "text-red-700"
                  }`}>
                    {feedbackCorrect ? "Correct!" : "Not quite right"}
                  </h3>
                  <p className={`text-sm mt-2 ${
                    feedbackCorrect ? "text-green-600" : "text-red-600"
                  }`}>
                    {question.explanation}
                  </p>
                </div>
              </div>

              {!feedbackCorrect && (
                <div className="mt-4 p-3 bg-white rounded border border-red-100">
                  <p className="text-xs font-medium text-gray-600 mb-2">
                    Correct answer:
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {Array.isArray(question.correct_answer)
                      ? (question.correct_answer as number[]).map(i => question.options?.[i]).filter(Boolean).join(" → ") ||
                        JSON.stringify(question.correct_answer)
                      : question.correct_answer === "true"
                        ? "True"
                        : question.correct_answer === "false"
                        ? "False"
                        : String(question.correct_answer)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {!showFeedback ? (
              <button
                onClick={handleAnswerSelection}
                disabled={
                  submitting || (currentAnswer === null || (Array.isArray(currentAnswer) && currentAnswer.length === 0))
                }
                className={`w-full py-3 px-4 rounded-lg font-semibold transition ${
                  currentAnswer !== null && !(Array.isArray(currentAnswer) && currentAnswer.length === 0) && !submitting
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                }`}
              >
                {submitting ? "Submitting..." : "Check Answer"}
              </button>
            ) : (
              <button
                onClick={handleContinueAfterFeedback}
                disabled={submitting}
                className="w-full py-3 px-4 rounded-lg font-semibold bg-purple-600 text-white hover:bg-purple-700 transition"
              >
                {currentQuestion === questions.length - 1
                  ? "See Results →"
                  : "Next Question →"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === RESULTS SCREEN ===
  if (screen === "results") {
    if (!results) return null;

    const { score, passed, total, correct, results: resultsList } = results;

    // Calculate mistakes for review mode
    const mistakeIndices = resultsList
      ?.map((result: any, idx: number) => (result.correct ? null : idx))
      .filter((idx: number | null) => idx !== null) || [];

    const displayResults = reviewMode
      ? resultsList?.filter((_: any, idx: number) => mistakeIndices.includes(idx))
      : resultsList;

    const confettiPieces = passed
      ? Array.from({ length: 50 }, (_, i) => ({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.3,
          duration: 2 + Math.random() * 1,
        }))
      : [];

    return (
      <div className="min-h-screen bg-gray-50 relative overflow-hidden">
        {/* Confetti */}
        {confettiPieces.length > 0 && (
          <div className="fixed inset-0 pointer-events-none">
            {confettiPieces.map((piece) => (
              <div
                key={piece.id}
                className="absolute w-2 h-2 bg-purple-600 rounded-full animate-pulse"
                style={{
                  left: `${piece.left}%`,
                  top: "-10px",
                  animation: `fall ${piece.duration}s linear ${piece.delay}s forwards`,
                }}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="max-w-4xl mx-auto px-6 py-12">
          {/* Score display */}
          <div className="text-center mb-8">
            <div className="mb-6">
              {passed ? (
                <>
                  <div className="text-6xl font-bold text-green-600 mb-2">
                    🎉
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    You Passed!
                  </h1>
                </>
              ) : (
                <>
                  <div className="text-6xl font-bold text-amber-600 mb-2">
                    📊
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900">
                    Not Quite There
                  </h1>
                </>
              )}
            </div>

            {/* Big score circle */}
            <div className="inline-flex items-center justify-center w-32 h-32 rounded-full border-4 border-purple-600 bg-purple-50 mb-6">
              <div className="text-center">
                <div className="text-5xl font-bold text-purple-600">
                  {score}%
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {correct}/{total}
                </div>
              </div>
            </div>

            {/* Pass threshold info */}
            <p className="text-gray-600 mb-4">
              You needed {badge.pass_threshold}% to pass
            </p>

            {/* Badge award info */}
            {passed && results.badge_awarded && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="font-semibold text-green-700 mb-1">
                  ✓ Badge Awarded!
                </p>
                <p className="text-sm text-green-600">
                  {results.badge_expires_at
                    ? `This badge expires on ${new Date(results.badge_expires_at).toLocaleDateString()}`
                    : "This badge does not expire"}
                </p>
              </div>
            )}

            {results.alreadyEarned && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-700">
                  ℹ️ You have already earned this badge
                </p>
              </div>
            )}
          </div>

          {/* Results breakdown */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {reviewMode ? "Your Mistakes" : "Question Breakdown"}
              </h2>
              {!passed && mistakeIndices.length > 0 && !reviewMode && (
                <button
                  onClick={() => setReviewMode(true)}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 underline"
                >
                  Review Mistakes ({mistakeIndices.length})
                </button>
              )}
              {reviewMode && (
                <button
                  onClick={() => setReviewMode(false)}
                  className="text-sm font-medium text-purple-600 hover:text-purple-700 underline"
                >
                  View All
                </button>
              )}
            </div>
            <div className="space-y-3">
              {displayResults?.map((result: any, idx: number) => {
                const actualIdx = reviewMode
                  ? resultsList.findIndex((r: any) => r === result)
                  : idx;
                return (
                  <div
                    key={actualIdx}
                    className={`rounded-lg border-2 p-4 ${
                      result.correct
                        ? "border-green-200 bg-green-50"
                        : "border-red-200 bg-red-50"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl flex-shrink-0">
                        {result.correct ? "✓" : "✗"}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          Question {actualIdx + 1}: {result.prompt.substring(0, 80)}
                          {result.prompt.length > 80 ? "..." : ""}
                        </p>
                        <p
                          className={`text-sm mt-2 ${
                            result.correct
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {result.explanation}
                        </p>
                        {!result.correct && result.correct_answer && (
                          <div className="mt-3 p-2 bg-white rounded text-sm border border-red-100">
                            <p className="text-xs font-medium text-gray-600 mb-1">
                              Correct answer:
                            </p>
                            <p className="font-semibold text-gray-900">
                              {result.correct_answer}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex-1 py-3 px-4 rounded-lg font-semibold text-gray-900 border-2 border-gray-200 hover:border-gray-300 transition"
            >
              ← Back to Dashboard
            </button>
            {!passed && (
              <button
                onClick={() => router.push(`/safety/${badgeId}`)}
                className="flex-1 py-3 px-4 rounded-lg font-semibold bg-purple-600 text-white hover:bg-purple-700 transition"
              >
                Retake Test →
              </button>
            )}
          </div>
        </div>

        {/* Confetti animation styles */}
        <style>{`
          @keyframes fall {
            to {
              transform: translateY(100vh) rotate(360deg);
              opacity: 0;
            }
          }
        `}</style>
      </div>
    );
  }
}
