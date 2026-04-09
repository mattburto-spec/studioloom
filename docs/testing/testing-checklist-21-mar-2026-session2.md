# Testing Checklist — 21 March 2026 (Session 2)

Covers: text input fix, pace feedback system, school calendar/terms.

---

## 1. Student Lesson Text Inputs (Critical Bug Fix)

- [ ] Navigate to a student lesson page with text response fields
- [ ] Type in a text input — characters should appear and stay (not flash/disappear)
- [ ] Type in multiple text inputs on the same page — all retain their values
- [ ] Navigate away and back — saved responses load correctly
- [ ] Auto-save indicator appears briefly when typing stops
- [ ] No console errors related to usePageData or usePageResponses

## 2. Pace Feedback Pulse (Student Side)

**Prerequisite:** Migration 036 APPLIED ✅

- [ ] Complete a lesson page (click "Complete & Continue")
- [ ] Pace feedback modal appears with 3 options: 🐢 Too slow, 👌 Just right, 🏃 Too fast
- [ ] Tap one option — submits immediately (no second confirm needed)
- [ ] See "👍 Thanks!" confirmation after submission
- [ ] Check browser Network tab: POST to `/api/student/pace-feedback` returns 200
- [ ] Verify response body contains `feedbackId` and `createdAt`
- [ ] Skip button works (closes modal without submitting)
- [ ] Error state: disconnect network → tap → see "Couldn't save — tap again" → reconnect → tap → succeeds

## 3. Pace Feedback Aggregation (Teacher Side)

- [ ] Navigate to teacher class progress page (e.g., `/teacher/classes/[classId]/progress/[unitId]`)
- [ ] PaceFeedbackSummary component visible (below or alongside student progress)
- [ ] After students submit pace feedback, stacked bars show correct distribution
- [ ] Colors correct: red = too fast, green = just right, amber = too slow
- [ ] Numbers appear inside bars when segment ≥15%
- [ ] "No pace feedback yet" message shows when no data exists
- [ ] Page loads without errors when unit has no feedback data (backward compat)

## 4. School Calendar Setup (Teacher Settings)

**Prerequisite:** Migration 037 must be APPLIED first

- [ ] Navigate to Teacher Settings → School & Teaching tab
- [ ] SchoolCalendarSetup component visible
- [ ] Click "4 Terms" quick template — 4 term rows appear with default names
- [ ] Click "2 Semesters" — 2 semester rows appear
- [ ] Click "3 Trimesters" — 3 trimester rows appear
- [ ] Edit term name, start date, end date — changes reflect
- [ ] Set academic year (e.g., "2026")
- [ ] Save — success message, data persists on page reload
- [ ] Create a second academic year — both show in list

## 5. Term Assignment on Class-Unit Settings

**Prerequisite:** Migration 037 + at least one calendar saved

- [ ] Navigate to a unit → Assigned Classes → click a class card
- [ ] Term picker dropdown visible on the class-unit settings page
- [ ] Dropdown shows terms from saved calendar
- [ ] Select a term — auto-saves (no explicit save button needed)
- [ ] Reload page — selected term persists
- [ ] Remove term selection (select "No term") — saves correctly
- [ ] Classes/units without terms still render fine (backward compat)

## 6. Backward Compatibility

- [ ] Old units without workshopPhases render fine on unit detail page
- [ ] Old units without pace feedback render fine on progress page
- [ ] Classes without term assignments display normally
- [ ] Student dashboard works for students with no pace feedback history
- [ ] Teacher dashboard works with mixed units (some with NM, some without, some with terms)

---

## Migration Status

| Migration | Status | Action |
|-----------|--------|--------|
| 036 (student pace feedback) | ✅ APPLIED | No action needed |
| 037 (school calendar) | ❌ NOT APPLIED | Apply before testing sections 4-5 |
