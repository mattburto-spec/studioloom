# Handoff — saveme-pitch-workflow-day

**Last session ended:** 2026-05-12T14:00Z (approx — handoff written at end of day-of-class saveme)
**Worktree:** `/Users/matt/CWORK/questerra/.claude/worktrees/festive-pike-64401d`
**HEAD:** `287bef0` "feat(choice-cards): "Change my mind" affordance unlocks the deck for re-pick (#218)"

## What just happened

- **Product Brief archetype expansion** — added 4 new archetypes (Film/Video, Fashion/Wearable, Event/Service/Performance, Other/Pitch-your-own) + parallel-shipped App/Digital Tool. 7 total archetypes now in `PRODUCT_BRIEF_ARCHETYPES`.
- **Pitch-to-teacher workflow for Other archetype** — migration `20260512044835_product_brief_pitch_workflow.sql` (5 pitch_* columns + CHECK + partial index) applied to prod. `PitchGate` sub-component gates the 8-slot walker behind pitch approval. `POST/GET /api/teacher/product-brief-pitch` + `/teacher/pitches` review page shipped.
- **Choice Cards `_pitch-your-own` FK seed hot-fix** — migration `20260512053424_seed_pitch_your_own_choice_card.sql` applied to prod (placeholder row INSERT with rollback safety guard).
- **Choice Cards "Change my mind" affordance** — local-only state reset on re-pick; no downstream cascade. Architectural decision banked in Lesson #86.
- **v1 Project Spec retirement** — old unified block hidden from editor + student render. v2 (3-block split) is the production spec surface.
- **Reopen-to-revise links** added to all 4 completion summary cards.
- **Image-upload PII fix (PR #211)** — `formatAnswer` for image kind now emits `[Photo: <caption>]` (was `[Photo] <URL>` — URL's UUID segment was tripping CN-landline regex in moderation). Lesson #85 banked.
- **Misc UX polish** — Materials chips expanded to 12 entries, "Race day"→"Project end" timeline label, term sync, Grade→Marking tab redirect, infinite-loop top-nav hotfix via `useSpecBridge` ref pattern (PR #184).

## State of working tree

- **Branch:** `saveme-pitch-workflow-day` (fresh from origin/main this morning)
- **Pending push:** 0 commits ahead of origin
- **Unstaged changes (saveme deliverables, not yet committed):**
  - `docs/api-registry.yaml` (scanner output)
  - `docs/changelog.md` (new session entry at top)
  - `docs/lessons-learned.md` (lessons #84, #85, #86 appended)
  - `docs/projects/WIRING.yaml` (project-spec-block extended)
  - `docs/projects/platform-followups.md` (cascade FU downgraded)
  - `docs/scanner-reports/*.json` (5 scanner output diffs)
  - `docs/schema-registry.yaml` (pitch columns + sentinel seed)
- **Tests:** ~5631 passing (last known good — not re-run for this saveme)
- **Migrations applied to prod this session (2):**
  - `20260512044835_product_brief_pitch_workflow.sql`
  - `20260512053424_seed_pitch_your_own_choice_card.sql`

## Next steps

- [ ] **Stop building. Run the G8 + G9 classes.** See what students actually do with Product Brief / User Profile / Success Criteria + pitch workflow + Choice Cards. The architectural calls baked in today (loose coupling on re-pick, deferred AI scaffolding for pitches) are bets that need real-classroom validation before any next move.
- [ ] **If Case 3 bites (student re-picks Choice Card AFTER filling Product Brief slots into incompatible archetype):** ship the soft warning per `FU-PLATFORM-CHOICE-CARDS-DOWNSTREAM-CASCADE` (P3). DO NOT build the cascade.
- [ ] **If pitch flow surfaces friction:** consider `FU-PRODUCT-BRIEF-AI-PITCH-SCAFFOLD` (P2) — AI-assisted drafting helper. Was deferred to keep v1 class-usable today.
- [ ] **If teacher pitch queue grows past ~20 items:** consider `FU-PRODUCT-BRIEF-AI-PITCH-EVAL` (P3) — auto-flag obviously-off-piste pitches.
- [ ] **`FU-PROD-MIGRATION-BACKLOG-AUDIT` (P1)** — surfaced previously and still unresolved. Prod schema has drifted hard from repo migrations. Worth auditing what's actually applied vs what code assumes before next big push. Plan filed at `docs/projects/prod-migration-backlog-audit-brief.md`.
- [ ] **`FU-K`** (Dimensions3) — student-snapshot route casts criterion_scores wrongly. Still open as P1.
- [ ] When picking the next build: registry cross-check before drafting any phase brief (per `build-phase-prep` Step 5c — Lesson #54).

## Open questions / blockers

- **Pitch-flow scope** — current MVP has no notifications. If a student pitches and the teacher doesn't see /teacher/pitches that day, the student is blocked indefinitely. Acceptable for this class size (Matt's only teacher; will check the page). NOT acceptable for multi-teacher schools. Notification trigger (email or in-app bell) should ship before pilot scaling.
- **Pitch rejection cleanup** — if teacher rejects pitch AFTER student has typed slot answers (shouldn't happen because PitchGate blocks the walker, but possible if state desyncs), what happens to the orphan slots? Filed as `FU-PRODUCT-BRIEF-PITCH-REJECT-CLEANUP` (P3). Not seen in prod yet.
- **`changelog.md` write conflicts during saveme** — twice during this saveme the file was modified between Read and Edit, requiring re-read. May be background sync / auto-linter. Not blocking but worth understanding if it keeps happening.
