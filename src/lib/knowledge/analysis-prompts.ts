/**
 * 3-Pass AI Analysis Prompts for Lesson Intelligence
 *
 * Pass 1: Structure — What's in this document?
 * Pass 2: Pedagogy — Why is it designed this way? What makes it work?
 * Pass 3: Design Teaching — How does this work in a real workshop?
 *
 * Each pass builds on the previous. The AI sees its own prior analysis
 * before going deeper. This produces richer, more nuanced understanding
 * than a single mega-prompt.
 */

import type { Pass1Structure, Pass2Pedagogy, Pass3DesignTeaching, PartialTeachingContext } from "@/types/lesson-intelligence";

/** Current prompt version — increment when prompts change significantly */
export const ANALYSIS_PROMPT_VERSION = "1.1.0";

/* ================================================================
   TEACHING CONTEXT BLOCK
   Appended to system prompts when teacher profile is available.
   Gives the AI school-specific context for richer analysis.
   ================================================================ */

/**
 * Build a context block from the teacher's profile.
 * Returns empty string if no meaningful context is available.
 * Appended to system prompts — gives AI grounding in the teacher's
 * specific school, equipment, curriculum, and teaching style.
 */
export function buildTeachingContextBlock(ctx?: PartialTeachingContext): string {
  if (!ctx) return "";

  const lines: string[] = [];

  // School identity
  if (ctx.schoolName) lines.push(`School: ${ctx.schoolName}`);
  if (ctx.country) lines.push(`Country: ${ctx.country}`);
  if (ctx.curriculumFramework) lines.push(`Curriculum framework: ${ctx.curriculumFramework}`);

  // Timetable
  if (ctx.typicalPeriodMinutes) lines.push(`Typical lesson length: ${ctx.typicalPeriodMinutes} minutes`);

  // What this teacher teaches
  if (ctx.subjectsTaught?.length) lines.push(`Subjects taught: ${ctx.subjectsTaught.join(", ")}`);
  if (ctx.gradeLevelsTaught?.length) lines.push(`Grade levels: ${ctx.gradeLevelsTaught.join(", ")}`);

  // Deep school context (JSONB)
  const sc = ctx.schoolContext;
  if (sc) {
    if (sc.school_type) lines.push(`School type: ${sc.school_type}`);
    if (sc.typical_class_size) lines.push(`Typical class size: ${sc.typical_class_size}`);
    if (sc.has_double_periods) lines.push(`Has double periods: ${sc.double_period_minutes || "yes"} minutes`);
    if (sc.workshop_spaces?.length) lines.push(`Workshop spaces: ${sc.workshop_spaces.join(", ")}`);
    if (sc.available_tools?.length) lines.push(`Available tools/equipment: ${sc.available_tools.join(", ")}`);
    if (sc.available_software?.length) lines.push(`Available software: ${sc.available_software.join(", ")}`);
    if (sc.material_budget_notes) lines.push(`Budget notes: ${sc.material_budget_notes}`);
    if (sc.behavioural_framework) lines.push(`Behavioural framework: ${sc.behavioural_framework}`);
  }

  // Teacher preferences (JSONB)
  const tp = ctx.teacherPreferences;
  if (tp) {
    if (tp.years_experience) lines.push(`Teaching experience: ${tp.years_experience} years`);
    if (tp.preferred_pedagogical_approach) lines.push(`Preferred approach: ${tp.preferred_pedagogical_approach}`);
    if (tp.classroom_management_style) lines.push(`Management style: ${tp.classroom_management_style}`);
    if (tp.preferred_assessment_style) lines.push(`Assessment style: ${tp.preferred_assessment_style}`);
    if (tp.instruction_language_level) lines.push(`Instruction language: ${tp.instruction_language_level}`);
    if (tp.favourite_activities?.length) lines.push(`Favourite activities: ${tp.favourite_activities.join(", ")}`);
    if (tp.activities_to_avoid?.length) lines.push(`Activities to avoid: ${tp.activities_to_avoid.join(", ")}`);
  }

  if (lines.length === 0) return "";

  return `\n\n## Teacher's School Context\nThe teacher who uploaded this document works in the following context. Use this to calibrate your analysis — judge timing against their lesson length, reference their available equipment, and align to their curriculum framework.\n\n${lines.join("\n")}`;
}

/* ================================================================
   PASS 1: STRUCTURE EXTRACTION
   Model: Claude Haiku (fast, cheap — this is pattern matching)
   ================================================================ */

export const PASS1_SYSTEM_PROMPT = `You are an expert educational document analyst. Your job is to extract the STRUCTURE of a lesson plan, activity, or teaching document. Focus on factual extraction — what's in the document, not interpretation.

You are analysing content created by design and technology teachers for students aged 11-16. Documents may be lesson plans, activity sheets, unit overviews, worksheets, or assessment tasks.

Output valid JSON matching the schema exactly. If information is not present in the document, use reasonable defaults but mark them as inferred.`;

export function buildPass1Prompt(extractedText: string, filename: string): string {
  return `Analyse the following document and extract its structure.

## Document
Filename: ${filename}

${extractedText}

## Required Output (JSON)
{
  "title": "string — the lesson/document title",
  "subject_area": "string — Product Design | Digital Design | Systems Design | Electronics | Architecture | Textiles | Food Technology | General Design | unknown",
  "grade_level": "string — e.g. 'MYP 3', 'Year 9', 'Grade 8', or 'unknown'",
  "estimated_duration_minutes": "number — total lesson time in minutes (infer from content if not stated)",
  "lesson_type": "single_lesson | multi_lesson_sequence | unit_overview | activity_template | assessment_task | workshop_session",

  "sections": [
    {
      "title": "string — section/activity name",
      "content_summary": "string — 1-2 sentence summary of what happens",
      "estimated_minutes": "number — how long this section takes",
      "materials_mentioned": ["string — physical materials mentioned"],
      "tools_mentioned": ["string — tools, software, machines mentioned"],
      "activity_type": "string — e.g. 'discussion', 'hands-on making', 'research', 'drawing', 'peer feedback', 'quiz', 'demonstration'"
    }
  ],

  "materials_list": ["string — all materials mentioned across the document"],
  "tools_list": ["string — all tools/software/machines mentioned"],
  "criteria_mentioned": ["string — any MYP criteria (A/B/C/D) or assessment objectives referenced"],
  "vocabulary_terms": ["string — any key vocabulary or technical terms defined or highlighted"]
}

Important:
- Extract EVERY distinct activity or section, even short ones (transitions, warm-ups, cleanup)
- If timing isn't explicit, estimate based on content complexity and typical classroom pacing for the age group
- Include materials and tools even if only briefly mentioned
- For tools, distinguish between digital tools (TinkerCAD, Canva, Figma) and physical tools (laser cutter, 3D printer, hand tools)
- Vocabulary terms include any bolded, underlined, or explicitly defined words`;
}

/* ================================================================
   PASS 2: PEDAGOGICAL ANALYSIS
   Model: Claude Sonnet (needs reasoning depth)
   ================================================================ */

export const PASS2_SYSTEM_PROMPT = `You are a world-class pedagogical analyst and curriculum specialist with deep expertise in design and technology education for ages 11-16. You have decades of experience observing, coaching, and evaluating teachers.

Your job is to analyse WHY a lesson is designed the way it is — not just describe it, but reveal the pedagogical thinking underneath. You understand:

- Scaffolding progression and when to remove supports
- Cognitive load theory and how it applies to practical lessons
- Bloom's taxonomy in action (not just labelling, but spotting genuine cognitive demands)
- The difference between "covering" a criterion and genuinely developing the skill
- How embedded assessment (invisible to students) differs from bolted-on assessment
- Differentiation that's built into activities vs. added as an afterthought
- Check-for-understanding moments and formative assessment strategies
- How energy and engagement flow through a lesson
- What makes experienced teachers' lessons different from beginners'

You are rigorous. If a lesson has gaps, say so. If the scaffolding is weak, name it. If "assessment" is really just a question at the end, call it out. But also recognise genuine quality when you see it.

Output valid JSON matching the schema exactly.`;

export function buildPass2Prompt(
  extractedText: string,
  pass1: Pass1Structure
): string {
  return `You are performing a deep pedagogical analysis of a ${pass1.lesson_type} for ${pass1.grade_level} ${pass1.subject_area}.

## Original Document Text
${extractedText}

## Structural Analysis (from previous pass)
${JSON.stringify(pass1, null, 2)}

## Required Output (JSON)
{
  "pedagogical_approach": {
    "primary": "string — inquiry-based | project-based | direct-instruction | design-thinking | experiential | problem-based | cooperative-learning",
    "secondary": "string | null",
    "reasoning": "string — 2-3 sentences explaining WHY this approach suits this content and age group. Not just labelling — explain the pedagogical logic."
  },

  "scaffolding_strategy": {
    "model": "string — gradual-release | I-do-we-do-you-do | discovery-with-guardrails | worked-example-fading | reciprocal-teaching | none-detected",
    "how_supports_are_introduced": "string — specifically how the lesson introduces scaffolding (templates, sentence starters, models, worked examples, etc.)",
    "how_supports_are_removed": "string — specifically how and when supports are withdrawn. If they aren't removed, say so — that's a gap.",
    "reasoning": "string — why this scaffolding approach works (or doesn't) for this age group and content"
  },

  "cognitive_load_curve": {
    "description": "string — describe the cognitive demand across the lesson timeline. Example: 'Starts low (vocabulary recall), peaks at minute 20 (open-ended design challenge with multiple constraints), eases through guided reflection'",
    "peak_moment": "string — when is the highest cognitive demand and what makes it demanding?",
    "recovery_moment": "string — when do students get a cognitive breather? If there isn't one, flag it."
  },

  "phase_analysis": [
    {
      "section_title": "string — matches a section title from Pass 1",
      "phase": "warm_up | vocabulary | introduction | demonstration | guided_practice | independent_work | making | collaboration | critique | gallery_walk | presentation | testing | iteration | reflection | assessment | cleanup | extension | transition | station_rotation",
      "pedagogical_purpose": "string — WHY does this phase exist at this point in the lesson? What would be lost if you removed it? Be specific.",
      "teacher_role": "direct_instruction | modelling | facilitating | circulating | observing | co-working | conferencing",
      "student_cognitive_level": "remember | understand | apply | analyse | evaluate | create",
      "scaffolding_present": ["string — specific supports available during this phase"],
      "scaffolding_removed": ["string — supports from earlier phases that are now withdrawn"],
      "check_for_understanding": "string | null — HOW does the teacher know students understand? Not just 'asks questions' — specifically what kind of check and what they're looking for",
      "differentiation": {
        "extension": "string — what do fast finishers or advanced students do? If nothing is provided, say 'Not addressed — gap'",
        "support": "string — what help is available for struggling students? If nothing, say 'Not addressed — gap'",
        "ell_modification": "string | null — language learner accommodations if present"
      },
      "energy_state": "calm_focus | curious_exploration | creative_energy | high_energy_active | productive_struggle | reflective | collaborative_buzz | quiet_concentration | celebratory | tired_low_energy",
      "transition_notes": "string | null — how this phase connects to what comes before and after"
    }
  ],

  "criteria_analysis": [
    {
      "criterion": "A | B | C | D",
      "emphasis": "primary | secondary | touched",
      "skill_development": "string — WHAT specific skill is being developed? Not 'Criterion B skills' but 'generating multiple design ideas using structured ideation techniques'",
      "how_developed": "string — HOW does the lesson develop this skill? Describe the pedagogical mechanism. Not 'students do a brainstorm' but 'students use three successive ideation techniques (mind-map → SCAMPER → rapid sketching) with increasing freedom, building fluency before focusing on feasibility'",
      "evidence_from_text": "string — direct quote or close paraphrase from the document that shows this criterion is genuinely developed",
      "assessment_embedded": "boolean — is assessment woven naturally into the activity (students produce evidence as part of the task) or is it a separate bolted-on element?",
      "assessment_approach": "string | null — if present, how is learning evidence captured?"
    }
  ],

  "strengths": [
    {
      "what": "string — name the strength",
      "why_it_works": "string — explain the pedagogical reasoning. Why is this effective? What principle does it leverage? Be specific to this age group and subject."
    }
  ],

  "gaps": [
    {
      "what": "string — name the gap or weakness",
      "suggestion": "string — specific, actionable suggestion for improvement. Not generic advice — something a teacher could implement tomorrow."
    }
  ],

  "complexity_level": "introductory | developing | proficient | advanced — relative to the stated grade level, not absolute"
}

## Important Guidelines
- NEVER confuse mentioning a criterion with genuinely developing it. "Students will inquire and analyse" in a learning objective does NOT mean Criterion A is developed — look at the ACTIVITIES.
- Scaffolding that's never removed isn't scaffolding — it's dependency. Flag this.
- "Ask students to reflect" is not a check for understanding. What specific responses would tell the teacher that students get it?
- Differentiation means DIFFERENT work for different students, not just "early finishers can do more." What do struggling students get?
- Be honest about gaps. Every lesson has them. A lesson with zero gaps identified suggests shallow analysis.
- Consider the age group in every judgement. What's appropriate scaffolding for Year 7 would be over-scaffolding for Year 10.`;
}

/* ================================================================
   PASS 3: DESIGN TEACHING & WORKSHOP INTELLIGENCE
   Model: Claude Sonnet (needs contextual reasoning)
   ================================================================ */

export const PASS3_SYSTEM_PROMPT = `You are an experienced head of department in a secondary school Design & Technology department. You've spent 20+ years running workshops, managing equipment, dealing with safety incidents, and watching lessons succeed and fail.

You think about the REALITY of teaching design — not the idealised version in a lesson plan:

- Workshop logistics: 30 students, 3 laser cutters, 1 teacher. How does that actually work?
- Setup and cleanup take real time. Hot glue guns need 5 minutes to warm up. 3D printers need levelling.
- Safety isn't a checkbox — it's woven into how you introduce tools and monitor usage.
- After a loud, active making session, students (and you) need a calmer activity.
- Friday afternoon Year 9 is a different animal to Tuesday morning Year 7.
- The "5 and 5" problem: 5 students finished 10 minutes ago and are getting restless. 5 students are nowhere near done.
- Materials run out. Equipment breaks. The internet goes down.
- Some activities generate assessment evidence naturally. Others need contorting to produce it.

You also understand how lessons fit into units — the narrative arc from initial encounter through struggle to resolution.

Be practical. Be honest. A lesson plan that looks beautiful on paper but would fall apart in a real workshop is not a good lesson plan.

Output valid JSON matching the schema exactly.`;

export function buildPass3Prompt(
  extractedText: string,
  pass1: Pass1Structure,
  pass2: Pass2Pedagogy
): string {
  return `You are analysing the practical workshop reality of a ${pass1.lesson_type} for ${pass1.grade_level} ${pass1.subject_area}.

## Original Document Text
${extractedText}

## Structural Analysis (Pass 1)
${JSON.stringify(pass1, null, 2)}

## Pedagogical Analysis (Pass 2)
${JSON.stringify(pass2, null, 2)}

## Required Output (JSON)
{
  "classroom_management": {
    "noise_level_curve": "string — describe how noise levels flow through the lesson. e.g. 'quiet (intro) → moderate (discussion) → loud (making with power tools) → quiet (reflection). The making phase needs explicit noise management strategy.'",
    "movement_required": "boolean — do students need to move around the room?",
    "grouping_progression": "string — how grouping changes through the lesson. e.g. 'whole class (intro) → pairs (ideation) → individual (making) → pairs (peer critique)'",
    "the_5_and_5": "string — HOW does this lesson handle the reality that some students finish early and others need more time? Be specific. If the lesson doesn't address this, say so and suggest a strategy.",
    "behaviour_hotspots": "string | null — which moments are highest risk for off-task behaviour? e.g. 'Transition from demo to making — 3 minutes where students are collecting materials and not yet engaged in their task'"
  },

  "workshop_analysis": [
    {
      "section_title": "string — matches a section from the structural analysis",
      "safety_considerations": ["string — specific safety issues for this phase. Not generic 'be safe' but 'students using craft knives need cutting mats and must cut away from their body. Teacher demonstrates grip technique before any cutting begins.'"],
      "setup_time_minutes": "number — realistic setup time (heating equipment, distributing materials, logging into software, etc.)",
      "cleanup_time_minutes": "number — realistic cleanup time (washing tools, storing materials, shutting down equipment, sweeping)",
      "station_rotation": {
        "stations": "number | null",
        "minutes_per_station": "number | null",
        "what_others_do": "string | null — what are students doing while waiting for their turn? This is critical — 'waiting' is not acceptable.",
        "rotation_management": "string | null — how does the teacher signal rotation?"
      },
      "tool_management_notes": "string | null — practical notes about managing shared tools/equipment"
    }
  ],

  "prerequisites": [
    {
      "skill_or_knowledge": "string — what must students know or be able to do before this lesson?",
      "why_needed": "string — what would go wrong if a student started without this? Be concrete."
    }
  ],

  "skills_developed": [
    {
      "skill": "string — specific skill (not vague 'design skills' but 'using a design template to develop initial sketches into detailed annotated drawings')",
      "to_what_level": "introduced | practiced | consolidated | mastered"
    }
  ],

  "energy_and_sequencing": {
    "starts_as": "calm_focus | curious_exploration | creative_energy | high_energy_active | productive_struggle | reflective | collaborative_buzz | quiet_concentration | celebratory | tired_low_energy",
    "ends_as": "same options as above",
    "ideal_follows": "string — what kind of lesson should come next? Be specific: 'A quieter individual drawing/CAD session would build on the ideas generated today without fatigue from another high-energy making session'",
    "avoid_after": "string — what should NOT follow this lesson? e.g. 'Avoid another testing-heavy lesson — students will be fatigued from data collection. Also avoid a lecture — energy will be too high from making.'",
    "ideal_time_of_day": "string | null — when does this lesson work best? e.g. 'Morning — needs high concentration for precise measuring and cutting'",
    "ideal_day_of_week": "string | null — any day-of-week considerations? e.g. 'Avoid Friday last period — making session needs full concentration'"
  },

  "narrative_role": "string | null — if this is or could be part of a unit, where does it sit in the design cycle story arc? e.g. 'This is a classic Act 2 rising-action lesson — students are moving from ideas to concrete plans, and the constraint of real materials creates productive tension'",

  "timing_adjustments": [
    {
      "section_title": "string — which section needs a timing adjustment",
      "original_minutes": "number — what Pass 1 estimated",
      "adjusted_minutes": "number — realistic timing including setup, transition, and cleanup",
      "reason": "string — why the adjustment. e.g. 'Original estimate didn't account for 5 min to distribute materials and demonstrate safe use of rotary tool'"
    }
  ]
}

## Important Guidelines
- Be REALISTIC about timing. A "10-minute making activity" with power tools actually needs: 2 min instruction, 2 min setup/safety, 10 min working, 3 min cleanup = 17 minutes.
- Safety is not optional or generic. If tools are involved, name the specific safety procedures for THAT tool with THAT age group.
- Station rotation is necessary when demand exceeds supply. If 30 students need a laser cutter and there are 2, you MUST address this.
- The 5-and-5 is ALWAYS relevant. Every lesson has fast and slow students. If the plan doesn't address this, that's a gap.
- Behaviour hotspots are transition moments, long wait times, and periods of low structure. Name them.
- Energy states must be realistic. Students don't go from "high energy making" to "calm reflection" instantly — there's a transition.
- Prerequisites should be SPECIFIC. Not "design skills" but "ability to use isometric drawing to represent 3D objects on paper".`;
}

/* ================================================================
   LESSON PROFILE MERGER
   Combines all 3 passes into the final LessonProfile
   ================================================================ */

export function buildProfileMergePrompt(
  pass1: Pass1Structure,
  pass2: Pass2Pedagogy,
  pass3: Pass3DesignTeaching,
  analysisModel: string
): string {
  // This is a deterministic merge, not an AI call.
  // Keeping as a function for clarity — actual merge happens in analyse.ts
  void pass1;
  void pass2;
  void pass3;
  void analysisModel;
  return ""; // placeholder — merge is done in code, not AI
}

/* ================================================================
   POST-LESSON FEEDBACK PROMPTS
   ================================================================ */

/**
 * Prompt for generating aggregated feedback insights from multiple
 * teacher and student feedback entries for the same lesson.
 */
export function buildFeedbackAggregationPrompt(
  profile: { title: string; subject_area: string; grade_level: string },
  teacherFeedback: Array<{
    overall_rating: number;
    went_well: string[];
    to_change: string[];
    timing_notes?: Array<{ phase_title: string; planned_minutes: number; actual_minutes: number }>;
    modifications_for_next_time: string[];
  }>,
  studentFeedback: Array<{
    understanding: number;
    engagement: number;
    pace: string;
    highlight?: string;
    struggle?: string;
  }>
): string {
  return `Analyse the following feedback from ${teacherFeedback.length} teaching(s) of "${profile.title}" (${profile.grade_level} ${profile.subject_area}) and ${studentFeedback.length} student responses.

## Teacher Feedback
${JSON.stringify(teacherFeedback, null, 2)}

## Student Feedback
${JSON.stringify(studentFeedback, null, 2)}

Synthesise this into a concise evolution narrative:
1. What patterns emerge across multiple teachings? (not just listing — what's the STORY?)
2. Which timing adjustments are consistent (not just one-off)?
3. What do students consistently find engaging or struggle with?
4. What specific modifications should be made to the lesson based on this evidence?
5. What conditions (time of day, class size, energy level) produce the best outcomes?

Be specific and actionable. This will be stored as intelligence for future lesson planning.`;
}

/* ================================================================
   QUICK MODIFY PROMPT
   ================================================================ */

export const QUICK_MODIFY_SYSTEM_PROMPT = `You are an experienced design & technology teacher helping a colleague adapt a lesson on the fly. You know the unit they're teaching, where students are in the design cycle, and what's been happening in recent lessons.

You generate PRACTICAL, IMMEDIATELY USABLE modifications. Not theoretical — something a teacher can run with in the next 5 minutes. You consider:

- Time of day and day of week (Friday afternoon is different from Monday morning)
- Student energy after previous activities
- Available materials and tools
- Where students are in the design cycle and unit narrative
- What would produce useful portfolio/assessment evidence even in a modified activity
- Realistic timing (don't suggest a 20-minute activity when they have 30 minutes including setup)

Your output is a ready-to-teach mini-lesson plan, not a suggestion to "try something different."`;

export function buildQuickModifyPrompt(
  teacherPrompt: string,
  context: {
    unit_title?: string;
    unit_subject?: string;
    unit_grade?: string;
    current_criterion?: string;
    pages_completed?: string[];
    recent_activities?: string[];
    tools_available?: string[];
  }
): string {
  const contextLines: string[] = [];
  if (context.unit_title) contextLines.push(`Unit: ${context.unit_title}`);
  if (context.unit_subject) contextLines.push(`Subject: ${context.unit_subject}`);
  if (context.unit_grade) contextLines.push(`Grade: ${context.unit_grade}`);
  if (context.current_criterion) contextLines.push(`Current criterion: ${context.current_criterion}`);
  if (context.pages_completed?.length) contextLines.push(`Pages completed: ${context.pages_completed.join(", ")}`);
  if (context.recent_activities?.length) contextLines.push(`Recent activities: ${context.recent_activities.join(", ")}`);
  if (context.tools_available?.length) contextLines.push(`Tools available: ${context.tools_available.join(", ")}`);

  return `## Teacher's Request
"${teacherPrompt}"

## Current Context
${contextLines.length > 0 ? contextLines.join("\n") : "No unit context available — generate a general design activity appropriate to the request."}

## Required Output (JSON)
{
  "title": "string — short, descriptive activity name",
  "description": "string — one paragraph overview",
  "estimated_minutes": "number",
  "type": "replacement | extension | filler | wind_down | energiser",

  "flow": [
    {
      "phase": "lesson phase type",
      "title": "string",
      "instructions": "string — what to SAY to students. Write this as if the teacher will read it out.",
      "teacher_notes": "string — what the teacher should DO during this phase",
      "minutes": "number",
      "materials_needed": ["string"] or null
    }
  ],

  "how_this_connects": "string — how this activity relates to the current unit and where students are",
  "what_students_produce": "string | null — any evidence for portfolio or assessment?",
  "criterion_alignment": "string | null — does this contribute to any criterion work?",

  "why_this_works": "string — explain your reasoning for this choice given the teacher's situation",
  "alternative_if_not_working": "string — quick pivot if students aren't engaging with this"
}`;
}
