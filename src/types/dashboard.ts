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
