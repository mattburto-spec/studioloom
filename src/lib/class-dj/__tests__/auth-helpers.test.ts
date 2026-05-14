/**
 * Class DJ — auth-helpers source-static guards.
 *
 * Verifies the fix for the post-Phase-6 has_class_role-via-admin bug.
 * The Phase 6 routes called `db.rpc("has_class_role", {...})` on the
 * admin (service-role) client, which has no `auth.uid()`, so the
 * helper always returned false and every teacher route returned 403.
 *
 * verifyTeacherInClass takes the teacherId as an explicit arg and
 * queries class_members directly (admin client bypasses RLS, we
 * authorise here ourselves).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const HELPER_SRC = readFileSync(
  join(__dirname, "..", "auth-helpers.ts"),
  "utf-8",
);

describe("verifyTeacherInClass — admin-client-safe teacher gating", () => {
  it("queries class_members directly (NOT the SECURITY DEFINER rpc helper)", () => {
    expect(HELPER_SRC).toMatch(/from\("class_members"\)/);
    // No actual rpc CALL site in the implementation code (doc comments
    // can mention it; we look for the call pattern, not the substring).
    // Strip the leading doc block before checking.
    const codeOnly = HELPER_SRC.replace(/^\/\*\*[\s\S]*?\*\//, "");
    expect(codeOnly).not.toMatch(/db\.rpc\(/);
  });

  it("filters by member_user_id = explicit teacherId arg (not auth.uid())", () => {
    expect(HELPER_SRC).toMatch(/\.eq\("member_user_id", teacherId\)/);
  });

  it("checks removed_at IS NULL to honour the active-membership invariant", () => {
    expect(HELPER_SRC).toMatch(/\.is\("removed_at", null\)/);
  });

  it("supports the optional role filter (parity with has_class_role second arg)", () => {
    expect(HELPER_SRC).toMatch(/\.eq\("role", role\)/);
  });

  it("returns false on lookup error (defensive — fail closed, not open)", () => {
    expect(HELPER_SRC).toMatch(/if \(error\)[\s\S]{0,200}return false/);
  });
});

describe("All 7 Class DJ teacher-auth sites use verifyTeacherInClass (no rpc has_class_role)", () => {
  const sites = [
    "src/app/api/teacher/class-dj/[roundId]/pick/route.ts",
    "src/app/api/teacher/class-dj/[roundId]/close/route.ts",
    "src/app/api/teacher/class-dj/[roundId]/regenerate-narration/route.ts",
    "src/app/api/teacher/class-dj/constraints/[classId]/route.ts",
    "src/app/api/teacher/class-dj/constraints/[classId]/expire-veto/route.ts",
    "src/app/api/teacher/class-dj/constraints/[classId]/reset-ledger/route.ts",
    "src/app/api/student/class-dj/state/route.ts",
  ];

  it.each(sites)("%s imports + uses verifyTeacherInClass; has no rpc(has_class_role)", (site) => {
    const src = readFileSync(
      join(__dirname, "..", "..", "..", "..", site),
      "utf-8",
    );
    expect(src).toMatch(/import \{ verifyTeacherInClass \} from "@\/lib\/class-dj\/auth-helpers"/);
    expect(src).toMatch(/verifyTeacherInClass\(db,/);
    expect(src).not.toMatch(/rpc\("has_class_role"/);
  });
});
