/**
 * TG.0C.2 — source-static guards for /api/teacher/tasks (GET + POST)
 *
 * Style mirrors src/app/api/teacher/units/__tests__/route.test.ts: read the
 * route file, assert specific patterns appear. Avoids the Supabase JS mock
 * thicket while still catching common regressions:
 *   - auth chain (requireTeacherAuth → verifyTeacherHasUnit)
 *   - school_id resolution from teachers.school_id (Lesson #72)
 *   - validator wired to validateCreateTaskInput
 *   - 3-step write flow (parent → weights → links) with cleanup-on-failure
 *   - GET denormalises children
 *
 * Per Lesson #38: assertions check expected values, not just presence.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/tasks — GET", () => {
  it("requires authentication via requireTeacherAuth", () => {
    expect(src).toMatch(/export async function GET/);
    const getStart = src.indexOf("export async function GET");
    const postStart = src.indexOf("export async function POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("requireTeacherAuth(request)");
  });

  it("returns 400 when unit_id query param is missing", () => {
    const getStart = src.indexOf("export async function GET");
    const postStart = src.indexOf("export async function POST");
    const getBody = src.slice(getStart, postStart);
    expect(getBody).toContain("unit_id query parameter required");
    expect(getBody).toMatch(/status:\s*400/);
  });

  it("verifies teacher access to the unit before reading tasks", () => {
    const getStart = src.indexOf("export async function GET");
    const postStart = src.indexOf("export async function POST");
    const getBody = src.slice(getStart, postStart);
    const verifyIdx = getBody.indexOf("verifyTeacherHasUnit");
    const queryIdx = getBody.indexOf('.from("assessment_tasks")');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(queryIdx).toBeGreaterThan(verifyIdx);
  });

  it("orders tasks by created_at ascending", () => {
    expect(src).toMatch(
      /\.from\("assessment_tasks"\)[\s\S]*?\.order\("created_at",\s*\{\s*ascending:\s*true\s*\}\)/
    );
  });

  it("denormalises task_criterion_weights via in-clause", () => {
    expect(src).toMatch(
      /\.from\("task_criterion_weights"\)[\s\S]*?\.in\("task_id",\s*taskIds\)/
    );
  });

  it("denormalises task_lesson_links via in-clause", () => {
    expect(src).toMatch(
      /\.from\("task_lesson_links"\)[\s\S]*?\.in\("task_id",\s*taskIds\)/
    );
  });

  it("groups children client-side via Map (avoids PostgREST embed quirks)", () => {
    expect(src).toContain("weightsByTask");
    expect(src).toContain("linksByTask");
    expect(src).toMatch(/new Map<string,/);
  });
});

describe("/api/teacher/tasks — POST", () => {
  it("requires authentication via requireTeacherAuth", () => {
    expect(src).toMatch(/export async function POST/);
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("requireTeacherAuth(request)");
  });

  it("validates body via validateCreateTaskInput before any DB write", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    const validateIdx = postBody.indexOf("validateCreateTaskInput");
    const insertIdx = postBody.indexOf('.from("assessment_tasks")\n    .insert');
    expect(validateIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(validateIdx);
  });

  it("returns 400 with details on validation failure", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Validation failed");
    expect(postBody).toContain("details: validation.errors");
  });

  it("returns 400 on invalid JSON body", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Invalid JSON");
  });

  it("verifies teacher access to the unit before any DB write", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    const verifyIdx = postBody.indexOf("verifyTeacherHasUnit");
    const insertIdx = postBody.indexOf('.from("assessment_tasks")\n    .insert');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(insertIdx).toBeGreaterThan(verifyIdx);
  });

  it("looks up teachers.school_id (Lesson #72 — teachers.id IS auth.users.id 1:1)", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toMatch(/\.from\("teachers"\)\s*\.select\("school_id"\)/);
    expect(postBody).toContain('.eq("id", auth.teacherId)');
  });

  it("returns 400 if teacher has no school_id (orphan-teacher guard)", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("Teacher has no school_id");
  });

  it("inserts assessment_tasks with school_id from teacher row", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain("school_id: teacherRow.school_id");
    expect(postBody).toContain("created_by: auth.teacherId");
  });

  it("writes task_criterion_weights for each criterion (TG.0C — default weight 100)", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toContain('.from("task_criterion_weights")');
    expect(postBody).toContain("weight: c.weight ?? 100");
  });

  it("cleans up the parent assessment_tasks row if criterion-weight write fails", () => {
    // Verify the cleanup is wired — search for the delete-by-id pattern after the weights write
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    const weightErrIdx = postBody.indexOf("weightErr");
    const cleanupIdx = postBody.indexOf(
      '.from("assessment_tasks").delete().eq("id", taskRow.id)'
    );
    expect(weightErrIdx).toBeGreaterThan(0);
    expect(cleanupIdx).toBeGreaterThan(weightErrIdx);
  });

  it("optionally writes task_lesson_links if linked_pages provided", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toMatch(
      /input\.linked_pages\s*&&\s*input\.linked_pages\.length\s*>\s*0/
    );
    expect(postBody).toContain('.from("task_lesson_links")');
  });

  it("cleans up parent + cascade-deletes weights if lesson-links write fails", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    // Cleanup happens BEFORE the error response — slice the link-error branch
    // and verify it includes the delete call before the 500 response.
    const linkBranchStart = postBody.indexOf("if (linkErr)");
    const linkBranchEnd = postBody.indexOf(
      "Failed to write lesson links",
      linkBranchStart
    );
    expect(linkBranchStart).toBeGreaterThan(0);
    const branchBody = postBody.slice(linkBranchStart, linkBranchEnd);
    expect(branchBody).toContain(
      '.from("assessment_tasks").delete().eq("id", taskRow.id)'
    );
  });

  it("returns 201 with the denormalised task on success", () => {
    const postStart = src.indexOf("export async function POST");
    const postBody = src.slice(postStart);
    expect(postBody).toMatch(/status:\s*201/);
    expect(postBody).toContain("criteria: input.criteria.map");
    expect(postBody).toContain("linked_pages: input.linked_pages ?? []");
  });
});

describe("/api/teacher/tasks — module hygiene", () => {
  it("imports validators from src/lib/tasks/validators (not zod)", () => {
    expect(src).toContain('from "@/lib/tasks/validators"');
    expect(src).not.toMatch(/from\s+["']zod["']/);
  });

  it("imports AssessmentTask type from src/lib/tasks/types", () => {
    expect(src).toContain('from "@/lib/tasks/types"');
  });

  it("uses createAdminClient (service role) for DB writes", () => {
    expect(src).toContain("createAdminClient()");
  });

  it("does not include the user_id column from teachers (Lesson #72)", () => {
    expect(src).not.toMatch(/\.from\("teachers"\)[\s\S]{0,80}user_id/);
  });
});
