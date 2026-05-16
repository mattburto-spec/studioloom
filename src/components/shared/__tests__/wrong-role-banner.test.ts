/**
 * WrongRoleBanner source-static test — FU-AV2-WRONG-ROLE-TOAST close-out.
 *
 * Asserts:
 *   1. The component reads `wrong_role` from useSearchParams and gates
 *      rendering on `=== "1"`.
 *   2. Dismiss strips the query param via router.replace.
 *   3. Sign-out flows are role-specific and match the existing layouts'
 *      logout handlers (student: DELETE /api/auth/student-session +
 *      /login; teacher: supabase.auth.signOut() + /teacher/login).
 *   4. The banner is mounted in BOTH the (student) layout AND the
 *      teacher layout.
 *   5. The teacher mount sits inside the `authState === "teacher"` branch
 *      only — never inside the "checking" / "redirecting" placeholder
 *      (which would defeat the FU-SEC-TEACHER-LAYOUT-FAIL-OPEN fix by
 *      flashing chrome before the redirect lands).
 *
 * Co-located with the component file. Mirrors the source-static pattern
 * used for FU-SEC-TEACHER-LAYOUT-FAIL-OPEN (Block C).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const BANNER_PATH = join(__dirname, "..", "WrongRoleBanner.tsx");
const STUDENT_LAYOUT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "app",
  "(student)",
  "layout.tsx"
);
const TEACHER_LAYOUT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "app",
  "teacher",
  "layout.tsx"
);

const bannerSrc = readFileSync(BANNER_PATH, "utf-8");
const studentLayoutSrc = readFileSync(STUDENT_LAYOUT_PATH, "utf-8");
const teacherLayoutSrc = readFileSync(TEACHER_LAYOUT_PATH, "utf-8");

describe("WrongRoleBanner component (FU-AV2-WRONG-ROLE-TOAST)", () => {
  it("reads wrong_role from useSearchParams and gates render on '=== \"1\"'", () => {
    expect(bannerSrc).toMatch(/useSearchParams/);
    expect(bannerSrc).toMatch(/searchParams\.get\("wrong_role"\)\s*===\s*"1"/);
  });

  it("dismiss strips the wrong_role param via router.replace", () => {
    expect(bannerSrc).toMatch(/params\.delete\("wrong_role"\)/);
    expect(bannerSrc).toMatch(/router\.replace\(/);
  });

  it("dismiss preserves other query params (not a blanket strip)", () => {
    // We construct a new URLSearchParams from the existing one and only
    // delete wrong_role — should not pass a hardcoded empty string to
    // router.replace.
    expect(bannerSrc).toMatch(/new URLSearchParams\(searchParams\.toString\(\)\)/);
  });

  it("student sign-out matches StudentLayout.handleLogout shape (DELETE /api/auth/student-session)", () => {
    expect(bannerSrc).toMatch(
      /fetch\("\/api\/auth\/student-session",\s*\{\s*method:\s*"DELETE"\s*\}\)/
    );
    expect(bannerSrc).toMatch(/window\.location\.href = "\/login"/);
  });

  it("teacher sign-out matches TopNav.handleLogout shape (supabase.auth.signOut)", () => {
    expect(bannerSrc).toMatch(/supabase\.auth\.signOut\(\)/);
    expect(bannerSrc).toMatch(/window\.location\.href = "\/teacher\/login"/);
  });

  it("exposes data-testid for runtime targeting (smoke + future RTL tests)", () => {
    expect(bannerSrc).toMatch(/data-testid="wrong-role-banner"/);
  });

  it("uses role='status' + aria-live='polite' for a11y", () => {
    expect(bannerSrc).toMatch(/role="status"/);
    expect(bannerSrc).toMatch(/aria-live="polite"/);
  });

  it("role-specific copy: student copy mentions teacher area, teacher copy mentions student area", () => {
    expect(bannerSrc).toMatch(/signed in as a student.*teacher area/s);
    expect(bannerSrc).toMatch(/signed in as a teacher.*student area/s);
  });

  it("NC mutation: removing the searchParams check makes the gate vanish", () => {
    const mutated = bannerSrc.replace(
      /searchParams\.get\("wrong_role"\)\s*===\s*"1"/,
      "true"
    );
    expect(mutated).not.toBe(bannerSrc);
    expect(mutated).not.toMatch(
      /searchParams\.get\("wrong_role"\)\s*===\s*"1"/
    );
  });
});

describe("WrongRoleBanner mount points", () => {
  it("student layout imports + mounts WrongRoleBanner with role='student'", () => {
    expect(studentLayoutSrc).toMatch(
      /import\s*\{\s*WrongRoleBanner\s*\}\s*from\s*"@\/components\/shared\/WrongRoleBanner"/
    );
    expect(studentLayoutSrc).toMatch(/<WrongRoleBanner role="student"\s*\/>/);
  });

  it("teacher layout imports + mounts WrongRoleBanner with role='teacher'", () => {
    expect(teacherLayoutSrc).toMatch(
      /import\s*\{\s*WrongRoleBanner\s*\}\s*from\s*"@\/components\/shared\/WrongRoleBanner"/
    );
    expect(teacherLayoutSrc).toMatch(/<WrongRoleBanner role="teacher"\s*\/>/);
  });

  it("teacher layout mounts the banner ONLY inside the chrome render — not in the placeholder", () => {
    // The fail-closed placeholder block is reached when authState is
    // "checking" or "redirecting". Mounting WrongRoleBanner there would
    // defeat FU-SEC-TEACHER-LAYOUT-FAIL-OPEN (would flash a banner with
    // wrong-role copy before the redirect lands).
    //
    // Approximation: find the placeholder block and assert it doesn't
    // contain WrongRoleBanner.
    const placeholderBlock = teacherLayoutSrc.match(
      /authState === "checking" \|\| authState === "redirecting"[\s\S]*?<\/div>\s*\)/
    );
    expect(placeholderBlock).not.toBeNull();
    expect(placeholderBlock![0]).not.toMatch(/<WrongRoleBanner/);
  });

  it("student layout mounts banner BETWEEN BoldTopNav and {children}", () => {
    // Visual placement matters: above content, below the top nav. We
    // assert ordering by finding the indices of the two tokens.
    const banner = studentLayoutSrc.indexOf("<WrongRoleBanner");
    // Use a regex to match BoldTopNav opening tag specifically (not the
    // import line).
    const topNavMatch = studentLayoutSrc.match(/<BoldTopNav\s/);
    expect(topNavMatch).not.toBeNull();
    const topNavIdx = topNavMatch!.index!;
    const childrenIdx = studentLayoutSrc.indexOf("{children}");

    expect(topNavIdx).toBeGreaterThan(-1);
    expect(banner).toBeGreaterThan(topNavIdx);
    expect(banner).toBeLessThan(childrenIdx);
  });
});
