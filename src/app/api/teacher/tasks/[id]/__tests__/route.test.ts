/**
 * TG.0C.5 — source-static guards for /api/teacher/tasks/[id] (PATCH + DELETE).
 *
 * Same style as ../route.test.ts: file read + pattern assertions. Catches
 * auth chain regressions, validator wiring, replace-don't-diff approach,
 * cascade behaviour.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

describe("/api/teacher/tasks/[id] — PATCH", () => {
  it("requires authentication via requireTeacherAuth", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("requireTeacherAuth(request)");
  });

  it("returns 400 for missing task id (defensive — Next.js routes this so id is always present)", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("task id required");
  });

  it("validates body via validateUpdateTaskInput before any DB write", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    const validateIdx = patchBody.indexOf("validateUpdateTaskInput");
    const updateIdx = patchBody.indexOf(".update(updatePayload)");
    expect(validateIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(validateIdx);
  });

  it("returns 404 when task is not found", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain('"Task not found"');
    expect(patchBody).toContain("status: 404");
  });

  it("verifies teacher access via verifyTeacherHasUnit before write", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    const verifyIdx = patchBody.indexOf("verifyTeacherHasUnit");
    const updateIdx = patchBody.indexOf(".update(updatePayload)");
    expect(verifyIdx).toBeGreaterThan(0);
    expect(updateIdx).toBeGreaterThan(verifyIdx);
  });

  it("replaces criterion weights (DELETE old + INSERT new) when criteria patched", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("patch.criteria !== undefined");
    expect(patchBody).toMatch(
      /\.from\("task_criterion_weights"\)\s*\.delete\(\)\s*\.eq\("task_id",\s*taskId\)/
    );
    expect(patchBody).toContain('.from("task_criterion_weights")\n        .insert(weightRows)');
  });

  it("replaces lesson links (DELETE old + INSERT new) when linked_pages patched", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("patch.linked_pages !== undefined");
    expect(patchBody).toMatch(
      /\.from\("task_lesson_links"\)\s*\.delete\(\)\s*\.eq\("task_id",\s*taskId\)/
    );
  });

  it("only updates assessment_tasks columns that were patched (no full overwrite)", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("if (patch.title !== undefined)");
    expect(patchBody).toContain("if (patch.status !== undefined)");
    expect(patchBody).toContain("if (patch.config !== undefined)");
    expect(patchBody).toContain("Object.keys(updatePayload).length > 0");
  });

  it("re-fetches denormalised shape on success (one query each for weights + links)", () => {
    const patchStart = src.indexOf("export async function PATCH");
    const deleteStart = src.indexOf("export async function DELETE");
    const patchBody = src.slice(patchStart, deleteStart);
    expect(patchBody).toContain("Promise.all");
    expect(patchBody).toMatch(/criteria:\s*\(weightsResult\.data \?\? \[\]\)\.map/);
  });
});

describe("/api/teacher/tasks/[id] — DELETE", () => {
  it("requires authentication via requireTeacherAuth", () => {
    const deleteStart = src.indexOf("export async function DELETE");
    const deleteBody = src.slice(deleteStart);
    expect(deleteBody).toContain("requireTeacherAuth(request)");
  });

  it("returns 404 when task is not found", () => {
    const deleteStart = src.indexOf("export async function DELETE");
    const deleteBody = src.slice(deleteStart);
    expect(deleteBody).toContain('"Task not found"');
    expect(deleteBody).toContain("status: 404");
  });

  it("verifies teacher access before delete (when unit_id present)", () => {
    const deleteStart = src.indexOf("export async function DELETE");
    const deleteBody = src.slice(deleteStart);
    const verifyIdx = deleteBody.indexOf("verifyTeacherHasUnit");
    const deleteIdx = deleteBody.indexOf('.from("assessment_tasks")\n    .delete()');
    expect(verifyIdx).toBeGreaterThan(0);
    expect(deleteIdx).toBeGreaterThan(verifyIdx);
  });

  it("returns 204 No Content on success", () => {
    const deleteStart = src.indexOf("export async function DELETE");
    const deleteBody = src.slice(deleteStart);
    expect(deleteBody).toMatch(/new NextResponse\(null,\s*\{\s*status:\s*204\s*\}\)/);
  });

  it("relies on FK ON DELETE CASCADE for child rows (no explicit child delete)", () => {
    const deleteStart = src.indexOf("export async function DELETE");
    const deleteBody = src.slice(deleteStart);
    // Should NOT manually delete from task_criterion_weights or task_lesson_links —
    // the FK cascade handles them when the parent goes
    expect(deleteBody).not.toContain('.from("task_criterion_weights")\n      .delete()');
    expect(deleteBody).not.toContain('.from("task_lesson_links")\n      .delete()');
  });
});

describe("/api/teacher/tasks/[id] — module hygiene", () => {
  it("imports the typed RouteContext + awaits params (Next.js 15+)", () => {
    expect(src).toContain("interface RouteContext");
    expect(src).toContain("params: Promise<{ id: string }>");
    expect(src).toContain("await context.params");
  });

  it("imports validators from src/lib/tasks/validators", () => {
    expect(src).toContain('from "@/lib/tasks/validators"');
  });

  it("does not include the user_id column from teachers (Lesson #72)", () => {
    expect(src).not.toMatch(/\.from\("teachers"\)[\s\S]{0,80}user_id/);
  });
});
