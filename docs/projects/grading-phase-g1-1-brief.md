# Grading Phase G1.1 — Sub-Phase Brief

> Calibrate page + tile-strip queue + per-row Confirm flow.
>
> Drafted: 28 April 2026
> Status: **DRAFT — awaiting Matt sign-off** before pre-flight begins.
>
> Parent brief: [`grading-phase-g1-brief.md`](grading-phase-g1-brief.md) (G1 master plan).
> Schema applied to prod 27–28 Apr (`student_tile_grades` + `student_tile_grade_events` + `page_id` TEXT fix).
> Build methodology: [`docs/build-methodology.md`](../build-methodology.md).
> Visual reference: [`docs/prototypes/grading-v2/`](../prototypes/grading-v2/) — open `Grading v2.html`.

---

## 1. Goal

Ship the **Calibrate** view — the horizontal-first marking experience — so a teacher can:

1. Open `/teacher/marking` and see a tile-strip queue across the top of the page (one button per lesson tile, showing criterion + title + confirmed/N progress).
2. Click a tile to load the per-student row list below: avatar, name, score selector, Confirm button.
3. Confirm or set a score on each row. Save round-trips through `save-tile-grade.ts` writing both the grade row AND an audit event row in one transaction.
4. See the tile-strip progress update as students get confirmed.

**No AI yet** — that's G1.3. The AI quote slot renders as an empty placeholder. **No inline override panel yet** — that's G1.2. Just the row + Confirm button.

**Estimated effort:** ~1 day. **No new migrations expected.**

---

## 2. What's IN scope

- **Route:** `/teacher/marking` (no params → most-recently-active lesson). Drill-down: `/teacher/marking?lesson=<lessonId>`.
- **`ScorePill` atom** at `src/components/grading/ScorePill.tsx` — extracted from prototype, 4 visual states (empty, ai-suggested-unconfirmed, teacher-confirmed, teacher-overridden). Dashed-border-when-unconfirmed / solid-when-confirmed per design lock.
- **`TileStripQueue`** at `src/components/grading/TileStripQueue.tsx` — horizontal strip across top, one button per tile in the active lesson. Each button: criterion chip, tile title (truncated), confirmed/N progress. Active tile highlighted.
- **`CalibrateRow`** at `src/components/grading/CalibrateRow.tsx` — one row per student. Columns: avatar/name, AI quote slot (empty placeholder), `ScorePill` (the score input), Confirm button. Framework-aware score selector via `getGradingScale(class.framework)`.
- **`CalibratePage`** at `src/app/teacher/marking/page.tsx` — container, picks lesson, renders strip + rows.
- **`useTileGrades(lessonId)` hook** at `src/lib/grading/use-tile-grades.ts` — fetches grades for the lesson + students in the class, returns map `(student_id, tile_id) → row`.
- **Service:** `src/lib/grading/save-tile-grade.ts` — single write site. Wraps grade UPSERT + event INSERT in a Supabase RPC or two-statement transaction. Source enum picked by call site (`teacher_confirm` if score unchanged + confirmed→true, `teacher_override` if score set distinct from prior, `teacher_revise` if confirmed row gets re-touched).
- **API:** `src/app/api/teacher/grading/tile-grades/route.ts` — POST creates, PATCH updates. Auths via teacher Supabase session. Mirrors auth pattern from `src/app/api/teacher/assessments/route.ts`.
- **Tests** (added to existing vitest suite):
  - `ScorePill` — 4 visual states, asserts exact CSS classnames (Lesson #38).
  - `TileStripQueue` — progress count math, active-state styling.
  - `save-tile-grade` — service writes both grade + event in one call. Source enum mapped correctly per call site (3 fixtures: confirm / override / revise).
  - API route — auth required, write round-trip, validates `criterion_keys` against the 8-key taxonomy (CHECK rejection should surface as 400).

---

## 3. What's OUT of scope

Code must NOT silently expand into these:

- **Inline override expand panel** (full work + 1–8 grid + override note) — G1.2.
- **AI pre-score / ghost values / Haiku call** — G1.3.
- **Per-class AI on/off toggle** + the `classes.ai_grading_enabled` micro-migration — G1.3.
- **Synthesize per-student view + past-feedback memory** — G1.4.
- **Anchored inline feedback** for students — G3.
- **Class Hub Grade tab redirect** — defer; existing tab still points at the old page.
- **Existing `/teacher/classes/[classId]/grading/[unitId]` page changes** — leave as-is.
- **Studio Floor (clustered grading)** — G2 deferred entirely.
- **Cross-teacher moderation** — G7.

If a sub-task surfaces "this would be much cleaner with X from G1.2/3/4," file as `GRADING-FU-<n>` and continue.

---

## 4. Spec sections to re-read

| Section | Path | Why |
|---|---|---|
| Locked-in design | [grading-phase-g1-brief.md §0](grading-phase-g1-brief.md) | Mode model + `ScorePill` extraction order + visual language |
| Schema | [grading-phase-g1-brief.md §13.H](grading-phase-g1-brief.md) | Column shape, write-time normalization, dual-shape with `assessment_records` |
| Tile-ID stability | [grading-phase-g1-brief.md §13.G](grading-phase-g1-brief.md) | Response-key format `activity_<id>` / `section_<idx>` — `tile_id` MUST match |
| Existing grading page | [src/app/teacher/classes/\[classId\]/grading/\[unitId\]/page.tsx](../../src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx) | Pattern reference for student_progress reads + framework-aware score rendering |
| FrameworkAdapter | [src/lib/frameworks/adapter.ts](../../src/lib/frameworks/adapter.ts) | `fromLabel()` plural-array semantics for write-time normalization |
| MYPflex helpers | [src/lib/constants.ts](../../src/lib/constants.ts) → `getGradingScale()` | Framework-aware score selector (number for percentage, buttons for discrete) |
| Visual prototype | [docs/prototypes/grading-v2/](../prototypes/grading-v2/) | Cream `#F5F1EA` / paper `#FBF8F2` / Manrope + Instrument Serif Italic |

---

## 5. Lessons re-read list

- **#22** — Junction-first-fallback for student lookup. `useTileGrades` must scan via `class_students` junction first when fetching the row list.
- **#29** — UNION-pattern RLS for dual-visibility. Probably doesn't apply (G1 scoped to class teacher), but check before writing API auth code.
- **#34** — Test baseline drift. Capture `npm test` count BEFORE touching code. Locked baseline at end of G1.0 = **2215 passed, 9 skipped**. Verify still 2215 at sub-phase start.
- **#38** — Verify = assert exact values, not non-null. ScorePill tests assert exact classnames; service tests assert exact event-row shape.
- **#39** — Audit-then-fix-all for pattern bugs. We just used this on the `page_id` UUID→TEXT fix — same discipline applies if anything surfaces during pre-flight.
- **#42** — Dual-shape persistence. The grade row's `criterion_keys` is neutral; `assessment_records.data.criterion_scores[]` (when G1.4 lands the rollup) will be framework-specific. The absorber at `src/lib/criterion-scores/normalize.ts` documents the boundary — DON'T touch it from G1.1, but read it once so we don't accidentally write framework codes to `student_tile_grades.criterion_keys`.

---

## 6. Pre-flight ritual (mandatory — STOP and report after)

Before writing any code:

1. `git status` clean on `grading-v1`.
2. `npm test` — verify baseline still **2215 passed, 9 skipped**. If drift, report and stop.
3. Re-read lessons #22, #29, #34, #38, #39, #42.
4. **Audit data flow** before designing the page query:
   - How does the existing grading page (`src/app/teacher/classes/[classId]/grading/[unitId]/page.tsx`, 1,311 lines) read student responses from `student_progress`? What's the response-key shape?
   - Does it walk `content_data` to get the page → tile list, or does it read `student_progress.responses` keys directly? Recommendation in §13.G says the response key is `activity_<id>` / `section_<idx>`, BUT verify: do all 11 prod units actually carry that shape now after the backfill?
   - How does it resolve `class.framework` for the score selector? Same `getGradingScale()` helper everywhere?
   - How is "most-recently-active lesson" computable for the no-params landing? Cheap query (`MAX(updated_at)` join) or expensive multi-table scan?
5. **Audit student row data:**
   - Does `students.avatar_url` exist? If not, fallback to initials in `CalibrateRow`.
   - Junction-first-fallback (Lesson #22): use `class_students` to enumerate the cohort, NOT `students.class_id` (which is a deprecated direct FK on some legacy rows).
6. Read `/Users/matt/CWORK/.active-sessions.txt` — confirm no parallel session is editing grading code or migrations.
7. **STOP and report the audit findings.** This is the G1.1.0 Matt Checkpoint gate. Do not write code until sign-off.

The pre-flight has caught more problems than any test suite — it caught the `page_id` UUID bug for G1.0. Skipping it is the most common failure mode (per parent brief §6).

---

## 7. Migration discipline

**No new migrations expected for G1.1.** Schema is in. If pre-flight surfaces a missing column (e.g., `students.avatar_url` truly missing and we choose to add it rather than fall back to initials), follow the standard claim discipline: `bash scripts/migrations/new-migration.sh <descriptor>`, commit + push empty stub immediately, then write body.

---

## 8. Stop triggers

Code stops and reports if:

- Audit finds the existing grading page reads `student_progress.responses` in a different key shape than `activity_<id>` / `section_<idx>` — would mean our `tile_id` design is wrong.
- Audit finds `class.framework` is null on any class with active grading — we'd need a backfill before the score selector renders correctly.
- The Supabase RPC for transactional grade+event write is harder than expected — fall back to two sequential RPCs with manual rollback on event failure, but report the choice.
- Test count drops below 2215 baseline at any sub-task gate.
- Any change requires touching MonitoredTextarea internals (out of scope per parent brief).
- A pattern bug surfaces (e.g., a hardcoded UUID assumption in another file we'd touch) — file as `GRADING-FU-<n>` and stop.

## 9. Don't stop for

- Existing ESLint warnings (FU-6 already filed).
- Score-selector micro-animations, tile-strip overflow scroll, button hover polish.
- Loading-skeleton subtleties.
- Empty-state design beyond a placeholder.
- "AI quote slot would look better with X" — empty until G1.3.
- Pre-existing TypeScript `any` in adjacent files.
- Color tweaks beyond the specced cream `#F5F1EA` / paper `#FBF8F2` palette.
- "Cleaner with G1.2's expand-on-click" thoughts — keep G1.1 to the row + Confirm.

---

## 10. Sub-task → Checkpoint gates

| Sub-task | Definition of done | Gate |
|---|---|---|
| **G1.1.0 Pre-flight + audit** | Baseline test count verified. Data flow documented (response keys, framework resolution, lesson-recency query, avatar availability). | **Matt sign-off** before any code |
| **G1.1.1 `ScorePill` atom** | 4 visual states render. Framework-aware (button grid vs number input). Tests assert exact classnames + states. | Inline review (not a full checkpoint) |
| **G1.1.2 Service + API** | `save-tile-grade.ts` writes grade + event in one transaction. API route auths via teacher Supabase session. Tests cover the 3 source enums (confirm/override/revise) + CHECK-constraint rejection round-trips as 400. | Inline review |
| **G1.1.3 Calibrate page (strip + rows)** | `/teacher/marking` loads. Tile strip renders with progress. Click tile → row list updates. Confirm → save round-trips → strip progress increments. No regressions in existing grading page. | **Checkpoint G1.1** — full smoke + report |

Each checkpoint = code pauses, full report, wait for explicit sign-off before next sub-task.

---

## 11. Open questions

**Q1.1.A. Lesson-recency landing.** `/teacher/marking` with no params — which lesson opens? Recommendation: the teacher's most-recently-edited unit's first lesson with ≥1 student response. Verify this is a cheap query in pre-flight; if expensive, fall back to "select a class" landing.

**Q1.1.B. AI quote placeholder.** For G1.1, what shows in the AI-quote slot (before G1.3 wires Haiku)? Recommendation: blank. No "AI will go here" placeholder — empty space is honest. Confirm.

**Q1.1.C. Score selector for percentage frameworks.** Discrete frameworks (MYP 1–8, PLTW 1–4) get a button grid. Percentage gets a number input per MYPflex Phase 1. Reuse the existing `getGradingScale()` helper. Confirm no other framework needs custom UI in G1.1.

**Q1.1.D. Transaction shape.** Supabase RPC for `save-tile-grade` (calls a stored function that does both writes), or two API-side sequential calls with retry? Recommendation: RPC — atomic + simpler error handling. Slightly more SQL to write, but the audit-trail integrity argument from the future-proof additions justifies it. Confirm.

**Q1.1.E. Cohort enumeration.** Pull from `class_students` junction or also fall back to legacy `students.class_id`? Lesson #22 says junction-first-fallback. Recommendation: junction first; if pre-flight finds any active class still keyed only by direct FK, file as FU and ship junction-only. Confirm.

---

## 12. Pickup snippet (for the next session that builds G1.1.0 pre-flight)

```
Read /Users/matt/CWORK/questerra-grading/docs/projects/grading-phase-g1-1-brief.md
end-to-end. G1 schema is applied to prod (both 20260427133507 + 20260428024002).
Begin with §6 pre-flight ritual — STOP and report findings before any code.
G1.1.0 audit gate must clear before G1.1.1 ScorePill code.
```
