# Implementation Checklist: General Workshop Safety Module

This document tracks the implementation of the General Workshop Safety Learning Module across the codebase.

## Module Creation ✅

- [x] Create `general-workshop-module.ts` with 16 interactive blocks
- [x] Define learning objectives (6 clear goals)
- [x] Set estimated time (12 minutes)
- [x] Import and use `GENERAL_SCENE` from scenes.ts
- [x] Create `modules/index.ts` barrel export
- [x] Create `modules/README.md` documentation
- [x] Create `modules/INTEGRATION-GUIDE.md`
- [x] Create this checklist

## Integration into Badge System

### Phase 2: Update Badge Definitions (TBD)

- [ ] Update `src/lib/safety/badge-definitions.ts`:
  - [ ] Import `GENERAL_WORKSHOP_MODULE` at top
  - [ ] In `GENERAL_WORKSHOP_SAFETY_BADGE` definition:
    - [ ] Add `learning_blocks: GENERAL_WORKSHOP_MODULE.blocks`
    - [ ] Add `learning_objectives: GENERAL_WORKSHOP_MODULE.learning_objectives`
    - [ ] Add `estimated_minutes: GENERAL_WORKSHOP_MODULE.estimated_minutes`
  - [ ] Keep `question_pool` unchanged (quiz questions separate)
  - [ ] Remove or archive `generalWorkshopSafetyLearn` (old LearnCards)

### Phase 2: Verify Backward Compatibility

- [ ] Ensure `BadgeDefinition` type supports both `learning_blocks` and `learn_content`
- [ ] Test that old badges with `learn_content` still render (fallback to `migrateLearnCards`)
- [ ] Verify `getBlocksFromBadge()` helper prefers `learning_blocks` when present

## Component Rendering

### Existing Components (Already Built)

These components already exist in `src/components/safety/` and require no changes:

- [x] `KeyConceptRenderer.tsx` — Renders `key_concept` blocks
- [x] `SpotTheHazardRenderer.tsx` — Renders `spot_the_hazard` blocks (interactive)
- [x] `ComprehensionCheckRenderer.tsx` — Renders `comprehension_check` blocks
- [x] `BeforeAfterRenderer.tsx` — Renders `before_after` blocks
- [x] `MicroStoryRenderer.tsx` — Renders `micro_story` blocks (with expandable analysis)
- [x] `StepByStepRenderer.tsx` — Renders `step_by_step` blocks
- [x] `VideoEmbedRenderer.tsx` — Renders `video_embed` blocks

### Component Integration (TBD)

- [ ] In `LearningFlow.tsx` (parent component that displays learning content):
  - [ ] Verify it loops through `blocks` array
  - [ ] Verify it dispatches to correct renderer based on `block.type`
  - [ ] Test with all 7 block types in the module

## Student UI Flow Testing

### Manual E2E Test (TBD)

1. [ ] Student navigates to `/tools/safety`
2. [ ] Student clicks "General Workshop Safety" badge
3. [ ] Student clicks "Learn"
4. [ ] Verify each block renders correctly:
   - [ ] Block 1: Key concept card with icon, title, content
   - [ ] Block 2: Spot the Hazard interactive scene (8 clickable zones)
   - [ ] Block 3: Key concept with tips, warning, image placeholder
   - [ ] Block 4: Comprehension check with 4 options, feedback
   - [ ] Block 5: Key concept (PPE detailed)
   - [ ] Block 6: Before/After visual comparison
   - [ ] Block 7: Comprehension check
   - [ ] Block 8: Key concept (housekeeping)
   - [ ] Block 9: Micro story with 3 expandable analysis prompts
   - [ ] Block 10: Step-by-step with 6 steps, checkpoints, image
   - [ ] Block 11: Comprehension check
   - [ ] Block 12: Key concept (emergency)
   - [ ] Block 13: Before/After visual comparison
   - [ ] Block 14: Key concept (shared responsibility)
   - [ ] Block 15: Comprehension check
   - [ ] Block 16: Key concept (summary)
5. [ ] All markdown formatting renders (bold, lists, etc.)
6. [ ] All image placeholders show correctly
7. [ ] Navigation works (next/previous blocks)
8. [ ] After final block, student can start the quiz

### Automated Tests (TBD)

- [ ] Create `general-workshop-module.test.ts`:
  - [ ] Test module has 16 blocks
  - [ ] Test first block is `key_concept`, second is `spot_the_hazard`
  - [ ] Test all block types are represented
  - [ ] Test learning objectives are non-empty
  - [ ] Test estimated_minutes is 12
  - [ ] Test GENERAL_SCENE is properly imported and used
  - [ ] Test each comprehension_check has 4 options
  - [ ] Test each micro_story has 3 analysis prompts
  - [ ] Test step_by_step has 6 steps
  - [ ] Test no block has missing `id` field

## Data Model Updates

### Database (TBD)

- [ ] Verify `badges` table `learning_blocks` JSONB column can store all 16 blocks
- [ ] Create migration (if needed) to add `learning_objectives` and `estimated_minutes` columns to `badges` table
- [ ] Seed data: Insert `GENERAL_WORKSHOP_MODULE.blocks` into the badge record

### API Routes (TBD)

- [ ] Verify `/api/student/safety/badges/[badgeId]` returns `learning_blocks`
- [ ] Verify `/api/teacher/badges/[id]` returns full badge including `learning_blocks`
- [ ] Test response size (16 blocks with all details)

## Documentation (Phase 1: Complete)

- [x] `src/lib/safety/modules/README.md` — Explains module architecture and block types
- [x] `src/lib/safety/modules/INTEGRATION-GUIDE.md` — Step-by-step integration instructions
- [x] `src/lib/safety/modules/IMPLEMENTATION-CHECKLIST.md` — This file

### Future Documentation

- [ ] Update main `questerra/CLAUDE.md` to note module system is live
- [ ] Add code examples to `docs/ai-systems-audit-*.md` if applicable
- [ ] Create video/screenshot walkthrough of module learning experience

## Deployment

### Staging (TBD)

- [ ] Deploy updated `badge-definitions.ts` to staging
- [ ] Test student learning flow with all 16 blocks in staging environment
- [ ] Verify Spot the Hazard scene renders and is interactive
- [ ] Verify all images load (may need to add placeholder images to CDN)
- [ ] Load test: verify JSON response size isn't too large
- [ ] Mobile test: verify all blocks render responsively on phone

### Production (TBD)

- [ ] Add CDN images for placeholders:
  - [ ] `/images/safety/signs-overview.png`
  - [ ] `/images/safety/ppe-overview.png`
  - [ ] `/images/safety/ppe-wrong.png`
  - [ ] `/images/safety/ppe-right.png`
  - [ ] `/images/safety/first-aid-steps.png`
  - [ ] `/images/safety/exit-blocked.png`
  - [ ] `/images/safety/exit-clear.png`
- [ ] Update `general-workshop-safety` badge in production database
- [ ] Announce to teachers: "General Workshop Safety badge now has rich interactive learning"
- [ ] Monitor analytics: track block completion rates, spot_the_hazard pass rates, comprehension check performance

## Quality Assurance

### Content Review (TBD)

- [ ] Review all learning objectives for clarity
- [ ] Review all explanations for age-appropriateness (11-16)
- [ ] Verify all examples use real workshop scenarios
- [ ] Check hazard zones in Spot the Hazard are accurate and clickable
- [ ] Verify comprehension check feedback is helpful and not condescending
- [ ] Verify micro_story is realistic and learning points are clear
- [ ] Check step_by_step is complete and checkpoints make sense

### Accessibility Review (TBD)

- [ ] Test with screen reader (Spot the Hazard scene should have alt text)
- [ ] Verify all images have descriptive captions
- [ ] Test with keyboard navigation (all interactive elements should be keyboard accessible)
- [ ] Verify color contrast meets WCAG AA standard
- [ ] Test with zoom (200% browser zoom should still be readable)

### Performance Review (TBD)

- [ ] Measure JSON payload size for all 16 blocks (target: <100KB)
- [ ] Verify page load time < 2 seconds on 3G
- [ ] Verify Spot the Hazard SVG renders smoothly (60 FPS)
- [ ] Profile memory usage while cycling through 16 blocks

## Post-Launch Monitoring

### Analytics (TBD)

- [ ] Track: % of students who start learning
- [ ] Track: % of students who complete all 16 blocks
- [ ] Track: Comprehension check pass rate (target: >80%)
- [ ] Track: Spot the Hazard pass rate on first attempt (target: >70%)
- [ ] Track: Average time per block (should align with estimated_minutes / 16 ≈ 45 sec/block)
- [ ] Track: Time to complete entire module (target: 10-15 minutes including thinking time)
- [ ] Track: Quiz pass rate after module (target: >85%, should be higher than pre-module)

### User Feedback (TBD)

- [ ] Send post-module survey: "Was the learning clear? Which block helped most?"
- [ ] Collect student comments: "What was confusing?"
- [ ] Collect teacher feedback: "Are students more engaged with this vs. old LearnCards?"

## Future Modules

After General Workshop module is live and successful, create similar modules for:

- [ ] **Hand Tool Safety Module** — Safe handling, cutting, hammering, chiseling
  - [ ] Use hand tool scene from scenes.ts
  - [ ] 14-16 blocks, ~12 minutes
  - [ ] Learning objectives: grip, cutting direction, tool storage, etc.

- [ ] **Woodworking Safety Module** — Bandsaws, table saws, sanders
  - [ ] Use `WOODWORK_SCENE` from scenes.ts
  - [ ] 16-18 blocks, ~15 minutes
  - [ ] Learning objectives: blade guards, dust extraction, kickback prevention

- [ ] **Metalworking Safety Module** — Lathes, grinders, hot work
  - [ ] Use `METALWORK_SCENE` from scenes.ts
  - [ ] 16-18 blocks, ~15 minutes
  - [ ] Learning objectives: no gloves near lathe, face shields, hot material handling

- [ ] **Electronics Safety Module** — Soldering, circuits, electrical
  - [ ] 14-16 blocks, ~12 minutes
  - [ ] Learning objectives: iron safety, flux fumes, electrical safety

- [ ] **Digital Fabrication Module** — Lasers, 3D printers, CNC
  - [ ] 16-18 blocks, ~15 minutes
  - [ ] Learning objectives: enclosed equipment, air assist, material safety

## Success Criteria

This implementation is successful when:

✅ **Educational Impact**
- Students who complete the module score 15% higher on the quiz vs. students with old LearnCards
- Comprehension check in-module pass rate >80%
- Module completion rate >85%

✅ **Technical Quality**
- All 16 blocks render correctly across desktop and mobile
- No console errors
- Page load time <2 seconds
- Spot the Hazard interactive zones are clickable and accurate

✅ **Engagement**
- Average time per block ≈ 45 seconds (aligned with 12-min estimate)
- Student feedback is positive ("This was fun", "I actually learned something")
- Teachers report more engagement vs. old LearnCards

✅ **Scalability**
- System is ready to create 5+ more modules using the same pattern
- Renderers handle all block types correctly
- Database can store module blocks without performance degradation

## Timeline

- **Now (Phase 1):** ✅ Create module + documentation
- **Week 1 (Phase 2):** Update badge-definitions.ts, test integration, deploy to staging
- **Week 2 (Phase 3):** E2E testing, QA review, deployment to production
- **Week 3 (Phase 4):** Monitor analytics, gather user feedback, iterate
- **Week 4+:** Create next module (Hand Tool Safety)

---

**Owner:** Claude Code + Matt Burton
**Created:** 2026-03-24
**Last Updated:** 2026-03-24
**Status:** Phase 1 Complete, Phase 2 Pending
