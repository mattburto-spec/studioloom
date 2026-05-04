/**
 * Calendar read-precedence helper — Phase 4.8.
 *
 * Per brief §4.8: callers reading calendar data for a class lesson
 * should follow this lookup order:
 *
 *   1. class_units.schedule_overrides_jsonb  (per-class overrides)
 *   2. schools.academic_calendar_jsonb       (NEW — bubbled-up school calendar)
 *   3. school_calendar_terms WHERE teacher_id = ?  (LEGACY fallback)
 *
 * Phase 6 cutover will retire (3) once all schools have populated (2);
 * for now both coexist so existing teachers don't lose their calendars.
 *
 * This module returns the FIRST non-null source. Callers can also
 * resolve the source explicitly via `resolveCalendarSource` to render
 * UI hints like "from school" vs "your personal calendar."
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type CalendarTerm = {
  term_name: string;
  term_order: number;
  academic_year: string;
  start_date: string | null;
  end_date: string | null;
};

export type CalendarSource = "class_override" | "school" | "teacher_legacy" | "none";

export type ResolvedCalendar = {
  source: CalendarSource;
  terms: CalendarTerm[];
  // Optional: per-class lesson schedule overrides (when source = class_override)
  scheduleOverrides?: Record<string, unknown>;
};

export type ResolveCalendarArgs = {
  /** Class id — read class_units overrides first */
  classId?: string | null;
  /** School id — read schools.academic_calendar_jsonb second */
  schoolId?: string | null;
  /** Teacher id — fallback read of school_calendar_terms WHERE teacher_id = ? */
  teacherId?: string | null;
  supabase?: SupabaseClient;
};

/**
 * Resolves the calendar a class should display, walking the 3-layer
 * precedence chain. Returns `{source: 'none', terms: []}` if no layer
 * yields data.
 *
 * Note: class_units.schedule_overrides_jsonb is per-CLASS-AND-UNIT
 * scheduling state; the brief mentions it as the highest-precedence
 * layer for calendar reads but the shape is more about individual
 * lesson dates than term structure. For now this helper consults it
 * only for `scheduleOverrides` payload — the term list itself comes
 * from layer 2 or 3.
 */
export async function resolveCalendar(
  args: ResolveCalendarArgs
): Promise<ResolvedCalendar> {
  const db = args.supabase ?? createAdminClient();

  // Layer 1: class_units schedule_overrides_jsonb (per-lesson overrides;
  // doesn't replace term structure, just records "skip date" / "extra
  // session" for individual lessons). We surface it alongside whatever
  // term structure layers 2/3 provide.
  let scheduleOverrides: Record<string, unknown> | undefined;
  if (args.classId) {
    const { data } = await db
      .from("class_units")
      .select("schedule_overrides_jsonb")
      .eq("class_id", args.classId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data && data.schedule_overrides_jsonb) {
      scheduleOverrides = data.schedule_overrides_jsonb as Record<
        string,
        unknown
      >;
    }
  }

  // Layer 2: schools.academic_calendar_jsonb (bubbled-up school calendar)
  if (args.schoolId) {
    const { data } = await db
      .from("schools")
      .select("academic_calendar_jsonb")
      .eq("id", args.schoolId)
      .maybeSingle();
    if (data?.academic_calendar_jsonb) {
      const terms = data.academic_calendar_jsonb as CalendarTerm[];
      if (Array.isArray(terms) && terms.length > 0) {
        return {
          source: "school",
          terms,
          scheduleOverrides,
        };
      }
    }
  }

  // Layer 3: school_calendar_terms WHERE teacher_id = ? (legacy fallback)
  if (args.teacherId) {
    const { data, error } = await db
      .from("school_calendar_terms")
      .select("term_name, term_order, academic_year, start_date, end_date")
      .eq("teacher_id", args.teacherId)
      .order("term_order", { ascending: true });
    if (!error && data && data.length > 0) {
      return {
        source: "teacher_legacy",
        terms: data as CalendarTerm[],
        scheduleOverrides,
      };
    }
  }

  return {
    source: scheduleOverrides ? "class_override" : "none",
    terms: [],
    scheduleOverrides,
  };
}

/**
 * Convenience: returns just the term list for the school (layer 2),
 * with no fallback. Used by settings UI to show "what's on the school
 * calendar today" distinct from any teacher fallback.
 */
export async function getSchoolCalendar(
  schoolId: string,
  supabase?: SupabaseClient
): Promise<CalendarTerm[]> {
  const db = supabase ?? createAdminClient();
  const { data } = await db
    .from("schools")
    .select("academic_calendar_jsonb")
    .eq("id", schoolId)
    .maybeSingle();
  const terms = data?.academic_calendar_jsonb;
  return Array.isArray(terms) ? (terms as CalendarTerm[]) : [];
}
