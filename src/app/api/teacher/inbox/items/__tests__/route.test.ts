/**
 * TFL.3 C.1 — GET /api/teacher/inbox/items source-static guards.
 *
 * Pins the route contract:
 *   - requireTeacher() gates the endpoint (security-overview.md hard
 *     rule: bare auth.getUser() would let a student JWT call this)
 *   - createAdminClient + loadInboxItems wiring
 *   - Returns { items: InboxItem[] } shape the page expects
 *   - Errors return 500 with informative message
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/inbox/items — auth", () => {
  it("gates with requireTeacher (NOT bare auth.getUser)", () => {
    // security-overview.md hard rule: bare auth.getUser() lets a
    // logged-in student JWT call this route. Pin the requireTeacher
    // import + early-return on auth.error.
    expect(src).toMatch(
      /import\s*\{\s*requireTeacher\s*\}\s*from\s*"@\/lib\/auth\/require-teacher"/,
    );
    expect(src).toMatch(/const auth\s*=\s*await\s+requireTeacher\(request\)/);
    expect(src).toMatch(/if\s*\(auth\.error\)\s*return\s+auth\.error/);
  });

  it("uses createAdminClient (service-role) for DB reads", () => {
    expect(src).toContain("createAdminClient");
  });

  it("auth gate runs before any DB call", () => {
    const authGateAt = src.indexOf("requireTeacher(request)");
    const adminClientAt = src.indexOf("createAdminClient()");
    expect(authGateAt).toBeGreaterThan(-1);
    expect(adminClientAt).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(adminClientAt);
  });
});

describe("/api/teacher/inbox/items — loader wiring", () => {
  it("imports loadInboxItems from the helper (single source of truth)", () => {
    expect(src).toMatch(
      /import\s*\{\s*loadInboxItems\s*\}\s*from\s*"@\/lib\/grading\/inbox-loader"/,
    );
  });

  it("passes (db, teacherId) — scopes results to the requesting teacher", () => {
    expect(src).toMatch(/loadInboxItems\(db,\s*auth\.teacherId\)/);
  });

  it("returns { items } JSON (matches the page's expected shape)", () => {
    expect(src).toMatch(/NextResponse\.json\(\s*\{\s*items\s*\}\s*\)/);
  });
});

describe("/api/teacher/inbox/items — error path", () => {
  it("loader errors return 500 with informative message", () => {
    expect(src).toMatch(/status:\s*500/);
    expect(src).toMatch(/Failed to load inbox items/);
  });
});
