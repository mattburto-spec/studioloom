# StudioLoom — Current Status & Priority To-Do List
*27 March 2026*

## Where We Are

~310 files, ~90K lines of code. Deployed to Vercel (studioloom-teal.vercel.app). 50 migrations (025–050), all APPLIED except 028 (student tool sessions — status unknown). 20 commits ahead of origin (blocked by school proxy).

**The honest truth:** About 70% of the codebase is built and wired. ~25% is built but untested end-to-end. ~5% is built but unwired. You're at the point where new features create diminishing returns — the next 10% of value comes from testing, fixing, and polishing what exists.

---

## TIER 0 — DO THIS WEEK (unblocks everything)

| # | Task | Est. | Status |
|---|------|------|--------|
| 1 | **Push 20+ pending commits** | 5 min | ⛔ Blocked by school proxy — do from home/phone hotspot |
| 2 | **Run backfill-activity-ids script** | 10 min | 🔴 Required before drag-to-reorder is safe in production |
| 3 | **Verify migration 028** (student_tool_sessions) | 5 min | 🔴 Check if table exists in Supabase dashboard |
| 4 | **Remove debug artifacts** | 15 min | 🟡 Yellow diagnostic box on student lesson page, console.log in student unit API |
| 5 | **Set `subject` field on classes** in Supabase | 10 min | 🟡 Improves card color detection on student dashboard |

---

## TIER 1 — CLOSE THE GAPS (~3-5 days)

These are features that are *built* but never tested end-to-end with real data. Every one of them could have a silent bug that makes them useless in production. Test before building anything new.

| # | Task | Est. | Depends On |
|---|------|------|-----------|
| 6 | **Content forking e2e test** | 0.5d | Push |
| 7 | **NM (Melbourne Metrics) e2e test** | 0.5d | Push |
| 8 | **Open Studio e2e test** | 0.5d | Push |
| 9 | **Safety badge e2e test** | 0.5d | Push |
| 10 | **Grading page full test** | 0.5d | Push |
| 11 | **Discovery Engine playtest** with real students | 1d | Push |
| 12 | **Gallery & Peer Review playtest** | 0.5d | Push |
| 13 | **Wire MonitoredTextarea into ResponseInput** | 2hr | — |
| 14 | **Pace feedback + timetable + scheduling test** | 0.5d | Push |

**Test checklists exist for:** NM (`docs/nm-test-checklist.md`), Open Studio (`docs/open-studio-test-checklist.md`), timing engine (`docs/timing-engine-test-checklist.md`). Forking checklist is in CLAUDE.md (7 points).

---

## TIER 2 — HIGH-VALUE POLISH (~5-7 days)

Things that make the difference between "demo" and "usable product."

| # | Task | Est. | Why |
|---|------|------|-----|
| 15 | **Phase 0.5 remaining:** debrief protocol library + prompt enrichment | 2d | AI lesson quality is mediocre without this |
| 16 | **Student preview mode** in lesson editor | 1d | Teachers can't see what students will see |
| 17 | **Wire Discovery profile into Design Assistant** (Phase A) | 2-3d | Huge differentiator — AI mentor that actually knows the student |
| 18 | **"Share to Gallery" button** from portfolio/unit pages | 0.5d | Gallery only accessible from dashboard currently |
| 19 | **Teaching Mode gallery integration** | 0.5d | Teacher can't see gallery status during class |

---

## TIER 3 — NEW FEATURES (only after Tiers 0-2)

Prioritized by teacher impact and build-on-what-exists leverage.

### Near Term (next 2-4 weeks)

| # | Feature | Est. | Notes |
|---|---------|------|-------|
| 20 | **Lesson Plan Converter** | ✅ BUILT | Frontend + backend complete. `/teacher/units/import` page with 3-screen flow. Needs e2e testing with real lesson plans. |
| 21 | **Cover/Relief Lessons** (Phase 4.5) | 2d | One-page PDF for substitute teachers. Highest teacher time-saver. |
| 22 | **Parent Progress Snapshots** (Phase 4.5) | 2-3d | PDF for parent-teacher conferences. Leverages all existing data. |
| 23 | **Absent Student Catch-Up** (Phase 4.5) | 1.5d | Guided page for students who missed class. |
| 24 | **Projector classroom tools** | 2-3d | Random picker, timer, group maker, noise meter. |

### Medium Term (4-8 weeks)

| # | Feature | Est. | Notes |
|---|---------|------|-------|
| 25 | **Year Planner** | 4d | Visual horizontal timeline. Spec ready. |
| 26 | **Curriculum Coverage Map** (Layer 1) | 2-3d | Heatmap overlay on year planner. |
| 27 | **Kahoot-style Live Quiz** from Teaching Mode | 4-5d | Reuses safety badge question engine. |
| 28 | **Discovery Phase B** — adaptive flow for returning students | 3-4d | Skip known stations on 2nd+ unit. |
| 29 | **Risk Assessments** (Phase 4.5) | 2d | Auto-formatted hazard docs. |
| 30 | **Smart Student Grouping** (Phase 4.5) | 2d | Optimal peer groups from existing data. |

### Longer Term (8+ weeks)

| # | Feature | Est. | Notes |
|---|---------|------|-------|
| 31 | **Exemplar-aware grading** (Phase A) | 1w | Upload student work with achievement levels. |
| 32 | **AI-assisted criterion marking** (Phase B) | 2-3w | AI suggests scores with evidence mapping. |
| 33 | **Designer Level system** | 5-7d | Quality-weighted student progression. Needs grading. |
| 34 | **Shared Knowledge Pool** | 2w | Community intelligence across teachers. |
| 35 | **Cross-teacher moderation** | 2w | IB MYP internal moderation tool. Killer differentiator. |
| 36 | **Built-in design tools** (mood board, color palette, etc.) | 8-12w | Auto-save to portfolio. Start with color palette (2-3d). |
| 37 | **School Identity & Multi-tenancy** (Phase 3.5) | 2-3w | School as tenant anchor. |

---

## What's Actually Built & Working (Feature Map)

### Core Platform ✅
- Unit Builder Wizard (7-step, AI-powered)
- Knowledge Base (PDF/DOCX/PPTX upload → 3-pass analysis → embedding → hybrid search)
- Design Assistant (Socratic mentor, Haiku 4.5, effort-gated)
- Student lesson pages (10+ response types)
- Portfolio auto-pipeline + Quick Capture
- Planning/Gantt view
- Teacher dashboard + class management
- LMS integration (LTI 1.0a)
- Rate limiting, usage tracking, Sentry

### Teaching Tools ✅
- Teaching Mode cockpit (live student grid, phase timer, projector view)
- Lesson Timing Engine (Workshop Model, validation, presets)
- Phase 0.5 Lesson Editor (12 components, drag-and-drop, auto-save, undo)
- Timetable & Scheduling (rotating cycles, iCal import)
- School Calendar / Term system
- Lesson Scheduling with overrides

### Student Features ✅
- Student Onboarding ("Studio Setup" — mentor, theme, profile)
- Discovery Engine (8 stations, ~9,500 lines)
- Open Studio (self-directed mode, drift detection)
- Safety Badge system (quiz, gate, certifications)
- Design Thinking Toolkit (42 tools browsable, 24 interactive with persistence)
- Class Gallery & Peer Review (3 formats, effort-gated)
- Student Learning Profile (intake survey)
- Pace feedback (one-tap)

### Assessment & Analytics ✅ (partial)
- Melbourne Metrics / NM (student pulse + teacher observation)
- Grading page (inline criterion scoring, partially tested)
- Academic Integrity (MonitoredTextarea, scoring engine, report viewer — NOT wired into submissions)
- AI usage tracking

### Architecture ✅
- Unit-as-Template (units are templates, classes are instances)
- Content Forking (copy-on-write per class)
- Student-Class Junction (multi-class enrollment)
- Version History (save/reset/track forks)

---

## Key Risks

1. **20+ commits not pushed.** If your laptop dies, you lose ~15,000 lines of code. Push ASAP.
2. **5 major features untested e2e.** Forking, NM, Open Studio, grading, safety badges could all have silent bugs.
3. **MonitoredTextarea not wired.** Academic integrity data isn't being collected from any student submissions.
4. **student_progress lacks class_id.** Breaks if same student takes same unit in two classes. Low probability but architecturally unsound.
5. **0 real students have used Discovery Engine, Gallery, or Onboarding.** These are big, complex features that need live testing.

---

## The Honest Priority

**Stop building. Start testing. Then start using it with your students.**

The next 10 hours of your time are best spent:
1. Push commits (5 min)
2. Run backfill script (10 min)
3. Test the 5 untested features with your own classes (3-5 hours)
4. Fix whatever breaks (2-4 hours)
5. Wire MonitoredTextarea (2 hours)

After that, the highest-impact new build is the **Lesson Plan Converter** (lets you import your existing lesson plans) followed by **Phase 4.5 teacher time-savers** (cover lessons, parent snapshots — things you'd actually use next week).
