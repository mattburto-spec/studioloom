/**
 * S7 (F-19 9 May 2026) — restoreStudentName whole-word edge cases.
 *
 * The placeholder primitive at @/lib/security/student-name-placeholder
 * uses the regex /\bStudent\b/g to swap "Student" → realName on AI
 * responses. The cowork external review flagged that whole-word
 * matching has subtle edge cases:
 *
 *   - "Student-Centered Learning" — hyphen is a non-word char, so \b
 *     matches. Will swap → "<realName>-Centered Learning". Acceptable
 *     for now (rare phrase in per-student feedback) but documented.
 *
 *   - "Student Council" — space is non-word, \b matches. Swaps →
 *     "<realName> Council". Same call.
 *
 *   - "Students" (plural) — `s` is word-char, \b does NOT match between
 *     `t` and `s`. So "Students" is NOT swapped. Good.
 *
 *   - "AStudent" (concatenation) — `A` is word-char, \b does NOT match.
 *     Not swapped. Good.
 *
 *   - "STUDENT" (uppercase) — regex is case-sensitive on capital S; the
 *     prompt steers the model to use the capital-S form, but if it
 *     uppercases the placeholder, the swap silently misses. Documented
 *     as known limitation.
 *
 * These tests lock the contract so future edits to the regex don't
 * silently change behavior.
 */
import { describe, it, expect } from "vitest";
import {
  restoreStudentName,
  STUDENT_NAME_PLACEHOLDER,
} from "../student-name-placeholder";

describe("STUDENT_NAME_PLACEHOLDER", () => {
  it("is the literal string 'Student'", () => {
    expect(STUDENT_NAME_PLACEHOLDER).toBe("Student");
  });
});

describe("restoreStudentName — basic cases", () => {
  it("swaps a single 'Student' for the real name", () => {
    expect(restoreStudentName("Student showed effort.", "Maya")).toBe(
      "Maya showed effort.",
    );
  });

  it("swaps multiple occurrences", () => {
    expect(
      restoreStudentName("Student began. Student finished.", "Maya"),
    ).toBe("Maya began. Maya finished.");
  });

  it("returns input unchanged when 'Student' is absent", () => {
    expect(restoreStudentName("Excellent work this term.", "Maya")).toBe(
      "Excellent work this term.",
    );
  });

  it("handles empty input", () => {
    expect(restoreStudentName("", "Maya")).toBe("");
  });

  it("handles names with spaces or punctuation", () => {
    expect(restoreStudentName("Student is doing well.", "Maya O'Brien")).toBe(
      "Maya O'Brien is doing well.",
    );
  });
});

describe("restoreStudentName — whole-word edge cases (F-19)", () => {
  it("DOES NOT swap 'Students' (plural — \\b doesn't match before 's')", () => {
    expect(restoreStudentName("Students worked together.", "Maya")).toBe(
      "Students worked together.",
    );
  });

  it("DOES NOT swap when prefixed with a word char ('AStudent', 'TheStudent')", () => {
    expect(restoreStudentName("AStudent identifier.", "Maya")).toBe(
      "AStudent identifier.",
    );
    expect(restoreStudentName("TheStudent appeared.", "Maya")).toBe(
      "TheStudent appeared.",
    );
  });

  it("DOES NOT swap when suffixed with a word char ('StudentX')", () => {
    expect(restoreStudentName("StudentX is invalid.", "Maya")).toBe(
      "StudentX is invalid.",
    );
  });

  it("DOES NOT swap lowercase 'student' (regex is case-sensitive — known limitation)", () => {
    expect(restoreStudentName("the student worked hard.", "Maya")).toBe(
      "the student worked hard.",
    );
  });

  it("DOES NOT swap uppercase 'STUDENT' (case-sensitive — known limitation)", () => {
    expect(restoreStudentName("STUDENT shouted.", "Maya")).toBe(
      "STUDENT shouted.",
    );
  });

  it("DOES swap when followed by hyphen ('Student-Centered')", () => {
    // Hyphen is a non-word char so \b matches. Acceptable side-effect
    // documented in test header — rare in per-student feedback context.
    expect(restoreStudentName("Student-Centered approach.", "Maya")).toBe(
      "Maya-Centered approach.",
    );
  });

  it("DOES swap when followed by punctuation ('Student!', 'Student.', 'Student,')", () => {
    expect(restoreStudentName("Well done, Student!", "Maya")).toBe(
      "Well done, Maya!",
    );
    expect(restoreStudentName("Student. Try again.", "Maya")).toBe(
      "Maya. Try again.",
    );
    expect(restoreStudentName("Student, please.", "Maya")).toBe(
      "Maya, please.",
    );
  });

  it("DOES swap inside quotes ('\"Student\"')", () => {
    expect(restoreStudentName('She said: "Student".', "Maya")).toBe(
      'She said: "Maya".',
    );
  });

  it("DOES swap when followed by apostrophe-s ('Student's diagram')", () => {
    // Apostrophe is non-word so \b matches between `t` and `'`.
    expect(restoreStudentName("Student's diagram.", "Maya")).toBe(
      "Maya's diagram.",
    );
  });
});

describe("restoreStudentName — empty / odd inputs", () => {
  it("handles empty realName by replacing with empty string (no crash)", () => {
    expect(restoreStudentName("Student worked hard.", "")).toBe(
      " worked hard.",
    );
  });

  it("handles realName containing 'Student' (no infinite loop / re-swap)", () => {
    // The .replace with /g pass is single-pass — replacement text is not
    // re-scanned. So "StudentName" inside the realName doesn't cause
    // recursive substitution.
    expect(restoreStudentName("Student finished.", "StudentName")).toBe(
      "StudentName finished.",
    );
  });
});
