/**
 * POST /api/student/tile-feedback/[gradeId]/reply — source-static guards.
 *
 * TFL.2 Pass B sub-phase B.3. Pins the reply endpoint's contract:
 *
 *   - Auth gate runs FIRST (requireStudentSession before any DB call).
 *   - Sentiment must be one of the three enum values.
 *   - text is required + ≥REPLY_MIN_CHARS for not_sure / pushback;
 *     optional for got_it (single-click ack).
 *   - Ownership verified: the grade row's student_id must match
 *     session.studentId. Without this, a crafted request could
 *     inject replies into another student's thread.
 *   - INSERT uses role='student', sentiment, reply_text. Teacher
 *     fields (author_id, body_html, edited_at) NULL — matches the
 *     B.1 CHECK constraint.
 *   - Returns the inserted turn in the same Turn shape the GET
 *     route returns (so the client can append directly).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/tile-feedback/[gradeId]/reply — module hygiene", () => {
  it("uses requireStudentSession for auth", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("uses createAdminClient (service-role) for DB writes", () => {
    expect(src).toContain("createAdminClient");
  });

  it("imports REPLY_MIN_CHARS from the component types (single source of truth)", () => {
    // Client + server agree on the threshold. If the client UI says
    // "10 more chars" but the server requires 15, the user gets a
    // confusing rejection. Pin the import.
    expect(src).toMatch(
      /import\s*\{[^}]*REPLY_MIN_CHARS[^}]*\}\s*from\s*"@\/components\/lesson\/TeacherFeedback\/types"/,
    );
  });
});

describe("/api/student/tile-feedback/[gradeId]/reply — validation", () => {
  it("auth gate runs before any DB call", () => {
    const authGateAt = src.indexOf("requireStudentSession");
    const dbCallSites = [
      src.indexOf(".from("),
      src.indexOf(".rpc("),
    ].filter((i) => i > -1);
    const firstDbCall = dbCallSites.length > 0 ? Math.min(...dbCallSites) : Infinity;
    expect(authGateAt).toBeGreaterThan(-1);
    expect(authGateAt).toBeLessThan(firstDbCall);
  });

  it("sentiment enum check rejects non-enum values with 400", () => {
    expect(src).toMatch(/ALLOWED_SENTIMENTS:\s*Sentiment\[\]\s*=\s*\["got_it",\s*"not_sure",\s*"pushback"\]/);
    expect(src).toMatch(/ALLOWED_SENTIMENTS\.includes/);
    expect(src).toMatch(/sentiment must be one of/);
  });

  it("text length check requires ≥REPLY_MIN_CHARS for not_sure and pushback (NOT got_it)", () => {
    expect(src).toMatch(
      /sentiment\s*!==\s*"got_it"\s*&&\s*trimmedText\.length\s*<\s*REPLY_MIN_CHARS/,
    );
  });

  it("ownership check: grade.student_id must match session.studentId or 403", () => {
    // Anti-tampering: without this, a crafted request with a foreign
    // gradeId could inject replies into another student's thread.
    expect(src).toMatch(/student_id\s*!==\s*session\.studentId/);
    expect(src).toMatch(/status:\s*403/);
    expect(src).toMatch(/grade belongs to a different student/);
  });

  it("returns 404 when grade row doesn't exist", () => {
    expect(src).toMatch(/Grade not found/);
    expect(src).toMatch(/status:\s*404/);
  });
});

describe("/api/student/tile-feedback/[gradeId]/reply — insert shape", () => {
  it("inserts role='student' + sentiment + reply_text (matches B.1 CHECK constraint)", () => {
    expect(src).toMatch(
      /\.insert\(\s*\{\s*grade_id:\s*gradeId\s*,\s*role:\s*"student"\s*,\s*sentiment\s*,\s*reply_text:\s*trimmedText\s*\|\|\s*null\s*,?\s*\}/,
    );
  });

  it("does NOT set teacher-only fields on the student row (B.1 CHECK would reject)", () => {
    // Strip comments so docs mentioning these fields don't trip
    // the assertion. Want to catch actual writes.
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/[^\n]*/g, "");
    // Look at the .insert(...) block specifically.
    const insertBlock = codeOnly.match(/\.insert\([\s\S]*?\}\s*\)/)?.[0] ?? "";
    expect(insertBlock).not.toMatch(/author_id:/);
    expect(insertBlock).not.toMatch(/body_html:/);
    expect(insertBlock).not.toMatch(/edited_at:/);
  });

  it("returns the inserted turn in the GET-route's Turn shape (drop-in for client state append)", () => {
    // The shape: { role: "student", id, sentiment, text, sentAt }
    // matches the StudentTurn discriminator from types.ts so the
    // client can append directly to local state without remapping.
    expect(src).toMatch(/turn:\s*\{/);
    expect(src).toMatch(/role:\s*"student"\s+as\s+const/);
    expect(src).toMatch(/sentiment:\s*inserted_row\.sentiment/);
    expect(src).toMatch(/text:\s*inserted_row\.reply_text\s*\?\?\s*""/);
    expect(src).toMatch(/sentAt:\s*inserted_row\.sent_at/);
  });
});
