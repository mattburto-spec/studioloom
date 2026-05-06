/**
 * AG.3.3 — typed client for /api/student/timeline
 *
 * Mirrors AG.2 Kanban client. No Supabase imports.
 */

import type { TimelineState } from "./types";

export interface TimelineFetchResult {
  timeline: TimelineState;
  summary: {
    next_milestone_label: string | null;
    next_milestone_target_date: string | null;
    pending_count: number;
    done_count: number;
  };
}

class TimelineApiError extends Error {
  public readonly status: number;
  public readonly details: string[];
  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = "TimelineApiError";
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
    throw new TimelineApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`,
      Array.isArray(obj.details) ? (obj.details as string[]) : []
    );
  }
  return res.json() as Promise<T>;
}

export async function loadTimelineState(
  unitId: string
): Promise<TimelineFetchResult> {
  const res = await fetch(
    `/api/student/timeline?unitId=${encodeURIComponent(unitId)}`,
    { method: "GET" }
  );
  return parseOrThrow<TimelineFetchResult>(res);
}

export async function saveTimelineState(
  unitId: string,
  state: TimelineState
): Promise<TimelineFetchResult> {
  const res = await fetch("/api/student/timeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ unitId, state }),
  });
  return parseOrThrow<TimelineFetchResult>(res);
}

export { TimelineApiError };
