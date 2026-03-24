# StudioLoom Full Site Audit — 24 March 2026

## Executive Summary

**Scale:** ~275 files, ~75K LOC, 66 pages, 152 API endpoints, 431 components, 44 database migrations.

**Bottom line:** StudioLoom has an enormous amount of code and infrastructure, but much of it is **unwired, untested, or half-connected**. The biggest risk isn't missing features — it's that existing features don't fully work end-to-end. Before building anything new, Matt needs to close the gaps in what's already built, or he'll keep building on a shaky foundation.

---

## Part 1: What's Actually Working vs. What Looks Built

### SOLID — Tested or Actively Used
| Feature | Evidence |
|---------|----------|
| Student login + token sessions | Fixed 23 Mar (Vercel CDN + PGRST201 bugs). Now works in production. |
| Unit builder wizard (7-step) | Core generation pipeline functional. Skeleton + journey generation producing valid Workshop Model output. |
| Knowledge base upload + RAG | 3-pass analysis pipeline running. Hybrid search working. |
| Design assistant (Socratic mentor) | Haiku 4.5, 300-token cap, mode switching (guided vs Open Studio). Auth fixed. |
| Toolkit browser (42 tools) | 13 interactive tools live at `/toolkit`. Public, no auth required. Working. |
| Report Writer free tool | Live at `/tools/report-writer`. Working. |
| Safety Badge system | Migration 035 APPLIED. Create → assign → test → earn flow exists. |
| Unit forking (copy-on-write) | Migration 040 APPLIED. Fork-on-write, content resolution chain wired everywhere. |
| Student-class junction | Migration 041 APPLIED. Multi-class enrollment working. |
| Timetable + cycle engine | Migration 038 APPLIED. Rotating cycles, iCal import, next-class API. |
| Dashboard (teacher + student) | Both rendering. Teacher has Teach Now, unit rows, class cards. Student has Continue card. |

### BUILT BUT UNTESTED END-TO-END
These features have code and migrations but have never been verified working as a complete flow:

| Feature | What's Missing |
|---------|---------------|
| **Grading page** (1,311 lines!) | Exists at `/teacher/classes/[classId]/grading/[unitId]`. Migration 019 APPLIED. But: has it ever been used to grade a real student? Does saving work? Does it read forked content? Does it use the class_students junction? The roadmap says "No Way to Record Grades Currently" — but the page exists. **This needs testing, not rebuilding.** |
| **NM / Melbourne Metrics** | Phase 1 code complete, migrations 030+032+033 APPLIED. But: has a teacher actually configured NM for a class, had a student self-assess, then viewed results? Full e2e checklist exists at `docs/nm-test-checklist.md` but hasn't been run. |
| **Unit-as-template architecture** | Migrations APPLIED, code wired. But: assigned classes, per-class settings, NM inheritance — all untested in production. |
| **Lesson scheduling + overrides** | LessonSchedule component built, TimetableGrid built. But: depends on migration 037 which is **NOT YET APPLIED**. Dead code until that migration runs. |
| **School calendar / terms** | SchoolCalendarSetup component built. But: migration 037 **NOT YET APPLIED**. Dead code. |
| **Safety badge sidebar layout** | Code committed (f995075) but not pushed or tested. ModuleRenderer singleBlock prop added. |
| **Open Studio** | Migration 029 APPLIED, all components integrated. But: has a teacher actually unlocked a student, had them run a session, seen check-ins, drift detection, auto-revocation? Comic strip Discovery exists but is untested. |
| **Teaching Mode** | Live teaching cockpit + projector built. But: has it been used in an actual class? Does student polling work? Does the projector sync? Does it correctly resolve forked content per class? |
| **Pace feedback** | Student endpoint + teacher aggregation built, migration 036 APPLIED. But: has a student actually submitted pace feedback? Does the teacher see it on the progress page? |
| **Academic integrity** | MonitoredTextarea + analyzeIntegrity + IntegrityReport built. But: **not wired into any student submission flow**. The textarea exists as a component but nothing uses it in production. |
| **Student toolkit persistence** | useToolSession hook + API routes built, migration 028 status unclear. But: **not wired into any toolkit tool component**. Auto-save doesn't actually happen. |

### ROADMAP SAYS "NEEDED" BUT CODE ALREADY EXISTS
The roadmap is out of sync with reality in several places:

| Roadmap Claim | Reality |
|---------------|---------|
| "Phase 0 Grading — No Way to Record Grades" | `/teacher/classes/[classId]/grading/[unitId]/page.tsx` is 1,311 lines with criterion scoring (1-8), tags, targets, comments, moderation status, evidence viewer, save/load. Migration 019 exists. **The grading page is built.** |
| "Teaching Mode Quick-Access Toolbar — Still Needed" | `src/components/teach/` has 10 files including TeachingToolbar, RandomPicker, GroupMaker, NoiseMeter, QuickEdit, OnTheFlyPanel, Stopwatch, QuickTimer, ClassClock. **Most toolbar tools are built.** |
| "Real-time Teacher Dashboard — Still Needed" | Teaching Mode already polls student status every 8 seconds with needs-help detection. The "real-time dashboard" in Phase 4 overlaps heavily with what Teaching Mode already does. |

---

## Part 2: Dependency Map — What Blocks What

### CRITICAL DEPENDENCY CHAINS

```
Migration 037 (NOT APPLIED)
  └── School calendar / terms → term picker on class-unit settings
  └── Schedule overrides JSONB → LessonSchedule component
  └── Lesson-to-date mapping → "continues next class" overrides
  └── Term-based lesson count → schedule preview

  ⚠️ ALL scheduling UI is dead code until this migration runs.
  ⚠️ This is a 2-minute fix: `supabase db push`
```

```
Migration 025 (NOT APPLIED)
  └── ai_usage_log table → usage tracking
  └── Cost per student metrics → AI Insights Dashboard (Phase 4)
  └── Rate limiting visibility → monetisation gates (Phase 7)

  ⚠️ You're burning AI money with zero visibility into costs.
```

```
Phase 0.5 (Lesson Quality & Editing) ← MUST come before content creation
  └── Inline activity editor → teacher can fix AI output quickly
  └── Quick-add activity → teacher can insert routines
  └── Debrief protocol library → AI generates varied debriefs
  └── Split-pane preview → teacher can verify student view

  ⚠️ Without this, every unit Matt builds will need manual JSONB hacking.
```

```
Grading page testing ← MUST come before AI-assisted grading
  └── Verify existing grading page works with forked content
  └── Verify it uses class_students junction (not old class_id FK)
  └── Verify assessment_records save/load correctly
  └── THEN layer AI suggestions on top (Phase 4)

  ⚠️ The roadmap proposes building a new grading page. One already exists.
     Test it first. Fix what's broken. Then enhance.
```

```
Academic integrity wiring ← MUST come before grading
  └── MonitoredTextarea into ResponseInput (enableIntegrityMonitoring prop exists but unused)
  └── Store integrityMetadata alongside responses
  └── Integrity column on grading page

  ⚠️ If students submit work before integrity monitoring is wired in,
     that work has no integrity data. Retroactive monitoring is impossible.
```

```
Student toolkit persistence wiring ← MUST come before embedded toolkit in lessons
  └── Wire useToolSession into toolkit tool components
  └── Test auto-save + session resumption
  └── THEN embed tools in lesson pages (Student Toolkit Access spec)

  ⚠️ The hook exists. The API exists. Nothing connects them to the UI.
```

```
Content forking e2e testing ← MUST come before teachers create class-specific content
  └── Verify fork-on-write works (edit → class_units.content_data populated)
  └── Verify students see forked content (not master)
  └── Verify Teaching Mode + Projector use forked content
  └── Verify Save as Version + Reset to Master work

  ⚠️ Untested forking could silently show wrong content to students.
```

### THINGS THAT CREATE REWORK IF DONE OUT OF ORDER

| If you build this... | Before this... | You'll have to redo... |
|---------------------|----------------|----------------------|
| More toolkit tools | Toolkit persistence wiring | Retrofitting auto-save into each tool |
| AI-assisted grading | Testing existing grading page | Potentially rebuilding grading UI that already works |
| New unit content | Phase 0.5 lesson editing | Manually fixing every lesson's JSONB |
| Embedded toolkit in lessons | Toolkit persistence | Adding save/resume to each embedded instance |
| NM Phase 2 (progression tracking) | NM Phase 1 e2e testing | Fixing data integrity issues after students have used broken NM |
| Monetisation gates | Usage tracking (migration 025) | No data to base tier limits on |
| Peer review / Gallery | Grading working | No teacher scores to compare peer feedback against |
| Parent portal | Grading + progress working | Nothing meaningful to show parents |

---

## Part 3: The Honest Priority Stack

### TIER 0: DO THIS WEEK (costs nothing, unblocks everything)

1. **Apply migration 037** — `supabase db push`. 2 minutes. Unblocks all scheduling features.
2. **Apply migration 025** — same command. Unblocks usage tracking. You need cost visibility.
3. **Push commit f995075** — safety badge sidebar. Blocked by network proxy; push when on different network.
4. **Test the existing grading page** — open `/teacher/classes/[classId]/grading/[unitId]` with a real unit. Does it load students? Can you enter scores? Does save work? If yes, update the roadmap (it's not "not built" — it's "not tested"). If no, fix what's broken.
5. **Update the roadmap** — Phase 0 Grading says "No Way to Record Grades Currently" but the grading page is 1,311 lines. Either it works or it doesn't. Find out.

### TIER 1: CLOSE THE GAPS (before building anything new)

6. **Wire MonitoredTextarea into ResponseInput** (~2 hours). The prop `enableIntegrityMonitoring` already exists on ResponseInput. Just flip it on for text responses. Store metadata in responses JSONB. Every student submission from this point forward has integrity data.

7. **Wire useToolSession into toolkit tools** (~1 day). The hook exists. The API exists. Connect them. Start with SCAMPER (reference tool), then apply the pattern to the other 12. This unblocks embedded toolkit in lessons.

8. **Content forking e2e test** (~half day). The 7-point checklist exists in CLAUDE.md. Run through it manually. Fix anything broken. This is critical — if forking silently serves wrong content, teachers will lose trust.

9. **NM e2e test** (~half day). Checklist at `docs/nm-test-checklist.md`. Run it. Fix anything broken.

10. **Open Studio e2e test** (~half day). Checklist at `docs/open-studio-test-checklist.md`. Run it. Fix anything broken.

### TIER 2: FOUNDATION FOR CONTENT CREATION

11. **Phase 0.5: Lesson quality + editing** (~8-10 days, as scoped in roadmap). This is the right call — get generation quality and editing flow right before building real units. Start with the debrief protocol library and extension quality rules (1 day, immediate quality lift), then inline activity editor (2-3 days, core editing UX).

12. **Test grading page with forked content** — does it resolve class-local content? Does it use class_students junction? Fix if needed. This is faster than building a new grading page from scratch.

### TIER 3: BUILD NEW FEATURES

13. **Class Gallery & Peer Review** — the spec exists. But only after grading works (teachers need to score work before peer feedback makes sense) and toolkit persistence is wired (peer review could use toolkit tools).

14. **Lesson Plan Converter** — spec exists. Import existing lessons. But only after Phase 0.5 (teachers need to be able to edit what gets imported).

### TIER 4: EVENTUALLY

15. NM Phase 2, Parent Portal, Monetisation, Workshop Management — all blocked by everything above working first.

---

## Part 4: Code Health Issues

### Dead Code
- `src/components/own-time/` — 2 files, deprecated by Open Studio. Safe to delete.
- `src/app/api/teacher/own-time/approve/` — still on disk, unreferenced. Safe to delete.
- School calendar UI + LessonSchedule component — functional code but dead until migration 037 runs.

### Largest Files (complexity risk)
| File | Lines | Risk |
|------|-------|------|
| `src/lib/ai/prompts.ts` | ~5,400 | Single point of failure for ALL AI generation. Any bug here affects everything. Needs tests. |
| `src/app/(student)/safety/[badgeId]/page.tsx` | ~1,330 | Safety badge test page. Complex state machine (3 screens + sidebar). Needs testing. |
| `src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx` | 1,311 | Grading page. Never tested in production. |
| `src/app/teacher/teach/[unitId]/page.tsx` | ~710 | Teaching cockpit. Never tested with real students. |

### Unapplied Migrations
| Migration | Impact | Effort to Apply |
|-----------|--------|----------------|
| 025 (usage tracking) | No AI cost visibility | `supabase db push` |
| 037 (school calendar + schedule_overrides) | All scheduling UI dead | `supabase db push` |

### Architecture Concerns
- **prompts.ts is 108KB** — this is the largest file in the project and the single source of truth for all AI behaviour. A typo here breaks everything. It has prompt snapshot tests but no integration tests.
- **47% API code duplication** — the feature audit found ~2,890 wasted lines across toolkit API routes. `callHaiku()` copied 17 times. Needs a shared utility.
- **No integration tests** — 38 unit tests exist (prompt snapshots, framework vocab, timing validation) but zero tests for: student login → page load → response submit → save. Zero API route tests.
- **Student auth footgun** — the pattern of accidentally using `requireTeacherAuth` on student routes has caused 3 bugs already. A lint rule or shared middleware would prevent this.

---

## Part 5: Roadmap Sync Recommendations

### Remove from roadmap (already built):
- "Phase 0 Grading — basic score entry" → **exists** at 1,311 lines. Test it, don't rebuild it.
- "Teaching Mode Quick-Access Toolbar" → **mostly built** (10 components in `src/components/teach/`). Wire what exists, build what's missing.
- "Real-time Teacher Dashboard" → **largely overlaps** with Teaching Mode's 8-second polling. Clarify what's different.

### Add to roadmap:
- **"Wiring Sprint"** — 2-3 days of connecting existing but unwired features (integrity monitoring, toolkit persistence, integrity column on grading page).
- **"E2E Testing Sprint"** — 2-3 days running through all existing test checklists (forking, NM, Open Studio, safety badges, pace feedback, timetable, grading).
- **"API deduplication"** — extract shared `callHaiku()` utility, shared effort-assessment logic, shared tool API pattern. Cuts ~2,890 lines.

### Reorder in roadmap:
- Phase 0.5 (Lesson Editing) is correctly placed — must come before content creation.
- Phase 0 Grading should become "Test + Fix Existing Grading Page" (~1-2 days, not 3-5 days).
- Academic integrity wiring should move UP to Tier 1 (before any student submissions, not Phase 6).

---

## Summary: The One Slide

**StudioLoom has ~75K lines of code. About 60% is solid, 25% is built but untested, and 15% is unwired.**

The single highest-leverage action right now is NOT building new features. It's:

1. Apply the 2 pending migrations (5 minutes)
2. Test the 5 major untested features (2-3 days)
3. Wire the 3 disconnected systems (1-2 days)
4. THEN build Phase 0.5 lesson editing (8-10 days)
5. THEN start creating real unit content

Everything else is premature until the foundation is verified.
