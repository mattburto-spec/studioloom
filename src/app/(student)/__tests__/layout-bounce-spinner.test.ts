/**
 * StudentLayout bounce-spinner regression — source-static test.
 *
 * Surfaced 16 May 2026 via FU-AV2-CROSS-TAB-ROLE-COLLISION smoke
 * follow-up (PR #327's smoke). Even with STUDENT_MOCK neutralised and
 * loading={!student} wired to BoldTopNav, the bounce-to-/login path
 * still flashed the student-area chrome (logo, nav pills) for ~50–200ms
 * while router.push completed. Cause: the useEffect's `finally` block
 * unconditionally flipped `loading=false`, so the layout proceeded past
 * its full-screen warm-paper spinner and rendered BoldTopNav with
 * student=null on the bounce branches.
 *
 * Fix shape (mirrors TeacherLayout's fail-closed pattern from
 * FU-SEC-TEACHER-LAYOUT-FAIL-OPEN, 16 May 2026):
 *   - Drop the `finally` block.
 *   - Only call setLoading(false) on the SUCCESS path, after setStudent.
 *   - Bounce branches (!res.ok + catch) leave loading=true so the
 *     warm-paper spinner stays mounted until navigation completes.
 *     No chrome ever renders for a non-student.
 *
 * NC mutation check at the end proves the assertion isn't trivially
 * green.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const STUDENT_LAYOUT_PATH = join(__dirname, "..", "layout.tsx");
const studentLayoutSrc = readFileSync(STUDENT_LAYOUT_PATH, "utf-8");

describe("StudentLayout bounce path leaves loading=true (mirrors TeacherLayout fail-closed)", () => {
  it("loadSession useEffect has NO `finally` block", () => {
    // The fix's load-bearing property: no `finally` means no
    // unconditional setLoading(false). The bounce branches inherit
    // the initial loading=true state.
    const useEffectBody = studentLayoutSrc.match(
      /async function loadSession\(\)[\s\S]*?\n\s*\}\s*loadSession\(\);/
    );
    expect(useEffectBody).not.toBeNull();
    expect(useEffectBody![0]).not.toMatch(/\}\s*finally\s*\{/);
  });

  it("setLoading(false) appears exactly ONCE in the useEffect — on the success path", () => {
    const useEffectBody = studentLayoutSrc.match(
      /async function loadSession\(\)[\s\S]*?\n\s*\}\s*loadSession\(\);/
    );
    expect(useEffectBody).not.toBeNull();
    const matches = useEffectBody![0].match(/setLoading\(false\)/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it("the !res.ok branch does NOT call setLoading(false)", () => {
    // The !res.ok block is small + bounded — match from `if (!res.ok)`
    // to its closing `}` (no nested braces inside this branch in the
    // current shape).
    const branch = studentLayoutSrc.match(
      /if \(!res\.ok\) \{[\s\S]*?\n\s*\}/
    );
    expect(branch).not.toBeNull();
    expect(branch![0]).toMatch(/router\.push\("\/login"\)/);
    expect(branch![0]).not.toMatch(/setLoading\(false\)/);
  });

  it("the catch block does NOT call setLoading(false)", () => {
    // Find the `} catch {` block in the loadSession useEffect.
    const catchBlock = studentLayoutSrc.match(
      /\} catch \{[\s\S]*?\n\s*\}/
    );
    expect(catchBlock).not.toBeNull();
    expect(catchBlock![0]).toMatch(/router\.push\("\/login"\)/);
    expect(catchBlock![0]).not.toMatch(/setLoading\(false\)/);
  });

  it("setLoading(false) sits AFTER setStudent in the success path (only flip when we have data)", () => {
    const useEffectBody = studentLayoutSrc.match(
      /async function loadSession\(\)[\s\S]*?\n\s*\}\s*loadSession\(\);/
    );
    expect(useEffectBody).not.toBeNull();

    const setStudentIdx = useEffectBody![0].indexOf("setStudent(data.student)");
    const setLoadingIdx = useEffectBody![0].indexOf("setLoading(false)");

    expect(setStudentIdx).toBeGreaterThan(-1);
    expect(setLoadingIdx).toBeGreaterThan(-1);
    expect(setLoadingIdx).toBeGreaterThan(setStudentIdx);
  });

  it("NC mutation: adding setLoading(false) back into the catch block breaks the catch-block assertion", () => {
    // Simulate a regression: someone re-adds the unconditional flip.
    const mutated = studentLayoutSrc.replace(
      /\} catch \{\n(\s*)\/\/ Same fail-closed shape[\s\S]*?router\.push\("\/login"\);/,
      `} catch {\n$1setLoading(false);\n$1router.push("/login");`
    );
    expect(mutated).not.toBe(studentLayoutSrc);

    const catchBlock = mutated.match(/\} catch \{[\s\S]*?\n\s*\}/);
    expect(catchBlock).not.toBeNull();
    // The original assertion (catch must NOT call setLoading) would fail
    // on the mutated source — exactly what we want.
    expect(catchBlock![0]).toMatch(/setLoading\(false\)/);
  });

  it("NC mutation: reintroducing the `finally` block breaks the no-finally assertion", () => {
    // Synthesize the old finally block back into the source string.
    const mutated = studentLayoutSrc.replace(
      /\} catch \{\n(\s*)\/\/ Same fail-closed shape[\s\S]*?router\.push\("\/login"\);\n\s*\}/,
      `} catch {\n$1router.push("/login");\n      } finally {\n        setLoading(false);`
    );
    expect(mutated).not.toBe(studentLayoutSrc);
    expect(mutated).toMatch(/\}\s*finally\s*\{/);
  });
});
