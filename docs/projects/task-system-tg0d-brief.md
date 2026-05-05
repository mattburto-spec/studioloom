# Task System — TG.0D Brief: 5-Tab Summative Project-Task Drawer

> **Status:** ✅ **BUILT 5 May 2026** — Foundation merged in PR #38 (TG.0D.1 types + .2 reducer). Drawer + tabs + wiring on branch `task-system-tg0d-drawer` (TG.0D.3-.6, 7 commits). 216/216 tests passing. Awaiting Matt's 12-step Checkpoint TG.0D.1 smoke before merge. Next: TG.0E (lesson card "Builds toward..." chip).
>
> **Goal:** Enable the greyed-out "🎯 Project task" button in `AddTaskChooser`. Click → a right-side drawer opens with 5 tabs in fixed order (GRASPS → Submission → Rubric → Timeline → Policy) — backward-design-forcing per Tasks v1 prototype verdict. Same chooser, same panel, same writes-three-tables pipeline as TG.0C; just a different config surface for `task_type='summative'`.
> **Spec source:** [`task-system-architecture.md`](task-system-architecture.md) §Project task — 5-tab modal/drawer (lines 473–489).
> **Prototype:** [`docs/prototypes/tasks-v1/`](../prototypes/tasks-v1/) — Artboard 2 → Project task surface is the design reference.
> **Estimated effort:** 2 days.
> **Checkpoint:** **Checkpoint TG.0D.1** — teacher creates a summative project task end-to-end via the 5 tabs, saves as draft, edits each tab, publishes, and a Configure → button on the existing summative row reopens the drawer. Self-assessment toggle defaults to ON (Hattie d=1.33). No regression on TG.0C Quick-Check flow.
> **Push discipline:** Per memory — sub-phases ship behind Vercel preview; only Checkpoint TG.0D.1 needs explicit Matt sign-off. Push to `origin/main` after each sub-phase passes its preview smoke + tests pass.

---

## What's already locked (from TG.0A + TG.0B + TG.0C)

| Ref | Decision |
|---|---|
| TG.0B schema | `assessment_tasks.config` JSONB is the type-specific extension point. Summative writes GRASPS / submission / rubric / timeline / policy blocks here. `task_criterion_weights.rubric_descriptors` (JSONB, 4 levels) holds the per-criterion rubric. |
| TG.0C surface | The TasksPanel + AddTaskChooser + create/edit/delete pipeline is built and working. Quick-Check rows render with ⚡; summative will render with 🎯 + `[Configure →]` hint. |
| Brief §OQ-3 | Self-assessment **default ON** for summative (Hattie d=1.33). Teacher can disable via toggle, but UI nudges away ("Lower self-assessment effect — disable only if you've discussed reasons with students"). |
| Brief §OQ-5 | **Drawer, not full-page.** Right-side overlay over the lesson editor; existing edit area dims behind. Esc / outside-click closes (with unsaved-changes confirm). |
| Brief §Tab 1 | GRASPS first. A teacher who's never written backward-design tasks gets GRASPS presented BEFORE any other configuration. The UI teaches the practice (Tasks v1 prototype Friction Moment 03). |
| Cowork #4 | Type-specific shape lives in JSONB config — avoids nullable mega-column. SummativeConfig is the discriminated-union variant of TaskConfig. |
| Brief §Save behavior | "Save as draft" leaves status='draft'; "Publish" flips to 'published'. After publish, criterion-set changes require explicit confirmation (data-loss-adjacent). |
| Brief §Peer/self deferred | Policy tab's peer-evaluator config is greyed out ("Coming soon"). Tab still ships so the surface is forward-compatible. |
| Lesson #71 | Pure logic in `.tsx` files isn't testable. Form-state reducer + payload builder for summative go in a sibling `.ts` (mirroring `quick-check-form-state.ts`). |
| FU-LESSON-SIDEBAR-LAYOUT | Sidebar restructure (Editing/History/Class-Settings move) **does not block TG.0D** — the drawer renders OVER the existing layout, not in the sidebar. |

---

## Pre-work ritual (Code: complete BEFORE any TSX)

1. **Working tree clean.** `cd /Users/matt/CWORK/questerra-tasks && git status` — nothing unrelated. Branch off latest `origin/main` after polish PR #36 merged.
2. **Baseline tests green.** `npx vitest run 2>&1 | tail -5` — capture the count. Should be ≥3811 (pre-TG.0C) + 123 (TG.0C) = ~3934 passing. If drifted, that's the new baseline.
3. **Audit `SummativeConfig` stub in `src/lib/tasks/types.ts`.** TG.0C left a stub:
   ```ts
   export interface SummativeConfig {
     grasps?: Record<string, string>;
     submission_format?: "text" | "upload" | "multi";
     word_count_cap?: number;
     ai_use_policy?: "allowed" | "allowed_with_citation" | "not_allowed";
     late_policy?: string;
     resubmission?: { mode: "off" | "open_until" | "max_attempts"; until?: string; max?: number };
     self_assessment_required?: boolean;
   }
   ```
   This is the contract — TG.0D fleshes it out (concrete GRASPS shape, rubric_descriptors per criterion, group/individual policy, peer-evaluator stub). **Don't break the stub's existing field names** — `task-system-architecture.md` already documents them.
4. **Audit existing rubric descriptor authoring.** The half-shipped G1 grading work might already render rubric descriptors somewhere — reuse if so.
   ```bash
   rg -n "rubric_descriptors|RubricDescriptor|level1_2|level3_4" src/lib src/components --type ts --type tsx | head -20
   rg -n "calibrate|synthesize|StudioFloor" src/components --type tsx | head -10
   ```
   If a rubric editor exists from G1 (Calibrate / Synthesize), reuse the editor cell. If not, new component is the simplest possible: 4 textareas per criterion stacked vertically.
5. **Audit existing drawer/modal patterns.**
   ```bash
   rg -n "Drawer|Dialog\b|Modal\b" src/components --type tsx | head -20
   ```
   The repo likely already has drawer + dialog primitives (Headless UI? Radix? hand-rolled?). **Match the existing pattern — don't introduce a new modal library.**
6. **Audit GRASPS prior art.** Has GRASPS appeared anywhere? Search the master architecture brief, prompts, and Discovery content:
   ```bash
   rg -in "GRASPS|grasps" docs/ src/ | head -20
   ```
   Surface any field-shape decisions that pre-date this brief.
7. **Audit POST validator's summative-rejection path.** TG.0C's validator explicitly rejects `task_type === 'summative'` with the message "summative task creation lands in TG.0D — use formative for now". Find that line:
   ```bash
   rg -n "TG.0D" src/lib/tasks/validators.ts
   ```
   This phase removes that gate (after summative validator lands).
8. **Registry cross-check.** This phase touches ≥6 files (drawer, 5 tab components, validator extension). Spot-check:
   - `WIRING.yaml` — lesson-editor system already lists Tasks panel after TG.0C; does it need a `tasks-drawer` sub-component entry?
   - `schema-registry.yaml` — no schema changes (TG.0B's columns already cover summative).
   - `api-registry.yaml` — `/api/teacher/tasks` POST + PATCH already there; route handlers extend to summative without adding routes.
   - `feature-flags.yaml` — none. Same all-teachers ship.
   - `ai-call-sites.yaml` — none for v1. (TG.0D may eventually want AI-assisted GRASPS draft — file as FU if a teacher requests during smoke.)
9. **STOP AND REPORT** all pre-work findings before writing any TSX.

---

## Lessons to re-read (full text, not titles)

- **#38** — assert expected, not just non-null. The 5 tabs each have specific field shapes; tests verify the output payload is `{ grasps: { goal, role, ... }, submission_format: 'text', ... }` with exact keys.
- **#54** — don't trust WIRING summaries; grep for actual file paths.
- **#67** — pattern bugs across N call sites — `task_type='summative'` MUST be accepted everywhere `'formative'` is. Validator + POST + PATCH + GET denormaliser + display formatter.
- **#68** — schema verified at TG.0C.0; no new schema in this phase, so skip the `information_schema.columns` probe.
- **#71** — pure logic to `.ts` siblings. Reducer + builder for summative form state mirrors `quick-check-form-state.ts`.
- **#72** — schema-registry drift; today's registry covers all 5 tables. No reload needed.

---

## Sub-phase plan (commit per sub-task — no squashing)

### TG.0D.1 — extend `SummativeConfig` types + validators (~3 hr)

**What:** Promote the SummativeConfig stub to a concrete type. Validators handle GRASPS shape, rubric descriptors, policy block. POST + PATCH route handlers stop rejecting `task_type='summative'`.

- `src/lib/tasks/types.ts` — promote SummativeConfig:
  ```ts
  export interface GraspsBlock {
    goal: string;
    role: string;
    audience: string;
    situation: string;
    performance: string;
    standards: string;
  }
  export interface SubmissionPolicy {
    format: "text" | "upload" | "multi";
    word_count_cap?: number;
    ai_use_policy: "allowed" | "allowed_with_citation" | "not_allowed";
    integrity_declaration_required: boolean;
  }
  export interface ResubmissionPolicy {
    mode: "off" | "open_until" | "max_attempts";
    until?: string;       // ISO date when mode='open_until'
    max?: number;          // 1..10 when mode='max_attempts'
  }
  export interface PolicyBlock {
    grouping: "individual" | "group";  // 'group' currently UI-greyed
    notify_on_publish: boolean;
    notify_on_due_soon: boolean;
  }
  export interface SummativeConfig {
    grasps: GraspsBlock;
    submission: SubmissionPolicy;
    timeline: { due_date?: string; late_policy?: string; resubmission: ResubmissionPolicy; linked_pages?: Array<{ unit_id: string; page_id: string }> };
    policy: PolicyBlock;
    self_assessment_required: boolean;  // default true (OQ-3)
  }
  ```
- `src/lib/tasks/validators.ts` — `validateSummativeConfig`. Each block has its own validator (validateGraspsBlock, validateSubmissionPolicy, etc.); summative validator composes them. CreateTaskInput validator stops short-circuiting on `task_type === 'summative'`.
- `src/lib/tasks/__tests__/validators.test.ts` — extend with summative happy-path + each field's edge cases. ~25 new tests.
- `src/lib/tasks/client.ts` — add `createSummativeTask` convenience wrapper (mirrors `createQuickCheck`).

**Verify:** `npx vitest run src/lib/tasks` — passes; baseline still green.

**Commit:** `feat(task-system): TG.0D.1 — SummativeConfig types + validators`

### TG.0D.2 — pure form-state reducer for the 5-tab drawer (~3 hr)

**What:** Mirror `quick-check-form-state.ts` for summative. State shape includes all 5 tabs' field values + active-tab tracker + dirty-flag.

- `src/components/teacher/lesson-editor/summative-form-state.ts`:
  - `SummativeFormState` interface — all 5 blocks plus `activeTab: 'grasps' | 'submission' | 'rubric' | 'timeline' | 'policy'`, `dirty: boolean`, `criteria: Array<{ key, weight, descriptors }>`.
  - `summativeReducer(state, action)` — actions: `setGraspsField`, `setSubmissionField`, `addCriterion`, `removeCriterion`, `setCriterionWeight`, `setRubricDescriptor`, `setTimelineField`, `setPolicyField`, `setActiveTab`, `loadFromTask` (for edit mode), `reset`.
  - `INITIAL_SUMMATIVE_STATE` — empty GRASPS, default submission (text + AI not allowed + integrity required), 1 default criterion (researching, weight 100), default timeline (no due, off resubmission), default policy (individual + notifications on), self_assessment_required=true.
  - `validateSummativeForm(state)` — returns array of errors keyed by tab so the drawer can highlight tabs with issues.
  - `isSummativeFormReady(state)` — true if no errors.
  - `buildSummativeCreateInput(state, unitId, classId)` — builds `CreateTaskInput` from form state.
- `src/components/teacher/lesson-editor/__tests__/summative-form-state.test.ts` — ~30 new tests.

**Commit:** `feat(task-system): TG.0D.2 — summative form-state reducer + validators`

### TG.0D.3 — TaskDrawer shell + tab navigation (~3 hr)

**What:** The right-side drawer with 5-tab nav, Save/Publish footer, dim-background scrim, ESC + outside-click close (with unsaved-changes confirm).

- `src/components/teacher/lesson-editor/TaskDrawer.tsx` — drawer shell. Props: `unitId`, `classId`, `framework`, `pages`, `editingTask?` (for edit-mode), `onSaved`, `onClose`. Manages the form-state reducer. Renders: scrim div + drawer card (right-side, ~480px wide). Tab nav at top with badges showing error counts per tab. Tab-content slot for the active tab. Footer with "Save as draft" / "Publish" / "Cancel" buttons.
- `src/components/teacher/lesson-editor/TaskDrawerTabNav.tsx` — pure tab-nav component (no form-state coupling). Takes `activeTab`, `errorCountsByTab`, `onTabChange`. Tabs in fixed order with numbers (1. GRASPS, 2. Submission, ...). Click → `onTabChange`.
- Hook `useDrawerKeyboard(active, onClose)` for ESC + focus-trap. Match the existing modal/dialog pattern from pre-work Step 5.
- `src/components/teacher/lesson-editor/__tests__/task-drawer-tab-nav.test.ts` — pure-logic tests for the tab nav (renderable order, error-badge rendering math).

**Commit:** `feat(task-system): TG.0D.3 — TaskDrawer shell + tab navigation`

### TG.0D.4 — 5 tab content components (~5 hr)

**What:** Each tab is a thin React component reading + dispatching against the reducer. No new state owned by these.

- `GraspsTab.tsx` — 6 small textareas (Goal, Role, Audience, Situation, Performance, Standards). Each with example placeholder ("e.g. Design a roller-coaster brief for a Year 7 audience that..."). Per Friction Moment 03, mini-help copy at the top of the tab explaining backward design.
- `SubmissionTab.tsx` — format radio (text / upload / multi), word-count input (visible only when format includes text), AI-use policy radio with helper text per option, integrity-declaration toggle.
- `RubricTab.tsx` — criterion list (multi-select pill picker via FrameworkAdapter; default the 1 added criterion). For each selected criterion: 4 textareas (level 1-2, 3-4, 5-6, 7-8). Self-assessment toggle at the top with the OQ-3 nudge copy ("Locked-on by default — Hattie d=1.33. Disable only if you've discussed with students.").
- `TimelineTab.tsx` — due-date picker, late-policy textarea, resubmission select (off/open-until/max-attempts) with conditional fields, linked-lessons multi-select pill picker (mirrors Quick-Check).
- `PolicyTab.tsx` — grouping radio (Individual ✓ / Group greyed-out "Coming soon — peer & group v1.1"), notification toggles (notify-on-publish / notify-on-due-soon).
- All 5 tabs are JSX-only — pure logic stays in the reducer + builder. No new tests needed at this layer (tab nav covers the wiring; reducer covers the data).

**Commit:** `feat(task-system): TG.0D.4 — 5 tab content components`

### TG.0D.5 — wire chooser → drawer + Configure → on summative rows (~2 hr)

**What:** The control plumbing.

- `AddTaskChooser.tsx` — un-grey the project-task button. Wire onClick to a new `onChooseProjectTask` prop.
- `TasksPanel.tsx` — addMode state gains `'summative'` variant. In that mode, render `<TaskDrawer />` instead of a row. handleSaved wires through the same path (optimistic add).
- `TasksPanel.tsx` — for existing summative rows, the `[Configure →]` hint becomes a click target → opens `<TaskDrawer editingTask={task} />`. (Per OQ — the existing ✎ icon stays Quick-Check-only; summative edits go through the drawer for the full surface.)
- Tests: ~5 source-static guards on TasksPanel covering the two new entry points + drawer mount.

**Commit:** `feat(task-system): TG.0D.5 — wire chooser + Configure→ to drawer`

### TG.0D.6 — registry sync + smoke seed + handoff (~1.5 hr)

**What:** Bookkeeping. Same pattern as TG.0C.6.

- `python3 scripts/registry/scan-api-routes.py --apply` — no new routes, but the GET denormaliser may pick up summative now that creation works. Verify diff is empty or expected.
- `WIRING.yaml` — extend lesson-editor's key_files list with the 7 new TG.0D files.
- `scripts/tg-0d/seed-tg0d-summative-task.sql` — parameter-bound script seeding 1 summative task with full GRASPS + 4-criterion rubric + linked_pages. Lets Matt smoke without filling 5 tabs from scratch.
- `docs/handoff/task-system-tg0d-build.md`.
- `docs/projects/ALL-PROJECTS.md` — flip status, mark TG.0D done.

**Commit:** `chore(task-system): TG.0D.6 — registry sync + smoke seed + handoff`

### TG.0D.7 — Matt Checkpoint TG.0D.1 (full smoke)

**Smoke script:**

1. Open a real unit. Click `+ Add task` → chooser shows BOTH buttons enabled.
2. Click "🎯 Project task" → drawer slides in from right; GRASPS tab is open by default.
3. Fill GRASPS (all 6 fields). Click Tab 2 (Submission) → fill. Click Tab 3 (Rubric) → add 2 criteria, fill 8 descriptors total. Tab 4 → set due date + open-until resubmission. Tab 5 → leave Individual + notifications on.
4. Click "Save as draft". Drawer closes. Row appears in TasksPanel with 🎯 icon, criterion list, due date, "[Configure →]" hint.
5. Refresh page. Row still there.
6. Click "[Configure →]" on the row. Drawer reopens with all 5 tabs prefilled. Edit GRASPS goal. Save. Refresh. New value persists.
7. Reopen drawer. Click "Publish". Status badge in row changes to "Published".
8. Try to reopen + change criterion set. Confirm dialog appears ("Changing criteria after publish requires regrading. Confirm?").
9. ESC during drag-fill → unsaved-changes confirm appears.
10. Self-assessment toggle in Rubric tab: confirm default ON, copy reads the OQ-3 nudge, can be flipped OFF.
11. No regression: TG.0C Quick-Check flow still works end-to-end.
12. Verify in Supabase: 1 row in `assessment_tasks` (task_type='summative', config has grasps + submission + timeline + policy + self_assessment_required), N rows in `task_criterion_weights` (with rubric_descriptors populated), M rows in `task_lesson_links`.

**Pass criteria:** All 12 steps green. No console errors.

**On pass:** Merge to main, mark TG.0D complete, kick off TG.0E (lesson card "Builds toward..." chip).

---

## Stop triggers

- **Existing rubric editor in G1 has a different shape than `task_criterion_weights.rubric_descriptors`** — pivot to G1's shape or write an adapter; don't fork the rubric model.
- **No drawer/modal pattern in the repo** — that means hand-rolled. Build the simplest possible (scrim div + portal-mounted right-side card) — DO NOT pull in Headless UI or Radix mid-phase. File FU-DRAWER-PRIMITIVE if a third surface ever wants the same.
- **`task_type='summative'` validator failing** — pre-work Step 7 catches the rejection guard; if removing it breaks the existing 7 tests in route.test.ts that assert the rejection, those tests need updating, not the validator. Update tests to assert summative is now accepted.
- **JSONB config shape collides with TG.0C formative writes** — the discriminated union's `kind` field protects this, but if I accidentally write summative shape into a formative row (or vice versa), GET denormaliser might trip. Run a probe write + read after TG.0D.1 to confirm.
- **Self-assessment toggle nudge copy is ambiguous** — check Matt's call before shipping the OQ-3 nudge text. The brief locks "default ON"; the copy is mine.
- **Drawer-vs-modal accessibility** — focus trap, ARIA roles, ESC handling. If pre-work Step 5 finds an existing accessibility-clean drawer pattern, use it. If not, the simplest-possible has minimum: `role="dialog"`, `aria-modal="true"`, focus on the first input on mount, ESC closes, focus restored to trigger on close.
- **Rubric tab handles >4 criteria badly** — when MYP teachers select all 4 criteria + IGCSE teachers select 6 AOs, the tab gets long. Decide: scroll inside tab, or accordion-collapse criteria? Default to scroll; file FU-RUBRIC-ACCORDION if it's painful.

## Don't stop for

- Visual polish on the drawer transition (slide animation, scrim fade) — functional first.
- Per-criterion rubric descriptor templates / AI-assisted draft — file as FU; v1 ships blank textareas.
- Group/peer evaluator UI — Policy tab Group radio is greyed; that's the v1 affordance.
- Multi-language support for GRASPS labels — ship English; framework's i18n is a separate concern.
- ManageBac export — TG.0H.
- Student-side rendering of summative tasks — TG.0F.
- Lesson chip integration — TG.0E.
- The FU-LESSON-SIDEBAR-LAYOUT restructure — drawer doesn't need it.

---

## Test discipline

- **Per Lesson #38:** route handler tests + reducer tests assert specific config keys and values, not just presence. The summative payload structure (grasps.goal, submission.format='text', timeline.resubmission.mode='open_until', policy.grouping='individual', self_assessment_required=true) is the contract — the tests are the contract enforcement.
- **Per Lesson #71:** all summative form-state logic in `summative-form-state.ts`; tests import from `.ts` not `.tsx`. Tab nav formatter (error-count badge math) similarly in a `.ts` sibling.
- Coverage target: ~50–60 new tests across validators (~25), reducer (~30), tab nav (~5).
- tsc strict must stay clean for any TG.0D file.

---

## Rollback

If TG.0D.7 Checkpoint fails badly:
- Revert the merged commits via `git revert <range>` on main. No schema changes; rolling back removes the drawer surface, leaves the schema+TG.0C surface intact.
- The chooser's project-task button regresses to greyed-out "Coming soon" — same state as pre-TG.0D.

---

## Files expected to change

- **NEW lib:** `src/lib/tasks/__tests__/validators.test.ts` (extend), no other lib files
- **NEW components:** `TaskDrawer.tsx`, `TaskDrawerTabNav.tsx`, `summative-form-state.ts`, `GraspsTab.tsx`, `SubmissionTab.tsx`, `RubricTab.tsx`, `TimelineTab.tsx`, `PolicyTab.tsx`
- **NEW tests:** `__tests__/summative-form-state.test.ts`, `__tests__/task-drawer-tab-nav.test.ts`
- **MODIFIED:** `src/lib/tasks/types.ts` (promote SummativeConfig), `src/lib/tasks/validators.ts` (summative validator), `src/lib/tasks/client.ts` (createSummativeTask wrapper), `AddTaskChooser.tsx` (un-grey button), `TasksPanel.tsx` (mount drawer + Configure→ click), `LessonEditor.tsx` (no change expected unless drawer-portal mounts at a different level)
- **NEW:** `scripts/tg-0d/seed-tg0d-summative-task.sql`, `docs/handoff/task-system-tg0d-build.md`
- **MODIFIED:** `docs/api-registry.yaml` (scanner sync), `docs/projects/WIRING.yaml`, `docs/projects/ALL-PROJECTS.md`

---

## Architecture questions Matt may want to confirm before kick-off

(Same convention as TG.0C — defaults stand if Matt says "go".)

1. **Drawer width** — 480px (default — comfortable on a 1366px+ screen, Tab 3 Rubric still readable with 4 criteria expanded). Widen to 560px if Matt wants more breathing room? Narrower (e.g. 420px) to leave more lesson editor visible behind the scrim?

2. **Self-assessment nudge copy** — current draft for the toggle helper text:
   > "Self-assessment is locked-on by default. Hattie's research shows it's the highest-effect feedback mechanism we have (d=1.33). Disable only if you've discussed reasons with students."

   Too didactic? Shorter version: "Locked-on by default (Hattie d=1.33). Disable with care."

3. **Rubric default state** — the drawer opens Tab 3 with 1 default criterion (researching, weight 100). Should it be 0 criteria so the teacher consciously picks? Or all-4 of MYP's criteria pre-added (more visual scaffolding)?

4. **Resubmission mode default** — Off / Open until / Max attempts. Default is "off" (no resubmission). Some MYP teachers might want default "max attempts: 2" since revision-as-learning is a frame they teach in. Confirm "off" is the v1 default?

5. **Group/peer Policy tab** — Group radio greyed-out per brief. Should we even ship the Policy tab in v1, or fold it into Submission tab (notification toggles + grouping=individual)? **Recommendation: ship the tab** — students/teachers see the full surface coming; Group label tells them v1.1 is on the horizon.

If all 5 defaults stand, just say "go" and I start TG.0D.1.
