# Integration Guide: Learning Modules → Badge Definitions

This guide shows how to integrate the new `GENERAL_WORKSHOP_MODULE` (and future modules) into the badge definition system.

## Current State

The `badge-definitions.ts` file currently uses flat `LearnCard[]` arrays:

```typescript
const generalWorkshopSafetyLearn: LearnCard[] = [
  { title: 'Safety Sign System', content: '...', icon: '🚫' },
  { title: 'Personal Protective Equipment (PPE)', content: '...', icon: '🥽' },
  // ... more cards
];

export const GENERAL_WORKSHOP_SAFETY_BADGE: BadgeDefinition = {
  id: 'general-workshop-safety',
  learn_content: generalWorkshopSafetyLearn,  // ← OLD: flat LearnCards
  // ... rest of badge metadata
};
```

## Integration Steps

### Step 1: Import the Module

In `src/lib/safety/badge-definitions.ts`, add:

```typescript
import { GENERAL_WORKSHOP_MODULE } from './modules';
```

### Step 2: Replace `learn_content` with `learning_blocks`

Update the badge definition to use the module's blocks:

```typescript
export const GENERAL_WORKSHOP_SAFETY_BADGE: BadgeDefinition = {
  id: 'general-workshop-safety',
  name: 'General Workshop Safety',
  description: 'Master the fundamental safety rules for design workshops',
  icon: '🛡️',
  color: '#ef4444',

  // ❌ OLD:
  // learn_content: generalWorkshopSafetyLearn,

  // ✅ NEW:
  learning_blocks: GENERAL_WORKSHOP_MODULE.blocks,
  learning_objectives: GENERAL_WORKSHOP_MODULE.learning_objectives,
  estimated_minutes: GENERAL_WORKSHOP_MODULE.estimated_minutes,

  // ... rest of badge metadata
};
```

### Step 3: Ensure BadgeDefinition Type Supports Both

The `BadgeDefinition` type (in `src/lib/safety/types.ts`) already supports both:

```typescript
export interface BadgeDefinition {
  id: string;
  name: string;

  // ← Support BOTH for backward compatibility
  learning_blocks?: ContentBlock[];        // NEW: rich interactive blocks
  learn_content?: LearnCard[];              // OLD: flat cards (fallback)
  learning_objectives?: string[];           // NEW
  estimated_minutes?: number;               // NEW

  // ... rest of fields
}
```

**No type changes needed** — it already supports both old and new.

### Step 4: Remove Old Content (Optional)

Once `GENERAL_WORKSHOP_MODULE` is integrated, you can safely delete the old `generalWorkshopSafetyLearn` array since it's replaced by the module. Keep it during a transition period if you want both available.

## Backward Compatibility

The system automatically handles both old and new:

**In the student UI** (component that displays learn content):

```typescript
// From content-blocks.ts
export function getBlocksFromBadge(badge: {
  learning_blocks?: ContentBlock[];
  learn_content?: Array<{ title: string; content: string; icon: string }>;
}): ContentBlock[] {
  if (badge.learning_blocks && badge.learning_blocks.length > 0) {
    return badge.learning_blocks;  // ← USE NEW
  }
  if (badge.learn_content && badge.learn_content.length > 0) {
    return migrateLearnCards(badge.learn_content);  // ← FALLBACK to old
  }
  return [];
}
```

So you can update badges one at a time. New badges use modules, old badges still work with LearnCards.

## Example: Integration of General Workshop Safety Badge

### Before

```typescript
const generalWorkshopSafetyLearn: LearnCard[] = [
  { title: 'Safety Sign System', content: 'Red signs = STOP...', icon: '🚫' },
  // ... 6 more flat cards
];

export const GENERAL_WORKSHOP_SAFETY_BADGE: BadgeDefinition = {
  id: 'general-workshop-safety',
  name: 'General Workshop Safety',
  learn_content: generalWorkshopSafetyLearn,
  question_pool: generalWorkshopSafetyQuestions,
  // ...
};
```

### After

```typescript
import { GENERAL_WORKSHOP_MODULE } from './modules';

export const GENERAL_WORKSHOP_SAFETY_BADGE: BadgeDefinition = {
  id: 'general-workshop-safety',
  name: 'General Workshop Safety',
  learning_blocks: GENERAL_WORKSHOP_MODULE.blocks,
  learning_objectives: GENERAL_WORKSHOP_MODULE.learning_objectives,
  estimated_minutes: GENERAL_WORKSHOP_MODULE.estimated_minutes,
  question_pool: generalWorkshopSafetyQuestions,  // Quiz questions stay the same
  // ...
};
```

## Component Rendering

When the student is learning, the UI component `LearningFlow.tsx` (in `src/components/safety/`) will:

1. Call `getBlocksFromBadge(badge)` to get the blocks
2. Loop through blocks and render each one based on `type`:
   - `key_concept` → `<KeyConceptRenderer />`
   - `spot_the_hazard` → `<SpotTheHazardRenderer />`
   - `comprehension_check` → `<ComprehensionCheckRenderer />`
   - etc.

**No component changes needed** — renderers already exist for all block types.

## Migration Timeline

### Phase 1 (Now)
- ✅ Create `general-workshop-module.ts` with all 16 blocks
- ✅ Create `modules/index.ts` barrel export
- ✅ Create this integration guide

### Phase 2 (Next PR)
- Update `badge-definitions.ts` to import and use `GENERAL_WORKSHOP_MODULE`
- Test the student learning flow with the new rich content
- Verify backward compatibility (old badges still work)

### Phase 3 (Future PRs)
- Create `hand-tool-module.ts` for Hand Tool Safety badge
- Create `wood-workshop-module.ts` for Woodworking badge
- Migrate other badges to modules one at a time

## Testing the Integration

### Manual Test (Student POV)

1. Navigate to `/tools/safety` in the app
2. Click on "General Workshop Safety" badge
3. Click "Learn" or "Start Learning"
4. Verify you see:
   - ✅ Welcome card (key_concept)
   - ✅ Spot the Hazard interactive scene (clickable zones)
   - ✅ Key concepts with tips/warnings
   - ✅ Comprehension checks with feedback
   - ✅ Before/After comparisons
   - ✅ Story with collapsible analysis
   - ✅ Step-by-step procedure with checkpoints
   - ✅ Summary card before quiz
5. All blocks render correctly with images, icons, markdown formatting

### Automated Test (Coming)

```typescript
describe('GENERAL_WORKSHOP_MODULE', () => {
  test('has 16 blocks in correct order', () => {
    expect(GENERAL_WORKSHOP_MODULE.blocks).toHaveLength(16);
    expect(GENERAL_WORKSHOP_MODULE.blocks[0].type).toBe('key_concept');
    expect(GENERAL_WORKSHOP_MODULE.blocks[1].type).toBe('spot_the_hazard');
    // ... etc
  });

  test('all learning_objectives are present', () => {
    expect(GENERAL_WORKSHOP_MODULE.learning_objectives.length).toBeGreaterThan(4);
  });

  test('estimated_minutes is reasonable', () => {
    expect(GENERAL_WORKSHOP_MODULE.estimated_minutes).toBe(12);
  });

  test('spot_the_hazard block uses GENERAL_SCENE', () => {
    const sthBlock = GENERAL_WORKSHOP_MODULE.blocks[1];
    expect(sthBlock.type).toBe('spot_the_hazard');
    expect(sthBlock.hazards.length).toBe(8);
  });
});
```

## Files Involved

### New Files
- `src/lib/safety/modules/general-workshop-module.ts` — The module (16 blocks)
- `src/lib/safety/modules/index.ts` — Barrel export
- `src/lib/safety/modules/README.md` — Module documentation
- `src/lib/safety/modules/INTEGRATION-GUIDE.md` — This file

### Existing Files (No Changes Needed Yet)
- `src/lib/safety/content-blocks.ts` — Block type definitions (already complete)
- `src/lib/safety/scenes.ts` — Pre-built scenes (already complete)
- `src/lib/safety/badge-definitions.ts` — Will be updated in Phase 2
- `src/components/safety/blocks/` — Renderers for each block type (already exist)

### Existing Files (Minor Updates in Phase 2)
- `src/lib/safety/badge-definitions.ts` — Import module, use `learning_blocks`

## Benefits of This Approach

✅ **Rich learning experience** — Interactive engagement, not passive reading
✅ **Comprehension checks** — Real-time feedback so students know if they understand
✅ **Memorable** — Stories and scenarios stick in memory better than bullet points
✅ **Pedagogically sound** — Follows Bloom's taxonomy and modern learning science
✅ **Backward compatible** — Old badges with LearnCards still work
✅ **Reusable components** — Same block types work across all safety badges
✅ **Teacher-friendly** — Clear learning objectives and time estimates
✅ **Scalable** — Easy to create new modules for other badges

## Questions?

Refer to:
- `src/lib/safety/modules/README.md` — Detailed overview of module structure
- `src/lib/safety/content-blocks.ts` — All block type definitions with examples
- `src/lib/safety/scenes.ts` — Available Spot the Hazard scenes
