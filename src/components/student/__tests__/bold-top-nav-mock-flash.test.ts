/**
 * BoldTopNav STUDENT_MOCK flash regression — source-static test.
 *
 * Surfaced 16 May 2026 via FU-AV2-CROSS-TAB-ROLE-COLLISION smoke:
 *   Matt was logged in as teacher in Chrome. A prior student
 *   classcode-login had silently stomped his sb-* Supabase Auth cookie
 *   (both flows write to the same cookie at studioloom.org — the
 *   underlying P2 issue tracked separately). Opening /dashboard in a
 *   new tab passed the middleware student-route check, the student
 *   layout mounted with `student=null`, and BoldTopNav briefly rendered
 *   STUDENT_MOCK as "Sam · Year 7 · Design" — a realistic-sounding
 *   name Matt didn't recognise. loadSession() then 401'd on the missing
 *   student-token cookie and bounced to /login.
 *
 * Two-part fix asserted here:
 *
 *   1. STUDENT_MOCK uses neutral placeholder values (em-dashes,
 *      no plausible class). Even if the fallback ever fires, it
 *      cannot lie about identity.
 *
 *   2. (student)/layout.tsx passes `loading={!student}` to BoldTopNav
 *      so the existing skeleton-pulse UI covers the auth-flash window.
 *      Previously hardcoded `loading={false}`, which let
 *      studentToSession(null) fall through to STUDENT_MOCK.
 *
 * NC mutation check at the end proves the STUDENT_MOCK assertion isn't
 * trivially green.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BOLD_TOP_NAV_PATH = join(
  __dirname,
  "..",
  "BoldTopNav.tsx"
);
const STUDENT_LAYOUT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "app",
  "(student)",
  "layout.tsx"
);

const boldTopNavSrc = readFileSync(BOLD_TOP_NAV_PATH, "utf-8");
const studentLayoutSrc = readFileSync(STUDENT_LAYOUT_PATH, "utf-8");

describe("STUDENT_MOCK placeholder is identity-neutral (FU-AV2-CROSS-TAB-ROLE-COLLISION smoke close-out)", () => {
  it("does not contain a realistic-sounding name", () => {
    // The actual STUDENT_MOCK block — bracketed declaration only.
    const block = boldTopNavSrc.match(
      /export const STUDENT_MOCK:[\s\S]*?\};/
    );
    expect(block).not.toBeNull();

    // No realistic first-name string values. We allow these tokens
    // anywhere ELSE in the file (e.g. the explanatory comment), so we
    // restrict the search to the declaration block.
    expect(block![0]).not.toMatch(/"Sam"/);
    expect(block![0]).not.toMatch(/"Maya"/);
    expect(block![0]).not.toMatch(/"Alex"/);
  });

  it("uses em-dash placeholder for name + first + initials", () => {
    const block = boldTopNavSrc.match(
      /export const STUDENT_MOCK:[\s\S]*?\};/
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/name:\s*"—"/);
    expect(block![0]).toMatch(/first:\s*"—"/);
    expect(block![0]).toMatch(/initials:\s*"—"/);
  });

  it("classTag is null (no fake class name like 'Year 7 · Design')", () => {
    const block = boldTopNavSrc.match(
      /export const STUDENT_MOCK:[\s\S]*?\};/
    );
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/classTag:\s*null/);
    expect(block![0]).not.toMatch(/Year 7/);
    expect(block![0]).not.toMatch(/Year \d+ · Design/);
  });

  it("avatar gradient is neutral grey, not a vivid student-distinguishing colour", () => {
    const block = boldTopNavSrc.match(
      /export const STUDENT_MOCK:[\s\S]*?\};/
    );
    expect(block).not.toBeNull();
    // The placeholder gradient matches the skeleton-pulse palette
    // (#E8E6DF → #D4D1C8). Asserting both endpoints catches an
    // accidental revert to the old `#E86F2C → #EC4899` orange/pink.
    expect(block![0]).toMatch(/#E8E6DF/);
    expect(block![0]).toMatch(/#D4D1C8/);
  });

  it("NC mutation: reverting STUDENT_MOCK to the old shape breaks the name assertion", () => {
    // Simulate the regression: someone edits STUDENT_MOCK back to "Sam".
    const mutated = boldTopNavSrc.replace(
      /name: "—",\s*first: "—",/,
      'name: "Sam",\n  first: "Sam",'
    );
    expect(mutated).not.toBe(boldTopNavSrc);

    const block = mutated.match(/export const STUDENT_MOCK:[\s\S]*?\};/);
    expect(block).not.toBeNull();
    // The assertion that would have passed on the real source fails here.
    expect(block![0]).toMatch(/"Sam"/);
  });
});

describe("StudentLayout passes loading={!student} to BoldTopNav (auth-flash skeleton)", () => {
  it("the prop `loading={!student}` sits inside the BoldTopNav element", () => {
    // Find the BoldTopNav element block and assert loading={!student}
    // appears as a JSX attribute. We deliberately don't use a negative
    // "no loading={false} anywhere in the file" assertion here — the
    // explanatory comment above the prop legitimately references the
    // historical "loading={false}" so a global negative would
    // false-fail. The NC mutation test below is the regression gate.
    const block = studentLayoutSrc.match(/<BoldTopNav[\s\S]*?\/>/);
    expect(block).not.toBeNull();
    expect(block![0]).toMatch(/loading=\{!student\}/);
  });

  it("NC mutation: reverting to `loading={false}` breaks the assertion", () => {
    const mutated = studentLayoutSrc.replace(
      /loading=\{!student\}/,
      "loading={false}"
    );
    expect(mutated).not.toBe(studentLayoutSrc);

    const block = mutated.match(/<BoldTopNav[\s\S]*?\/>/);
    expect(block).not.toBeNull();
    expect(block![0]).not.toMatch(/loading=\{!student\}/);
    expect(block![0]).toMatch(/loading=\{false\}/);
  });
});
