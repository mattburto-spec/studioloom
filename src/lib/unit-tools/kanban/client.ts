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

export { KanbanApiError };
