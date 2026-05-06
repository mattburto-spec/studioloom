/**
 * AG.4.1 — typed client for /api/teacher/student-attention.
 *
 * Mirrors the kanban/timeline client wrappers. No Supabase imports —
 * route is the auth boundary; this is just a typed fetch helper for the
 * Attention-Rotation Panel component.
 */

import type { AttentionPanelData } from "./types";

class AttentionApiError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AttentionApiError";
    this.status = status;
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
    throw new AttentionApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export async function loadAttentionPanel(
  unitId: string,
  classId: string
): Promise<AttentionPanelData> {
  const res = await fetch(
    `/api/teacher/student-attention?unitId=${encodeURIComponent(
      unitId
    )}&classId=${encodeURIComponent(classId)}`,
    { method: "GET" }
  );
  return parseOrThrow<AttentionPanelData>(res);
}

export { AttentionApiError };
