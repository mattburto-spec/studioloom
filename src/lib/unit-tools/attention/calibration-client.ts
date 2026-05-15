/**
 * AG.4 follow-up — calibration mini-view data fetcher.
 *
 * Wraps the existing /api/teacher/nm-observation endpoints so the
 * attention panel can open a row and immediately show:
 *   - The active competency + its element list (from nm_config)
 *   - The student's most-recent self-rating per element
 *   - The student's most-recent teacher-observation per element (if any)
 *
 * Same shape as the kanban/timeline client modules — typed wrapper, no
 * Supabase imports, the route is the auth boundary.
 */

import {
  AGENCY_ELEMENTS,
  getElementsForCompetency,
  type NMElement,
} from "@/lib/nm/constants";

/** One historical entry — student or teacher, oldest first. */
export interface CalibrationHistoryEntry {
  rating: number;
  comment: string | null;
  createdAt: string;
  /**
   * 'observation' for ad-hoc teacher ratings (Teaching Mode, NM Results
   * inline), 'calibration' for rows written by the calibration mini-view
   * itself. Missing on rows written before the event_type migration.
   */
  eventType?: "observation" | "calibration";
}

/** One element's pre-loaded ratings — drives the mini-view per-element row. */
export interface ElementCalibrationState {
  element: NMElement;
  /** Student's latest self-rating for this element (1..3) or null. Shown as
   *  context above the editable area; full history surfaces below. */
  studentRating: number | null;
  studentComment: string | null;
  studentRatedAt: string | null;
  /**
   * 15 May 2026 — full history of teacher observations on this element,
   * newest first. Includes the most recent entry. The calibration form
   * itself starts fresh every open (no pre-fill from past observations);
   * any prior teacher input is read-only context in the history below.
   */
  teacherHistory: CalibrationHistoryEntry[];
  /** Full history of student self-ratings on this element, newest first. */
  studentHistory: CalibrationHistoryEntry[];
}

export interface CalibrationLoad {
  studentId: string;
  studentDisplayName: string;
  unitId: string;
  classId: string;
  /** Active competency ID for this class+unit (from nm_config). */
  competencyId: string;
  /** All elements teachers can rate against. */
  elements: ElementCalibrationState[];
}

class CalibrationApiError extends Error {
  public readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CalibrationApiError";
    this.status = status;
  }
}

interface NmObservationStudentResult {
  student: { id: string; display_name: string };
  assessments: Array<{
    element: string;
    rating: number;
    source: "student_self" | "teacher_observation";
    comment: string | null;
    created_at: string;
    competency: string;
    event_type?: "observation" | "calibration";
  }>;
}

interface NmObservationGetResponse {
  data: NmObservationStudentResult[];
  /** Class+unit NM settings — drives which elements the teacher has
   *  opted to track this semester. When present, calibration filters its
   *  element list to this subset. */
  nmConfig?: {
    competencies?: string[];
    elements?: string[];
  } | null;
}

/**
 * Load one student's calibration state. Uses the existing GET
 * /api/teacher/nm-observation endpoint (returns the whole class) and
 * filters down to the requested studentId — wasteful for large classes
 * but the agency unit's class size is ~9, so the cost is negligible
 * and avoids surfacing a new endpoint.
 */
export async function loadCalibrationForStudent(args: {
  unitId: string;
  classId: string;
  studentId: string;
}): Promise<CalibrationLoad> {
  const { unitId, classId, studentId } = args;

  const url = `/api/teacher/nm-observation?unitId=${encodeURIComponent(
    unitId
  )}&classId=${encodeURIComponent(classId)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const obj = (body || {}) as Record<string, unknown>;
    throw new CalibrationApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`
    );
  }

  const payload = (await res.json()) as NmObservationGetResponse;
  const studentEntry = payload.data.find((d) => d.student.id === studentId);

  if (!studentEntry) {
    throw new CalibrationApiError(
      404,
      "Student not found in this class — refresh the panel."
    );
  }

  // Pick the latest assessment per (element, source) pair.
  const latest = pickLatestPerElementAndSource(studentEntry.assessments);
  // Round 9 — also build a per-(element, source) FULL history sorted
  // newest-first, with the latest entry stripped out (already shown as
  // the active rating).
  const history = groupHistoryByElementAndSource(studentEntry.assessments);

  // Derive the active competency: prefer nm_config (teacher's explicit
  // setting), fall back to a rated row, then default to agency_in_learning.
  const firstRow = studentEntry.assessments[0];
  const competencyId =
    payload.nmConfig?.competencies?.[0] ||
    firstRow?.competency ||
    "agency_in_learning";
  const lookupElements = getElementsForCompetency(competencyId);
  const baseElements: NMElement[] =
    lookupElements && lookupElements.length > 0 ? lookupElements : AGENCY_ELEMENTS;
  // Filter to the subset the teacher opted to track on the NM settings
  // panel for this class+unit. Empty / missing nmConfig.elements ⇒ show
  // them all (preserves legacy behaviour for units pre-dating per-unit
  // element selection).
  const trackedSet = new Set(payload.nmConfig?.elements ?? []);
  const elements: NMElement[] =
    trackedSet.size > 0
      ? baseElements.filter((el) => trackedSet.has(el.id))
      : baseElements;

  return {
    studentId,
    studentDisplayName: studentEntry.student.display_name,
    unitId,
    classId,
    competencyId,
    elements: elements.map((el) => {
      const self = latest.get(`${el.id}::student_self`);
      return {
        element: el,
        studentRating: self?.rating ?? null,
        studentComment: self?.comment ?? null,
        studentRatedAt: self?.created_at ?? null,
        // Full histories, newest-first. Includes the most recent entry —
        // the form starts fresh on every open, so past entries (teacher
        // + student) are read-only context shown below the editable area.
        teacherHistory: history.get(`${el.id}::teacher_observation`) ?? [],
        studentHistory: history.get(`${el.id}::student_self`) ?? [],
      };
    }),
  };
}

/**
 * Group all assessments by `${element}::${source}` and return a
 * newest-first sorted history per group. Pure helper — exported for
 * testing.
 */
export function groupHistoryByElementAndSource(
  rows: NmObservationStudentResult["assessments"]
): Map<string, CalibrationHistoryEntry[]> {
  const result = new Map<string, CalibrationHistoryEntry[]>();
  for (const row of rows) {
    const key = `${row.element}::${row.source}`;
    if (!result.has(key)) result.set(key, []);
    result.get(key)!.push({
      rating: row.rating,
      comment: row.comment,
      createdAt: row.created_at,
      eventType: row.event_type,
    });
  }
  // Sort each group descending by createdAt (newest first)
  for (const list of result.values()) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  return result;
}

/**
 * Group assessments by `${element}::${source}` and keep the latest
 * (max created_at) per group. Pure helper — exported for testing.
 */
export function pickLatestPerElementAndSource(
  rows: NmObservationStudentResult["assessments"]
): Map<
  string,
  NmObservationStudentResult["assessments"][number]
> {
  const result = new Map<
    string,
    NmObservationStudentResult["assessments"][number]
  >();
  for (const row of rows) {
    const key = `${row.element}::${row.source}`;
    const existing = result.get(key);
    if (!existing || existing.created_at < row.created_at) {
      result.set(key, row);
    }
  }
  return result;
}

/**
 * Submit a calibration session (one POST per Save click). Each entry
 * becomes a `teacher_observation` row in competency_assessments. Empty
 * ratings are skipped — the teacher may rate only some elements.
 */
export async function saveCalibration(args: {
  unitId: string;
  classId: string;
  studentId: string;
  pageId?: string;
  assessments: Array<{
    element: string;
    rating: number;
    comment?: string;
  }>;
}): Promise<{ count: number }> {
  if (args.assessments.length === 0) {
    return { count: 0 };
  }

  const res = await fetch("/api/teacher/nm-observation", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      studentId: args.studentId,
      unitId: args.unitId,
      classId: args.classId,
      pageId: args.pageId,
      eventType: "calibration",
      assessments: args.assessments,
    }),
  });

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    const obj = (body || {}) as Record<string, unknown>;
    throw new CalibrationApiError(
      res.status,
      (obj.error as string) || `HTTP ${res.status}`
    );
  }

  const payload = (await res.json()) as { success: boolean; count: number };
  return { count: payload.count };
}

export { CalibrationApiError };
