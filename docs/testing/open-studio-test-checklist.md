# Open Studio — Test Checklist
*Created 20 March 2026*

## Prerequisites
- Migration 029 applied (`supabase db push` or run `029_open_studio.sql`)
- At least 1 teacher account with 1 class + 1 student + 1 active unit
- Dev server running (`npm run dev`)

---

## 1. Teacher Dashboard Visibility

- [ ] **"Studio" pill visible on every unit row** — scroll to "Your Classes" section, each unit shows a gray "Studio" pill
- [ ] **Click "Studio" pill** → navigates to progress page (`/teacher/classes/[classId]/progress/[unitId]`)
- [ ] **Click class name** → navigates to class detail page (`/teacher/classes/[classId]`)
- [ ] **Chevron still expands/collapses** — click the arrow on the right, units show/hide
- [ ] **Class name hover** — text turns purple on hover (visual affordance that it's clickable)

## 2. Teacher Unlock Flow (Progress Page)

- [ ] **"Unlock" button visible** per student in the progress table (lock icon + "Unlock" text)
- [ ] **Click "Unlock"** → calls `POST /api/teacher/open-studio/status` with `studentId`, `unitId`, `classId`
- [ ] **After unlock:** button changes to indicate unlocked state
- [ ] **Open Studio section at bottom** — shows "1 Unlocked" and "0 Guided" (or correct counts)
- [ ] **Back on dashboard:** the "Studio" pill for that unit turns purple and shows "1 in Studio"

## 3. Teacher Revoke Flow

- [ ] **OpenStudioClassView** shows the unlocked student with a revoke option
- [ ] **Click revoke** → calls `PATCH /api/teacher/open-studio/status` with revoke reason
- [ ] **After revoke:** student no longer shows as unlocked
- [ ] **Dashboard "Studio" pill** returns to gray "Studio" (count drops to 0)

## 4. Student Dashboard (Locked State)

- [ ] **Open Studio card visible** — shows lock icon + "Open Studio" + "Your teacher will unlock this when you're ready for independent work."
- [ ] **No criteria list** — just the simple status card, no checkboxes or progress ring
- [ ] **Card is NOT clickable** — it's informational only

## 5. Student Dashboard (Unlocked State)

- [ ] **After teacher unlocks:** Open Studio card shows purple check icon + "Open Studio Unlocked" + "You can work independently with your AI studio critic."
- [ ] **ReadinessIndicator compact mode** — if used inline, shows purple dot + "Open Studio" text

## 6. Student Unit Page — OpenStudioBanner

- [ ] **Banner appears** between hero and content when Open Studio is unlocked for this student+unit
- [ ] **"Start Session" flow** — input for focus area + Start Session button
- [ ] **Start session** → calls `POST /api/student/open-studio/session`
- [ ] **Active session banner** — shows "Open Studio #1" badge, focus area (click to edit), End Session button
- [ ] **End session flow** — click End Session → optional reflection input → confirm
- [ ] **End session** → calls `PATCH /api/student/open-studio/session` with reflection

## 7. Student Unit Page — Revoked State

- [ ] **After revocation:** banner shows amber "Let's recalibrate" message
- [ ] **Message is clear** — "Your Open Studio access has been paused. Your mentor will guide you through the next steps."

## 8. Check-In Timer & AI Interactions

- [ ] **Check-in fires** at configured interval (default 15 min, teacher can set 5-30 min)
- [ ] **Check-in message appears** below the banner as a slide-in
- [ ] **Dismiss button** — click X to dismiss check-in message
- [ ] **Check-in rotation** — regular → documentation nudge (every 3rd) → alignment check (every 5th)
- [ ] **Rate limiting works** — 10/min, 60/hour per student

## 9. Drift Detection

- [ ] **10 min inactivity** triggers drift detection in `useOpenStudio` hook
- [ ] **3-level escalation:** gentle nudge → direct question → silent flag to teacher
- [ ] **Auto-revocation** — after 2 consecutive sessions with silent drift flags
- [ ] **Escalation resets per session** — new session starts at level 0

## 10. AI Mode Switching (Design Assistant)

- [ ] **Guided mode (default):** Design Assistant uses Socratic mentor system prompt
- [ ] **Open Studio mode:** when student has unlocked Open Studio, Design Assistant switches to studio critic system prompt
- [ ] **Check `conversation.ts`** — queries `open_studio_status` table, picks prompt based on status
- [ ] **After revocation:** AI switches back to guided mode

## 11. Backward Compatibility

- [ ] **Old units render fine** — units created before Open Studio migration show no errors
- [ ] **No console errors** on teacher dashboard, progress page, student dashboard, student unit page
- [ ] **Old Own Time route** returns 410 Gone (`/api/student/own-time/status`)

## 12. API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/teacher/open-studio/status` | GET | Teacher (Supabase) | List class Open Studio status |
| `/api/teacher/open-studio/status` | POST | Teacher (Supabase) | Grant unlock |
| `/api/teacher/open-studio/status` | PATCH | Teacher (Supabase) | Revoke / update settings |
| `/api/student/open-studio/status` | GET | Student (token) | Get own unlock status |
| `/api/student/open-studio/session` | POST | Student (token) | Start session |
| `/api/student/open-studio/session` | PATCH | Student (token) | Update / end session |
| `/api/student/open-studio/check-in` | POST | Student (token) | Handle check-in interactions |
| `/api/teacher/dashboard` | GET | Teacher (Supabase) | Returns `openStudioCount` per unit |

---

## Files Changed (20 Mar 2026 — UI Simplification)

| File | Change |
|------|--------|
| `src/components/open-studio/ReadinessIndicator.tsx` | Replaced 6-criteria progress ring with simple lock/unlock status card |
| `src/app/teacher/dashboard/page.tsx` | Added "Studio" pill to every unit row (always visible). ClassCard header split: class name = Link, chevron = button |
