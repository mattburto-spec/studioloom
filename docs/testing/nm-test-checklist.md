# New Metrics (Melbourne Metrics) — Test Checklist

**Created:** 20 March 2026
**Status:** Needs testing

## Prerequisites
- [ ] Migration 030 applied (competency_assessments table + nm_config column) — **DONE**
- [ ] Migration 032 applied (page_id UUID → TEXT fix) — **NOT YET APPLIED**
  - Run in Supabase SQL Editor: `ALTER TABLE competency_assessments ALTER COLUMN page_id TYPE TEXT USING page_id::TEXT;`

---

## 1. Teacher NM Config Wizard

**Page:** `/teacher/units/[unitId]` → NM Config panel

- [ ] NM Config panel visible on unit detail page
- [ ] Pop art header renders (hot pink bar, yellow NM badge, halftone dots)
- [ ] Step 1: Competency selection — "Agency in Learning" shown, selectable
- [ ] Step 2: Element picker — 12 Agency elements shown with descriptions, checkboxes work, counter updates
- [ ] Step 3: Checkpoint assignment — unit pages listed, can assign elements to each checkpoint page via pills
- [ ] Back/Next navigation between steps works
- [ ] "Save Configuration" button sends request, shows "Saving..." → "Saved!" feedback
- [ ] Panel auto-closes after successful save
- [ ] Reopening panel shows previously saved config (persistence)
- [ ] Saving with no elements selected shows validation error or disables save
- [ ] Config saved correctly in `units.nm_config` JSONB (check Supabase table editor)

---

## 2. Student Competency Pulse

**Page:** `/unit/[unitId]/[pageId]` (student view, on a checkpoint page)

- [ ] CompetencyPulse card appears above the "Complete & Continue" button (not below)
- [ ] Pop art styling renders (hot pink header, halftone dots, yellow NM badge)
- [ ] Only shows on pages configured as checkpoints in NM config
- [ ] Does NOT show on non-checkpoint pages
- [ ] Correct elements displayed (matching what teacher configured for this checkpoint)
- [ ] Element name and student-friendly description shown
- [ ] Three rating pills per element: yellow "This was hard for me", cyan "I'm getting there", pink "I did this well"
- [ ] Clicking a pill selects it (visual feedback: darker shade, slight raise)
- [ ] Can change selection by clicking a different pill
- [ ] Reflection textarea visible with placeholder text
- [ ] "DONE!" button disabled until all elements rated
- [ ] "DONE!" button enabled when all elements rated (hot pink, bold)
- [ ] Submitting shows "SAVING..." text
- [ ] Successful submission shows "POW!" animation with "Reflection complete!"
- [ ] After POW animation, calls onComplete (page flow continues)
- [ ] **ERROR CASE:** If migration 032 not applied, shows "Something went wrong" error (page_id UUID mismatch)
- [ ] After migration 032, submission succeeds
- [ ] Check `competency_assessments` table: rows created with correct student_id, unit_id, page_id, element, rating, source='student_self'
- [ ] Width matches lesson content above (max-w-4xl)

---

## 3. Teacher Observation Snap

**Page:** `/teacher/teach/[unitId]` (Teaching Mode) → click NM button on student card

- [ ] NM button (small hot pink square with "NM" text) visible on each student card when NM is enabled for the unit
- [ ] NM button NOT visible when NM is not enabled for the unit
- [ ] Clicking NM button opens ObservationSnap modal overlay
- [ ] Modal is centered, backdrop darkens
- [ ] Pop art styling renders (hot pink header, student name shown)
- [ ] Correct elements displayed (matching unit's NM config)
- [ ] 4-point rating grid per element: yellow "Emerging", cyan "Developing", pink "Applying", purple "Extending"
- [ ] Can select one rating per element
- [ ] Comment/observation textarea per element
- [ ] "Submit Observation" button works
- [ ] Successful submission closes modal
- [ ] Clicking backdrop closes modal without saving
- [ ] Close button (X) works
- [ ] Check `competency_assessments` table: rows created with source='teacher_observation', correct student_id, rating 1-4

**Also test from unit detail page:**
- [ ] ObservationSnap accessible from wherever else it may be mounted

---

## 4. NM Results Panel

**Page:** `/teacher/units/[unitId]` → NM Results panel (below NM Config)

- [ ] Results panel visible when NM is enabled
- [ ] Results panel NOT visible when NM is not enabled
- [ ] Pop art header with "NM Results" title, student/response count
- [ ] Collapsed by default, expands on click
- [ ] "No NM data yet" empty state when no assessments exist
- [ ] **By Student view:**
  - [ ] Each student shown as a card with name
  - [ ] Element abbreviation pills with correct colors (yellow=1, cyan=2, pink=3)
  - [ ] Average badge shown (color-coded)
  - [ ] Teacher observation shown as small "T" dot on pills
  - [ ] Hover/title shows full element name and rating labels
- [ ] **By Element view:**
  - [ ] Each element shown as a card
  - [ ] Distribution bar (yellow/cyan/pink segments) proportional to class ratings
  - [ ] Self average and Teacher average badges
  - [ ] Response count shown
- [ ] Toggle between views works
- [ ] Data refreshes when panel is opened (not stale)

---

## 5. Dashboard NM Button

**Page:** `/teacher/dashboard`

- [ ] Pop art "NM Results" button visible on unit rows where NM is enabled
- [ ] Button NOT visible on unit rows where NM is not enabled
- [ ] Clicking button navigates to unit detail page (where results panel lives)
- [ ] Button styling: hot pink background, bold black border, yellow NM badge, "Results" text

---

## 6. Backward Compatibility

- [ ] Units without NM config render normally (no errors, no NM components shown)
- [ ] Student pages without checkpoints show no CompetencyPulse
- [ ] Teacher dashboard shows no NM button for non-NM units
- [ ] Teaching Mode shows no NM button on student cards for non-NM units
- [ ] Old units created before migration 030 work fine (nm_config is NULL)

---

## 7. Edge Cases

- [ ] Student submits pulse, navigates away, returns — pulse shows as already completed (or allows re-submission)
- [ ] Teacher changes NM config after students have submitted — old data preserved, new checkpoints show new elements
- [ ] Rate limiting: student can't submit more than 10 assessments per minute
- [ ] Multiple students submit simultaneously — no conflicts
- [ ] Teacher observes same student twice — both observations stored (timestamped)

---

## Known Issues to Verify

- [ ] ObservationSnap API route (`nm-observation`) uses `.eq("author_teacher_id", user.id)` for classes table — verify this is correct (classes might use `teacher_id` instead)
- [ ] NM config wizard — test with units that have many pages (10+) — does step 3 scroll properly?
- [ ] CompetencyPulse width: confirmed max-w-4xl matches lesson content
