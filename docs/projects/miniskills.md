# Project: MiniSkills
**Created: 3 April 2026**
**Status: IDEA — parked for future build**
**Priority: Low (post-Dimensions3, post-revenue)**

---

## What This Is

Bite-sized skill units (1-3 lessons each) that teachers can assign to students as standalone micro-courses. Students complete them and earn badges.

**Examples:**
- Time Management (for PP students who can't plan)
- Project Management Basics (Gantt charts, milestones, dependencies)
- Empathy & Interviewing (for Service students before community contact)
- Finance & Budgeting (for students managing project costs)
- Digital Literacy (file management, citation, online research skills)
- Workshop Safety (already exists as Safety Badges — this extends the model)
- Presentation Skills (for students preparing exhibitions)
- Collaboration & Conflict Resolution (for group projects)
- Research Methods (primary vs secondary sources, bias detection)
- Visual Communication (sketching, layout, infographics)

## Why This Is Powerful

1. **Fills skill gaps on demand.** Teacher notices a student can't manage their time → assigns the Time Management MiniSkill → student completes it → earns badge → proceeds with their project. No need to build a custom lesson.

2. **Works across all unit types.** Time management is needed in Design, Service, PP, and Inquiry. MiniSkills are format-agnostic — they teach transferable skills, not subject content.

3. **Badge integration already exists.** Safety Badges system (migration 035, ~5K LOC) already handles: teacher creates badge with learning cards + question pools → student takes test → auto-scored → badge earned → badge gates unit access. MiniSkills extend this: instead of just a quiz, the badge requires completing a short interactive unit.

4. **Reusable across Matt's projects.** Time management, empathy, collaboration — these are universal skills. MiniSkills built for StudioLoom can port directly to Seedlings, CALLED, Makloom.

## How It Would Work

### Teacher Experience
- Browse MiniSkill library (community-curated + teacher-created)
- Assign MiniSkill to individual students or whole class
- Optionally make it a prerequisite for a unit (same mechanism as Safety Badges)
- Track completion on Class Hub

### Student Experience
- See assigned MiniSkills on dashboard (similar to Safety Badge banner)
- Work through 1-3 interactive lessons (same student lesson UI as regular units)
- Each lesson has toolkit tools, activities, and a checkpoint assessment
- Earn badge on completion → badge visible on profile + portfolio

### Architecture Fit
- A MiniSkill IS a unit — just a short one (1-3 pages, ~15-45 min total)
- Uses existing `units` + `class_units` + `student_progress` tables
- Badge earned via existing Safety Badge system (extend `unit_badge_requirements` to also accept "complete this unit" as a requirement type, not just "pass this quiz")
- Content can be Activity Blocks from the library (Dimensions3 pipeline assembles them)
- MiniSkills are always framework-neutral (they teach skills, not assessed criteria)

### New Infrastructure Needed
- `unit_category: 'full' | 'miniskill'` on units table (or a tag)
- MiniSkill browser page (filterable by skill category)
- "Assign to Student" flow (individual assignment, not just class-wide)
- Badge earned on unit completion (extend badge system)
- Community MiniSkill sharing (v2 — after community features exist)

## Dependencies
- Dimensions3 pipeline (MiniSkills are just short units assembled from blocks)
- Safety Badge system (badge-on-completion extension)
- FormatProfile (MiniSkills would be their own format — cycle: Learn → Practice → Demonstrate)

## Estimated Build
- ~3-4 days once Dimensions3 + Safety Badge extension are in place
- Community sharing adds ~2-3 days

## Notes
- Matt's original idea (3 Apr 2026): "mini units that teachers can add to things like service such as time management, project management, empathy, finance management. Teachers assign to students and they can collect badges."
- Natural extension of the existing badge + unit architecture
- Could become a key differentiator: no competitor has assignable micro-skill courses with badge tracking
- Consider: curate 10-15 MiniSkills as launch content (same approach as Teaching Moves → seed blocks)
