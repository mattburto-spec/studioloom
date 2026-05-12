/**
 * TFL.3 C.5 — GET /api/teacher/inbox/count source-static guards.
 *
 * Thin counter for the TopNav "Marking" badge. Re-uses loadInboxItems
 * so it shares the resolved_at + state derivation logic with the
 * inbox page itself (no chance of the badge + page disagreeing).
 *
 * Pins:
 *   - requireTeacher gate
 *   - GET method (not POST)
 *   - returns { total, replyWaiting }
 *   - Cache-Control: no-store (per-teacher, changes frequently)
 *   - reuses loadInboxItems (no separate query)
 *   - audit-skip annotation (read-only)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/inbox/count — auth + method", () => {
  it("gates with requireTeacher", () => {
    expect(src).toMatch(
      /import\s*\{\s*requireTeacher\s*\}\s*from\s*"@\/lib\/auth\/require-teacher"/,
    );
    expect(src).toMatch(/const auth\s*=\s*await\s+requireTeacher\(request\)/);
    expect(src).toMatch(/if\s*\(auth\.error\)\s*return\s+auth\.error/);
  });

  it("exports GET (not POST) — read-only", () => {
    expect(src).toMatch(/export async function GET\(/);
    expect(src).not.toMatch(/export async function POST\(/);
  });

  it("carries the audit-skip annotation", () => {
    expect(src).toMatch(/\/\/ audit-skip:/);
  });
});

describe("/api/teacher/inbox/count — implementation", () => {
  it("re-uses loadInboxItems (NOT a separate COUNT query)", () => {
    // Single source of truth for resolved_at + state derivation —
    // chip + inbox page can't disagree.
    expect(src).toMatch(
      /import\s*\{\s*loadInboxItems\s*\}\s*from\s*"@\/lib\/grading\/inbox-loader"/,
    );
    expect(src).toMatch(/await\s+loadInboxItems\(db,\s*auth\.teacherId\)/);
  });

  it("derives total + replyWaiting from items array", () => {
    expect(src).toMatch(/const total\s*=\s*items\.length/);
    expect(src).toMatch(
      /items\.filter\(\(i\)\s*=>\s*i\.state\s*===\s*"reply_waiting"\)\.length/,
    );
  });

  it("returns { total, replyWaiting } as JSON", () => {
    expect(src).toMatch(
      /NextResponse\.json\(\s*\{\s*total,\s*replyWaiting\s*\}/,
    );
  });

  it("sets Cache-Control: no-store (per-teacher data)", () => {
    expect(src).toMatch(/"Cache-Control":\s*"no-store/);
  });

  it("500 on loader failure with sanitized error message", () => {
    expect(src).toMatch(/status:\s*500/);
    expect(src).toMatch(/Failed to load count/);
  });
});
