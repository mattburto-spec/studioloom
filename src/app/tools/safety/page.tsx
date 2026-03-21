"use client";

import { useState, useEffect } from "react";
import {
  BUILT_IN_BADGES,
  drawQuestions,
  gradeTest,
  findBadgeBySlug,
} from "@/lib/safety/badge-definitions";
import type { BadgeQuestion } from "@/lib/safety/types";

// ═════════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════════

type Screen = "landing" | "learn" | "quiz" | "results";

interface QuizState {
  selectedBadge: string;
  questions: BadgeQuestion[];
  currentQuestionIndex: number;
  answers: Record<string, string | string[] | number[]>;
  currentAnswer: string | string[] | number[] | null;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  startTime: Date | null;
  timeElapsed: number; // seconds
  teacherMode: boolean;
  teacherEmail: string;
  teacherClassCode: string;
  studentName: string;
  sessionClassCode: string;
}

interface GradeResult {
  questionId: string;
  correct: boolean;
  explanation: string;
}

// ═════════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════════

export default function SafetyBadgePage() {
  // Main screen state
  const [screen, setScreen] = useState<Screen>("landing");

  // Quiz state
  const [quiz, setQuiz] = useState<QuizState>({
    selectedBadge: "",
    questions: [],
    currentQuestionIndex: 0,
    answers: {},
    currentAnswer: null,
    showFeedback: false,
    feedbackCorrect: false,
    startTime: null,
    timeElapsed: 0,
    teacherMode: false,
    teacherEmail: "",
    teacherClassCode: "",
    studentName: "",
    sessionClassCode: "",
  });

  // Results state
  const [results, setResults] = useState<{
    score: number;
    gradeResults: GradeResult[];
    passed: boolean;
    timeTaken: number;
  } | null>(null);

  // Timer effect
  useEffect(() => {
    if (screen !== "quiz" || !quiz.startTime) return;

    const timer = setInterval(() => {
      setQuiz((prev) => ({
        ...prev,
        timeElapsed: Math.floor((Date.now() - prev.startTime!.getTime()) / 1000),
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [screen, quiz.startTime]);

  // ═════════════════════════════════════════════════════════════════════════════════
  // HANDLERS - LANDING SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function handleTeacherSetup(email: string, className: string) {
    const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem(
      "teacherSession",
      JSON.stringify({ email, className, classCode })
    );
    // Stay on landing to show both sides
    setQuiz((prev) => ({
      ...prev,
      teacherMode: true,
      teacherEmail: email,
      teacherClassCode: classCode,
    }));
  }

  function handleStudentJoin(classCode: string, studentName: string) {
    setQuiz((prev) => ({
      ...prev,
      sessionClassCode: classCode,
      studentName: studentName,
    }));
  }

  function handleBadgeSelect(badgeSlug: string) {
    const badge = findBadgeBySlug(badgeSlug);
    if (!badge) return;

    const questions = drawQuestions(badgeSlug, badge.question_count);
    setQuiz((prev) => ({
      ...prev,
      selectedBadge: badgeSlug,
      questions: questions as BadgeQuestion[],
      currentQuestionIndex: 0,
      answers: {},
      currentAnswer: null,
      showFeedback: false,
      startTime: null,
    }));
    setScreen("learn");
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // HANDLERS - QUIZ SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function handleStartQuiz() {
    setQuiz((prev) => ({
      ...prev,
      startTime: new Date(),
      timeElapsed: 0,
    }));
    setScreen("quiz");
  }

  function handleAnswerChange(value: string | string[] | number[]) {
    setQuiz((prev) => ({
      ...prev,
      currentAnswer: value,
    }));
  }

  function handleSubmitAnswer() {
    if (quiz.currentAnswer === null) return;

    const questionId = quiz.questions[quiz.currentQuestionIndex].id;
    setQuiz((prev) => ({
      ...prev,
      answers: {
        ...prev.answers,
        [questionId]: quiz.currentAnswer!,
      },
    }));

    // Check if answer is correct
    const badge = findBadgeBySlug(quiz.selectedBadge);
    if (!badge) return;

    const question = badge.question_pool.find((q) => q.id === questionId);
    if (!question) return;

    let isCorrect = false;
    if (typeof question.correct_answer === "string") {
      isCorrect = quiz.currentAnswer === question.correct_answer;
    } else if (Array.isArray(question.correct_answer)) {
      const selected = Array.isArray(quiz.currentAnswer)
        ? quiz.currentAnswer
        : [quiz.currentAnswer];
      isCorrect =
        JSON.stringify(selected.sort()) ===
        JSON.stringify([...question.correct_answer].sort());
    }

    setQuiz((prev) => ({
      ...prev,
      showFeedback: true,
      feedbackCorrect: isCorrect,
    }));
  }

  function handleNextQuestion() {
    const isLastQuestion =
      quiz.currentQuestionIndex === quiz.questions.length - 1;

    if (isLastQuestion) {
      // Submit and grade
      const badge = findBadgeBySlug(quiz.selectedBadge);
      if (!badge) return;

      const answersArray = quiz.questions.map((q) => ({
        questionId: q.id,
        selected: quiz.answers[q.id],
      }));

      const { score, results: gradeResults } = gradeTest(
        quiz.selectedBadge,
        answersArray
      );

      const passed = score >= badge.pass_threshold;

      setResults({
        score,
        gradeResults,
        passed,
        timeTaken: quiz.timeElapsed,
      });
      setScreen("results");
    } else {
      // Move to next question
      setQuiz((prev) => ({
        ...prev,
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        currentAnswer: null,
        showFeedback: false,
      }));
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // HANDLERS - RESULTS SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function handleBackToBadges() {
    setQuiz({
      selectedBadge: "",
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      currentAnswer: null,
      showFeedback: false,
      feedbackCorrect: false,
      startTime: null,
      timeElapsed: 0,
      teacherMode: quiz.teacherMode,
      teacherEmail: quiz.teacherEmail,
      teacherClassCode: quiz.teacherClassCode,
      studentName: quiz.studentName,
      sessionClassCode: quiz.sessionClassCode,
    });
    setScreen("landing");
    setResults(null);
  }

  function handleRetakeQuiz() {
    const badge = findBadgeBySlug(quiz.selectedBadge);
    if (!badge) return;

    const questions = drawQuestions(quiz.selectedBadge, badge.question_count);
    setQuiz((prev) => ({
      ...prev,
      questions: questions as BadgeQuestion[],
      currentQuestionIndex: 0,
      answers: {},
      currentAnswer: null,
      showFeedback: false,
      startTime: new Date(),
      timeElapsed: 0,
    }));
    setResults(null);
    setScreen("quiz");
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER - LANDING SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function renderLanding() {
    return (
      <div className="space-y-12">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-emerald-50 to-blue-50 px-6 py-16 rounded-xl border border-gray-200">
          <div className="max-w-3xl mx-auto text-center space-y-4">
            <div className="flex justify-center">
              <ShieldIcon color="#059669" size={64} />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              Workshop Safety Badges
            </h1>
            <p className="text-lg text-gray-600">
              Master your workshop safety with interactive digital certification.
              Pass a test and earn a badge to unlock equipment access.
            </p>
          </div>
        </section>

        {/* Two Column Setup */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Teachers Section */}
          <TeacherSetup onSetup={handleTeacherSetup} />

          {/* Students Section */}
          <StudentJoin onJoin={handleStudentJoin} />
        </div>

        {/* Badge Grid */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 mb-6">
            <ShieldIcon color="#7B2FF2" size={24} />
            <h2 className="text-2xl font-bold text-gray-900">
              Available Badges
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUILT_IN_BADGES.map((badge) => (
              <BadgeCard
                key={badge.slug}
                badge={badge}
                onSelect={handleBadgeSelect}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER - LEARN SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function renderLearn() {
    const badge = findBadgeBySlug(quiz.selectedBadge);
    if (!badge) return null;

    return (
      <div className="space-y-8">
        {/* Back Link */}
        <button
          onClick={() => {
            setScreen("landing");
            setQuiz((prev) => ({ ...prev, selectedBadge: "" }));
          }}
          className="text-sm font-medium text-[#7B2FF2] hover:underline"
        >
          ← Back to Badges
        </button>

        {/* Badge Header */}
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: badge.color + "20", borderColor: badge.color, borderWidth: "2px" }}
            >
              <ShieldIcon color={badge.color} size={32} />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">
                {badge.name}
              </h1>
              <p className="text-gray-600 mt-1">{badge.description}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold text-white`}
                  style={{ backgroundColor: badge.color }}
                >
                  Tier {badge.tier}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-gray-700 bg-gray-100">
                  {badge.question_count} Questions
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold text-gray-700 bg-gray-100">
                  {badge.pass_threshold}% Pass
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Learn Content */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Learn the Essentials
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {badge.learn_content.map((card, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg p-6 border border-gray-200 hover:border-gray-300 transition"
              >
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {card.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {card.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex gap-3">
          <button
            onClick={handleStartQuiz}
            className="flex-1 bg-[#7B2FF2] text-white font-semibold py-3 rounded-lg hover:bg-[#6a1fe6] transition"
          >
            Take Test
          </button>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER - QUIZ SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function renderQuiz() {
    const badge = findBadgeBySlug(quiz.selectedBadge);
    if (!badge || quiz.questions.length === 0) return null;

    const currentQuestion = quiz.questions[quiz.currentQuestionIndex];
    const progress =
      ((quiz.currentQuestionIndex + 1) / quiz.questions.length) * 100;
    const minutes = Math.floor(quiz.timeElapsed / 60);
    const seconds = quiz.timeElapsed % 60;
    const isAnswered = quiz.answers[currentQuestion.id] !== undefined;

    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500 font-medium">
                Question {quiz.currentQuestionIndex + 1} of{" "}
                {quiz.questions.length}
              </p>
              <h2 className="text-xl font-bold text-gray-900 mt-1">
                {badge.name}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[#7B2FF2]">
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </p>
              <p className="text-xs text-gray-500">Time Elapsed</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-[#7B2FF2] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            {currentQuestion.prompt}
          </h3>

          {/* Question Options */}
          <div className="space-y-3 mb-6">
            {currentQuestion.type === "true_false" && (
              <TrueFalseQuestion
                question={currentQuestion}
                selected={quiz.currentAnswer}
                onChange={handleAnswerChange}
                disabled={quiz.showFeedback}
              />
            )}

            {currentQuestion.type === "multiple_choice" && (
              <MultipleChoiceQuestion
                question={currentQuestion}
                selected={quiz.currentAnswer}
                onChange={handleAnswerChange}
                disabled={quiz.showFeedback}
              />
            )}

            {currentQuestion.type === "scenario" && (
              <MultipleChoiceQuestion
                question={currentQuestion}
                selected={quiz.currentAnswer}
                onChange={handleAnswerChange}
                disabled={quiz.showFeedback}
              />
            )}

            {currentQuestion.type === "sequence" && (
              <SequenceQuestion
                question={currentQuestion}
                selected={quiz.currentAnswer}
                onChange={handleAnswerChange}
                disabled={quiz.showFeedback}
              />
            )}

            {currentQuestion.type === "match" && (
              <MatchQuestion
                question={currentQuestion}
                selected={quiz.currentAnswer}
                onChange={handleAnswerChange}
                disabled={quiz.showFeedback}
              />
            )}
          </div>

          {/* Feedback */}
          {quiz.showFeedback && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                quiz.feedbackCorrect
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <div className="flex gap-3">
                {quiz.feedbackCorrect ? (
                  <span className="text-2xl">✓</span>
                ) : (
                  <span className="text-2xl">✗</span>
                )}
                <div className="flex-1">
                  <p
                    className={`font-semibold mb-1 ${
                      quiz.feedbackCorrect
                        ? "text-green-900"
                        : "text-red-900"
                    }`}
                  >
                    {quiz.feedbackCorrect ? "Correct!" : "Incorrect"}
                  </p>
                  <div
                    className={`text-sm ${
                      quiz.feedbackCorrect
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {/* Find the full question and show explanation */}
                    {(() => {
                      const fullQuestion = badge.question_pool.find(
                        (q) => q.id === currentQuestion.id
                      );
                      return fullQuestion?.explanation || "";
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Next Button */}
          {!quiz.showFeedback ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={quiz.currentAnswer === null}
              className="w-full bg-[#7B2FF2] text-white font-semibold py-3 rounded-lg hover:bg-[#6a1fe6] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="w-full bg-[#7B2FF2] text-white font-semibold py-3 rounded-lg hover:bg-[#6a1fe6] transition"
            >
              {quiz.currentQuestionIndex === quiz.questions.length - 1
                ? "Finish Test"
                : "Next Question"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // RENDER - RESULTS SCREEN
  // ═════════════════════════════════════════════════════════════════════════════════

  function renderResults() {
    const badge = findBadgeBySlug(quiz.selectedBadge);
    if (!badge || !results) return null;

    const minutes = Math.floor(results.timeTaken / 60);
    const seconds = results.timeTaken % 60;

    return (
      <div className="space-y-8">
        {/* Score Card */}
        <div
          className={`rounded-lg p-8 text-center space-y-4 ${
            results.passed
              ? "bg-green-50 border-2 border-green-200"
              : "bg-amber-50 border-2 border-amber-200"
          }`}
        >
          <div className="flex justify-center mb-4">
            {results.passed ? (
              <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <ShieldIcon color="#059669" size={48} />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full bg-amber-100 flex items-center justify-center">
                <div className="text-4xl">🎯</div>
              </div>
            )}
          </div>

          <h1
            className={`text-4xl font-bold ${
              results.passed ? "text-green-900" : "text-amber-900"
            }`}
          >
            {results.score}%
          </h1>

          <p
            className={`text-lg font-semibold ${
              results.passed ? "text-green-800" : "text-amber-800"
            }`}
          >
            {results.passed ? "Badge Earned!" : "Keep Practicing"}
          </p>

          <p className="text-sm text-gray-600">
            Pass threshold: {badge.pass_threshold}%
          </p>

          <p className="text-sm text-gray-600">
            Time taken: {String(minutes).padStart(2, "0")}:
            {String(seconds).padStart(2, "0")}
          </p>

          {!results.passed && (
            <p className="text-sm text-gray-600">
              You can retake this test in {badge.retake_cooldown_minutes} minutes.
            </p>
          )}
        </div>

        {/* Question Breakdown */}
        <div className="bg-white rounded-lg p-8 border border-gray-200">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Question Breakdown
          </h2>
          <div className="space-y-3">
            {results.gradeResults.map((result, idx) => {
              const question = quiz.questions.find(
                (q) => q.id === result.questionId
              );
              return (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border ${
                    result.correct
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {result.correct ? (
                      <span className="text-2xl text-green-600 flex-shrink-0">
                        ✓
                      </span>
                    ) : (
                      <span className="text-2xl text-red-600 flex-shrink-0">
                        ✗
                      </span>
                    )}
                    <div className="flex-1">
                      <p
                        className={`font-semibold text-sm mb-1 ${
                          result.correct
                            ? "text-green-900"
                            : "text-red-900"
                        }`}
                      >
                        Question {idx + 1}
                        {question && `: ${question.prompt}`}
                      </p>
                      <p className={`text-sm ${
                          result.correct
                            ? "text-green-700"
                            : "text-red-700"
                        }`}>
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleBackToBadges}
            className="flex-1 border-2 border-gray-300 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-50 transition"
          >
            Back to Badges
          </button>
          {!results.passed && (
            <button
              onClick={handleRetakeQuiz}
              className="flex-1 bg-[#7B2FF2] text-white font-semibold py-3 rounded-lg hover:bg-[#6a1fe6] transition"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═════════════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {screen === "landing" && renderLanding()}
        {screen === "learn" && renderLearn()}
        {screen === "quiz" && renderQuiz()}
        {screen === "results" && renderResults()}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════════

function TeacherSetup({
  onSetup,
}: {
  onSetup: (email: string, className: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [className, setClassName] = useState("");
  const [classCode, setClassCode] = useState("");

  function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email && className) {
      const code = generateCode();
      setClassCode(code);
      onSetup(email, className);
    }
  }

  return (
    <div className="bg-white rounded-lg p-8 border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <ShieldIcon color="#7B2FF2" size={28} />
        <h2 className="text-2xl font-bold text-gray-900">For Teachers</h2>
      </div>

      {classCode ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Share this code with your students:
          </p>
          <div className="bg-purple-50 border-2 border-[#7B2FF2] rounded-lg p-6 text-center">
            <p className="text-4xl font-bold tracking-widest text-[#7B2FF2]">
              {classCode}
            </p>
          </div>
          <p className="text-sm text-gray-600">
            Class: <strong>{className}</strong>
          </p>
          <p className="text-xs text-gray-500">
            Students enter this code to join your session and take safety badge tests.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@school.edu"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7B2FF2]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Name
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g., Design & Technology 8B"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7B2FF2]"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-[#7B2FF2] text-white font-semibold py-2 rounded-lg hover:bg-[#6a1fe6] transition"
          >
            Create Session
          </button>

          <p className="text-xs text-gray-500">
            Create a session to get a class code your students can use.
          </p>
        </form>
      )}
    </div>
  );
}

function StudentJoin({
  onJoin,
}: {
  onJoin: (classCode: string, studentName: string) => void;
}) {
  const [classCode, setClassCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (classCode && studentName) {
      onJoin(classCode, studentName);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
    }
  }

  return (
    <div className="bg-white rounded-lg p-8 border border-gray-200">
      <div className="flex items-center gap-3 mb-6">
        <div className="text-3xl">👨‍🎓</div>
        <h2 className="text-2xl font-bold text-gray-900">For Students</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Class Code
          </label>
          <input
            type="text"
            value={classCode}
            onChange={(e) => setClassCode(e.target.value.toUpperCase())}
            placeholder="e.g., ABC123"
            maxLength={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7B2FF2] uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Name
          </label>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="Your name"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7B2FF2]"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-[#7B2FF2] text-white font-semibold py-2 rounded-lg hover:bg-[#6a1fe6] transition"
        >
          Join Class
        </button>

        {submitted && (
          <p className="text-sm text-green-700 bg-green-50 p-3 rounded-lg">
            ✓ Connected! Browse badges below to get started.
          </p>
        )}
      </form>

      <p className="text-xs text-gray-500 mt-6">
        Ask your teacher for the class code to join their class.
      </p>
    </div>
  );
}

function BadgeCard({
  badge,
  onSelect,
}: {
  badge: any;
  onSelect: (slug: string) => void;
}) {
  const tierLabels: Record<number, string> = {
    1: "Foundation",
    2: "Area",
    3: "Machine",
    4: "Specialist",
  };

  return (
    <button
      onClick={() => onSelect(badge.slug)}
      className="bg-white rounded-lg p-6 border border-gray-200 hover:border-gray-300 hover:shadow-md transition text-left"
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            backgroundColor: badge.color + "20",
            borderColor: badge.color,
            borderWidth: "2px",
          }}
        >
          <ShieldIcon color={badge.color} size={24} />
        </div>
        <span
          className="px-2 py-1 rounded text-xs font-semibold text-white"
          style={{ backgroundColor: badge.color }}
        >
          Tier {badge.tier}
        </span>
      </div>

      <h3 className="font-bold text-gray-900 mb-2">{badge.name}</h3>

      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {badge.description}
      </p>

      <div className="flex flex-wrap gap-2 text-xs text-gray-500">
        <span className="bg-gray-100 px-2 py-1 rounded">
          {badge.question_count}Q
        </span>
        <span className="bg-gray-100 px-2 py-1 rounded">
          {badge.pass_threshold}% pass
        </span>
      </div>
    </button>
  );
}

function TrueFalseQuestion({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: BadgeQuestion;
  selected: string | string[] | number[] | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      {[
        { label: "True", value: "true" },
        { label: "False", value: "false" },
      ].map((option) => (
        <label
          key={option.value}
          className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
            selected === option.value
              ? "border-[#7B2FF2] bg-purple-50"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="answer"
            value={option.value}
            checked={selected === option.value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-4 h-4 cursor-pointer"
          />
          <span className="ml-3 font-medium text-gray-900">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function MultipleChoiceQuestion({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: BadgeQuestion;
  selected: string | string[] | number[] | null;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  if (!question.options) return null;

  return (
    <div className="space-y-2">
      {question.options.map((option) => (
        <label
          key={option}
          className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition ${
            selected === option
              ? "border-[#7B2FF2] bg-purple-50"
              : "border-gray-200 hover:border-gray-300"
          } ${disabled ? "opacity-75 cursor-not-allowed" : ""}`}
        >
          <input
            type="radio"
            name="answer"
            value={option}
            checked={selected === option}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-4 h-4 mt-1 cursor-pointer flex-shrink-0"
          />
          <span className="ml-3 text-gray-900">{option}</span>
        </label>
      ))}
    </div>
  );
}

function SequenceQuestion({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: BadgeQuestion;
  selected: string | string[] | number[] | null;
  onChange: (value: number[]) => void;
  disabled: boolean;
}) {
  // Extract items from the prompt like "(1) Item A, (2) Item B, (3) Item C"
  const itemMatch = question.prompt.match(/\(\d+\)\s+[^,)]+/g);
  const items = itemMatch
    ? itemMatch.map((item) => item.replace(/^\(\d+\)\s+/, ""))
    : [];

  const selectedArray = Array.isArray(selected) ? selected : [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        Drag items or use dropdowns to arrange in the correct order:
      </p>

      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-3">
          <select
            value={selectedArray[idx] ?? ""}
            onChange={(e) => {
              const newOrder = [...selectedArray];
              newOrder[idx] = parseInt(e.target.value);
              onChange(newOrder);
            }}
            disabled={disabled}
            className="w-16 px-2 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7B2FF2]"
          >
            <option value="">--</option>
            {items.map((_, i) => (
              <option key={i} value={i}>
                {i + 1}
              </option>
            ))}
          </select>
          <span className="text-gray-700">{item}</span>
        </div>
      ))}
    </div>
  );
}

function MatchQuestion({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: BadgeQuestion;
  selected: string | string[] | number[] | null;
  onChange: (value: string[]) => void;
  disabled: boolean;
}) {
  if (!question.match_pairs || question.match_pairs.length === 0)
    return null;

  const selectedArray = Array.isArray(selected) ? selected : [];

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        Match each item on the left with the correct option on the right:
      </p>

      {question.match_pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-4">
          <div className="flex-1 p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-sm font-medium text-gray-900">{pair.left}</p>
          </div>
          <span className="text-gray-400">→</span>
          <select
            value={selectedArray[idx] ?? ""}
            onChange={(e) => {
              const newAnswers = [...selectedArray];
              newAnswers[idx] = e.target.value;
              onChange(newAnswers);
            }}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#7B2FF2]"
          >
            <option value="">Select an option</option>
            {question.match_pairs.map((p, i) => (
              <option key={i} value={p.right}>
                {p.right}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function ShieldIcon({
  color,
  size,
}: {
  color: string;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
