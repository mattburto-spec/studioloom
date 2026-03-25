# Quest Journey System — Complete Technical Architecture
*The foundation spec for StudioLoom's student project journey*
*25 March 2026*

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Data Model (Migration 042)](#2-data-model-migration-042)
3. [Quest Engine (Pure TypeScript)](#3-quest-engine-pure-typescript)
4. [Mentor Personality System](#4-mentor-personality-system)
5. [Overworld Map (Custom SVG)](#5-overworld-map-custom-svg)
6. [Phase-Specific UIs](#6-phase-specific-uis)
7. [API Routes](#7-api-routes)
8. [Component Tree](#8-component-tree)
9. [State Flow](#9-state-flow)
10. [Integration with Existing Systems](#10-integration-with-existing-systems)
11. [File Plan](#11-file-plan)
12. [Build Order](#12-build-order)
13. [Open Questions](#13-open-questions)

---

## 1. Design Principles

**P1. Universal arc, framework-specific content.** Discovery → Planning → Working → Sharing is the same for all 4 frameworks (Design, Service, PP, PYPx). Only the phase names, criteria, milestone templates, and AI vocabulary change. The quest engine is framework-agnostic; the framework config layer provides the specifics.

**P2. The mentor is the personality; the framework is the knowledge.** The 5 mentors (Kit, Sage, River, Spark, Haven) define HOW the AI speaks. The 4 frameworks define WHAT it knows. These are orthogonal — any mentor can operate in any framework. A student doing Service with Spark gets challenged on community impact with provocative questions. A student doing PP with Haven gets gentle process-journal nudges.

**P3. Game at the edges, tool in the middle.** The campfire (mentor selection + discovery) and overworld map (progress visualization) are the game layer. The daily working experience is project management — milestones, evidence, check-ins. Game moments punctuate the journey (phase transitions, milestone celebrations, mentor reactions) but never interrupt productive work.

**P4. Teacher controls the scaffolding, not the content.** The help intensity slider adjusts AI behavior (question depth, example frequency, proactive vs reactive). Teachers can also add resources, adjust milestones, and flag concerns. They never write the student's contract or choose their project.

**P5. Evidence over attendance.** Progress is measured by what students produce (photos, submissions, reflections, milestone check-offs), not by time spent. The health score model rewards momentum and quality, not seat time.

**P6. The journey is resumable.** Students may be absent, switch devices, or return after weeks. The quest state persists completely — every milestone, every evidence item, every AI interaction is recoverable. The overworld map shows exactly where they left off.

---

## 2. Data Model (Migration 042)

### 2.1 Core Tables

```sql
-- ================================================
-- Migration 042: Quest Journey System
-- ================================================

-- ─────────────────────────────────────────────────
-- quest_journeys — one per student per unit
-- Links to open_studio_status for unlock/revoke lifecycle
-- ─────────────────────────────────────────────────
CREATE TABLE quest_journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,

  -- Framework & mentor
  framework_id TEXT NOT NULL DEFAULT 'myp_design',
  mentor_id TEXT,  -- 'kit' | 'sage' | 'river' | 'spark' | 'haven' | NULL (not yet chosen)

  -- Quest phase state machine
  phase TEXT NOT NULL DEFAULT 'discovery',
  -- Valid phases: 'not_started' | 'discovery' | 'planning' | 'working' | 'sharing' | 'completed'
  phase_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Discovery output (populated during Discovery phase)
  discovery_profile JSONB DEFAULT NULL,
  -- Shape: { strengths: string[], interests: string[], needs: string[],
  --          archetype: string, project_idea: string, narrowing_notes: string }

  -- Student contract (populated during Planning phase)
  contract JSONB DEFAULT NULL,
  -- Shape: { what: string, who_for: string, done_looks_like: string,
  --          milestones_summary: string, help_needed: string,
  --          success_criteria: string, signed_at: string }

  -- Teacher controls
  help_intensity TEXT NOT NULL DEFAULT 'guided',
  -- Valid: 'explorer' | 'guided' | 'supported' | 'auto'

  -- Health score (computed, cached for dashboard queries)
  health_score JSONB DEFAULT '{"momentum":"green","engagement":"green","quality":"green","self_awareness":"green"}',
  -- Shape: { momentum: 'green'|'amber'|'red', engagement: ..., quality: ..., self_awareness: ... }

  -- Session stats (denormalized for dashboard)
  total_sessions INTEGER DEFAULT 0,
  total_evidence_count INTEGER DEFAULT 0,
  sessions_remaining INTEGER,  -- computed from timetable, cached on phase change

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(student_id, unit_id)
);

-- ─────────────────────────────────────────────────
-- quest_milestones — ordered checkpoints within a journey
-- ─────────────────────────────────────────────────
CREATE TABLE quest_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,

  -- Milestone definition
  title TEXT NOT NULL,
  description TEXT,
  phase TEXT NOT NULL,  -- which quest phase this belongs to
  framework_phase_id TEXT,  -- links to FrameworkPhase.id (e.g. 'inquiring', 'investigate')
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- SMART goal fields
  specific TEXT,       -- what exactly will be produced
  measurable TEXT,     -- how to know it's done
  target_date DATE,    -- when it should be done

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming',
  -- Valid: 'upcoming' | 'active' | 'completed' | 'skipped' | 'overdue'
  completed_at TIMESTAMPTZ,
  completion_note TEXT,  -- student writes a brief note on completion

  -- Teacher adjustments
  teacher_note TEXT,
  teacher_adjusted_date DATE,  -- if teacher moved the date

  -- AI-suggested vs student-created
  source TEXT NOT NULL DEFAULT 'student',
  -- Valid: 'student' | 'ai_suggested' | 'template' | 'teacher'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- quest_evidence — multi-channel evidence collection
-- ─────────────────────────────────────────────────
CREATE TABLE quest_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES quest_milestones(id) ON DELETE SET NULL,

  -- Evidence type
  type TEXT NOT NULL,
  -- Valid: 'photo' | 'voice' | 'text' | 'file' | 'link' | 'reflection' | 'tool_session' | 'ai_conversation'

  -- Content (depends on type)
  content TEXT,           -- text content, URL, or file path
  file_url TEXT,          -- for uploaded files/photos
  file_type TEXT,         -- mime type
  thumbnail_url TEXT,     -- compressed preview for photos

  -- AI analysis (populated async after submission)
  ai_analysis JSONB DEFAULT NULL,
  -- Shape: { quality_signal: 'low'|'medium'|'high', summary: string, tags: string[] }

  -- Context
  phase TEXT NOT NULL,
  framework_phase_id TEXT,
  session_id UUID REFERENCES open_studio_sessions(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- quest_mentor_interactions — log of AI mentor exchanges
-- (distinct from Design Assistant conversations)
-- ─────────────────────────────────────────────────
CREATE TABLE quest_mentor_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL REFERENCES quest_journeys(id) ON DELETE CASCADE,

  -- Interaction details
  interaction_type TEXT NOT NULL,
  -- Valid: 'discovery_step' | 'check_in' | 'help_request' | 'drift_check' |
  --        'documentation_nudge' | 'alignment_check' | 'milestone_review' |
  --        'celebration' | 'contract_coaching' | 'planning_help'
  phase TEXT NOT NULL,
  mentor_id TEXT NOT NULL,  -- which mentor personality was active

  -- Messages
  student_message TEXT,
  mentor_response TEXT,
  -- Structured data (for discovery steps, milestone reviews, etc.)
  structured_data JSONB DEFAULT NULL,

  -- Signals for health score
  student_effort_level TEXT,  -- 'low' | 'medium' | 'high' (client-side assessment)

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- Modifications to existing tables
-- ─────────────────────────────────────────────────

-- Add mentor_id to open_studio_status (links Open Studio unlock to quest journey)
ALTER TABLE open_studio_status
  ADD COLUMN IF NOT EXISTS mentor_id TEXT,
  ADD COLUMN IF NOT EXISTS quest_journey_id UUID REFERENCES quest_journeys(id) ON DELETE SET NULL;

-- Add framework_id to class_units (so each class-unit assignment knows its framework)
ALTER TABLE class_units
  ADD COLUMN IF NOT EXISTS framework_id TEXT DEFAULT 'myp_design';

-- ─────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────
CREATE INDEX idx_quest_journeys_student ON quest_journeys(student_id);
CREATE INDEX idx_quest_journeys_unit ON quest_journeys(unit_id);
CREATE INDEX idx_quest_journeys_class ON quest_journeys(class_id);
CREATE INDEX idx_quest_journeys_phase ON quest_journeys(phase);
CREATE INDEX idx_quest_milestones_journey ON quest_milestones(journey_id);
CREATE INDEX idx_quest_milestones_status ON quest_milestones(status);
CREATE INDEX idx_quest_evidence_journey ON quest_evidence(journey_id);
CREATE INDEX idx_quest_evidence_milestone ON quest_evidence(milestone_id);
CREATE INDEX idx_quest_evidence_type ON quest_evidence(type);
CREATE INDEX idx_quest_mentor_interactions_journey ON quest_mentor_interactions(journey_id);

-- ─────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────
ALTER TABLE quest_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_mentor_interactions ENABLE ROW LEVEL SECURITY;

-- Student can read/update their own journey
CREATE POLICY quest_journeys_student_select ON quest_journeys
  FOR SELECT USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY quest_journeys_student_update ON quest_journeys
  FOR UPDATE USING (student_id::text = current_setting('request.jwt.claims', true)::json->>'sub');

-- Teacher can read journeys for their units (via admin client bypass in practice)
-- Note: most teacher access goes through createAdminClient() which bypasses RLS

-- Student can CRUD their own milestones
CREATE POLICY quest_milestones_student ON quest_milestones
  FOR ALL USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Student can CRUD their own evidence
CREATE POLICY quest_evidence_student ON quest_evidence
  FOR ALL USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );

-- Student can read their own mentor interactions
CREATE POLICY quest_mentor_interactions_student ON quest_mentor_interactions
  FOR SELECT USING (
    journey_id IN (SELECT id FROM quest_journeys WHERE student_id::text = current_setting('request.jwt.claims', true)::json->>'sub')
  );
-- Insert handled by API (admin client)

-- ─────────────────────────────────────────────────
-- Triggers
-- ─────────────────────────────────────────────────
CREATE TRIGGER quest_journeys_updated_at
  BEFORE UPDATE ON quest_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER quest_milestones_updated_at
  BEFORE UPDATE ON quest_milestones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 2.2 Type Shapes (JSONB Reference)

```typescript
// discovery_profile JSONB
interface DiscoveryProfile {
  strengths: string[];        // e.g. ["building/making", "organising"]
  interests: string[];        // e.g. ["sustainability", "3D printing"]
  needs: string[];            // e.g. ["accessibility in school", "waste reduction"]
  archetype: string;          // e.g. "maker" | "researcher" | "connector" | "leader" | "creator"
  project_idea: string;       // 1-paragraph project statement
  narrowing_notes: string;    // notes from the narrowing step
  discovery_completed_at: string; // ISO timestamp
}

// contract JSONB
interface StudentContract {
  what: string;               // What I'm making/doing/building
  who_for: string;            // Who it's for
  done_looks_like: string;    // What "done" looks like (specific, observable)
  milestones_summary: string; // My milestones and dates (narrative)
  help_needed: string;        // What help I'll need
  success_criteria: string;   // How I'll know if I'm on track
  signed_at: string;          // ISO timestamp when student "signed" the contract
}

// health_score JSONB
interface HealthScore {
  momentum: 'green' | 'amber' | 'red';
  engagement: 'green' | 'amber' | 'red';
  quality: 'green' | 'amber' | 'red';
  self_awareness: 'green' | 'amber' | 'red';
  last_computed_at: string;   // ISO timestamp
  check_in_interval_minutes: number; // derived from health: 5-30
}

// ai_analysis JSONB on quest_evidence
interface EvidenceAnalysis {
  quality_signal: 'low' | 'medium' | 'high';
  summary: string;            // 1-sentence AI summary
  tags: string[];             // auto-tags like ["prototype", "iteration-2", "user-feedback"]
  complexity_score: number;   // 0-10, for quality trajectory tracking
}
```

### 2.3 Entity Relationship

```
┌──────────────────┐     ┌──────────────────┐
│ open_studio_     │     │ quest_journeys   │
│ status           │────▶│                  │
│ (unlock/revoke)  │     │ phase, mentor,   │
│                  │     │ discovery_profile,│
│ + quest_journey_ │     │ contract,        │
│   id FK          │     │ health_score     │
└──────────────────┘     └────────┬─────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
          ┌─────────────┐ ┌────────────┐ ┌──────────────┐
          │ quest_      │ │ quest_     │ │ quest_mentor_│
          │ milestones  │ │ evidence   │ │ interactions │
          │             │ │            │ │              │
          │ title, SMART│ │ photo,voice│ │ discovery,   │
          │ target_date │ │ text, file │ │ check_in,    │
          │ status      │ │ link, tool │ │ help, drift  │
          └─────────────┘ └────────────┘ └──────────────┘
                ▲
                │ milestone_id FK (optional)
                │
          ┌─────┴──────┐
          │ quest_     │
          │ evidence   │
          └────────────┘
```

---

## 3. Quest Engine (Pure TypeScript)

The quest engine is a set of pure functions and types with NO React dependencies, NO database access. It takes data in, returns decisions out. Any component or API route can use it.

### 3.1 Types

```typescript
// src/lib/quest/types.ts

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
  last_computed_at: string;
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
  signed_at: string;
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
  source: MilestoneSource;
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
  ai_analysis: { quality_signal: HealthLevel; summary: string; tags: string[]; complexity_score: number } | null;
  phase: QuestPhase;
  framework_phase_id: string | null;
  created_at: string;
}
```

### 3.2 Phase Transitions

```typescript
// src/lib/quest/phase-machine.ts

import { QuestPhase, QuestJourney, QuestMilestone } from './types';

/** Valid phase transitions */
const TRANSITIONS: Record<QuestPhase, QuestPhase[]> = {
  not_started: ['discovery'],
  discovery: ['planning'],          // can't skip discovery
  planning: ['working'],            // can't skip planning
  working: ['sharing'],             // can revisit planning via milestones, not phase regression
  sharing: ['completed'],
  completed: [],                    // terminal
};

/** Can the journey move from current phase to target? */
export function canTransition(current: QuestPhase, target: QuestPhase): boolean {
  return TRANSITIONS[current]?.includes(target) ?? false;
}

/** Check if Discovery phase is complete (all required fields populated) */
export function isDiscoveryComplete(journey: QuestJourney): boolean {
  const p = journey.discovery_profile;
  if (!p) return false;
  return (
    p.strengths.length > 0 &&
    p.interests.length > 0 &&
    p.needs.length > 0 &&
    p.project_idea.trim().length >= 20  // meaningful project statement
  );
}

/** Check if Planning phase is complete (contract signed + milestones set) */
export function isPlanningComplete(
  journey: QuestJourney,
  milestones: QuestMilestone[]
): boolean {
  const c = journey.contract;
  if (!c || !c.signed_at) return false;

  // Must have at least 3 milestones with target dates
  const datedMilestones = milestones.filter(m => m.target_date && m.phase === 'working');
  return datedMilestones.length >= 3;
}

/** Check if Working phase is complete (all working milestones done or skipped) */
export function isWorkingComplete(milestones: QuestMilestone[]): boolean {
  const workingMilestones = milestones.filter(m => m.phase === 'working');
  if (workingMilestones.length === 0) return false;
  return workingMilestones.every(m => m.status === 'completed' || m.status === 'skipped');
}

/** Check if Sharing phase is complete (sharing milestones done + final reflection exists) */
export function isSharingComplete(
  milestones: QuestMilestone[],
  evidenceCount: number
): boolean {
  const sharingMilestones = milestones.filter(m => m.phase === 'sharing');
  const allDone = sharingMilestones.every(m => m.status === 'completed' || m.status === 'skipped');
  return allDone && evidenceCount > 0; // at least one reflection/evidence in sharing
}

/** Get the next valid phase transition (if any) */
export function getNextPhase(
  journey: QuestJourney,
  milestones: QuestMilestone[],
  sharingEvidenceCount: number
): QuestPhase | null {
  const { phase } = journey;

  switch (phase) {
    case 'not_started': return 'discovery';
    case 'discovery': return isDiscoveryComplete(journey) ? 'planning' : null;
    case 'planning': return isPlanningComplete(journey, milestones) ? 'working' : null;
    case 'working': return isWorkingComplete(milestones) ? 'sharing' : null;
    case 'sharing': return isSharingComplete(milestones, sharingEvidenceCount) ? 'completed' : null;
    case 'completed': return null;
    default: return null;
  }
}
```

### 3.3 Health Score Computation

```typescript
// src/lib/quest/health.ts

import { HealthLevel, HealthScore, QuestJourney, QuestMilestone, QuestEvidence } from './types';

interface HealthInput {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  recentEvidence: QuestEvidence[];   // last 7 days
  daysSinceLastEvidence: number;
  daysSinceLastAIInteraction: number;
  selfReportedPulse: 'crushing_it' | 'okay' | 'stuck' | 'lost' | null;
}

/** Compute momentum: are milestones being completed on time? */
function computeMomentum(milestones: QuestMilestone[]): HealthLevel {
  const active = milestones.filter(m => m.status === 'active' || m.status === 'overdue');
  const overdue = active.filter(m => {
    if (!m.target_date) return false;
    return new Date(m.target_date) < new Date();
  });

  if (overdue.length === 0) return 'green';
  if (overdue.length <= 1) return 'amber';
  return 'red';
}

/** Compute engagement: is the student actively producing evidence? */
function computeEngagement(input: HealthInput): HealthLevel {
  if (input.daysSinceLastEvidence <= 2) return 'green';
  if (input.daysSinceLastEvidence <= 5) return 'amber';
  return 'red';
}

/** Compute quality: is work getting more complex over time? */
function computeQuality(recentEvidence: QuestEvidence[]): HealthLevel {
  const analysed = recentEvidence.filter(e => e.ai_analysis?.complexity_score != null);
  if (analysed.length < 2) return 'green'; // not enough data, assume OK

  // Check if complexity is trending up
  const scores = analysed.map(e => e.ai_analysis!.complexity_score);
  const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
  const secondHalf = scores.slice(Math.floor(scores.length / 2));
  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  if (avgSecond >= avgFirst) return 'green';
  if (avgSecond >= avgFirst * 0.8) return 'amber';
  return 'red';
}

/** Compute self-awareness: does self-report match reality? */
function computeSelfAwareness(input: HealthInput): HealthLevel {
  if (!input.selfReportedPulse) return 'green'; // no data

  const actualHealth = [
    computeMomentum(input.milestones),
    computeEngagement(input),
  ];
  const hasRed = actualHealth.includes('red');
  const allGreen = actualHealth.every(h => h === 'green');

  // Student says "crushing it" but is actually struggling
  if (input.selfReportedPulse === 'crushing_it' && hasRed) return 'red';
  if (input.selfReportedPulse === 'okay' && hasRed) return 'amber';
  // Student says "stuck" but is actually on track — slightly concerning (under-confidence)
  if ((input.selfReportedPulse === 'stuck' || input.selfReportedPulse === 'lost') && allGreen) return 'amber';

  return 'green';
}

/** Compute the check-in interval based on health */
function computeCheckInInterval(score: Omit<HealthScore, 'last_computed_at' | 'check_in_interval_minutes'>): number {
  const levels = [score.momentum, score.engagement, score.quality, score.self_awareness];
  const redCount = levels.filter(l => l === 'red').length;
  const amberCount = levels.filter(l => l === 'amber').length;

  if (redCount >= 2) return 5;
  if (redCount >= 1) return 10;
  if (amberCount >= 2) return 10;
  if (amberCount >= 1) return 15;
  return 25; // all green — light touch
}

/** Main health score computation */
export function computeHealthScore(input: HealthInput): HealthScore {
  const momentum = computeMomentum(input.milestones);
  const engagement = computeEngagement(input);
  const quality = computeQuality(input.recentEvidence);
  const self_awareness = computeSelfAwareness(input);

  const partial = { momentum, engagement, quality, self_awareness };
  return {
    ...partial,
    last_computed_at: new Date().toISOString(),
    check_in_interval_minutes: computeCheckInInterval(partial),
  };
}
```

### 3.4 Milestone Templates per Framework

```typescript
// src/lib/quest/milestone-templates.ts

import { QuestPhase, MilestoneSource } from './types';
import { FrameworkDefinition } from '@/lib/frameworks';

interface MilestoneTemplate {
  title: string;
  description: string;
  phase: QuestPhase;
  framework_phase_id: string;
  source: MilestoneSource;
}

/** Generate default milestones for a framework's Working phase */
export function getDefaultMilestones(framework: FrameworkDefinition): MilestoneTemplate[] {
  return framework.phases.map((fp, i) => ({
    title: `${fp.name} checkpoint`,
    description: fp.description,
    phase: 'working' as QuestPhase,
    framework_phase_id: fp.id,
    source: 'template' as MilestoneSource,
  }));
}

/** Planning phase always has these milestones */
export const PLANNING_MILESTONES: MilestoneTemplate[] = [
  { title: 'Vision of Done defined', description: 'Describe what the finished project looks like at presentation', phase: 'planning', framework_phase_id: '', source: 'template' },
  { title: 'Student Contract signed', description: 'Complete and sign your project contract', phase: 'planning', framework_phase_id: '', source: 'template' },
  { title: 'Resources identified', description: 'List people, materials, and tools you need', phase: 'planning', framework_phase_id: '', source: 'template' },
];

/** Sharing phase always has these milestones */
export const SHARING_MILESTONES: MilestoneTemplate[] = [
  { title: 'Presentation prepared', description: 'Story structure, visually ready, practice done', phase: 'sharing', framework_phase_id: '', source: 'template' },
  { title: 'Presented to audience', description: 'Delivered your presentation or exhibition', phase: 'sharing', framework_phase_id: '', source: 'template' },
  { title: 'Final reflection written', description: 'Compare original goals to actual outcomes', phase: 'sharing', framework_phase_id: '', source: 'template' },
];
```

---

## 4. Mentor Personality System

### 4.1 Mentor Definitions

```typescript
// src/lib/quest/mentors.ts

import { MentorId } from './types';

export interface MentorDefinition {
  id: MentorId;
  name: string;
  tagline: string;          // 1-line personality teaser (shown on selection card)
  archetype: string;        // internal label
  description: string;      // 2-3 sentences shown on hover/expand

  // Visual
  primaryColor: string;     // hex
  accentColor: string;      // hex
  illustration: string;     // SVG path or component name

  // AI personality injection (layered ON TOP of framework prompt)
  systemPromptFragment: string;   // injected into every AI response
  discoveryStyle: string;         // how they run discovery conversations
  celebrationStyle: string;       // how they react to milestones
  driftStyle: string;             // how they handle drift (overlays framework drift language)

  // Audio (ElevenLabs — future)
  voiceId?: string;
  voiceStyle?: string;
}

export const MENTORS: Record<MentorId, MentorDefinition> = {
  kit: {
    id: 'kit',
    name: 'Kit',
    tagline: "Let's try it and see what happens.",
    archetype: 'The Maker',
    description: "Kit is a hands-on tinkerer who learns by doing. They'd rather build a rough prototype in 10 minutes than plan for an hour. Expect practical suggestions, workshop metaphors, and a bias toward action.",
    primaryColor: '#F59E0B',   // amber
    accentColor: '#92400E',    // amber-dark
    illustration: 'kit',
    systemPromptFragment: `Your personality is Kit — the hands-on maker.
You speak in workshop metaphors: "Let's prototype that idea", "time to get your hands dirty", "rough is fine — we can sand it later."
You bias toward ACTION over analysis. When a student is stuck, you suggest building something small rather than thinking more.
You celebrate by describing what they MADE: "Look at that — you built a working model in one session."
You get impatient with over-planning: "You've planned enough. What can you build in the next 20 minutes?"
Short sentences. Direct. Warm but no-nonsense.`,
    discoveryStyle: `During discovery, Kit asks what the student has MADE before — projects, experiments, things they've built.
Kit frames strengths as skills: "Sounds like you're good with your hands" or "You're a problem-solver — you fix things."
Kit's narrowing question: "Which of these ideas could you have a rough version of by next week?"`,
    celebrationStyle: `Kit celebrates by describing the tangible output: "You actually built that. From nothing to a working prototype in 3 sessions."
Uses maker vocabulary: "shipped", "iterated", "tested", "fixed".`,
    driftStyle: `Kit's drift nudge is practical: "Hey — what are you working on right now? Show me."
Escalation: "I notice you haven't made anything new in a while. What's blocking you? Is it a tools problem or a motivation problem?"`,
  },

  sage: {
    id: 'sage',
    name: 'Sage',
    tagline: "What if we think about it differently?",
    archetype: 'The Questioner',
    description: "Sage asks the questions nobody else thinks to ask. They love pulling threads, finding connections, and going deeper. Expect philosophical provocations, reframing challenges, and a lot of 'but why?'",
    primaryColor: '#6366F1',   // indigo
    accentColor: '#3730A3',    // indigo-dark
    illustration: 'sage',
    systemPromptFragment: `Your personality is Sage — the intellectual questioner.
You ask unexpected questions that reframe the problem: "What if the opposite were true?", "Who benefits from this NOT being solved?"
You love connections between ideas: "That reminds me of how [X] works — do you see the parallel?"
You push for deeper understanding, not just completion. When students give surface answers, you probe: "That's interesting — but WHY do you think that?"
You celebrate insight, not output: "You just made a connection that most adults miss."
Calm, thoughtful, slightly academic but never condescending.`,
    discoveryStyle: `During discovery, Sage asks what PUZZLES the student — what they wonder about, what doesn't make sense.
Sage frames strengths as thinking styles: "You're a pattern-finder" or "You think in systems."
Sage's narrowing question: "Which of these ideas keeps you up at night thinking about it?"`,
    celebrationStyle: `Sage celebrates insight: "Do you realize what you just figured out? That's a genuine breakthrough in your understanding."
Uses thinking vocabulary: "discovered", "connected", "understood", "questioned".`,
    driftStyle: `Sage's drift nudge is curiosity-based: "I'm curious — what's occupying your mind right now? Is it the project or something else?"
Escalation: "You seem to have stopped asking questions. That's unusual for you. What happened?"`,
  },

  river: {
    id: 'river',
    name: 'River',
    tagline: "That reminds me of a story...",
    archetype: 'The Storyteller',
    description: "River sees everything as a narrative. They help students find the story in their work — the before and after, the struggle and the breakthrough. Expect metaphors, personal connections, and 'imagine if...' prompts.",
    primaryColor: '#10B981',   // emerald
    accentColor: '#065F46',    // emerald-dark
    illustration: 'river',
    systemPromptFragment: `Your personality is River — the storyteller and connector.
You see projects as narratives: "Every project has a beginning, a struggle, and a transformation."
You help students find the HUMAN story in their work: "Who's the person whose life changes because of this?"
You use metaphors and analogies constantly: "Think of your project like a river — it finds the path of least resistance."
You connect the student's work to real stories and real people.
You celebrate the journey, not just the destination: "Look how far you've come from that first confused conversation."
Warm, empathetic, narrative-driven. Speaks in longer, flowing sentences.`,
    discoveryStyle: `During discovery, River asks about people the student cares about and stories that moved them.
River frames strengths as roles: "You're the one people come to when they need someone to listen" or "You're a bridge-builder."
River's narrowing question: "Which of these ideas has a person at the centre whose life you want to change?"`,
    celebrationStyle: `River celebrates the narrative arc: "Remember when you started and you had no idea what to do? Look at you now."
Uses story vocabulary: "chapter", "turning point", "breakthrough moment", "your story".`,
    driftStyle: `River's drift nudge is empathetic: "Hey — I sense something's off. Want to talk about it? Even if it's not about the project."
Escalation: "Your story has gone quiet. That's okay — every story has a pause. But I want to make sure it's a pause, not an ending."`,
  },

  spark: {
    id: 'spark',
    name: 'Spark',
    tagline: "But what if you're wrong?",
    archetype: 'The Provocateur',
    description: "Spark challenges everything — assumptions, comfort zones, and 'good enough.' They push students to be bolder, take risks, and defend their ideas. Expect devil's advocate questions, competitive energy, and 'prove it.'",
    primaryColor: '#EF4444',   // red
    accentColor: '#991B1B',    // red-dark
    illustration: 'spark',
    systemPromptFragment: `Your personality is Spark — the provocateur and challenger.
You play devil's advocate: "That's a safe choice. What's the BOLD choice?", "Everyone does it that way. Why should you?"
You challenge comfort zones: "You're playing it safe. What would you do if you couldn't fail?"
You push for ambition: "Good enough isn't good enough. What would AMAZING look like?"
You respect pushback — when students defend their ideas well, you back off: "OK, you've convinced me. That's a strong argument."
You celebrate courage and risk-taking: "THAT was brave. Most people wouldn't have tried that."
Direct, energetic, competitive. Short punchy sentences. Uses "prove it", "show me", "so what?"`,
    discoveryStyle: `During discovery, Spark asks what makes the student ANGRY or what they think is UNFAIR.
Spark frames strengths as superpowers: "You've got a competitive streak — that's a weapon."
Spark's narrowing question: "Which of these ideas scares you the most? Do that one."`,
    celebrationStyle: `Spark celebrates boldness: "You took the risk and it paid off. That's what separates good from great."
Uses competitive vocabulary: "crushed it", "nailed it", "bold move", "game changer".`,
    driftStyle: `Spark's drift nudge is challenging: "You've gone quiet. That's not like you. What happened to the fire?"
Escalation: "Honest question — are you giving up, or are you regrouping? Because those are very different things."`,
  },

  haven: {
    id: 'haven',
    name: 'Haven',
    tagline: "Take your time. I'll be here.",
    archetype: 'The Quiet Builder',
    description: "Haven is patient, gentle, and creates a safe space for students who need it. They never rush, never judge, and always validate feelings before pushing forward. Expect patience, reassurance, and 'it's okay to not know yet.'",
    primaryColor: '#8B5CF6',   // violet
    accentColor: '#5B21B6',    // violet-dark
    illustration: 'haven',
    systemPromptFragment: `Your personality is Haven — the quiet builder and safe space.
You never rush: "There's no wrong pace. Take the time you need."
You validate feelings before problem-solving: "It's completely okay to feel overwhelmed. Let's break this into smaller pieces."
You notice small wins others might miss: "You might not see it, but you just made a really important decision."
You use gentle language: "What if we tried..." instead of "You should..."
You're the mentor for students who are anxious, perfectionist, or struggling with confidence.
You celebrate effort and process, not just results: "The fact that you kept going when it was hard — that matters."
Soft, patient, warm. Longer sentences. Lots of "we" language.`,
    discoveryStyle: `During discovery, Haven asks what makes the student feel calm and what they enjoy doing quietly.
Haven frames strengths gently: "I notice you're really thoughtful about details" or "You care deeply about getting things right."
Haven's narrowing question: "Which of these ideas feels most like YOU? Not the most impressive — the most authentic."`,
    celebrationStyle: `Haven celebrates quietly: "I want you to pause and notice what you just accomplished. That took real courage."
Uses gentle vocabulary: "grew", "became", "discovered in yourself", "found your voice".`,
    driftStyle: `Haven's drift nudge is supportive: "Hey — just checking in. No pressure. How are you feeling about everything?"
Escalation: "I've noticed things have been quiet. That's okay. But I want you to know I'm here whenever you're ready."`,
  },
};

/** Get a mentor by ID */
export function getMentor(id: MentorId | null | undefined): MentorDefinition | null {
  if (!id) return null;
  return MENTORS[id] || null;
}

/** All mentors for selection UI */
export const MENTOR_OPTIONS = Object.values(MENTORS);
```

### 4.2 Prompt Composition

The AI prompt for any quest interaction is composed in layers:

```
Layer 1: Framework knowledge (from FrameworkDefinition.mentorPrompt or guidedMentorPrompt)
Layer 2: Mentor personality (from MentorDefinition.systemPromptFragment)
Layer 3: Help intensity modifier (from HelpIntensity)
Layer 4: Phase-specific rules (from quest engine context)
Layer 5: Student context (discovery profile, contract, recent evidence, health score)
```

```typescript
// src/lib/quest/build-quest-prompt.ts

import { QuestJourney, QuestMilestone, QuestEvidence, HelpIntensity } from './types';
import { getMentor } from './mentors';
import { getFramework } from '@/lib/frameworks';

const HELP_INTENSITY_MODIFIERS: Record<HelpIntensity, string> = {
  explorer: `This student is in EXPLORER mode (low scaffolding).
Ask open-ended questions. Rarely give examples. Wait for them to take initiative.
Only intervene if they explicitly ask for help or if drift is detected.`,

  guided: `This student is in GUIDED mode (medium scaffolding — default).
Ask probing questions. Offer one example or direction when they seem stuck.
Respond to requests but also do periodic check-ins.`,

  supported: `This student is in SUPPORTED mode (high scaffolding).
Break tasks into small steps. Give multiple examples. Be proactive with suggestions.
Check in frequently. Validate effort before pushing further.
This student may be anxious, struggling, or new to self-directed work.`,

  auto: `Adapt your scaffolding level based on the student's recent behavior.
If they're flowing (submitting evidence, meeting milestones) — step back.
If they're stuck (no evidence, overdue milestones, low engagement) — step forward.
Match the energy they're bringing.`,
};

export interface QuestPromptContext {
  journey: QuestJourney;
  milestones: QuestMilestone[];
  recentEvidence: QuestEvidence[];
  interactionType: string;
  studentMessage?: string;
}

export function buildQuestPrompt(ctx: QuestPromptContext): string {
  const framework = getFramework(ctx.journey.framework_id);
  const mentor = getMentor(ctx.journey.mentor_id);
  const intensity = HELP_INTENSITY_MODIFIERS[ctx.journey.help_intensity];

  const parts: string[] = [];

  // Layer 1: Framework knowledge
  parts.push(`## Framework: ${framework.name}\n${framework.mentorPrompt}`);

  // Layer 2: Mentor personality
  if (mentor) {
    parts.push(`## Your Personality: ${mentor.name}\n${mentor.systemPromptFragment}`);
  }

  // Layer 3: Help intensity
  parts.push(`## Scaffolding Level\n${intensity}`);

  // Layer 4: Phase-specific rules
  parts.push(buildPhaseRules(ctx));

  // Layer 5: Student context
  parts.push(buildStudentContext(ctx));

  // Universal rules
  parts.push(`## Universal Rules
- NEVER write the student's work for them. Ask questions, give examples, suggest directions.
- Keep responses under 150 words unless the student asks for more detail.
- Use the ${framework.vocabulary.project} vocabulary (not generic "project" language).
- Reference their discovery profile and contract when relevant.
- If they seem off-track, reference their original project statement.`);

  return parts.join('\n\n');
}

function buildPhaseRules(ctx: QuestPromptContext): string {
  switch (ctx.journey.phase) {
    case 'discovery':
      const mentor = getMentor(ctx.journey.mentor_id);
      return `## Phase: Discovery\n${mentor?.discoveryStyle || 'Help the student discover their strengths, interests, and project idea through questions, not instructions.'}`;
    case 'planning':
      return `## Phase: Planning
Help the student work BACKWARD from their end date.
Push for specific, measurable milestones.
Challenge vague goals: "What does 'done' actually look like?"
Help them write their contract but NEVER write it for them.`;
    case 'working':
      return `## Phase: Working
You are a studio critic now — reactive, observant, minimal intervention.
Only engage when the student asks or when check-in timer fires.
When reviewing evidence, give specific feedback on quality and progress.
Reference their milestones: "You set [X] as your next milestone. How's that going?"`;
    case 'sharing':
      return `## Phase: Sharing
Help the student prepare their presentation and final reflection.
Push for narrative structure: problem → process → solution → impact → learning.
Help them anticipate questions from the audience.
Celebrate the journey, not just the product.`;
    default:
      return '';
  }
}

function buildStudentContext(ctx: QuestPromptContext): string {
  const parts: string[] = ['## Student Context'];
  const { journey } = ctx;

  if (journey.discovery_profile) {
    const p = journey.discovery_profile;
    parts.push(`Strengths: ${p.strengths.join(', ')}`);
    parts.push(`Interests: ${p.interests.join(', ')}`);
    parts.push(`Project: ${p.project_idea}`);
    if (p.archetype) parts.push(`Archetype: ${p.archetype}`);
  }

  if (journey.contract) {
    parts.push(`Contract: Making "${journey.contract.what}" for ${journey.contract.who_for}`);
    parts.push(`Success criteria: ${journey.contract.success_criteria}`);
  }

  // Recent milestone status
  const activeMilestones = ctx.milestones.filter(m => m.status === 'active');
  const overdueMilestones = ctx.milestones.filter(m => m.status === 'overdue');
  if (activeMilestones.length > 0) {
    parts.push(`Active milestones: ${activeMilestones.map(m => m.title).join(', ')}`);
  }
  if (overdueMilestones.length > 0) {
    parts.push(`⚠️ Overdue milestones: ${overdueMilestones.map(m => m.title).join(', ')}`);
  }

  // Health
  const h = journey.health_score;
  if (h.momentum === 'red' || h.engagement === 'red') {
    parts.push(`⚠️ Health concern: momentum=${h.momentum}, engagement=${h.engagement}`);
  }

  if (journey.sessions_remaining != null) {
    parts.push(`Sessions remaining: ${journey.sessions_remaining}`);
  }

  return parts.join('\n');
}
```

---

## 5. Overworld Map (Custom SVG)

### 5.1 Architecture

The overworld map is a custom SVG canvas (NOT React Flow — Matt chose the harder custom route for full artistic control). It renders:

- **4 phase regions** as large SVG illustration areas (Discovery, Planning, Working, Sharing)
- **Milestone nodes** within each region as interactive circles
- **Paths** connecting phases and milestones as animated SVG lines
- **Student avatar** positioned at the current milestone
- **Color progression** via CSS filter on the entire map (Gris mechanic)

```
src/components/quest/
├── OverworldMap.tsx          — Main map container (SVG viewBox, zoom, pan)
├── PhaseRegion.tsx           — SVG group per phase (background illustration + milestones)
├── MilestoneNode.tsx         — Interactive milestone circle (status colors, click handler)
├── JourneyPath.tsx           — SVG path between nodes (animated stroke-dasharray)
├── StudentMarker.tsx         — Pulsing avatar at current position
├── PhaseTransition.tsx       — Animated overlay for phase change ceremonies
└── map-layout.ts             — Pure function: milestones → SVG coordinates
```

### 5.2 Map Layout Engine

```typescript
// src/lib/quest/map-layout.ts

import { QuestPhase, QuestMilestone } from './types';

export interface MapNode {
  id: string;
  x: number;       // SVG coordinate (0-1200 range)
  y: number;       // SVG coordinate (0-800 range)
  phase: QuestPhase;
  type: 'phase_gate' | 'milestone';
  status: string;
  label: string;
}

export interface MapPath {
  from: string;     // node ID
  to: string;       // node ID
  completed: boolean;
}

/** Phase gate positions (fixed) */
const PHASE_GATES: Record<QuestPhase, { x: number; y: number }> = {
  not_started: { x: 50, y: 400 },
  discovery: { x: 200, y: 400 },
  planning: { x: 450, y: 400 },
  working: { x: 750, y: 400 },
  sharing: { x: 1050, y: 400 },
  completed: { x: 1150, y: 400 },
};

/**
 * Layout milestones within a phase region.
 * Milestones fan out vertically from the phase gate,
 * then reconverge at the next gate.
 */
export function layoutMilestones(
  milestones: QuestMilestone[],
  currentPhase: QuestPhase
): { nodes: MapNode[]; paths: MapPath[] } {
  const nodes: MapNode[] = [];
  const paths: MapPath[] = [];

  // Add phase gate nodes
  const phases: QuestPhase[] = ['discovery', 'planning', 'working', 'sharing'];
  for (const phase of phases) {
    const gate = PHASE_GATES[phase];
    nodes.push({
      id: `gate_${phase}`,
      x: gate.x,
      y: gate.y,
      phase,
      type: 'phase_gate',
      status: phase === currentPhase ? 'active' : 'completed',
      label: phase.charAt(0).toUpperCase() + phase.slice(1),
    });
  }

  // Add phase-to-phase paths
  for (let i = 0; i < phases.length - 1; i++) {
    paths.push({
      from: `gate_${phases[i]}`,
      to: `gate_${phases[i + 1]}`,
      completed: phases.indexOf(currentPhase) > i,
    });
  }

  // Layout milestones within each phase
  for (const phase of phases) {
    const phaseMilestones = milestones.filter(m => m.phase === phase);
    if (phaseMilestones.length === 0) continue;

    const gate = PHASE_GATES[phase];
    const nextGate = PHASE_GATES[phases[phases.indexOf(phase) + 1] || 'completed'];
    const regionWidth = nextGate.x - gate.x;

    phaseMilestones.forEach((m, i) => {
      const progress = (i + 1) / (phaseMilestones.length + 1);
      // Fan out vertically, then reconverge
      const verticalSpread = Math.sin(progress * Math.PI) * 120;
      const direction = i % 2 === 0 ? -1 : 1; // alternate above/below center

      const node: MapNode = {
        id: m.id,
        x: gate.x + regionWidth * progress,
        y: gate.y + verticalSpread * direction,
        phase,
        type: 'milestone',
        status: m.status,
        label: m.title,
      };
      nodes.push(node);

      // Connect to previous node or phase gate
      const prevId = i === 0 ? `gate_${phase}` : phaseMilestones[i - 1].id;
      paths.push({ from: prevId, to: m.id, completed: m.status === 'completed' });

      // Last milestone connects to next gate
      if (i === phaseMilestones.length - 1) {
        const nextPhase = phases[phases.indexOf(phase) + 1];
        if (nextPhase) {
          paths.push({ from: m.id, to: `gate_${nextPhase}`, completed: m.status === 'completed' });
        }
      }
    });
  }

  return { nodes, paths };
}
```

### 5.3 Color Progression System

```typescript
// src/lib/quest/color-system.ts

import { QuestPhase } from './types';

export interface PhaseColorScheme {
  background: string;       // CSS gradient
  filter: string;           // CSS filter for saturation progression
  accentColor: string;      // primary UI accent
  nodeGlow: string;         // SVG glow filter color
}

export const PHASE_COLORS: Record<QuestPhase, PhaseColorScheme> = {
  not_started: {
    background: 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
    filter: 'saturate(0.15) brightness(1.1)',
    accentColor: '#78716c',
    nodeGlow: '#a8a29e',
  },
  discovery: {
    background: 'linear-gradient(135deg, #fefce8 0%, #fef3c7 50%, #fde68a 100%)',
    filter: 'saturate(0.5) sepia(0.15)',
    accentColor: '#d97706',
    nodeGlow: '#f59e0b',
  },
  planning: {
    background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #bfdbfe 100%)',
    filter: 'saturate(0.7)',
    accentColor: '#2563eb',
    nodeGlow: '#3b82f6',
  },
  working: {
    background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 30%, #bbf7d0 60%, #fef3c7 100%)',
    filter: 'saturate(1.0)',
    accentColor: '#059669',
    nodeGlow: '#10b981',
  },
  sharing: {
    background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #e9d5ff 100%)',
    filter: 'saturate(1.0) brightness(1.05)',
    accentColor: '#7c3aed',
    nodeGlow: '#8b5cf6',
  },
  completed: {
    background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 30%, #fbcfe8 60%, #f9a8d4 100%)',
    filter: 'saturate(1.1) brightness(1.05)',
    accentColor: '#db2777',
    nodeGlow: '#ec4899',
  },
};

/** Get interpolated watercolor overlay for blending */
export function getWatercolorOverlay(phase: QuestPhase): string {
  // Radial gradient blobs that create watercolor-like soft edges
  const colors = PHASE_COLORS[phase];
  return `
    radial-gradient(ellipse at 20% 30%, ${colors.accentColor}15 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, ${colors.nodeGlow}10 0%, transparent 40%),
    radial-gradient(ellipse at 50% 50%, ${colors.accentColor}08 0%, transparent 60%)
  `;
}
```

---

## 6. Phase-Specific UIs

### 6.1 Discovery Phase

Reuses and extends existing `ComicPanel.tsx` and `DiscoveryFlow.tsx`:

- **MentorSelector.tsx** — 5 illustrated cards in a campfire scene. Pick triggers spring animation.
- **DiscoveryFlow.tsx** (modify) — Wire mentor choice into all AI responses. Per-mentor discovery questions.
- **DiscoveryStep** components for each of the 5 steps (Strengths, Interests, Needs, Narrowing, Commitment)
- **ProfileBuilder** — inline cards that populate as student answers (strengths appear as tags, interests as icons)

### 6.2 Planning Phase

- **ContractForm.tsx** — 6-field guided form with effort-gating per field (meaningful word count before AI feedback). Inline AI coaching (effort-aware nudges per field).
- **BackwardTimeline.tsx** — Horizontal timeline component. End date anchored (from timetable engine). Milestone nodes draggable. Today marker. Shows sessions remaining.
- **SMARTGoalEditor.tsx** — Per-milestone SMART goal form. AI scaffolds each field with 1 question.
- **ResourceDirectory.tsx** — Read-only view of teacher's people/equipment/materials with search.

### 6.3 Working Phase

- **WorkingDashboard.tsx** — The "monday.com" daily view. Active milestone card at top, evidence timeline below, Quick Capture bar at bottom.
- **QuickCaptureBar.tsx** — Floating bar: 📷 (photo capture/upload) | 🎤 (voice memo) | ✏️ (text note) | 📎 (file/link). Auto-links to current active milestone.
- **MilestoneCard.tsx** — Expandable card: title, SMART goals, target date, evidence attached, completion button with note field.
- **EvidenceTimeline.tsx** — Vertical timeline of all evidence items, grouped by date. Thumbnails for photos, transcripts for voice, text previews.
- **QuickPulse.tsx** — Single-tap micro-survey: 🟢 Crushing it | 🟡 Okay | 🟠 Stuck | 🔴 Lost

### 6.4 Sharing Phase

- **PresentationScaffold.tsx** — AI-guided presentation prep (5-step: story structure, audience, practice, anticipate questions, final check)
- **FinalReflection.tsx** — Structured comparison: original statement vs actual outcome, planned vs actual timeline, strengths discovered vs demonstrated
- **CelebrationScreen.tsx** — End-of-journey celebration with mentor reaction, journey stats, phase color explosion animation

---

## 7. API Routes

```
/api/student/quest/
├── journey/route.ts           — GET (load journey) + POST (create journey)
├── journey/phase/route.ts     — PATCH (advance phase)
├── journey/mentor/route.ts    — PATCH (select mentor)
├── journey/discovery/route.ts — PATCH (update discovery profile)
├── journey/contract/route.ts  — PATCH (update contract)
├── journey/pulse/route.ts     — POST (quick pulse self-report)
├── milestones/route.ts        — GET (list) + POST (create) + PATCH (update)
├── milestones/[id]/route.ts   — PATCH (complete/skip) + DELETE
├── evidence/route.ts          — GET (list) + POST (create)
├── evidence/upload/route.ts   — POST (file upload with compression)
├── mentor/route.ts            — POST (send message to AI mentor, returns response)
├── mentor/check-in/route.ts   — POST (triggered by check-in timer)

/api/teacher/quest/
├── dashboard/route.ts         — GET (all journeys for a class-unit with health scores)
├── journey/[id]/route.ts      — PATCH (adjust help_intensity, add teacher_note)
├── milestones/[id]/route.ts   — PATCH (adjust date, add teacher note)
├── resources/route.ts         — GET + POST + PATCH (manage resource directory)
```

All student routes use `requireStudentAuth` (cookie token session). All teacher routes use Supabase SSR auth + `createAdminClient`.

---

## 8. Component Tree

```
src/components/quest/
├── # Core
├── QuestProvider.tsx           — React context: journey state, milestones, evidence, actions
├── useQuest.ts                 — Hook consuming QuestProvider (loads data, provides mutations)
│
├── # Overworld Map
├── OverworldMap.tsx             — Main SVG map container
├── PhaseRegion.tsx             — SVG background illustration per phase
├── MilestoneNode.tsx           — Interactive milestone circle
├── JourneyPath.tsx             — Animated connecting path
├── StudentMarker.tsx           — Pulsing current-position indicator
├── PhaseTransition.tsx         — Celebration overlay on phase change
│
├── # Discovery
├── MentorSelector.tsx          — 5-card campfire selection screen
├── MentorCard.tsx              — Individual mentor card with illustration
├── DiscoverySteps.tsx          — 5-step discovery flow (extends existing DiscoveryFlow pattern)
├── ProfileBuilder.tsx          — Inline profile cards (strengths/interests/needs tags)
│
├── # Planning
├── ContractForm.tsx            — 6-field guided contract with effort-gating
├── BackwardTimeline.tsx        — Horizontal milestone timeline
├── SMARTGoalEditor.tsx         — Per-milestone SMART goal fields
├── ResourceBrowser.tsx         — Read-only teacher resource directory view
│
├── # Working
├── WorkingDashboard.tsx        — Daily working view (milestone + evidence + capture)
├── QuickCaptureBar.tsx         — Floating evidence capture bar
├── MilestoneCard.tsx           — Expandable milestone with evidence
├── EvidenceTimeline.tsx        — Vertical evidence feed
├── QuickPulse.tsx              — One-tap self-report
│
├── # Sharing
├── PresentationScaffold.tsx    — AI-guided presentation prep
├── FinalReflection.tsx         — Structured end-of-journey reflection
├── CelebrationScreen.tsx       — Journey completion celebration
│
├── # Teacher
├── QuestTeacherDashboard.tsx   — Class overview: journey cards with health scores
├── HelpIntensitySlider.tsx     — Per-student scaffolding control
├── ResourceDirectoryEditor.tsx — Teacher CRUD for people/equipment/materials
├── JourneyDetail.tsx           — Teacher view of single student's full journey
│
├── # Shared
├── HealthBadge.tsx             — Traffic-light health indicator (🟢🟡🔴)
├── MentorAvatar.tsx            — Mentor illustration (SVG per mentor)
├── PhaseLabel.tsx              — Colored phase name badge
└── index.ts                    — Barrel exports
```

```
src/lib/quest/
├── types.ts                    — All quest types
├── phase-machine.ts            — Phase transition logic
├── health.ts                   — Health score computation
├── milestone-templates.ts      — Framework-specific milestone defaults
├── mentors.ts                  — 5 mentor definitions + personality prompts
├── build-quest-prompt.ts       — AI prompt composition (framework × mentor × intensity × phase)
├── map-layout.ts               — Milestone → SVG coordinate layout engine
├── color-system.ts             — Phase color schemes + watercolor overlays
└── index.ts                    — Barrel exports
```

---

## 9. State Flow

### 9.1 Quest Lifecycle

```
Student opens quest unit
  │
  ├─ No journey exists → POST /api/student/quest/journey (creates journey)
  │                        └─ Phase: 'discovery', mentor: null
  │
  ├─ Journey exists, no mentor → Show MentorSelector
  │                                └─ PATCH /api/student/quest/journey/mentor
  │
  ├─ Mentor chosen, phase='discovery' → Show DiscoveryFlow
  │   └─ Each step: PATCH /api/student/quest/journey/discovery
  │   └─ Complete: PATCH /api/student/quest/journey/phase → 'planning'
  │
  ├─ Phase='planning' → Show ContractForm + BackwardTimeline
  │   └─ Contract: PATCH /api/student/quest/journey/contract
  │   └─ Milestones: POST /api/student/quest/milestones
  │   └─ Complete: PATCH /api/student/quest/journey/phase → 'working'
  │
  ├─ Phase='working' → Show WorkingDashboard + OverworldMap
  │   └─ Evidence: POST /api/student/quest/evidence
  │   └─ Milestone complete: PATCH /api/student/quest/milestones/[id]
  │   └─ Check-ins: POST /api/student/quest/mentor/check-in (timer-driven)
  │   └─ Complete: PATCH /api/student/quest/journey/phase → 'sharing'
  │
  ├─ Phase='sharing' → Show PresentationScaffold + FinalReflection
  │   └─ Complete: PATCH /api/student/quest/journey/phase → 'completed'
  │
  └─ Phase='completed' → Show CelebrationScreen + OverworldMap (fully colored)
```

### 9.2 React Context Shape

```typescript
// src/components/quest/QuestProvider.tsx

interface QuestContextValue {
  // Data
  journey: QuestJourney | null;
  milestones: QuestMilestone[];
  recentEvidence: QuestEvidence[];
  framework: FrameworkDefinition;
  mentor: MentorDefinition | null;
  colorScheme: PhaseColorScheme;

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Actions
  selectMentor: (mentorId: MentorId) => Promise<void>;
  updateDiscoveryProfile: (profile: Partial<DiscoveryProfile>) => Promise<void>;
  updateContract: (contract: Partial<StudentContract>) => Promise<void>;
  advancePhase: () => Promise<void>;
  addMilestone: (milestone: Partial<QuestMilestone>) => Promise<void>;
  updateMilestone: (id: string, updates: Partial<QuestMilestone>) => Promise<void>;
  completeMilestone: (id: string, note: string) => Promise<void>;
  addEvidence: (evidence: Partial<QuestEvidence>) => Promise<void>;
  submitPulse: (pulse: string) => Promise<void>;
  sendMentorMessage: (message: string) => Promise<string>; // returns AI response
}
```

---

## 10. Integration with Existing Systems

### 10.1 Open Studio → Quest Journey

The existing Open Studio system (unlock/revoke, sessions, drift detection) continues to work. The Quest Journey layer EXTENDS it:

- `open_studio_status.quest_journey_id` links the unlock to a quest journey
- When Open Studio is unlocked for a unit, the quest journey is created (if it doesn't exist)
- The `useOpenStudio` hook's check-in timer feeds into quest health score computation
- Drift detection escalation uses mentor personality (Kit's drift is different from Haven's)

### 10.2 Framework System

Already fully built. `getFramework()` returns phases, mentor prompts, vocabulary, toolkit tools. The quest engine consumes this directly. No changes needed to `src/lib/frameworks/index.ts`.

### 10.3 Timetable → Sessions Remaining

The cycle engine (`src/lib/scheduling/cycle-engine.ts`) computes remaining sessions:

```typescript
import { getLessonCountInRange } from '@/lib/scheduling/cycle-engine';

// On phase change or weekly, recompute sessions_remaining
const remaining = getLessonCountInRange(timetable, classMeetings, today, termEndDate);
```

### 10.4 Toolkit Tools

QuickToolFAB already suggests tools per design phase. The quest system extends this:

- During Planning, suggest SWOT, Decision Matrix, Stakeholder Map
- During Working, suggest phase-appropriate tools from `FrameworkPhase.toolkitTools`
- Tool session completions auto-create quest evidence (type: 'tool_session')

### 10.5 Student Dashboard

Student dashboard shows quest journey card per unit (replacing or alongside current "Continue Where You Left Off"):

- Overworld map in compact mode (shows phase progress + current position)
- Health score indicators (visible to student as encouragement, not judgment)
- Next milestone with countdown

### 10.6 Teacher Dashboard

Teacher dashboard shows per-class quest overview:

- Grid of student cards with health score traffic lights
- Help intensity slider per student
- Alert flags for students needing attention
- Click-through to full journey detail

---

## 11. File Plan

### New Files (~40 files)

```
# Migration
supabase/migrations/042_quest_journeys.sql

# Quest Engine (pure TypeScript, no React)
src/lib/quest/types.ts
src/lib/quest/phase-machine.ts
src/lib/quest/health.ts
src/lib/quest/milestone-templates.ts
src/lib/quest/mentors.ts
src/lib/quest/build-quest-prompt.ts
src/lib/quest/map-layout.ts
src/lib/quest/color-system.ts
src/lib/quest/index.ts

# API Routes — Student (11 files)
src/app/api/student/quest/journey/route.ts
src/app/api/student/quest/journey/phase/route.ts
src/app/api/student/quest/journey/mentor/route.ts
src/app/api/student/quest/journey/discovery/route.ts
src/app/api/student/quest/journey/contract/route.ts
src/app/api/student/quest/journey/pulse/route.ts
src/app/api/student/quest/milestones/route.ts
src/app/api/student/quest/milestones/[id]/route.ts
src/app/api/student/quest/evidence/route.ts
src/app/api/student/quest/evidence/upload/route.ts
src/app/api/student/quest/mentor/route.ts

# API Routes — Teacher (4 files)
src/app/api/teacher/quest/dashboard/route.ts
src/app/api/teacher/quest/journey/[id]/route.ts
src/app/api/teacher/quest/milestones/[id]/route.ts
src/app/api/teacher/quest/resources/route.ts

# React Components (~20 files)
src/components/quest/QuestProvider.tsx
src/components/quest/useQuest.ts
src/components/quest/OverworldMap.tsx
src/components/quest/PhaseRegion.tsx
src/components/quest/MilestoneNode.tsx
src/components/quest/JourneyPath.tsx
src/components/quest/StudentMarker.tsx
src/components/quest/MentorSelector.tsx
src/components/quest/ContractForm.tsx
src/components/quest/BackwardTimeline.tsx
src/components/quest/WorkingDashboard.tsx
src/components/quest/QuickCaptureBar.tsx
src/components/quest/MilestoneCard.tsx
src/components/quest/QuickPulse.tsx
src/components/quest/QuestTeacherDashboard.tsx
src/components/quest/HelpIntensitySlider.tsx
src/components/quest/HealthBadge.tsx
src/components/quest/MentorAvatar.tsx
src/components/quest/index.ts
```

### Modified Files (~8 files)

```
src/types/index.ts                              — Add quest types
src/hooks/useOpenStudio.ts                      — Wire quest journey creation on unlock
src/lib/ai/open-studio-prompt.ts                — Import mentor personality for prompt composition
src/app/(student)/open-studio/[unitId]/page.tsx  — Mount quest components based on phase
src/app/teacher/units/[unitId]/class/[classId]/page.tsx — Add quest tab to class hub
src/app/(student)/dashboard/page.tsx             — Show quest journey card
src/app/teacher/dashboard/page.tsx               — Show quest health overview
src/app/teacher/settings/page.tsx                — Resource directory management
```

---

## 12. Build Order

### Phase 1: Foundation (~3 days)
1. **Migration 042** — Create quest tables
2. **src/lib/quest/*** — All 9 engine files (types, phase machine, health, mentors, prompts, layout, colors, templates)
3. **Basic API routes** — journey CRUD, milestone CRUD, evidence CRUD
4. **QuestProvider + useQuest** — React context + data loading hook

### Phase 2: Mentor System + Discovery (~2 days)
5. **MentorSelector.tsx** — Campfire selection screen
6. **Discovery flow enhancement** — Wire mentors into existing DiscoveryFlow
7. **Mentor AI prompts** — 5 personality variations for all interaction types
8. **Journey/mentor/discovery API routes** — Selection + profile update

### Phase 3: Overworld Map (~3 days)
9. **OverworldMap.tsx** — Custom SVG canvas with viewBox, zoom support
10. **PhaseRegion.tsx** — SVG illustrations per phase (watercolor style)
11. **MilestoneNode.tsx + JourneyPath.tsx** — Interactive nodes + animated paths
12. **StudentMarker.tsx** — Pulsing position indicator
13. **Color progression system** — CSS filter transitions
14. **PhaseTransition.tsx** — Phase change celebration animation

### Phase 4: Planning Phase (~2 days)
15. **ContractForm.tsx** — 6-field guided form with effort-gating
16. **BackwardTimeline.tsx** — Visual milestone timeline with timetable integration
17. **SMARTGoalEditor.tsx** — Per-milestone SMART fields
18. **Planning API routes** — Contract update, milestone creation

### Phase 5: Working Phase (~2 days)
19. **WorkingDashboard.tsx** — Daily view (active milestone + evidence + capture)
20. **QuickCaptureBar.tsx** — Photo/voice/text/file capture
21. **EvidenceTimeline.tsx** — Evidence feed display
22. **QuickPulse.tsx** — One-tap self-report
23. **Health score API** — Compute and cache health on evidence/milestone events

### Phase 6: Teacher Dashboard (~1-2 days)
24. **QuestTeacherDashboard.tsx** — Class journey overview with health grid
25. **HelpIntensitySlider.tsx** — Per-student scaffolding control
26. **ResourceDirectoryEditor.tsx** — People/equipment/materials CRUD
27. **Teacher API routes** — Dashboard, journey adjustment, resource management

### Phase 7: Sharing + Integration (~1-2 days)
28. **PresentationScaffold + FinalReflection + CelebrationScreen**
29. **Wire into student dashboard** — Quest journey card
30. **Wire into Open Studio** — Quest journey creation on unlock
31. **Wire toolkit tools** — Auto-evidence from tool session completions

**Total: ~14-18 days**

---

## 13. Decisions (Resolved 25 March 2026)

1. **Quest mode: opt-in toggle** on class-unit settings. Default ON for Service/PP/PYPx, OFF for Design.
2. **Voice memo transcription: later.** Store audio now, transcribe with Whisper API in a future phase.
3. **Mentor illustrations: Gris watercolor style.** Semi-realistic watercolor with muted backgrounds. ChatGPT gpt-image-1 for initial generation.
4. **Mobile map: compact vertical scroll** (phases stacked top-to-bottom), full horizontal map on desktop/iPad.
5. **Milestone dates: AI suggests from timetable**, student confirms, teacher can override.
6. **Grading: quest evidence auto-populates** grading page's evidence column. Teacher scores independently.
7. **Resource directory: per-teacher** for now. School-wide sharing is a future feature.
8. **Health score: visible to students** as encouraging indicators AND raw scores. Teachers also see the traffic-light view.

### Additional Decisions from Matt (25 March 2026)

| # | Question | Decision |
|---|----------|----------|
| A | Mentor voice audio | **Text only for now.** ElevenLabs integration deferred to a later phase. |
| B | Discovery length | **3-5 panels per chapter × 5 chapters** (as spec'd). OK as-is. |
| C | Contract formality | **Confirmation button** — no digital signature, just a clear "I commit to this" action. |
| D | Evidence approval | **Teacher must approve** evidence before it counts toward milestone completion. |
| E | Health score visibility | **Students see their scores too** (not just teachers). Show the real data. |
| F | Milestone templates | **Editable by teachers.** Framework templates are starting points, not fixed. |
| G | Map visual style | **Gris watercolor** — CSS blend modes, desaturated-to-vivid color-as-progression. |
| H | Demo framework | **Service Learning** — showcase for principal demo next week. |
