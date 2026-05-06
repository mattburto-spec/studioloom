/**
 * AG.3.3 — source-static guards for /api/student/timeline.
 *
 * Same shape as Kanban route tests. Per Lesson #38: assert specific
 * patterns + ordering, not just presence. Per Lesson #72: no user_id
 * pattern.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/student/timeline — module hygiene", () => {
  it("uses requireStudentSession for auth (Lesson #4)", () => {
    expect(src).toContain('from "@/lib/access-v2/actor-session"');
    expect(src).toContain("requireStudentSession");
  });

  it("imports server validators + summary recomputation", () => {
    expect(src).toContain("validateTimelineState");
    expect(src).toContain("recomputeSummary");
    expect(src).toContain('from "@/lib/unit-tools/timeline/server-validators"');
  });

  it("uses createAdminClient (service-role) for DB writes", () => {
    expect(src).toContain("createAdminClient");
  });

  it("uses withErrorHandler for both routes", () => {
    expect(src).toContain('"student/timeline:GET"');
    expect(src).toContain('"student/timeline:POST"');
  });

  it("does not include user_id reference (Lesson #72)", () => {
    expect(src).not.toMatch(/user_id\s*[:=]/);
  });
});

describe("/api/student/timeline — GET", () => {
  it("requires unitId query parameter (400)", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("unitId query parameter required");
    expect(getBody).toMatch(/status:\s*400/);
  });

  it("scopes lookup to studentId from session (auth boundary)", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/\.eq\("student_id",\s*studentId\)/);
    expect(getBody).toMatch(/\.eq\("unit_id",\s*unitId\)/);
  });

  it("uses .maybeSingle() for missing-row tolerance", () => {
    expect(src).toContain(".maybeSingle()");
  });

  it("returns empty initial state when no row exists", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("emptyTimelineState()");
    expect(getBody).toMatch(/if\s*\(!data\)/);
  });

  it("returns timeline + summary in response shape", () => {
    const getStart = src.indexOf("export const GET");
    const postStart = src.indexOf("export const POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toMatch(/timeline:[\s\S]{0,40}summary:/);
  });
});

describe("/api/student/timeline — POST", () => {
  it("requires authentication", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("requireStudentSession(request)");
  });

  it("returns 400 on invalid JSON", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Invalid JSON");
  });

  it("requires unitId in body", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("unitId required");
  });

  it("validates state BEFORE writing", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    const validateIdx = postBody.indexOf("validateTimelineState");
    const upsertIdx = postBody.indexOf(".upsert(");
    expect(validateIdx).toBeGreaterThan(0);
    expect(upsertIdx).toBeGreaterThan(validateIdx);
  });

  it("returns 400 with details on validation failure", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Validation failed");
    expect(postBody).toContain("details: validation.errors");
  });

  it("recomputes summary BEFORE upsert (denormalization can never drift)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    const recomputeIdx = postBody.indexOf("recomputeSummary(state)");
    const upsertIdx = postBody.indexOf(".upsert(");
    expect(recomputeIdx).toBeGreaterThan(0);
    expect(upsertIdx).toBeGreaterThan(recomputeIdx);
  });

  it("uses upsert with onConflict on (student_id, unit_id)", () => {
    expect(src).toMatch(/onConflict:\s*"student_id,unit_id"/);
  });

  it("upsert payload uses studentId from session, NOT body", () => {
    const upsertIdx = src.indexOf(".upsert(");
    const slice = src.slice(upsertIdx, upsertIdx + 800);
    expect(slice).toContain("student_id: studentId");
    expect(slice).toContain("unit_id: b.unitId");
  });

  it("upsert payload includes all 4 denormalized summary columns", () => {
    const upsertIdx = src.indexOf(".upsert(");
    const slice = src.slice(upsertIdx, upsertIdx + 1000);
    expect(slice).toContain("next_milestone_label: summary.next_milestone_label");
    expect(slice).toContain("next_milestone_target_date: summary.next_milestone_target_date");
    expect(slice).toContain("pending_count: summary.pending_count");
    expect(slice).toContain("done_count: summary.done_count");
  });

  it("response shape matches GET (timeline + summary)", () => {
    const postStart = src.indexOf("export const POST");
    const postBody = src.slice(postStart);
    const lastJsonIdx = postBody.lastIndexOf("NextResponse.json");
    const tail = postBody.slice(lastJsonIdx, lastJsonIdx + 500);
    expect(tail).toContain("timeline:");
    expect(tail).toContain("summary:");
  });
});
