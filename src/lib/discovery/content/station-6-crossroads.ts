/**
 * Station 6: The Crossroads — Content Pool
 *
 * 3 AI-generated doors (or template fallbacks), fear cards, and Kit dialogue.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2 (Station 6)
 * @see docs/specs/discovery-engine-build-plan.md Part 9 (Template Doors)
 */

import type { DesignArchetype, TemplateDoor, FearCard, DiscoveryMode } from '../types';

// ─── Fear Cards ─────────────────────────────────────────────────

export const FEAR_CARDS: FearCard[] = [
  {
    id: 'failing_publicly',
    label: 'Failing publicly',
    icon: '💥',
    kitResponse: `Yeah. Presenting something you made and watching people not get it — that's a specific kind of horrible. Here's what I've learned though: the students who fail publicly and keep going? They become the ones other students trust. Because everyone knows they're not faking it. Your first version will probably be rough. Show it anyway. The feedback from a rough version is worth more than the silence around a perfect one you never share.`,
  },
  {
    id: 'not_finishing',
    label: 'Not finishing',
    icon: '⏰',
    kitResponse: `This one's real. I've watched talented students pour weeks into something and run out of time with a half-built project on their desk. It's the worst. Here's the trick: plan backwards from the deadline. What does "done enough" look like? Not perfect — done enough. If you know that answer on day one, you'll finish. I'll help you figure that out.`,
  },
  {
    id: 'it_being_boring',
    label: 'It being boring',
    icon: '😴',
    kitResponse: `You're scared of making something nobody cares about. That's actually a good fear — it means you care about impact, not just grades. Here's how you avoid boring: start with a REAL problem that affects REAL people. If your project makes one person's day slightly better, it's not boring. Boring is when you design for a brief instead of a person.`,
  },
  {
    id: 'nobody_caring',
    label: 'Nobody caring',
    icon: '👻',
    kitResponse: `Showing your work and having people walk past. I've been there. Here's the thing — if your project solves a real problem for a real person, that person will care. You don't need everyone. You need one person who says "this matters to me." We're going to find that person.`,
  },
  {
    id: 'not_good_enough',
    label: 'Not being good enough',
    icon: '📏',
    kitResponse: `Comparing yourself to the kid who seems to nail everything. I know. Here's something nobody tells you: that kid is comparing themselves to someone too. "Good enough" is a moving target. The question isn't whether your work is as good as theirs — it's whether YOUR work is better than YOUR last attempt. That's the only comparison that matters.`,
  },
];

// ─── Template Doors — Mode 1 (Design, project-scale) ───────────

const MODE_1_DOORS: Record<DesignArchetype, TemplateDoor[]> = {
  Maker: [
    {
      title: 'Fix Something Broken',
      description: 'Find something at school that doesn\'t work and redesign it. Start in the workshop by the end of the week.',
      type: 'sweet_spot',
      firstStep: 'Walk around school with fresh eyes — find 3 things that frustrate people',
      timeEstimate: '3-4 weeks',
      archetype: 'Maker',
    },
    {
      title: 'Teach Someone to Make',
      description: 'Create a workshop that teaches others a skill you have. You\'ll have to think like a teacher, not just a maker.',
      type: 'stretch',
      firstStep: 'Pick ONE skill you know well and break it into 5 simple steps',
      timeEstimate: '3-4 weeks',
      archetype: 'Maker',
    },
    {
      title: 'Make the Invisible Visible',
      description: 'Build something that shows a hidden problem. Data becomes physical. Numbers become objects.',
      type: 'surprise',
      firstStep: 'Find a problem people know about but can\'t SEE — then sketch 3 ways to make it visible',
      timeEstimate: '4-5 weeks',
      archetype: 'Maker',
    },
  ],
  Researcher: [
    {
      title: 'Deep Dive',
      description: 'Pick a question nobody\'s answered properly and investigate it. Your deliverable is evidence, not opinion.',
      type: 'sweet_spot',
      firstStep: 'Write down 5 questions that bother you — pick the one with the least satisfying Google answer',
      timeEstimate: '3-5 weeks',
      archetype: 'Researcher',
    },
    {
      title: 'Research to Action',
      description: 'Turn your findings into something people can actually use. A tool, a guide, a resource.',
      type: 'stretch',
      firstStep: 'Interview 3 people affected by the issue — don\'t read about it, talk to them',
      timeEstimate: '4-5 weeks',
      archetype: 'Researcher',
    },
    {
      title: 'Cross-Pollinate',
      description: 'Connect two fields nobody thought were related. Find the pattern between things.',
      type: 'surprise',
      firstStep: 'List your top 3 interests and your top 3 irritations — look for unexpected overlaps',
      timeEstimate: '4-6 weeks',
      archetype: 'Researcher',
    },
  ],
  Leader: [
    {
      title: 'Rally a Team',
      description: 'Organize a group around a cause that matters to you. Your job is to make something happen, not do it all yourself.',
      type: 'sweet_spot',
      firstStep: 'Talk to 5 people about the issue and find 2 who care enough to help',
      timeEstimate: '4-5 weeks',
      archetype: 'Leader',
    },
    {
      title: 'Lead by Making',
      description: 'Don\'t just plan — build something yourself first. Then bring people in.',
      type: 'stretch',
      firstStep: 'Spend one session making a rough prototype alone — THEN show it to others',
      timeEstimate: '3-4 weeks',
      archetype: 'Leader',
    },
    {
      title: 'Empower Someone Else',
      description: 'Help another person find and complete their project. Your success is measured by theirs.',
      type: 'surprise',
      firstStep: 'Find someone who\'s stuck on a project and spend 30 minutes asking them questions',
      timeEstimate: '4-6 weeks',
      archetype: 'Leader',
    },
  ],
  Communicator: [
    {
      title: 'Tell a Story',
      description: 'Find a story that needs telling and tell it in a way that\'s hard to ignore.',
      type: 'sweet_spot',
      firstStep: 'Talk to someone whose story isn\'t being heard — just listen for 20 minutes',
      timeEstimate: '3-4 weeks',
      archetype: 'Communicator',
    },
    {
      title: 'Change a Mind',
      description: 'Design something that shifts how people think about an issue. Not propaganda — perspective.',
      type: 'stretch',
      firstStep: 'Find an issue where you disagree with most people — then interview someone on the other side',
      timeEstimate: '4-5 weeks',
      archetype: 'Communicator',
    },
    {
      title: 'Bridge the Gap',
      description: 'Connect two groups who don\'t understand each other. Your job is translation.',
      type: 'surprise',
      firstStep: 'Identify two groups at school who never interact — observe both for a week',
      timeEstimate: '4-6 weeks',
      archetype: 'Communicator',
    },
  ],
  Creative: [
    {
      title: 'Reimagine Something Old',
      description: 'Take something everyone\'s used to and make it feel new.',
      type: 'sweet_spot',
      firstStep: 'Pick an everyday object or space and list 10 things wrong with it',
      timeEstimate: '3-4 weeks',
      archetype: 'Creative',
    },
    {
      title: 'Beauty with Purpose',
      description: 'Create something beautiful that also solves a problem. Form AND function.',
      type: 'stretch',
      firstStep: 'Find a functional object that\'s ugly — sketch 3 ways to make it beautiful WITHOUT losing function',
      timeEstimate: '4-5 weeks',
      archetype: 'Creative',
    },
    {
      title: 'Creative Toolkit',
      description: 'Design tools or resources that help OTHER people be creative.',
      type: 'surprise',
      firstStep: 'Watch 3 people try to do something creative — note where they get stuck',
      timeEstimate: '4-6 weeks',
      archetype: 'Creative',
    },
  ],
  Systems: [
    {
      title: 'Fix the System',
      description: 'Find a broken process and redesign it so it actually works.',
      type: 'sweet_spot',
      firstStep: 'Map out a process that frustrates you — every step, every handoff, every delay',
      timeEstimate: '3-5 weeks',
      archetype: 'Systems',
    },
    {
      title: 'Make Complexity Simple',
      description: 'Take something confusing and make it understandable for real people.',
      type: 'stretch',
      firstStep: 'Find something important that nobody understands — test by asking 3 people to explain it',
      timeEstimate: '4-5 weeks',
      archetype: 'Systems',
    },
    {
      title: 'Connect the Dots',
      description: 'Find a pattern nobody else has noticed and make it useful.',
      type: 'surprise',
      firstStep: 'Look at data you encounter daily (timetable, bus routes, cafeteria) — what pattern do you see?',
      timeEstimate: '4-6 weeks',
      archetype: 'Systems',
    },
  ],
};

// ─── Template Doors — Mode 2 (Service/PP/PYPx, journey-scale) ──

const MODE_2_DOORS: Record<DesignArchetype, TemplateDoor[]> = {
  Maker: [
    {
      title: 'Build for Someone',
      description: 'Find a person or group in your community who needs something made. Spend the first weeks understanding THEM, not building.',
      type: 'sweet_spot',
      firstStep: 'Identify 3 people/groups who might need something made — interview each for 15 minutes',
      timeEstimate: '8-12 weeks',
      archetype: 'Maker',
    },
    {
      title: 'Repair What\'s Broken',
      description: 'Something in your world is failing — a space, a system, a resource. Document it. Understand why. Then fix it.',
      type: 'stretch',
      firstStep: 'Photograph 5 broken things in your community — pick the one that affects the most people',
      timeEstimate: '10-14 weeks',
      archetype: 'Maker',
    },
    {
      title: 'Prototype a Future',
      description: 'What should exist but doesn\'t yet? Design and build it. Start rough, test with real people, iterate.',
      type: 'surprise',
      firstStep: 'Write a paragraph about something that SHOULD exist — then sketch your version',
      timeEstimate: '10-16 weeks',
      archetype: 'Maker',
    },
  ],
  Researcher: [
    {
      title: 'Investigate and Illuminate',
      description: 'A question matters to you but nobody\'s answering it properly. Gather real evidence from real people. Turn findings into something useful.',
      type: 'sweet_spot',
      firstStep: 'Write your research question in one sentence — then ask 5 people if they care about the answer',
      timeEstimate: '8-14 weeks',
      archetype: 'Researcher',
    },
    {
      title: 'Understand to Change',
      description: 'Pick something everyone accepts as "just how it is." Research why. Find who it affects most. Propose something better.',
      type: 'stretch',
      firstStep: 'List 3 things at school/in your community that "everyone just accepts" — pick the one that bothers you most',
      timeEstimate: '10-14 weeks',
      archetype: 'Researcher',
    },
    {
      title: 'Map the Unseen',
      description: 'There\'s a pattern, system, or story in your community that most people can\'t see. Uncover it. Make it visible.',
      type: 'surprise',
      firstStep: 'Spend one week observing something nobody pays attention to — take notes every day',
      timeEstimate: '10-16 weeks',
      archetype: 'Researcher',
    },
  ],
  Leader: [
    {
      title: 'Mobilise',
      description: 'Find a cause that matters and bring people together around it. Your project is the people and what they accomplish together.',
      type: 'sweet_spot',
      firstStep: 'Talk to 10 people about an issue you care about — find the 3 most passionate',
      timeEstimate: '8-14 weeks',
      archetype: 'Leader',
    },
    {
      title: 'Grow Someone Else',
      description: 'Find a person or group who could do more with the right support. Your success is measured by their growth.',
      type: 'stretch',
      firstStep: 'Identify someone who has potential but is held back by something specific — offer to help',
      timeEstimate: '10-14 weeks',
      archetype: 'Leader',
    },
    {
      title: 'Design the Process',
      description: 'Don\'t just run a project — design HOW a group should work together. Create a system for effective collaboration.',
      type: 'surprise',
      firstStep: 'Observe 3 group projects this week — note what works and what fails about how they collaborate',
      timeEstimate: '10-16 weeks',
      archetype: 'Leader',
    },
  ],
  Communicator: [
    {
      title: 'Amplify a Voice',
      description: 'Someone\'s story isn\'t being heard. Find them. Listen deeply. Tell their story in a way that makes people stop.',
      type: 'sweet_spot',
      firstStep: 'Find one person in your community whose perspective is being overlooked — sit with them for 30 minutes',
      timeEstimate: '8-12 weeks',
      archetype: 'Communicator',
    },
    {
      title: 'Start a Conversation',
      description: 'Two groups or perspectives aren\'t talking to each other. Build the bridge and get the conversation started.',
      type: 'stretch',
      firstStep: 'Identify two groups who disagree or ignore each other — interview one person from each side',
      timeEstimate: '10-14 weeks',
      archetype: 'Communicator',
    },
    {
      title: 'Create Understanding',
      description: 'Something complex needs to be explained to people who matter. Find the right medium, tone, and moment.',
      type: 'surprise',
      firstStep: 'Pick a topic most people find confusing — explain it to 3 people and note where they get lost',
      timeEstimate: '10-16 weeks',
      archetype: 'Communicator',
    },
  ],
  Creative: [
    {
      title: 'Create Something That Matters',
      description: 'Beauty for its own sake is fine — but beauty that serves a purpose is powerful. Make something new that also makes something better.',
      type: 'sweet_spot',
      firstStep: 'Find a space, experience, or object that\'s functional but soulless — redesign it with meaning',
      timeEstimate: '8-12 weeks',
      archetype: 'Creative',
    },
    {
      title: 'Reclaim and Reimagine',
      description: 'Take something that\'s been neglected, forgotten, or written off. See what it could become. Give it new life.',
      type: 'stretch',
      firstStep: 'Find something abandoned or overlooked in your area — document it, research its history',
      timeEstimate: '10-14 weeks',
      archetype: 'Creative',
    },
    {
      title: 'Design an Experience',
      description: 'Don\'t just make an object. Design how someone FEELS when they encounter your work. The experience IS the project.',
      type: 'surprise',
      firstStep: 'Think about a moment that moved you — what made it powerful? Now design that feeling for someone else',
      timeEstimate: '10-16 weeks',
      archetype: 'Creative',
    },
  ],
  Systems: [
    {
      title: 'Redesign a Process',
      description: 'Find a system that\'s failing the people who use it. Map it, understand why it breaks, and redesign it so it works.',
      type: 'sweet_spot',
      firstStep: 'Pick a process you use every week — map every step and mark where it fails',
      timeEstimate: '8-14 weeks',
      archetype: 'Systems',
    },
    {
      title: 'Simplify the Complex',
      description: 'Something important is too hard for people to understand or use. Make it accessible without making it stupid.',
      type: 'stretch',
      firstStep: 'Find an important system or process that confuses people — interview 3 users about their pain points',
      timeEstimate: '10-14 weeks',
      archetype: 'Systems',
    },
    {
      title: 'Find the Leverage Point',
      description: 'In every broken system there\'s one small change that would fix a lot. Find it. Prove it. Propose it.',
      type: 'surprise',
      firstStep: 'Trace a problem backward — what causes it? What causes THAT? Find the root',
      timeEstimate: '10-16 weeks',
      archetype: 'Systems',
    },
  ],
};

// ─── Exports ────────────────────────────────────────────────────

/**
 * Get template doors for a given archetype and mode.
 * These are used as fallbacks when AI generation fails,
 * and as reference for the AI generation prompt.
 */
export function getTemplateDoors(
  archetype: DesignArchetype,
  mode: DiscoveryMode,
): TemplateDoor[] {
  const doorSet = mode === 'mode_2' ? MODE_2_DOORS : MODE_1_DOORS;
  return doorSet[archetype] ?? doorSet.Maker;
}

/**
 * Kit's intro dialogue for Station 6.
 */
export const S6_KIT_DIALOGUE = {
  intro: "This is the bit that scares people. Three directions. One choice. But listen — I'm going to tell you something nobody tells students: the 'perfect project' doesn't exist. I've never seen one. What I HAVE seen is someone pick a decent direction and make it extraordinary through sheer stubbornness and curiosity. The door you choose matters less than what you do after you walk through it.",
  afterExploring: "You've looked behind all three. Your face changed on Door {doorNum} — did you notice that?",
  customDoorPrompt: "None of these feel right? Tell me what you're thinking. Sometimes the best direction is one the AI didn't see coming.",
  beforeFear: "One more thing before you commit. Everyone's scared of something when they start a project. Being honest about it doesn't make it more likely — it makes it less powerful.",
  afterFear: "Good. Now that fear's out in the open, it can't sneak up on you. Let's keep going.",
  beforeChoose: "Time to commit. Not forever — just for now. You can always pivot later. But you need a direction to start moving.",
};

/**
 * Kit's dialogue for the "generating" loading state.
 */
export const S6_GENERATING_MESSAGES = [
  "Thinking about everything you've told me...",
  "Three doors are forming. Give me a moment.",
  "Matching your profile to project directions...",
];
