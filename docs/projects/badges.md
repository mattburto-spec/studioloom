# Project: Badges — Safety Test Improvements & Skills Badges

> **Created:** 29 Mar 2026
> **Status:** Planned
> **Goal:** Improve existing safety badge test quality + expand badge system to cover skills certification
> **Estimated effort:** ~8-12 hours

---

## 1. The Problem

### Safety Badge Tests Need Improvement

The current safety badge system works (teacher creates badges, students take tests, pass/fail gates unit access), but the actual TEST CONTENT needs work:

- Question quality is basic — most are straightforward recall, not scenario-based reasoning
- Question pools are small — students can memorize answers on retake
- No question difficulty levels or adaptive question selection
- Learning cards (pre-test study material) need richer content (images, video embeds, step-by-step procedures)
- No "near miss" answer options that test genuine understanding vs lucky guessing
- Retake cooldown exists but may be too short (students just retry immediately)

### Skills Badges Don't Exist Yet

Safety badges gate unit access ("you must pass this before using the workshop"). But there's a whole category of badges that should exist alongside them:

**Skills badges** = certification that a student has demonstrated a specific skill. Not a gate — a credential.

Examples:
- "Laser Cutter Operator" — passed safety + demonstrated correct setup + completed supervised cut
- "3D Print Ready" — can prepare a file, set parameters, and troubleshoot common issues
- "Soldering Certified" — passed safety + demonstrated clean joints under supervision
- "Hand Tools Competent" — knows correct tool selection, grip, and storage
- "Digital Fabrication" — can move from CAD to physical output via at least 2 methods

These are different from safety badges:
- Safety = prerequisite gate (must pass before access)
- Skills = achievement credential (earned through demonstrated competence, shown on profile)
- Skills badges could have multiple levels (Bronze/Silver/Gold or Beginner/Competent/Expert)

---

## 2. What's Already Built

| Component | Status | Notes |
|-----------|--------|-------|
| Badge creation (teacher) | Working | 5 question types: multiple choice, true/false, scenario, sequence, matching |
| Badge test flow (student) | Working | 3-screen: learn → quiz → results. Auto-scored. |
| Unit prerequisite gating | Working | Server-side + client-side gates |
| Badge results (teacher) | Working | Per-student pass/fail/score, class filter |
| Direct grant (teacher) | Working | Grant badge without test (for in-person verification) |
| Retake cooldown + expiry | Working | Configurable |
| Badge thumbnails | Working | Deterministic gradients |
| Dashboard integration | Working | Amber banner for pending tests, green pills for earned |
| Class Hub Badges tab | Working | Inline management, per-student results |

---

## 3. Phases

### Phase 1: Test Quality Improvements (~3-4 hours)

- **Better question types:** Add image-based questions (show a photo of a workshop situation, ask "what's wrong here?"). Add drag-to-order for procedure sequences (current sequence type is text-only).
- **Question difficulty levels:** Tag questions as easy/medium/hard. Test selects a balanced mix. Retakes get different questions from the pool.
- **Richer learning cards:** Support images (upload or URL), numbered step-by-step procedures with images, embedded video links (YouTube/Vimeo), and "key point" callout boxes.
- **Distractor quality:** Add guidance/templates for writing good wrong answers ("near miss" options that test understanding, not trick questions).
- **Minimum pool size warning:** Alert teacher if question pool is too small for meaningful retakes (e.g., <15 questions for a 10-question test).

### Phase 2: Skills Badges (~4-5 hours)

- **Badge type field:** Add `badge_type: 'safety' | 'skill'` to badges table. Safety badges gate access. Skills badges are credentials.
- **Skills badge levels:** Optional tiered progression (e.g., Bronze → Silver → Gold, or Beginner → Competent → Expert). `badge_level` field.
- **Mixed assessment:** Skills badges can combine test questions (knowledge check) + teacher observation (practical demonstration sign-off). Teacher marks "observed competence" for specific criteria.
- **Student profile display:** Skills badges shown on student dashboard as earned credentials with level indicator. Different visual treatment from safety badges (blue/teal vs amber).
- **Portfolio integration:** Earned skills badges appear in portfolio timeline as milestone markers.

### Phase 3: Badge Templates & Sharing (~2-3 hours)

- **Pre-built badge templates:** Ship common safety badge templates (laser cutter, 3D printer, hand tools, soldering, sewing machine, workshop general). Teacher can use as-is or customize.
- **Badge export/import:** Export a badge definition as JSON. Import into another teacher's account. Enables sharing between colleagues.
- **Badge collections:** Group related badges (e.g., "Digital Fabrication Suite" = Laser + 3D Print + CNC). Student earns collection badge when all individual badges complete.

---

## 4. Key Decisions

1. **Skills badges are credentials, not gates** — they don't block unit access. They're shown on the student's profile and portfolio as achievements.
2. **Teacher observation is the gold standard for skills** — a test can verify knowledge, but only a teacher watching a student use the laser cutter can verify competence. Skills badges should support mixed assessment (test + observation sign-off).
3. **Badge templates ship with StudioLoom** — teachers shouldn't have to write all questions from scratch. Common workshop equipment badges should be pre-built and customizable.
4. **Levels are optional** — not every badge needs Bronze/Silver/Gold. Simple pass/fail is fine for safety. Levels add value for skills where there's genuine progression.

---

## 5. Files

### Existing
- `src/app/teacher/safety/create/page.tsx` — badge creation form
- `src/app/teacher/safety/[badgeId]/page.tsx` — badge detail + results
- `src/app/(student)/safety/[badgeId]/page.tsx` — student test flow
- `src/lib/safety/types.ts` — BadgeQuestion, LearnCard, BadgeDefinition types
- `src/lib/safety/badge-thumbnails.ts` — gradient thumbnails
- `src/components/teacher/class-hub/BadgesTab.tsx` — Class Hub integration
- `supabase/migrations/035_safety_badges.sql` — 5 tables (APPLIED)

### To Create/Modify
- Migration: add `badge_type`, `badge_level`, `observation_criteria` to badges table
- `src/lib/safety/badge-templates.ts` — pre-built badge definitions
- `src/components/teacher/safety/QuestionEditor.tsx` — enhanced question editor with image upload
- `src/components/teacher/safety/ObservationChecklist.tsx` — teacher sign-off for skills
- `src/components/student/SkillsBadgeProfile.tsx` — student dashboard credential display

---

*Last updated: 29 Mar 2026*
