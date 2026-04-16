/**
 * School, Identity & Data Portability Types
 *
 * This file defines the multi-tenancy and identity architecture:
 *
 * KEY ARCHITECTURAL CHANGE:
 * Students belong to a SCHOOL, not a class.
 * Classes are enrollment groups (many-to-many via ClassEnrollment).
 * This means:
 * - Two teachers at the same school share a single student registry
 * - A student's learning profile, tool certs, and assessment history
 *   are visible to all teachers at that school
 * - When a student moves school, they get a new account at the new school
 *   but can export their portfolio and certification records
 *
 * AUTHENTICATION TIERS (from simplest to most robust):
 * 1. Class code + student number — teacher shares code, student enters
 *    their school-issued student number. No password. Good for MYP age (11-16).
 * 2. QR code — teacher prints individual QR codes. Student scans to login.
 *    Great for younger students or one-to-one device setups.
 * 3. School SSO (Google/Microsoft/Clever) — school IT manages accounts.
 *    Best for schools with infrastructure. Zero friction.
 * 4. LMS LTI — students access via ManageBac/Canvas. Already built.
 * 5. Email + password — optional upgrade for home access and portfolio sharing.
 *
 * DATA OWNERSHIP RULES:
 * - School-scoped: student registry, tool certs, SEN, assessment records, calendar
 * - Teacher-scoped: units, lesson uploads, knowledge library, teaching preferences
 * - Student-scoped: portfolio, responses, planning tasks
 *
 * DB tables will follow when school onboarding is built.
 */

import type { EllLevel } from "@/lib/constants";

/* ================================================================
   SCHOOL — THE MULTI-TENANCY ANCHOR
   ================================================================ */

/**
 * A school entity. This is the top-level tenant.
 *
 * Created by the first teacher who signs up from a school.
 * Other teachers join with a school invite code.
 *
 * The SchoolContext from lesson-intelligence.ts (facilities, culture,
 * timetable, safety) is stored here as JSONB settings — set once
 * during onboarding, shared across all teachers at the school.
 */
export interface School {
  id: string;
  name: string;
  /** Unique code for teachers to join this school (e.g., "GREENHILL-2026") */
  invite_code: string;

  // ─── Location ───
  country: string; // ISO 3166-1 alpha-2
  region?: string; // state/province/emirate
  // NOTE: no timezone column. Teacher's browser captures IANA tz via
  // Intl.DateTimeFormat().resolvedOptions().timeZone on every dashboard
  // load and passes it to /api/teacher/schedule/today?tz=... — more
  // accurate than any stored value (handles expat / travelling teachers).
  // Add schools.timezone here + in SQL only when FU-P needs server-side
  // "end of school day" crons.

  // ─── Identity ───
  /** How students are identified — drives the join flow */
  student_id_scheme: StudentIdScheme;
  /** What the school calls their student ID (displayed in UI) */
  student_id_label: string; // "Student Number", "Roll Number", "ID", "Login"

  // ─── Authentication ───
  /** Which auth methods are enabled for students at this school */
  enabled_auth_methods: StudentAuthMethod[];
  /** SSO provider config (if applicable) */
  sso_config?: SSOConfig;

  // ─── School settings (JSONB) ───
  /** Full school context — facilities, timetable, culture, safety, etc.
   *  This is the SchoolContext type from lesson-intelligence.ts
   *  stored as settings so all teachers at the school share it. */
  settings: Record<string, unknown>;

  // ─── Curriculum ───
  curriculum_framework: string; // "IB_MYP", "GCSE_DT", etc.

  // ─── Data Privacy & Compliance ───
  /** Data privacy regime — determines consent, retention, and export rules */
  data_privacy: DataPrivacySettings;

  // ─── Metadata ───
  created_by: string; // teacher_id who created the school
  created_at: string;
  updated_at: string;
}

/** How the school identifies students */
export type StudentIdScheme =
  | "student_number" // numeric or alphanumeric school-issued ID
  | "email" // students have school email addresses
  | "username" // school assigns usernames
  | "external_lms"; // identity comes from LMS (ManageBac, Canvas)

/** Available authentication methods for students */
export type StudentAuthMethod =
  | "class_code" // class code + student number (simplest, no password)
  | "qr_code" // individual QR code scan (great for younger students)
  | "google_sso" // Google Workspace for Education
  | "microsoft_sso" // Microsoft Entra ID / Azure AD
  | "clever" // Clever SSO (US-focused)
  | "classlink" // ClassLink SSO
  | "lti" // LMS LTI (ManageBac, Canvas, Schoology, Toddle)
  | "email_password"; // traditional email + password (optional upgrade)

/** SSO provider configuration */
export interface SSOConfig {
  provider: "google" | "microsoft" | "clever" | "classlink";
  /** Domain restriction — only allow logins from this domain */
  allowed_domains?: string[]; // ["greenhill.edu.ae"]
  /** Client ID / tenant ID for OAuth */
  client_id?: string;
  /** Whether to auto-provision students on first SSO login */
  auto_provision_students: boolean;
}

/* ================================================================
   SCHOOL MEMBERSHIP — TEACHERS & ROLES
   ================================================================ */

/** A teacher's role at a school */
export type SchoolRole =
  | "admin" // can manage school settings, teachers, and student registry
  | "teacher" // standard teacher — creates classes, assigns units, grades
  | "substitute" // temporary access to specific classes, no data editing
  | "student_teacher" // limited access, can view but needs approval to change
  | "head_of_department"; // can see all design classes, moderate grades

/**
 * A teacher's membership at a school.
 * A teacher can belong to multiple schools (e.g., part-time at two schools).
 */
export interface SchoolMembership {
  school_id: string;
  teacher_id: string;
  role: SchoolRole;
  department?: string; // "Design & Technology", "Art & Design"
  /** Optional: restrict which grade levels this teacher can see */
  grade_levels?: string[];
  joined_at: string;
  is_active: boolean;
  /** For substitutes: when their access expires */
  access_expires_at?: string;
}

/* ================================================================
   SCHOOL STUDENT — THE CANONICAL STUDENT RECORD
   ================================================================ */

/**
 * A student belongs to a school, not a class.
 *
 * This replaces the current `Student.class_id` pattern.
 * The student_number is the canonical identifier within a school —
 * when Teacher B adds student #4521 to their class, the system
 * finds the existing SchoolStudent record (no duplicates).
 *
 * MIGRATION PATH from current Student type:
 * 1. Create schools table
 * 2. Create school_students table
 * 3. Create class_enrollments table
 * 4. Migrate existing students: each class's teacher_id determines
 *    the school, student records get school_id, class_id moves to
 *    class_enrollments join table
 * 5. Existing Student type continues to work for read queries
 *    (join school_students + class_enrollments)
 */
export interface SchoolStudent {
  id: string;
  school_id: string;

  // ─── Identity ───
  /** School-issued student number — unique within the school.
   *  This is the primary matching key when teachers add students. */
  student_number: string;
  display_name: string;
  /** Preferred first name (may differ from official name) */
  preferred_name?: string;
  avatar_url?: string;

  // ─── Contact (optional, for older students / home access) ───
  email?: string; // optional — not required for class code auth
  /** Has the student set up their own login credentials? */
  has_self_login: boolean;

  // ─── Authentication ───
  auth_method: StudentAuthMethod;
  /** For QR code auth: the unique token embedded in their QR code */
  qr_token?: string;
  /** For SSO: the external identity provider's user ID */
  external_id?: string;
  external_provider?: string;

  // ─── Demographics (school-maintained) ───
  grade_level: string; // "Year 7", "Grade 6", "MYP 1"
  ell_level: EllLevel;
  /** Date of birth — needed for tool age restrictions */
  date_of_birth?: string; // ISO 8601 date

  // ─── Status ───
  is_active: boolean; // false = left the school
  enrolled_at: string;
  left_at?: string;

  created_at: string;
  updated_at: string;
}

/* ================================================================
   CLASS ENROLLMENT — MANY-TO-MANY STUDENT ↔ CLASS
   ================================================================ */

/**
 * Links a student to a class.
 *
 * This replaces Student.class_id (which limited a student to one class).
 * A student can now be in multiple classes:
 * - 9B Design with Teacher A
 * - 9B Technology with Teacher B
 * - Art Elective with Teacher C
 *
 * All three teachers see the same student identity, tool certs,
 * and learning profile — but each has their own class-specific
 * settings (ELL level can be overridden per class if needed).
 */
export interface ClassEnrollment {
  id: string;
  class_id: string;
  student_id: string; // FK to SchoolStudent

  /** Override ELL level for this class (if different from school-level) */
  ell_level_override?: EllLevel;
  /** Any class-specific notes about this student */
  teacher_notes?: string;

  enrolled_at: string;
  is_active: boolean;
  unenrolled_at?: string;
}

/* ================================================================
   CLASS — UPDATED TO BELONG TO A SCHOOL
   ================================================================ */

/**
 * An updated class type that belongs to a school.
 * Compatible with existing Class type but adds school_id.
 */
export interface SchoolClass {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  code: string; // class join code (for student enrollment)

  // ─── Class metadata (was missing) ───
  grade_level?: string; // "Year 9", "MYP 4"
  subject?: string; // "Product Design", "Systems & Control"
  academic_year?: string; // "2025-2026"

  // ─── LMS integration ───
  external_class_id?: string;
  external_provider?: string;
  last_synced_at?: string;

  created_at: string;
}

/* ================================================================
   DATA PORTABILITY — WHAT TRAVELS WITH WHOM
   ================================================================ */

/**
 * When a STUDENT leaves school.
 *
 * The student's school account is deactivated (is_active = false).
 * They can export a portable record of their work.
 *
 * What they take:
 * - Portfolio entries (their own creative work — this is THEIRS)
 * - Tool certification records (PDF — proof they can show new school)
 * - Assessment summary (PDF transcript — not raw teacher comments)
 *
 * What stays at the school:
 * - Learning profile (SEN provisions, teacher notes — confidential, school-managed)
 * - Detailed assessment records (raw grades, teacher comments)
 * - Responses/progress data (tied to school's units)
 * - ELL level and accommodation records
 */
export interface StudentPortableRecord {
  student_name: string;
  school_name: string;
  academic_years: string[]; // "2024-2025", "2025-2026"
  exported_at: string;

  /** Who triggered this export and what they were allowed to see */
  export_context: {
    requested_by: DataExportActor;
    included_scopes: DataExportScope[];
  };

  /** Portfolio: all creative work across all units */
  portfolio: Array<{
    unit_title: string;
    entry_type: string;
    content: string | null;
    media_url: string | null;
    created_at: string;
  }>;

  /** Tool certifications: safety training records */
  certifications: Array<{
    tool: string;
    level: string;
    certified_date: string;
    school_name: string;
  }>;

  /** Assessment summary: grades without detailed teacher comments */
  assessment_summary: Array<{
    unit_title: string;
    grade_level: string;
    criteria_scores: Record<string, number>; // { "A": 5, "B": 6 }
    overall_grade?: number;
    assessed_at: string;
  }>;

  /** Skills attained (aggregated from learning profile) */
  skills_summary: Array<{
    skill: string;
    level: string; // "introduced", "practiced", "consolidated"
  }>;

  /** Software proficiency (self-reported or teacher-verified) */
  software_skills: Array<{
    software: string;
    level: string;
  }>;
}

/**
 * When a TEACHER leaves school.
 *
 * The teacher's school membership is deactivated.
 * Their teacher-owned data travels with their account.
 *
 * What they take (teacher_id owned):
 * - Units and templates they created
 * - Lesson uploads and lesson profiles
 * - Knowledge library items they created
 * - Teaching preferences
 *
 * What stays at the school:
 * - Student data (records, profiles, portfolios)
 * - Assessment records (even ones they created — these belong to the school)
 * - Class rosters and enrollment records
 * - School context and settings
 *
 * COMPLICATION: Assessment records have teacher_id as the assessor.
 * When teacher leaves, the records remain but are attributed to
 * "[Former teacher] - Name". The data isn't deleted.
 */
export interface TeacherPortableData {
  teacher_id: string;
  teacher_name: string;
  exported_at: string;

  /** Count of what travels with them (for display) */
  units_count: number;
  lesson_profiles_count: number;
  knowledge_items_count: number;
  /** Teaching preferences are automatically portable (tied to teacher_id) */
}

/* ================================================================
   CLASS INTAKE SUMMARY — AUTO-GENERATED BRIEFING FOR NEW TEACHERS
   ================================================================ */

/**
 * Auto-generated when a teacher first accesses a class.
 * Aggregates data from all students' learning profiles,
 * assessment histories, and tool certifications.
 *
 * Solves the "new teacher at the school" problem:
 * even if you've never taught these students, the system
 * tells you what they've done, what they know, and what they need.
 *
 * This is a READ-ONLY computed view, not stored data.
 */
export interface ClassIntakeSummary {
  class_id: string;
  student_count: number;
  generated_at: string;

  // ─── Skills & Tools Overview ───
  /** Tools most students have used (with counts) */
  tool_experience: Array<{
    tool: string;
    /** How many students have used this tool */
    experienced_count: number;
    /** How many are independently certified */
    certified_count: number;
    /** How many have never used it */
    no_experience_count: number;
  }>;

  /** Software most students have used */
  software_experience: Array<{
    software: string;
    novice_count: number;
    competent_count: number;
    proficient_count: number;
    no_experience_count: number;
  }>;

  // ─── Prior Achievement ───
  /** Average criterion scores from previous units (if available) */
  prior_criterion_averages?: Record<string, number>;
  /** Common strengths from previous assessment tags */
  common_strengths: string[];
  /** Common gaps from previous assessment tags */
  common_gaps: string[];
  /** Overall ability spread */
  ability_distribution: {
    high: number; // students typically scoring 7-8
    middle: number; // 4-6
    developing: number; // 1-3
    no_data: number; // new students or no prior assessment
  };

  // ─── Learning Needs ───
  ell_breakdown: {
    level_1_count: number; // beginner ELL
    level_2_count: number; // intermediate ELL
    level_3_count: number; // advanced / native
  };
  /** Number of students with SEN provisions (no details — privacy) */
  sen_count: number;
  /** Number of students with IEP/EHC/504 plans */
  formal_plan_count: number;

  // ─── Prior Curriculum Coverage ───
  /** Units this cohort has previously completed (from scope & sequence) */
  prior_units: Array<{
    title: string;
    topic: string;
    grade_level: string;
    criteria_covered: string[];
    academic_year: string;
  }>;

  /** Skills that have been introduced/practiced across prior units */
  skills_covered: Array<{
    skill: string;
    level: "introduced" | "practiced" | "consolidated" | "assessed";
    /** When it was last taught */
    last_seen: string;
  }>;

  // ─── Class Dynamics (from ClassCohortContext if available) ───
  energy_profile?: string;
  behaviour_notes?: string;
  grouping_constraints?: string;

  // ─── AI-Generated Recommendations ───
  /** Suggestions for the teacher based on the data */
  recommendations?: string[];
}

/* ================================================================
   STUDENT MATCHING — DEDUPLICATION WITHIN A SCHOOL
   ================================================================ */

/**
 * When a teacher adds students to their class, the system
 * needs to match against existing school students.
 *
 * Matching strategy (in order of confidence):
 * 1. student_number — exact match (highest confidence)
 * 2. external_id — LMS ID match (high confidence if same provider)
 * 3. email — exact match (high confidence)
 * 4. display_name — fuzzy match (low confidence, needs teacher confirmation)
 *
 * If no match found → create new SchoolStudent record.
 * If match found → enroll existing student in the new class.
 * If fuzzy name match → show teacher: "Is this the same John Smith
 * from 9A Design? Student #4521" and let them confirm.
 */
export interface StudentMatchResult {
  /** The matched existing student (if found) */
  matched_student?: SchoolStudent;
  /** How the match was found */
  match_method?: "student_number" | "external_id" | "email" | "name_fuzzy";
  /** Confidence level */
  confidence: "exact" | "high" | "needs_confirmation" | "no_match";
  /** For fuzzy matches: what to show the teacher for confirmation */
  confirmation_message?: string;
}

/* ================================================================
   DATA PRIVACY & COMPLIANCE
   Each school operates under a data privacy regime determined by
   its country. The system defaults to the strictest applicable
   standard (GDPR) and adds country-specific rules on top.
   ================================================================ */

/**
 * The applicable data privacy regulation.
 * Determines consent requirements, retention periods, export rights,
 * age thresholds, and data residency rules.
 */
export type DataPrivacyRegime =
  | "gdpr" // EU/EEA — strictest, our baseline
  | "uk_gdpr" // UK — similar to GDPR with minor differences
  | "ferpa_coppa" // US — FERPA for schools + COPPA for under-13
  | "pdpa_sg" // Singapore Personal Data Protection Act
  | "pdp_uae" // UAE Federal Data Protection Law
  | "privacy_act_au" // Australian Privacy Act 1988
  | "pipeda_ca" // Canada — PIPEDA + provincial laws
  | "popia_za" // South Africa — POPIA
  | "other"; // fallback — applies GDPR-equivalent rules

/**
 * School-level data privacy settings.
 * Set during onboarding based on country. School admin can adjust.
 */
export interface DataPrivacySettings {
  /** Primary regulation that applies to this school */
  regime: DataPrivacyRegime;
  /** Additional regulations (e.g., US school may have state laws too) */
  additional_regimes?: string[];

  // ─── Age & Consent ───
  /** Minimum age for student self-service account (without parental consent) */
  min_self_service_age: number; // GDPR: 16 (varies by country), COPPA: 13, etc.
  /** Does the school require parental consent for data processing? */
  requires_parental_consent: boolean;
  /** Has the school confirmed DPA (Data Processing Agreement) with StudioLoom? */
  dpa_signed: boolean;
  dpa_signed_at?: string;

  // ─── Data Retention ───
  /** How long to retain student data after they leave the school (months) */
  retention_months_after_leaving: number; // GDPR default: 12, schools often 24-36
  /** How long to retain assessment records (months) — often longer */
  assessment_retention_months: number; // often 60-84 (5-7 years) for audit
  /** Auto-delete or flag for manual review? */
  retention_action: "auto_delete" | "flag_for_review" | "anonymise";

  // ─── Data Residency ───
  /** Where must data be stored? Some countries require local storage */
  data_residency?: "us" | "eu" | "uk" | "au" | "sg" | "ae" | "any";

  // ─── Export & Portability ───
  /** Who can trigger a student data export? */
  export_permitted_by: DataExportActor[];
  /** What format for exports? */
  export_formats: ("json" | "pdf" | "zip")[];

  // ─── AI Processing ───
  /** Does the school consent to AI processing of student work? */
  ai_processing_consent: boolean;
  /** Does the school consent to AI processing of uploaded lessons? */
  ai_lesson_analysis_consent: boolean;
  /** Are AI-processed outputs stored or ephemeral? */
  ai_data_handling: "stored" | "ephemeral" | "anonymised";

  // ─── Sub-processors ───
  /** Acknowledged third-party processors (shown during onboarding) */
  acknowledged_sub_processors: string[];
  // e.g., ["Anthropic (AI analysis)", "Voyage AI (embeddings)", "Supabase (database)", "Vercel (hosting)"]
}

/** Who can request a student data export */
export type DataExportActor =
  | "school_admin" // school admin can always export
  | "teacher" // class teacher can export their students
  | "parent_guardian" // parent/guardian request (required by most regulations)
  | "student_over_age" // student at or above min_self_service_age
  | "student_any_age"; // student at any age (less common)

/**
 * A data export request record — audit trail.
 * Every export is logged for compliance.
 */
export interface DataExportRequest {
  id: string;
  school_id: string;
  student_id: string;

  /** Who requested the export */
  requested_by: DataExportActor;
  requester_id: string; // teacher_id, parent email, or student_id
  requester_name: string;

  /** What was included in the export */
  included_data: DataExportScope[];

  /** Export format and delivery */
  format: "json" | "pdf" | "zip";
  /** How was the export delivered? */
  delivery_method: "download" | "email" | "parent_portal";

  /** Status */
  status: "requested" | "processing" | "completed" | "denied";
  /** If denied, why */
  denial_reason?: string;

  requested_at: string;
  completed_at?: string;
  /** Download link expires after this date */
  expires_at?: string;
}

/** What data categories are included in an export */
export type DataExportScope =
  | "portfolio" // creative work, uploads, media
  | "assessment_summary" // grades and scores (no raw teacher comments)
  | "assessment_full" // full assessment records (admin/parent only)
  | "tool_certifications" // safety training records
  | "skills_summary" // skill progression summary
  | "progress_data" // time spent, completion status
  | "responses" // actual student responses/work
  | "learning_profile"; // SEN, accommodations (parent/admin only, NOT student)

/**
 * Default privacy settings by country.
 * Applied during school onboarding, school admin can adjust.
 *
 * Not a type — this would be a constants file or seed data.
 * Documented here for reference:
 *
 * GDPR countries (EU/EEA):
 *   min_self_service_age: 16 (13 in some: BE, DK, EE, FI, LV, MT, PT, SE, UK)
 *   requires_parental_consent: true (for under min age)
 *   retention_months_after_leaving: 12
 *   data_residency: "eu"
 *   export_permitted_by: ["school_admin", "parent_guardian", "student_over_age"]
 *
 * US (FERPA + COPPA):
 *   min_self_service_age: 13 (COPPA)
 *   requires_parental_consent: true (for under 13)
 *   retention_months_after_leaving: 36 (common practice)
 *   data_residency: "us"
 *   export_permitted_by: ["school_admin", "parent_guardian"]
 *   Note: FERPA gives parents rights until student turns 18
 *
 * UAE:
 *   min_self_service_age: 18 (conservative)
 *   requires_parental_consent: true
 *   retention_months_after_leaving: 24
 *   data_residency: "ae" (may require local storage)
 *   export_permitted_by: ["school_admin", "parent_guardian"]
 *
 * Australia:
 *   min_self_service_age: 15 (no fixed legal age, 15 is common practice)
 *   requires_parental_consent: true (for under 15)
 *   retention_months_after_leaving: 24
 *   data_residency: "any" (with adequate safeguards)
 *   export_permitted_by: ["school_admin", "parent_guardian", "student_over_age"]
 *
 * Singapore:
 *   min_self_service_age: 18
 *   requires_parental_consent: true
 *   retention_months_after_leaving: 24
 *   data_residency: "any" (with transfer rules)
 *   export_permitted_by: ["school_admin", "parent_guardian"]
 */

/* ================================================================
   DATABASE ROW TYPES (for future migrations)
   ================================================================ */

/** Row type for schools table */
export interface SchoolRow {
  id: string;
  name: string;
  invite_code: string;
  country: string;
  region: string | null;
  // NOTE: no timezone — detected client-side per-request (see School interface above).
  student_id_scheme: StudentIdScheme;
  student_id_label: string;
  enabled_auth_methods: StudentAuthMethod[];
  sso_config: SSOConfig | null;
  settings: Record<string, unknown>; // SchoolContext JSONB
  curriculum_framework: string;
  data_privacy: DataPrivacySettings;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Row type for data_export_requests table (audit trail) */
export interface DataExportRequestRow {
  id: string;
  school_id: string;
  student_id: string;
  requested_by: DataExportActor;
  requester_id: string;
  requester_name: string;
  included_data: DataExportScope[];
  format: string;
  delivery_method: string;
  status: string;
  denial_reason: string | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
}

/** Row type for school_memberships table */
export interface SchoolMembershipRow {
  id: string;
  school_id: string;
  teacher_id: string;
  role: SchoolRole;
  department: string | null;
  grade_levels: string[] | null;
  joined_at: string;
  is_active: boolean;
  access_expires_at: string | null;
}

/** Row type for school_students table */
export interface SchoolStudentRow {
  id: string;
  school_id: string;
  student_number: string;
  display_name: string;
  preferred_name: string | null;
  avatar_url: string | null;
  email: string | null;
  has_self_login: boolean;
  auth_method: StudentAuthMethod;
  qr_token: string | null;
  external_id: string | null;
  external_provider: string | null;
  grade_level: string;
  ell_level: number; // 1, 2, 3
  date_of_birth: string | null;
  is_active: boolean;
  enrolled_at: string;
  left_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Row type for class_enrollments table */
export interface ClassEnrollmentRow {
  id: string;
  class_id: string;
  student_id: string;
  ell_level_override: number | null;
  teacher_notes: string | null;
  enrolled_at: string;
  is_active: boolean;
  unenrolled_at: string | null;
}
