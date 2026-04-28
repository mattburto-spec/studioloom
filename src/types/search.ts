/**
 * Shared types for the topnav command palette.
 *
 * Used by both /api/teacher/search and /api/student/search, and the
 * <CommandPalette> component that renders results from either.
 */

export interface ClassHit {
  type: "class";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface UnitHit {
  type: "unit";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface StudentHit {
  type: "student";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
}

export interface LessonHit {
  type: "lesson";
  /** Composite id for React keys: `<unitId>:<pageId>`. */
  id: string;
  unitId: string;
  pageId: string;
  title: string;
  /** Parent unit title — gives the student "lesson X in Unit Y". */
  subtitle: string | null;
  href: string;
}

export type SearchHit = ClassHit | UnitHit | StudentHit | LessonHit;

export interface SearchResponse {
  query: string;
  classes: ClassHit[];
  units: UnitHit[];
  lessons: LessonHit[];
  students: StudentHit[];
}
