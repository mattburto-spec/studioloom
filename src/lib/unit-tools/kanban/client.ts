/**
 * AG.2.3a — typed client for /api/student/kanban
 *
 * Client-only — no Supabase imports. Used by the upcoming KanbanBoard
 * component (AG.2.3b) to fetch + persist state. The reducer runs in
 * memory; this layer just persists snapshots.
 */

import type { KanbanState } from "./types";

export interface KanbanFetchResult {
  kanban: KanbanState;
  counts: {
    backlog_count: number;
    this_class_count: number;
    doing_count: number;
    done_count: number;
  };
}

class KanbanApiError extends Error {
  public readonly status: number;
  public readonly details: string[];
  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "KanbanApiError";
    this.status = status;
    this.details = details;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const obj = (body || {}) as Record<string, unknown>;
    throw new KanbanApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`,
      Array.isArray(obj.details) ? (obj.details as string[]) : []
    );
  }
  return res.json() as Promise<T>;
}

export async function loadKanbanState(unitId: string): Promise<KanbanFetchResult> {
  const res = await fetch(
    `/api/student/kanban?unitId=${encodeURIComponent(unitId)}`,
    { method: "GET" }
  );
  return parseOrThrow<KanbanFetchResult>(res);
}

export async function saveKanbanState(
  unitId: string,
  state: KanbanState
): Promise<KanbanFetchResult> {
  const res = await fetch("/api/student/kanban", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unitId, state }),
  });
  return parseOrThrow<KanbanFetchResult>(res);
}

/**
 * AG.2.4 — append a single card to the student's Kanban backlog for a unit.
 *
 * Used by the journal "Next" prompt auto-create flow: when a student
 * saves a structured-prompts journal with a non-empty `next` response,
 * we drop the next-move into the backlog as a card with
 * source='journal_next'.
 *
 * Fire-and-forget: read current state, create card via reducer, save back.
 * Idempotent under concurrent calls IF a single client is the only writer
 * (class of 9, single-student-per-board — safe).
 *
 * Returns the post-save result OR throws KanbanApiError if the read or
 * write fails (caller should fire-and-forget; toast on error optional).
 */
export async function appendBacklogCard(
  unitId: string,
  args: {
    title: string;
    lessonLink?: { unit_id: string; page_id: string; section_index: number };
  }
): Promise<KanbanFetchResult> {
  // Lazy import to avoid pulling reducer into the client lib's surface
  // when callers only need load/save. Keeps the module dependency graph
  // shallow.
  const { kanbanReducer } = await import("./reducer");
  const current = await loadKanbanState(unitId);
  const next = kanbanReducer(current.kanban, {
    type: "createCard",
    title: args.title,
    status: "backlog",
    source: "journal_next",
    lessonLink: args.lessonLink ?? null,
  });
  return saveKanbanState(unitId, next);
}

export { KanbanApiError };
