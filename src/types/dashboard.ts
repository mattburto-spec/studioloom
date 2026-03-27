/** Dashboard data returned by GET /api/teacher/dashboard */
export interface DashboardData {
  classes: DashboardClass[];
  stuckStudents: StuckStudent[];
  recentActivity: ActivityEvent[];
}

export interface DashboardClass {
  id: string;
  name: string;
  code: string;
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
