# Safety Learning Modules

Rich, interactive learning experiences that replace flat LearnCards with pedagogically-sequenced content blocks.

## What is a Learning Module?

A **Learning Module** is a complete learning journey designed for a specific safety badge. Instead of plain text cards that students passively read, modules use diverse interactive content types to:

- **Engage:** Interactive challenges that hook students immediately
- **Inform:** Key concepts with built-in comprehension checks
- **Apply:** Real-world scenarios and before/after comparisons
- **Verify:** Final checks that confirm understanding

## Module Structure

Each module contains:

```typescript
{
  badge_id: string;           // The badge this module trains
  learning_objectives: string[];  // 4-6 clear learning goals
  estimated_minutes: number;  // Time to complete (for planning)
  blocks: ContentBlock[];     // Sequence of learning activities
}
```

## Content Block Types

### 1. `key_concept`
Static concept teaching with optional tips, examples, warnings, and images.
- Used for: definitions, explanations, rules
- UI: card with icon, title, markdown content, collapsible sections
- Example: "Safety Signs: The 4 Colours" — explains blue/red/yellow/green with rules

### 2. `spot_the_hazard` (Interactive Challenge)
Students identify hazards in an illustrated workshop scene.
- Used for: engagement, real-world application
- UI: SVG scene with clickable zones, feedback on each hazard found
- Pass threshold: e.g., find 6 of 8 hazards to pass
- Example: GENERAL_SCENE with 8 hazards in a design workshop

### 3. `comprehension_check`
Quick multiple-choice question with immediate feedback.
- Used for: test understanding in real time
- UI: question + 4 options, feedback based on choice
- Optional hint if student struggles
- Example: "What does a blue safety sign mean?"

### 4. `before_after`
Side-by-side comparison of unsafe vs safe practices.
- Used for: visual learning, concrete examples
- UI: before image/caption + hazard list vs after image + principles
- Highlights key difference
- Example: "PPE: Wrong vs Right" — shows student without gear vs properly equipped

### 5. `micro_story`
Realistic incident narrative with analysis prompts.
- Used for: memorable learning through storytelling
- UI: narrative + collapsible analysis questions with reveals
- Flag: `is_real_incident` (true for real incidents, false for plausible scenarios)
- Example: "The Sawdust Fire" — real story of how accumulated sawdust became a fire hazard

### 6. `step_by_step`
Numbered procedure with checkpoints and warnings.
- Used for: sequential processes, emergency procedures
- UI: numbered steps with optional images and checkpoints
- Checkpoints: questions students should ask themselves before proceeding
- Example: "What to Do When Someone is Injured" — 6 steps with checkpoints

### 7. `video_embed`
Embedded YouTube/Vimeo video with timestamps.
- Used for: visual demonstration (future use)
- UI: responsive video player with play button
- Optional start/end timestamps to isolate key clips
- Example: "How to Wear Safety Glasses Correctly" (not in current module)

## Pedagogical Design Principles

### 1. **Engagement Before Content**
The module starts with an **interactive challenge** (Spot the Hazard), not a lecture. Students engage with the content before passively reading about it.

### 2. **Real-World Anchoring**
Every concept is tied to concrete workshop examples. Abstract safety rules ("be responsible") are replaced with specific scenarios ("keep exits clear because...").

### 3. **Comprehension Checks at Points of Understanding**
After teaching a concept, a quick check immediately tests understanding. Students get feedback in real time, not at the end.

### 4. **Learning Through Stories**
The "Sawdust Fire" and "Blocked Exit" scenarios are more memorable than bullet-point rules. Real incidents (marked `is_real_incident: true`) carry more weight—students know actual people were hurt.

### 5. **Progression Through Bloom's Taxonomy**
- **Remember:** Safety sign colours (key_concept)
- **Understand:** Why PPE matters (key_concept + comprehension_check)
- **Apply:** What to do in an injury (step_by_step)
- **Analyze:** Why housekeeping prevents fires (micro_story with analysis)
- **Evaluate:** Shared responsibility decisions (comprehension_check with judgment)

### 6. **Active Learning, Not Passive**
Students DO things: click hazards, answer questions, analyze stories, make decisions. They're not just reading text.

## The General Workshop Module (Flagship)

`GENERAL_WORKSHOP_MODULE` demonstrates the full capability with 16 blocks:

| # | Block Type | Title | Purpose |
|---|---|---|---|
| 1 | key_concept | Welcome | Set expectations (12 min), engagement |
| 2 | spot_the_hazard | Can You Spot the Hazards? | Interactive challenge (hooks students) |
| 3 | key_concept | Safety Signs: The 4 Colours | Core concept teaching |
| 4 | comprehension_check | What does a blue sign indicate? | Check understanding |
| 5 | key_concept | Personal Protective Equipment | Concept: PPE types |
| 6 | before_after | PPE: Wrong vs Right | Visual comparison |
| 7 | comprehension_check | When do you need safety glasses? | Check understanding |
| 8 | key_concept | Housekeeping | Concept: why cleaning matters |
| 9 | micro_story | The Sawdust Fire | Real incident narrative |
| 10 | step_by_step | What to Do When Someone is Injured | Procedure with checkpoints |
| 11 | comprehension_check | What about a splinter? | Check understanding |
| 12 | key_concept | Emergency Procedures | Concept: fires, chemical splash, evacuation |
| 13 | before_after | Workshop Setup: Exit Access | Visual comparison |
| 14 | key_concept | Shared Responsibility | Cultural shift / responsibility |
| 15 | comprehension_check | How to speak up safely? | Check understanding |
| 16 | key_concept | You're Ready: Take the Quiz | Summary + next steps |

**Flow:** Engage → Inform (concept 1) → Check → Inform (concept 2) → Apply → Check → Inform (concept 3) → Apply → Check → Inform (concept 4) → Check → Summary

**Estimated Time:** 12 minutes (reading + interaction, but no quiz)

## Why This Replaces Flat LearnCards

### Old Approach (LearnCards)
```typescript
const generalWorkshopSafetyLearn: LearnCard[] = [
  {
    title: 'Safety Sign System',
    content: 'Red signs = STOP...',
    icon: '🚫',
  },
  // ... 6 more identical cards
];
```

**Problems:**
- Passive reading (no interaction)
- No comprehension checks
- No engagement hooks
- Students zone out after 30 seconds
- Teacher can't tell if anyone understood

### New Approach (Learning Modules)
```typescript
const GENERAL_WORKSHOP_MODULE: LearningModule = {
  blocks: [
    { type: "key_concept", ... },    // Intro
    { type: "spot_the_hazard", ... }, // ENGAGE (interactive)
    { type: "key_concept", ... },     // Teach signs
    { type: "comprehension_check", ...}, // CHECK
    // ... pattern repeats for each concept
  ]
};
```

**Advantages:**
- Interactive engagement (Spot the Hazard)
- Real-time comprehension checks
- Realistic scenarios (micro_story)
- Visual comparisons (before_after)
- Clear evidence of learning
- 3x more memorable (stories + interaction + real examples)

## Using a Module in Badge Definitions

When defining a badge, use the module instead of flat LearnCards:

```typescript
// Instead of:
const learn_content = generalWorkshopSafetyLearn;

// Use:
import { GENERAL_WORKSHOP_MODULE } from '@/lib/safety/modules';

// In your badge definition:
{
  id: 'general-workshop-safety',
  name: 'General Workshop Safety',
  learning_blocks: GENERAL_WORKSHOP_MODULE.blocks,  // Rich blocks!
  learning_objectives: GENERAL_WORKSHOP_MODULE.learning_objectives,
  estimated_minutes: GENERAL_WORKSHOP_MODULE.estimated_minutes,
  // ... rest of badge metadata
}
```

## Creating New Modules

To create a new module (e.g., for Woodworking Safety, Metalworking, etc.):

1. Create `src/lib/safety/modules/woodwork-module.ts`
2. Define the `LearningModule` with learning objectives and blocks
3. Use a relevant scene from `scenes.ts` for the `spot_the_hazard` block
4. Follow the pedagogical flow: Engage → Inform → Check → Apply → Check
5. Export from `modules/index.ts`
6. Reference in badge definition

### Template
```typescript
import type { LearningModule } from '../content-blocks';
import { WOODWORK_SCENE } from '../scenes';

export const WOODWORK_MODULE: LearningModule = {
  badge_id: 'wood-workshop-safety',
  learning_objectives: [
    'Identify table saw hazards and safe operation',
    // ... 4-5 more
  ],
  estimated_minutes: 15,
  blocks: [
    // 1. Welcome/intro
    // 2. Spot the hazard (use WOODWORK_SCENE)
    // 3-16. Teach/check/apply cycle
  ],
};
```

## Assessment Integration

Modules are the **learning phase**. After completing a module, students take the **quiz** to prove mastery:

1. **Module (5-15 min):** Interactive learning with immediate feedback
2. **Quiz (3-5 min):** 12-15 questions, must score 10+ correct (83%+)
3. **Earn Badge:** Proof of mastery

The module _prepares_ students for the quiz. The quiz _certifies_ they understand.

## Future Expansions

Planned modules for other badges:

- `hand-tool-module.ts` — Safe tool handling, cutting, chiseling, grip techniques
- `wood-workshop-module.ts` — Bandsaws, table saws, sanders, dust extraction
- `metal-workshop-module.ts` — Lathes, grinders, hot work, swarf hazards
- `electronics-module.ts` — Soldering, components, electrical safety
- `digital-fab-module.ts` — Lasers, 3D printers, CNC machines

Each will follow the same pedagogical pattern: engage → inform → apply → verify.

## Files

- `general-workshop-module.ts` — Flagship General Workshop Safety module (16 blocks, 12 min)
- `index.ts` — Barrel exports for easy importing
- `README.md` — This file

## References

- `src/lib/safety/content-blocks.ts` — All block type definitions
- `src/lib/safety/scenes.ts` — Pre-built Spot the Hazard scenes
- `src/lib/safety/badge-definitions.ts` — How modules integrate with badges
- `src/components/safety/` — Renderers for each block type
