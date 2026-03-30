/** Dashboard data returned by GET /api/teacher/dashboard */
export interface DashboardData {
  classes: DashboardClass[];
  stuckStudents: StuckStudent[];
  recentActivity: ActivityEvent[];
  /** Students with completed pages that may need teacher review/grading */
  unmarkedWork?: UnmarkedWorkItem[];
  /** Smart priority-sorted insights — mixed alert types surfaced by urgency */
  insights?: DashboardInsight[];
}

export interface DashboardClass {
  id: string;
  name: string;
  code: string;
  framework?: string;
  studentCount: number;
  units: DashboardUnit[];
}

export interface DashboardUnit {
  unitId: string;
  unitTitle: string;
  totalPages: number;
  /** Total completed (student × page) cells across all students */
  completedCount: number;
  inProgressCount: number;
  notStartedCount: number;
  /** Overall % of all (student × page) cells that are complete */
  completionPct: number;
  /** Number of students with Open Studio unlocked for this unit */
  openStudioCount?: number;
  /** Whether New Metrics is enabled for this unit */
  nmEnabled?: boolean;
  /** Number of required safety badges for this unit */
  badgeRequirementCount?: number;
  /** Whether this class-unit has forked content (content_data IS NOT NULL) */
  isForked?: boolean;
  /** Unit type: design, service, pp, inquiry (from units.unit_type) */
  unitType?: string;
  /** Custom thumbnail URL (from units.thumbnail_url — gallery pick or upload) */
  thumbnailUrl?: string;
}

export interface StuckStudent {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  lastPageId: string;
  /** ISO timestamp of last activity */
  lastActivity: string;
  hoursSinceUpdate: number;
}

export interface ActivityEvent {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  pageId: string;
  status: string;
  /** ISO timestamp */
  updatedAt: string;
}

/** Smart insight types surfaced on the teacher dashboard */
export type InsightType =
  | "integrity_flag"      // Completed page with suspicious writing behaviour
  | "stale_unmarked"      // Completed work sitting unreviewed for 7+ days
  | "unit_complete"       // Student finished all pages in a unit
  | "stuck_student"       // In-progress for 48+ hours — might need help
  | "recent_completion"   // Fresh completed work to review
  | "integrity_warning";  // Moderate integrity concern (40-69 score range)

export interface DashboardInsight {
  type: InsightType;
  /** 0-100 priority score — higher = more urgent */
  priority: number;
  /** Short title e.g. "Possible copy-paste" */
  title: string;
  /** Detail line e.g. "test · IGCSE TEST · Lesson 2" */
  subtitle: string;
  /** Where to navigate when clicked */
  href: string;
  /** Student name for the avatar */
  studentName: string;
  /** Accent color for the indicator */
  accentColor: string;
  /** ISO timestamp for recency display */
  timestamp: string;
}

/** A student × unit pair with completed work that may need teacher review */
export interface UnmarkedWorkItem {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  unitId: string;
  unitTitle: string;
  /** Number of completed pages for this student in this unit */
  completedPages: number;
  /** Total pages in the unit */
  totalPages: number;
  /** ISO timestamp of most recent completion */
  lastCompletedAt: string;
  /** Whether any completed page has integrity data that needs review */
  hasIntegrityFlags?: boolean;
}
