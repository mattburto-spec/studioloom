/**
 * Station 0: Design Identity Card — Content Pool
 *
 * No authored text content. All interaction is visual selection.
 * Students pick a palette (1), tools (3), and workspace items (4).
 *
 * Tool → Archetype weights: each tool has a unique fingerprint.
 * Workspace → Working style signals (not archetype scoring).
 *
 * @see docs/specs/discovery-engine-build-plan.md Part 2, Station 0
 */

import type { ToolDefinition, WorkspaceItem } from '../types';

// ─── Color Palettes ──────────────────────────────────────────────

export interface PaletteOption {
  id: string;
  label: string;
  colors: string[];  // 4-5 hex colors
  vibe: string;      // one-word descriptor shown on hover
}

export const PALETTES: PaletteOption[] = [
  {
    id: 'warm',
    label: 'Warm',
    colors: ['#FF6B35', '#F7C59F', '#EFEFD0', '#004E89', '#1A659E'],
    vibe: 'Energetic',
  },
  {
    id: 'cool',
    label: 'Cool',
    colors: ['#2D3047', '#419D78', '#E0A458', '#93B7BE', '#F1EDEE'],
    vibe: 'Calm',
  },
  {
    id: 'bold',
    label: 'Bold',
    colors: ['#FF0054', '#BB33FF', '#00F5D4', '#FEE440', '#F15BB5'],
    vibe: 'Loud',
  },
  {
    id: 'earth',
    label: 'Earth',
    colors: ['#606C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25'],
    vibe: 'Grounded',
  },
  {
    id: 'neon',
    label: 'Neon',
    colors: ['#08F7FE', '#FE53BB', '#F5D300', '#09FBD3', '#FF2281'],
    vibe: 'Electric',
  },
];

// ─── Tool Definitions ────────────────────────────────────────────

/**
 * 12 tools. Students pick 3.
 * Each maps to archetype weights (0-3 per archetype).
 * Every tool has a unique fingerprint — no two tools
 * produce the same archetype signal pattern.
 */
export const TOOLS: ToolDefinition[] = [
  {
    id: 'hammer',
    label: 'Hammer',
    icon: '🔨',
    archetypeWeights: { Maker: 3, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 },
  },
  {
    id: 'magnifying_glass',
    label: 'Magnifying Glass',
    icon: '🔍',
    archetypeWeights: { Maker: 0, Researcher: 3, Leader: 0, Communicator: 0, Creative: 0, Systems: 0 },
  },
  {
    id: 'clipboard',
    label: 'Clipboard',
    icon: '📋',
    archetypeWeights: { Maker: 0, Researcher: 0, Leader: 3, Communicator: 0, Creative: 0, Systems: 1 },
  },
  {
    id: 'megaphone',
    label: 'Megaphone',
    icon: '📣',
    archetypeWeights: { Maker: 0, Researcher: 0, Leader: 1, Communicator: 3, Creative: 0, Systems: 0 },
  },
  {
    id: 'paintbrush',
    label: 'Paintbrush',
    icon: '🖌️',
    archetypeWeights: { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 3, Systems: 0 },
  },
  {
    id: 'gear',
    label: 'Gear',
    icon: '⚙️',
    archetypeWeights: { Maker: 0, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 3 },
  },
  {
    id: 'pencil',
    label: 'Pencil',
    icon: '✏️',
    archetypeWeights: { Maker: 1, Researcher: 0, Leader: 0, Communicator: 2, Creative: 1, Systems: 0 },
  },
  {
    id: 'microscope',
    label: 'Microscope',
    icon: '🔬',
    archetypeWeights: { Maker: 0, Researcher: 2, Leader: 0, Communicator: 0, Creative: 0, Systems: 2 },
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: '📷',
    archetypeWeights: { Maker: 0, Researcher: 1, Leader: 0, Communicator: 2, Creative: 1, Systems: 0 },
  },
  {
    id: 'laptop',
    label: 'Laptop',
    icon: '💻',
    archetypeWeights: { Maker: 0, Researcher: 1, Leader: 0, Communicator: 1, Creative: 0, Systems: 2 },
  },
  {
    id: 'scissors',
    label: 'Scissors',
    icon: '✂️',
    archetypeWeights: { Maker: 2, Researcher: 0, Leader: 0, Communicator: 0, Creative: 2, Systems: 0 },
  },
  {
    id: 'compass_drawing',
    label: 'Drawing Compass',
    icon: '📐',
    archetypeWeights: { Maker: 1, Researcher: 0, Leader: 0, Communicator: 0, Creative: 0, Systems: 3 },
  },
];

// ─── Workspace Items ─────────────────────────────────────────────

/**
 * 16 workspace items. Students pick 4.
 * These contribute to WORKING STYLE, not archetype scoring.
 */
export const WORKSPACE_ITEMS: WorkspaceItem[] = [
  { id: 'tidy_desk', label: 'Tidy desk', icon: '🗂️', signal: 'organized_space', trait: 'structured' },
  { id: 'messy_desk', label: 'Messy desk with projects', icon: '🎨', signal: 'creative_chaos', trait: 'flexible' },
  { id: 'whiteboard', label: 'Whiteboard with plans', icon: '📝', signal: 'visual_planning', trait: 'planner' },
  { id: 'sticky_notes', label: 'Sticky notes everywhere', icon: '📌', signal: 'quick_capture', trait: 'improviser' },
  { id: 'plants', label: 'Plants', icon: '🌱', signal: 'living_things', trait: 'marathoner' },
  { id: 'clock', label: 'Clock', icon: '🕐', signal: 'time_awareness', trait: 'structured' },
  { id: 'headphones', label: 'Headphones', icon: '🎧', signal: 'focus_zone', trait: 'solo_worker' },
  { id: 'two_chairs', label: 'Two chairs', icon: '💬', signal: 'space_for_others', trait: 'collaborator' },
  { id: 'reference_books', label: 'Reference books', icon: '📚', signal: 'research_oriented', trait: 'researcher' },
  { id: 'prototype_models', label: 'Prototype models', icon: '🏗️', signal: 'making', trait: 'maker_doer' },
  { id: 'inspiration_board', label: 'Inspiration board', icon: '🖼️', signal: 'visual_thinker', trait: 'creative' },
  { id: 'tool_organizer', label: 'Tool organizer', icon: '🔧', signal: 'systematic', trait: 'systems_thinker' },
  { id: 'coffee_setup', label: 'Coffee/tea setup', icon: '☕', signal: 'comfort_ritual', trait: 'marathoner' },
  { id: 'calendar', label: 'Calendar', icon: '📅', signal: 'deadline_aware', trait: 'planner' },
  { id: 'sketchbook', label: 'Sketchbook', icon: '📓', signal: 'ideation', trait: 'creative' },
  { id: 'collab_board', label: 'Collaboration board', icon: '🤝', signal: 'team_space', trait: 'collaborator' },
];

// ─── Kit Dialogue for Station 0 ─────────────────────────────────

export const STATION_0_KIT_DIALOGUE = {
  intro: "Before we get into the big stuff, let's set up your space. Pick the things that feel like YOU — there's no wrong answer here.",
  palette_prompt: "First up — what colours feel right? Pick the palette that vibes with you.",
  palette_response: (paletteId: string) => {
    const responses: Record<string, string> = {
      warm: "Warm tones — you like things that feel alive and inviting. I can work with that.",
      cool: "Cool and collected. You've got a calm energy. That'll come in handy later.",
      bold: "Bold. You're not here to blend in. I like it.",
      earth: "Earthy — grounded, real, no nonsense. Says a lot about how you think.",
      neon: "Electric. You want things to pop. That energy's going to show up in your work.",
    };
    return responses[paletteId] ?? "Nice choice. That says something about you.";
  },
  tools_prompt: "Now pick 3 tools. Not the ones you're 'supposed' to pick — the ones you'd actually grab.",
  tools_response: "Interesting combo. Those three together tell me something — but we'll get to that.",
  workspace_prompt: "Last one — pick 4 things for your workspace. What would make it feel like yours?",
  workspace_response: "That's your space. Remember it — it might tell us more than you think.",
  complete: "Alright, identity card done. Let's head to the campfire — I've got some questions for you.",
};
