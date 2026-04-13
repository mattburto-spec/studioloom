// Content Safety & Moderation Types — Phase 5
// Separate from src/lib/safety/ (Safety Badges) and src/lib/ingestion/moderate.ts (ingestion moderation)

export type ModerationStatus = 'clean' | 'pending' | 'flagged' | 'blocked';

export type FlagType =
  | 'profanity'
  | 'bullying'
  | 'self_harm_risk'
  | 'sexual'
  | 'violence'
  | 'pii'
  | 'other';

export type Severity = 'info' | 'warning' | 'critical';

export type ContentSource =
  | 'student_progress'
  | 'tool_session'
  | 'gallery_post'
  | 'peer_review'
  | 'quest_evidence'
  | 'quest_sharing'
  | 'portfolio'
  | 'upload_image';

export type ModerationLayer = 'client_text' | 'client_image' | 'server_haiku';

export interface ModerationFlag {
  type: FlagType;
  severity: Severity;
  confidence: number; // 0-1
  lang?: 'en' | 'zh' | 'other';
  detail?: string;
}

export interface ModerationResult {
  ok: boolean;
  status: ModerationStatus;
  flags: ModerationFlag[];
  layer: ModerationLayer;
  contentHash?: string;
}

export interface ModerationContext {
  classId: string;
  studentId: string;
  source: ContentSource;
  lang?: 'en' | 'zh' | 'other';
}

// Severity → action map (used by server moderation in 5D)
export const SEVERITY_ACTIONS: Record<Severity, {
  status: ModerationStatus;
  actions: string[];
}> = {
  info: { status: 'clean', actions: ['log'] },
  warning: { status: 'flagged', actions: ['notify_teacher', 'log'] },
  critical: { status: 'blocked', actions: ['notify_teacher', 'block', 'log'] },
};

// All valid values as const arrays — used by tests for cross-referencing migration SQL
// and by runtime validation in later sub-tasks (5D, 5E)
export const ALL_MODERATION_STATUSES: ModerationStatus[] = ['clean', 'pending', 'flagged', 'blocked'];
export const ALL_FLAG_TYPES: FlagType[] = ['profanity', 'bullying', 'self_harm_risk', 'sexual', 'violence', 'pii', 'other'];
export const ALL_SEVERITIES: Severity[] = ['info', 'warning', 'critical'];
export const ALL_CONTENT_SOURCES: ContentSource[] = ['student_progress', 'tool_session', 'gallery_post', 'peer_review', 'quest_evidence', 'quest_sharing', 'portfolio', 'upload_image'];
export const ALL_MODERATION_LAYERS: ModerationLayer[] = ['client_text', 'client_image', 'server_haiku'];
