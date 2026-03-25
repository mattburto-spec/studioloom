// Quest Prompt Composition
// 5-layer system: Framework → Mentor → Help Intensity → Phase Rules → Student Context

import type { QuestJourney, QuestMilestone, QuestEvidence, HelpIntensity } from './types';
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
  if (framework) {
    parts.push(`## Framework: ${framework.name}\n${framework.mentorPrompt}`);
  }

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
  const projectWord = framework?.vocabulary?.project || 'project';
  parts.push(`## Universal Rules
- NEVER write the student's work for them. Ask questions, give examples, suggest directions.
- Keep responses under 150 words unless the student asks for more detail.
- Use "${projectWord}" vocabulary (not generic "project" language).
- Reference their discovery profile and contract when relevant.
- If they seem off-track, reference their original project statement.
- Evidence must be approved by the teacher before milestones can be marked complete.`);

  return parts.join('\n\n');
}

function buildPhaseRules(ctx: QuestPromptContext): string {
  const mentor = getMentor(ctx.journey.mentor_id);

  switch (ctx.journey.phase) {
    case 'discovery':
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

  const activeMilestones = ctx.milestones.filter(m => m.status === 'active');
  const overdueMilestones = ctx.milestones.filter(m => m.status === 'overdue');
  if (activeMilestones.length > 0) {
    parts.push(`Active milestones: ${activeMilestones.map(m => m.title).join(', ')}`);
  }
  if (overdueMilestones.length > 0) {
    parts.push(`OVERDUE milestones: ${overdueMilestones.map(m => m.title).join(', ')}`);
  }

  const h = journey.health_score;
  if (h.momentum === 'red' || h.engagement === 'red') {
    parts.push(`Health concern: momentum=${h.momentum}, engagement=${h.engagement}`);
  }

  if (journey.sessions_remaining != null) {
    parts.push(`Sessions remaining: ${journey.sessions_remaining}`);
  }

  return parts.join('\n');
}
