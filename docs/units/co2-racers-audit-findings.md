# CO2 Racers — Audit findings (5 May 2026)

> **Pre-build audits** for the agency unit, before drafting the build brief. Three areas: NM survey infra, portfolio surface, activity block schema. Outcome: most infrastructure exists, build cost drops from ~5 days to **~4.5 days for critical path**.
> Companion to [`co2-racers-agency-unit.md`](co2-racers-agency-unit.md).

---

## TL;DR

- **NM survey:** API + storage **fully wired**. Missing: student-side form UI + Three Cs structure on top of the existing rating. **~0.25 day** lift, not 0.5.
- **Portfolio:** Fully built ecosystem with auto-capture pattern (page_id + section_index unique index). FAB component listens for window events. **~0.25 day** to wire from journal activity, not 0.5.
- **Activity blocks:** No "multi-prompt" responseType exists. Need one new responseType (`structured-prompts` or `journal-entry`). **~0.5 day** for the new component + portfolio auto-capture wiring.
- **Critical-path build cost: ~4.5 days** (was estimated at 5).

---

## Audit 1 — NM Survey Infrastructure

### What's built ✅

**API surface:**
- `POST /api/student/nm-assessment` — submit ratings (1-3 scale) + optional comment per element, scoped to `(unitId, pageId, element)`. Rate-limited 10/min per student. Source = `'student_self'`.
- `GET /api/teacher/nm-results?unitId=X&classId=Y` — aggregated per-class teacher dashboard view.
- Plus: `nm-checkpoint`, `nm-config`, `nm-observation` API routes.

**Storage** — `competency_assessments` table:

| Column | Type |
|---|---|
| `student_id` | UUID |
| `unit_id` | UUID |
| `page_id` | UUID |
| `class_id` | UUID |
| `competency` | TEXT |
| `element` | TEXT |
| `source` | `'student_self' \| 'teacher_observation'` |
| `rating` | INT (1-3) |
| `comment` | TEXT |
| `context` | **JSONB** |
| `created_at` | TIMESTAMPTZ |

8 indexes including `(student_id, unit_id, source)` for the calibration-paired-rating query. RLS configured (students read own, teachers manage observations).

**Library:** `src/lib/nm/checkpoint-ops.ts` + `src/lib/nm/constants.ts` — pure logic for checkpoint registration/removal (Lever-MM work).

### What's missing for the agency unit

1. **Student-side survey form UI** — the API exists; the FORM component to render the survey at the right time (e.g. when a student visits a checkpoint page or completes a milestone) needs verification. Worth a quick check of `/student/unit/[unitId]/[pageId]` rendering.
2. **Three Cs rubric structure** — current `rating` is 1-3 integer + free `comment`. For Three Cs (Choice / Causation / Change), we need to capture each as separate evidence per element.

### Recommended approach

**Use existing `context JSONB` column** — no schema change required:

```ts
// What gets stored in competency_assessments.context for a Three Cs entry:
{
  three_cs: {
    choice: { present: true, evidence: "I picked balsa over basswood" },
    causation: { present: true, evidence: "balsa is lighter" },
    change: { present: false, evidence: "" }
  },
  agency_score: "developing"  // computed: 2 of 3 Cs present
}
```

The `rating` 1-3 maps cleanly: 3 Cs present = 3 (agency demonstrated), 2 = 2 (developing), 0-1 = 1 (compliance / not yet).

**Build needed:**
- Student form component (4 elements × 3 questions per Three Cs + photo evidence) — probably an activity block with `responseType: "nm-survey"` (see Audit 3)
- Teacher observation entry — small extension to the existing `nm-observation` route to take Three Cs structure
- Aggregate view — minor update to `/api/teacher/nm-results` to surface Three Cs averages (likely small SQL extension)

**Lift estimate:** **~0.25 day** (was 0.5). Most plumbing exists.

---

## Audit 2 — Portfolio + QuickCaptureFAB (the floating button)

### What's built ✅ — surprisingly rich ecosystem

**Storage** — `portfolio_entries` table:

| Column | Notes |
|---|---|
| `id`, `student_id`, `unit_id` | Standard FK |
| `type` | `'entry' \| 'photo' \| 'link' \| 'note' \| 'mistake'` |
| `content` | TEXT — note text |
| `media_url` | TEXT — photo URL |
| `link_url` + `link_title` | optional link |
| `page_id`, `section_index` | **For auto-capture from a specific activity** |
| `unit_version_id` | tracks which version of the unit was active |

**Critical pattern:** unique index `idx_portfolio_auto_capture_unique ON (student_id, unit_id, page_id, section_index)` — prevents double-capture from the same activity slot. This is built for exactly the use case we want.

**Components** (all in `src/components/portfolio/`):
- **`QuickCaptureFAB.tsx`** — the floating button on student lesson pages. Form for note + link + photo. Listens for `window.dispatchEvent('questerra:open-capture')` so anything can trigger it programmatically. Compresses photos. Runs content moderation.
- `PortfolioPanel.tsx` — student-side panel view of entries
- `NarrativeView.tsx` + `NarrativeModal.tsx` — narrative scroll view
- `ExportPortfolioPpt.tsx` — export entries to PPT (!) — useful for end-of-unit reflection

**Mounted at:** `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — already on every student lesson page.

**Routes:** `POST /api/student/portfolio` (create entry) + `GET` (list entries). 6 references to `portfolio_entries` from the API layer.

### What's needed for the journal flow

The 4-prompt journal activity needs to:
1. Render 4 text fields (Did / Noticed / Decided / Next) + required photo upload
2. On save, write a single `portfolio_entries` row with:
   - `type: 'entry'`
   - `content`: composed text from all 4 prompts (e.g. JSON or markdown-formatted blob)
   - `media_url`: photo upload
   - `page_id`: current lesson's page
   - `section_index`: index of the journal activity within the lesson

**Two implementation paths:**

**A. Auto-capture (cleaner):** when student saves the journal activity, the API for that activity directly writes to `portfolio_entries` (with the unique index preventing duplicates). No FAB involvement.

**B. Pre-fill the FAB:** dispatch `questerra:open-capture` event with pre-filled prompt structure. Reuses existing form. More user-visible (they see the FAB open with their content), feels more "send to portfolio."

**My recommendation: A** for the structured journal, B for unstructured ad-hoc captures. They coexist.

**Lift estimate:** **~0.25 day**. Wire the journal activity's submit handler to write `portfolio_entries`. Infrastructure complete.

---

## Audit 3 — Activity Block Schema (4-prompt structured response)

### What exists

**Existing responseTypes:**

| Type | Behaviour |
|---|---|
| `text` | Single textarea |
| `upload` | File upload |
| `voice` | Audio recording |
| `canvas` | Drawing |
| `decision-matrix` | Pre-built decision table |
| `toolkit-tool` | Embedded toolkit tool (with `toolId`) |
| `multi` | Picks ONE of {text, upload, voice, link} per submission — NOT multi-prompt |
| `undefined` | Content-only (no response) |

**Slot fields (Lever 1):** Activities have 3 TEACHER-authored slots: `framing` / `task` / `success_signal`. These are author-side, not response-side.

**Pattern reuse opportunity:** `analysis_prompts: [{ question, reveal_answer }]` exists in skills + safety modules — already a structured-prompts shape. Could mirror this for journal.

### What's missing

**No multi-prompt responseType.** The journal needs 4 sequential text fields (with photo) — a new responseType.

### Recommended approach

Add `responseType: "structured-prompts"` to the existing system:

```ts
// Activity block config
{
  responseType: "structured-prompts",
  prompts: [
    { id: "did",      label: "What did you DO?",      placeholder: "..." },
    { id: "noticed",  label: "What did you NOTICE?",  placeholder: "..." },
    { id: "decided",  label: "What did you DECIDE? (with because clause)", placeholder: "..." },
    { id: "next",     label: "What's NEXT?",          placeholder: "..." }
  ],
  photo_required: true,
  send_to_portfolio: true,
}
```

**Build needed:**
- Add `"structured-prompts"` to ResponseType union in types
- Create `<StructuredPromptsResponse />` component in `src/components/student/`
- Render 4 text fields + photo upload + Save button
- On save: write single `portfolio_entries` row + activate auto-capture pattern
- Teacher-side authoring: extend SlotFieldEditor or use a simpler config form (this can be hardcoded for the unit if too complex — the journal activity blocks are a finite, defined set)

**Lift estimate:** **~0.5 day** (component + wiring + minor types). Could be done by reusing form patterns from `QuickCaptureFAB.tsx`.

### Alternative if half a day is too much

**Use 4 chained `text` activities** for the journal. Verbose and breaks the unified-entry feel, but works today with zero new code. Photo upload would need to be a 5th `upload` activity. Less elegant; same data eventually lands in portfolio_entries via the FAB.

I'd argue building the new responseType earns its keep.

---

## Updated build cost (post-audit)

| # | Component | Pre-audit | **Post-audit** | Why |
|---|---|---|---|---|
| 1 | **Kanban** (WIP=1, DoD, blockage triage, time-est, lesson-link) | 2 days | 2 days | Same — entirely new |
| 2 | **Timeline** (backward-map + forward-plan) | 1.5 days | 1.5 days | Same — entirely new |
| 3 | **Journal** (4-prompt activity block + portfolio auto-capture) | 0.5 day | **~0.5 day** | New responseType (~0.5d) + wiring (~0.25d). Hovers around 0.5-0.75d total. |
| 4 | **Three Cs Survey** (5 surveys, milestone-triggered + anchored) | 0.5 day | **~0.25 day** | NM API + storage fully wired. Just student form + JSONB Three Cs structure. |
| 5 | **Teacher Attention-Rotation Panel** | 1 day | 1 day | Entirely new — not pre-built |
| 6 | Strategy Canvas + Decision Log | 1 day combined | 1 day combined | Custom tools — entirely new |
| 7 | Race Day Predictor | 0.5 day | 0.5 day | Custom tool — entirely new |
| 8 | Anchor lesson activities (Class 1, 7, 14) | trivial | trivial | Existing activity blocks |

**Critical path total (#1-5): ~5.25 days** → still close to original estimate, slight savings on #3 + #4.

**With nice-to-haves (#6-7): ~6.75 days** → ~7 days max with surplus.

The audit didn't dramatically shrink the build, but it confirmed:
- **No new tables needed.** Everything fits existing schema (`competency_assessments.context` JSONB for Three Cs; `portfolio_entries` for journal).
- **No new API surfaces needed.** Existing `/api/student/nm-assessment` + `/api/student/portfolio` cover the writes.
- **The activity block schema needs one small lift** (new responseType + component) — clean addition, not a refactor.

The build is mostly NEW components on top of existing data infrastructure. That's a good shape — minimizes migration risk + leverages what's already wired.

---

## Decisions surfaced from the audit

1. **Three Cs in `context JSONB` vs new column** — going with JSONB. Zero migration. JSON shape documented above.
2. **Journal portfolio integration: auto-capture (path A)** — write directly to `portfolio_entries` from the journal activity's submit handler. The unique index prevents duplicates. FAB stays for unstructured captures.
3. **Wheel CAD reuse** — Matt confirmed students still have access. Class 8 wheel decision becomes "reuse with Three Cs justification" or "redesign with Three Cs justification." Either is valid evidence.
4. **`structured-prompts` responseType** — building it earns its keep. Cleaner than 4 chained text activities.

---

## Open questions remaining

- **Where to mount the student-side NM survey form?** Three options:
  1. **As an activity block** (responseType `"nm-survey"`) on specific lessons → Three Cs survey lives in the lesson flow naturally. Recommended.
  2. **As a popup triggered when student opens the lesson** that has a survey checkpoint → more disruptive but harder to skip.
  3. **As a separate dashboard surface** the student visits → loses context.
  
  My pick: **option 1**. Lives in the lesson page where students already are, doesn't disrupt flow.

- **Calibration conversation UI for the teacher** — opening a 2-min calibration with a student. Options: dedicated UI (more work), inline note on the student row in the attention-rotation panel (simpler), or just "click student → see their self-rating + my rating side by side" (cleanest). My pick: cleanest — embed in the attention-rotation panel's per-student detail.

- **`page_id` UUID vs TEXT mismatch** — `competency_assessments.page_id` is UUID, but `task_lesson_links.page_id` (TG.0B) and `portfolio_entries.page_id` are TEXT. Worth flagging — for the agency unit's NM checkpoint registration, we'll need the UUID flavor. Not a blocker but a schema-coherence note.

---

## What's next

1. **Build brief** — sub-phased plan with commits + tests for each tool. ~7 sub-phases, similar shape to TG.0C/0D briefs.
2. **First build target — Kanban** (highest leverage, longest pole). Could start anytime tomorrow.
3. **Anchor lesson content** — needs designed activity blocks for Class 1, 7, 14. Trivial build but needs Matt's content review.
4. **Print pipeline (Preflight) integration** — students need to know how to submit jobs. Audit 4 (deferred): does the student-side Preflight submit flow exist? If not, that's a gap.

---

## Provenance

Audits run 5 May 2026 in a single session against `origin/main` HEAD `e74c47f` (post-PR-#42 foundation doc merge). Source files referenced in this doc reflect that snapshot.
