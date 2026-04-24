/**
 * Shared quiz-field validators — used by teacher POST + PATCH routes.
 *
 * Keeps validation logic in one place so the two routes can't drift.
 */

import type { QuizQuestion } from "@/types/skills";

const VALID_TYPES = new Set<QuizQuestion["type"]>([
  "multiple_choice",
  "true_false",
  "scenario",
]);

/**
 * Shape-check a quiz_questions array. Returns null on pass, error string
 * on fail. Empty array is valid (signals no quiz on the card).
 */
export function validateQuizQuestions(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return "quiz_questions must be an array";
  }
  for (let i = 0; i < value.length; i++) {
    const q = value[i] as Partial<QuizQuestion> | undefined;
    const prefix = `quiz_questions[${i}]`;
    if (!q || typeof q !== "object") return `${prefix}: not an object`;
    if (!q.id || typeof q.id !== "string") {
      return `${prefix}.id required (string)`;
    }
    if (!q.type || !VALID_TYPES.has(q.type as QuizQuestion["type"])) {
      return `${prefix}.type must be multiple_choice / true_false / scenario`;
    }
    if (!q.prompt || typeof q.prompt !== "string" || !q.prompt.trim()) {
      return `${prefix}.prompt required (non-empty string)`;
    }
    if (typeof q.explanation !== "string") {
      return `${prefix}.explanation required (string, can be empty)`;
    }
    if (q.type === "true_false") {
      if (!q.options || !Array.isArray(q.options) || q.options.length !== 2) {
        return `${prefix}.options must have exactly 2 entries for true_false`;
      }
    } else {
      if (!q.options || !Array.isArray(q.options) || q.options.length < 2) {
        return `${prefix}.options must have at least 2 entries`;
      }
    }
    if (q.correct_answer === undefined || q.correct_answer === null) {
      return `${prefix}.correct_answer required`;
    }
  }
  return null;
}

/**
 * Validate pass_threshold (0-100 integer).
 */
export function validatePassThreshold(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > 100) {
    return "pass_threshold must be an integer 0-100";
  }
  return null;
}

/**
 * Validate retake_cooldown_minutes (>= 0 integer).
 */
export function validateRetakeCooldown(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 0) {
    return "retake_cooldown_minutes must be a non-negative integer";
  }
  return null;
}

/**
 * Validate question_count (null or positive integer, <= pool size).
 */
export function validateQuestionCount(
  value: unknown,
  poolSize: number
): string | null {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || (value as number) < 1) {
    return "question_count must be a positive integer (or null for full pool)";
  }
  if ((value as number) > poolSize) {
    return `question_count (${value}) cannot exceed quiz_questions length (${poolSize})`;
  }
  return null;
}
