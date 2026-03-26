/**
 * Station 4: The Window — Community Scene Hotspots
 *
 * Content: 12 scene hotspots, scale/urgency/proximity sliders,
 * Kit text prompt variants based on click patterns.
 *
 * v1: Hotspots described with text cards (no image yet).
 * v2: ChatGPT-generated bird's-eye community scene image.
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 4
 */

import type { SceneHotspot } from '../types';

// ─── Scene Hotspots ─────────────────────────────────────────────

export const SCENE_HOTSPOTS: SceneHotspot[] = [
  { id: 'lonely_student', label: 'Student sitting alone', description: 'A student sitting by themselves at lunch, looking at their phone.', position: { x: 25, y: 35 }, category: 'people', archetype_signal: { Communicator: 1 } },
  { id: 'broken_fountain', label: 'Broken water fountain', description: 'Water fountain with an "out of order" sign taped on.', position: { x: 45, y: 20 }, category: 'system', archetype_signal: { Systems: 1, Maker: 1 } },
  { id: 'messy_artroom', label: 'Cluttered art room', description: 'Art room visible through the window — cluttered and disorganized.', position: { x: 60, y: 25 }, category: 'system', archetype_signal: { Systems: 1, Creative: 1 } },
  { id: 'exclusion', label: 'Group excluding someone', description: 'A group of students with body language that shows they\'re excluding someone.', position: { x: 30, y: 55 }, category: 'people', archetype_signal: { Communicator: 1, Leader: 1 } },
  { id: 'steep_ramp', label: 'Too-steep wheelchair ramp', description: 'A wheelchair ramp that\'s clearly too steep to use safely.', position: { x: 15, y: 45 }, category: 'system', archetype_signal: { Systems: 2 } },
  { id: 'dead_garden', label: 'Neglected school garden', description: 'School garden with wilted plants and empty beds.', position: { x: 70, y: 40 }, category: 'system', archetype_signal: { Maker: 1, Researcher: 1 } },
  { id: 'overwhelmed_teacher', label: 'Overwhelmed teacher', description: 'Teacher at their desk, head in hands, papers everywhere.', position: { x: 50, y: 50 }, category: 'people', archetype_signal: { Leader: 1, Communicator: 1 } },
  { id: 'littering', label: 'Overflowing bins', description: 'Trash near bins that are clearly overflowing.', position: { x: 80, y: 60 }, category: 'system', archetype_signal: { Systems: 1 } },
  { id: 'elderly_crossing', label: 'Struggling at crossing', description: 'An elderly person looking uncertain at a busy road crossing.', position: { x: 85, y: 35 }, category: 'people', archetype_signal: { Communicator: 1, Systems: 1 } },
  { id: 'closed_shop', label: 'Shop closing down', description: 'Small shop with a "closing down" sign in the window.', position: { x: 75, y: 20 }, category: 'system', archetype_signal: { Researcher: 1, Systems: 1 } },
  { id: 'broken_bench', label: 'Broken park bench', description: 'Park bench with a broken slat, tape holding it together.', position: { x: 90, y: 50 }, category: 'system', archetype_signal: { Maker: 2 } },
  { id: 'lost_kid', label: 'Lost-looking child', description: 'A young child looking around uncertainly, nobody nearby.', position: { x: 40, y: 70 }, category: 'people', archetype_signal: { Communicator: 2 } },
];

// ─── Click Pattern Analysis ─────────────────────────────────────

export type ClickPattern = 'people' | 'systems' | 'mixed';

export function analyzeClickPattern(clickedIds: string[]): ClickPattern {
  let people = 0;
  let systems = 0;

  for (const id of clickedIds) {
    const hotspot = SCENE_HOTSPOTS.find((h) => h.id === id);
    if (!hotspot) continue;
    if (hotspot.category === 'people') people++;
    else systems++;
  }

  if (people > systems * 1.5) return 'people';
  if (systems > people * 1.5) return 'systems';
  return 'mixed';
}

// ─── Kit Text Prompt Variants ───────────────────────────────────

export function getTextPrompt(pattern: ClickPattern, clickedIds: string[]): string {
  const labels = clickedIds
    .map((id) => SCENE_HOTSPOTS.find((h) => h.id === id)?.label)
    .filter(Boolean)
    .slice(0, 2);
  const labelStr = labels.join(' and ');

  switch (pattern) {
    case 'people':
      return `You went straight to the people. ${labelStr}. You see who's struggling before you see what's broken. So tell me — who has it harder than they should, and what makes it hard?`;
    case 'systems':
      return `You looked at ${labelStr} — the broken things, the badly designed things. You see systems. So tell me — what's something you deal with regularly that's way more complicated than it needs to be?`;
    case 'mixed':
      return `You looked at everything — the people AND the broken stuff. That's rare. Most people lean one way. Here's your question: if you could fix ONE thing you see every single day, what would it be and why does it bother you?`;
  }
}

// ─── Kit Dialogue ───────────────────────────────────────────────

export const STATION_4_KIT_DIALOGUE = {
  intro: "Time to look outward. I'm going to show you a scene — a school and the community around it. Look closely. What catches your eye says more than you think.",
  story: "I used to walk the same route to school every day and never notice anything. Then one day a younger kid asked me why the crossing was so dangerous. I'd walked past it 500 times. Sometimes you need someone to point at it before you see it.",
  scene_prompt: "Look around the scene. Tap anything that stands out to you — anything that makes you think 'that's not right' or 'someone should do something about that.' Tap at least 3.",
  zoom_prompt: "You've spotted some things. Which ONE bothers you the most? Pick the one you'd actually want to do something about.",
  sliders_intro: "Now let's zoom in on that feeling. How big is this problem, really?",
  slider_scale: { label: 'Scale', left: 'Just affects a few people', right: 'Affects everyone' },
  slider_urgency: { label: 'Urgency', left: 'Can wait', right: 'Needs fixing now' },
  slider_proximity: { label: 'Proximity', left: "It's far from my life", right: 'I see this every day' },
  text_intro: "Now put it in your own words.",
  reveal: "You can see problems that most people walk past. That's a skill. The question is — which problems are YOUR problems to solve?",
};
