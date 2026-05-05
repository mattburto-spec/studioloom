import type { UnitWizardInput, LessonJourneyInput, JourneyOutlineOption, TimelineOutlineOption, TimelinePhase, TimelineLessonSkeleton, TimelineSkeleton, DesignLessonType } from "@/types";
import { getLessonStructure, getMainBlockFloor, getEffectiveInstructionCap, getStructurePhaseNames } from "@/lib/ai/lesson-structures";
import { CRITERIA, type CriterionKey, MYP_GLOBAL_CONTEXTS, MYP_KEY_CONCEPTS, MYP_RELATED_CONCEPTS_DESIGN, EMPHASIS_PAGE_COUNT, buildPageDefinitions, getCriterion, getFrameworkCriterionKeys } from "@/lib/constants";
import { getActivityLibrarySummary } from "@/lib/activity-library";
import { getActivityCardSummaryEnriched } from "@/lib/activity-cards";
import {
  retrieveContext,
  formatRetrievedContext,
  recordRetrieval,
} from "@/lib/knowledge/retrieve";
import {
  retrieveLessonProfiles,
  formatLessonProfiles,
  incrementProfileReferences,
} from "@/lib/knowledge/retrieve-lesson-profiles";
import { retrieveAggregatedFeedback } from "@/lib/knowledge/feedback";
import { buildTeachingContextBlock } from "@/lib/knowledge/analysis-prompts";
import { buildFrameworkPromptBlock, getFrameworkVocabulary } from "@/lib/ai/framework-vocabulary";
import type { PartialTeachingContext } from "@/types/lesson-intelligence";
import { getFrameworkFromContext } from "@/lib/ai/teacher-context";
import type { TeacherStyleProfile } from "@/types/teacher-style";
import { buildTeacherStyleBlock } from "@/lib/teacher-style/profile-service";
import type { UnitType } from "@/lib/ai/unit-types";
import { getTeachingMoves, formatMovesForPrompt, type DesignPhase as MovePhase } from "@/lib/ai/teaching-moves";

// =========================================================================
// Grade-Aware Timing Profiles
// =========================================================================

export interface GradeTimingProfile {
  mypYear: number;
  /** Average student age for this year group (used in 1+age instruction cap rule) */
  avgStudentAge: number;
  warmupMinutes: number;
  introMinutes: number;
  reflectionMinutes: number;
  /** Max minutes for HIGH cognitive demand activities (reading, writing, analysis, documentation) */
  maxHighCognitiveMinutes: number;
  /** Max minutes for ACTIVE/HANDS-ON activities (making, experimenting, building, testing) */
  maxHandsOnMinutes: number;
  /** Max minutes for COLLABORATIVE activities (discussion, peer review, group work) */
  maxCollaborativeMinutes: number;
  /** Max minutes for DIGITAL/RESEARCH activities (online research, digital tools, CAD) */
  maxDigitalMinutes: number;
  /** General pacing and scaffolding guidance for the AI */
  pacingNote: string;
}

/**
 * The "1 + age" rule: maximum direct instruction = 1 + student's average age.
 * Backed by research from PBLWorks, Cult of Pedagogy, and cognitive science.
 */
export function maxInstructionMinutes(profile: GradeTimingProfile): number {
  return 1 + profile.avgStudentAge;
}

/**
 * Minimum work time as a percentage of usable time.
 * Research consensus: at least 45%, ideally 60%+.
 */
export const MIN_WORK_TIME_PERCENT = 0.45;
export const IDEAL_WORK_TIME_PERCENT = 0.60;

/**
 * Context-aware timing model — replaces hard limits with school/lesson-aware calculations.
 * See docs/timing-reference.md for the full data.
 */
export interface TimingContext {
  /** Raw period length in minutes (before any deductions) */
  periodMinutes: number;
  /** Is this a workshop/practical lesson? Affects setup/cleanup deductions */
  isWorkshop: boolean;
  /** Transition overhead: settling, attendance, device login */
  transitionMinutes: number;
  /** Workshop setup time (material distribution, safety brief). 0 for theory. */
  setupMinutes: number;
  /** Workshop cleanup time (tools away, benches, safety check). 0 for theory. */
  cleanupMinutes: number;
  /** The grade timing profile for cognitive load limits */
  gradeProfile: GradeTimingProfile;
}

/**
 * Calculate usable time from a TimingContext.
 */
export function calculateUsableTime(ctx: TimingContext): number {
  return Math.max(0,
    ctx.periodMinutes - ctx.transitionMinutes - ctx.setupMinutes - ctx.cleanupMinutes
  );
}

/**
 * Build default TimingContext from a grade profile and lesson metadata.
 * Uses sensible defaults for overhead; teachers can override via settings.
 */
export function buildTimingContext(
  gradeProfile: GradeTimingProfile,
  periodMinutes: number,
  isWorkshop: boolean,
  overrides?: {
    transitionMinutes?: number;
    setupMinutes?: number;
    cleanupMinutes?: number;
  }
): TimingContext {
  return {
    periodMinutes,
    isWorkshop,
    transitionMinutes: overrides?.transitionMinutes ?? 3,
    setupMinutes: isWorkshop ? (overrides?.setupMinutes ?? 8) : 0,
    cleanupMinutes: isWorkshop ? (overrides?.cleanupMinutes ?? 8) : 0,
    gradeProfile,
  };
}

/** Age-based timing profiles. Keyed by student age (11-18). */
const AGE_TIMING_PROFILES: Record<number, GradeTimingProfile> = {
  11: {
    mypYear: 1, avgStudentAge: 11, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 12, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 15,
    pacingNote: "Age 11 (typically Year 1): Students sustain cognitive focus for ~10-12 minutes but can engage in hands-on making for much longer. Reading, writing, and analysis tasks must be SHORT (≤12 min) and heavily scaffolded with checklists, sentence starters, and worked examples. Hands-on/making activities can run 20-40 min as long as they have clear checkpoints. Break reading-heavy tasks into small chunks with partner discussion between them.",
  },
  12: {
    mypYear: 2, avgStudentAge: 12, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 13, maxHandsOnMinutes: 40, maxCollaborativeMinutes: 15, maxDigitalMinutes: 20,
    pacingNote: "Age 12 (typically Year 2): Cognitive focus extends to ~12-13 minutes (1+age rule). Still scaffold reading/analysis tasks with sentence starters and templates, but allow some choice in how students respond. Hands-on making activities can run 20-40 min. Mix active and passive tasks — avoid back-to-back reading/writing activities.",
  },
  13: {
    mypYear: 3, avgStudentAge: 13, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 14, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 20, maxDigitalMinutes: 25,
    pacingNote: "Age 13 (typically Year 3): Cognitive focus ~14 minutes (1+age rule). Balance structured guidance with growing autonomy. Provide reference materials and exemplars but reduce step-by-step scaffolding. Students can handle longer research tasks and sustained making sessions.",
  },
  14: {
    mypYear: 4, avgStudentAge: 14, warmupMinutes: 5, introMinutes: 5, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 15, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 30,
    pacingNote: "Age 14 (typically Year 4 or GCSE Year 10): Cognitive focus ~15 minutes (1+age rule). Support extended independent work with clear success criteria. Scaffold through exemplars and peer critique rather than templates. Students can manage longer analysis and documentation tasks.",
  },
  15: {
    mypYear: 5, avgStudentAge: 15, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 16, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 30,
    pacingNote: "Age 15 (typically Year 5 or GCSE Year 11): Cognitive focus ~16 minutes (1+age rule). Support extended independent work with clear success criteria. Scaffold through exemplars and peer critique rather than templates. Students can manage longer analysis and documentation tasks.",
  },
  16: {
    mypYear: 5, avgStudentAge: 16, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 17, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "Age 16 (typically A-Level Year 12): Cognitive focus ~17 minutes (1+age rule). Minimise unnecessary transitions to allow flow state during deep work. Scaffold through prompts and peer critique. Students can sustain extended analysis, documentation, and independent making sessions.",
  },
  17: {
    mypYear: 5, avgStudentAge: 17, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 18, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "Age 17 (typically A-Level Year 13): Cognitive focus ~18 minutes (1+age rule). Students can sustain extended analysis, documentation, and independent making sessions. Minimise scaffolding — provide autonomy and feedback.",
  },
  18: {
    mypYear: 5, avgStudentAge: 18, warmupMinutes: 5, introMinutes: 3, reflectionMinutes: 5,
    maxHighCognitiveMinutes: 19, maxHandsOnMinutes: 45, maxCollaborativeMinutes: 25, maxDigitalMinutes: 35,
    pacingNote: "Age 18: Cognitive focus ~19 minutes (1+age rule). Full autonomy with feedback. Minimal scaffolding needed.",
  },
};

/**
 * Convert a grade string (any format) to an approximate student age.
 * Handles: MYP Year X, GCSE Year N, A-Level Year N, ACARA Year N, PLTW Grade N, etc.
 *
 * Key mappings:
 * - MYP: Year 1=11, Year 2=12, Year 3=13, Year 4=14, Year 5=15
 * - GCSE: Year 10=14, Year 11=15
 * - A-Level: Year 12=16, Year 13=17
 * - ACARA: Year 7=12, Year 8=13, Year 9=14, Year 10=15
 * - PLTW: Grade 9=14, Grade 10=15, Grade 11=16, Grade 12=17
 */
export function gradeStringToAge(gradeString: string, framework?: string): number {
  const lower = gradeString.toLowerCase();

  // Try parsing MYP Year X format
  const mypMatch = lower.match(/year\s*(\d+)/);
  if (mypMatch) {
    const year = parseInt(mypMatch[1], 10);
    if (framework === "IB_MYP" || !framework) {
      // MYP: Year 1→11, Year 2→12, Year 3→13, Year 4→14, Year 5→15
      return Math.min(11 + (year - 1), 15);
    }
    // For other frameworks, Year 10 = 14, Year 11 = 15, Year 12 = 16, Year 13 = 17
    if (year === 10) return 14;
    if (year === 11) return 15;
    if (year === 12) return 16;
    if (year === 13) return 17;
    if (year >= 7) return 12 + (year - 7); // ACARA: Year 7→12, Year 8→13, etc.
  }

  // Try parsing PLTW Grade N format
  const pltMatch = lower.match(/grade\s*(\d+)/);
  if (pltMatch) {
    const grade = parseInt(pltMatch[1], 10);
    // PLTW: Grade 9→14, Grade 10→15, Grade 11→16, Grade 12→17
    if (grade >= 9 && grade <= 12) return 5 + grade;
  }

  // Fallback: age 13 (Year 3 / Grade 8 equivalent)
  return 13;
}

/**
 * Parse the grade string and return the matching timing profile.
 * Converts grade to age, then looks up age in AGE_TIMING_PROFILES.
 * Defaults to age 13 (Year 3) if parsing fails.
 */
export function getGradeTimingProfile(gradeLevel: string, framework?: string, configProfiles?: Record<number, GradeTimingProfile>): GradeTimingProfile {
  const age = gradeStringToAge(gradeLevel, framework);
  const profiles = configProfiles || AGE_TIMING_PROFILES;
  return profiles[age] || profiles[13] || AGE_TIMING_PROFILES[13];
}

/**
 * Build a timing constraints block for injection into generation prompts.
 * ALWAYS calculates usable time — never generates for raw period length.
 * If no TimingContext is provided, constructs a default (theory lesson, 3-min transition).
 */
export function buildTimingBlock(
  profile: GradeTimingProfile,
  lessonLengthMinutes: number,
  timingCtx?: TimingContext,
  unitType?: UnitType,
  lessonType?: string
): string {
  // Always use usable time — construct default TimingContext if none provided
  const ctx: TimingContext = timingCtx || buildTimingContext(profile, lessonLengthMinutes, false);
  const usable = calculateUsableTime(ctx);
  const roomType = ctx.isWorkshop ? "WORKSHOP" : "THEORY";
  const baseInstructionCap = maxInstructionMinutes(profile);
  const effectiveCap = getEffectiveInstructionCap(baseInstructionCap, lessonType);

  // Get the appropriate lesson structure
  const structure = getLessonStructure(lessonType);
  const floor = getMainBlockFloor(unitType, lessonType);
  const minMainBlock = Math.round(usable * floor);
  const idealMainBlock = Math.round(usable * Math.max(floor + 0.15, 0.60));

  // Build the structure-specific prompt block
  const structureBlock = structure.promptBlock({
    usableMinutes: usable,
    instructionCap: effectiveCap,
    minMainBlockMinutes: minMainBlock,
    idealMainBlockMinutes: idealMainBlock,
    profile: { mypYear: profile.mypYear, avgStudentAge: profile.avgStudentAge, pacingNote: profile.pacingNote },
  });

  return `## Timing Context
Schedule: ${ctx.periodMinutes}-minute period | Room type: ${roomType} | MYP Year ${profile.mypYear} (avg age ${profile.avgStudentAge})
Usable time: **${usable} minutes** (after ${ctx.transitionMinutes} min transition${ctx.isWorkshop ? `, ${ctx.setupMinutes} min setup, ${ctx.cleanupMinutes} min cleanup` : ""})
${lessonType ? `Lesson type: **${lessonType}** → using **${structure.name}** structure` : "Lesson type: general → using **Workshop Model** structure"}

CRITICAL: Generate activities that sum to ${usable} minutes. Do NOT generate ${ctx.periodMinutes} minutes of content.
${ctx.isWorkshop ? `Include setup (${ctx.setupMinutes} min) and cleanup (${ctx.cleanupMinutes} min) as explicit lesson phases.` : ""}
${structureBlock}

## workshopPhases Mapping
The workshopPhases object uses 4 fixed role-based slots: \`opening\`, \`miniLesson\`, \`workTime\`, \`debrief\`.
For the **${structure.name}** structure, map the phases as follows:
${(() => {
    const phaseNames = getStructurePhaseNames(lessonType);
    const slotNames = ["opening", "miniLesson", "workTime", "debrief"];
    return slotNames.map((slot, i) => `- \`${slot}\` → phaseName: "${phaseNames[i] || slot}"${i === 2 ? " (main block)" : ""}`).join("\n");
  })()}
You MUST set the \`phaseName\` field on each workshopPhases slot to match the names above. The slot keys (opening/miniLesson/workTime/debrief) are structural — \`phaseName\` is what the teacher sees.

## Age-Appropriate Pacing
${profile.pacingNote}

Activity duration limits for MYP Year ${profile.mypYear}:
${structure.hasInstructionCap ? `- Direct instruction / demonstration: max ${effectiveCap} min (${structure.relaxedInstructionCap ? "relaxed 1.5×(1+age) for demo" : "1+age rule"}, then switch to student work)` : "- No dedicated instruction phase in this lesson type"}
- Independent making / prototyping: max ${profile.maxHandsOnMinutes} min (with checkpoints every ${Math.min(15, baseInstructionCap)} min)
- Digital work / CAD / research: max ${profile.maxDigitalMinutes} min
- Critique / gallery walk / peer review: max ${profile.maxCollaborativeMinutes} min
- Closing reflection: 3-10 min (always at end)

Energy sequencing rules:
- Never place two high-cognitive activities back-to-back
- Workshop making can follow theory (welcome shift)
- Theory should NOT follow long workshop (students are physically tired)
- Critique/gallery walk works best mid-lesson after students have work to show
- Always end with a closing reflection — it's the last thing students do before leaving

## EXTENSIONS (REQUIRED)
For EVERY lesson, generate 2-3 extension activities for students who finish early.
Extensions must match the current design phase:
- Investigation phase: deepen research (more interviews, competitor analysis, accessibility audit)
- Ideation phase: push creativity (SCAMPER on top concept, constraint variation, rapid prototype 3 versions)
- Prototyping phase: explore alternatives (different materials, scale variation, user testing with different demographic)
- Evaluation phase: increase rigor (edge-case testing, cross-cohort comparison, sustainability analysis)
Extensions are NOT extra work. They are productive deepening of the same design challenge.
Format: Include an "extensions" array on each lesson with 2-3 items: { "title": "...", "description": "...", "durationMinutes": N }`;
}

// =========================================================================
// DESIGN TEACHING CORPUS + TEACHER STYLE — injected into generation prompts
// See docs/design-teaching-corpus.md for the full reference.
// See docs/ai-intelligence-architecture.md §4 for teacher style profiles.
// =========================================================================

/** Shared Dimensions metadata instruction — appended to ALL unit type teaching contexts. */
const DIMENSIONS_METADATA_INSTRUCTION = `

DIMENSIONS METADATA: For every activity section, output these fields alongside the activity content:
- bloom_level: the primary cognitive demand (remember/understand/apply/analyze/evaluate/create).
- timeWeight: relative time need (quick/moderate/extended/flexible). Warm-ups = quick. Main tasks = extended. Reflections = quick or moderate.
- grouping: how students work (individual/pair/small_group/whole_class/flexible). Vary grouping across the lesson.
- ai_rules: set phase to "divergent" during ideation/brainstorming, "convergent" during evaluation/analysis, "neutral" for other activities.
- udl_checkpoints: tag with UDL checkpoint IDs from the CAST 3×3 grid. Cover all 3 principles per lesson: Engagement (1-3), Representation (4-6), Action & Expression (7-9). Key checkpoints: 1.1 (recruiting interest), 3.1 (self-regulation), 5.1 (language/symbols), 5.2 (tools), 7.1 (physical action), 7.2 (expression/communication), 8.3 (self-assessment).
- success_look_fors: 1-3 observable indicators a teacher can spot during the activity.
Also output page-level fields: grouping_strategy (overall grouping progression) and success_criteria (2-4 "I can..." statements).`;

/**
 * Build type-aware teaching context block for injection into generation prompts.
 * Includes pedagogical principles specific to the unit type, the Workshop Model requirement,
 * and the teacher's learned style profile (Layer 4) if available.
 */
export function buildTeachingContext(unitType: string = "design", teacherProfile?: TeacherStyleProfile | null): string {
  const styleBlock = teacherProfile ? buildTeacherStyleBlock(teacherProfile) : "";

  if (unitType === "service") {
    return `## Service Learning Teaching Principles
You are generating content for service learning education. Follow these principles:

1. IPARD CYCLE (HIGHEST PRIORITY): Every lesson follows Investigation → Planning → Action → Reflection → Demonstration. This is NOT linear — students cycle between phases based on real community feedback and changing circumstances.

2. RECIPROCITY: Service must benefit BOTH the community partner AND the student. Avoid charity mindset — use partnership language. The community partner defines needs, not student assumptions.

3. COMMUNITY VOICE: Community partners are co-creators, not passive recipients. Include them in planning and decision-making. Student assumptions about "what they need" must be challenged and verified.

4. REFLECTION AS PRIMARY MECHANISM: Reflection isn't journaling — it's the main learning vehicle. Use 4 types: mirror (what happened), microscope (detail analysis), binoculars (broader implications), window (others' perspectives).

5. ETHICAL ACTION: Students must consider unintended consequences. "Helping" can harm. Build in ethical checkpoints — consult community partners, audit for assumptions, pivot if needed.

6. DOCUMENTATION CULTURE: Process documentation is continuous, not retrospective. Photo, video, journal throughout. Both successes AND failures are learning evidence.

7. AUTHENTIC AUDIENCE: Service outcomes are shared with real stakeholders (community partners, local government, media), not just the teacher.

8. SUSTAINABLE IMPACT: One-off events are less valuable than sustained projects (3+ sessions, ongoing relationship). Push for lasting change and ongoing feedback loops.

9. STUDENT AGENCY: Students choose their service focus within structured parameters. Teacher guides constraints and ethical gates, not assigns tasks.

10. CELEBRATION & CRITIQUE: Share outcomes publicly with community. Celebrate effort, learning, and impact. Also conduct peer and community critique — what could have been done better?${DIMENSIONS_METADATA_INSTRUCTION}${styleBlock}`;
  }

  if (unitType === "personal_project") {
    return `## Personal Project Teaching Principles
You are generating content for MYP Personal Project supervision. Follow these principles:

1. STUDENT-DRIVEN: The student owns every decision — research direction, methodology, format, presentation. Teacher is a supervisor/mentor, not a director. Resistance signals misalignment — restart the goal-setting conversation.

2. PROCESS JOURNAL: The process journal IS the assessment evidence. Regular (weekly minimum), multimedia (text, sketches, photos, video, mind maps), and reflective. It shows thinking, not just final product.

3. SMART GOAL SETTING: Goals must be Specific, Measurable, Achievable, Relevant, Time-bound. Revisit quarterly. Vague goals ("learn more about fashion") must be sharpened to observable, time-bound outcomes.

4. ATL SKILLS FOCUS: Every PP must demonstrate specific Approaches to Learning (ATL) skills. Make them explicit — "this stage develops Research skills and Creative Thinking." Track and assess ATL progression.

5. GLOBAL CONTEXT: PP must connect to a genuine global context (not grafted on). The context should frame the research question, not be an afterthought. It explains WHY this project matters.

6. ACADEMIC HONESTY: Extensive citation and attribution throughout (MLA/APA). The line between research and original work must be crystal clear. Plagiarism checks run in both directions (student work + teacher feedback must be original too).

7. PRESENTATION QUALITY: The final presentation IS part of the assessment. Not an afterthought. It shows communication and synthesis skills. Support students in creating polished deliverables (slide decks, videos, posters, websites).

8. SUPERVISOR MEETINGS: Regular structured meetings (fortnightly minimum). Use an agenda template. Documented discussions with agreed-upon action items. Students see notes — this builds transparency and accountability.${DIMENSIONS_METADATA_INSTRUCTION}${styleBlock}`;
  }

  if (unitType === "inquiry") {
    return `## Inquiry-Based Learning Teaching Principles
You are generating content for transdisciplinary inquiry units. Follow these principles:

1. WONDER-DRIVEN: Start with genuine student questions, not teacher-imposed topics. "I wonder what happens if..." frames learning. Teachers help students sharpen questions, not replace them.

2. TRANSDISCIPLINARY: Connections across subject areas are explicit and intentional. Avoid forced interdisciplinary connections. Example: "How does economics explain fashion trends?" is disciplinary thinking made visible, not busywork.

3. CONCEPTUAL UNDERSTANDING: Facts serve concepts, not the other way around. Push for big ideas — "Why do civilisations fall?", "What makes something alive?" — not memorisation of dates or definitions.

4. LEARNER PROFILE: IB Learner Profile attributes are woven into every activity. Curiosity, open-mindedness, principled thinking are content. "Today we're developing critical thinking by..." makes it explicit.

5. STUDENT AGENCY: Students have genuine choice in how they investigate (methods, sources, collaborators) and how they demonstrate learning (oral, visual, written, creative). Choice drives engagement.

6. ACTION AS OUTCOME: Inquiry should lead to informed action — not just understanding. Students take steps based on learning (write a letter, create advocacy, conduct an experiment, produce a guide for peers).

7. COLLABORATIVE CONSTRUCTION: Knowledge is built together through discussion, debate, and investigation. Peer critique shapes thinking. Communities of inquiry (not isolated individuals) do the thinking work.

8. WORKSHOP MODEL (HIGHEST PRIORITY): Even inquiry units follow 4 phases — Opening (activate wonder) → Mini-Lesson (teach inquiry methods/skills) → Work Time (investigate, discuss, create) → Debrief (synthesise, share, plan next inquiry).${DIMENSIONS_METADATA_INSTRUCTION}${styleBlock}`;
  }

  // Default to design
  return buildDesignTeachingContext(teacherProfile);
}

/**
 * Build a concise design teaching context block for injection into generation prompts.
 * Includes the Design Teaching Corpus (Layer 1) principles, the Workshop Model requirement,
 * and the teacher's learned style profile (Layer 4) if available.
 *
 * DEPRECATED: Use buildTeachingContext(unitType, teacherProfile) instead.
 * This is kept for backward compatibility.
 */
export function buildDesignTeachingContext(teacherProfile?: TeacherStyleProfile | null): string {
  const styleBlock = teacherProfile ? buildTeacherStyleBlock(teacherProfile) : "";
  return `## Design Teaching Principles
You are generating content for design & technology education. Follow these principles:

1. WORKSHOP MODEL (HIGHEST PRIORITY): Every lesson follows 4 phases — Opening (5-10 min) → Mini-Lesson (max 1+age minutes) → Work Time (at least 45% of period, ideally 60%+) → Debrief (5-10 min). Work Time is THE MAIN EVENT. Everything else exists to support it. Never fragment Work Time into small activities — it is one sustained block where students create, research, build, and test. The debrief is non-negotiable and uses a structured protocol (I Like/I Wish/I Wonder, Two Stars & a Wish, exit ticket).

2. NON-LINEAR DESIGN CYCLE: The design cycle is NOT a linear sequence. Students jump between phases (research → ideate → test → back to research). Plan for iteration and decision points, not rigid step-by-step sequences.

3. GRADUAL RELEASE: Use "I do → We do → You do" scaffolding. Teacher demonstrates → students practice with guidance → students work independently. Progressively remove scaffolding (checklists, templates, sentence starters) as students gain confidence.

4. WHOLE GAME: Every activity should connect to the broader design challenge. Students should always know WHY they're doing something. Avoid isolated skill drills disconnected from the project.

5. CRITIQUE PROTOCOLS: Include structured critique activities (Warm/Cool feedback, I Like/I Wish/What If, TAG, silent gallery walk). Feedback must be Kind, Specific, and Helpful. "I like it" is not feedback. "I like how the handle curves to fit the palm" is feedback.

6. WORKSHOP AWARENESS: Design lessons have physical realities — setup time, cleanup time, material distribution, safety briefs, noise curves. Account for these. Don't pretend a workshop lesson is the same as a theory lesson.

7. STUDIO CULTURE: Work is always visible, critique is normal, iteration is expected, the teacher is a design mentor (not a lecturer), students make real decisions about materials/methods/aesthetics.

8. PROCESS OVER PRODUCT: A portfolio showing iterative improvement is more valuable than a perfect final product. Document the journey — wrong turns and pivots demonstrate learning.

9. ENERGY SEQUENCING: Don't put two high-cognitive activities back-to-back. Making can follow theory. Theory should NOT follow long workshop sessions. Always end with debrief.

10. DIFFERENTIATION & EXTENSIONS: Design naturally differentiates (different paces, multiple valid solutions). Plan scaffolding for ELL students, extension activities for fast finishers (indexed to the current design phase — not busywork), and adapted tools for students with physical needs.

11. 66% ACTIVE LEARNING RULE (RESEARCH-BACKED): At least 66% of all lesson activities must be ACTIVE — students creating, designing, building, discussing, analyzing, evaluating, presenting, collaborating, or using design tools. Achievement gaps across cultural, linguistic, and socioeconomic backgrounds ONLY close when active learning exceeds 66% of class time (effect size d=0.52). Passive content (reading, watching demos, teacher lectures) must stay below 34%. This rule is validated post-generation — the system will flag units that fall below the threshold.

12. INCLUSIVE ASSESSMENT LANGUAGE: Frame all assessment activities as learning opportunities, never ability tests. Use "This helps us see what you're learning" NOT "This assesses your design ability." Stereotype threat (effect size d=-0.33) is triggered by ability-framing, especially for underrepresented groups. Always use growth framing in rubric descriptions, task instructions, and reflection prompts.

13. DIMENSIONS METADATA: For every activity section, output these fields alongside the activity content:
- bloom_level: the primary cognitive demand (remember/understand/apply/analyze/evaluate/create). A hands-on prototyping task = "create". A research comparison = "analyze". A vocabulary warm-up = "remember".
- timeWeight: relative time need (quick/moderate/extended/flexible). Warm-ups = quick. Main making tasks = extended. Reflections = quick or moderate.
- grouping: how students work (individual/pair/small_group/whole_class/flexible). Vary grouping across the lesson — don't make every activity individual.
- ai_rules: set phase to "divergent" during ideation activities (AI encourages wild ideas, never evaluates), "convergent" during evaluation activities (AI pushes for analysis, trade-offs), "neutral" for other activities.
- udl_checkpoints: tag with UDL checkpoint IDs from the CAST 3×3 grid. Aim for coverage across all 3 principles (Engagement 1-3, Representation 4-6, Action & Expression 7-9) within each lesson. Key checkpoints: 1.1 (recruiting interest), 3.1 (self-regulation), 5.1 (language/symbols), 5.2 (tools), 7.1 (physical action), 7.2 (expression/communication), 8.3 (self-assessment).
- success_look_fors: 1-3 observable indicators a teacher can spot during the activity (e.g. "Students are sketching at least 3 different ideas" not "Students understand ideation").
Also output page-level fields: grouping_strategy (overall grouping progression) and success_criteria (2-4 "I can..." statements).${styleBlock}`;
}

// =========================================================================

/**
 * Build a framework-aware system prompt that teaches the AI about the curriculum,
 * the page structure, and the exact JSON schema to output.
 *
 * Automatically injects framework-specific terminology (criteria labels, design cycle phases, etc.)
 * when framework != "IB_MYP".
 */
export function buildUnitSystemPrompt(framework?: string): string {
  const vocab = framework ? getFrameworkVocabulary(framework) : getFrameworkVocabulary("IB_MYP");
  const frameworkName = vocab.name;
  const criteriaLabels = vocab.criteriaLabels.join(", ");
  const criteriaExample = vocab.criteriaLabels.slice(0, 2).join(", ");

  return `You are an expert ${frameworkName} teacher and curriculum designer. You create engaging, differentiated unit content for the ${vocab.designCycleName}.

## ${frameworkName} Cycle Structure
Units have a variable number of pages organized by ${vocab.criteriaTermPlural} (${criteriaLabels}).
The number of pages per ${vocab.criteriaTermSingular} depends on the emphasis level:
- Light: 2 pages (concise coverage)
- Standard: 3 pages (balanced depth)
- Emphasis: 4 pages (thorough deep-dive)

Not every unit includes all ${vocab.criteriaLabels.length} ${vocab.criteriaTermPlural} — generate ONLY the pages specified in the user prompt.

## Your Task
Generate content for the requested ${vocab.criteriaTermSingular} pages. Output ONLY valid JSON matching the exact schema below.

## JSON Schema (for each page)
{
  "pages": {
    "[PageId]": {
      "title": "Short descriptive page title",
      "learningGoal": "Clear learning objective for this page",
      "vocabWarmup": {
        "terms": [
          { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
        ],
        "activity": {
          "type": "matching",
          "items": [
            { "question": "Match prompt", "answer": "Correct answer" }
          ]
        }
      },
      "introduction": {
        "text": "Introduction paragraph explaining the task and connecting to prior learning"
      },
      "sections": [
        {
          "prompt": "Clear, engaging question or task for the student",
          "scaffolding": {
            "ell1": {
              "sentenceStarters": ["Begin with...", "This means..."],
              "hints": ["Think about...", "Consider..."]
            },
            "ell2": {
              "sentenceStarters": ["I think...", "One example is..."]
            },
            "ell3": {
              "extensionPrompts": ["How might you extend this?", "What connections can you make?"]
            }
          },
          "responseType": "text",
          "exampleResponse": "A model response showing quality expectations"
        }
      ],
      "reflection": {
        "type": "confidence-slider",
        "items": ["I understand the task", "I can explain my reasoning"]
      }
    }
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. Include 3-5 vocab terms per page, relevant to the topic
3. Include 2-4 activity sections per page
4. Vary responseType across sections: use "text", "upload", "link", "multi", and for decision-making tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
5. Make prompts age-appropriate for the specified grade level
6. Connect content to the specified global context and key concept
7. Include practical, hands-on activities where relevant
8. For "emphasis" ${vocab.criteriaTermPlural}, include more detailed sections with deeper inquiry
9. For "light" ${vocab.criteriaTermPlural}, keep sections focused and concise
10. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
11. Reflection type can be: "confidence-slider", "checklist", or "short-response"
12. Output ONLY the JSON object — no markdown, no explanations
13. When appropriate, incorporate established design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) into section prompts — adapt them to the specific topic rather than using generic templates
14. For pages focused on choosing between designs, prefer "decision-matrix" or "pairwise" responseType. For planning/creation pages, consider "trade-off-sliders". For evaluation pages, consider "pmi"
15. Set "portfolioCapture": true on 1-2 sections per page that represent substantive design work — research findings, design sketches/uploads, design justifications, creation evidence, evaluations. Omit or set false for vocab warm-ups, scaffolding prompts, and low-value practice questions`;
}

/**
 * System prompt that teaches the AI about MYP Design, the page structure,
 * and the exact JSON schema to output. (DEPRECATED — use buildUnitSystemPrompt instead)
 */
export const UNIT_SYSTEM_PROMPT = buildUnitSystemPrompt("IB_MYP");

/**
 * Build the user prompt for generating a specific criterion's pages.
 *
 * @param criterion        The criterion key (e.g., "A", "AO1", "I")
 * @param input            The wizard input containing unit context
 * @param activitySummary  Pre-fetched activity card summary from DB.
 *                         If omitted, falls back to the hardcoded library.
 * @param framework        The curriculum framework (e.g., "IB_MYP", "GCSE_DT").
 *                         Used to determine correct criteria naming and language.
 */
export function buildCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  activitySummary?: string,
  framework?: string
): string {
  const unitType = input.unitType || "design";
  const vocab = framework ? getFrameworkVocabulary(framework) : getFrameworkVocabulary("IB_MYP");
  const criterionInfo = getCriterion(criterion, unitType) || { name: criterion, key: criterion };
  const focusLevel = input.criteriaFocus[criterion] || "standard";
  const pageCount = EMPHASIS_PAGE_COUNT[focusLevel];
  const pageDefs = buildPageDefinitions([criterion], { [criterion]: focusLevel }, unitType);

  const pageDescriptions = pageDefs
    .map((p) => `  - ${p.id}: ${p.title}`)
    .join("\n");

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const curriculumSection = input.curriculumContext
    ? `\n- Curriculum Context: ${input.curriculumContext}`
    : "";

  // Use DB-backed summary if available, fall back to hardcoded library
  const activitySuggestions = activitySummary || getActivityLibrarySummary(criterion);

  // Framework block (empty for IB_MYP, non-empty for others)
  const frameworkBlock = buildFrameworkPromptBlock(framework);

  return `Generate ${pageCount} pages for ${vocab.criteriaTermSingular.charAt(0).toUpperCase() + vocab.criteriaTermSingular.slice(1)} ${criterion}: ${criterionInfo.name}
${frameworkBlock ? `\n${frameworkBlock}\n` : ""}

## Suggested Activity Cards for Criterion ${criterion}
Consider incorporating these activity cards where appropriate. Each card has a specific use case and optional modifiers. Pick the most relevant card for each page and weave it naturally into the section prompts:
${activitySuggestions}

## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}${curriculumSection}${buildTypeSpecificContext(input)}${buildContextInjection(input)}

## Pages to Generate
${pageDescriptions}

## Focus Level: ${focusLevel}
${focusLevel === "emphasis" ? "This is an EMPHASIS criterion — include more detailed sections (3-4 per page), deeper inquiry questions, and richer scaffolding." : focusLevel === "light" ? "This is a LIGHT criterion — keep sections concise (2 per page), focused, and efficient." : "This is STANDARD — include 2-3 sections per page with balanced depth."}

Generate the JSON for exactly these ${pageCount} pages (${pageDefs.map(p => p.id).join(", ")}). Remember to include ELL scaffolding (ell1, ell2, ell3) for every section.`;
}

/**
 * Build a RAG-enriched criterion prompt that includes retrieved examples
 * from the teacher's knowledge base and community content.
 *
 * Also fetches activity card summaries from the DB (with hardcoded fallback)
 * so the generation AI has full awareness of available activity cards.
 *
 * @param criterion        The criterion key (e.g., "A", "AO1", "I")
 * @param input            The wizard input containing unit context
 * @param teacherId        Optional teacher ID for RAG retrieval filtering
 * @param selectedOutline  Optional outline to include in the prompt
 * @param framework        The curriculum framework (e.g., "IB_MYP", "GCSE_DT")
 */
export async function buildRAGCriterionPrompt(
  criterion: CriterionKey,
  input: UnitWizardInput,
  teacherId?: string,
  selectedOutline?: { approach: string; pages: Record<string, { title: string; summary: string }> } | null,
  framework?: string
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (includes modifier info)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched(criterion);
  } catch {
    // DB unavailable — buildCriterionPrompt will fall back to hardcoded
  }

  const basePrompt = buildCriterionPrompt(criterion, input, activitySummary, framework);

  // Retrieve RAG context + lesson profiles + activity blocks in parallel (all optional enhancements)
  const criterionDef = getCriterion(criterion, input.unitType || "design");
  const ragQuery = `${input.topic} ${input.title} Criterion ${criterion} ${criterionDef?.name || criterion} ${input.gradeLevel} ${input.globalContext}`;
  const profileQuery = `${input.topic} ${input.title} ${criterionDef?.name || criterion} ${input.gradeLevel}`;

  const criterionBlocksPromise = teacherId
    ? import("@/lib/activity-blocks").then(async (m) => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const blocks = await m.retrieveActivityBlocks(createAdminClient(), { query: ragQuery, teacherId, maxBlocks: 5 });
        return blocks.length > 0 ? m.formatBlocksAsPromptText(blocks) : "";
      }).catch(() => "")
    : Promise.resolve("");

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  const [chunksResult, profilesResult, criterionBlocksResult] = await Promise.allSettled([
    retrieveContext({
      query: ragQuery,
      criterion,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    }),
    retrieveLessonProfiles({
      query: profileQuery,
      gradeLevel: input.gradeLevel,
      criteria: [criterion],
      teacherId,
      maxProfiles: 3,
    }),
    criterionBlocksPromise,
  ]);

  if (chunksResult.status === "fulfilled" && chunksResult.value.length > 0) {
    ragContext = formatRetrievedContext(chunksResult.value);
    chunkIds = chunksResult.value.map((c) => c.id);
    recordRetrieval(chunkIds).catch(() => {});
  }
  if (profilesResult.status === "fulfilled" && profilesResult.value.length > 0) {
    lessonContext = formatLessonProfiles(profilesResult.value);
    incrementProfileReferences(profilesResult.value.map((p) => p.id)).catch(() => {});
  }

  // Build outline instruction if teacher selected an approach
  let outlineSection = "";
  if (selectedOutline) {
    const criterionPages = Object.entries(selectedOutline.pages)
      .filter(([pageId]) => pageId.startsWith(criterion))
      .sort(([a], [b]) => a.localeCompare(b));

    if (criterionPages.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${selectedOutline.approach}"
Follow this outline closely for each page:
${criterionPages.map(([pageId, p]) => `  - ${pageId}: "${p.title}" — ${p.summary}`).join("\n")}
`;
    }
  }

  const criterionBlocksText = criterionBlocksResult.status === "fulfilled" ? criterionBlocksResult.value : "";

  if (!ragContext && !lessonContext && !outlineSection && !criterionBlocksText) {
    return { prompt: basePrompt, chunkIds: [] };
  }

  // Inject lesson profiles, RAG context, activity blocks, and outline before the base prompt
  // Order: Teaching Patterns (high-level) → Reference Examples (specific) → Activity Blocks → Outline → Base Prompt
  const enrichedPrompt = `${lessonContext ? lessonContext + "\n\n---\n\n" : ""}${ragContext ? ragContext + "\n\n---\n\n" : ""}${criterionBlocksText ? criterionBlocksText + "\n\n---\n\n" : ""}${outlineSection ? outlineSection + "\n---\n\n" : ""}${basePrompt}`;

  return { prompt: enrichedPrompt, chunkIds };
}

/**
 * System prompt for generating unit outline options (not full pages).
 * Used in the multi-option generation step.
 */
export const OUTLINE_SYSTEM_PROMPT = `You are an expert MYP Design curriculum designer. Generate unit outline options — NOT full page content, just titles and brief descriptions for each page.

Units may not include all 4 criteria (A, B, C, D) and the number of pages per criterion varies by emphasis level. Generate outlines covering ONLY the specified criteria and page counts.

Each option should represent a genuinely different pedagogical approach to the same topic. Vary the activities, the entry point, the emphasis, and the assessment strategy.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name for this approach (e.g., 'Community-Driven Design')",
      "description": "2-3 sentence description of what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "pages": {
        "A1": { "title": "Page title", "summary": "One-sentence description of what students do" },
        "A2": { ... },
        ...for all specified page IDs
      }
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST cover ALL the page IDs specified in the user prompt — no more, no fewer
3. Options must be genuinely different — vary the design thinking frameworks, assessment types, entry activities, and real-world connections
4. Keep page summaries to one sentence each
5. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build a Context Injection block — grounds generation in this specific classroom's reality.
 * Fields are optional free-text from the wizard. When present, the AI weaves them into
 * opening hooks, activity scenarios, reflection prompts, and constraint-aware planning.
 */
export function buildContextInjection(input: UnitWizardInput | LessonJourneyInput): string {
  const lines: string[] = [];
  if (input.realWorldContext) {
    lines.push(`- Real-World Connection: ${input.realWorldContext} — weave this into opening hooks, activity scenarios, and reflection questions. Students should feel this is about THEIR world, not an abstract exercise.`);
  }
  if (input.studentContext) {
    lines.push(`- Student Background: ${input.studentContext} — adjust energy levels, avoid repetition of recent work, and build on what students already know.`);
  }
  if (input.classroomConstraints) {
    lines.push(`- Classroom Constraints: ${input.classroomConstraints} — plan activities around these realities. Don't suggest tools/spaces/materials that aren't available.`);
  }
  if (lines.length === 0) return "";
  return `\n\n## Classroom Context (Teacher-Provided)\n${lines.join("\n")}`;
}

/**
 * Build a block of type-specific context fields to include in generation prompts.
 * Only includes fields that are populated (non-null, non-empty).
 */
export function buildTypeSpecificContext(input: UnitWizardInput | LessonJourneyInput): string {
  const fields: string[] = [];

  // Service Learning fields
  if (input.communityContext) {
    fields.push(`- Community Focus: ${input.communityContext}`);
  }
  if ((input as any).sdgConnection) {
    fields.push(`- SDG Connection: ${(input as any).sdgConnection}`);
  }
  if ((input as any).serviceOutcomes?.length) {
    fields.push(`- Service Outcomes: ${(input as any).serviceOutcomes.join(", ")}`);
  }
  if ((input as any).partnerType) {
    fields.push(`- Partner Type: ${(input as any).partnerType}`);
  }

  // Personal Project fields
  if (input.personalInterest) {
    fields.push(`- Personal Interest: ${input.personalInterest}`);
  }
  if ((input as any).goalType) {
    fields.push(`- Goal Type: ${(input as any).goalType}`);
  }
  if ((input as any).presentationFormat) {
    fields.push(`- Presentation Format: ${(input as any).presentationFormat}`);
  }

  // Inquiry fields
  if (input.centralIdea) {
    fields.push(`- Central Idea: ${input.centralIdea}`);
  }
  if ((input as any).transdisciplinaryTheme) {
    fields.push(`- Transdisciplinary Theme: ${(input as any).transdisciplinaryTheme}`);
  }
  if ((input as any).linesOfInquiry?.length) {
    fields.push(`- Lines of Inquiry: ${(input as any).linesOfInquiry.join(", ")}`);
  }

  return fields.length > 0 ? `\n## Unit-Specific Context\n${fields.join("\n")}` : "";
}

/**
 * Build the user prompt for multi-option outline generation.
 *
 * @param input              The wizard input containing unit context
 * @param ragContext         Optional RAG-retrieved context
 * @param curriculumContext  Optional curriculum context
 * @param framework          The curriculum framework (e.g., "IB_MYP", "GCSE_DT")
 */
export function buildOutlinePrompt(
  input: UnitWizardInput,
  ragContext?: string,
  curriculumContext?: string,
  framework?: string
): string {
  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const curriculumSection = curriculumContext
    ? `\nCurriculum Context: ${curriculumContext}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration for creating diverse, high-quality approaches.\n`
    : "";

  const frameworkBlock = buildFrameworkPromptBlock(framework);

  // Build page specification from selected criteria and emphasis
  const pageDefs = buildPageDefinitions(input.selectedCriteria, input.criteriaFocus, input.unitType || "design");
  const totalPages = pageDefs.length;
  const pageSpec = (input.selectedCriteria || []).map(c => {
    const emphasis = (input.criteriaFocus || {})[c] || "standard";
    const count = EMPHASIS_PAGE_COUNT[emphasis];
    const pageIds = Array.from({ length: count }, (_, i) => `${c}${i + 1}`);
    const cDef = getCriterion(c, input.unitType || "design");
    return `- Criterion ${c} (${cDef?.name || c}): ${count} pages (${pageIds.join(", ")})`;
  }).join("\n");

  const criteriaFocusStr = (input.selectedCriteria || [])
    .map(c => `${c}=${(input.criteriaFocus || {})[c] || "standard"}`)
    .join(", ");

  const unitTypeLabel = input.unitType && input.unitType !== "design"
    ? { service: "Service Learning", personal_project: "Personal Project", inquiry: "Inquiry" }[input.unitType] || "Design"
    : "MYP Design";
  return `${frameworkBlock ? `${frameworkBlock}\n\n` : ""}Generate 3 distinct unit outline options for the following ${unitTypeLabel} unit:
${ragSection}
## Unit Context
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${curriculumSection}${buildTypeSpecificContext(input)}${buildContextInjection(input)}
- Criteria Focus: ${criteriaFocusStr}

## Page Structure (${totalPages} pages total)
${pageSpec}

Generate 3 genuinely different approaches. Each MUST cover exactly these ${totalPages} pages with the page IDs specified above.`;
}

/**
 * System prompt for the wizard suggestion endpoint.
 * Embeds valid MYP option lists so AI can only suggest valid values.
 */
export function buildSuggestSystemPrompt(framework?: string): string {
  const frameworkBlock = buildFrameworkPromptBlock(framework);

  return `You are a curriculum advisor for design and technology education. Given a topic and partial unit context, suggest the most relevant framework elements AND practical teaching ideas.${frameworkBlock}

VALID GLOBAL CONTEXTS (use exact labels):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (use exact values):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

Rules:
1. For globalContext and keyConcept, ONLY use the exact values listed above
2. For activities, tools, groupwork, and resources — suggest real, specific, practical ideas relevant to the topic (not from a fixed list)
3. Activities should be specific teaching activities (e.g., "SCAMPER brainstorm", "Gallery walk critique", "See-Think-Wonder analysis")
4. Tools should be specific software, platforms, or equipment students would use (e.g., "TinkerCAD", "Canva", "laser cutter", "Arduino")
5. Groupwork should describe specific collaborative structures (e.g., "Pair sketching", "Expert jigsaw", "Design critique circles")
6. Resources should be types of external content to include (e.g., "YouTube tutorial", "Industry case study", "Interactive demo")
7. Rank by relevance to the topic and grade level
8. For Statement of Inquiry, follow the formula: Key Concept + Related Concept(s) + Global Context woven into a single exploratory sentence
9. Keep JSON output minimal — no explanations outside JSON
10. Output ONLY valid JSON matching the requested schema`;
}

export interface SuggestContext {
  topic: string;
  title?: string;
  gradeLevel?: string;
  globalContext?: string;
  keyConcept?: string;
  relatedConcepts?: string[];
  statementOfInquiry?: string;
  /** Keywords already placed into buckets — AI should suggest complementary ones */
  placedKeywords?: string[];
}

export function buildSuggestPrompt(tier: 1 | 2 | 3, context: SuggestContext): string {
  const exclude: string[] = [];
  if (context.globalContext) exclude.push(`Already chosen globalContext: "${context.globalContext}"`);
  if (context.keyConcept) exclude.push(`Already chosen keyConcept: "${context.keyConcept}"`);
  if (context.relatedConcepts?.length)
    exclude.push(`Already chosen relatedConcepts: ${context.relatedConcepts.map((r) => `"${r}"`).join(", ")}`);

  if (context.placedKeywords?.length) {
    exclude.push(`Already placed keywords: ${context.placedKeywords.map((k) => `"${k}"`).join(", ")}`);
  }

  const excludeSection = exclude.length > 0 ? `\nDo NOT repeat these (already selected):\n${exclude.join("\n")}` : "";
  const complementSection = context.placedKeywords?.length
    ? `\nThe teacher has already chosen: ${context.placedKeywords.join(", ")}. Suggest COMPLEMENTARY items that pair well with these choices — different activities, tools, or resources that fill gaps.`
    : "";

  let schema = "";
  if (tier === 1) {
    schema = `{
  "globalContext": ["top pick", "2nd pick"],
  "keyConcept": ["top pick", "2nd pick"],
  "activities": ["specific activity 1", "specific activity 2", "specific activity 3"],
  "tools": ["specific tool or platform 1", "specific tool 2"],
  "groupwork": ["collaborative structure 1", "collaborative structure 2"],
  "resources": ["resource type 1", "resource type 2"]
}`;
  } else if (tier === 2) {
    schema = context.keyConcept
      ? `{ "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`
      : `{ "keyConcept": ["top pick", "2nd pick"], "relatedConcepts": ["top pick", "2nd pick", "3rd pick"] }`;
  } else {
    schema = `{ "statementOfInquiry": "One exploratory sentence connecting key concept, related concepts, and global context", "assessmentEmphasis": [{ "criterion": "string — use the assessment framework in use (e.g. 'A', 'B', 'AO1', 'IPARD-I')", "direction": "emphasis"|"light", "reason": "short reason" }] }`;
  }

  return `Topic: "${context.topic}"
Title: "${context.title || ""}"
Grade: ${context.gradeLevel || "Year 3 (Grade 8)"}
${excludeSection}${complementSection}

Return JSON matching this schema:
${schema}`;
}

// --- Auto-config prompt (Build for Me mode) ---

import { DESIGN_SKILLS, MYP_ATL_SKILL_CATEGORIES } from "@/lib/constants";

export function buildAutoconfigSystemPrompt(framework?: string): string {
  const frameworkBlock = buildFrameworkPromptBlock(framework);
  const criteriaKeys = framework ? getFrameworkCriterionKeys(framework) : ["A", "B", "C", "D"];
  const criteriaExample = criteriaKeys.length === 4
    ? `["${criteriaKeys[0]}","${criteriaKeys[1]}","${criteriaKeys[2]}","${criteriaKeys[3]}"]`
    : `[${criteriaKeys.map(k => `"${k}"`).join(",")}]`;

  return `You are an expert curriculum advisor for design and technology education. Given a teacher's end-goal description and optional keyword tags, determine ALL the framework elements needed to build a unit.${frameworkBlock}

VALID GLOBAL CONTEXTS (pick exactly 1, use exact label):
${MYP_GLOBAL_CONTEXTS.map((gc) => `- "${gc.label}"`).join("\n")}

VALID KEY CONCEPTS (pick exactly 1, use exact value):
${MYP_KEY_CONCEPTS.map((kc) => `- "${kc}"`).join("\n")}

VALID RELATED CONCEPTS for Design (pick 2-3, use exact values):
${MYP_RELATED_CONCEPTS_DESIGN.map((rc) => `- "${rc}"`).join("\n")}

VALID DESIGN SKILLS (pick 1-3 that match the project):
${(DESIGN_SKILLS as readonly string[]).map((s) => `- "${s}"`).join("\n")}

VALID ATL SKILL CATEGORIES:
${MYP_ATL_SKILL_CATEGORIES.map((cat) => `- ${cat.category}: ${cat.skills.join(", ")}`).join("\n")}

Rules:
1. ONLY use exact values from the lists above
2. Generate a concise unit title (5-8 words)
3. The topic should expand on the teacher's goal text into a clear description
4. Statement of Inquiry must weave Key Concept + Related Concepts + Global Context into one exploratory sentence
5. criteriaFocus: consider the project type. Heavy research → emphasize ${criteriaKeys[0]}. Heavy making → emphasize ${criteriaKeys[2]}. Heavy evaluation → emphasize ${criteriaKeys[3]}. Default to "standard" for balanced projects.
6. selectedCriteria: include all criteria by default ${criteriaExample}. For short units (4 weeks or less), consider dropping a criterion. For focused projects, consider using only 2-3 criteria.
7. Output ONLY valid JSON — no markdown, no explanations`;
}

export function buildAutoConfigPrompt(
  goalText: string,
  gradeLevel: string,
  durationWeeks: number,
  keywords: string[]
): string {
  const keywordsSection = keywords.length > 0
    ? `\nTeacher-pinned keywords: ${keywords.join(", ")}`
    : "";

  return `Teacher's goal: "${goalText}"
Grade: ${gradeLevel}
Duration: ${durationWeeks} weeks${keywordsSection}

Return JSON matching this exact schema:
{
  "title": "Short unit title",
  "topic": "Expanded topic description",
  "globalContext": "One of the valid global contexts",
  "keyConcept": "One of the valid key concepts",
  "relatedConcepts": ["concept1", "concept2"],
  "statementOfInquiry": "One exploratory sentence",
  "selectedCriteria": ["A", "B", "C", "D"],
  "criteriaFocus": { "A": "standard|emphasis|light", "B": "...", "C": "...", "D": "..." },
  "atlSkills": ["skill1", "skill2"],
  "specificSkills": ["design skill 1"]
}`;
}

// =========================================================================
// JOURNEY MODE — Continuous Learning Journey Generation
// =========================================================================

/**
 * System prompt for journey-mode generation.
 * Frames the unit as one continuous learning journey working backwards
 * from the end goal, broken into lesson-length blocks.
 */
export const JOURNEY_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content structured as a continuous learning journey.

## Core Principle: Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Your job is to work BACKWARDS from that goal to design a coherent sequence of lessons that gets students there. Every lesson exists because it contributes to reaching the end goal.

## Unit Structure
The unit is a sequence of LESSON BLOCKS. Each lesson is a fixed length (specified in the prompt). Lessons flow continuously — there are no structural breaks between "criteria" or "phases". Instead, each lesson naturally builds on the previous one.

## Assessment Criteria as Tags
The prompt specifies which assessment criteria exist (e.g. A, B, C, D for MYP Design). You MUST tag every activity section with the criteria it addresses using "criterionTags": ["A"] or ["B", "C"]. Criteria are metadata — they tell the teacher which assessment strand an activity contributes to. They do NOT control lesson structure.

A single lesson might touch multiple criteria. For example:
- Researching materials (A) → sketching initial ideas (B) in one lesson
- Building a prototype (C) → testing it (D) in another
- Evaluating results (D) while planning iterations (B) in another

## Lesson Flow Grammar
Follow these principles for sequencing across the unit:

### Bloom's Progression
Early lessons start at Remember/Understand (research, vocabulary, analysis of existing products).
Middle lessons progress to Apply/Analyse (ideation, planning, skill-building).
Later lessons reach Evaluate/Create (making, testing, evaluating, iterating).

### Scaffolding Fade
Lesson 1-2: Heavy scaffolding (sentence starters, worked examples, structured templates).
Middle lessons: Moderate scaffolding (some sentence starters, reference to earlier work).
Final lessons: Minimal scaffolding (extension prompts only, students work independently).

### Energy & Pacing
Each lesson has an energy arc: calm focus (warm-up) → active engagement (core tasks) → reflection.
Across the unit: build from curious exploration → creative energy → productive struggle → celebratory completion.

### Continuity
Each lesson's introduction should reference what was achieved in the previous lesson.
Each lesson should end by previewing what comes next.
The final lesson should circle back to the original goal.

## Timing & Lesson Structure
Each lesson follows a structured phase model appropriate to its type (the timing context below specifies the exact structure). Follow the provided timing constraints precisely.

IMPORTANT: Include "timeWeight" (quick | moderate | extended | flexible) on EVERY section. This controls proportional time allocation — quick ≈ 5 min, moderate ≈ 10-15 min, extended ≈ 20+ min. You may ALSO set "durationMinutes" when exact timing is critical (e.g. safety demo = exactly 5 min), but timeWeight is the primary signal. Phase durations should still sum to the USABLE time.

The main work block should be ONE sustained block. Do NOT split it into small activities.

## JSON Schema (for each lesson page)
{
  "[LessonId]": {
    "title": "Short descriptive lesson title",
    "learningGoal": "Clear learning objective for this lesson",
    "workshopPhases": {
      "opening": { "durationMinutes": 5, "hook": "Brief description of the opening hook/question" },
      "miniLesson": { "durationMinutes": 12, "focus": "The ONE skill or concept being taught" },
      "workTime": { "durationMinutes": 38, "focus": "What students are doing during sustained work", "checkpoints": ["Check-in prompt at midpoint"] },
      "debrief": { "durationMinutes": 5, "protocol": "i-like-i-wish|two-stars-a-wish|exit-ticket|gallery-walk|quick-share", "prompt": "Structured debrief prompt" }
    },
    "vocabWarmup": {
      "terms": [
        { "term": "Word", "definition": "Clear definition", "example": "Usage example" }
      ],
      "activity": {
        "type": "matching|fill-blank|drag-sort",
        "items": [{ "question": "Match prompt", "answer": "Correct answer" }]
      }
    },
    "introduction": {
      "text": "Introduction connecting to prior learning and previewing this lesson"
    },
    "sections": [
      {
        "prompt": "Clear, engaging task for the student",
        "criterionTags": ["A"],
        "durationMinutes": 15,
        "scaffolding": {
          "ell1": { "sentenceStarters": [...], "hints": [...] },
          "ell2": { "sentenceStarters": [...] },
          "ell3": { "extensionPrompts": [...] }
        },
        "responseType": "text|upload|voice|link|multi|decision-matrix|pmi|pairwise|trade-off-sliders",
        "exampleResponse": "Model response showing quality expectations",
        "portfolioCapture": true
      }
    ],
    "reflection": {
      "type": "confidence-slider|checklist|short-response",
      "items": ["I understand the task", "I can explain my reasoning"]
    },
    "extensions": [
      {
        "title": "Short descriptive title",
        "description": "What the student does and why it deepens their work",
        "durationMinutes": 20,
        "designPhase": "investigation|ideation|prototyping|evaluation"
      }
    ]
  }
}

## Important Rules
1. ALWAYS include ELL scaffolding (ell1, ell2, ell3) for EVERY section
2. ALWAYS include criterionTags on EVERY section — at least one criterion per section
3. ALWAYS include timeWeight on EVERY section (quick | moderate | extended | flexible). Only add durationMinutes when exact timing is critical.
4. ALWAYS include workshopPhases with realistic durations that match the timing constraints
5. ALWAYS include 2-3 extensions per lesson matching the current design phase
6. Include 3-5 vocab terms per lesson, relevant to the lesson's focus
7. Include 1-3 activity sections per lesson that fit within the Work Time phase (do not fragment into many small tasks)
8. Vary responseType across sections: "text", "upload", "link", "multi", and for decision tasks use "decision-matrix", "pmi", "pairwise", or "trade-off-sliders"
9. Make content age-appropriate for the specified grade level
10. Connect content to the specified global context and key concept
11. Include practical, hands-on activities where relevant
12. Vocab activity type can be: "matching", "fill-blank", or "drag-sort"
13. Reflection type can be: "confidence-slider", "checklist", or "short-response". Reflection items MUST include at least one emotion-aware prompt (e.g., "How did this activity make you feel?" or "What was frustrating or exciting about this?"). Research shows emotion regulation (d=0.53) is a stronger predictor of learning than cognitive ability alone. Naming feelings normalises struggle and builds metacognitive awareness. NEVER use ability-framing in reflections ("How well did you do?") — use growth-framing ("What did you learn about yourself as a designer?")
14. When appropriate, incorporate design thinking frameworks (SCAMPER, Six Thinking Hats, PMI, Empathy Map, Decision Matrix, etc.) — adapt them to the specific topic
15. Set "portfolioCapture": true on 1-2 sections per lesson that represent substantive design work (analysis, sketches, justifications, creation evidence, evaluations)
16. Each lesson should be SELF-CONTAINED enough to work as a single class period, but CONNECTED enough that the unit tells a coherent story
17. The first lesson should hook students with the end goal and build excitement
18. The final lesson should include completion, presentation, or celebration of the end product
19. Workshop model: section durations should fit WITHIN the Work Time phase. Opening/vocabWarmup/introduction = Opening + Mini-Lesson phases. Sections = Work Time phase. Reflection = Debrief phase.

## Evidence-Based Teaching Strategies (MUST follow)
Based on Hattie's Visible Learning research and Victorian HITS:

### Productive Failure (d=0.82 scaffolding)
- Include at least one activity where students can safely fail and learn from it
- Follow failure with structured reflection: "What went wrong? What did you learn? What will you change?"
- Frame failure positively: "Testing reveals opportunities, not mistakes"

### Critique Culture (d=0.73 feedback)
- Embed at least one peer feedback or self-assessment section per 3 lessons
- Use structured protocols: Two Stars & a Wish, Gallery Walk, TAG feedback
- Provide sentence starters for constructive critique in scaffolding

### Digital + Physical Balance (d=0.57 worked examples)
- Mix screen-based and hands-on activities across the unit
- Don't front-load ALL research/digital then ALL making — interleave where possible
- For making lessons: include a digital planning step before physical construction

### Safety Culture
- For ANY lesson involving tools, materials, or equipment: include safety in the introduction or as a content section
- Safety should be woven naturally into the activity, not as a separate slide
- For skills-demo lessons: safety briefing is part of the modelling phase

### Spaced Retrieval (d=0.71)
- Vocab warm-ups should spiral back to terms and skills from EARLIER lessons (not just the previous one)
- Include retrieval starters: quick-sketch, term matching, "recall 3 things from Lesson 2"
- Prioritise OLDER items for maximum spacing effect

### Self-Assessment Prediction (d=1.44)
- At criterion phase boundaries (last lesson before moving to next criterion focus), include a self-prediction reflection
- "Look at the Criterion [X] rubric. What level do you think you've achieved? Circle and explain why."
- The final lesson should include comprehensive self-assessment across all criteria

### Compare/Contrast Frameworks (d=1.61)
- For research/investigation sections, use structured comparison templates
- Side-by-side analysis with guided questions: features, user needs, strengths, limitations
- Use responseType "decision-matrix" or "pmi" for comparison activities`;

/**
 * Build the user prompt for journey-mode lesson generation.
 *
 * @param lessonIds   Which lessons to generate (e.g. ["L01","L02","L03","L04","L05","L06"])
 * @param input       Journey input with end goal, weeks, lesson config
 * @param options     Optional context: outline, activity cards, RAG, framework
 */
export function buildJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: JourneyOutlineOption | null;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    batchIndex?: number;
    previousLessonSummary?: string;
    teachingContextBlock?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
    framework?: string;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Build outline context for this batch
  let outlineSection = "";
  if (options?.selectedOutline) {
    const relevantLessons = options.selectedOutline.lessonPlan
      .filter((l) => lessonIds.includes(l.lessonId));
    if (relevantLessons.length > 0) {
      outlineSection = `\n## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Follow this outline closely for each lesson:
${relevantLessons.map((l) => `  - ${l.lessonId}: "${l.title}" — ${l.summary} [${l.criterionTags.join(", ")}]`).join("\n")}
`;
    }
  }

  // Context from previous batch
  const continuitySection = options?.previousLessonSummary
    ? `\n## Previously Generated Lessons
${options.previousLessonSummary}
Continue the learning journey from where the previous lessons left off.
`
    : "";

  // RAG context sections
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";
  const frameworkBlock = buildFrameworkPromptBlock(options?.framework);
  const frameworkSection = frameworkBlock ? `${frameworkBlock}\n\n---\n\n` : "";

  return `${frameworkSection}${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${outlineSection}
## Available Activity Cards
Consider incorporating these activity cards where appropriate. Pick the most relevant for each lesson and weave them naturally into section prompts:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons total)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each section with the relevant criteria)${input.curriculumContext ? `\n- Curriculum Context: ${input.curriculumContext}` : ""}${buildTypeSpecificContext(input)}${buildContextInjection(input)}

${buildTeachingContext(input.unitType || "design", options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes, undefined, input.unitType)}

## Lessons to Generate
Generate these ${lessonIds.length} lessons (of ${totalLessons} total):
${lessonIds.map((id) => {
  const lessonNum = parseInt(id.replace("L", ""), 10);
  return `  - ${id}: Lesson ${lessonNum} of ${totalLessons}`;
}).join("\n")}

${lessonIds[0] === "L01" ? "This is the FIRST batch — Lesson 1 should hook students with the end goal and build excitement about the project." : ""}
${lessonIds.includes(`L${String(totalLessons).padStart(2, "0")}`) ? "This batch includes the FINAL lesson — it should include completion, presentation, or celebration of the end product." : ""}

Remember:
- Each lesson is exactly ${input.lessonLengthMinutes} minutes
- Tag EVERY section with criterionTags (${(input.assessmentCriteria || []).join(", ")})
- Include ELL scaffolding (ell1, ell2, ell3) for every section
- Build on what came before, preview what comes next`;
}

/**
 * Build a RAG-enriched journey prompt.
 * Retrieves lesson profiles and knowledge chunks WITHOUT criterion filtering.
 *
 * @param lessonIds              Which lessons to generate (e.g., ["L01","L02","L03"])
 * @param input                  Journey input with end goal, weeks, lesson config
 * @param teacherId              Optional teacher ID for RAG retrieval filtering
 * @param selectedOutline        Optional outline to include in the prompt
 * @param previousLessonSummary  Optional context from earlier batch
 * @param teachingContext        Optional teaching context with framework vocab
 * @param framework              The curriculum framework (e.g., "IB_MYP", "GCSE_DT")
 */
export async function buildRAGJourneyPrompt(
  lessonIds: string[],
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: JourneyOutlineOption | null,
  previousLessonSummary?: string,
  teachingContext?: PartialTeachingContext | null,
  framework?: string
): Promise<{ prompt: string; chunkIds: string[] }> {
  // Fetch enriched activity card summary from DB (all categories, no criterion filter)
  let activitySummary: string | undefined;
  try {
    activitySummary = await getActivityCardSummaryEnriched();
  } catch {
    // DB unavailable — will fall back to hardcoded
  }

  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  // Retrieve relevant context from knowledge base (no criterion filter)
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let lessonContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    });

    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback
  let feedbackContext = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query: `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });

    if (profiles.length > 0) {
      lessonContext = formatLessonProfiles(profiles);
      const profileIds = profiles.map((p) => p.id);
      incrementProfileReferences(profileIds).catch(() => {});

      // Close the feedback loop: inject real teaching experience
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackContext = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement, not requirement
      }
    }
  } catch {
    // Lesson profiles are enhancement, not requirement
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  // Load teacher style profile for personalized generation
  let teacherStyle: TeacherStyleProfile | null = null;
  if (teacherId) {
    try {
      const { loadStyleProfile } = await import("@/lib/teacher-style/profile-service");
      teacherStyle = await loadStyleProfile(teacherId);
    } catch { /* non-fatal */ }
  }

  const prompt = buildJourneyPrompt(lessonIds, input, {
    selectedOutline,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousLessonSummary,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
    teacherStyleProfile: teacherStyle || undefined,
    framework,
  });

  return { prompt, chunkIds };
}

/**
 * System prompt for journey-mode outline generation.
 */
export const JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design 3 genuinely different lesson sequences that work backwards from that goal.

Each outline is a sequence of lessons (not grouped by criteria). Each lesson has a primary focus and the assessment criteria it will address.

Output valid JSON matching this schema:
{
  "options": [
    {
      "approach": "Short name (e.g., 'Rapid Prototype First')",
      "description": "2-3 sentences on what makes this approach distinctive",
      "strengths": ["Strength 1", "Strength 2"],
      "lessonPlan": [
        {
          "lessonId": "L01",
          "title": "Lesson title",
          "summary": "One-sentence description of what students do",
          "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
          "criterionTags": ["A"]
        }
      ]
    }
  ]
}

Rules:
1. Generate exactly 3 options
2. Each option MUST have exactly the number of lessons specified
3. Options must be genuinely different — vary entry points, sequencing, project approaches
4. A lesson can address multiple criteria (criterionTags: ["B", "C"])
5. Ensure ALL specified criteria appear across the unit (every criterion must be tagged at least once)
6. The first lesson should hook students; the last should celebrate the outcome
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for journey-mode outline generation.
 */
export function buildJourneyOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct lesson journey outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${buildContextInjection(input)}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate outlines for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

Generate 3 genuinely different approaches. Each MUST include exactly ${totalLessons} lessons.`;
}

// =========================================================================
// Journey Mode — Single outline generation (for "suggest another" feature)
// =========================================================================

export const SINGLE_JOURNEY_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a continuous learning journey.

The teacher has an END GOAL — the final product or outcome students must achieve. You design a single lesson sequence that works backwards from that goal.

Output valid JSON matching this schema:
{
  "approach": "Short name (e.g., 'Rapid Prototype First')",
  "description": "2-3 sentences on what makes this approach distinctive",
  "strengths": ["Strength 1", "Strength 2"],
  "lessonPlan": [
    {
      "lessonId": "L01",
      "title": "Lesson title",
      "summary": "One-sentence description of what students do",
      "primaryFocus": "Research|Ideation|Planning|Skill Building|Making|Testing|Iteration|Evaluation|Presentation",
      "criterionTags": ["A"]
    }
  ]
}

Rules:
1. Generate exactly 1 option (NOT wrapped in an "options" array)
2. The option MUST have exactly the number of lessons specified
3. A lesson can address multiple criteria (criterionTags: ["B", "C"])
4. Ensure ALL specified criteria appear across the unit
5. The first lesson should hook students; the last should celebrate the outcome
6. Output ONLY valid JSON — no markdown, no explanations`;

export function buildSingleJourneyOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const lessonIds = Array.from({ length: totalLessons }, (_, i) =>
    `L${String(i + 1).padStart(2, "0")}`
  );

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 lesson journey outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${buildContextInjection(input)}
- Assessment Criteria to Tag: ${(input.assessmentCriteria || []).join(", ")}

## Lesson IDs
Generate an outline for exactly ${totalLessons} lessons with IDs: ${lessonIds.join(", ")}

## Requirements
- ${angleHint}
- Be genuinely creative and distinctive${avoidSection}`;
}

// =========================================================================
// Timeline Mode — Flat activity sequence
// =========================================================================

/**
 * System prompt for timeline-mode generation.
 * Activities are a flat sequence; lesson boundaries are computed from duration.
 */
export const TIMELINE_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. You create engaging, differentiated unit content as a continuous timeline of activities.

## Core Principle: Continuous Timeline
Instead of creating fixed lessons, you generate a FLAT SEQUENCE of activities for the entire unit. Lesson boundaries are computed automatically from activity durations and the school's lesson length. An activity that doesn't fit in the remaining time slides whole to the next lesson.

## Backward Design
You are given an END GOAL — the final product or outcome students must achieve. Work BACKWARDS from that goal to design a coherent activity sequence.

## Activity Roles
Every activity has a "role":
- **warmup**: Vocabulary warm-up (include vocabTerms). Place one roughly every [lessonLength] minutes.
- **intro**: Introduction connecting to prior learning. Place one after each warmup.
- **core**: Main student tasks — the heart of the unit. Most activities are core.
- **content**: Pure information — no student response required. Omit responseType. Use contentStyle to visually categorise the block:
  - "info" (blue) — key concepts, facts, definitions
  - "warning" (amber) — safety warnings, cautions, things to watch out for
  - "tip" (green) — pro tips, teacher advice, best practices
  - "context" (gray) — background context, transitions between activities
  - "activity" (purple) — group/classroom activities (think-pair-share, gallery walk, peer review)
  - "speaking" (indigo) — discussion prompts, presentations, verbal sharing
  - "practical" (orange) — hands-on making, building, prototyping, physical tasks
  Choose the most specific style. Use "activity"/"speaking"/"practical" when the block describes what students DO physically — these help students quickly see the type of work at a glance. Include media (image/video URLs) or links (external tool URLs with labels) where visual reference or tool access helps.
- **reflection**: Self-assessment at natural breakpoints. Place one roughly every [lessonLength] minutes.

## Rich Content
- **media**: Include image or video URLs where visual reference helps. Use standard YouTube/Vimeo watch URLs (auto-converted to embeds). Set type to "image" or "video".
- **links**: Include external tool links with clear labels, e.g. { url: "https://tinkercad.com", label: "Open TinkerCAD" }. Displayed as action buttons.
- **markdown**: Prompts support basic markdown: **bold**, *italic*, [links](url). Use sparingly for emphasis.

## Phase Labels
Group activities into phases using "phaseLabel" (e.g., "Research", "Ideation", "Prototyping", "Evaluation"). Activities in the same phase share a phaseLabel. This helps teachers see the arc.

## Assessment Criteria as Tags
Tag every CORE activity with criterionTags (e.g. ["A"], ["B","C"]). Warmup/intro/reflection activities can omit tags.

## Timing Awareness
- Total duration of ALL activities ≈ totalLessons × lessonLengthMinutes
- Each activity has a timeWeight (quick | moderate | extended | flexible). Only add durationMinutes when exact timing is critical.
- The prompt below provides USABLE time (after transition/setup/cleanup overhead) — never generate for the raw period length
- The prompt below provides age-appropriate timing constraints based on the students' grade level — core activity durations MUST respect the maximum for the grade
- Place warmup+intro+reflection bookends at approximately every [lessonLength] minutes of cumulative core time
- Within each lesson-length chunk, use a structured phase model: opening → instruction/demo → sustained work → closing/reflection
- The main work block should be ONE sustained block — do NOT fragment it into many small 5-10 minute activities
- ALWAYS include 2-3 extension activities per lesson-length chunk for early finishers, indexed to the current design phase

## Activity Ordering (PREFERRED)
Within each lesson-length chunk, activities should generally follow this sequence (adapt if Activity Blocks or lesson type suggests a different flow):
1. **warmup** activity (vocab retrieval, engagement hook) — typically first
2. **intro** / **content** activities (connecting to prior learning, new concepts, teacher modelling)
3. **core** activities (sustained student work — the bulk of the lesson)
4. **reflection** activity (exit ticket, debrief, one-word whip, self-assessment) — ALWAYS LAST

NEVER place exit activities, reflections, debrief activities, or "lesson exit" activities in the MIDDLE of a lesson. They MUST be the final activity/activities in the sequence. If an activity title contains "exit", "debrief", "whip-around", "closing", or "wrap-up", it belongs at the END, not in the middle.

## Sequencing
### Bloom's Progression
Early: Remember/Understand (research, vocabulary, existing product analysis)
Middle: Apply/Analyse (ideation, planning, skill-building)
Later: Evaluate/Create (making, testing, evaluating, iterating)

### Scaffolding Fade
Early activities: Heavy scaffolding (sentence starters, worked examples, templates)
Middle: Moderate scaffolding
Late: Minimal scaffolding (extension prompts only)

### Energy & Pacing
Build from curious exploration → creative energy → productive struggle → celebratory completion

## Rules
1. Include ELL scaffolding (ell1, ell2, ell3) for EVERY core activity
2. Tag every core activity with criterionTags
3. Include timeWeight on EVERY activity (quick | moderate | extended | flexible). Only add durationMinutes when exact timing is critical.
4. Vary responseType across activities
5. Set portfolioCapture: true on 1-2 core activities per ~lesson-length of time
6. First activities should hook students with the end goal
7. Final activities should include completion/celebration of the end product
8. Give each activity a unique short ID (a1, a2, a3, ...)
9. Add teacherNotes to at least 2 core activities per lesson-length with: circulation questions at different cognitive levels, safety reminders for hands-on activities, differentiation tips

## Evidence-Based Teaching Strategies (MUST follow)
Based on Hattie's Visible Learning research and Victorian HITS:

### Productive Failure (d=0.82)
- Design at least one activity where students can safely fail and learn from it
- Follow failure with structured reflection: "What went wrong? What did you learn? What will you change?"
- Frame failure positively: "Testing reveals opportunities, not mistakes"

### Critique Culture (d=0.73)
- Embed at least one peer feedback or self-assessment activity per 3 lessons-worth of activities
- Use structured protocols: Two Stars & a Wish, Gallery Walk, TAG feedback
- Provide sentence starters for constructive critique

### Digital + Physical Balance
- Mix screen-based and hands-on activities within the unit
- Don't front-load ALL research/digital then ALL making — interleave where possible
- For making activities: include a digital planning step before physical construction

### Safety Culture
- For ANY activity involving tools, materials, or equipment: include safety in teacherNotes
- Safety should be woven naturally into the activity, not as a separate slide
- For skills demos: safety briefing is part of the content/intro activity

### Spaced Retrieval (d=0.71)
- Warmup activities should spiral back to vocabulary and skills from EARLIER lessons (not just the previous one)
- Include retrieval starters: quick-sketch, term matching, "recall 3 things from L02"
- Prioritise OLDER items for maximum spacing effect — retrieving L01 content in L05 is more powerful than retrieving L04 content

### Self-Assessment Prediction (d=1.44)
- At criterion phase boundaries (last lesson before moving to next criterion focus), include a self-prediction activity
- "Look at the Criterion [X] rubric. What level do you think you've achieved? Circle and explain why."
- The final lesson should include comprehensive self-assessment across all criteria

### Compare/Contrast Frameworks (d=1.61)
- For research/investigation activities, use structured comparison templates
- Side-by-side analysis with guided questions: features, user needs, strengths, limitations
- Use responseType "decision-matrix" or "pmi" for these activities`;

/**
 * Build the user prompt for timeline-mode activity generation.
 */
export function buildTimelinePrompt(
  input: LessonJourneyInput,
  options?: {
    selectedOutline?: TimelineOutlineOption | null;
    phaseToGenerate?: TimelinePhase;
    activitySummary?: string;
    ragContext?: string;
    lessonContext?: string;
    totalLessons?: number;
    previousActivitiesSummary?: string;
    activitiesGeneratedSoFar?: number;
    teachingContextBlock?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
    activityBlocks?: string;
  }
): string {
  const totalLessons = options?.totalLessons || input.durationWeeks * input.lessonsPerWeek;
  const totalMinutes = totalLessons * input.lessonLengthMinutes;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const resourceSection = input.resourceUrls?.length > 0
    ? `\nReference Resources:\n${input.resourceUrls.map((url) => `  - ${url}`).join("\n")}`
    : "";

  // Phase-specific context
  let phaseSection = "";
  if (options?.phaseToGenerate) {
    const phase = options.phaseToGenerate;
    phaseSection = `
## Phase to Generate: "${phase.title}"
${phase.summary}
Primary Focus: ${phase.primaryFocus}
Criteria Emphasis: ${phase.criterionTags.join(", ")}
Estimated duration: ~${phase.estimatedLessons} lessons (${phase.estimatedLessons * input.lessonLengthMinutes} minutes of activities)

Generate activities for THIS PHASE ONLY. Include warmup/intro at the start and reflection at the end.`;
  } else if (options?.selectedOutline) {
    phaseSection = `
## Teacher's Chosen Approach: "${options.selectedOutline.approach}"
Phases:
${options.selectedOutline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [${p.criterionTags.join(", ")}]`).join("\n")}

Generate activities covering ALL phases.`;
  }

  // Context from previous generation
  const continuitySection = options?.previousActivitiesSummary
    ? `
## Previously Generated Activities
${options.previousActivitiesSummary}
Continue the activity sequence from where the previous batch left off.`
    : "";

  // RAG context + teaching context
  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";
  const contextBlock = options?.teachingContextBlock ? options.teachingContextBlock + "\n\n---\n\n" : "";

  return `${contextBlock}${lessonProfileSection}${ragSection}${continuitySection}${phaseSection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons, ${totalMinutes} total minutes)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${resourceSection}${requirementsSection}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")} (tag each core activity)${buildTypeSpecificContext(input)}${buildContextInjection(input)}

${buildTeachingContext(input.unitType || "design", options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes, undefined, input.unitType)}
${options?.activityBlocks ? "\n" + options.activityBlocks + "\n" : ""}
## Generation Target
Generate a flat list of activities. Total duration should be approximately ${totalMinutes} minutes.
Place warmup + intro + reflection bookends roughly every ${input.lessonLengthMinutes} minutes of content.
${options?.activitiesGeneratedSoFar ? `Activities generated so far: ${options.activitiesGeneratedSoFar}` : ""}

Remember:
- Every activity needs THREE slot fields (NOT a single prompt blob):
  · framing — ONE sentence (≤200 chars) orienting the student. Reads quietly as the lead.
  · task — the imperative body. Numbered list for discrete steps. ≤800 chars. NO \`###\` headings or \`| col | col |\` tables (renderer drops them). NO \`**Step 1:**\` bold sub-headings — use a numbered list instead.
  · success_signal — ONE sentence (≤200 chars) telling the student what to produce/record/submit/share. Use a clear production verb. ALWAYS PRESENT — infer one if exploratory.
  PLUS: id, role, title, timeWeight (quick | moderate | extended | flexible)
- Only add durationMinutes when exact timing is critical (safety demo, timed assessment)
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle (info/warning/tip/context/activity/speaking/practical), media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Use phaseLabel to group activities into coherent phases
- Include media (video/image URLs) and links (external tools) where they add value`;
}

/**
 * System prompt for timeline-mode outline generation.
 */
export const TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate unit outline options structured as phase-based timelines.

The teacher has an END GOAL. You design 3 genuinely different approaches, each described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 3 options
2. Each option has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Options must be genuinely different — vary entry points, sequencing, project approaches
5. Ensure ALL specified criteria appear across the phases
6. Include an estimatedActivityCount (typically 4-6 activities per lesson)
7. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build the user prompt for timeline-mode outline generation.
 */
export function buildTimelineOutlinePrompt(
  input: LessonJourneyInput,
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 3 distinct phase-based timeline outlines for the following unit:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${buildContextInjection(input)}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Each approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})
- Generate 3 genuinely different approaches`;
}

/**
 * System prompt for generating a SINGLE timeline outline approach.
 */
export const SINGLE_TIMELINE_OUTLINE_SYSTEM_PROMPT = `You are an expert Design curriculum designer. Generate ONE unit outline structured as a phase-based timeline.

The teacher has an END GOAL. You design a single approach described as a sequence of PHASES (not individual lessons). Phases are like chapters — "Research & Discovery", "Rapid Prototyping", "Testing & Iteration", etc.

Each phase specifies approximately how many lessons it spans, what the primary focus is, and which assessment criteria are emphasized.

Rules:
1. Generate exactly 1 approach
2. The approach has 3-5 phases
3. Phase estimatedLessons must sum to approximately the total lesson count
4. Ensure ALL specified criteria appear across the phases
5. Include an estimatedActivityCount (typically 4-6 activities per lesson)
6. Output ONLY valid JSON — no markdown, no explanations`;

/**
 * Build a user prompt for generating a SINGLE timeline outline with a given angle.
 */
export function buildSingleTimelineOutlinePrompt(
  input: LessonJourneyInput,
  angleHint: string,
  avoidApproaches: string[],
  ragContext?: string,
  teachingContextBlock?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  const avoidSection = avoidApproaches.length > 0
    ? `\n\nIMPORTANT: Do NOT use these approaches (already taken by other options): ${avoidApproaches.join(", ")}. Be genuinely different.`
    : "";

  const contextBlock = teachingContextBlock ? teachingContextBlock + "\n\n" : "";

  return `${contextBlock}Generate 1 phase-based timeline outline for the following unit, taking a **${angleHint}** angle:
${ragSection}
## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks
- Lessons Per Week: ${input.lessonsPerWeek}
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Total Lessons: ${totalLessons}
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${buildContextInjection(input)}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- ${angleHint}
- The approach should have 3-5 phases
- Phase estimatedLessons should sum to approximately ${totalLessons}
- estimatedActivityCount should be realistic (~4-6 activities per lesson, so roughly ${totalLessons * 5})${avoidSection}`;
}

/**
 * Build RAG-enhanced timeline prompt with knowledge base + lesson profiles.
 * Mirrors buildRAGJourneyPrompt but for timeline-mode generation.
 */
export async function buildRAGTimelinePrompt(
  input: LessonJourneyInput,
  teacherId?: string,
  selectedOutline?: TimelineOutlineOption | null,
  phaseToGenerate?: TimelinePhase,
  previousActivitiesSummary?: string,
  activitiesGeneratedSoFar?: number,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  // Parallelize all independent async lookups
  const stylePromise = teacherId
    ? import("@/lib/teacher-style/profile-service").then(m => m.loadStyleProfile(teacherId)).catch(() => null)
    : Promise.resolve(null);

  const timelineBlocksPromise = teacherId
    ? import("@/lib/activity-blocks").then(async (m) => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const blocks = await m.retrieveActivityBlocks(createAdminClient(), { query, teacherId, maxBlocks: 8 });
        return blocks.length > 0 ? m.formatBlocksAsPromptText(blocks) : "";
      }).catch(() => "")
    : Promise.resolve("");

  const [activityResult, chunksResult, profilesResult, teacherStyle, timelineBlocksResult] = await Promise.allSettled([
    getActivityCardSummaryEnriched(),
    retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 5,
    }),
    retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    }),
    stylePromise,
    timelineBlocksPromise,
  ]);

  const activitySummary = activityResult.status === "fulfilled" ? activityResult.value : undefined;
  const timelineBlocksText = timelineBlocksResult.status === "fulfilled" ? timelineBlocksResult.value : "";

  let ragContext = "";
  let chunkIds: string[] = [];
  if (chunksResult.status === "fulfilled" && chunksResult.value.length > 0) {
    ragContext = formatRetrievedContext(chunksResult.value);
    chunkIds = chunksResult.value.map((c) => c.id);
    recordRetrieval(chunkIds).catch(() => {});
  }

  let lessonContext = "";
  let feedbackContext = "";
  if (profilesResult.status === "fulfilled" && profilesResult.value.length > 0) {
    lessonContext = formatLessonProfiles(profilesResult.value);
    const profileIds = profilesResult.value.map((p) => p.id);
    incrementProfileReferences(profileIds).catch(() => {});

    // Close the feedback loop: inject real teaching experience
    try {
      const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
      if (aggregatedFeedback.length > 0) {
        feedbackContext = formatFeedbackContext(aggregatedFeedback);
      }
    } catch {
      // Feedback is enhancement, not requirement
    }
  }

  // Build teaching context + framework vocabulary blocks
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));

  const resolvedStyle = teacherStyle.status === "fulfilled" ? teacherStyle.value : null;

  const prompt = buildTimelinePrompt(input, {
    selectedOutline,
    phaseToGenerate,
    activitySummary,
    ragContext: ragContext || undefined,
    lessonContext: (lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "")) || undefined,
    totalLessons,
    previousActivitiesSummary,
    activitiesGeneratedSoFar,
    teachingContextBlock: (frameworkBlock + teachingContextBlock) || undefined,
    teacherStyleProfile: resolvedStyle || undefined,
    activityBlocks: timelineBlocksText || undefined,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// SKELETON GENERATION (Stage 1 — fast lesson-level outline before full activities)
// =========================================================================

/**
 * System prompt for skeleton generation.
 * Produces lesson titles, key questions, and timing — NOT full activities.
 */
export const SKELETON_SYSTEM_PROMPT = `You are an expert Design teacher and curriculum designer. Generate a LESSON SKELETON — a lightweight outline of every lesson in the unit.

## What You're Generating
For each lesson: a title, key driving question, estimated duration, phase label, assessment criteria emphasis, and 3-4 brief activity hints (one line each, not full activity details).

## Backward Design
The teacher has an END GOAL. Work backwards: what must students have completed by the last lesson? The second-to-last? Build a coherent learning arc.

## Rules
1. Lesson count and timing must match the unit duration
2. Every assessment criterion must appear across the lessons
3. Activity hints are brief suggestions, not detailed prompts (e.g., "Warmup: key vocab matching", "Core: user survey design")
4. Include warmup + reflection hints in each lesson (bookending the core)
5. Include a narrative arc — a 2-3 sentence summary of how the unit flows emotionally and intellectually
6. Phase labels should match the selected approach's phases
7. Early lessons: research, exploration, understanding. Middle: ideation, skill-building. Late: making, testing, presenting.
8. Output ONLY valid JSON — no markdown, no explanations

## Lesson Types (REQUIRED)
Classify each lesson as ONE of these Design lesson types:
- "research" — gathering info, analysis, product comparison, user interviews
- "ideation" — brainstorming, divergent thinking, sketching, SCAMPER, mind mapping
- "skills-demo" — teaching a tool/technique with I Do → We Do → You Do sequence
- "making" — extended hands-on creation, prototyping, building
- "testing" — testing prototypes, gathering user feedback, measuring, recording data
- "critique" — peer review, self-assessment, gallery walk, structured feedback

Each type has a DIFFERENT lesson structure:
- Research: mini-lesson → guided inquiry → independent analysis → share findings
- Ideation: stimulus → divergent (individual) → convergent (group) → select
- Skills-demo: safety/demo (I Do) → guided practice (We Do) → independent (You Do)
- Making: brief safety check → extended making (teacher circulates) → clean-up → reflection
- Testing: predict → test → record → analyse → iterate plan
- Critique: criteria reminder → gallery walk/peer critique → self-assess → goal-set

## Learning Intentions & Success Criteria (CRITICAL)
For EVERY lesson, generate:
- learningIntention: ONE clear sentence starting with "Students will..." — focused on PROCESS not content recall
  Good: "Students will analyse two existing products to identify design features that meet user needs"
  Bad: "Students will learn about user needs" (too vague)
- successCriteria: 2-3 OBSERVABLE criteria that show the intention was met
  Good: ["Identifies at least 3 design features per product", "Explains how each feature meets a specific user need", "Compares products using a structured framework"]
  Bad: ["Understands products"] (not observable)

Learning intentions must BACKWARD MAP from the unit end goal — each lesson's LI builds toward the final product.

## Cumulative Vocabulary & Skills Tracking (for Spaced Retrieval)
For EVERY lesson, list:
- cumulativeVocab: 2-4 KEY vocabulary terms introduced IN THIS LESSON (technical terms students must learn)
  Example L01: ["user need", "design brief", "target audience"]
  Example L02: ["ergonomic", "anthropometric data"]
- cumulativeSkills: 1-3 KEY skills/techniques introduced IN THIS LESSON
  Example L01: ["conducting user interviews", "writing a design brief"]
  Example L03: ["sketching isometric views", "annotating designs"]

These lists power spaced retrieval warm-ups — later lessons will quiz students on terms/skills from earlier lessons. Be specific: "CAD" is too vague, "creating a 2D sketch in Fusion 360" is good.`;

/**
 * Build the user prompt for skeleton generation.
 */
export function buildSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  ragContext?: string
): string {
  const totalLessons = input.durationWeeks * input.lessonsPerWeek;

  const skillsSection = input.specificSkills?.length > 0
    ? `\nSpecific Making Skills: ${input.specificSkills.join(", ")}`
    : "";

  const requirementsSection = input.specialRequirements
    ? `\nSpecial Requirements: ${input.specialRequirements}`
    : "";

  const ragSection = ragContext
    ? `\n${ragContext}\n\nUse the reference examples above as inspiration.\n`
    : "";

  return `Generate a lesson skeleton for the following unit:
${ragSection}
## Selected Approach: "${outline.approach}"
${outline.description}

Phases:
${outline.phases.map((p) => `  - ${p.title} (~${p.estimatedLessons} lessons): ${p.summary} [Criteria: ${p.criterionTags.join(", ")}]`).join("\n")}

## Unit Context
- End Goal: ${input.endGoal}
- Title: ${input.title}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Duration: ${input.durationWeeks} weeks (${totalLessons} lessons)
- Lesson Length: ${input.lessonLengthMinutes} minutes each
- Global Context: ${input.globalContext}
- Key Concept: ${input.keyConcept}
- Related Concepts: ${(input.relatedConcepts || []).join(", ")}
- Statement of Inquiry: ${input.statementOfInquiry}
- ATL Skills: ${(input.atlSkills || []).join(", ")}${skillsSection}${requirementsSection}${buildContextInjection(input)}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}

## Requirements
- Generate exactly ${totalLessons} lesson skeletons
- Each lesson gets estimatedMinutes of ${input.lessonLengthMinutes}
- Each lesson has 3-4 brief activity hints (one line each)
- Phase labels must match the approach phases above
- Criteria must be distributed across all lessons
- Include a narrativeArc summary (2-3 sentences)
- Each lesson MUST include lessonType, learningIntention, and successCriteria
- Each lesson MUST include cumulativeVocab (2-4 new terms) and cumulativeSkills (1-3 new skills)
- Learning intentions must backward-map from the end goal: "${input.endGoal}"
- Lesson types should be distributed — not all making or all research`;
}

/**
 * Build RAG-enhanced skeleton prompt.
 */
export async function buildRAGSkeletonPrompt(
  input: LessonJourneyInput,
  outline: TimelineOutlineOption,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  const query = `${input.topic} ${input.title} ${input.endGoal} ${input.gradeLevel}`;

  let ragContext = "";
  let chunkIds: string[] = [];

  try {
    const chunks = await retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    });
    if (chunks.length > 0) {
      ragContext = formatRetrievedContext(chunks);
      chunkIds = chunks.map((c) => c.id);
      recordRetrieval(chunkIds).catch(() => {});
    }
  } catch {
    // RAG is enhancement, not requirement
  }

  // Retrieve lesson profiles + aggregated feedback for skeleton context
  let feedbackBlock = "";
  try {
    const profiles = await retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 3,
    });
    if (profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      try {
        const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
        if (aggregatedFeedback.length > 0) {
          feedbackBlock = formatFeedbackContext(aggregatedFeedback);
        }
      } catch {
        // Feedback is enhancement
      }
    }
  } catch {
    // Enhancement
  }

  // Prepend teaching context + framework vocabulary + feedback
  const teachingContextBlock = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkBlock = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkBlock + teachingContextBlock + (feedbackBlock ? "\n\n" + feedbackBlock : "")).trim();
  const ragWithContext = contextPrefix
    ? contextPrefix + "\n\n---\n\n" + (ragContext || "")
    : ragContext || undefined;

  const prompt = buildSkeletonPrompt(input, outline, ragWithContext);
  return { prompt, chunkIds };
}

// =========================================================================
// LESSON TYPE GUIDANCE (HITS-informed structure per Design lesson type)
// =========================================================================

function getLessonTypeGuidance(type: DesignLessonType): string {
  // NOTE: Phase STRUCTURE is now handled by buildTimingBlock() via lesson-structures.ts.
  // This function provides PEDAGOGICAL TIPS only — teacher notes, activity hints, and
  // instructional strategies that complement (not contradict) the structure block.
  const guidance: Record<DesignLessonType, string> = {
    "research": `
Pedagogical tips for RESEARCH lessons:
- Include a content activity to model the analysis technique before students try it
- Core activities should use compare/contrast or structured investigation frameworks
- teacherNotes questions: "What patterns do you notice?", "How does this relate to your user's needs?", "What evidence supports that conclusion?"`,
    "ideation": `
Pedagogical tips for IDEATION lessons:
- Start with visual stimulus or constraint introduction — NOT a lecture
- Core activities: sketching, SCAMPER, mind mapping, brainstorming — keep these as LONG activities, don't fragment
- AI feedback must be DIVERGENT during ideation: "What else? Push further!" — NEVER evaluate ideas during ideation
- teacherNotes questions: "What if you combined these two ideas?", "What constraint haven't you considered?", "Which idea best meets the user's needs?"`,
    "skills-demo": `
Pedagogical tips for SKILLS-DEMO lessons:
- The demo/I Do phase is a CONTENT activity (no student response) with safety warnings
- We Do should be scaffolded with checkpoints
- You Do should have clear success criteria and teacher circulation
- teacherNotes questions: "Show me your technique before continuing", "What should you check before the next step?", "What safety precaution applies here?"`,
    "making": `
Pedagogical tips for MAKING lessons:
- Making time should be ONE long core activity — do NOT fragment into multiple short activities
- Teacher circulates and gives verbal feedback (include teacherNotes for what to look for)
- Safety considerations are NON-NEGOTIABLE for this lesson type
- teacherNotes questions: "Talk me through your process", "What's your next step and why?", "How does this compare to your plan?"`,
    "testing": `
Pedagogical tips for TESTING lessons:
- Frame as predict → test → reflect cycle (productive failure built in)
- Include a structured recording template (table, checklist, or rubric)
- teacherNotes questions: "What did you expect to happen?", "What does this result tell you about your design?", "What would you change for the next iteration?"`,
    "critique": `
Pedagogical tips for CRITIQUE lessons:
- Use a structured critique protocol (Two Stars & a Wish, TAG feedback, etc.)
- Include self-assessment against rubric criteria
- teacherNotes questions: "What specific evidence supports that feedback?", "How will you use this feedback in your next iteration?", "What's the strongest aspect of this design?"`,
  };
  return guidance[type] || "";
}

// =========================================================================
// PER-LESSON GENERATION (Stage 2 — uses skeleton context, runs in parallel)
// =========================================================================

/**
 * Build a prompt for generating activities for a SINGLE LESSON,
 * using the full skeleton as context instead of previousActivitiesSummary.
 */
export function buildPerLessonTimelinePrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  options?: {
    ragContext?: string;
    lessonContext?: string;
    activitySummary?: string;
    teacherStyleProfile?: TeacherStyleProfile | null;
    teachingMoves?: string;
    activityBlocks?: string;
  }
): string {
  const totalLessons = skeleton.lessons.length;
  const activitySuggestions = options?.activitySummary || getActivityLibrarySummary();

  // Build a compact skeleton context (~50 tokens per lesson)
  const skeletonContext = skeleton.lessons.map((l) =>
    `  L${String(l.lessonNumber).padStart(2, "0")}: "${l.title}" — ${l.keyQuestion} (${l.estimatedMinutes}m, ${l.phaseLabel}) [${l.criterionTags.join(",")}]`
  ).join("\n");

  // Identify neighboring lessons for continuity
  const prevLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber - 1);
  const nextLesson = skeleton.lessons.find((l) => l.lessonNumber === lesson.lessonNumber + 1);

  let continuitySection = "";
  if (prevLesson) {
    continuitySection += `\nPrevious lesson: "${prevLesson.title}" — ${prevLesson.keyQuestion}`;
  }
  if (nextLesson) {
    continuitySection += `\nNext lesson: "${nextLesson.title}" — ${nextLesson.keyQuestion}`;
  }

  // --- HITS Phase 2: Spaced Retrieval Context ---
  // Collect vocab/skills from ALL previous lessons for retrieval warm-ups
  let spacedRetrievalSection = "";
  if (lesson.lessonNumber > 1) {
    const priorLessons = skeleton.lessons.filter((l) => l.lessonNumber < lesson.lessonNumber);
    const allPriorVocab = priorLessons.flatMap((l) => (l.cumulativeVocab || []).map((v) => `${v} (L${String(l.lessonNumber).padStart(2, "0")})`));
    const allPriorSkills = priorLessons.flatMap((l) => (l.cumulativeSkills || []).map((s) => `${s} (L${String(l.lessonNumber).padStart(2, "0")})`));
    if (allPriorVocab.length > 0 || allPriorSkills.length > 0) {
      spacedRetrievalSection = `\n## Spaced Retrieval (d=0.71 — use in warm-up)
The warmup activity MUST include a 3-5 minute retrieval starter that spirals back earlier content.
Pick 2-3 items from previous lessons (prioritise older items for spacing effect):
${allPriorVocab.length > 0 ? `Prior Vocabulary: ${allPriorVocab.join(", ")}` : ""}
${allPriorSkills.length > 0 ? `Prior Skills: ${allPriorSkills.join(", ")}` : ""}
Examples: "Recall the 3 properties of [material] from L02", "Quick-sketch the [technique] you learned last lesson", "Match these terms to their definitions"
Include vocabTerms for NEW vocabulary in this lesson PLUS 2-3 retrieval terms from earlier.`;
    }
  }

  // --- HITS Phase 2: Self-Assessment Prediction ---
  // Detect criterion phase boundaries (last lesson emphasising a criterion before next phase)
  let selfAssessmentSection = "";
  const currentCriteria = lesson.criterionTags || [];
  if (nextLesson) {
    const nextCriteria = nextLesson.criterionTags || [];
    // If this lesson has criteria that the next lesson does NOT — it's a phase boundary
    const exitingCriteria = currentCriteria.filter((c) => !nextCriteria.includes(c));
    if (exitingCriteria.length > 0) {
      selfAssessmentSection = `\n## Self-Assessment Prediction (d=1.44 — highest effect size in Hattie's research)
This is the LAST lesson emphasising Criterion ${exitingCriteria.join(", ")} before the unit moves on.
Include a self-prediction activity (5 min) in the reflection:
- "Look at the Criterion ${exitingCriteria.join("/")} rubric. What level do you think you've achieved? Circle it and write 1 sentence explaining why."
- Use reflectionType "short-response" with reflectionItems that include the prediction prompt
- This is about metacognition — students who predict their own performance learn significantly more`;
    }
  }
  // Also trigger for the FINAL lesson (always a good place for self-assessment)
  if (lesson.lessonNumber === skeleton.lessons.length) {
    selfAssessmentSection = `\n## Self-Assessment Prediction (d=1.44 — highest effect size in Hattie's research)
This is the FINAL lesson. Include a comprehensive self-assessment reflection:
- "For each criterion (${(input.assessmentCriteria || []).join(", ")}), predict your achievement level and explain your evidence."
- Use reflectionType "checklist" or "short-response" with items for each criterion
- Students should compare their predictions to earlier self-assessments (if any)`;
  }

  // --- HITS Phase 2: Compare/Contrast Templates ---
  let compareContrastSection = "";
  if (lesson.lessonType === "research") {
    compareContrastSection = `\n## Compare/Contrast Framework (d=1.61 — Marzano's #1 strategy)
This is a RESEARCH lesson — include a structured comparison activity:
- Use responseType "decision-matrix" or "pmi" for product/solution analysis
- Frame as: "Compare [Product A] and [Product B] across these criteria: [list 3-5 criteria from the design brief]"
- Include a scaffolded comparison template with guided questions:
  * "What design features does each product have?"
  * "How does each feature meet the user's needs?"
  * "What are the strengths and limitations of each approach?"
- This maps directly to Criterion A (Inquiring & Analysing)`;
  }

  const ragSection = options?.ragContext ? options.ragContext + "\n\n---\n\n" : "";
  const lessonProfileSection = options?.lessonContext ? options.lessonContext + "\n\n---\n\n" : "";

  return `${lessonProfileSection}${ragSection}## Unit Skeleton (all ${totalLessons} lessons)
${skeleton.narrativeArc}

${skeletonContext}

## Generate Activities for Lesson ${lesson.lessonNumber}: "${lesson.title}"
Phase: ${lesson.phaseLabel}
Key Question: ${lesson.keyQuestion}
Target Duration: ${lesson.estimatedMinutes} minutes
Criteria: ${lesson.criterionTags.join(", ")}
Activity Hints: ${lesson.activityHints.join("; ")}${lesson.lessonType ? `\nLesson Type: ${lesson.lessonType}${getLessonTypeGuidance(lesson.lessonType)}` : ""}${lesson.learningIntention ? `\nLearning Intention: ${lesson.learningIntention}\nSuccess Criteria: ${(lesson.successCriteria || []).map((sc, i) => `${i + 1}. ${sc}`).join("; ")}` : ""}
${continuitySection}${spacedRetrievalSection}${selfAssessmentSection}${compareContrastSection}

## Available Activity Cards
Consider incorporating these where appropriate:
${activitySuggestions}

## Unit Context
- End Goal: ${input.endGoal}
- Topic: ${input.topic}
- Grade Level: ${input.gradeLevel}
- Lesson Length: ${input.lessonLengthMinutes} minutes
- Key Concept: ${input.keyConcept}
- Assessment Criteria: ${(input.assessmentCriteria || []).join(", ")}${buildTypeSpecificContext(input)}${buildContextInjection(input)}

${buildTeachingContext(input.unitType || "design", options?.teacherStyleProfile)}

${buildTimingBlock(getGradeTimingProfile(input.gradeLevel), input.lessonLengthMinutes, undefined, input.unitType, lesson.lessonType)}
${options?.teachingMoves ? "\n" + options.teachingMoves + "\n" : ""}${options?.activityBlocks ? "\n" + options.activityBlocks + "\n" : ""}
## Generation Target
Generate activities totalling approximately ${lesson.estimatedMinutes} minutes. Use timeWeight to proportion time — the exact number of activities should match pedagogical needs (typically 3-6).
Activity IDs should be: L${String(lesson.lessonNumber).padStart(2, "0")}-a1, L${String(lesson.lessonNumber).padStart(2, "0")}-a2, etc.
All activities in this lesson should have phaseLabel: "${lesson.phaseLabel}"

PREFERRED ORDERING (adapt if Activity Blocks suggest a different pedagogically sound flow):
1. First activity: warmup (role="warmup") — vocab retrieval + engagement hook
2. Middle activities: intro/content/core — the teaching and sustained work
3. Last activity: reflection (role="reflection") — exit ticket, debrief, or self-assessment
Aim to keep reflection near the end. If adapting a Proven Activity Block that has a different structure, honour the block's proven sequence.

Remember:
- Every activity needs THREE slot fields (NOT a single prompt blob):
  · framing — ONE sentence (≤200 chars) orienting the student. Reads quietly as the lead.
  · task — the imperative body. Numbered list for discrete steps. ≤800 chars. NO \`###\` headings or \`| col | col |\` tables (renderer drops them). NO \`**Step 1:**\` bold sub-headings — use a numbered list instead.
  · success_signal — ONE sentence (≤200 chars) telling the student what to produce/record/submit/share. Use a clear production verb. ALWAYS PRESENT — infer one if exploratory.
  PLUS: id, role, title, timeWeight (quick | moderate | extended | flexible)
- Only add durationMinutes when exact timing is critical (safety demo, timed assessment)
- Core activities need: responseType, criterionTags, scaffolding (ell1/ell2/ell3)
- Content activities: omit responseType. Use contentStyle (info/warning/tip/context/activity/speaking/practical), media, links where helpful.
- Warmup activities need: vocabTerms
- Reflection activities need: reflectionType, reflectionItems
- Set portfolioCapture: true on 1-2 core activities
- Add teacherNotes to at least 2 core activities with: 2-3 circulation questions at different cognitive levels (recall → analysis → evaluation), safety reminders for making/testing lessons, differentiation tips where relevant`;
}

/**
 * Build RAG-enhanced per-lesson prompt.
 */
export async function buildRAGPerLessonPrompt(
  input: LessonJourneyInput,
  lesson: TimelineLessonSkeleton,
  skeleton: TimelineSkeleton,
  teacherId?: string,
  teachingContext?: PartialTeachingContext | null,
  teacherStyleProfile?: TeacherStyleProfile | null
): Promise<{ prompt: string; chunkIds: string[] }> {
  const query = `${input.topic} ${lesson.title} ${lesson.keyQuestion} ${input.gradeLevel}`;

  // Parallelize all async lookups — they are independent
  const blocksPromise = teacherId
    ? import("@/lib/activity-blocks").then(async (m) => {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        const blocks = await m.retrieveActivityBlocks(createAdminClient(), { query, teacherId, designPhase: lesson.phaseLabel as import("@/types").DesignPhase, maxBlocks: 5 });
        return blocks.length > 0 ? m.formatBlocksAsPromptText(blocks) : "";
      }).catch(() => "")
    : Promise.resolve("");

  const [activityResult, chunksResult, profilesResult, blocksResult] = await Promise.allSettled([
    getActivityCardSummaryEnriched(),
    retrieveContext({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      includePublic: true,
      maxChunks: 3,
    }),
    retrieveLessonProfiles({
      query,
      gradeLevel: input.gradeLevel,
      teacherId,
      maxProfiles: 2,
    }),
    blocksPromise,
  ]);

  const activitySummary = activityResult.status === "fulfilled" ? activityResult.value : undefined;
  const activityBlocksText = blocksResult.status === "fulfilled" ? blocksResult.value : "";

  let ragContext = "";
  let chunkIds: string[] = [];
  if (chunksResult.status === "fulfilled" && chunksResult.value.length > 0) {
    ragContext = formatRetrievedContext(chunksResult.value);
    chunkIds = chunksResult.value.map((c) => c.id);
    recordRetrieval(chunkIds).catch(() => {});
  }

  let lessonContext = "";
  let feedbackContext = "";
  if (profilesResult.status === "fulfilled" && profilesResult.value.length > 0) {
    lessonContext = formatLessonProfiles(profilesResult.value);
    const profileIds = profilesResult.value.map((p) => p.id);
    incrementProfileReferences(profileIds).catch(() => {});

    // Close the feedback loop: inject real teaching experience
    try {
      const aggregatedFeedback = await retrieveAggregatedFeedback(profileIds);
      if (aggregatedFeedback.length > 0) {
        feedbackContext = formatFeedbackContext(aggregatedFeedback);
      }
    } catch {
      // Feedback is enhancement, not requirement
    }
  }

  // Build teaching context + framework vocabulary
  const teachingContextStr = buildTeachingContextBlock(teachingContext || undefined);
  const frameworkStr = buildFrameworkPromptBlock(getFrameworkFromContext(teachingContext));
  const contextPrefix = (frameworkStr + teachingContextStr).trim();

  // Prepend context to lesson profiles section, include feedback
  const lessonWithFeedback = lessonContext + (feedbackContext ? "\n\n" + feedbackContext : "");
  const enrichedLessonContext = contextPrefix
    ? contextPrefix + (lessonWithFeedback ? "\n\n---\n\n" + lessonWithFeedback : "")
    : lessonWithFeedback || undefined;

  // Retrieve teaching moves filtered by lesson phase + unit type
  let teachingMovesStr = "";
  try {
    const phase = mapPhaseLabelToMovePhase(lesson.phaseLabel);
    const moves = getTeachingMoves({
      phase,
      unitType: (input.unitType as "design" | "service" | "pp" | "inquiry") || undefined,
      maxResults: 4,
    });
    if (moves.length > 0) {
      teachingMovesStr = formatMovesForPrompt(moves);
    }
  } catch {
    // Teaching moves are enhancement, not requirement
  }

  const prompt = buildPerLessonTimelinePrompt(input, lesson, skeleton, {
    ragContext: ragContext || undefined,
    lessonContext: enrichedLessonContext,
    activitySummary,
    teacherStyleProfile,
    teachingMoves: teachingMovesStr || undefined,
    activityBlocks: activityBlocksText || undefined,
  });

  return { prompt, chunkIds };
}

// =========================================================================
// TEACHING MOVES HELPERS
// =========================================================================

/** Map AI-generated phaseLabel strings to the Teaching Moves DesignPhase enum */
function mapPhaseLabelToMovePhase(phaseLabel: string): MovePhase {
  const lower = phaseLabel.toLowerCase();
  if (lower.includes("discover") || lower.includes("research") || lower.includes("inquir")) return "discover";
  if (lower.includes("define") || lower.includes("brief") || lower.includes("specification")) return "define";
  if (lower.includes("ideat") || lower.includes("brainstorm") || lower.includes("concept") || lower.includes("generat")) return "ideate";
  if (lower.includes("prototype") || lower.includes("prototyp") || lower.includes("develop") || lower.includes("mak") || lower.includes("build") || lower.includes("creat")) return "prototype";
  if (lower.includes("test") || lower.includes("evaluat") || lower.includes("refin") || lower.includes("feedback") || lower.includes("present")) return "test";
  return "any";
}

// =========================================================================
// FEEDBACK CONTEXT FORMATTING (Layer 2 — inject teaching experience into prompts)
// =========================================================================

import type { AggregatedLessonFeedback } from "@/types/lesson-intelligence";

/**
 * Format aggregated feedback into a prompt block that teaches the AI
 * about real teaching experience with similar content.
 *
 * This is what makes the AI "get smarter over time" — real classroom
 * data feeds back into generation prompts.
 */
export function formatFeedbackContext(
  feedback: AggregatedLessonFeedback[]
): string {
  if (!feedback || feedback.length === 0) return "";

  const entries = feedback.map((f) => {
    const lines: string[] = [];

    lines.push(`### Teaching Experience (taught ${f.times_taught} time${f.times_taught === 1 ? "" : "s"})`);

    if (f.avg_teacher_rating) {
      lines.push(`- Teacher satisfaction: ${f.avg_teacher_rating.toFixed(1)}/5`);
    }

    if (f.avg_actual_duration_minutes) {
      lines.push(`- Actual duration: ~${Math.round(f.avg_actual_duration_minutes)} minutes`);
    }

    if (f.common_went_well?.length > 0) {
      lines.push(`- What worked well: ${f.common_went_well.slice(0, 3).join("; ")}`);
    }

    if (f.common_to_change?.length > 0) {
      lines.push(`- Suggested improvements: ${f.common_to_change.slice(0, 3).join("; ")}`);
    }

    if (f.common_struggles?.length > 0) {
      lines.push(`- Student struggles: ${f.common_struggles.slice(0, 3).join("; ")}`);
    }

    if (f.timing_reality?.length > 0) {
      const timingIssues = f.timing_reality.filter(
        (t) => Math.abs(t.avg_actual_minutes - t.planned_minutes) > 5
      );
      if (timingIssues.length > 0) {
        const timingNotes = timingIssues.map(
          (t) => `"${t.phase_title}": planned ${t.planned_minutes}m, actual ~${Math.round(t.avg_actual_minutes)}m`
        );
        lines.push(`- Timing reality: ${timingNotes.join("; ")}`);
      }
    }

    if (f.best_conditions?.energy_recommendation) {
      lines.push(`- Energy tip: ${f.best_conditions.energy_recommendation}`);
    }

    if (f.pace_distribution) {
      const total = Object.values(f.pace_distribution).reduce((a, b) => a + b, 0);
      if (total > 0) {
        const justRight = f.pace_distribution["just_right"] || 0;
        const pct = Math.round((justRight / total) * 100);
        if (pct < 60) {
          lines.push(`- Pacing concern: only ${pct}% of students felt pace was "just right"`);
        }
      }
    }

    return lines.join("\n");
  });

  return `## Real Teaching Experience
Teachers who taught similar lessons reported the following insights.
Use this to calibrate timing, difficulty, and activity design.

${entries.join("\n\n")}`;
}
