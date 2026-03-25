// Quest Journey System — Core Types
// Pure types, no runtime code

export type QuestPhase = 'not_started' | 'discovery' | 'planning' | 'working' | 'sharing' | 'completed';

export type MentorId = 'kit' | 'sage' | 'river' | 'spark' | 'haven';

export type HelpIntensity = 'explorer' | 'guided' | 'supported' | 'auto';

export type HealthLevel = 'green' | 'amber' | 'red';

export type MilestoneStatus = 'upcoming' | 'active' | 'completed' | 'skipped' | 'overdue';

export type MilestoneSource = 'student' | 'ai_suggested' | 'template' | 'teacher';

export type EvidenceType = 'photo' | 'voice' | 'text' | 'file' | 'link' | 'reflection' | 'tool_session' | 'ai_conversation';

export type QuestInteractionType =
  | 'discovery_step'
  | 'check_in'
  | 'help_request'
  | 'drift_check'
  | 'documentation_nudge'
  | 'alignment_check'
  | 'milestone_review'
  | 'celebration'
  | 'contract_coaching'
  | 'planning_help';

export interface HealthScore {
  momentum: HealthLevel;
  engagement: HealthLevel;
  quality: HealthLevel;
  self_awareness: HealthLevel;
  last_computed_at: string | null;
  check_in_interval_minutes: number;
}

export interface DiscoveryProfile {
  strengths: string[];
  interests: string[];
  needs: string[];
  archetype: string;
  project_idea: string;
  narrowing_notes: string;
  discovery_completed_at: string;
}

export interface StudentContract {
  what: string;
  who_for: string;
  done_looks_like: string;
  milestones_summary: string;
  help_needed: string;
  success_criteria: string;
  confirmed_at: string;  // confirmation button timestamp (not "signed")
}

export interface QuestJourney {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string | null;
  framework_id: string;
  mentor_id: MentorId | null;
  phase: QuestPhase;
  phase_entered_at: string;
  discovery_profile: DiscoveryProfile | null;
  contract: StudentContract | null;
  help_intensity: HelpIntensity;
  health_score: HealthScore;
  total_sessions: number;
  total_evidence_count: number;
  sessions_remaining: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface QuestMilestone {
  id: string;
  journey_id: string;
  title: string;
  description: string | null;
  phase: QuestPhase;
  framework_phase_id: string | null;
  sort_order: number;
  specific: string | null;
  measurable: string | null;
  target_date: string | null;
  status: MilestoneStatus;
  completed_at: string | null;
  completion_note: string | null;
  teacher_note: string | null;
  teacher_adjusted_date: string | null;
  approved_by_teacher: boolean;
  approved_at: string | null;
  source: MilestoneSource;
}

export interface EvidenceAnalysis {
  quality_signal: HealthLevel;
  summary: string;
  tags: string[];
  complexity_score: number;
}

export interface QuestEvidence {
  id: string;
  journey_id: string;
  milestone_id: string | null;
  type: EvidenceType;
  content: string | null;
  file_url: string | null;
  file_type: string | null;
  thumbnail_url: string | null;
  ai_analysis: EvidenceAnalysis | null;
  approved_by_teacher: boolean;
  approved_at: string | null;
  teacher_feedback: string | null;
  phase: QuestPhase;
  framework_phase_id: string | null;
  created_at: string;
}

export interface QuestMentorInteraction {
  id: string;
  journey_id: string;
  interaction_type: QuestInteractionType;
  phase: QuestPhase;
  mentor_id: string;
  student_message: string | null;
  mentor_response: string | null;
  structured_data: Record<string, unknown> | null;
  student_effort_level: 'low' | 'medium' | 'high' | null;
  created_at: string;
}

/** Phase display order (for rendering, sorting) */
export const PHASE_ORDER: QuestPhase[] = ['not_started', 'discovery', 'planning', 'working', 'sharing', 'completed'];

/** Phase display names */
export const PHASE_LABELS: Record<QuestPhase, string> = {
  not_started: 'Not Started',
  discovery: 'Discovery',
  planning: 'Planning',
  working: 'Working',
  sharing: 'Sharing',
  completed: 'Completed',
};

/** Default health score for new journeys */
export const DEFAULT_HEALTH_SCORE: HealthScore = {
  momentum: 'green',
  engagement: 'green',
  quality: 'green',
  self_awareness: 'green',
  last_computed_at: null,
  check_in_interval_minutes: 15,
};
