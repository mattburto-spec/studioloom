/**
 * Admin types — cost_rollups, bug_reports, admin_settings, admin_audit_log
 * Mirrors migrations 075/076/077/079 exactly.
 */

// ── Cost Rollups (migration 075) ───────────────────────────

export type CostCategory =
  | "ingestion"
  | "generation"
  | "student_api"
  | "teacher_api";

export type CostPeriod = "day" | "week" | "month";

export interface CostRollup {
  id: string;
  teacher_id: string;
  category: CostCategory;
  period: CostPeriod;
  period_start: string; // DATE as ISO string
  cost_usd: number;
  call_count: number;
  token_count: number;
  rolled_up_at: string; // TIMESTAMPTZ as ISO string
}

// ── Bug Reports (migration 076) ────────────────────────────

export type BugReportCategory =
  | "broken"
  | "visual"
  | "confused"
  | "feature_request";

export type BugReportStatus =
  | "new"
  | "investigating"
  | "fixed"
  | "closed";

export type ReporterRole = "teacher" | "student" | "admin";

export interface BugReport {
  id: string;
  reporter_id: string;
  reporter_role: ReporterRole;
  class_id: string | null;
  category: BugReportCategory;
  description: string;
  screenshot_url: string | null;
  page_url: string | null;
  console_errors: unknown[];
  client_context: Record<string, unknown> | null;
  status: BugReportStatus;
  admin_notes: string | null;
  response: string | null;
  created_at: string;
  updated_at: string;
}

// ── Admin Settings (migration 077) ─────────────────────────

export enum AdminSettingKey {
  STAGE_ENABLED = "pipeline.stage_enabled",
  COST_CEILING_PER_RUN = "pipeline.cost_ceiling_per_run_usd",
  COST_CEILING_PER_DAY = "pipeline.cost_ceiling_per_day_usd",
  MODEL_OVERRIDE = "pipeline.model_override",
  STARTER_PATTERNS_ENABLED = "pipeline.starter_patterns_enabled",
}

export interface AdminSetting {
  id: string;
  key: string;
  value: unknown; // JSONB — shape varies per key
  updated_by: string | null;
  updated_at: string;
}

// ── Admin Audit Log (migration 079) ──────────────────────────

export type AdminAuditAction = "update_setting";

export interface AdminAuditLogEntry {
  id: string;
  actor_id: string | null;
  action: AdminAuditAction;
  target_table: string | null;
  target_key: string | null;
  old_value: unknown;
  new_value: unknown;
  created_at: string;
}
