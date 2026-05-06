/**
 * AG.2.3a — source-static guards for /api/student/kanban (GET + POST).
 *
 * Style mirrors src/app/api/teacher/tasks/__tests__/route.test.ts:
 * read the file, assert specific patterns. Catches regressions on
 * auth chain, validator wiring, count recomputation, upsert shape.
 *
 * Per Lesson #38: assert specific values, not just non-null.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/kanban — module hygiene", () => {
  it("uses requireStudentSession for auth (Lesson #4 — token sessions, not Supabase Auth)", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("imports server validators + count recomputation", () => {
    expect(src).toContain("validateKanbanState");
    expect(src).toContain("recomputeCounts");
    expect(src).toContain('from "@/lib/unit-tools/kanban/server-validators"');
  });

  it("uses createAdminClient (service-role) for DB writes (RLS bypass for student writes)", () => {
    expect(src).toContain("createAdminClient");
  });

  it("uses withErrorHandler for both routes", () => {
    expect(src).toContain('"student/kanban:GET"');
    expect(src).toContain('"student/kanban:POST"');
  });

  it("does not include user_id reference (Lesson #72 — student auth via studentId from session)", () => {
    expect(src).not.toMatch(/user_id\s*[:=]/);
  });
});

describe("/api/student/kanban — GET", () => {
  it("requires unitId query parameter (400 when missing)", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("unitId query parameter required");
    expect(getBody).toMatch(/status:\s*400/);
  });

  it("scopes lookup to studentId from session (not body)", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/\.eq\("student_id",\s*studentId\)/);
    expect(getBody).toMatch(/\.eq\("unit_id",\s*unitId\)/);
  });

  it("returns empty initial state when no row exists (no error)", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("emptyKanbanState()");
    expect(getBody).toMatch(/if\s*\(!data\)\s*\{/);
  });

  it("uses maybeSingle (not .single()) so missing row isn't an error", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/\.maybeSingle\(\)/);
  });

  it("returns kanban + counts in response shape", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/kanban:[\s\S]{0,40}counts:/);
  });
});

describe("/api/student/kanban — POST", () => {
  it("requires authentication (requireStudentSession)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("requireStudentSession(request)");
  });

  it("returns 400 on invalid JSON body", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Invalid JSON");
  });

  it("requires unitId in body (400 if missing or non-string)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("unitId required");
  });

  it("validates state shape via validateKanbanState BEFORE writing", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    const validateIdx = postBody.indexOf("validateKanbanState");
    const upsertIdx = postBody.indexOf(".upsert(");
    expect(validateIdx).toBeGreaterThan(0);
    expect(upsertIdx).toBeGreaterThan(validateIdx);
  });

  it("returns 400 with details array on validation failure", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Validation failed");
    expect(postBody).toContain("details: validation.errors");
  });

  it("recomputes counts server-side BEFORE upsert (denormalization can never drift)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    const recomputeIdx = postBody.indexOf("recomputeCounts(state)");
    const upsertIdx = postBody.indexOf(".upsert(");
    expect(recomputeIdx).toBeGreaterThan(0);
    expect(upsertIdx).toBeGreaterThan(recomputeIdx);
  });

  it("uses upsert with onConflict on (student_id, unit_id) — matches table UNIQUE", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toMatch(/onConflict:\s*"student_id,unit_id"/);
  });

  it("upsert payload uses studentId from session, NOT from body (auth boundary)", () => {
    const upsertIdx = src.indexOf(".upsert(");
    const slice = src.slice(upsertIdx, upsertIdx + 800);
    expect(slice).toContain("student_id: studentId");
    expect(slice).toContain("unit_id: b.unitId");
  });

  it("upsert payload includes denormalized count columns", () => {
    const upsertIdx = src.indexOf(".upsert(");
    const slice = src.slice(upsertIdx, upsertIdx + 800);
    expect(slice).toContain("backlog_count: counts.backlog_count");
    expect(slice).toContain("this_class_count: counts.this_class_count");
    expect(slice).toContain("doing_count: counts.doing_count");
    expect(slice).toContain("done_count: counts.done_count");
  });

  it("returns kanban + counts in response shape (matches GET)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    // Last NextResponse.json in POST is the success path
    const lastJsonIdx = postBody.lastIndexOf("NextResponse.json");
    const tail = postBody.slice(lastJsonIdx, lastJsonIdx + 500);
    expect(tail).toContain("kanban:");
    expect(tail).toContain("counts:");
  });
});
