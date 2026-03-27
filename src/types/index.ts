import type { EllLevel, CriterionKey } from "@/lib/constants";
import type { UnitType } from "@/lib/ai/unit-types";

export interface Teacher {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  name: string;
  code: string;
  created_at: string;
  // LMS integration (provider-agnostic)
  external_class_id: string | null;
  external_provider: string | null;
  last_synced_at: string | null;
}

export interface Student {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  class_id: string | null; // DEPRECATED — use class_students junction. Nullable since migration 041.
  author_teacher_id: string | null; // Teacher who owns this student record (migration 041)
  graduation_year: number | null; // Auto-calculated from year level. Stable anchor — never changes. (migration 043)
  ell_level: EllLevel;
  created_at: string;
  // LMS integration (provider-agnostic)
  external_id: string | null;
  external_provider: string | null;
  // Self-reported intake survey (migration 048)
  learning_profile: StudentLearningIntake | null;
  // Studio preferences — selected during onboarding (migration 050)
  mentor_id: "kit" | "sage" | "spark" | null;
  theme_id: "clean" | "bold" | "warm" | "dark" | null;
}

/** Self-reported intake survey data — collected once at first login.
 *  Research basis: docs/research/student-influence-factors.md
 *  6 questions covering the highest-impact measurable factors:
 *  - Languages (ELL scaffolding, peer grouping) — d=moderate
 *  - Countries (cultural framing, TCK strengths) — d=variable
 *  - Design confidence / self-efficacy — d=0.92 (highest effect size!)
 *  - Working style preference — collectivist/individualist signal (d=0.35)
 *  - Feedback preference — public/private channel (d=0.57 relationship quality)
 *  - Learning differences — optional UDL accommodation (ADHD, dyslexia, etc.)
 */
export interface StudentLearningIntake {
  // Step 1: Language background
  languages_at_home: string[];
  // Step 2: Cultural background
  countries_lived_in: string[];
  // Step 3: Design confidence (self-efficacy, d=0.92)
  design_confidence: 1 | 2 | 3 | 4 | 5;
  // Step 4: Working style preference
  working_style: "solo" | "partner" | "small_group";
  // Step 5: Feedback preference
  feedback_preference: "private" | "public";
  // Step 6: Learning differences (optional, never shared with peers)
  learning_differences: string[]; // e.g., ["adhd", "dyslexia"] — empty array if none/skipped
  // Metadata
  collected_at: string;
}

// --- Class-Student Enrollment (many-to-many, migration 041) ---

export interface ClassStudent {
  student_id: string;
  class_id: string;
  enrolled_at: string;
  unenrolled_at: string | null; // null = currently enrolled
  is_active: boolean;
  ell_level_override: EllLevel | null; // per-enrollment ELL override
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudentSession {
  id: string;
  student_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Unit {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  content_data: UnitContentData;
  created_at: string;
  // Repository fields
  is_published: boolean;
  author_teacher_id: string | null;
  author_name: string | null;
  school_name: string | null;
  tags: string[];
  grade_level: string | null;
  duration_weeks: number | null;
  topic: string | null;
  global_context: string | null;
  key_concept: string | null;
  fork_count: number;
  forked_from: string | null;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unit_type?: UnitType;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "GCSE D&T AQA") */
  curriculum_context?: string | null;
}

export interface ClassUnit {
  class_id: string;
  unit_id: string;
  is_active: boolean;
  locked_pages: string[]; // page IDs (was number[] in v1)
  // Due dates
  final_due_date: string | null;
  page_due_dates: PageDueDatesMap;
  // Per-page settings
  page_settings: PageSettingsMap;
  // Timestamps (migration 033)
  created_at?: string;
  updated_at?: string;
}

// --- Per-Page Due Dates Types ---

/** Map of page IDs to due date strings, e.g. { "A1": "2026-04-01", "B2": "2026-04-15" } */
export type PageDueDatesMap = Partial<Record<string, string>>;

// --- Per-Page Settings Types ---

export interface PageSettings {
  enabled: boolean;
  assessment_type: "formative" | "summative";
  export_pdf: boolean;
}

export type PageSettingsMap = Partial<Record<string, PageSettings>>;

export type ProgressStatus = "not_started" | "in_progress" | "complete";

export interface StudentProgress {
  id: string;
  student_id: string;
  unit_id: string;
  page_id: string;
  status: ProgressStatus;
  responses: Record<string, unknown>;
  time_spent: number;
  updated_at: string;
}

export type PlanningTaskStatus = "todo" | "in_progress" | "done";

export interface PlanningTask {
  id: string;
  student_id: string;
  unit_id: string;
  title: string;
  status: PlanningTaskStatus;
  start_date: string | null;
  target_date: string | null;
  actual_date: string | null;
  time_logged: number;
  page_id: string | null;
  sort_order: number;
  created_at: string;
}

// --- Portfolio Entry Types ---

export type PortfolioEntryType = 'entry' | 'photo' | 'link' | 'note' | 'mistake' | 'auto';

export interface PortfolioEntry {
  id: string;
  student_id: string;
  unit_id: string;
  type: PortfolioEntryType;
  content: string | null;
  media_url: string | null;
  link_url: string | null;
  link_title: string | null;
  page_id: string | null;
  section_index: number | null;
  created_at: string;
}

// --- Unit Content JSON Schema Types ---

export interface VocabTerm {
  term: string;
  definition: string;
  example?: string;
}

export interface VocabWarmup {
  terms: VocabTerm[];
  activity?: {
    type: "matching" | "fill-blank" | "drag-sort";
    items: Array<{ question: string; answer: string }>;
  };
}

export interface EllScaffolding {
  ell1?: { sentenceStarters?: string[]; hints?: string[] };
  ell2?: { sentenceStarters?: string[] };
  ell3?: { extensionPrompts?: string[] };
}

export type ResponseType = "text" | "upload" | "voice" | "link" | "multi" | "canvas" | "decision-matrix" | "pmi" | "pairwise" | "trade-off-sliders" | "toolkit-tool";

export interface ActivityMedia {
  type: "image" | "video";
  url: string;
  caption?: string;
}

export interface ActivityLink {
  url: string;
  label: string;
}

export type ContentStyle = "info" | "warning" | "tip" | "context" | "activity" | "speaking" | "practical";

export interface ActivitySection {
  prompt: string;
  scaffolding?: EllScaffolding;
  responseType?: ResponseType;
  exampleResponse?: string;
  portfolioCapture?: boolean;
  /** Assessment criteria this activity addresses — e.g. ["A","B"] or ["AO1","AO3"]. Framework-agnostic. */
  criterionTags?: string[];
  /** Estimated duration in minutes for this activity section. */
  durationMinutes?: number;
  /** Stable activity ID from v4 timeline — used for response keys that survive rebalancing. */
  activityId?: string;
  media?: ActivityMedia;
  links?: ActivityLink[];
  /** Visual style for content-only blocks (no responseType). */
  contentStyle?: ContentStyle;
  /** For toolkit-tool responseType: which tool to render (e.g., "scamper", "decision-matrix"). */
  toolId?: string;
  /** For toolkit-tool responseType: pre-filled challenge/topic (optional). */
  toolChallenge?: string;
}

export interface Reflection {
  type: "confidence-slider" | "checklist" | "short-response";
  items: string[];
}

/** Workshop Model phase durations for a lesson */
export interface WorkshopPhases {
  opening: { durationMinutes: number; hook?: string };
  miniLesson: { durationMinutes: number; focus?: string };
  workTime: { durationMinutes: number; focus?: string; checkpoints?: string[] };
  debrief: { durationMinutes: number; protocol?: string; prompt?: string };
}

/** Extension activity for early finishers */
export interface LessonExtension {
  title: string;
  description: string;
  durationMinutes: number;
  designPhase?: "investigation" | "ideation" | "prototyping" | "evaluation";
}

export interface PageContent {
  title: string;
  learningGoal: string;
  vocabWarmup?: VocabWarmup;
  introduction?: {
    text: string;
    media?: { type: "image" | "video"; url: string };
    links?: ActivityLink[];
  };
  sections: ActivitySection[];
  reflection?: Reflection;
  /** Workshop Model phase durations (Opening → Mini-Lesson → Work Time → Debrief) */
  workshopPhases?: WorkshopPhases;
  /** Early finisher extensions, indexed by design phase */
  extensions?: LessonExtension[];
}

// --- Flexible Page Types (v2) ---

export type PageType = "strand" | "context" | "skill" | "reflection" | "custom" | "lesson";

export interface UnitPage {
  id: string;                // nanoid(8) for new pages; "A1"/"B3" for migrated v1
  type: PageType;
  criterion?: CriterionKey;  // only for "strand" type
  strandIndex?: number;      // e.g. 1-4 within criterion
  phaseLabel?: string;       // v4 timeline phase grouping ("Research", "Ideation", etc.)
  title: string;
  content: PageContent;
}

export interface UnitContentDataV2 {
  version: 2;
  pages: UnitPage[];
}

/** v3: journey-based — lessons as sequential blocks, criteria as section-level tags. */
export interface UnitContentDataV3 {
  version: 3;
  generationModel: "journey";
  pages: UnitPage[];
  lessonLengthMinutes?: number;
  assessmentCriteria?: string[];
}

// --- Timeline Types (v4) ---

export type DesignLessonType = "research" | "ideation" | "skills-demo" | "making" | "testing" | "critique";

export type TimelineActivityRole = "warmup" | "intro" | "core" | "reflection" | "content";

/** A single activity in the unit timeline. Activities belong to the unit, not to lessons. */
export interface TimelineActivity {
  id: string;                    // nanoid(8) — stable across lesson rebalancing
  role: TimelineActivityRole;
  title: string;
  prompt: string;
  durationMinutes: number;       // REQUIRED — drives lesson boundary computation
  responseType?: ResponseType;   // optional — content-role activities have no response
  scaffolding?: EllScaffolding;
  exampleResponse?: string;
  portfolioCapture?: boolean;
  criterionTags?: string[];
  phaseLabel?: string;           // "Research", "Prototyping" — grouping hint from AI
  media?: ActivityMedia;
  links?: ActivityLink[];
  contentStyle?: ContentStyle;   // visual style for content-role blocks
  // Role-specific fields
  vocabTerms?: VocabTerm[];      // for warmup role
  reflectionType?: "confidence-slider" | "checklist" | "short-response";
  reflectionItems?: string[];    // for reflection role
  teacherNotes?: string;         // questioning prompts, safety reminders, differentiation tips
}

/** Computed lesson boundary — derived at runtime from timeline + lessonLength. Not manually set. */
export interface ComputedLesson {
  lessonNumber: number;
  lessonId: string;              // "L01", "L02"
  activityIds: string[];         // which activities fall in this lesson
  totalMinutes: number;          // sum of activity durations in this lesson
  slackMinutes: number;          // lessonLength - totalMinutes
}

/** v4: timeline-based — activities as a flat sequence, lessons computed from duration. */
export interface UnitContentDataV4 {
  version: 4;
  generationModel: "timeline";
  timeline: TimelineActivity[];
  lessonLengthMinutes: number;
  assessmentCriteria?: string[];
}

// --- Timeline Outline Types ---

export interface TimelinePhase {
  phaseId: string;
  title: string;                 // "Research & Discovery"
  summary: string;
  estimatedLessons: number;      // approximate count
  primaryFocus: string;
  criterionTags: string[];
}

export interface TimelineOutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  phases: TimelinePhase[];
  estimatedActivityCount: number;
}

/** Lightweight lesson skeleton — generated fast (~10-15s) before full activity generation */
export interface TimelineLessonSkeleton {
  lessonNumber: number;
  lessonId: string;              // "L01", "L02"
  title: string;
  keyQuestion: string;
  estimatedMinutes: number;
  phaseLabel: string;
  criterionTags: string[];
  activityHints: string[];       // ["Warmup: vocab review", "Core: product teardown", "Reflection: surprises"]
  lessonType?: DesignLessonType; // AI-classified lesson structure type
  learningIntention?: string;    // "Students will be able to..."
  successCriteria?: string[];    // 2-3 observable criteria
  cumulativeVocab?: string[];    // Key vocab introduced up to and including this lesson
  cumulativeSkills?: string[];   // Key skills/techniques introduced up to and including this lesson
}

/** Full skeleton for a unit — provides context for per-lesson parallel generation */
export interface TimelineSkeleton {
  lessons: TimelineLessonSkeleton[];
  narrativeArc: string;          // 2-3 sentence unit flow summary
}

/** v1: keyed by PageId ("A1"-"D4"). v2: ordered array. v3: journey. v4: timeline. */
export type UnitContentData =
  | { pages?: Partial<Record<string, PageContent>> }
  | UnitContentDataV2
  | UnitContentDataV3
  | UnitContentDataV4;

// --- LMS Integration Types ---

export type LMSProviderType = "managebac" | "toddle" | "canvas" | "schoology";

export interface TeacherIntegration {
  id: string;
  teacher_id: string;
  provider: LMSProviderType;
  subdomain: string | null;
  encrypted_api_token: string | null;
  lti_consumer_key: string | null;
  lti_consumer_secret: string | null;
  created_at: string;
  updated_at: string;
}

// --- AI Unit Creator Types ---

export interface AISettings {
  teacher_id: string;
  provider: string;
  api_endpoint: string;
  model_name: string;
  // encrypted_api_key is never sent to client
}

export type CriteriaFocusLevel = "standard" | "emphasis" | "light";

export interface UnitWizardInput {
  title: string;
  gradeLevel: string;
  durationWeeks: number;
  topic: string;
  globalContext: string;
  keyConcept: string;
  relatedConcepts: string[];
  statementOfInquiry: string;
  selectedCriteria: CriterionKey[];
  criteriaFocus: Partial<Record<CriterionKey, CriteriaFocusLevel>>;
  atlSkills: string[];
  specificSkills: string[];
  resourceUrls: string[];
  specialRequirements: string;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unitType?: UnitType;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "PYP Exhibition") */
  curriculumContext?: string;
  // Service-specific
  communityContext?: string;
  sdgConnection?: string;
  serviceOutcomes?: string[];
  partnerType?: string;
  // Personal Project-specific
  personalInterest?: string;
  goalType?: string;
  presentationFormat?: string;
  // Inquiry-specific
  centralIdea?: string;
  transdisciplinaryTheme?: string;
  linesOfInquiry?: string[];
}

// --- Journey-Based Unit Generation Types (v3) ---

/** Input for journey-mode unit generation — end goal + weeks, criteria as tags not structure. */
export interface LessonJourneyInput {
  title: string;
  gradeLevel: string;
  endGoal: string;
  durationWeeks: number;
  lessonsPerWeek: number;
  lessonLengthMinutes: number;
  topic: string;
  globalContext: string;
  keyConcept: string;
  relatedConcepts: string[];
  statementOfInquiry: string;
  atlSkills: string[];
  specificSkills: string[];
  resourceUrls: string[];
  specialRequirements: string;
  /** Which assessment criteria exist for tagging (e.g. ["A","B","C","D"] for MYP). Not structural. */
  assessmentCriteria: string[];
  curriculumFramework?: string;
  /** Unit pedagogical type — determines phases, AI persona, teaching principles. Default: "design" */
  unitType?: UnitType;
  /** Free-text curriculum context for AI generation (e.g. "IB MYP Design Year 4", "PYP Exhibition") */
  curriculumContext?: string;
  // Service-specific
  communityContext?: string;
  sdgConnection?: string;
  serviceOutcomes?: string[];
  partnerType?: string;
  // Personal Project-specific
  personalInterest?: string;
  goalType?: string;
  presentationFormat?: string;
  // Inquiry-specific
  centralIdea?: string;
  transdisciplinaryTheme?: string;
  linesOfInquiry?: string[];
}

/** A single lesson in a journey outline. */
export interface JourneyOutlineLesson {
  lessonId: string;
  title: string;
  summary: string;
  primaryFocus: string;
  criterionTags: string[];
}

/** One of 3 journey outline approaches the teacher can pick. */
export interface JourneyOutlineOption {
  approach: string;
  description: string;
  strengths: string[];
  lessonPlan: JourneyOutlineLesson[];
}

// --- Auth context types ---

export interface StudentAuthContext {
  student: Student;
  classInfo: Class;
}

export interface TeacherAuthContext {
  teacher: Teacher;
}

// --- Student Design Assistant types ---

export interface DesignConversation {
  id: string;
  studentId: string;
  unitId: string;
  pageId?: string;
  startedAt: string;
  endedAt?: string;
  turnCount: number;
  bloomLevel: number;      // 1-6 (Bloom's taxonomy)
  effortScore: number;     // 3-strike effort gating
  summary?: string;
}

export interface ConversationTurn {
  id: string;
  conversationId: string;
  turnNumber: number;
  role: "student" | "assistant";
  content: string;
  questionType?: string;   // Richard Paul's 6 question types
  bloomLevel?: number;
  createdAt: string;
}

// --- Open Studio Types ---

export type OpenStudioStatusValue = "locked" | "unlocked" | "revoked";
export type OpenStudioUnlockedBy = "teacher" | "auto" | "criteria";
export type OpenStudioRevokedReason = "teacher_manual" | "drift_detected" | "recalibrate";
export type OpenStudioProductivityScore = "low" | "medium" | "high";
export type OpenStudioDriftLevel = "gentle" | "direct" | "silent";

export interface OpenStudioStatus {
  id: string;
  student_id: string;
  unit_id: string;
  class_id: string;
  status: OpenStudioStatusValue;
  unlocked_by: OpenStudioUnlockedBy;
  teacher_note: string | null;
  check_in_interval_min: number;
  carry_forward: boolean;
  unlocked_at: string | null;
  revoked_at: string | null;
  revoked_reason: OpenStudioRevokedReason | null;
  created_at: string;
  updated_at: string;
}

export interface OpenStudioDriftFlag {
  level: OpenStudioDriftLevel;
  message: string;
  timestamp: string;
}

export interface OpenStudioActivityEntry {
  type: "save" | "tool_use" | "response" | "reflection" | "ai_chat";
  description: string;
  timestamp: string;
}

export interface OpenStudioSession {
  id: string;
  student_id: string;
  unit_id: string;
  status_id: string;
  session_number: number;
  focus_area: string | null;
  started_at: string;
  ended_at: string | null;
  activity_log: OpenStudioActivityEntry[];
  ai_interactions: number;
  check_in_count: number;
  drift_flags: OpenStudioDriftFlag[];
  productivity_score: OpenStudioProductivityScore | null;
  ai_summary: string | null;
  reflection: string | null;
}

// --- Open Studio Profile — Discovery output
export type OpenStudioArchetype = 'make' | 'research' | 'lead' | 'serve' | 'create' | 'solve' | 'entrepreneurship';
export type OpenStudioDiscoveryStep = 'strengths' | 'interests' | 'needs' | 'narrowing' | 'commitment' | 'complete';

export interface OpenStudioStrength {
  area: string;
  description: string;
}

export interface OpenStudioInterest {
  topic: string;
  category: string;
}

export interface OpenStudioNeed {
  need: string;
  context: string;
}

export interface OpenStudioConversationMessage {
  role: 'ai' | 'student';
  content: string;
  step: OpenStudioDiscoveryStep;
  timestamp: string;
}

export interface OpenStudioProfile {
  id: string;
  student_id: string;
  unit_id: string;
  strengths: OpenStudioStrength[];
  interests: OpenStudioInterest[];
  needs_identified: OpenStudioNeed[];
  project_statement: string | null;
  archetype: OpenStudioArchetype | null;
  discovery_conversation: OpenStudioConversationMessage[];
  discovery_step: OpenStudioDiscoveryStep;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Open Studio Journey Phase (client-side state)
export type OpenStudioJourneyPhase = 'discovery' | 'planning' | 'working' | 'sharing';

// --- Student Toolkit Tool Sessions ---

export interface StudentToolSession {
  id: string;
  student_id: string;
  tool_id: string;
  challenge: string;
  mode: "embedded" | "standalone";
  unit_id: string | null;
  page_id: string | null;
  section_index: number | null;
  state: Record<string, unknown>;
  summary: Record<string, unknown> | null;
  version: number;
  status: "in_progress" | "completed";
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  portfolio_entry_id: string | null;
}

// --- Safety Badges System ---

export type BadgeCategory = "safety" | "skill" | "software";
export type BadgeTier = 1 | 2 | 3 | 4;
export type BadgeStatus = "active" | "expired" | "revoked";

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: BadgeCategory;
  tier: BadgeTier;
  icon_name: string;
  color: string;
  is_built_in: boolean;
  created_by_teacher_id: string | null;
  pass_threshold: number;
  expiry_months: number | null;
  retake_cooldown_minutes: number;
  question_count: number;
  question_pool: QuestionPoolItem[];
  learn_content: LearningCard[];
  topics: string[];
  created_at: string;
  updated_at: string;
}

export interface QuestionPoolItem {
  id: string;
  text: string;
  type: "multiple_choice" | "true_false" | "short_answer";
  options?: string[];
  correct_answer: string | number;
}

export interface LearningCard {
  id: string;
  title: string;
  description: string;
  icon: string;
  tips: string[];
  examples: string[];
}

export interface StudentBadge {
  id: string;
  student_id: string;
  badge_id: string;
  score: number | null;
  attempt_number: number;
  granted_by: string;
  teacher_note: string | null;
  status: BadgeStatus;
  answers: Record<string, unknown>[];
  time_taken_seconds: number | null;
  awarded_at: string;
  expires_at: string | null;
  created_at: string;
}

// --- Class Gallery & Peer Review System ---

export type GalleryStatus = "open" | "closed";
export type ReviewFormat = "comment" | "pmi" | "two-stars-wish" | string; // string for tool_id

export interface GalleryRound {
  id: string;
  unit_id: string;
  class_id: string;
  teacher_id: string;
  title: string;
  description: string;
  page_ids: string[];
  review_format: ReviewFormat;
  min_reviews: number;
  anonymous: boolean;
  status: GalleryStatus;
  deadline: string | null;
  created_at: string;
  updated_at: string;
}

export interface GallerySubmission {
  id: string;
  round_id: string;
  student_id: string;
  context_note: string;
  content: Record<string, unknown>;
  created_at: string;
}

export interface GalleryReview {
  id: string;
  submission_id: string;
  round_id: string;
  reviewer_id: string;
  review_data: Record<string, unknown>;
  created_at: string;
}

// Teacher monitoring view: gallery round with stats
export interface GalleryRoundWithStats extends GalleryRound {
  submission_count: number;
  submissions: Array<{
    id: string;
    student_id: string;
    student_name: string;
    context_note: string;
    created_at: string;
    review_count: number;
    is_complete: boolean;
  }>;
}
