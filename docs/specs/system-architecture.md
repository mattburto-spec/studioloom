# LoomOS — StudioLoom System Architecture

**Version:** 2.0.0
**Created:** 5 April 2026
**Updated:** 5 April 2026
**Author:** Matt Burton + Claude
**Status:** Foundation spec — defines the target architecture for all future development

---

## 1. Why This Document Exists

StudioLoom has 63 subprojects, 169 API routes, 56 database tables, and ~62,000 lines of TypeScript built across 13 intensive coding days. The features work. But they grew organically — each one reaches directly into the database, does its own auth, calls its own AI, and renders its own UI. There is no shared layer orchestrating them.

**LoomOS** is that layer — the operating system that brings all the threads together in a neat order. It answers three questions:

1. **What is the OS?** The 8 core services that every feature depends on.
2. **What are the organs?** The 11 domain modules that contain all business logic.
3. **How do they connect?** The contracts, dependency rules, and communication patterns between them.

The goal is a system that is modular enough to sell as a platform, extract modules for Makloom/Seedlings/CALLED, and swap any organ for an upgrade without breaking the others.

### 1.1 Design Imperatives

Four non-negotiable requirements govern every decision in this spec:

1. **Don't break what works.** Every migration step is independently deployable. Every moved function gets a test BEFORE the move. The Strangler Fig pattern means old and new code coexist until the old code is fully replaced and verified.

2. **Test everything, from the start.** Every module public API gets contract tests. Every OS service gets mock factories. The event bus is synchronous in test mode. Cross-module flows get integration tests. No code moves without a test proving the old behaviour is preserved.

3. **Security is foundational, not an add-on.** This is a school data system handling information from children aged 11-18. Data classification, access scoping, audit logging, and compliance (COPPA, GDPR, PIPL) are built into the OS layer, not bolted on later.

4. **Swap without fear.** Typed public APIs with stable interfaces mean any module's internals can change without affecting others. The dependency graph has no cycles. Events decouple side effects. Feature flags control what's active. Adding a new module or replacing an old one should never require "untangling wires."

---

## 2. Architecture Philosophy

### 2.1 Modular Monolith, Not Microservices

StudioLoom is built by one developer. Microservices would add deployment complexity, network latency, distributed debugging, and infrastructure cost — all for zero benefit at this scale. What we need is Shopify's approach: a single deployable (Next.js on Vercel) with strict internal module boundaries enforced by convention and TypeScript.

**The rule:** Modules are directories with explicit public APIs. Code inside a module is private. Cross-module access goes through the public API only. This is enforced by import conventions today and can be enforced by tooling (like Shopify's Packwerk) later.

### 2.2 Three Layers, Clear Direction

```
┌─────────────────────────────────────────────────┐
│              PRESENTATION LAYER                  │
│   Next.js pages, React components, API routes    │
│   (renders UI, handles HTTP, calls domain logic) │
└──────────────────────┬──────────────────────────┘
                       │ imports ↓ only
┌──────────────────────▼──────────────────────────┐
│              DOMAIN LAYER (The Organs)            │
│   11 modules, each with public API + types       │
│   (all business logic, validation, computation)  │
└──────────────────────┬──────────────────────────┘
                       │ imports ↓ only
┌──────────────────────▼──────────────────────────┐
│              LOOMOS LAYER (The Kernel)            │
│   8 core services shared by all modules          │
│   (auth, taxonomy, AI, entity resolution,        │
│    events, config, notifications, storage)       │
└──────────────────────┬──────────────────────────┘
                       │ calls ↓ only
┌──────────────────────▼──────────────────────────┐
│              INFRASTRUCTURE                      │
│   Supabase (Postgres + Auth + Storage),          │
│   Anthropic/Groq/Gemini APIs, Vercel             │
└─────────────────────────────────────────────────┘
```

**Import direction is strictly downward.** The OS layer never imports from domain modules. Domain modules never import from the presentation layer. A module can import from OS services and from other modules' public APIs — never from their internals.

### 2.3 Design Principles

These five principles govern all architectural decisions:

**P1. Boundaries over convenience.** Reaching directly into another module's database table is faster today but creates invisible coupling that breaks tomorrow. Always go through the public API, even when it feels like overhead.

**P2. Conventions over configuration.** Directory structure IS the architecture. A file at `src/modules/content/index.ts` is a public API. A file at `src/modules/content/internal/normalize.ts` is private. No config file needed.

**P3. Extract later, boundary now.** You don't need to extract modules into separate packages today. You DO need the boundaries today so extraction is possible tomorrow.

**P4. Events over direct calls for side effects.** When a student submits a response, the delivery module writes the data. Everything else (insights update, integrity analysis, profile update, tracking data) subscribes to an event. The delivery module shouldn't know or care about those downstream consumers.

**P5. Fail open, log closed.** OS services should never crash a feature. If the event bus fails, the response still saves. If taxonomy lookup fails, fall back to defaults. But always log the failure so you can find it.

---

## 3. The LoomOS Layer (8 Core Services)

The OS layer lives at `src/os/`. Every service is a TypeScript module with a clean public API. No service depends on any domain module.

### 3.1 Auth Service — `src/os/auth/`

**Problem it solves:** Two separate auth systems (Supabase Auth for teachers, custom tokens for students), ad-hoc verification copied into every API route, recurring bugs (Lesson Learned #4, #9, #22).

**Public API:**

```typescript
// src/os/auth/index.ts

export type Role = 'teacher' | 'student' | 'admin';

export interface AuthContext {
  userId: string;          // teacher UUID or student ID
  role: Role;
  schoolId?: string;       // future: multi-tenancy
  teacherId?: string;      // for students: their author_teacher_id
  classIds?: string[];     // for students: enrolled class IDs
  raw: {                   // the underlying session data
    supabaseUser?: User;   // teacher sessions
    studentSession?: StudentSession; // student sessions
  };
}

// The one function every API route calls
export async function requireAuth(
  request: NextRequest,
  allowedRoles: Role[]
): Promise<AuthContext>;

// Convenience wrappers (call requireAuth internally)
export async function requireTeacher(request: NextRequest): Promise<AuthContext>;
export async function requireStudent(request: NextRequest): Promise<AuthContext>;
export async function requireAdmin(request: NextRequest): Promise<AuthContext>;

// Supabase clients — only the auth service creates these
export function createAuthClient(cookies: ReadonlyRequestCookies): SupabaseClient;
export function createAdminClient(): SupabaseClient;
```

**What it owns:**
- `student_sessions` table (read/write)
- `teachers` table (read for auth verification only)
- Cookie management for both auth systems
- Cache-Control: private header enforcement (Lesson Learned #11)

**What it does NOT own:**
- User profiles (owned by Teacher Cockpit and Student Journey modules)
- Class enrollment (owned by Content module)
- Permissions beyond role-based (feature flags handled by Config service)

**Migration from current state:**
- Replace all instances of `requireTeacherAuth()` and `requireStudentAuth()` with `requireAuth()`
- Centralise `createServerSupabaseClient()` and `createAdminClient()` here (currently in `src/lib/supabase/`)
- Remove the 75+ files that import auth helpers directly

---

### 3.2 Taxonomy Registry — `src/os/taxonomy/`

**Problem it solves:** Framework definitions, criteria, bloom levels, phases, activity categories, and UDL checkpoints are scattered across 6+ files (`constants.ts`, `unit-types.ts`, `nm/constants.ts`, Dimensions3 types, lesson-pulse scoring tables). Matt's Platform Architecture doc warns: "All systems forbidden from creating new tags independently — they MUST query the Central Taxonomy API."

**Public API:**

```typescript
// src/os/taxonomy/index.ts

// ── Frameworks & Criteria ──
export interface Framework {
  id: string;                    // 'IB_MYP' | 'GCSE_DT' | 'ACARA_DT' | etc.
  name: string;                  // 'IB MYP Design'
  criteriaKeys: string[];        // ['A', 'B', 'C', 'D'] or ['AO1', 'AO2', ...]
  gradingScale: GradingScale;
  commandVerbs: Record<string, string[]>;
}

export function getFramework(id: string): Framework;
export function getAllFrameworks(): Framework[];
export function getCriterion(frameworkId: string, key: string): CriterionDefinition;
export function getGradingScale(frameworkId: string): GradingScale;

// ── Neutral Criterion Taxonomy ──
// 8 universal categories that map bidirectionally to all frameworks
export type NeutralCriterion =
  | 'researching' | 'analysing' | 'designing' | 'creating'
  | 'evaluating' | 'reflecting' | 'communicating' | 'planning';

export function neutralToFramework(neutral: NeutralCriterion, frameworkId: string): string;
export function frameworkToNeutral(criterionKey: string, frameworkId: string): NeutralCriterion;

// ── Bloom's Taxonomy ──
export type BloomLevel = 'remember' | 'understand' | 'apply' | 'analyse' | 'evaluate' | 'create';
export function getBloomVerbs(level: BloomLevel): string[];
export function getBloomLevel(verb: string): BloomLevel | null;

// ── Design Phases ──
// Universal phases that map to all frameworks
export type DesignPhase = 'discover' | 'define' | 'ideate' | 'prototype' | 'test' | 'reflect';
export function phaseToFramework(phase: DesignPhase, frameworkId: string): string;

// ── Activity Categories ──
export type ActivityCategory =
  | 'ideation' | 'research' | 'analysis' | 'making' | 'critique'
  | 'reflection' | 'planning' | 'presentation' | 'warmup'
  | 'collaboration' | 'skill-building' | 'documentation';

// ── UDL Checkpoints ──
export interface UDLCheckpoint {
  id: string;          // '1.1', '2.3', '8.2'
  principle: 'engagement' | 'representation' | 'action_expression';
  guideline: string;
  description: string;
}
export function getUDLCheckpoints(): UDLCheckpoint[];
export function getUDLCheckpoint(id: string): UDLCheckpoint;

// ── Unit Types ──
export type UnitType = 'design' | 'service' | 'pp' | 'inquiry';
export function getUnitTypeDefinition(type: UnitType): UnitTypeDefinition;

// ── Time Weights ──
export type TimeWeight = 'quick' | 'moderate' | 'extended' | 'flexible';
```

**What it owns:**
- All framework definitions, criteria, grading scales
- All taxonomy constants (bloom, phases, categories, UDL)
- The FrameworkAdapter (neutral ↔ framework mapping)
- Unit type definitions and format profiles

**Migration from current state:**
- Consolidate `src/lib/constants.ts` (frameworks, criteria, MYP vocabulary)
- Consolidate `src/lib/ai/unit-types.ts` (unit type definitions, criteria per type)
- Consolidate `src/lib/nm/constants.ts` (Melbourne Metrics competencies)
- Consolidate scattered bloom/phase/category constants from Dimensions3
- All 65+ files importing from `@/lib/constants` redirect to `@/os/taxonomy`

---

### 3.3 AI Service — `src/os/ai/`

**Problem it solves:** `callHaiku()` is copied 17 times across the codebase (~2,890 wasted lines). Each AI-calling feature does its own rate limiting, error handling, cost tracking, model selection, and retry logic. The feature audit flagged this as the #1 code duplication issue.

**Public API:**

```typescript
// src/os/ai/index.ts

export type ModelTier = 'fast' | 'balanced' | 'powerful';
// fast = Haiku 4.5 (student feedback, toolkit nudges)
// balanced = Sonnet 4 (generation, analysis)
// powerful = Opus (reserved for future complex reasoning)

export type AIPurpose =
  | 'student-feedback'     // toolkit nudges, Design Assistant
  | 'student-reflection'   // Discovery AI, check-in
  | 'teacher-generation'   // unit generation, lesson creation
  | 'teacher-analysis'     // knowledge ingestion, analysis
  | 'teacher-suggestion'   // AI field assist, wizard suggestions
  | 'system-internal';     // integrity analysis, scoring

export interface AIRequest {
  tier: ModelTier;
  purpose: AIPurpose;
  system: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];        // for structured output
  toolChoice?: ToolChoice;
  teacherId?: string;              // for cost attribution + style lookup
  studentId?: string;              // for rate limiting
  metadata?: Record<string, any>;  // logged to ai_usage_log
}

export interface AIResponse {
  content: string;
  toolResult?: any;                // parsed tool output
  usage: { inputTokens: number; outputTokens: number; };
  cost: number;                    // estimated USD
  model: string;                   // actual model used (after fallback)
  duration: number;                // ms
}

// The one function everything calls
export async function generate(request: AIRequest): Promise<AIResponse>;

// Convenience for structured JSON output via tool_choice
export async function generateJSON<T>(
  request: AIRequest & { schema: JSONSchema }
): Promise<T>;

// Streaming variant
export async function generateStream(
  request: AIRequest
): AsyncGenerator<string>;

// Internal: rate limiting, cost tracking, model fallback, Sentry
// All handled inside — callers never see retry logic
```

**What it owns:**
- `ai_usage_log` table (write)
- `ai_model_config` table (read — for model selection)
- `ai_settings` table (read — for per-teacher overrides)
- Rate limiting state (in-memory sliding window)
- Model fallback chain (Anthropic → Groq → Gemini)
- Sentry error context for all AI calls
- Cost estimation per model

**What it does NOT own:**
- Prompt construction (each domain module builds its own prompts)
- Knowledge retrieval (owned by Content module)
- Teacher style profiles (owned by Teacher Cockpit, passed as context)

**Migration from current state:**
- Delete all 17 copies of `callHaiku()` — replace with `ai.generate({ tier: 'fast', ... })`
- Move `src/lib/ai/anthropic.ts` model client code here
- Move `src/lib/rate-limit.ts` here (generalised rate limiter)
- Move `src/lib/usage-tracking.ts` here
- All 42 files importing from `@/lib/ai/` update to use `@/os/ai` for the generate call (but keep their own prompt builders in their domain modules)

---

### 3.4 Entity Resolver — `src/os/entity/`

**Problem it solves:** "Given a student in a class taking a unit, what content do they see? What config applies? What AI rules govern them?" This question is currently answered by scattered logic across dozens of files. The `resolveClassUnitContent()` function is the one place where the pattern exists properly, but it only covers content — not NM config, AI rules, scaffolding, scheduling, or framework settings.

**Public API:**

```typescript
// src/os/entity/index.ts

// The fully resolved context for a student+class+unit
export interface ResolvedContext {
  // Content (fork-aware)
  content: NormalizedContent;          // always v2-normalized pages array
  contentSource: 'fork' | 'master';

  // Framework (from class)
  framework: Framework;                // resolved via taxonomy
  criteriaKeys: string[];

  // Configuration (class-unit level with fallbacks)
  nmConfig: NMConfig | null;           // class_units.nm_config → units.nm_config → null
  scheduleOverrides: ScheduleOverrides;

  // Student context
  studentProfile: StudentLearningProfile | null;
  mentorId: string | null;
  themeId: string | null;
  openStudioStatus: OpenStudioStatus | null;

  // Timing
  termDates: { start: Date; end: Date } | null;
  nextClassDate: Date | null;
  cycleDay: number | null;
}

// Resolve everything for a student+class+unit triple
export async function resolveContext(
  supabase: SupabaseClient,
  studentId: string,
  classId: string,
  unitId: string
): Promise<ResolvedContext>;

// Lighter resolve for teacher-side (no student profile)
export async function resolveTeacherContext(
  supabase: SupabaseClient,
  classId: string,
  unitId: string
): Promise<Omit<ResolvedContext, 'studentProfile' | 'mentorId' | 'themeId' | 'openStudioStatus'>>;

// Content-only resolve (most common case)
export async function resolveContent(
  supabase: SupabaseClient,
  unitId: string,
  classId: string
): Promise<{ content: NormalizedContent; source: 'fork' | 'master' }>;

// Utility: check if content_data has actual pages (Lesson Learned #27)
export function hasContent(data: any): boolean;

// Utility: normalize any content version to v2 pages array
export function normalizeContent(raw: any): NormalizedContent;
```

**What it owns:**
- Content resolution chain (`class_units.content_data` → `units.content_data`)
- Content normalization (4 versions → v2 format)
- Config resolution chains (class-unit → unit → defaults)
- The `hasContent()` utility (Lesson Learned #27)

**What it does NOT own:**
- The underlying tables (owned by Content and Scheduling modules)
- Writing content (owned by Content module)
- Writing config (owned by respective modules)

**Migration from current state:**
- Move `src/lib/units/resolve-content.ts` here (it's already 80% of this service)
- Move `src/lib/unit-adapter.ts` normalizeContentData here
- Add framework, NM, scheduling, and student profile resolution
- Update all files using `resolveClassUnitContent()` to use `@/os/entity`

---

### 3.5 Event Bus — `src/os/events/`

**Problem it solves:** When a student submits a response, nothing notifies the insights panel, integrity analyzer, activity tracker, student profile, or teacher dashboard. Everything is computed on-demand, which means the Smart Insights panel re-queries all student_progress on every dashboard load. Events allow downstream consumers to react without the source module knowing about them.

**Public API:**

```typescript
// src/os/events/index.ts

// ── Event Types ──
export type EventType =
  // Student activity
  | 'student.response.saved'
  | 'student.page.completed'
  | 'student.unit.completed'
  | 'student.feedback.submitted'
  | 'student.tool.session.completed'
  | 'student.discovery.completed'
  | 'student.badge.earned'
  | 'student.gallery.submitted'
  | 'student.gallery.reviewed'
  // Teacher activity
  | 'teacher.unit.created'
  | 'teacher.unit.edited'
  | 'teacher.lesson.taught'
  | 'teacher.observation.recorded'
  | 'teacher.grade.saved'
  | 'teacher.badge.created'
  | 'teacher.gallery.round.created'
  // System
  | 'content.forked'
  | 'content.version.saved'
  | 'generation.completed'
  | 'ingestion.completed';

export interface Event<T = any> {
  type: EventType;
  timestamp: string;       // ISO 8601
  source: string;          // module name that emitted it
  payload: T;
  metadata?: {
    userId?: string;
    classId?: string;
    unitId?: string;
  };
}

// Publish an event (fire-and-forget — never blocks the caller)
export function publish(event: Event): void;

// Subscribe to events (called at module initialization)
export function subscribe(
  type: EventType | EventType[],
  handler: (event: Event) => Promise<void>
): () => void;  // returns unsubscribe function
```

**Implementation (v1 — simple):**

For v1, this is an in-memory pub/sub within the same Node.js process. Events fire asynchronously (non-blocking). Handlers run in try/catch so a failing subscriber never crashes the publisher. This is intentionally simple — no Kafka, no Redis, no external queue. When StudioLoom needs cross-process events (e.g., separate worker for background jobs), upgrade to Supabase Realtime or a lightweight queue. The interface stays the same.

```typescript
// Internal implementation sketch
const subscribers = new Map<EventType, Set<Handler>>();

export function publish(event: Event): void {
  const handlers = subscribers.get(event.type) || new Set();
  for (const handler of handlers) {
    // Non-blocking — errors logged, never thrown
    handler(event).catch(err => {
      Sentry.captureException(err, { extra: { event } });
    });
  }
}
```

**Migration from current state:**
- No existing event system to migrate from — this is net-new
- Wire incrementally: start with `student.response.saved` (highest-value event), then add others as modules adopt the pattern
- Smart Insights panel becomes a subscriber instead of re-querying everything

---

### 3.6 Config Service — `src/os/config/`

**Problem it solves:** Features are hardwired on/off. You can't disable the toolkit for a school, gate Melbourne Metrics behind a tier, or turn off Discovery for a class. The monetisation project needs feature gating. Multi-school deployment needs per-school config. Module extraction for Makloom needs to know which modules are active.

**Public API:**

```typescript
// src/os/config/index.ts

export type FeatureFlag =
  | 'toolkit'           // Design Thinking Toolkit
  | 'discovery'         // Discovery Engine
  | 'gallery'           // Class Gallery & Peer Review
  | 'openStudio'        // Open Studio
  | 'safetyBadges'      // Safety Badge System
  | 'newMetrics'        // Melbourne Metrics
  | 'integrity'         // Academic Integrity Monitoring
  | 'teachingMode'      // Live Teaching Cockpit
  | 'scheduling'        // Timetable & Calendar
  | 'generation'        // AI Unit Generation (currently quarantined)
  | 'knowledge'         // Knowledge Pipeline (currently quarantined)
  | 'reporting'         // Report Writer free tool
  | 'gamification'      // Student Levels (future)
  | 'realClient'        // Real Client Journey (future)
  | '3dElements';       // 3D Visual Layer (future)

export type Tier = 'free' | 'starter' | 'professional' | 'enterprise';

// Check if a feature is enabled for a given scope
export function isEnabled(
  flag: FeatureFlag,
  scope?: { schoolId?: string; teacherId?: string; classId?: string }
): boolean;

// Get the tier for a teacher/school
export function getTier(
  scope: { schoolId?: string; teacherId?: string }
): Tier;

// Get all enabled features for a scope
export function getEnabledFeatures(
  scope?: { schoolId?: string; teacherId?: string }
): FeatureFlag[];

// Admin: set feature flag
export function setFlag(
  flag: FeatureFlag,
  enabled: boolean,
  scope?: { schoolId?: string; teacherId?: string; classId?: string }
): void;
```

**Implementation (v1):**
- All features default to enabled (current behaviour)
- Quarantined features (`generation`, `knowledge`) default to disabled
- No database table needed for v1 — use a simple config object
- When monetisation ships, add `feature_flags` table + tier lookup

---

### 3.7 Notification Service — `src/os/notify/`

**Problem it solves:** The event bus handles internal module communication (subscriber reacts to publisher). But nothing handles **outbound communication** — telling a student they earned a badge, emailing a parent their weekly update, showing a teacher a toast that a student needs help. Currently, the only "notifications" are polling-based (Teaching Mode polls every 30s, dashboard refreshes). There's no way to proactively reach a user.

**Public API:**

```typescript
// src/os/notify/index.ts

export type Channel = 'in_app' | 'email' | 'push';  // push = future

export type NotificationType =
  | 'badge_earned'           // student earned a safety badge
  | 'gallery_feedback_ready' // peer reviews unlocked
  | 'needs_help'             // student flagged in Teaching Mode
  | 'stale_work'             // completed work sitting unmarked
  | 'unit_complete'          // student finished all pages
  | 'integrity_flag'         // suspicious writing patterns detected
  | 'generation_complete'    // AI unit generation finished
  | 'parent_weekly'          // weekly parent digest
  | 'system_alert';          // admin system notifications

export interface Notification {
  type: NotificationType;
  recipientId: string;       // user who receives it
  recipientRole: Role;
  title: string;
  body: string;
  channels: Channel[];       // which channels to use
  actionUrl?: string;        // deep link into StudioLoom
  metadata?: Record<string, any>;
}

// Send a notification (non-blocking, like events)
export function send(notification: Notification): void;

// Get unread notifications for a user
export async function getUnread(userId: string): Promise<Notification[]>;

// Mark as read
export async function markRead(userId: string, notificationIds: string[]): Promise<void>;

// User preferences (which types, which channels)
export async function getPreferences(userId: string): Promise<NotificationPreferences>;
export async function setPreferences(userId: string, prefs: Partial<NotificationPreferences>): Promise<void>;
```

**Implementation (v1 — simple):**
- In-app only (no email for v1 — email requires transactional email provider like Resend/Postmark)
- `notifications` table (recipient_id, type, title, body, read_at, created_at)
- Notification bell icon in teacher/student headers with unread count badge
- Event bus subscribers call `notify.send()` to create notifications from events

**Implementation (v2 — email):**
- Add email channel via Resend or Postmark
- Parent Weekly Updates become email notifications
- Teacher daily digest (summary of overnight student activity)
- Unsubscribe links per notification type

**What it owns:**
- `notifications` table (future)
- `notification_preferences` table (future)
- Delivery logic per channel

**What it does NOT own:**
- Deciding WHEN to notify (domain modules and event subscribers make that call)
- Email templates (modules provide content, Notification service handles delivery)

---

### 3.8 Storage Service — `src/os/storage/`

**Problem it solves:** File uploads are scattered across the codebase — knowledge base PDFs go through one path, unit thumbnails through another, Quick Sketch canvas exports through a third, portfolio images through a fourth. Each handles Supabase Storage differently. There's no centralised file validation, compression, virus scanning, or CDN management.

**Public API:**

```typescript
// src/os/storage/index.ts

export type StorageBucket =
  | 'knowledge'      // uploaded teaching materials (PDF, DOCX, PPTX)
  | 'thumbnails'     // unit thumbnail images
  | 'portfolio'      // student portfolio uploads
  | 'canvas'         // Quick Sketch / canvas exports
  | 'avatars'        // future: student/teacher profile images
  | 'assets';        // future: 3D models, audio files

export interface UploadResult {
  url: string;           // public or signed URL
  path: string;          // storage path for deletion/reference
  bucket: StorageBucket;
  sizeBytes: number;
  mimeType: string;
  metadata?: Record<string, any>;
}

// Upload a file with validation and compression
export async function upload(
  bucket: StorageBucket,
  file: File | Buffer,
  options?: {
    maxSizeMB?: number;          // default per bucket
    allowedMimeTypes?: string[]; // default per bucket
    compress?: boolean;          // default true for images
    maxDimension?: number;       // default 1200px for images
    ownerId: string;             // teacher or student ID for access control
  }
): Promise<UploadResult>;

// Get a signed URL (for private buckets)
export async function getSignedUrl(path: string, expiresIn?: number): Promise<string>;

// Delete a file
export async function remove(path: string): Promise<void>;

// List files for an owner (for cleanup, quota checks)
export async function listByOwner(ownerId: string, bucket: StorageBucket): Promise<StorageFile[]>;
```

**What it owns:**
- All Supabase Storage bucket configuration
- File validation rules per bucket (max size, allowed MIME types)
- Image compression (currently done ad-hoc with sharp in upload routes)
- Future: virus scanning, CDN cache invalidation, storage quota enforcement

**What it does NOT own:**
- Business logic about what files mean (knowledge pipeline decides what to do with a PDF; Content module decides what a thumbnail is)
- File metadata beyond storage concerns (analysis results, embedding vectors — owned by Ingestion)

**Migration from current state:**
- Move image compression logic from upload routes → `src/os/storage/internal/compress.ts`
- Move Supabase Storage calls from scattered routes → `storage.upload()`
- Move thumbnail upload from `/api/teacher/unit-thumbnail` → uses `storage.upload('thumbnails', ...)`
- Add per-bucket validation (knowledge: max 50MB, PDF/DOCX/PPTX; thumbnails: max 5MB, image/*; canvas: max 10MB, image/png)

---

## 4. The Domain Modules (11 Organs)

Each module lives at `src/modules/<name>/`. Each has:
- `index.ts` — the public API (the ONLY file other modules may import)
- `types.ts` — types exported for other modules to use
- `internal/` — private implementation files
- `routes/` — API route handlers (called from `src/app/api/` route files, which become thin wrappers)

### Module Map

```
src/modules/
├── content/          # Units, pages, activities, forks, versions, block library
├── generation/       # Wizard, 6-stage pipeline, Pulse scoring (Dimensions3)
├── ingestion/        # Upload, analysis, knowledge base, block extraction
├── delivery/         # Student lesson rendering, responses, progress tracking
├── assessment/       # Grading, integrity, Melbourne Metrics, portfolio
├── mentoring/        # Design Assistant, toolkit AI, Open Studio AI, Discovery AI
├── scheduling/       # Calendar, timetable, cycle engine, lesson dates
├── cockpit/          # Teacher dashboard, Teaching Mode, Insights, class mgmt
├── journey/          # Student onboarding, Discovery, toolkit, gallery, badges
├── admin/            # System config, sandbox, cost monitoring, health
├── analytics/        # Intelligence profiles, signal aggregation, telemetry
```

---

### 4.1 Content Module — `src/modules/content/`

**Owns:** The data structures that define what teachers create and students consume.

**Tables owned:**
- `units` — master content templates
- `class_units` — per-class configuration + content forks
- `unit_versions` — version history
- `activity_blocks` — reusable activity library (Dimensions3)
- `generation_feedback` — teacher edit tracking on blocks

**Public API (key functions):**

```typescript
export function getUnit(unitId: string): Promise<Unit>;
export function getClassUnit(unitId: string, classId: string): Promise<ClassUnit>;
export function saveContent(unitId: string, classId: string, content: ContentData): Promise<void>;
export function forkContent(unitId: string, classId: string): Promise<void>;
export function resetToMaster(unitId: string, classId: string): Promise<void>;
export function saveVersion(unitId: string, classId: string, label: string): Promise<void>;

// Activity Block Library (Dimensions3)
export function searchBlocks(query: BlockSearchQuery): Promise<RankedBlock[]>;
export function getBlock(blockId: string): Promise<ActivityBlock>;
export function saveBlock(block: ActivityBlock): Promise<void>;
export function updateBlockEfficacy(blockId: string, signal: EfficacySignal): Promise<void>;
```

**Events published:**
- `content.forked` — when a class fork is created
- `content.version.saved` — when a version snapshot is saved
- `teacher.unit.edited` — when content is modified

**Events subscribed to:**
- `teacher.grade.saved` — to update block efficacy scores
- `teacher.lesson.taught` — to update block usage counts

**Depends on:** OS Auth, OS Entity (for resolution), OS Taxonomy (for criteria/phases), OS Events

---

### 4.2 Generation Module — `src/modules/generation/`

**Owns:** The Dimensions3 6-stage pipeline that creates new content.

**Tables owned:**
- No exclusive tables — writes to `units` and `activity_blocks` via Content module API

**Public API:**

```typescript
export function generateUnit(request: GenerationRequest): AsyncGenerator<GenerationProgress>;
export function regeneratePage(unitId: string, pageId: string, request: RegenerationRequest): Promise<Page>;
export function scoreLessonPulse(page: Page): PulseScore;
export function repairLesson(page: Page, weakDimension: string): Promise<Page>;
```

**The 6 pipeline stages (from Dimensions3):**
1. Input Collection → `GenerationRequest`
2. Block Retrieval → `CandidateBlocks[]` (via Content module)
3. Sequence Assembly → `AssembledSequence`
4. Gap Generation → `FilledSequence`
5. Connective Tissue & Polish → `PolishedUnit`
6. Timing & Structure + Quality Scoring → `ScoredUnit`

**Events published:**
- `generation.completed` — when a unit is fully generated

**Depends on:** OS AI (all LLM calls), OS Taxonomy (frameworks, bloom, phases), Content module (block library), OS Entity (teacher context)

**Currently quarantined.** All routes return 410 Gone. This module is the Dimensions3 rebuild.

---

### 4.3 Ingestion Module — `src/modules/ingestion/`

**Owns:** Everything about uploading and analyzing teaching materials.

**Tables owned:**
- `knowledge_uploads` — uploaded files
- `knowledge_items` — processed knowledge entries
- `knowledge_chunks` — RAG-ready chunks with embeddings
- `lesson_profiles` — analyzed lesson intelligence

**Public API:**

```typescript
export function uploadDocument(file: File, teacherId: string): Promise<Upload>;
export function analyzeDocument(uploadId: string): Promise<AnalysisResult>;
export function retrieveContext(query: string, filters: RetrievalFilters): Promise<RetrievedChunk[]>;
export function retrieveLessonProfiles(filters: ProfileFilters): Promise<LessonProfile[]>;
export function convertToUnit(uploadId: string): Promise<Unit>; // Lesson Plan Converter
export function extractBlocks(uploadId: string): Promise<ActivityBlock[]>; // Block extraction
```

**Events published:**
- `ingestion.completed` — when analysis finishes

**Depends on:** OS AI (analysis calls), OS Taxonomy (bloom/UDL tagging), Content module (to save extracted blocks)

**Currently quarantined.** Being rebuilt as part of Dimensions3.

---

### 4.4 Delivery Module — `src/modules/delivery/`

**Owns:** How students experience lessons and how their work is captured.

**Tables owned:**
- `student_progress` — per-page responses, time, status, integrity metadata
- `planning_tasks` — student task planner
- `student_tool_sessions` — toolkit session persistence

**Public API:**

```typescript
export function getStudentProgress(studentId: string, unitId: string): Promise<Progress[]>;
export function saveResponse(studentId: string, unitId: string, pageId: string, response: ResponseData): Promise<void>;
export function saveIntegrityMetadata(studentId: string, unitId: string, pageId: string, metadata: IntegrityMetadata): Promise<void>;
export function getToolSession(sessionId: string): Promise<ToolSession>;
export function saveToolSession(session: ToolSession): Promise<void>;
export function trackActivity(studentId: string, pageId: string, tracking: ActivityTracking): Promise<void>;
```

**Events published:**
- `student.response.saved` — after every response save
- `student.page.completed` — when all required activities on a page are done
- `student.unit.completed` — when all pages completed
- `student.tool.session.completed` — when a toolkit session is marked complete

**Events subscribed to:**
- `student.badge.earned` — to update badge gate state on lesson pages

**Depends on:** OS Auth (student verification), OS Entity (content + config resolution), OS Events

---

### 4.5 Assessment Module — `src/modules/assessment/`

**Owns:** Grading, academic integrity analysis, Melbourne Metrics, and portfolio.

**Tables owned:**
- `assessment_records` — criterion grades per student per unit per class
- `competency_assessments` — Melbourne Metrics self/teacher ratings
- `portfolio_entries` — student portfolio
- `lesson_feedback` — pace feedback (student→timing model)

**Public API:**

```typescript
// Grading
export function getGrades(classId: string, unitId: string): Promise<StudentGrades[]>;
export function saveGrade(studentId: string, unitId: string, classId: string, grades: CriterionScores): Promise<void>;

// Integrity
export function analyzeIntegrity(metadata: IntegrityMetadata): IntegrityReport;

// Melbourne Metrics
export function getNMConfig(classId: string, unitId: string): Promise<NMConfig | null>;
export function saveNMConfig(classId: string, unitId: string, config: NMConfig): Promise<void>;
export function saveStudentAssessment(assessment: CompetencyAssessment): Promise<void>;
export function saveTeacherObservation(observation: TeacherObservation): Promise<void>;
export function getNMResults(classId: string, unitId: string): Promise<NMResults>;

// Portfolio
export function getPortfolio(studentId: string): Promise<PortfolioEntry[]>;

// Pace feedback
export function savePaceFeedback(studentId: string, pageId: string, pace: PaceRating): Promise<void>;
export function getPaceDistribution(unitId: string, classId: string): Promise<PaceDistribution>;
```

**Events published:**
- `teacher.grade.saved`
- `teacher.observation.recorded`
- `student.feedback.submitted`

**Events subscribed to:**
- `student.response.saved` — to flag integrity data for review in Insights
- `student.unit.completed` — to mark unit as ready-to-grade in teacher view

**Depends on:** OS Auth, OS Taxonomy (framework-specific grading scales), OS AI (future: AI-assisted grading)

---

### 4.6 Mentoring Module — `src/modules/mentoring/`

**Owns:** All AI-to-student interactions. The "personality" of the platform.

**Tables owned:**
- `design_conversations` — Design Assistant conversation history
- `design_conversation_turns` — individual messages

**Public API:**

```typescript
// Design Assistant (guided + Open Studio modes)
export function chat(
  studentId: string,
  unitId: string,
  message: string,
  mode: 'guided' | 'openStudio'
): Promise<MentorResponse>;

// Toolkit AI (per-tool feedback)
export function getToolFeedback(
  toolId: string,
  stepId: string,
  studentInput: string,
  context: ToolFeedbackContext
): Promise<ToolNudge>;

// Discovery AI (9 reflection types)
export function getDiscoveryReflection(
  type: DiscoveryReflectionType,
  studentInput: string,
  profile: Partial<DiscoveryProfile>
): Promise<string>;

// Open Studio check-in
export function getCheckIn(
  type: CheckInType,
  sessionContext: OpenStudioSessionContext,
  studentProfile?: StudentLearningProfile
): Promise<string>;
```

**Events subscribed to:**
- `student.discovery.completed` — to update Design Assistant with student profile
- `student.response.saved` — to pre-compute mentor context for next interaction

**Depends on:** OS AI (all LLM calls), OS Taxonomy (phase-aware feedback rules), OS Entity (student profile + content context), Content module (for RAG context via Ingestion)

---

### 4.7 Scheduling Module — `src/modules/scheduling/`

**Owns:** Everything about when things happen.

**Tables owned:**
- `school_calendar_terms` — academic terms
- `school_timetable` — cycle configuration
- `class_meetings` — per-class meeting schedule

**Public API:**

```typescript
export function getCycleDay(date: Date, timetable: Timetable): number;
export function getNextClassDate(classId: string, timetable: Timetable, fromDate?: Date): Date | null;
export function getLessonCount(classId: string, startDate: Date, endDate: Date): number;
export function getScheduleForRange(classId: string, start: Date, end: Date): ScheduledMeeting[];
export function getTerms(teacherId: string): Promise<Term[]>;
export function saveTerms(teacherId: string, terms: Term[]): Promise<void>;
export function getTimetable(teacherId: string): Promise<Timetable>;
export function saveTimetable(teacherId: string, timetable: Timetable): Promise<void>;
export function parseICal(content: string, classes: Class[]): ParsedCalendar;
```

**Events published:**
- (future) `scheduling.term.changed` — to trigger schedule recalculation

**Depends on:** OS Auth (teacher verification only). This module is intentionally isolated — it's pure computation + config storage.

---

### 4.8 Teacher Cockpit Module — `src/modules/cockpit/`

**Owns:** The teacher's command center — dashboard, Teaching Mode, Smart Insights, class management.

**Tables owned:**
- `classes` — class definitions (shared ownership with Content for class_units)
- `class_students` — enrollment junction (shared write with Student Journey for enrollment)
- `teacher_profiles` — extended teacher data (style profile, school info, preferences)

**Public API:**

```typescript
// Dashboard
export function getDashboardData(teacherId: string): Promise<DashboardData>;
export function getInsights(teacherId: string): Promise<DashboardInsight[]>;

// Teaching Mode
export function getLiveStatus(classId: string, unitId: string): Promise<LiveStudentStatus[]>;

// Class management
export function createClass(teacherId: string, data: CreateClassInput): Promise<Class>;
export function addStudent(classId: string, student: CreateStudentInput): Promise<Student>;
export function enrollStudent(studentId: string, classId: string): Promise<void>;

// Teacher profile
export function getTeacherProfile(teacherId: string): Promise<TeacherProfile>;
export function updateTeacherProfile(teacherId: string, data: Partial<TeacherProfile>): Promise<void>;
```

**Events subscribed to:**
- `student.response.saved` — to update live Teaching Mode grid
- `student.unit.completed` — to generate insight
- `teacher.grade.saved` — to clear "stale unmarked" insights

**Depends on:** OS Auth, OS Entity, Delivery module (progress data), Assessment module (grades, integrity), Scheduling module (next class dates)

---

### 4.9 Student Journey Module — `src/modules/journey/`

**Owns:** The student's experience beyond lessons — onboarding, discovery, toolkit, gallery, safety badges, gamification.

**Tables owned:**
- `students` — student records (identity, profile, mentor, theme)
- `discovery_sessions` — Discovery Engine sessions
- `gallery_rounds` — gallery critique rounds
- `gallery_submissions` — student gallery submissions
- `gallery_reviews` — peer reviews
- `badges` — badge definitions
- `student_badges` — earned badges
- `unit_badge_requirements` — badge prerequisites
- `safety_sessions` + `safety_results` — badge test tracking
- `open_studio_status` — Open Studio unlock state
- `open_studio_sessions` — Open Studio working sessions

**Public API:**

```typescript
// Onboarding
export function getOnboardingStatus(studentId: string): Promise<OnboardingStatus>;
export function completeOnboarding(studentId: string, choices: OnboardingChoices): Promise<void>;

// Discovery
export function getDiscoverySession(studentId: string, unitId: string): Promise<DiscoverySession>;
export function saveDiscoveryState(sessionId: string, state: DiscoveryState): Promise<void>;

// Toolkit
export function getToolkitTools(): ToolDefinition[];
export function getToolData(toolId: string): ToolDefinition;

// Gallery
export function createGalleryRound(classId: string, unitId: string, config: GalleryConfig): Promise<GalleryRound>;
export function submitToGallery(roundId: string, studentId: string, submission: GallerySubmission): Promise<void>;
export function submitReview(submissionId: string, reviewerId: string, review: GalleryReview): Promise<void>;
export function getStudentFeedback(roundId: string, studentId: string): Promise<GalleryFeedback>;

// Safety badges
export function checkBadgeRequirements(studentId: string, unitId: string): Promise<BadgeGateResult>;
export function submitBadgeTest(studentId: string, badgeId: string, answers: BadgeAnswers): Promise<BadgeTestResult>;

// Open Studio
export function getOpenStudioStatus(studentId: string, unitId: string): Promise<OpenStudioStatus>;
export function startOpenStudioSession(studentId: string, unitId: string): Promise<OpenStudioSession>;
export function grantOpenStudio(studentId: string, unitId: string, teacherId: string): Promise<void>;
```

**Events published:**
- `student.discovery.completed`
- `student.badge.earned`
- `student.gallery.submitted`
- `student.gallery.reviewed`
- `student.tool.session.completed` (forwarded from Delivery)

**Depends on:** OS Auth, OS Taxonomy, OS AI (Discovery + toolkit AI via Mentoring module), Delivery module (tool sessions), Content module (badge definitions linked to units)

---

### 4.10 Admin Module — `src/modules/admin/`

**Owns:** System administration, monitoring, and configuration.

**Tables owned:**
- `ai_model_config` — global AI settings
- `ai_model_config_history` — config change history

**Public API:**

```typescript
export function getSystemHealth(): Promise<SystemHealth>;
export function getAIConfig(): Promise<AIModelConfig>;
export function updateAIConfig(config: Partial<AIModelConfig>): Promise<void>;
export function getCostReport(period: DateRange): Promise<CostReport>;
export function getUsageStats(period: DateRange): Promise<UsageStats>;
```

**Depends on:** OS AI (usage data), OS Config (feature flags), OS Auth (admin verification)

---

### 4.11 Analytics Module — `src/modules/analytics/`

**Owns:** Intelligence profiles, signal aggregation, and usage telemetry. This is the "learning loop" that makes the system smarter over time — it reads signals from every other module and computes running profiles.

**Why it's a separate module (not part of Cockpit or Admin):**
Intelligence Profiles (Student, Teacher, Class Climate) aggregate data from Delivery (progress, time-on-task), Assessment (grades, integrity), Journey (Discovery archetype, toolkit sessions, badges), Mentoring (conversation patterns), and Scheduling (pacing data). No existing module should depend on that many siblings. Analytics is a read-heavy aggregation layer that subscribes to events and periodically recomputes profiles. It's the closest thing to a "data warehouse" in the domain layer.

**Tables owned:**
- `student_intelligence_profiles` — running student profile (JSONB, updated incrementally via EMA α=0.3)
- `teacher_intelligence_profiles` — running teacher style/preference profile
- `class_climate_profiles` — per-class aggregate profile
- `analytics_events` — raw signal log (future, for replay/recomputation)

**Public API:**

```typescript
// Read profiles (other modules consume these)
export function getStudentProfile(studentId: string): Promise<StudentIntelligenceProfile | null>;
export function getTeacherProfile(teacherId: string): Promise<TeacherIntelligenceProfile | null>;
export function getClassClimate(classId: string): Promise<ClassClimateProfile | null>;

// Format profile as AI-readable context (~200-300 tokens)
export function formatProfileForAI(profile: StudentIntelligenceProfile): string;
export function formatTeacherStyleForAI(profile: TeacherIntelligenceProfile): string;

// Manual signal ingestion (for signals not captured via events)
export function recordSignal(signal: AnalyticsSignal): void;

// Product telemetry (for Plausible/PostHog, not student PII)
export function trackUsage(event: UsageEvent): void;
```

**Events subscribed to (primary data sources):**
- `student.response.saved` — time-on-task, effort signals, response quality
- `student.tool.session.completed` — toolkit engagement patterns
- `student.discovery.completed` — archetype, working style, interests
- `student.feedback.submitted` — pace self-assessment
- `teacher.grade.saved` — criterion score patterns, grade distributions
- `teacher.unit.edited` — teaching style signals (what teachers change)
- `teacher.lesson.taught` — pacing patterns, extension usage
- `teacher.observation.recorded` — competency observation patterns

**Depends on:** OS Events (primary input), OS Auth (scope verification). Read-only access to other modules' public APIs for enrichment.

**Migration from current state:**
- Intelligence Profiles project (PLANNED, Phase 3.5) becomes this module
- Smart Insights computation currently in Cockpit could eventually delegate profile reads to Analytics
- Teacher style profile (`teacher_profiles.style_profile` JSONB) migrates to `teacher_intelligence_profiles`

---

## 5. Data Ownership Matrix

Every table has exactly one owning module. Other modules access the data through the owner's public API, never by direct query.

| Table | Owner | Read Access | Write Access |
|-------|-------|-------------|-------------|
| `teachers` | **Cockpit** | Auth (verify), Admin | Cockpit |
| `teacher_profiles` | **Cockpit** | Mentoring (style), Generation (style) | Cockpit |
| `classes` | **Cockpit** | Entity resolver, many modules | Cockpit |
| `class_students` | **Cockpit** | Entity resolver, Journey | Cockpit, Journey |
| `students` | **Journey** | Auth, Entity resolver, Cockpit | Journey |
| `student_sessions` | **Auth (OS)** | — | Auth |
| `units` | **Content** | Entity resolver, many modules | Content, Generation |
| `class_units` | **Content** | Entity resolver, many modules | Content, Assessment (NM config) |
| `unit_versions` | **Content** | Cockpit (version history UI) | Content |
| `activity_blocks` | **Content** | Generation (retrieval), Ingestion (extraction) | Content, Ingestion, Generation |
| `generation_feedback` | **Content** | Generation (efficacy) | Content |
| `knowledge_uploads` | **Ingestion** | Cockpit (knowledge library UI) | Ingestion |
| `knowledge_items` | **Ingestion** | Cockpit (knowledge library UI) | Ingestion |
| `knowledge_chunks` | **Ingestion** | Mentoring (RAG context) | Ingestion |
| `lesson_profiles` | **Ingestion** | Generation, Mentoring | Ingestion |
| `student_progress` | **Delivery** | Cockpit (dashboard), Assessment (grading) | Delivery |
| `planning_tasks` | **Delivery** | Cockpit (student view) | Delivery |
| `student_tool_sessions` | **Delivery** | Journey (session resume) | Delivery |
| `assessment_records` | **Assessment** | Cockpit (grade display) | Assessment |
| `competency_assessments` | **Assessment** | Cockpit (NM results) | Assessment |
| `portfolio_entries` | **Assessment** | Cockpit (portfolio view) | Assessment, Delivery |
| `lesson_feedback` | **Assessment** | Scheduling (timing model) | Assessment |
| `design_conversations` | **Mentoring** | — | Mentoring |
| `design_conversation_turns` | **Mentoring** | — | Mentoring |
| `school_calendar_terms` | **Scheduling** | Entity resolver, Cockpit | Scheduling |
| `school_timetable` | **Scheduling** | Entity resolver, Cockpit | Scheduling |
| `class_meetings` | **Scheduling** | Scheduling (internal) | Scheduling |
| `discovery_sessions` | **Journey** | Mentoring (profile context) | Journey |
| `gallery_rounds` | **Journey** | Cockpit (gallery tab) | Journey |
| `gallery_submissions` | **Journey** | Cockpit (gallery monitor) | Journey |
| `gallery_reviews` | **Journey** | Cockpit (gallery monitor) | Journey |
| `badges` | **Journey** | Cockpit (badge management) | Journey |
| `student_badges` | **Journey** | Delivery (badge gate), Cockpit | Journey |
| `unit_badge_requirements` | **Journey** | Delivery (badge gate) | Journey |
| `safety_sessions` | **Journey** | Cockpit (results view) | Journey |
| `safety_results` | **Journey** | Cockpit (results view) | Journey |
| `open_studio_status` | **Journey** | Mentoring (AI mode switch) | Journey, Cockpit |
| `open_studio_sessions` | **Journey** | Cockpit (session monitor) | Journey |
| `ai_usage_log` | **AI (OS)** | Admin (cost reports) | AI |
| `ai_model_config` | **Admin** | AI service (model selection) | Admin |
| `ai_settings` | **Admin** | AI service (per-teacher config) | Admin, Cockpit |
| `notifications` | **Notify (OS)** | Cockpit (bell UI) | Notify |
| `notification_preferences` | **Notify (OS)** | Cockpit (settings UI) | Notify |
| `student_intelligence_profiles` | **Analytics** | Mentoring (AI context), Generation (adaptation) | Analytics |
| `teacher_intelligence_profiles` | **Analytics** | Generation (style adaptation), Cockpit (display) | Analytics |
| `class_climate_profiles` | **Analytics** | Cockpit (class overview), Generation (context) | Analytics |

---

## 6. Dependency Rules

### 6.1 The Dependency Graph

```
                         ┌──────────┐
                         │  Admin   │
                         └────┬─────┘
                              │
    ┌─────────┐         ┌────▼─────┐         ┌──────────┐
    │Cockpit  │◄────────│ OS Layer │────────►│ Journey  │
    └────┬────┘         └──┬───┬───┘         └────┬─────┘
         │                 │   │                   │
    ┌────▼────┐     ┌──────▼┐ ┌▼────────┐    ┌───▼──────┐
    │Delivery │◄────│Content│ │Analytics│    │Mentoring │
    └────┬────┘     └──┬────┘ └─────────┘    └──────────┘
         │             │
    ┌────▼────┐  ┌─────▼─────┐  ┌──────────┐
    │Assess-  │  │Generation │  │Scheduling│
    │ment     │  └───────────┘  └──────────┘
    └─────────┘  ┌───────────┐
                 │Ingestion  │
                 └───────────┘
```

### 6.2 Import Rules

| Module | Can import from |
|--------|----------------|
| **OS services** | Infrastructure only (Supabase, Anthropic SDK). Never domain modules. |
| **Content** | OS services only |
| **Scheduling** | OS services only |
| **Ingestion** | OS services, Content (to save extracted blocks) |
| **Generation** | OS services, Content (block library), Ingestion (RAG context) |
| **Delivery** | OS services, Content (for page rendering), Journey (badge gates) |
| **Assessment** | OS services, Delivery (progress data), Content (unit/page structure) |
| **Mentoring** | OS services, Content (RAG context via Ingestion), Delivery (student context), Journey (Discovery profile) |
| **Cockpit** | OS services, ALL domain modules (it's the aggregation layer for teachers) |
| **Journey** | OS services, Delivery (tool sessions), Content (badge-unit links), Mentoring (AI interactions) |
| **Admin** | OS services, Content (block library health), Generation (pipeline monitoring), Analytics (system telemetry) |
| **Analytics** | OS services (Events primary), read-only access to other modules' public APIs for enrichment |

### 6.3 Forbidden Imports

These combinations would create circular dependencies or violate boundaries:

- **Content** must NEVER import from Generation (content doesn't know how it was created)
- **Delivery** must NEVER import from Assessment (progress doesn't know about grades)
- **Scheduling** must NEVER import from any domain module (it's pure computation)
- **OS services** must NEVER import from any domain module (the kernel doesn't know about organs)
- **No module** may import from another module's `internal/` directory

---

## 7. Cross-Module Communication Patterns

### 7.1 Request-Response (Synchronous)

For data that the caller needs immediately to complete its operation.

**Example:** Student lesson page needs content + progress + badge gate status.

```typescript
// src/app/(student)/unit/[unitId]/[pageId]/page.tsx (presentation layer)
import { resolveContext } from '@/os/entity';
import { getStudentProgress } from '@/modules/delivery';
import { checkBadgeRequirements } from '@/modules/journey';

const ctx = await resolveContext(supabase, studentId, classId, unitId);
const progress = await getStudentProgress(studentId, unitId);
const badgeGate = await checkBadgeRequirements(studentId, unitId);
```

### 7.2 Events (Asynchronous)

For side effects that the caller doesn't need to wait for.

**Example:** Student saves a response → triggers integrity analysis + insights update + activity tracking.

```typescript
// Inside delivery module (the publisher)
import { publish } from '@/os/events';

async function saveResponse(studentId, unitId, pageId, data) {
  // 1. Write to database (the primary action)
  await supabase.from('student_progress').upsert({ ... });

  // 2. Fire event (non-blocking, fire-and-forget)
  publish({
    type: 'student.response.saved',
    source: 'delivery',
    payload: { studentId, unitId, pageId, hasIntegrity: !!data.integrityMetadata },
    metadata: { userId: studentId, unitId }
  });
}

// Inside assessment module (a subscriber, registered at app startup)
import { subscribe } from '@/os/events';

subscribe('student.response.saved', async (event) => {
  if (event.payload.hasIntegrity) {
    // Update integrity flag cache for Smart Insights
    await flagForReview(event.payload.studentId, event.payload.unitId);
  }
});

// Inside cockpit module (another subscriber)
subscribe('student.response.saved', async (event) => {
  // Invalidate cached insights for this teacher
  await invalidateInsightsCache(event.metadata.unitId);
});
```

### 7.3 Resolution Chain (Read-Through)

For data that has cascading fallbacks (class → unit → system default).

**Example:** Get NM config with class_units → units → default fallback.

```typescript
// Inside entity resolver
async function resolveNMConfig(classId: string, unitId: string): Promise<NMConfig | null> {
  // 1. Check class-unit override
  const classUnit = await supabase.from('class_units')
    .select('nm_config')
    .eq('class_id', classId).eq('unit_id', unitId)
    .maybeSingle();

  if (classUnit?.nm_config?.enabled) return classUnit.nm_config;

  // 2. Check unit default
  const unit = await supabase.from('units')
    .select('nm_config')
    .eq('id', unitId)
    .maybeSingle();

  if (unit?.nm_config?.enabled) return unit.nm_config;

  // 3. System default
  return null; // NM not enabled
}
```

---

## 8. Testing Architecture

Every module is testable in isolation. Every migration step is verified before and after. This section defines the testing pyramid, mock infrastructure, and contract testing approach that makes LoomOS safe to evolve.

### 8.1 Testing Pyramid

```
           /  E2E  \           ~5 tests    (Playwright, critical paths only)
          /─────────\
         / Integration\        ~30 tests   (cross-module flows, real DB)
        /───────────────\
       /  Contract Tests  \    ~80 tests   (module public API boundaries)
      /─────────────────────\
     /     Unit Tests         \ ~300 tests  (pure functions, internal logic)
    /───────────────────────────\
```

**Unit tests** (Vitest) — pure functions with no I/O. Timing validation, cycle engine, integrity analysis, Pulse scoring, taxonomy lookups, content normalization. These run in <5 seconds and catch logic bugs. **Every PR must pass unit tests.**

**Contract tests** (Vitest + mock factories) — test each module's public API functions in isolation. The AI service's `generate()` is tested with a mock Anthropic response. The Entity Resolver's `resolveContext()` is tested with a mock Supabase returning fixture data. These verify that module boundaries work as specified. **Every module must have contract tests for all exported functions.**

**Integration tests** (Vitest + test DB) — test cross-module flows. "Student saves response → event fires → integrity flagged → insight generated." These wire real module code with a test Supabase instance (Supabase local dev or test project). ~30 tests covering the critical cross-module paths.

**E2E tests** (Playwright, future) — browser tests for the 5 most critical user flows: teacher creates unit, student completes lesson, teacher grades work, student takes safety test, teacher uses Teaching Mode. These are expensive to maintain and should be kept minimal.

### 8.2 Mock Factory Infrastructure

Every OS service gets a mock factory so domain modules can be tested without real infrastructure:

```typescript
// src/os/__mocks__/index.ts — imported in test setup

export function createMockAuth(overrides?: Partial<AuthContext>): {
  requireAuth: jest.Mock;
  requireTeacher: jest.Mock;
  requireStudent: jest.Mock;
};

export function createMockAI(responses?: Record<string, string>): {
  generate: jest.Mock;      // returns canned responses keyed by purpose
  generateJSON: jest.Mock;  // returns parsed fixture data
};

export function createMockEvents(): {
  publish: jest.Mock;       // captures published events for assertion
  subscribe: jest.Mock;     // registers handlers that run synchronously in tests
  flush: () => Promise<void>; // wait for all handlers to complete (test utility)
  getPublished: () => Event[];  // inspect what was published
};

export function createMockEntity(fixtures: {
  content?: NormalizedContent;
  framework?: Framework;
  studentProfile?: StudentLearningProfile;
}): {
  resolveContext: jest.Mock;
  resolveContent: jest.Mock;
};

export function createMockTaxonomy(): {
  getFramework: jest.Mock;
  neutralToFramework: jest.Mock;
  // ... all taxonomy functions with real data (taxonomy is mostly pure lookups)
};

export function createMockStorage(): {
  upload: jest.Mock;
  getSignedUrl: jest.Mock;
  remove: jest.Mock;
};

export function createMockNotify(): {
  send: jest.Mock;
  getUnread: jest.Mock;
};
```

**Key design decision:** The Events mock runs handlers **synchronously** in tests (no `Promise.resolve()` deferral). This means a test can call `delivery.saveResponse()`, then immediately assert that the integrity flag was created — no `await flush()` needed for simple cases. For complex async chains, `flush()` waits for all handlers.

### 8.3 Contract Test Pattern

Every module's public API gets a contract test file:

```typescript
// src/modules/delivery/__tests__/delivery.contract.test.ts

import { saveResponse, getStudentProgress } from '../index';
import { createMockAuth, createMockEvents, createMockEntity } from '@/os/__mocks__';

describe('Delivery module contract', () => {
  const mockAuth = createMockAuth({ role: 'student', userId: 'student-1' });
  const mockEvents = createMockEvents();

  it('saveResponse publishes student.response.saved event', async () => {
    await saveResponse('student-1', 'unit-1', 'page-1', { text: 'hello' });

    const events = mockEvents.getPublished();
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'student.response.saved' })
    );
  });

  it('getStudentProgress returns empty array for new student', async () => {
    const progress = await getStudentProgress('new-student', 'unit-1');
    expect(progress).toEqual([]);
  });
});
```

### 8.4 Migration Safety Protocol — Test Before Move

Every time code moves from the old location to LoomOS, follow this protocol:

1. **Write a characterisation test FIRST.** Before touching any code, write a test that captures the current behaviour of the function you're about to move. This test should pass against the OLD code at its current location.

2. **Move the code.** Relocate the implementation to its new LoomOS location (`src/os/` or `src/modules/`). Update the old location to re-export from the new location (so existing imports don't break).

3. **Run the characterisation test.** It must still pass against the NEW location. If it doesn't, the move broke something — fix before proceeding.

4. **Update imports incrementally.** Change consumers from the old import path to the new one, one file at a time. Run tests after each change.

5. **Delete the old re-export** only after ALL consumers are updated and all tests pass.

```typescript
// Example: moving callHaiku to OS AI service

// STEP 1: Write characterisation test BEFORE moving
// src/os/ai/__tests__/generate.characterisation.test.ts
import { generate } from '../index';

test('generate with fast tier returns response under 300 tokens', async () => {
  const result = await generate({
    tier: 'fast',
    purpose: 'student-feedback',
    system: 'You are a helpful tutor.',
    messages: [{ role: 'user', content: 'What is design thinking?' }],
    maxTokens: 300,
  });
  expect(result.content).toBeTruthy();
  expect(result.usage.outputTokens).toBeLessThanOrEqual(300);
  expect(result.model).toContain('haiku');
});

// STEP 2: Move code, create re-export at old location
// src/lib/ai/toolkit/shared-api.ts (old location)
export { generate as callHaiku } from '@/os/ai';  // re-export

// STEP 3: Run test — must pass
// STEP 4: Update consumers one at a time
// STEP 5: Delete re-export when all consumers migrated
```

### 8.5 Test Coverage Targets

| Layer | Coverage Target | Current State | Priority |
|-------|----------------|---------------|----------|
| OS Auth | 90%+ | ~0% (no tests) | Phase 0 |
| OS Taxonomy | 95%+ | ~60% (framework vocab tests exist) | Phase 0 |
| OS AI | 80%+ | ~0% (no tests on generate) | Phase 0 |
| OS Entity | 90%+ | ~30% (resolve-content has some) | Phase 0 |
| OS Events | 95%+ | 0% (doesn't exist yet) | Phase 1 |
| Content module | 80%+ | ~20% (fork tests exist) | Phase 2 |
| Scheduling module | 90%+ | ~80% (cycle engine well-tested) | Already good |
| Generation module | 70%+ | ~40% (Pulse tests, schema tests) | During Dimensions3 |
| All other modules | 60%+ | ~10% average | Phase 2 |

---

## 9. Security & Data Protection

StudioLoom handles data from children aged 11-18 across multiple jurisdictions. Security is not a feature — it's a constraint that shapes every architectural decision.

### 9.1 Data Classification

Every table in LoomOS falls into one of four classification levels:

| Level | Definition | Examples | Protection |
|-------|-----------|----------|------------|
| **CRITICAL** | Student PII + sensitive attributes | `students` (names, learning_profile incl. ADHD/dyslexia/anxiety), `student_sessions` (auth tokens) | Encrypted at rest, audit logged, minimal access, never sent to AI without minimisation |
| **SENSITIVE** | Student academic work + assessment | `student_progress` (responses, integrity_metadata), `assessment_records` (grades), `competency_assessments`, `discovery_sessions` (personal reflections) | RLS-scoped to owning teacher, audit logged for bulk access, retention policies |
| **INTERNAL** | Teacher content + operational data | `units`, `class_units`, `classes`, `activity_blocks`, `knowledge_items`, `school_timetable` | RLS-scoped to author teacher, standard access controls |
| **PUBLIC** | System configuration + reference data | `ai_model_config`, taxonomy constants, toolkit tool definitions | No special protection needed |

### 9.2 Access Scoping in the Auth Service

The Auth service doesn't just verify identity — it **scopes data access**. Every `AuthContext` includes the full ownership chain:

```typescript
export interface AuthContext {
  userId: string;
  role: Role;
  schoolId?: string;           // future: multi-tenancy boundary
  teacherId?: string;          // for students: their teacher
  classIds?: string[];         // for students: enrolled classes
  ownedClassIds?: string[];    // for teachers: classes they own
}

// The Entity Resolver MUST verify ownership before returning data
export async function resolveContext(
  supabase: SupabaseClient,
  auth: AuthContext,           // <-- auth context passed in, not just IDs
  studentId: string,
  classId: string,
  unitId: string
): Promise<ResolvedContext> {
  // Verify: does this auth context have access to this student+class+unit?
  if (auth.role === 'teacher') {
    if (!auth.ownedClassIds?.includes(classId)) throw new ForbiddenError();
  }
  if (auth.role === 'student') {
    if (auth.userId !== studentId) throw new ForbiddenError();
    if (!auth.classIds?.includes(classId)) throw new ForbiddenError();
  }
  // ... proceed with resolution
}
```

**RLS as defense-in-depth:** Supabase Row Level Security policies remain the database-level safety net. LoomOS Auth is the application-level check. Both must agree. If the app has a bug that skips the auth check, RLS still blocks the query. This is the Swiss cheese model — multiple layers with different hole patterns.

### 9.3 AI Data Minimisation

When student data is sent to AI providers (Anthropic, Groq, Gemini), the AI Service enforces minimisation:

```typescript
// Inside OS AI service — automatic PII stripping
function sanitiseForAI(messages: Message[], purpose: AIPurpose): Message[] {
  if (purpose === 'student-feedback' || purpose === 'student-reflection') {
    // Strip student names — replace with "the student"
    // Strip learning difference labels — replace with scaffolding hints
    // Strip class/school identifiers
    // Keep: student's actual work (text responses), bloom level, phase context
  }
  return messages;
}
```

**Rules:**
- Student names are NEVER sent to AI providers. The Design Assistant currently receives `studentName` — this must be removed.
- Learning difference labels (ADHD, dyslexia, anxiety, autism) are translated to scaffolding hints before sending: "use shorter sentences" not "student has dyslexia."
- Integrity metadata (keystroke patterns, paste events) is analysed locally via deterministic rules, NEVER sent to AI.
- Teacher content (lesson plans, units) IS sent to AI for generation — this is the core product function. Teachers consent to this at signup.

### 9.4 Audit Logging

A new `audit_log` table (owned by OS Auth) records security-relevant events:

```typescript
export interface AuditEntry {
  timestamp: string;
  actor: { userId: string; role: Role; ip?: string };
  action: AuditAction;
  resource: { type: string; id: string };      // 'student' | 'class' | 'unit' | ...
  details?: Record<string, any>;               // what changed
}

export type AuditAction =
  | 'student_data.viewed'       // teacher viewed student responses
  | 'student_data.exported'     // teacher exported grades/portfolio
  | 'student_data.deleted'      // student record deletion
  | 'grade.saved'               // assessment recorded
  | 'integrity.flagged'         // integrity alert created
  | 'auth.login'                // successful login
  | 'auth.failed'               // failed login attempt
  | 'admin.config_changed'      // AI settings, feature flags
  | 'bulk_access'               // any query returning >50 student records
  | 'class.enrollment_changed'; // student added/removed from class

// Automatically called by Auth service on relevant operations
export function audit(entry: AuditEntry): void;  // non-blocking, like events
```

**Implementation:** Fire-and-forget insert to `audit_log` table. No performance impact on the request path. Admin can query for compliance reports ("show me all access to student X's data in the last 30 days").

### 9.5 Compliance Requirements

| Regulation | Applicability | Key Requirements | LoomOS Approach |
|-----------|--------------|-----------------|-----------------|
| **COPPA** (US) | Students under 13 | Parental consent for data collection, no behavioural advertising, data deletion on request | Teacher acts as school agent (COPPA school exception). No ads. Deletion via admin API. |
| **GDPR** (EU/UK) | All EU/UK students | Lawful basis, data minimisation, right to erasure, DPA with processors | School is data controller, StudioLoom is processor. DPA template needed. AI providers are sub-processors. |
| **PIPL** (China) | Matt's school in China | Consent, data localisation concerns, anonymisation | Anonymous student auth (class code + display name). No real names stored. Teacher maintains offline name mapping. |
| **FERPA** (US) | US schools using LMS | Student education records protected | SSO via school IdP. Directory information opt-out. Audit log for record access. |

**Practical actions for Phase 0:**
1. Add `audit()` calls to the Auth service (login, data access)
2. Add PII sanitisation to the AI Service
3. Document the data classification table in a publicly accessible privacy doc
4. Create a data deletion script (given a student ID, cascade delete all their data across all tables)

### 9.6 Multi-Tenancy & School Isolation

The spec's Auth service includes `schoolId?: string` but the current system has no school concept — teachers are standalone. School Readiness (PLANNED, 37-50 days) adds `school_id` to every table. LoomOS prepares for this:

**Phase 0 (now):** Auth service includes `schoolId` in AuthContext but defaults to `null` (single-tenant mode). All module APIs accept optional `schoolId` parameter that's ignored when null.

**Phase Multi-Tenancy (future):** Migration adds `school_id` column to `teachers`, `classes`, `students`. RLS policies add `school_id` scoping. Config service adds per-school feature flags and tier limits. Auth service populates `schoolId` from teacher's school assignment. The Entity Resolver adds school-level config resolution (school → teacher → class → unit).

**The critical invariant:** A teacher in School A can NEVER see students, classes, units, or data from School B. This is enforced at both RLS and application level. The OS layer treats `schoolId` as a mandatory partition key when present.

---

## 10. Futureproofing & Evolution Path

This architecture is designed to last through StudioLoom's growth from solo project to multi-school SaaS platform. But four areas will need deliberate evolution at key inflection points.

### 10.1 API Versioning (trigger: when external consumers exist)

Currently all routes are unversioned (`/api/teacher/dashboard`). This is fine while Matt is the only consumer. When StudioLoom exposes a public API (LTI 1.3 deep linking, mobile app, partner integrations), add URL-based versioning:

```
/api/v1/teacher/dashboard       ← stable, documented
/api/v1/student/progress        ← versioned student API
/api/internal/teacher/dashboard  ← unversioned internal routes (Next.js pages)
```

**When to act:** Before the first external API consumer ships. Not before.

**Migration path:** Introduce a route version prefix as a Next.js middleware rewrite (zero route file changes). Internal routes stay as-is. Public routes get `/v1/` prefix. Breaking changes go to `/v2/` while `/v1/` gets a deprecation header.

### 10.2 Observability Beyond Sentry (trigger: when debugging takes >30 min)

Current monitoring is Sentry exceptions + Plausible analytics + server-side `console.log`. This is sufficient at current scale but won't survive multi-school deployment.

**Evolution stages:**

| Stage | Trigger | Add |
|-------|---------|-----|
| 0 (now) | Solo dev | Sentry errors, Plausible page views, console logs |
| 1 | First paying school | Structured JSON logging (pino/winston), request-id correlation across API calls, Vercel Analytics for performance |
| 2 | 5+ schools | OpenTelemetry traces on generation pipeline (trace a unit build across 6 stages), log aggregation (Axiom/Betterstack — Vercel-native), alert rules on error rate + latency |
| 3 | Enterprise | Distributed tracing across all modules, SLA monitoring per school, cost-per-tenant dashboards, automated anomaly detection |

**Key design decision:** The Event Bus already produces structured events with correlation IDs (`EventPayload.meta.correlationId`). Tracing can hook into events without changing module code — the OS layer adds trace context, modules are unaware.

### 10.3 DB-Backed Taxonomy (trigger: when teachers need custom frameworks)

The Taxonomy Registry currently stores frameworks, criteria, bloom levels, and phases as TypeScript constants. This means adding a new framework requires a code deploy. The evolution:

| Stage | Storage | Who can add |
|-------|---------|-------------|
| 0 (now) | TypeScript constants | Developer (code deploy) |
| 1 (Dimensions3) | Constants + `format_profiles` table for custom formats | Admin via Format Builder wizard |
| 2 (multi-school) | Full DB-backed taxonomy: `frameworks`, `criteria_definitions`, `phase_definitions` tables | School admin via settings |
| 3 (marketplace) | Taxonomy marketplace: schools publish + share custom frameworks | Community |

**The interface stays the same.** `taxonomy.getCriteria(frameworkId)` works identically whether it reads from a constant or a DB row. Module code never changes — only the Taxonomy service internals evolve. This is exactly why the OS service abstraction exists.

### 10.4 Event Bus Evolution (trigger: when Teaching Mode needs <1s updates)

The in-memory synchronous event bus is correct for Phase 0. Evolution path:

| Stage | Implementation | Latency | Use case |
|-------|---------------|---------|----------|
| 0 (now) | In-memory sync | 0ms | Side effects, cache invalidation |
| 1 | Supabase Realtime channels | ~200ms | Teaching Mode live student grid |
| 2 | Redis Pub/Sub (Upstash) | ~50ms | Cross-instance events on Vercel |
| 3 | Dedicated message queue | ~10ms | Enterprise with guaranteed delivery |

**Upgrade path:** The `EventBus` interface (`publish()`, `subscribe()`, `unsubscribe()`) is stable. Swapping the transport is an internal change to `src/os/events/bus.ts` — zero module code changes. Subscribers don't know or care whether events travel through memory, WebSocket, or Redis.

### 10.5 Multi-Tenancy Deepening (trigger: when second school onboards)

Section 9.6 defines the school isolation model. The full evolution:

1. **Now:** `schoolId` in AuthContext, ready for scoping but unused (single-school)
2. **First sale:** RLS policies add `school_id` column to core tables, Entity Resolver filters by school
3. **Growth:** Per-school feature flags (School A has gallery, School B doesn't), per-school storage quotas
4. **Enterprise:** School groups (districts), delegated admin, cross-school analytics for district admins
5. **Scale:** Tenant-aware connection pooling, per-school read replicas if needed

Each step is additive. No step requires rewriting modules — only expanding the OS Auth and Config services.

---

## 11. Reusability Map — Extracting Modules for Other Projects

Matt's projects share the same core pattern: a mentor creates structured content, a participant engages with it + AI support. Here's what each project needs:

### 11.1 Module Extraction Matrix

| Module | StudioLoom | Makloom | Seedlings | CALLED |
|--------|-----------|---------|-----------|--------|
| **OS Auth** | ✅ Full | ✅ Full (consumer auth different) | ✅ Full | ✅ Full |
| **OS Taxonomy** | ✅ Design frameworks | 🔄 Simplified (no MYP) | 🔄 Growth frameworks | 🔄 Ministry frameworks |
| **OS AI** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **OS Entity** | ✅ Full | 🔄 Simplified (no classes) | 🔄 Different hierarchy | 🔄 Different hierarchy |
| **OS Events** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **OS Config** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **OS Notifications** | ✅ Full | ✅ Full | 🔄 Adapted (parent alerts) | 🔄 Adapted (admin alerts) |
| **OS Storage** | ✅ Full | ✅ Full | 🔄 Simplified | 🔄 Simplified |
| **Content** | ✅ Full | ✅ Full (units → projects) | 🔄 Adapted (units → lessons) | 🔄 Adapted (units → modules) |
| **Generation** | ✅ Full | ✅ Full | 🔄 Different prompts | 🔄 Different prompts |
| **Ingestion** | ✅ Full | ✅ Full | ❌ Not needed v1 | 🔄 Ministry content |
| **Delivery** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Assessment** | ✅ Full (MYP criteria) | 🔄 Simplified (badges only) | 🔄 Growth tracking | 🔄 Certification |
| **Mentoring** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Scheduling** | ✅ Full | ❌ Not needed | ❌ Not needed | 🔄 Simplified |
| **Cockpit** | ✅ Teacher cockpit | 🔄 Creator cockpit | 🔄 Parent cockpit | 🔄 Admin cockpit |
| **Journey** | ✅ Student journey | 🔄 Learner journey | 🔄 Child journey | 🔄 Participant journey |
| **Admin** | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **Analytics** | ✅ Full | ✅ Full | 🔄 Different signals | 🔄 Different signals |

✅ = Use as-is  🔄 = Adapt (same structure, different content)  ❌ = Not needed

### 11.2 The Reusable Core (~60-70% of code)

These modules transfer to ALL projects with minimal changes:

1. **OS Layer** (auth, AI service, events, config) — 100% reusable
2. **Content** (units, pages, activities, forks) — rename entities, same data model
3. **Delivery** (progress tracking, responses, tool sessions) — 100% reusable
4. **Mentoring** (AI chat, feedback loops) — swap system prompts
5. **Admin** (config, monitoring, cost tracking) — 100% reusable

### 11.3 The Project-Specific Layer (~30-40%)

These need per-project customisation:

1. **OS Taxonomy** — different frameworks, criteria, phases per domain
2. **Assessment** — different grading models per domain
3. **Journey** — different onboarding, discovery, gamification per audience
4. **Cockpit** — different dashboard metrics per user type
5. **Generation** — different prompts, different content structures
6. **Scheduling** — only needed for school-based products

---

## 12. Current State Assessment

### 12.1 What Already Exists (Strengths)

| Target Component | Current Implementation | Gap |
|-----------------|----------------------|-----|
| OS Auth | `requireTeacherAuth()` + `requireStudentAuth()` in 75 files | Functions exist but no unified `AuthContext` return type. No admin role. Copied, not centralised. |
| OS Taxonomy | `constants.ts` + `unit-types.ts` + `nm/constants.ts` | Scattered across 3+ files. No neutral taxonomy. No FrameworkAdapter. |
| OS AI | `callHaiku()` × 17 copies, `anthropic.ts`, `rate-limit.ts` | Duplicated everywhere. No unified interface. No cost attribution. |
| OS Entity | `resolve-content.ts` + `unit-adapter.ts` | Content resolution works. Missing: framework, NM config, scheduling, student profile resolution. |
| OS Events | Nothing | No event system at all. Everything is on-demand queries. |
| OS Config | Hardcoded `QUARANTINED` checks | No feature flag system. Quarantine is grep-based. |
| Content module | 56 tables, content resolution, fork system | Tables exist. No formal public API boundary. Direct DB access from everywhere. |
| Scheduling | `cycle-engine.ts`, calendar, timetable | Clean module already — `cycle-engine.ts` is pure functions with good tests. Closest to target architecture. |

### 12.2 The Honest Gap List

**Critical gaps (must fix before Dimensions3):**

1. **No AI service layer** — every feature calls Anthropic differently. Dimensions3 adds 6+ new AI call sites. Without a unified service, that's 6 more places to duplicate rate limiting, cost tracking, and error handling.

2. **No taxonomy registry** — Dimensions3 needs neutral criterion taxonomy, FrameworkAdapter, bloom constants, activity categories, and UDL checkpoints from day 1. Currently scattered.

3. **No entity resolution beyond content** — Dimensions3 pipeline stages need full context (framework, criteria, teacher style, class language settings). Currently each stage would have to query these independently.

**Important gaps (fix during or after Dimensions3):**

4. **Auth is duplicated, not centralised** — works but fragile. Every new route copies the pattern.

5. **No events** — manageable for now. Becomes critical when Teaching Mode needs real-time student signals (Dimensions3 Section 15).

6. **No feature flags** — manageable while quarantine is the only toggle. Becomes critical for monetisation.

### 12.3 Technical Debt Blocking Modularity

| Debt Item | Impact | Est. Fix |
|-----------|--------|----------|
| 17× callHaiku duplication | Every new AI feature copies bad patterns | 2-3 hrs (create OS AI service) |
| 123 `any` instances | Module boundaries can't be typed properly | 2-3 hrs (QualityCode Phase 2) |
| 5 files > 600 LOC | Settings page, Class Hub, Class Detail are monoliths | 3-4 hrs (QualityCode Phase 1) |
| `architecture.md` still lists migrations 001-005 | Documentation is stale, misleading | 1 hr (update) |
| No barrel exports on modules | Everything imports from deep paths | 2-3 hrs (add index.ts per module) |
| student_progress lacks class_id | Multi-class enrollment ambiguity | Migration + code changes, ~0.5 day |

---

## 13. Migration Path

### 13.1 Strategy: Strangler Fig, Not Big Bang

We don't rewrite the app. We grow the new architecture around the existing code, one module at a time. Each step is independently deployable and immediately useful.

### 13.2 Phase 0: The Three Critical OS Services (3-4 days)

Build these before Dimensions3 because the pipeline needs them on day 1.

**Step 0A: Taxonomy Registry (~1 day)**
1. Create `src/os/taxonomy/`
2. Move `constants.ts` framework definitions → `src/os/taxonomy/frameworks.ts`
3. Move `unit-types.ts` type definitions → `src/os/taxonomy/unit-types.ts`
4. Add neutral criterion taxonomy (8 categories) → `src/os/taxonomy/neutral.ts`
5. Add FrameworkAdapter → `src/os/taxonomy/adapter.ts`
6. Consolidate bloom, phases, categories, UDL → `src/os/taxonomy/cognitive.ts`
7. Create `src/os/taxonomy/index.ts` barrel export
8. Update all 65+ files importing from `@/lib/constants` to use `@/os/taxonomy`
9. Write tests for framework↔neutral mapping

**Step 0B: AI Service (~1 day)**
1. Create `src/os/ai/`
2. Move Anthropic client code from `src/lib/ai/anthropic.ts`
3. Move rate limiter from `src/lib/rate-limit.ts`
4. Move usage tracking from `src/lib/usage-tracking.ts`
5. Create unified `generate()` function with ModelTier routing
6. Create `src/os/ai/index.ts` barrel export
7. Replace first 5 callHaiku copies (toolkit routes — highest duplication)
8. Remaining copies replaced incrementally over following days

**Step 0C: Entity Resolver expansion (~1 day)**
1. Move `resolve-content.ts` + `unit-adapter.ts` → `src/os/entity/`
2. Add framework resolution (class → taxonomy lookup)
3. Add NM config resolution (class_units → units → null)
4. Add scheduling resolution (term dates, next class)
5. Add student profile resolution (learning_profile, mentor, theme)
6. Create `src/os/entity/index.ts` barrel export
7. Update files using `resolveClassUnitContent()` to use `@/os/entity`

**Step 0D: Auth consolidation (~0.5 day)**
1. Create `src/os/auth/`
2. Create unified `requireAuth()` returning `AuthContext`
3. Move Supabase client creation here
4. Create convenience wrappers (`requireTeacher`, `requireStudent`)
5. Update 10 highest-traffic routes to use new auth
6. Remaining routes updated incrementally

### 13.3 Phase 1: First Domain Module Boundaries (during Dimensions3 build)

As you build Dimensions3 (the Generation module), enforce the target architecture from the start:

1. Generation module at `src/modules/generation/` with clean public API
2. Content module boundary created (Generation accesses blocks through Content API, not direct DB)
3. Event bus created to support `generation.completed` event
4. Config service created with `generation` feature flag (replaces grep-based quarantine)

### 13.4 Phase 2: Remaining Module Boundaries (post-Dimensions3, ~3-4 days)

Extract existing code into module directories with barrel exports:

1. **Scheduling** — already cleanly separated, mostly just moves files
2. **Assessment** — extract grading, integrity, NM into module
3. **Mentoring** — extract Design Assistant, toolkit AI, Open Studio AI
4. **Journey** — extract Discovery, gallery, badges, onboarding, toolkit platform
5. **Delivery** — extract progress tracking, response handling, tool sessions
6. **Cockpit** — extract dashboard, Teaching Mode, Smart Insights, class management
7. **Admin** — extract system config, sandbox, monitoring

Each extraction follows the same pattern:
1. Create `src/modules/<name>/index.ts` with public API functions
2. Create `src/modules/<name>/types.ts` with exported types
3. Move implementation files to `src/modules/<name>/internal/`
4. Update imports in all consuming files
5. Verify no deep imports remain

### 13.5 Phase 3: Full Event Wiring (~2 days, after Phase 2)

1. Wire `student.response.saved` → insights invalidation, integrity flagging
2. Wire `teacher.grade.saved` → block efficacy updates, insights invalidation
3. Wire `student.unit.completed` → insights generation, gamification (future)
4. Wire `teacher.lesson.taught` → block usage tracking, timing model updates
5. Convert Smart Insights from full-requery to event-driven cache

### 13.6 Phase 4: Feature Flags + Monetisation Prep (~1 day)

1. Create `feature_flags` table
2. Replace quarantine grep markers with `isEnabled('generation')` checks
3. Add tier column to teacher profiles
4. Stub `checkTierAccess()` in Config service

---

## 14. Module Spec Template

Every module's individual spec document should follow this format. Use this when writing specs for Dimensions3, Assessment overhaul, or any new module.

```markdown
# Module: [Name]

## 1. Purpose
One paragraph: what this module does and why it exists.

## 2. Ownership
### Tables Owned
- table_name — one-line description

### Tables Read (via other modules)
- table_name — accessed via [module].getX()

## 3. Public API
```typescript
// The complete index.ts interface
```

## 4. Types
```typescript
// All types other modules can import from types.ts
```

## 5. Events
### Published
- event.type — when it fires, what payload contains

### Subscribed
- event.type — what this module does when it receives it

## 6. Dependencies
### OS Services Used
- Auth: requireTeacher for all teacher routes
- AI: generate() for [purpose]
- etc.

### Other Modules Used
- content.getUnit() for [reason]
- etc.

## 7. Internal Architecture
How the module is structured internally.
Key files, data flows, algorithms.

## 8. API Routes
| Method | Path | Handler | Auth |
|--------|------|---------|------|

## 9. Migration from Current State
What files move, what changes, what breaks.

## 10. Test Plan
What to test, how to test it.
```

---

## 15. Decision Log

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Modular monolith, not microservices | Solo developer. Deployment simplicity. Module boundaries give 90% of the benefit at 10% of the cost. | 5 Apr 2026 |
| 2 | In-memory event bus, not Kafka/Redis | Simplest possible implementation. Same interface. Upgrade later if needed. | 5 Apr 2026 |
| 3 | Convention-based boundaries, not Packwerk | TypeScript imports + directory structure + code review. Add tooling when team grows. | 5 Apr 2026 |
| 4 | Taxonomy before Dimensions3 | Pipeline needs neutral criteria, FrameworkAdapter, bloom constants from day 1. Building without it creates more scattered constants. | 5 Apr 2026 |
| 5 | AI service before Dimensions3 | Pipeline adds 6+ AI call sites. Without unified service, that's 6 more duplicated rate limiters and cost trackers. | 5 Apr 2026 |
| 6 | Entity resolver expanded, not rebuilt | `resolveClassUnitContent()` already works for content. Add framework, NM, scheduling, profile resolution to the same pattern. | 5 Apr 2026 |
| 7 | Cockpit can import from all modules | It's the teacher aggregation layer — it MUST read from every module to build the dashboard. This is acceptable coupling because it's read-only and presentation-layer. | 5 Apr 2026 |
| 8 | Feature flags default to enabled | Preserves current behaviour. Only quarantined features default off. No disruption to existing functionality. | 5 Apr 2026 |
| 9 | student_progress.class_id migration deferred | Needed but not blocking. Can be added as part of Delivery module extraction. | 5 Apr 2026 |
| 10 | 8 neutral criteria, not 6 | Researching and analysing must be separate — some frameworks combine them (MYP A) while others split them (GCSE AO1/AO3). 8 is the minimum that covers all without lossy mapping. | 5 Apr 2026 |
| 11 | Named "LoomOS" | "Brings all the threads together in a neat order." The weaving metaphor matches StudioLoom and clarifies what the OS layer is for. | 5 Apr 2026 |
| 12 | 8 services, not 6 | Added Notifications (no outbound communication layer existed) and Storage/Media (file handling was scattered across features). Both are cross-cutting OS concerns. | 5 Apr 2026 |
| 13 | 11 modules, not 10 | Added Analytics module to house Intelligence Profiles, usage tracking, and signal processing. Previously had no module home. | 5 Apr 2026 |
| 14 | Testing-first migration | Every code move follows 5-step Migration Safety Protocol: characterisation test → move → verify → update imports → delete re-export. No "move now, test later." | 5 Apr 2026 |
| 15 | Security by design, not bolt-on | 4-level data classification (CRITICAL/SENSITIVE/INTERNAL/PUBLIC), access scoping via ownership chains, AI data minimisation, audit logging. School data requires this from day 1. | 5 Apr 2026 |
| 16 | Futureproofing via stable interfaces | API versioning, observability, DB-backed taxonomy, event bus transport — all deferred but designed so the interface never changes, only internals evolve. | 5 Apr 2026 |

---

## 16. How This Connects to Existing Plans

| Existing Doc | Relationship to This Spec |
|-------------|--------------------------|
| **Dimensions3** (`docs/projects/dimensions3.md`) | Becomes the Generation module spec. Its 6-stage pipeline is the internal architecture of `src/modules/generation/`. All its "typed contracts between stages" are internal to the module. Its interface to the rest of the system goes through the public API defined here. |
| **Platform Architecture** (`docs/projects/Studioloom Platform Architecture.docx`) | Matt's 4-Pillar vision maps to: System 1 (Library) = Ingestion module, System 2 (Engine) = Generation module, System 3 (Classroom) = Delivery + Journey modules, System 4 (Loop) = Events + Assessment + Content (efficacy tracking). The Central Taxonomy API = OS Taxonomy service. |
| **QualityCode** (`docs/projects/qualitycode.md`) | Phase 1 (split god components) becomes easier because modules define clear boundaries. Phase 2 (TypeScript strictness) benefits from typed module APIs. Phase 3 (test coverage) maps to testing each module's public API. |
| **ALL-PROJECTS** (`docs/projects/ALL-PROJECTS.md`) | Every project now has a home module. The 63 projects stop being an overwhelming flat list and become scoped work within their module. |
| **School Readiness** (`docs/projects/school-readiness.md`) | SSO maps to OS Auth expansion. RBAC maps to OS Auth roles. Multi-tenancy maps to OS Config (schoolId scope). Feature gating maps to OS Config flags. |
| **Monetisation** (`docs/projects/monetisation.md`) | Tier gating maps directly to OS Config service. Per-teacher cost tracking maps to OS AI service. Feature flags control which modules are accessible per tier. |
| **3D Elements** (`docs/projects/3delements.md`) | Becomes an extension to Journey module (student-facing) + Delivery module (3D response types). The `r3f_instruction` on activity_blocks lives in Content module. |
| **Intelligence Profiles** (roadmap Phase 3) | Becomes the core of Analytics module. Student, teacher, and class climate profiles computed from event signals. `formatProfileForAI()` is the bridge between Analytics and Mentoring/Generation modules. |
| **Notifications** (not yet built) | OS Notification service. Triggered by events (`student.unit.completed`, `integrity.flagged`, `gallery.feedback.ready`). Channels: in-app first, email and push later. |

---

## 17. Success Criteria

The architecture is working when:

1. **A new API route can be written in under 10 lines** — just auth check + call to module function + return response. No scattered Supabase queries, no auth copy-paste, no AI boilerplate.

2. **A module can be understood by reading its `index.ts`** — the public API tells you everything the module can do. You never need to read internal files to use it.

3. **Adding a feature to one module doesn't require changes in another** — unless it's genuinely cross-cutting (in which case, an event or OS service change).

4. **Extracting a module for Makloom takes less than a day** — copy the `src/modules/<name>/` directory, swap taxonomy constants, update a few types. The OS layer is shared infrastructure.

5. **The dependency graph has no cycles** — you can draw a clean DAG from Admin → Cockpit → Domain Modules → OS Layer → Infrastructure.

6. **Every table has exactly one owning module** — no shared writes without going through a public API. If two modules need to write to the same table, one owns it and the other calls the owner's API.

7. **Every module has contract tests** — the public API has tests that run without a database, using mock factories. Break the contract, break the build.

8. **No student PII reaches external AI providers** — `sanitiseForAI()` strips names, emails, and identifying data before any Anthropic/Groq/Gemini call. Verified by contract tests on the AI service.

9. **Any code migration can be rolled back in under 5 minutes** — the Strangler Fig approach means old and new code coexist. If the new path fails, the old re-export still works. No big-bang cutovers.

---

*This document is the foundation. Individual module specs (starting with Generation/Dimensions3) should follow the template in Section 14 and reference this document for OS service interfaces, dependency rules, and data ownership.*
