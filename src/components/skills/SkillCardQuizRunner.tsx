"use client";

/**
 * SkillCardQuizRunner — takes a skill card with a quiz and runs the student
 * through it. Three-screen flow ported from the safety-badges runner:
 *
 *   intro → quiz → results
 *
 * Props:
 *   card     — { id, slug, title }
 *   questions — QuizQuestion[]
 *
 * Status (cooldown, passed, attempt count) is fetched on mount from
 * /quiz-status. Submit hits /quiz-submit. State advances via learning_events
 * on the server; this component does not mutate state directly.
 *
 * Scope of Phase A: multiple_choice + true_false. scenario type renders
 * like multiple_choice (same shape). sequence/match deferred to Phase B
 * when we migrate safety module content that uses them.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  QuizAnswer,
  QuizAnswerResult,
  QuizQuestion,
  QuizStatus,
  QuizSubmitResponse,
} from "@/types/skills";

type Screen = "intro" | "quiz" | "results";

interface Props {
  cardId: string;
  cardSlug: string;
  cardTitle: string;
  questions: QuizQuestion[];
  /** Effective count (may be less than pool if `question_count` is set). */
  questionCount: number;
  passThreshold: number;
  retakeCooldownMinutes: number;
}

export function SkillCardQuizRunner({
  cardSlug,
  cardTitle,
  questions,
  questionCount,
  passThreshold,
  retakeCooldownMinutes,
}: Props) {
  const [screen, setScreen] = useState<Screen>("intro");
  const [status, setStatus] = useState<QuizStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Random-shuffled subset of `questions`, fixed per attempt. If
  // question_count is set, we pick N random questions; otherwise use all.
  const [active, setActive] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<QuizSubmitResponse | null>(
    null
  );

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/student/skills/cards/${encodeURIComponent(cardSlug)}/quiz-status`
      );
      if (!res.ok) {
        setStatusError("Failed to load quiz status.");
        return;
      }
      const json = (await res.json()) as QuizStatus;
      setStatus(json);
      setStatusError(null);
    } catch {
      setStatusError("Network error loading quiz status.");
    }
  }, [cardSlug]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  function startQuiz() {
    // Pick the subset. For Phase A, use the first N questions in pool order
    // (stable + simple); future: randomize per-attempt for anti-cheat.
    const selected =
      questionCount < questions.length
        ? questions.slice(0, questionCount)
        : questions;
    setActive(selected);
    setAnswers(selected.map((q) => ({ question_id: q.id, selected: "" })));
    setCurrentIndex(0);
    setStartedAt(Date.now());
    setSubmitResult(null);
    setSubmitError(null);
    setScreen("quiz");
  }

  function updateAnswer(questionId: string, selected: string | string[] | number[]) {
    setAnswers((prev) =>
      prev.map((a) =>
        a.question_id === questionId ? { ...a, selected } : a
      )
    );
  }

  async function submit() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const timeTaken = startedAt
        ? Math.floor((Date.now() - startedAt) / 1000)
        : 0;
      const res = await fetch(
        `/api/student/skills/cards/${encodeURIComponent(cardSlug)}/quiz-submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            answers,
            time_taken_seconds: timeTaken,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok) {
        setSubmitError(json.error ?? "Failed to submit quiz.");
        if (json.retake_after_minutes) {
          // Back to intro so they see the cooldown
          await fetchStatus();
          setScreen("intro");
        }
        return;
      }
      setSubmitResult(json as QuizSubmitResponse);
      setScreen("results");
      await fetchStatus(); // refresh passed / attempt count
    } catch (err) {
      console.error(err);
      setSubmitError("Network error submitting quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setScreen("intro");
    setSubmitResult(null);
  }

  // =========================================================================
  // Loading / error states
  // =========================================================================
  if (statusError) {
    return (
      <section className="sl-skill-quiz sl-skill-quiz--error">
        <p className="text-sm text-rose-700">{statusError}</p>
      </section>
    );
  }
  if (status === null) {
    return (
      <section className="sl-skill-quiz sl-skill-quiz--loading">
        <div className="animate-pulse h-5 bg-indigo-100 rounded w-1/3" />
      </section>
    );
  }

  // =========================================================================
  // INTRO
  // =========================================================================
  if (screen === "intro") {
    const cooldownActive = status.cooldown_remaining_minutes > 0;
    return (
      <section
        className="sl-skill-quiz sl-skill-quiz--intro"
        aria-label="Take the quiz"
      >
        <header className="sl-skill-quiz__header">
          <div className="sl-skill-quiz__eyebrow">Show what you know</div>
          <h2 className="sl-skill-quiz__title">Take the quiz</h2>
        </header>

        <dl className="sl-skill-quiz__facts">
          <div>
            <dt>Questions</dt>
            <dd>{questionCount}</dd>
          </div>
          <div>
            <dt>Pass</dt>
            <dd>{passThreshold}%</dd>
          </div>
          {retakeCooldownMinutes > 0 && (
            <div>
              <dt>Retake</dt>
              <dd>{retakeCooldownMinutes} min cooldown</dd>
            </div>
          )}
          {status.attempt_count > 0 && (
            <div>
              <dt>Attempts</dt>
              <dd>{status.attempt_count}</dd>
            </div>
          )}
          {status.best_score !== null && (
            <div>
              <dt>Best</dt>
              <dd>{status.best_score}%</dd>
            </div>
          )}
        </dl>

        {status.passed && (
          <div className="sl-skill-quiz__passed-badge">
            ✓ You&apos;ve already passed this quiz.{" "}
            <span className="text-xs opacity-80">
              Retakes are fine — your highest score stands.
            </span>
          </div>
        )}

        {cooldownActive ? (
          <div className="sl-skill-quiz__cooldown">
            You need to wait{" "}
            <strong>
              {status.cooldown_remaining_minutes} more minute
              {status.cooldown_remaining_minutes === 1 ? "" : "s"}
            </strong>{" "}
            before trying again.
          </div>
        ) : (
          <button
            type="button"
            className="sl-skill-quiz__start-btn"
            onClick={startQuiz}
          >
            {status.attempt_count === 0 ? "Start quiz" : "Try again"}
          </button>
        )}

        {submitError && (
          <p className="sl-skill-quiz__error-msg">{submitError}</p>
        )}
      </section>
    );
  }

  // =========================================================================
  // QUIZ
  // =========================================================================
  if (screen === "quiz") {
    const q = active[currentIndex];
    if (!q) return null;
    const ans = answers.find((a) => a.question_id === q.id);
    const selected = ans?.selected ?? "";
    const hasAnswer = Array.isArray(selected)
      ? selected.length > 0
      : String(selected).length > 0;

    const allAnswered = answers.every((a) => {
      if (Array.isArray(a.selected)) return a.selected.length > 0;
      return String(a.selected).length > 0;
    });

    return (
      <section
        className="sl-skill-quiz sl-skill-quiz--active"
        aria-label={`Quiz for ${cardTitle}`}
      >
        <header className="sl-skill-quiz__header">
          <div className="sl-skill-quiz__progress">
            <div
              className="sl-skill-quiz__progress-bar"
              style={{
                width: `${((currentIndex + 1) / active.length) * 100}%`,
              }}
            />
          </div>
          <div className="sl-skill-quiz__progress-label">
            Question {currentIndex + 1} of {active.length}
          </div>
        </header>

        <div className="sl-skill-quiz__question">
          <p className="sl-skill-quiz__prompt">{q.prompt}</p>
          <QuizQuestionInput
            question={q}
            selected={selected}
            onChange={(val) => updateAnswer(q.id, val)}
          />
        </div>

        <footer className="sl-skill-quiz__nav">
          <button
            type="button"
            className="sl-skill-quiz__nav-btn"
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
          >
            Previous
          </button>
          {currentIndex < active.length - 1 ? (
            <button
              type="button"
              className="sl-skill-quiz__nav-btn sl-skill-quiz__nav-btn--primary"
              onClick={() => setCurrentIndex((i) => i + 1)}
              disabled={!hasAnswer}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="sl-skill-quiz__nav-btn sl-skill-quiz__nav-btn--primary"
              onClick={submit}
              disabled={!allAnswered || submitting}
            >
              {submitting ? "Submitting…" : "Submit quiz"}
            </button>
          )}
        </footer>

        {submitError && (
          <p className="sl-skill-quiz__error-msg">{submitError}</p>
        )}
      </section>
    );
  }

  // =========================================================================
  // RESULTS
  // =========================================================================
  if (screen === "results" && submitResult) {
    const { score, passed, correct, total, results, pass_threshold } = submitResult;
    return (
      <section className="sl-skill-quiz sl-skill-quiz--results">
        <header
          className={`sl-skill-quiz__result-hero ${passed ? "sl-skill-quiz__result-hero--pass" : "sl-skill-quiz__result-hero--fail"}`}
        >
          <div className="sl-skill-quiz__result-score">{score}%</div>
          <div>
            <div className="sl-skill-quiz__result-label">
              {passed ? "You passed." : "Not quite."}
            </div>
            <div className="sl-skill-quiz__result-detail">
              {correct} correct out of {total} · {pass_threshold}% needed
            </div>
          </div>
        </header>

        <div className="sl-skill-quiz__review">
          <h3>Review</h3>
          <ol>
            {results.map((r: QuizAnswerResult, i) => (
              <li
                key={r.question_id}
                className={
                  r.correct
                    ? "sl-skill-quiz__result-row sl-skill-quiz__result-row--correct"
                    : "sl-skill-quiz__result-row sl-skill-quiz__result-row--wrong"
                }
              >
                <div className="sl-skill-quiz__result-num">{i + 1}</div>
                <div className="sl-skill-quiz__result-body">
                  <div className="sl-skill-quiz__result-prompt">{r.prompt}</div>
                  <div className="sl-skill-quiz__result-tag">
                    {r.correct ? "✓ Correct" : "✗ Incorrect"}
                  </div>
                  {r.explanation && (
                    <div className="sl-skill-quiz__result-explain">
                      {r.explanation}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <footer className="sl-skill-quiz__result-actions">
          {passed ? (
            <Link
              href="/skills"
              className="sl-skill-quiz__nav-btn sl-skill-quiz__nav-btn--primary"
            >
              Back to Skills
            </Link>
          ) : (
            <button
              type="button"
              className="sl-skill-quiz__nav-btn sl-skill-quiz__nav-btn--primary"
              onClick={retry}
            >
              Review &amp; try again
            </button>
          )}
        </footer>
      </section>
    );
  }

  return null;
}

// =========================================================================
// Per-question input — MC + T/F (scenario = MC shape)
// =========================================================================
function QuizQuestionInput({
  question,
  selected,
  onChange,
}: {
  question: QuizQuestion;
  selected: string | string[] | number[];
  onChange: (next: string | string[] | number[]) => void;
}) {
  // Options rendered as a radio-ish button list. Selected is a single
  // string (index-as-string for MC, option text for T/F).
  const options = useMemo(() => {
    if (question.type === "true_false") {
      return question.options ?? ["True", "False"];
    }
    return question.options ?? [];
  }, [question]);

  const selectedStr = typeof selected === "string" ? selected : "";

  if (!options.length) {
    return (
      <p className="text-sm text-gray-400 italic">
        No options defined for this question.
      </p>
    );
  }

  return (
    <ul className="sl-skill-quiz__options">
      {options.map((opt, i) => {
        const val = String(i);
        const active = selectedStr === val;
        return (
          <li key={i}>
            <button
              type="button"
              className={`sl-skill-quiz__option${active ? " sl-skill-quiz__option--selected" : ""}`}
              onClick={() => onChange(val)}
            >
              <span className="sl-skill-quiz__option-marker">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
