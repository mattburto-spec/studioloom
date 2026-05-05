/**
 * TG.0C.1 — typed fetch wrappers for the Tasks panel + downstream consumers
 *
 * Client-only — no Supabase imports. Calls /api/teacher/tasks endpoints.
 *
 * Each function throws on non-2xx responses; the panel catches and surfaces.
 */

import type {
  AssessmentTask,
  CreateTaskInput,
  UpdateTaskInput,
} from "./types";

class TaskApiError extends Error {
  public readonly status: number;
  public readonly details: string[];
  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "TaskApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const obj = (body || {}) as Record<string, unknown>;
    const message = (obj.error as string) || `HTTP ${res.status}`;
    const details = Array.isArray(obj.details)
      ? (obj.details as string[])
      : [];
    throw new TaskApiError(res.status, message, details);
  }
  return res.json() as Promise<T>;
}

// ─── List ────────────────────────────────────────────────────────────────────

export async function listTasksForUnit(
  unitId: string,
  init?: RequestInit
): Promise<AssessmentTask[]> {
  const res = await fetch(
    `/api/teacher/tasks?unit_id=${encodeURIComponent(unitId)}`,
    { ...init, method: "GET" }
  );
  const data = await parseOrThrow<{ tasks: AssessmentTask[] }>(res);
  return data.tasks;
}

// ─── Create ──────────────────────────────────────────────────────────────────

export async function createTask(
  input: CreateTaskInput
): Promise<AssessmentTask> {
  const res = await fetch("/api/teacher/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseOrThrow<{ task: AssessmentTask }>(res);
  return data.task;
}

/**
 * Convenience — Quick-Check formative task from the inline-row form.
 * Wraps createTask with task_type='formative' + sensible defaults.
 */
export async function createQuickCheck(args: {
  unit_id: string;
  class_id?: string | null;
  title: string;
  criteria: CreateTaskInput["criteria"];
  due_date?: string;
  linked_pages?: Array<{ unit_id: string; page_id: string }>;
}): Promise<AssessmentTask> {
  return createTask({
    unit_id: args.unit_id,
    class_id: args.class_id ?? null,
    title: args.title,
    task_type: "formative",
    status: "draft",
    config: {
      criteria: args.criteria.map((c) => c.key),
      due_date: args.due_date,
      linked_pages: args.linked_pages,
    },
    criteria: args.criteria,
    linked_pages: args.linked_pages,
  });
}

// ─── Update ──────────────────────────────────────────────────────────────────

export async function updateTask(
  taskId: string,
  patch: UpdateTaskInput
): Promise<AssessmentTask> {
  const res = await fetch(`/api/teacher/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  const data = await parseOrThrow<{ task: AssessmentTask }>(res);
  return data.task;
}

// ─── Delete ──────────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`/api/teacher/tasks/${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    const obj = (body || {}) as Record<string, unknown>;
    throw new TaskApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`,
      Array.isArray(obj.details) ? (obj.details as string[]) : []
    );
  }
}

export { TaskApiError };
