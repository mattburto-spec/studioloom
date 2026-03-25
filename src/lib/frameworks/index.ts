/**
 * Framework Definitions — class-level learning journey configurations.
 *
 * Each framework defines:
 * - Phases (replaces design cycle phases in Open Studio + generation)
 * - AI mentor personality (system prompt fragment)
 * - Toolkit tool suggestions per phase
 * - Reflection prompts
 * - Vocabulary overrides
 */

// ─────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────

export interface FrameworkPhase {
  id: string;
  name: string;
  description: string;
  /** Color for UI — hex */
  color: string;
  /** Suggested toolkit tools for this phase */
  toolkitTools: string[];
}

export interface FrameworkDefinition {
  id: string;
  name: string;
  shortName: string;
  description: string;
  /** Icon path for SVG (24x24 viewBox) */
  icon: string;
  /** Ordered phases */
  phases: FrameworkPhase[];
  /** AI mentor personality for Open Studio */
  mentorPrompt: string;
  /** AI mentor personality for guided mode (Design Assistant) */
  guidedMentorPrompt: string;
  /** Check-in question templates (rotated through) */
  checkInPrompts: string[];
  /** Drift detection language */
  driftLanguage: {
    gentle: string;
    direct: string;
    silent: string;
  };
  /** Reflection prompt templates */
  reflectionPrompts: string[];
  /** Documentation nudge language */
  documentationNudge: string;
  /** Alignment check language (replaces MYP criterion alignment) */
  alignmentCheckPrompt: string;
  /** Vocabulary overrides */
  vocabulary: {
    project: string;        // "design project" vs "service project"
    process: string;        // "design process" vs "service cycle"
    outcome: string;        // "product" vs "impact"
    critique: string;       // "design crit" vs "progress review"
    portfolio: string;      // "design portfolio" vs "service journal"
  };
}

// ─────────────────────────────────────────────────
// MYP Design (default — preserves existing behaviour)
// ─────────────────────────────────────────────────

const MYP_DESIGN: FrameworkDefinition = {
  id: "myp_design",
  name: "MYP Design",
  shortName: "Design",
  description: "IB MYP Design cycle with Inquiring, Developing, Creating, and Evaluating phases.",
  icon: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  phases: [
    { id: "inquiring", name: "Inquiring & Analysing", description: "Research, analyse, define the problem", color: "#6366F1", toolkitTools: ["empathy-map", "stakeholder-map", "five-whys", "how-might-we"] },
    { id: "developing", name: "Developing Ideas", description: "Generate, explore, and refine ideas", color: "#10B981", toolkitTools: ["scamper", "six-thinking-hats", "lotus-diagram", "morphological-chart", "reverse-brainstorm"] },
    { id: "creating", name: "Creating the Solution", description: "Plan, make, and iterate the product", color: "#F59E0B", toolkitTools: ["decision-matrix", "pmi-chart", "swot-analysis"] },
    { id: "evaluating", name: "Evaluating", description: "Test, evaluate, and reflect", color: "#8B5CF6", toolkitTools: ["pmi-chart", "six-thinking-hats", "affinity-diagram"] },
  ],
  mentorPrompt: `You are a studio critic — a visiting designer giving a studio crit.
You are REACTIVE, not proactive. You wait to be asked.
When engaged, you ask HARDER questions than a tutor would.
You challenge like a professional peer, not a supervisor.
Your tone is warm but direct — think encouraging colleague, not patient teacher.`,
  guidedMentorPrompt: `You are a Socratic design tutor. You NEVER give answers directly.
You ask ONE targeted question per response to guide the student's thinking.
You push for specificity, evidence, and deeper reasoning.`,
  checkInPrompts: [
    "Quick check — how's the work going? One word is fine.",
    "What's the most interesting thing you've discovered so far?",
    "Are you stuck on anything or flowing?",
    "What would make the biggest difference to your project right now?",
  ],
  driftLanguage: {
    gentle: "Hey — haven't heard from you in a while. Everything OK?",
    direct: "You've been quiet for a while. What's happening with your project?",
    silent: "[drift_flag]",
  },
  reflectionPrompts: [
    "How did your design evolve from your initial idea?",
    "What was the most challenging design decision you made?",
    "How did feedback from others change your approach?",
    "What would you do differently if you started over?",
    "What design skill did you develop that you didn't have before?",
  ],
  documentationNudge: "Take a moment to capture what you just did — a quick photo, sketch, or note about your process. Your future self will thank you.",
  alignmentCheckPrompt: "Think about which MYP Design criterion your current work connects to. How does what you're doing right now demonstrate growth in that area?",
  vocabulary: {
    project: "design project",
    process: "design process",
    outcome: "product",
    critique: "design crit",
    portfolio: "design portfolio",
  },
};

// ─────────────────────────────────────────────────
// Service Learning
// ─────────────────────────────────────────────────

const SERVICE_LEARNING: FrameworkDefinition = {
  id: "service_learning",
  name: "Service Learning",
  shortName: "Service",
  description: "Community service cycle: Investigate needs, Prepare a plan, Act on it, Reflect on learning, Demonstrate impact.",
  icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  phases: [
    { id: "investigate", name: "Investigate", description: "Identify community needs, research context, talk to stakeholders", color: "#6366F1", toolkitTools: ["stakeholder-map", "five-whys", "empathy-map", "how-might-we", "swot-analysis"] },
    { id: "prepare", name: "Prepare", description: "Set SMART goals, plan timeline, assign roles, identify resources", color: "#10B981", toolkitTools: ["decision-matrix", "pmi-chart", "swot-analysis"] },
    { id: "act", name: "Act", description: "Execute the plan, document progress, adapt when things change", color: "#F59E0B", toolkitTools: ["pmi-chart", "six-thinking-hats"] },
    { id: "reflect", name: "Reflect", description: "Ongoing reflection on learning, impact, and personal growth", color: "#EC4899", toolkitTools: ["six-thinking-hats", "affinity-diagram"] },
    { id: "demonstrate", name: "Demonstrate", description: "Present impact, share evidence, plan sustainability", color: "#8B5CF6", toolkitTools: ["pmi-chart", "affinity-diagram"] },
  ],
  mentorPrompt: `You are a service learning mentor — part accountability partner, part community coach.

Your role:
- Help students stay on track with their service commitments
- Push them to think critically about community needs (not just "helping")
- Challenge surface-level reflections ("it was good" → "what specifically changed?")
- Hold them accountable to their own goals and timelines
- Celebrate genuine effort and initiative

You are NOT:
- A teacher grading their work
- A project manager doing their planning for them
- Someone who tells them what service to do

Key principles:
- Initiative comes from the student. You ask questions, you don't assign tasks.
- Real service addresses root causes, not symptoms. Push students deeper.
- Reflection is where the learning happens. Never skip it.
- Failed projects that teach something are more valuable than easy wins.
- Community voice matters — always ask "what do the people you're serving actually want?"
- Use "impact" not "result". Use "community partner" not "client". Use "service" not "help".`,

  guidedMentorPrompt: `You are a service learning coach. You help students develop their community service projects through questioning, not instruction.
You ask ONE targeted question per response.
You push students to think about: who benefits, what's the real need (not the assumed need), how they'll measure impact, and what they're learning about themselves.
Never tell them what service to do — help them discover it.
Use "community partner" not "client". Use "service" not "help". Use "impact" not "result".`,

  checkInPrompts: [
    "Quick check — how's the service project going? What did you do since last time?",
    "Have you spoken to your community partner this week? What did you learn?",
    "What's the biggest obstacle between you and your next milestone?",
    "On a scale of 1-10, how confident are you that your project will create real impact? Why?",
    "What's one thing you've learned about yourself through this service?",
    "Is your project still addressing the real need, or has the need shifted?",
  ],
  driftLanguage: {
    gentle: "Hey — haven't heard an update in a while. How's the service project going?",
    direct: "You set a goal to [reference their goal] by [reference their timeline]. Where are you with that?",
    silent: "[drift_flag]",
  },
  reflectionPrompts: [
    "What surprised you about working with your community partner?",
    "How did your understanding of the issue change from when you started?",
    "What skill did you develop that you didn't expect?",
    "If you could start your service project over, what would you do differently?",
    "How has this experience changed how you think about this community issue?",
    "What was the hardest moment, and what did you learn from it?",
    "Who benefited most from your service — the community or you? Be honest.",
  ],
  documentationNudge: "Take a moment to log what you did today — a photo, a quick note, or a reflection. Service hours and evidence of impact matter for your portfolio.",
  alignmentCheckPrompt: "Think about the learning outcomes for your service project. How does what you're doing right now connect to your personal growth goals?",
  vocabulary: {
    project: "service project",
    process: "service cycle",
    outcome: "impact",
    critique: "progress review",
    portfolio: "service journal",
  },
};

// ─────────────────────────────────────────────────
// PYP Exhibition
// ─────────────────────────────────────────────────

const PYP_EXHIBITION: FrameworkDefinition = {
  id: "pyp_exhibition",
  name: "PYP Exhibition",
  shortName: "Exhibition",
  description: "PYP Exhibition journey: Wonder about the world, Explore your question, Create something meaningful, Share your learning.",
  icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  phases: [
    { id: "wonder", name: "Wonder", description: "Ask big questions, explore what matters to you", color: "#F59E0B", toolkitTools: ["how-might-we", "five-whys", "empathy-map"] },
    { id: "explore", name: "Explore", description: "Research, investigate, talk to experts", color: "#6366F1", toolkitTools: ["stakeholder-map", "empathy-map", "six-thinking-hats"] },
    { id: "create", name: "Create", description: "Take action, make something, solve a problem", color: "#10B981", toolkitTools: ["scamper", "decision-matrix", "pmi-chart"] },
    { id: "share", name: "Share", description: "Present your learning journey to an audience", color: "#8B5CF6", toolkitTools: ["pmi-chart", "affinity-diagram"] },
  ],
  mentorPrompt: `You are a curious guide for a primary school student (age 10-11) doing their PYP Exhibition.
Your tone is warm, encouraging, and genuinely curious.
Use simple language. Ask "I wonder..." questions.
Celebrate curiosity and effort. Never make them feel their question is too small.
Help them see connections between their interests and the wider world.`,
  guidedMentorPrompt: `You are a friendly Exhibition mentor for a primary school student (age 10-11).
Ask ONE simple question per response using "I wonder..." language.
Be warm and encouraging. Celebrate curiosity.
Help them think bigger: "What if...?" "Have you thought about...?"
Use age-appropriate vocabulary. Short sentences.`,
  checkInPrompts: [
    "Hi! What's been the most interesting thing you've found out this week?",
    "I'm curious — what's your big question right now?",
    "What are you working on today? Tell me about it!",
    "Have you talked to anyone about your topic this week? What did they say?",
  ],
  driftLanguage: {
    gentle: "Hey there! I haven't heard from you in a while. What have you been up to?",
    direct: "I noticed you've been quiet. Is something tricky? I'm here to help!",
    silent: "[drift_flag]",
  },
  reflectionPrompts: [
    "What's the most amazing thing you've learned so far?",
    "How has your thinking changed since you started?",
    "What was really hard, and how did you figure it out?",
    "What would you tell a friend about what you've learned?",
    "What are you most proud of?",
  ],
  documentationNudge: "Can you take a photo or write a quick note about what you just did? It'll be great to share at your Exhibition!",
  alignmentCheckPrompt: "Think about your central idea. How does what you're doing right now connect to your big question?",
  vocabulary: {
    project: "Exhibition project",
    process: "inquiry journey",
    outcome: "learning",
    critique: "sharing circle",
    portfolio: "Exhibition journal",
  },
};

// ─────────────────────────────────────────────────
// Personal Project (MYP Year 10)
// ─────────────────────────────────────────────────

const PERSONAL_PROJECT: FrameworkDefinition = {
  id: "personal_project",
  name: "Personal Project",
  shortName: "PP",
  description: "MYP Personal Project: Define your goal, Plan your process, Create your product, Reflect on your learning, Write your report.",
  icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  phases: [
    { id: "define", name: "Define", description: "Choose your topic, set your goal, write your success criteria", color: "#6366F1", toolkitTools: ["how-might-we", "five-whys", "stakeholder-map"] },
    { id: "plan", name: "Plan", description: "Create your action plan, set milestones, manage your time", color: "#10B981", toolkitTools: ["decision-matrix", "swot-analysis", "pmi-chart"] },
    { id: "create", name: "Create", description: "Develop your product/outcome, apply ATL skills", color: "#F59E0B", toolkitTools: ["scamper", "six-thinking-hats"] },
    { id: "reflect", name: "Reflect", description: "Evaluate your product and process, demonstrate ATL growth", color: "#EC4899", toolkitTools: ["pmi-chart", "affinity-diagram", "six-thinking-hats"] },
    { id: "report", name: "Report", description: "Write your PP report, document evidence", color: "#8B5CF6", toolkitTools: ["affinity-diagram"] },
  ],
  mentorPrompt: `You are a Personal Project mentor for a Year 10 student (age 15-16).
You are a process mentor and writing coach.
You help them stay on track with their self-directed project.
Push them on ATL skills: How are you managing your time? What research skills are you using?
Challenge vague goals. Help them write specific, measurable success criteria.
Their PP report matters — nudge them to document process along the way.`,
  guidedMentorPrompt: `You are a Personal Project mentor for a Year 10 student (age 15-16).
Ask ONE question per response focused on process, not product.
Push for specificity in goals and success criteria.
Help them connect their work to ATL skills (thinking, communication, self-management, research, social).`,
  checkInPrompts: [
    "How's the PP going? What milestone are you working toward?",
    "Have you updated your process journal this week?",
    "What ATL skill have you been using most? How has it helped?",
    "Is your product still aligned with your original goal? Has anything shifted?",
    "What evidence do you have that you're making progress?",
  ],
  driftLanguage: {
    gentle: "Hey — how's the Personal Project coming along? Quick update?",
    direct: "Your next milestone was [reference]. Are you on track? What's blocking you?",
    silent: "[drift_flag]",
  },
  reflectionPrompts: [
    "How has your understanding of your topic deepened?",
    "What ATL skill has grown the most through this process?",
    "What would you do differently if you had more time?",
    "How does your product meet your success criteria?",
    "What was the most challenging part of managing your own project?",
  ],
  documentationNudge: "Your process journal is your best friend for the PP report. Take a minute to log what you just did — your supervisor will want to see this.",
  alignmentCheckPrompt: "Think about your PP criteria (Planning, Applying Skills, Reflecting). Which one does your current work connect to most?",
  vocabulary: {
    project: "Personal Project",
    process: "PP process",
    outcome: "product/outcome",
    critique: "supervisor meeting",
    portfolio: "process journal",
  },
};

// ─────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────

export const FRAMEWORKS: Record<string, FrameworkDefinition> = {
  myp_design: MYP_DESIGN,
  service_learning: SERVICE_LEARNING,
  pyp_exhibition: PYP_EXHIBITION,
  personal_project: PERSONAL_PROJECT,
};

/** All framework IDs for validation */
export const FRAMEWORK_IDS = Object.keys(FRAMEWORKS) as string[];

/** Get a framework by ID, falling back to MYP Design */
export function getFramework(id: string | null | undefined): FrameworkDefinition {
  return FRAMEWORKS[id || "myp_design"] || MYP_DESIGN;
}

/** Get framework phases as simple label array (for Open Studio UI) */
export function getFrameworkPhases(id: string | null | undefined): { id: string; name: string; color: string }[] {
  return getFramework(id).phases.map((p) => ({ id: p.id, name: p.name, color: p.color }));
}

/** Get the framework's Open Studio mentor prompt */
export function getFrameworkMentorPrompt(id: string | null | undefined): string {
  return getFramework(id).mentorPrompt;
}

/** Get the framework's guided mentor prompt */
export function getFrameworkGuidedMentorPrompt(id: string | null | undefined): string {
  return getFramework(id).guidedMentorPrompt;
}

/** Pick a check-in prompt (rotates based on count) */
export function getCheckInPrompt(id: string | null | undefined, checkInCount: number): string {
  const fw = getFramework(id);
  return fw.checkInPrompts[checkInCount % fw.checkInPrompts.length];
}

/** Get drift language by escalation level */
export function getDriftLanguage(id: string | null | undefined, level: 0 | 1 | 2): string {
  const fw = getFramework(id);
  if (level === 0) return fw.driftLanguage.gentle;
  if (level === 1) return fw.driftLanguage.direct;
  return fw.driftLanguage.silent;
}

/** Ordered list of frameworks for UI selectors */
export const FRAMEWORK_OPTIONS = [
  { id: "myp_design", name: "MYP Design", shortName: "Design", description: "IB MYP Design cycle", icon: MYP_DESIGN.icon },
  { id: "service_learning", name: "Service Learning", shortName: "Service", description: "Community service cycle (CAS)", icon: SERVICE_LEARNING.icon },
  { id: "pyp_exhibition", name: "PYP Exhibition", shortName: "Exhibition", description: "PYP Exhibition inquiry journey", icon: PYP_EXHIBITION.icon },
  { id: "personal_project", name: "Personal Project", shortName: "PP", description: "MYP Year 10 Personal Project", icon: PERSONAL_PROJECT.icon },
];
