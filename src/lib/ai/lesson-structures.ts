/**
 * Lesson Structure Templates
 *
 * Different lesson types need different phase structures. The Workshop Model
 * (Opening → Mini-Lesson → Work Time → Debrief) is the default for generic
 * design lessons, but specialized lesson types get their own validated structures.
 *
 * Each structure defines:
 * - Named phases with time allocation rules
 * - Which phase is the "main block" (equivalent to Work Time)
 * - Instruction cap rules (some types allow more demo time)
 * - Minimum durations per phase
 * - Validation overrides (e.g., critique lessons don't need 45% "work time"
 *   because the critique IS the work)
 *
 * The Workshop Model remains the default fallback. Lesson Pulse scoring is
 * unaffected — it measures activity-level qualities (bloom, agency, grouping),
 * not structural concerns.
 */

import type { DesignLessonType } from "@/types";

// =========================================================================
// Types
// =========================================================================

export interface LessonPhaseTemplate {
  /** Human-readable phase name */
  name: string;
  /** Suggested duration range [min, max] in minutes */
  durationRange: [number, number];
  /** Is this the "main block" where most student work happens? */
  isMainBlock?: boolean;
  /** Does this phase count as "instruction" for cap purposes? */
  isInstruction?: boolean;
  /** Optional description injected into the prompt */
  description: string;
}

export interface LessonStructure {
  /** Human-readable structure name */
  name: string;
  /** Ordered list of phases */
  phases: LessonPhaseTemplate[];
  /** Minimum % of usable time for the main block(s) combined */
  mainBlockFloorPercent: number;
  /** Whether the instruction cap (1+age) applies */
  hasInstructionCap: boolean;
  /** If true, the instruction cap is relaxed (1.5× normal) for demo-heavy lessons */
  relaxedInstructionCap?: boolean;
  /** Override: require a closing reflection phase? */
  requiresClosingReflection: boolean;
  /** Prompt text describing the structure for the AI */
  promptBlock: (params: StructurePromptParams) => string;
}

export interface StructurePromptParams {
  usableMinutes: number;
  instructionCap: number;
  minMainBlockMinutes: number;
  idealMainBlockMinutes: number;
  profile: { mypYear: number; avgStudentAge: number; pacingNote: string };
}

// =========================================================================
// Structure Definitions
// =========================================================================

const WORKSHOP_MODEL: LessonStructure = {
  name: "Workshop Model",
  phases: [
    { name: "Opening", durationRange: [5, 10], description: "Hook, context, connect to prior learning. Activate curiosity." },
    { name: "Mini-Lesson", durationRange: [5, 15], isInstruction: true, description: "Teach ONE skill or concept. Short and focused." },
    { name: "Work Time", durationRange: [15, 60], isMainBlock: true, description: "THE MAIN EVENT. Students create, research, prototype, test, build. ONE sustained block." },
    { name: "Debrief", durationRange: [5, 10], description: "Structured reflection using a protocol. Non-negotiable." },
  ],
  mainBlockFloorPercent: 0.45,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, instructionCap, minMainBlockMinutes, idealMainBlockMinutes, profile }) => `
## LESSON STRUCTURE — WORKSHOP MODEL
Every lesson follows the 4-Phase Workshop Model.

### Phase 1: OPENING (5-10 min)
Hook, context, connect to prior learning. Set expectations for the session.
Activate curiosity — a compelling question, image, or problem.

### Phase 2: MINI-LESSON (max ${instructionCap} min — the "1 + age" rule)
Teach ONE skill or concept. Demonstrate a technique. Short and focused.
Maximum ${instructionCap} minutes of direct instruction (1 + avg student age of ${profile.avgStudentAge}).
After ${instructionCap} minutes, student attention drops sharply. Stop teaching and start working.

### Phase 3: WORK TIME (minimum ${minMainBlockMinutes} min, ideally ${idealMainBlockMinutes}+ min — at least 45% of usable time)
THE MAIN EVENT. Students create, research, prototype, test, build.
This is ONE sustained block — do NOT fragment it into multiple small activities.
Teacher circulates: 1-on-1 conferences, formative assessment, just-in-time teaching.
${usableMinutes >= 80 ? `For this long period, include a check-in at ~${Math.round(idealMainBlockMinutes * 0.5)} min.` : ""}

### Phase 4: DEBRIEF (5-10 min — NON-NEGOTIABLE, never skip)
Structured reflection using a protocol (quick-share, I Like/I Wish, exit ticket, two stars & a wish).

Time budget: Opening (5-10) + Mini-Lesson (max ${instructionCap}) + Work Time (${minMainBlockMinutes}-${idealMainBlockMinutes}+) + Debrief (5-10) = ${usableMinutes} min`,
};

const RESEARCH_STRUCTURE: LessonStructure = {
  name: "Research & Investigation",
  phases: [
    { name: "Mini-Lesson", durationRange: [5, 10], isInstruction: true, description: "Model the analysis technique students will use." },
    { name: "Guided Investigation", durationRange: [10, 20], description: "Structured research with scaffolded questions. Teacher circulates." },
    { name: "Independent Analysis", durationRange: [15, 30], isMainBlock: true, description: "Students apply techniques independently. Compare/contrast frameworks." },
    { name: "Share Findings", durationRange: [5, 10], description: "Students share discoveries. Teacher synthesises patterns." },
  ],
  mainBlockFloorPercent: 0.35,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, instructionCap, minMainBlockMinutes, profile }) => `
## LESSON STRUCTURE — RESEARCH & INVESTIGATION
This is a research lesson. Students investigate, analyse, and share findings.

### Phase 1: MINI-LESSON (5-10 min, max ${instructionCap} min)
Model the analysis technique before students try it. Show HOW to research, not WHAT to find.
Use a worked example — demonstrate the compare/contrast framework or investigation method.

### Phase 2: GUIDED INVESTIGATION (10-20 min)
Structured research with scaffolded questions. Teacher circulates actively.
Include a content activity that models analysis technique before independent work.
Questions to drive investigation: "What patterns do you notice?", "How does this relate to your user's needs?"

### Phase 3: INDEPENDENT ANALYSIS (minimum ${minMainBlockMinutes} min — at least 35% of usable time)
Students apply the technique independently using compare/contrast or structured investigation frameworks.
Use responseType "decision-matrix" or "pmi" for product/solution analysis where appropriate.
This is sustained analytical work — do NOT fragment into micro-tasks.

### Phase 4: SHARE FINDINGS (5-10 min)
Students share discoveries. Teacher synthesises: "I noticed several groups found..."
Bridge to next lesson: "This tells us... which means next lesson we'll..."

Time budget: Mini-Lesson (5-10) + Guided (10-20) + Independent (${minMainBlockMinutes}+) + Share (5-10) = ${usableMinutes} min`,
};

const IDEATION_STRUCTURE: LessonStructure = {
  name: "Ideation & Creative Thinking",
  phases: [
    { name: "Stimulus", durationRange: [3, 7], description: "Visual stimulus, constraint introduction, or provocation. NOT a lecture." },
    { name: "Divergent Thinking", durationRange: [15, 25], isMainBlock: true, description: "Individual or small group ideation. Quantity over quality." },
    { name: "Convergent Thinking", durationRange: [10, 15], description: "Group discussion, selection, refinement of strongest ideas." },
    { name: "Select & Refine", durationRange: [5, 10], description: "Commit to direction. Brief reflection on choices made." },
  ],
  mainBlockFloorPercent: 0.35,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, minMainBlockMinutes }) => `
## LESSON STRUCTURE — IDEATION & CREATIVE THINKING
This is an ideation lesson. DIVERGENT thinking is the priority — quantity over quality, no evaluation yet.

### Phase 1: STIMULUS (3-7 min)
Visual stimulus, constraint introduction, or provocation. Start with an image, object, or question — NOT a lecture.
The stimulus should spark curiosity and set the creative direction without over-prescribing.

### Phase 2: DIVERGENT THINKING (minimum ${minMainBlockMinutes} min — at least 35% of usable time)
Individual or small-group ideation. This is ONE sustained creative block.
Activities: sketching, SCAMPER, mind mapping, brainstorming, rapid prototyping.
KEEP THESE AS LONG ACTIVITIES — do NOT fragment creative flow into micro-tasks.
AI feedback during this phase must be DIVERGENT: "What else? Push further! What's the wildest version?"
NEVER critique or evaluate ideas during this phase — it kills creative flow.

### Phase 3: CONVERGENT THINKING (10-15 min)
Group discussion to identify strongest ideas. Dot voting, gallery walk, or structured selection.
Now evaluation language is appropriate: "Which ideas best meet the user's needs?"

### Phase 4: SELECT & REFINE (5-10 min)
Commit to a direction. Brief written reflection: "I chose this because..." + "My next step is..."
Bridge to next lesson.

Time budget: Stimulus (3-7) + Divergent (${minMainBlockMinutes}+) + Convergent (10-15) + Select (5-10) = ${usableMinutes} min`,
};

const SKILLS_DEMO_STRUCTURE: LessonStructure = {
  name: "Skills Demonstration (I Do / We Do / You Do)",
  phases: [
    { name: "Safety & Demo (I Do)", durationRange: [10, 20], isInstruction: true, description: "Safety briefing + teacher demonstration. Students watch." },
    { name: "Guided Practice (We Do)", durationRange: [10, 15], description: "Scaffolded practice with checkpoints. Teacher and students together." },
    { name: "Independent Practice (You Do)", durationRange: [15, 30], isMainBlock: true, description: "Students practice independently with clear success criteria." },
    { name: "Quick Reflection", durationRange: [3, 7], description: "Brief self-check against success criteria." },
  ],
  mainBlockFloorPercent: 0.30,
  hasInstructionCap: true,
  relaxedInstructionCap: true, // Demo phase can be longer than 1+age
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, instructionCap, minMainBlockMinutes }) => `
## LESSON STRUCTURE — SKILLS DEMONSTRATION (Gradual Release)
This is a skills-demo lesson. Uses the I Do → We Do → You Do gradual release of responsibility.

### Phase 1: SAFETY & DEMO — I Do (10-20 min, relaxed cap: ${Math.round(instructionCap * 1.5)} min)
Safety briefing (NON-NEGOTIABLE for workshop/tools lessons) + teacher demonstration.
The demo phase is a CONTENT activity (no student response) with safety warnings.
Students watch and ask questions. Keep it focused — demonstrate the KEY technique, not everything.
NOTE: The instruction cap is relaxed for this lesson type because the demo is essential.

### Phase 2: GUIDED PRACTICE — We Do (10-15 min)
Students practice WITH teacher guidance. Scaffolded checkpoints.
Teacher circulates actively: "Show me your technique before continuing."
Include explicit checkpoints: "Before moving on, check: is your [X] correct?"

### Phase 3: INDEPENDENT PRACTICE — You Do (minimum ${minMainBlockMinutes} min — at least 30% of usable time)
Students practice independently with clear success criteria.
Teacher circulates for formative assessment: "What should you check before the next step?"
This is sustained practice — do NOT fragment.

### Phase 4: QUICK REFLECTION (3-7 min)
Brief self-check: "Rate your confidence with this technique 1-5" + "What safety precaution is most important?"

Time budget: Demo (10-20) + Guided (10-15) + Independent (${minMainBlockMinutes}+) + Reflect (3-7) = ${usableMinutes} min`,
};

const MAKING_STRUCTURE: LessonStructure = {
  name: "Making & Construction",
  phases: [
    { name: "Safety Check", durationRange: [2, 5], description: "Brief safety check. NON-NEGOTIABLE." },
    { name: "Extended Making", durationRange: [25, 50], isMainBlock: true, description: "ONE long making block with teacher circulation." },
    { name: "Clean-Up", durationRange: [5, 8], description: "Structured clean-up with accountability." },
    { name: "Quick Reflection", durationRange: [3, 7], description: "Brief verbal or written reflection on process." },
  ],
  mainBlockFloorPercent: 0.50,
  hasInstructionCap: false, // No instruction phase — just safety check
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, minMainBlockMinutes }) => `
## LESSON STRUCTURE — MAKING & CONSTRUCTION
This is a making lesson. Students spend most of the time building/creating/constructing.

### Phase 1: SAFETY CHECK (2-5 min — NON-NEGOTIABLE)
Brief safety check for tools, materials, workspace. Students confirm they remember safety procedures.
If using new tools: quick demo of safe handling (max 3 min).

### Phase 2: EXTENDED MAKING (minimum ${minMainBlockMinutes} min — at least 50% of usable time)
ONE long sustained making block. Do NOT fragment into multiple short activities.
Teacher circulates giving verbal feedback (include teacherNotes for what to look for).
Questions while circulating: "Talk me through your process", "What's your next step and why?", "How does this compare to your plan?"
${usableMinutes >= 60 ? `Include a check-in at ~${Math.round(minMainBlockMinutes * 0.5)} min: "Where are you up to? What's blocking you?"` : ""}

### Phase 3: CLEAN-UP (5-8 min)
Structured clean-up with accountability. Students are responsible for their workspace.
This is a REAL phase — budget time for it. Tools away, materials stored, workspace clean.

### Phase 4: QUICK REFLECTION (3-7 min)
Brief reflection: "What worked today? What will you do differently next time?"
Keep it short — students are physically tired after making.

Time budget: Safety (2-5) + Making (${minMainBlockMinutes}+) + Clean-Up (5-8) + Reflect (3-7) = ${usableMinutes} min`,
};

const TESTING_STRUCTURE: LessonStructure = {
  name: "Testing & Iteration",
  phases: [
    { name: "Review & Predict", durationRange: [5, 8], description: "Review design intent/hypothesis. Students predict outcomes." },
    { name: "Test & Gather Data", durationRange: [15, 25], isMainBlock: true, description: "Run tests, gather data using structured recording." },
    { name: "Analyse & Record", durationRange: [10, 15], description: "Record results. Analyse what the data means for the design." },
    { name: "Plan Iteration", durationRange: [5, 10], description: "Based on evidence, plan what to change. Bridge to next lesson." },
  ],
  mainBlockFloorPercent: 0.30,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, minMainBlockMinutes }) => `
## LESSON STRUCTURE — TESTING & ITERATION
This is a testing lesson. Follows the predict → test → reflect cycle with productive failure built in.

### Phase 1: REVIEW & PREDICT (5-8 min)
Review the design intent or hypothesis. Students write predictions BEFORE testing.
"What do you expect to happen? Why?" — this makes the test meaningful, not random.

### Phase 2: TEST & GATHER DATA (minimum ${minMainBlockMinutes} min — at least 30% of usable time)
Run tests and gather data. Include a structured recording template (table, checklist, or rubric).
Students should test against specific criteria, not just "see if it works."
Questions: "What did you expect to happen?", "What does this result tell you about your design?"

### Phase 3: ANALYSE & RECORD (10-15 min)
Record results formally. Analyse what the data means for the design.
"What patterns do you see?", "Which test results surprised you?", "What does this evidence suggest?"

### Phase 4: PLAN ITERATION (5-10 min)
Based on evidence, plan what to change for the next iteration.
"What would you change? What evidence supports that change?"
Bridge to next lesson: "Next class, you'll implement these changes."

Time budget: Review (5-8) + Test (${minMainBlockMinutes}+) + Analyse (10-15) + Plan (5-10) = ${usableMinutes} min`,
};

const CRITIQUE_STRUCTURE: LessonStructure = {
  name: "Critique & Peer Review",
  phases: [
    { name: "Criteria Reminder", durationRange: [3, 7], description: "Review assessment criteria. Set expectations for quality feedback." },
    { name: "Gallery Walk / Peer Critique", durationRange: [15, 25], isMainBlock: true, description: "Structured critique using a protocol. The critique IS the work." },
    { name: "Self-Assessment", durationRange: [8, 15], description: "Students assess their own work against criteria using peer feedback." },
    { name: "Goal-Setting", durationRange: [5, 8], description: "Set specific, evidence-based goals for next iteration." },
  ],
  mainBlockFloorPercent: 0.30,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, minMainBlockMinutes }) => `
## LESSON STRUCTURE — CRITIQUE & PEER REVIEW
This is a critique lesson. The critique IS the main work — students learn from giving and receiving structured feedback.

### Phase 1: CRITERIA REMINDER (3-7 min)
Review assessment criteria. Model what good feedback looks like (specific, evidence-based, actionable).
"Today we're focusing on Criterion [X]. Good feedback sounds like: 'I notice... because... Have you considered...'"

### Phase 2: GALLERY WALK / PEER CRITIQUE (minimum ${minMainBlockMinutes} min — at least 30% of usable time)
Use a structured critique protocol (Two Stars & a Wish, TAG feedback, Warm/Cool feedback).
The critique IS the work — do NOT treat this as a "break" from real learning.
Questions: "What specific evidence supports that feedback?", "How will you use this feedback?"

### Phase 3: SELF-ASSESSMENT (8-15 min)
Students assess their OWN work against criteria, incorporating peer feedback.
Use a structured self-assessment rubric or reflective framework.
"Based on the feedback you received, where are you strongest? Where do you need to improve?"

### Phase 4: GOAL-SETTING (5-8 min)
Set specific, evidence-based goals for the next iteration.
"My top priority for next class is... because the feedback showed..."
Bridge to next lesson.

Time budget: Criteria (3-7) + Critique (${minMainBlockMinutes}+) + Self-Assessment (8-15) + Goals (5-8) = ${usableMinutes} min`,
};

// =========================================================================
// Presentation & Assessment (additional types for completeness)
// =========================================================================

const PRESENTATION_STRUCTURE: LessonStructure = {
  name: "Presentation & Sharing",
  phases: [
    { name: "Preparation", durationRange: [5, 10], description: "Final rehearsal and setup." },
    { name: "Presentations", durationRange: [20, 40], isMainBlock: true, description: "Student presentations with structured audience engagement." },
    { name: "Peer Feedback", durationRange: [5, 10], description: "Structured written feedback from audience." },
    { name: "Reflection", durationRange: [5, 8], description: "Self-reflection on presentation and feedback received." },
  ],
  mainBlockFloorPercent: 0.40,
  hasInstructionCap: false,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, minMainBlockMinutes }) => `
## LESSON STRUCTURE — PRESENTATION & SHARING
Students present their work and give/receive structured feedback.

### Phase 1: PREPARATION (5-10 min)
Final rehearsal time. Students check their presentation materials and practice key points.

### Phase 2: PRESENTATIONS (minimum ${minMainBlockMinutes} min — at least 40% of usable time)
Student presentations. Structure the audience role: note-taking sheets, feedback forms, questions.
Do NOT let the audience be passive — give them a job.

### Phase 3: PEER FEEDBACK (5-10 min)
Written structured feedback (Two Stars & a Wish, PMI, or criteria-based).

### Phase 4: REFLECTION (5-8 min)
"What went well in your presentation? What would you change? What feedback surprised you?"

Time budget: Prep (5-10) + Presentations (${minMainBlockMinutes}+) + Feedback (5-10) + Reflect (5-8) = ${usableMinutes} min`,
};

const ASSESSMENT_STRUCTURE: LessonStructure = {
  name: "Assessment & Evaluation",
  phases: [
    { name: "Overview & Criteria", durationRange: [5, 10], isInstruction: true, description: "Review criteria and expectations. Clarify assessment format." },
    { name: "Assessment Task", durationRange: [20, 40], isMainBlock: true, description: "Sustained assessment work under exam-like or portfolio conditions." },
    { name: "Review & Self-Check", durationRange: [5, 10], description: "Students review their work against criteria before submission." },
    { name: "Debrief", durationRange: [3, 7], description: "Brief debrief on the assessment experience." },
  ],
  mainBlockFloorPercent: 0.45,
  hasInstructionCap: true,
  requiresClosingReflection: true,
  promptBlock: ({ usableMinutes, instructionCap, minMainBlockMinutes }) => `
## LESSON STRUCTURE — ASSESSMENT & EVALUATION
This is an assessment lesson. Students demonstrate understanding under structured conditions.

### Phase 1: OVERVIEW & CRITERIA (5-10 min, max ${instructionCap} min)
Review assessment criteria and expectations. Clarify the task format.
Students should know EXACTLY what is expected before they begin.

### Phase 2: ASSESSMENT TASK (minimum ${minMainBlockMinutes} min — at least 45% of usable time)
Sustained assessment work. Maintain assessment conditions (no collaboration unless specified).
Teacher available for clarification questions only.

### Phase 3: REVIEW & SELF-CHECK (5-10 min)
Students review their work against criteria before submission.
"Check: have you addressed all criteria? Is your evidence clear?"

### Phase 4: DEBRIEF (3-7 min)
Brief debrief: "What did you find challenging? What are you most confident about?"

Time budget: Overview (5-10) + Assessment (${minMainBlockMinutes}+) + Review (5-10) + Debrief (3-7) = ${usableMinutes} min`,
};

// =========================================================================
// Public API
// =========================================================================

/**
 * Map of lesson type → structure template.
 * Workshop Model is the default for unrecognised or missing types.
 */
export const LESSON_STRUCTURES: Record<string, LessonStructure> = {
  // Explicit lesson types from getLessonTypeGuidance()
  research: RESEARCH_STRUCTURE,
  ideation: IDEATION_STRUCTURE,
  "skills-demo": SKILLS_DEMO_STRUCTURE,
  making: MAKING_STRUCTURE,
  testing: TESTING_STRUCTURE,
  critique: CRITIQUE_STRUCTURE,
  // Additional types
  presentation: PRESENTATION_STRUCTURE,
  assessment: ASSESSMENT_STRUCTURE,
  // Default
  default: WORKSHOP_MODEL,
};

/**
 * Get the appropriate lesson structure for a given lesson type.
 * Returns Workshop Model as default.
 */
export function getLessonStructure(lessonType?: string): LessonStructure {
  if (!lessonType) return WORKSHOP_MODEL;
  return LESSON_STRUCTURES[lessonType] || WORKSHOP_MODEL;
}

/**
 * Get the main block floor percent, considering both unit type and lesson type.
 * Unit-type floors are used as minimums; lesson-type structures may override higher.
 */
export function getMainBlockFloor(unitType?: string, lessonType?: string): number {
  // Unit-type base floors
  const unitTypeFloor: Record<string, number> = {
    design: 0.45,
    service: 0.30,
    personal_project: 0.40,
    inquiry: 0.35,
  };
  const baseFloor = unitTypeFloor[unitType || "design"] || 0.45;

  // Lesson-type structure floor
  const structure = getLessonStructure(lessonType);
  const structureFloor = structure.mainBlockFloorPercent;

  // Use the lesson-type floor when it's explicitly defined for a non-default type
  // For default/workshop, use the unit-type floor
  if (lessonType && LESSON_STRUCTURES[lessonType]) {
    return structureFloor;
  }
  return baseFloor;
}

/**
 * Get the effective instruction cap for a lesson type.
 * Skills-demo gets 1.5× the normal cap for the demo phase.
 */
export function getEffectiveInstructionCap(baseCap: number, lessonType?: string): number {
  const structure = getLessonStructure(lessonType);
  if (structure.relaxedInstructionCap) {
    return Math.round(baseCap * 1.5);
  }
  return baseCap;
}

/**
 * Get the phase names for a given lesson type's structure.
 * Used by timing validation to check the right phases are present.
 */
export function getStructurePhaseNames(lessonType?: string): string[] {
  const structure = getLessonStructure(lessonType);
  return structure.phases.map((p) => p.name);
}

/**
 * Check if a lesson type has a "no instruction cap" structure (e.g., making — no lecture phase).
 */
export function structureHasInstructionCap(lessonType?: string): boolean {
  return getLessonStructure(lessonType).hasInstructionCap;
}
