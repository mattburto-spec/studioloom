# Unit Generation Pipeline Audit — 2 April 2026

**Scope:** Comprehensive analysis of 5 core generation routes + timing architecture + lesson structure system + skeleton test endpoint.

**Files audited:**
1. `src/lib/ai/lesson-structures.ts` — Lesson type templates (Workshop Model + 7 variants)
2. `src/app/api/teacher/generate-unit/route.ts` — Criterion-based generation (parallel A/B/C/D)
3. `src/app/api/teacher/generate-journey/route.ts` — Journey-mode batch lesson generation
4. `src/app/api/teacher/generate-timeline/route.ts` — Timeline activities (skeleton → per-lesson stages)
5. `src/app/api/admin/ai-model/test/route.ts` — Admin skeleton test endpoint

---

## PART 1: LESSON STRUCTURE SYSTEM

### Location
`src/lib/ai/lesson-structures.ts` (478 lines)

### Core Data Structure

#### `LessonPhaseTemplate` interface
```typescript
{
  name: string;                              // "Opening", "Work Time", "Debrief", etc.
  durationRange: [number, number];           // [min, max] in minutes
  isMainBlock?: boolean;                     // is this the primary student work block?
  isInstruction?: boolean;                   // does this count toward 1+age instruction cap?
  description: string;                       // injected into AI prompts
}
```

#### `LessonStructure` interface
```typescript
{
  name: string;                              // "Workshop Model", "Making & Construction", etc.
  phases: LessonPhaseTemplate[];             // ordered list of phases
  mainBlockFloorPercent: number;             // minimum % of usable time for main block(s)
  hasInstructionCap: boolean;                // does 1+age rule apply?
  relaxedInstructionCap?: boolean;           // 1.5× normal cap for demo-heavy lessons?
  requiresClosingReflection: boolean;        // must have final reflection phase?
  promptBlock: (params: StructurePromptParams) => string;  // prompt text generator
}
```

#### `StructurePromptParams`
```typescript
{
  usableMinutes: number;                     // calculated from periodMinutes - transitions
  instructionCap: number;                    // 1 + avgStudentAge
  minMainBlockMinutes: number;               // floor(usableMinutes × mainBlockFloorPercent)
  idealMainBlockMinutes: number;             // usableMinutes × 0.65 or similar
  profile: {
    mypYear: number;
    avgStudentAge: number;
    pacingNote: string;
  };
}
```

### Eight Lesson Structure Templates

| Type | Key Phases | Main Block Floor | Has Instruction Cap | Notes |
|------|-----------|------------------|-------------------|-------|
| **WORKSHOP_MODEL** (default) | Opening (5-10) → Mini-Lesson (5-15) → Work Time (15-60) → Debrief (5-10) | 45% | Yes | Non-negotiable 4-phase structure. Is the default fallback. |
| **RESEARCH_STRUCTURE** | Mini-Lesson (5-10) → Guided Investigation (10-20) → Independent Analysis (15-30) → Share Findings (5-10) | 35% | Yes | Analysis-focused. Scaffold questions provided. |
| **IDEATION_STRUCTURE** | Stimulus (3-7) → Divergent Thinking (15-25) → Convergent Thinking (10-15) → Select & Refine (5-10) | 35% | Yes | **CRITICAL: AI rules forbid evaluation during divergent phase.** "Push further!" not "Is this good?" |
| **SKILLS_DEMO_STRUCTURE** (I Do/We Do/You Do) | Safety & Demo (10-20) → Guided Practice (10-15) → Independent Practice (15-30) → Quick Reflection (3-7) | 30% | Yes | **RELAXED CAP:** 1.5× for demo phase. Safety brief mandatory. |
| **MAKING_STRUCTURE** | Safety Check (2-5) → Extended Making (25-50) → Clean-Up (5-8) → Quick Reflection (3-7) | 50% | NO | Making is ONE sustained block. No instruction cap — just safety check. |
| **TESTING_STRUCTURE** | Review & Predict (5-8) → Test & Gather Data (15-25) → Analyse & Record (10-15) → Plan Iteration (5-10) | 30% | Yes | Data collection is the work. Productive failure built in. |
| **CRITIQUE_STRUCTURE** | Criteria Reminder (3-7) → Gallery Walk/Peer Critique (15-25) → Self-Assessment (8-15) → Goal-Setting (5-8) | 30% | Yes | The critique IS the work. Uses TWO STARS & A WISH or TAG feedback. |
| **PRESENTATION_STRUCTURE** | Preparation (5-10) → Presentations (20-40) → Peer Feedback (5-10) → Reflection (5-8) | 40% | NO | Audience given active role (note-taking, feedback forms). |
| **ASSESSMENT_STRUCTURE** | Overview & Criteria (5-10) → Assessment Task (20-40) → Review & Self-Check (5-10) → Debrief (3-7) | 45% | Yes | Exam-like or portfolio conditions. No collaboration unless specified. |

### Key Resolution Functions

**`getLessonStructure(lessonType?: string): LessonStructure`**
- Maps `lessonType` string → structure template
- Returns `WORKSHOP_MODEL` as default if unrecognized or null
- NO FALLBACK CHAINING — uses Workshop Model if missing

**`getMainBlockFloor(unitType?: string, lessonType?: string): number`**
- **Unit-type base floors:** Design 45%, Service 30%, Personal Project 40%, Inquiry 35%
- **Lesson-type structure floors:** vary by template (see table above)
- **Resolution:** if `lessonType` is explicitly defined in `LESSON_STRUCTURES` map, use structure floor; otherwise use unit-type base floor
- **No merging:** doesn't take the higher of the two — uses whichever is explicitly set

**`getEffectiveInstructionCap(baseCap: number, lessonType?: string): number`**
- Base cap = 1 + avgStudentAge (normally 13-16 min)
- If structure has `relaxedInstructionCap: true`, return `Math.round(baseCap * 1.5)`
- Only SKILLS_DEMO_STRUCTURE has relaxed cap
- **Hardcoded multiplier:** 1.5× exactly

**`getStructurePhaseNames(lessonType?: string): string[]`**
- Returns array of phase names for structure
- Used by timing validation to check correct phases present
- No ordering assumption — array order matches structure definition

**`structureHasInstructionCap(lessonType?: string): boolean`**
- Returns `structure.hasInstructionCap`
- Used to decide whether 1+age rule applies
- MAKING_STRUCTURE and PRESENTATION_STRUCTURE return `false`

### Prompt Generation

Each template has a `promptBlock` function that:
1. Takes `StructurePromptParams` (usable minutes, caps, profiles)
2. Returns a markdown prompt block (200-400 words)
3. Is injected into AI generation prompts
4. Includes explicit phase names, time budgets, and pedagogical guidance

**Example: WORKSHOP_MODEL prompt block**
```
## LESSON STRUCTURE — WORKSHOP MODEL
Every lesson follows the 4-Phase Workshop Model.

### Phase 1: OPENING (5-10 min)
Hook, context, connect to prior learning. Set expectations for the session.

### Phase 2: MINI-LESSON (max ${instructionCap} min — the "1 + age" rule)
Teach ONE skill or concept. Demonstrate a technique. Short and focused.

### Phase 3: WORK TIME (minimum ${minMainBlockMinutes} min, ideally ${idealMainBlockMinutes}+ min)
THE MAIN EVENT. Students create, research, prototype, test, build.
[... continues with guidance ...]

### Phase 4: DEBRIEF (5-10 min — NON-NEGOTIABLE)
[... continues ...]
```

### AI Guidance Differences

Each structure injects specific AI guidance that's NOT hardcoded in activity-level AI rules:

| Type | AI Guidance |
|------|-------------|
| **IDEATION** | "Push further! What else? Wilder ideas!" during Divergent phase. NEVER evaluate. |
| **RESEARCH** | Use compare/contrast frameworks. "What patterns do you notice?" |
| **MAKING** | Teacher circulates: "Talk me through your process." Include check-in at mid-point for long sessions. |
| **TESTING** | Productive failure framing: "What does this evidence tell you?" |
| **CRITIQUE** | Model good feedback: "specific, evidence-based, actionable." |
| **SKILLS_DEMO** | Demo phase is CONTENT activity (no student response). Safety mandatory. |

---

## PART 2: GENERATE-UNIT ROUTE (Criterion-Based)

### Location
`src/app/api/teacher/generate-unit/route.ts` (261 lines)

### Request Contract

```typescript
POST /api/teacher/generate-unit
Content-Type: application/json

{
  wizardInput: UnitWizardInput;
  criterion: CriterionKey;                  // string, not "A"|"B"|"C"|"D" literal
  selectedOutline?: {
    approach: string;
    pages: Record<string, { title: string; summary: string }>
  } | null;
  stream?: boolean;  // default false
}
```

### UnitWizardInput Fields Used

- `unitType?: string` — defaults to "design" if missing
- `framework?: string` — defaults to "IB_MYP" if missing
- `gradeLevel: string` — passed to `getGradeTimingProfile()`
- All other fields passed to AI prompt builders

### System Prompt Resolution

```typescript
const unitType = wizardInput.unitType || "design";
const framework = wizardInput.framework || "IB_MYP";

const systemPrompt = unitType !== "design"
  ? buildUnitTypeSystemPrompt(unitType)  // Service/PP/Inquiry-specific
  : buildUnitSystemPrompt(framework);    // MYP/GCSE/A-Level/etc.
```

**Key hardcoding:** Design units use framework-specific prompts; all other types use `buildUnitTypeSystemPrompt()`.

### Criterion Validation (Non-Hardcoded)

```typescript
const validCriteria = getCriterionKeys(unitType);  // DYNAMIC per type
if (!validCriteria.includes(criterion)) {
  return error 400
}
```

**Resolution:** `getCriterionKeys()` returns different arrays per unit type:
- Design: `["A", "B", "C", "D"]`
- Service: `["I", "P", "A", "R", "D"]` (5 criteria)
- PP: `["A", "B", "C"]` (3 criteria)
- Inquiry: (custom set)

### Timing Context (HARDCODED)

```typescript
let periodMinutes = 60;  // FALLBACK
try {
  const { data: teacherProfile } = await supabase
    .from("teacher_profiles")
    .select("typical_period_minutes")
    .eq("teacher_id", user.id)
    .maybeSingle();
  if (teacherProfile?.typical_period_minutes) {
    periodMinutes = teacherProfile.typical_period_minutes;
  }
} catch (e) {
  // Silent fallback to 60
}

const gradeLevel = wizardInput.gradeLevel || "Year 3 (Grade 8)";
const profile = getGradeTimingProfile(gradeLevel, framework);
const timingCtx = buildTimingContext(profile, periodMinutes, false);
```

**Hardcoded defaults:**
- Period length: **60 minutes** if no teacher profile found
- Grade level: **"Year 3 (Grade 8)"** if missing
- `isWorkshop` param: **always `false`** (hardcoded)

### Generation Pipeline

```
1. Validate inputs (wizardInput + criterion)
2. Build RAG prompt via buildRAGCriterionPrompt()
   - criterion
   - wizardInput
   - user.id (for knowledge base lookup)
   - selectedOutline (optional unit outline)
   - framework
3. Resolve AI provider (teacher key → platform key fallback)
4. Call provider.generateCriterionPages(criterion, wizardInput, systemPrompt, userPrompt, unitType)
   - Returns: Record<string, PageContent>
5. Validate structural: validateGeneratedPages(rawPages)
6. Validate timing: validateLessonTiming() on each page
   - Runs on pages with workshopPhases
   - Auto-repairs: workshopPhases + extensions
7. Score with Lesson Pulse: computeLessonPulse(sections)
   - Runs on pages with sections array
8. Return { pages, warnings, criterion, ragChunkIds, timingValidation, pulseScores }
```

### Output Contract

```typescript
{
  pages: Record<string, PageContent>;       // AI-generated pages (v2 format)
  warnings: string[];                        // validation errors that were auto-fixed
  criterion: CriterionKey;                  // echo of input criterion
  ragChunkIds: string[];                    // knowledge base chunks used
  timingValidation?: Record<string, unknown>;  // timing repair summary
  pulseScores?: Record<string, LessonPulseScore>;  // per-page Pulse scores
}
```

### Streaming Path

If `stream: true`:
- Returns Server-Sent Events stream
- Each event: `{ type: "delta" | "complete" | "error", json: {partial} }`
- Final event: complete pages + validation + ragChunkIds

### Non-Streaming Path (Default)

- Awaits full `generateCriterionPages()` call
- Returns full JSON response (not chunked)

### Non-Critical Operations

These operations silently fail on error:
- Timing validation (wrapped in try/catch)
- Lesson Pulse scoring (wrapped in try/catch)
- Teacher profile lookup (non-critical)
- Teacher style signal: `onUnitCreated()` (non-fatal)

---

## PART 3: GENERATE-JOURNEY ROUTE (Batch Lessons)

### Location
`src/app/api/teacher/generate-journey/route.ts` (276 lines)

### Request Contract

```typescript
POST /api/teacher/generate-journey
Content-Type: application/json

{
  journeyInput: LessonJourneyInput;
  lessonIds: string[];                     // e.g. ["L01", "L02", "L03", "L04", "L05"]
  selectedOutline?: JourneyOutlineOption | null;
  previousLessonSummary?: string;          // context from earlier batch
  stream?: boolean;
  lessonTypeMap?: Record<string, string>;  // Maps lessonId → DesignLessonType
}
```

### New Field: `lessonTypeMap`

**Location in code:** Lines 62-73

```typescript
/** Maps lessonId → DesignLessonType for structure-aware timing validation */
lessonTypeMap?: Record<string, string>;
```

**Used at:** Line 234
```typescript
result = validateLessonTiming(lessonPage, timingProfile, timingCtx, lessonTypeMap[pageId]);
```

**Type mapping:** Maps lesson IDs to structure type names:
- "research", "ideation", "skills-demo", "making", "testing", "critique", "presentation", "assessment"
- Or undefined (defaults to Workshop Model)

**Key finding:** This is the FIRST generation route that accepts per-lesson type hints. The timing validation then calls `getLessonStructure(lessonType)` per page.

### System Prompt Resolution

```typescript
const unitType = journeyInput.unitType || "design";
const framework = journeyInput.curriculumFramework || "IB_MYP";

const systemPrompt = unitType !== "design"
  ? buildUnitTypeSystemPrompt(unitType)
  : JOURNEY_SYSTEM_PROMPT;  // HARDCODED
```

**Key difference from generate-unit:** Journey always uses `JOURNEY_SYSTEM_PROMPT` for design units (not framework-specific). Only non-design types get type-specific prompts.

### Timing Context (HARDCODED)

```typescript
let periodMinutes = 50;  // FALLBACK (not 60!)
try {
  const { data: profile } = await supabase
    .from("teacher_profiles")
    .select("typical_period_minutes")
    .eq("user_id", user.id)  // NOTE: user_id not teacher_id
    .single();  // THROWS if no row (not .maybeSingle())

  if (profile?.typical_period_minutes && !journeyInput.lessonLengthMinutes) {
    journeyInput.lessonLengthMinutes = profile.typical_period_minutes;
  }
} catch {
  // Silent fallback
}

if (!journeyInput.lessonLengthMinutes) journeyInput.lessonLengthMinutes = 50;
if (!journeyInput.lessonsPerWeek) journeyInput.lessonsPerWeek = 3;

const timingProfile = getGradeTimingProfile(journeyInput.gradeLevel);
const lessonMinutes = journeyInput.lessonLengthMinutes || 50;
const timingCtx: TimingContext = {
  periodMinutes: lessonMinutes,
  isWorkshop: false,
  transitionMinutes: 3,
  setupMinutes: 0,
  cleanupMinutes: 0,
  gradeProfile: timingProfile,
};
```

**Hardcoded defaults:**
- Period length: **50 minutes** (fallback, vs 60 in generate-unit)
- Lessons per week: **3** if missing
- Transition time: **3 minutes** (hardcoded in TimingContext)
- Setup/cleanup: **0 minutes** (hardcoded)

**BUG RISK:** Line 95 uses `.single()` on teacher_profiles query — will throw 406 if no row exists (should be `.maybeSingle()`).

### Per-Lesson Timing Validation

**Lines 230-243:**
```typescript
for (const [pageId, page] of Object.entries(validation.pages)) {
  const lessonPage = page as unknown as GeneratedLesson;
  if (lessonPage.workshopPhases) {
    const result = validateLessonTiming(
      lessonPage,
      timingProfile,
      timingCtx,
      lessonTypeMap[pageId]  // <-- per-lesson type hint
    );
    validation.pages[pageId] = result.repairedLesson as unknown as typeof page;
    timingResults[pageId] = {
      valid: result.valid,
      issueCount: result.issues.length,
      autoFixed: result.issues.filter(i => i.autoFixed).length,
    };
  }
}
```

**Key:** Each lesson can have its own type (research, ideation, making, etc.) and gets structure-aware validation.

### Lesson Pulse Scoring

Identical to generate-unit:
```typescript
for (const [pid, page] of Object.entries(validation.pages)) {
  if (page && typeof page === "object" && "sections" in page) {
    pulseScores[pid] = computeLessonPulse(sections as PulseActivity[]);
  }
}
```

---

## PART 4: GENERATE-TIMELINE ROUTE (Skeleton-Based Activities)

### Location
`src/app/api/teacher/generate-timeline/route.ts` (298 lines)

### Request Contract

```typescript
POST /api/teacher/generate-timeline
Content-Type: application/json

{
  journeyInput: LessonJourneyInput;
  selectedOutline?: TimelineOutlineOption | null;
  phaseToGenerate?: TimelinePhase;
  previousActivitiesSummary?: string;
  activitiesGeneratedSoFar?: number;
  estimatedActivityCount?: number;
  lessonSkeleton?: TimelineLessonSkeleton;    // NEW: per-lesson skeleton
  fullSkeleton?: TimelineSkeleton;            // NEW: full unit skeleton
  stream?: boolean;
}
```

### Two-Stage Architecture

**Stage 1: Skeleton-first** (Lines 137-145)
```typescript
if (lessonSkeleton && fullSkeleton) {
  // Stage 2: Per-lesson generation using skeleton context
  const result = await buildRAGPerLessonPrompt(
    journeyInput,
    lessonSkeleton,
    fullSkeleton,
    user.id,
    teachingContext
  );
  userPrompt = result.prompt;
  chunkIds = result.chunkIds;
}
```

**Stage 2: Legacy (Phase-based)** (Lines 149-161)
```typescript
else {
  // Legacy: phase-based generation
  const result = await buildRAGTimelinePrompt(
    journeyInput,
    user.id,
    selectedOutline,
    phaseToGenerate,
    previousActivitiesSummary,
    activitiesGeneratedSoFar,
    teachingContext
  );
  userPrompt = result.prompt;
  chunkIds = result.chunkIds;
}
```

**Key finding:** Two completely separate prompt builders. The skeleton path is preferred; legacy path is fallback.

### Activity Count Estimation (HARDCODED LOGIC)

**Lines 114-121:**
```typescript
const totalLessons = journeyInput.durationWeeks * journeyInput.lessonsPerWeek;
const estCount = estimatedActivityCount
  || (lessonSkeleton
    ? Math.max(3, Math.round(lessonSkeleton.estimatedMinutes / 10))  // 1 activity per 10 min
    : phaseToGenerate
      ? Math.round(phaseToGenerate.estimatedLessons * 5)  // 5 activities per lesson
      : totalLessons * 5);  // 5 activities per lesson in unit
```

**Hardcoded ratios:**
- **Skeleton-based:** 1 activity per 10 minutes of lesson time
- **Phase-based:** 5 activities per lesson
- **Unit-based:** 5 activities per lesson
- **Minimum:** 3 activities (hard floor)

### Timing Context (NOT SET FOR TIMELINE)

**Key finding:** `generate-timeline` does NOT set a TimingContext or call `validateLessonTiming()`.

**Reason:** Timeline activities are not workshopPhases-structured lessons. They're flat activity lists with no phase boundaries.

### Output Contract

```typescript
{
  activities: TimelineActivity[];            // flat list of activities
  warnings: string[];                        // validation errors
  ragChunkIds: string[];                    // knowledge base chunks used
  qualityReport?: {                         // non-blocking quality eval
    [key: string]: any;
  };
}
```

**No timingValidation or pulseScores in response** — those are only for lesson-based generation.

### Quality Evaluation (NON-BLOCKING)

**Lines 265-282:**
```typescript
let qualityReport = undefined;
try {
  const isPerLesson = !!(lessonSkeleton && fullSkeleton);
  qualityReport = await evaluateTimelineQuality(
    validation.activities,
    {
      topic: journeyInput.topic,
      gradeLevel: journeyInput.gradeLevel,
      endGoal: journeyInput.endGoal,
      lessonLengthMinutes: journeyInput.lessonLengthMinutes,
      totalLessons,
      lessonsInBatch: isPerLesson ? 1 : undefined,
    },
    creds.apiKey
  );
} catch {
  // Quality evaluation is enhancement — never block generation
}
```

**Timing:** Runs in parallel with response preparation (line 264 comment: "non-blocking"). Any error is silently swallowed.

---

## PART 5: ADMIN SKELETON TEST ROUTE

### Location
`src/app/api/admin/ai-model/test/route.ts` (163 lines)

### Purpose
Test skeleton generation with unsaved AI config (macro dials + timing presets).

### Request Contract

```typescript
POST /api/admin/ai-model/test
Content-Type: application/json

{
  config: AIModelConfig;          // unsaved config with macro dials + presets
  testInput: {
    topic: string;
    gradeLevel: string;
    endGoal: string;
    lessonCount?: number;         // number of lessons to test
    lessonLengthMinutes?: number; // period length
    curriculumFramework?: string; // defaults to "IB_MYP"
    assessmentCriteria?: string[]; // custom criteria array
  };
}
```

### Inputs Used

**Lines 60-78:**
```typescript
const input: LessonJourneyInput = {
  title: `Test: ${testInput.topic}`,
  gradeLevel: testInput.gradeLevel,
  endGoal: testInput.endGoal,
  durationWeeks: 1,                          // HARDCODED
  lessonsPerWeek: testInput.lessonCount || 4,  // default 4 if missing
  lessonLengthMinutes: testInput.lessonLengthMinutes || 50,
  topic: testInput.topic,
  globalContext: "Scientific and technical innovation",  // HARDCODED
  keyConcept: "Systems",                    // HARDCODED
  relatedConcepts: ["Function", "Form"],    // HARDCODED
  statementOfInquiry: `Exploring how ${testInput.topic} can be designed to meet user needs.`,  // HARDCODED template
  atlSkills: ["Thinking", "Communication"], // HARDCODED
  specificSkills: [],                       // HARDCODED empty
  resourceUrls: [],                         // HARDCODED empty
  specialRequirements: "",                  // HARDCODED empty
  assessmentCriteria: criteria,
  curriculumFramework: framework,
};
```

**Hardcoded defaults:**
- Duration: **1 week** (always)
- Global context: **"Scientific and technical innovation"**
- Key concept: **"Systems"**
- Related concepts: **["Function", "Form"]**
- ATL skills: **["Thinking", "Communication"]**
- Specific skills: **empty array**
- Resource URLs: **empty array**
- Special requirements: **empty string**

### Outline Generation (HARDCODED)

**Lines 81-94:**
```typescript
const outline: TimelineOutlineOption = {
  approach: "Balanced Design Process",
  description: `A balanced approach to ${testInput.topic} covering research, ideation, making, and evaluation.`,
  strengths: ["Covers full design cycle", "Age-appropriate pacing"],
  estimatedActivityCount: (testInput.lessonCount || 4) * 4,  // 4 activities per lesson
  phases: [{
    phaseId: "phase-1",
    title: "Full Unit",
    summary: `Complete ${testInput.topic} design unit`,
    estimatedLessons: testInput.lessonCount || 4,
    primaryFocus: "Design process",
    criterionTags: criteria,
  }],
};
```

**Hardcoded:**
- Approach: **"Balanced Design Process"**
- Strengths: **["Covers full design cycle", "Age-appropriate pacing"]**
- Activity count: **4 per lesson** (always)
- Phase ID: **"phase-1"** (single phase)
- Primary focus: **"Design process"**

### Model and Thinking (HARDCODED)

**Line 114:**
```typescript
model: "claude-sonnet-4-20250514"  // HARDCODED
```

**Lines 116-119:**
```typescript
thinking: {
  type: "enabled",
  budget_tokens: 8000,  // HARDCODED
}
```

**Line 115:**
```typescript
max_tokens: 16000  // HARDCODED
```

**Key finding:** Admin test always uses Sonnet 4 with thinking enabled. Config system only affects emphasis dials and timing profiles, NOT the model selection.

### Timing Context Application

**Lines 97-98:**
```typescript
const timingProfile = getGradeTimingProfile(testInput.gradeLevel, "IB_MYP", resolvedConfig.timingProfiles);
const timingBlock = buildTimingBlock(timingProfile, testInput.lessonLengthMinutes || 50);
```

**Key:** `resolvedConfig.timingProfiles` is passed to `getGradeTimingProfile()` — allows config to override timing profiles.

**Line 120:**
```typescript
system: SKELETON_SYSTEM_PROMPT + "\n\n" + timingBlock
```

Timing block is injected into system prompt.

### Output Contract

```typescript
{
  skeleton: any;                  // parsed JSON skeleton or raw string
  thinking: string | null;        // extended thinking content
  elapsed: number;                // ms elapsed
  tokensUsed: {                   // usage stats from Claude
    input_tokens: number;
    output_tokens: number;
  };
  configApplied: {
    timingProfile: any;
    generationEmphasis: any;
  };
}
```

---

## PART 6: DATA SHAPES

### Page Content (v2 Format)

Used by generate-unit and generate-journey:

```typescript
{
  id: string;                    // page ID
  title: string;
  learningGoal?: string;
  sections: ActivitySection[];
  workshopPhases?: WorkshopPhases;  // optional, added by timing validation
  extensions?: LessonExtension[];   // optional, added by timing validation
}
```

### WorkshopPhases Shape

```typescript
{
  opening: {
    title: string;
    duration: number;           // minutes
    activities?: string[];
  };
  miniLesson: {
    title: string;
    duration: number;
    activities?: string[];
  };
  workTime: {
    title: string;
    duration: number;
    activities?: string[];
  };
  debrief: {
    title: string;
    duration: number;
    activities?: string[];
  };
}
```

### LessonExtension Shape

```typescript
{
  title: string;
  description: string;
  duration: number;              // minutes
  designPhase?: string;          // "ideation", "making", "testing", etc.
}
```

### ActivitySection Shape

```typescript
{
  activityId?: string;           // stable ID (set by backfill script)
  title?: string;
  description?: string;
  responseType?: string;         // "text", "upload", "decision-matrix", etc.
  bloomLevel?: CognitiveLevel;   // "remember" | "understand" | ... | "create"
  timeWeight?: TimeWeight;       // "quick" | "moderate" | "extended" | "flexible"
  ai_rules?: {
    phase?: string;              // "divergent" | "convergent" | "neutral"
    tone?: string;
    rules?: string[];
    forbidden_words?: string[];
  };
  udl_checkpoints?: string[];   // CAST 3×3 reference IDs
  grouping?: string;             // "solo" | "pair" | "small-group" | "whole-class"
  materials?: string[];
  [key: string]: any;
}
```

### Timeline Activity Shape

Used by generate-timeline:

```typescript
{
  activityId: string;
  lessonNumber?: number;
  phase?: string;                // "discover" | "define" | "ideate" | "prototype" | "test"
  title: string;
  description: string;
  duration?: number;             // minutes
  grouping?: string;
  responseType?: string;
  bloomLevel?: string;
  materials?: string[];
  notes?: string;
  criteria?: string[];
  [key: string]: any;
}
```

### LessonPulseScore Shape

```typescript
{
  overall: number;               // 0-10 composite
  cognitive_rigour: number;      // 40% bloom + 25% thinking + 20% inquiry + 15% assessment
  student_agency: number;        // 50% agency + 30% collaboration + 20% peer assessment
  teacher_craft: number;         // 20% grouping + 25% UDL + 20% scaffolding + 20% diff + 15% AI rules
  issue_count: number;           // issues found
  repairedCount: number;         // issues auto-fixed
  recommendations?: string[];
}
```

---

## PART 7: TIMING ARCHITECTURE FLOWS

### Build Flow

```
1. wizardInput + gradeLevel
2. getGradeTimingProfile(gradeLevel, framework?)
   → GradeProfile { mypYear, avgStudentAge, maxHighCognitiveMinutes, pacingNote }
3. buildTimingContext(profile, periodMinutes, isWorkshop)
   → TimingContext { periodMinutes, usableMinutes, instructionCap, ... }
4. buildTimingBlock(profile, periodMinutes)
   → prompt block text (injected into AI prompt)
```

### Validation Flow (generate-journey, generate-unit)

```
1. AI generates pages with workshopPhases
2. For each page:
   a. validateLessonTiming(page, profile, timingCtx, lessonType?)
   b. getLessonStructure(lessonType) → gets phase templates + rules
   c. Check 8 rules (phases present, instruction cap, work time floor, etc.)
   d. Auto-repair: fix missing/incorrect phases + extensions
   e. Return repairedLesson
3. Update pages with repaired workshopPhases + extensions
```

### No Validation in generate-timeline

Timeline activities are NOT validated for timing:
- No workshopPhases in activity JSON
- No per-activity timing requirements
- Activity count estimated via hardcoded ratios (1 per 10 min)

---

## PART 8: HARDCODED VALUES SUMMARY

### Period Lengths (Fallback)
| Route | Hardcoded Default | Lookup Field |
|-------|------------------|--------------|
| generate-unit | 60 min | teacher_profiles.typical_period_minutes |
| generate-journey | 50 min | teacher_profiles.typical_period_minutes |
| generate-timeline | 50 min | journeyInput.lessonLengthMinutes |
| admin/test | 50 min | testInput.lessonLengthMinutes |

### Grade Levels (Fallback)
| Route | Hardcoded Default |
|-------|------------------|
| generate-unit | "Year 3 (Grade 8)" |
| generate-journey | (none, required) |
| admin/test | (none, required) |

### System Prompts
| Route | Design Units | Other Types |
|-------|-------------|-------------|
| generate-unit | buildUnitSystemPrompt(framework) | buildUnitTypeSystemPrompt(unitType) |
| generate-journey | JOURNEY_SYSTEM_PROMPT | buildUnitTypeSystemPrompt(unitType) |
| generate-timeline | TIMELINE_SYSTEM_PROMPT | (not set, always timeline) |
| admin/test | SKELETON_SYSTEM_PROMPT | (always, design-only) |

### Lesson Structure Main Block Floors
| Unit Type | Design | Service | Personal Project | Inquiry |
|-----------|--------|---------|------------------|---------|
| Base floor | 45% | 30% | 40% | 35% |
| Workshop (default) | 45% | 45% | 45% | 45% |
| Research | N/A | 35% | 35% | 35% |
| Ideation | 35% | 35% | 35% | 35% |
| Making | 50% | 50% | 50% | 50% |
| Testing | 30% | 30% | 30% | 30% |
| Critique | 30% | 30% | 30% | 30% |

### Activity Count Estimation (generate-timeline)
| Input | Formula |
|-------|---------|
| lessonSkeleton provided | `max(3, round(skeleton.estimatedMinutes / 10))` |
| phaseToGenerate provided | `round(phase.estimatedLessons * 5)` |
| unit-wide | `(durationWeeks × lessonsPerWeek) × 5` |

### Instruction Cap Rules
| Lesson Type | Cap Formula |
|-------------|------------|
| Workshop, Research, Ideation, Skills-Demo, Testing, Assessment | `1 + avgStudentAge` |
| Skills-Demo (relaxed) | `1.5 × (1 + avgStudentAge)` |
| Making, Presentation | No cap (N/A) |

### Hardcoded Admin Test Values
| Field | Value |
|-------|-------|
| Duration | 1 week |
| Global context | "Scientific and technical innovation" |
| Key concept | "Systems" |
| Related concepts | ["Function", "Form"] |
| ATL skills | ["Thinking", "Communication"] |
| Approach | "Balanced Design Process" |
| Model | claude-sonnet-4-20250514 |
| Max tokens | 16000 |
| Thinking budget | 8000 tokens |
| Activities per lesson | 4 |

---

## PART 9: MISSING/ABSENT FEATURES

### NOT Wired

1. **Lesson type map in generate-unit** — accepts criterion only, no per-lesson type hints
2. **Timing validation in generate-timeline** — activities not validated for Workshop Model
3. **Pulse scoring in generate-timeline** — activities have no sections array
4. **Framework-specific system prompts in generate-journey** — Design always uses JOURNEY_SYSTEM_PROMPT
5. **Lesson type detection/auto-assignment** — never inferred from content, must be user-provided

### NOT Stored

1. **LessonPhaseTemplate descriptions** — used only in prompts, not persisted to database
2. **Activity bloom_level** — generated by AI but not currently used by timing validation
3. **Lesson pulse scores** — returned in response but not persisted to database
4. **Timing validation issues** — summarized in response but not logged to database

### Silent Failures

These operations fail silently:
1. Teacher profile lookup (`non-critical`)
2. Timing validation (`wrapped in try/catch`)
3. Lesson Pulse scoring (`wrapped in try/catch`)
4. Quality evaluation in generate-timeline (`wrapped in try/catch`)
5. Teacher style signal: `onUnitCreated()` (`non-fatal`)

---

## PART 10: KEY FINDINGS & RISKS

### Finding 1: Lesson Type System Is Asymmetric

| Route | Accepts Lesson Type | Uses for Validation | Uses for Prompts |
|-------|------------------|-------------------|-----------------|
| generate-unit | NO | NO | NO |
| generate-journey | YES (lessonTypeMap) | YES (timing validation) | NO |
| generate-timeline | NO | NO | NO |
| admin/test | NO | NO | NO |

**Risk:** generate-unit has no way to request specific lesson structures (research, making, testing, etc.). Every criterion-based lesson defaults to Workshop Model.

### Finding 2: System Prompts Don't Track Lesson Type

Workshop Model structure is hardcoded into prompts via `buildTimingBlock()`, but there's no mechanism to inject a different phase structure (research phases, making phases, etc.) into the AI prompt for generate-unit.

**The lesson type system exists to VALIDATE post-generation, not to GUIDE generation.**

### Finding 3: Framework Cascades Inconsistently

| Route | Design | Non-Design |
|-------|--------|-----------|
| generate-unit | Framework-aware (buildUnitSystemPrompt) | Type-aware (buildUnitTypeSystemPrompt) |
| generate-journey | Framework-ignored (JOURNEY_SYSTEM_PROMPT) | Type-aware (buildUnitTypeSystemPrompt) |
| generate-timeline | Framework-ignored (TIMELINE_SYSTEM_PROMPT) | N/A (timeline-only) |

**Risk:** Journey mode doesn't use framework-specific prompts even for Design units. A GCSE unit uses the same prompt as IB MYP.

### Finding 4: Timing Context Is Set Once Per Batch

In generate-journey, a single `timingCtx` is created for all lessons in the batch:

```typescript
const timingCtx: TimingContext = {
  periodMinutes: lessonMinutes,
  isWorkshop: false,  // HARDCODED false
  transitionMinutes: 3,  // HARDCODED
  setupMinutes: 0,      // HARDCODED
  cleanupMinutes: 0,    // HARDCODED
  gradeProfile: timingProfile,
};
```

**Risk:** If `isWorkshop` should vary per lesson (some lessons are workshop, some are open studio), it's not possible — it's hardcoded to `false` for the entire batch.

### Finding 5: Admin Test Model Is Hardcoded

The admin skeleton test ALWAYS uses:
- Model: claude-sonnet-4-20250514
- Max tokens: 16000
- Thinking budget: 8000

**Risk:** The config system (macro dials, timing profiles) can modify behavior, but NOT the model choice. If an admin wants to test with a different model, they can't.

### Finding 6: Activity Count Estimation Is Loose

Timeline activity count is estimated via hardcoded ratios, never validated:
- Skeleton: 1 per 10 min
- Phase: 5 per lesson
- Unit: 5 per lesson

For a 50-minute lesson with a skeleton, the AI is told to generate ~5 activities (50 ÷ 10). But there's no check if the AI actually generates 5 — it could generate 2 or 20.

### Finding 7: No Lesson Type Inference

The system never infers lesson type from content (title, activities, focus). It always requires explicit user input via `lessonTypeMap`.

**Risk:** If a lesson is clearly a "making lesson" (focus on hands-on, extended building time), the system won't detect that. It needs the user to tell it.

### Finding 8: Timing Validation Doesn't Check All Activities

Timing validation only runs on pages with `workshopPhases`:

```typescript
if (lessonPage.workshopPhases) {
  // validate
}
```

If AI generates a page WITHOUT workshopPhases, it's never validated for timing — even if it contains activities that should be structured.

---

## CONCLUSION

The unit generation pipeline has three distinct paths:

1. **Criterion-based (generate-unit)** — parallel A/B/C/D generation with Framework awareness
2. **Journey-based (generate-journey)** — batch lesson generation with per-lesson timing validation
3. **Timeline-based (generate-timeline)** — activity lists without timing constraints

The lesson structure system is well-designed for VALIDATION (8 templates, flexible phase definitions, per-lesson type hints in journey mode), but it's **not integrated into the GENERATION prompts** except via the hardcoded Workshop Model.

The missing link: a mechanism to tell the AI "generate this lesson using the Research structure" or "generate this lesson using the Making structure" — rather than validating post-generation.

