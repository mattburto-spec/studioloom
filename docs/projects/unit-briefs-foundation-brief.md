# Phase Brief — Unit Briefs Foundation (Brief & Constraints v1)

**Status:** NOT STARTED
**FU origin:** `FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE` in `docs/projects/platform-followups.md`
**Sizing:** ~2-3 days (5 sub-phases A–E)
**Worktree:** Fresh `questerra-briefs` on branch `unit-briefs-foundation`
**Authored:** 2026-05-12

---

## Goal

Solve the "students forget the brief by week 4" problem with a unit-level Brief & Constraints surface that's always-visible from the student chrome and append-only iterable by teachers (amendment-style change orders mirroring real client behaviour).

Three layers in scope:
1. **Source** — `unit_briefs` table (one row per unit, Design-archetype-driven constraints) + `unit_brief_amendments` table (append-only, version-labelled).
2. **Teacher surface** — new route `/teacher/units/[unitId]/brief` with structured editor + amendments add-form.
3. **Student chrome** — persistent "📋 Brief vX.Y" chip in `BoldTopNav`, opens drawer with brief + constraints + amendments stack.

NOT in scope (explicit deferrals):
- Brief Reminder activity block (new ResponseType / BlockPalette / dispatcher) — defer to a Phase F follow-up after v1 ships
- Service / Inquiry / PP archetype schemas — prose-only fallback for non-Design units
- Per-student "has read brief" tracking
- Mid-unit edit badge — version pill on chip self-documents
- Per-lesson constraint overrides

---

## Decisions banked (Matt, 12 May 2026)

1. **Path 1** (new tables) — not JSONB-on-units. Constraint shapes will diverge across unit types; structured tables are cleaner long-term.
2. **Design-only v1** — Service / Inquiry / PP get prose-only fallback. Real archetype schemas wait for actual use case.
3. **Amendments instead of edit-badges** — iteration is part of design ("v2.0 add LEDs to your microbit robot"). Append-only stack mirrors real client RFI / change-order behaviour. Version pill on the chip is self-documenting; no per-student tracking needed.

---

## Pre-flight ritual (DO BEFORE TOUCHING CODE)

Run these in order. Each step has a STOP-AND-REPORT gate. Do NOT proceed to Phase A until all pre-flight findings are reported and Matt signs off.

### 1. Worktree + branch setup
```bash
# From /Users/matt/CWORK/questerra (main worktree):
git worktree add ../questerra-briefs main
cd ../questerra-briefs
git checkout -b unit-briefs-foundation
git push -u origin unit-briefs-foundation  # claim the branch on origin
```

Confirm:
- `git status` — clean working tree
- `git branch --show-current` → `unit-briefs-foundation`
- `git log -1 --pretty=format:"%h %s"` matches `origin/main` HEAD

### 2. Bring the FU + brief into the new worktree
The uncommitted FU sits in `festive-pike-64401d`. Cherry-pick or copy:
- `docs/projects/platform-followups.md` (the new FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE block — already authored)
- `docs/projects/unit-briefs-foundation-brief.md` (this file)

First commit on the new branch: `chore(briefs): file FU + brief for Unit Briefs Foundation`

### 3. Baseline npm test
```bash
npm test 2>&1 | tail -20
```
Expected count: ~5631 passing (from changelog 12 May saveme). Capture the EXACT number — this becomes the baseline. STOP if any pre-existing failures.

### 4. Re-read lessons (FULL TEXT, not titles)
Lines below reference `docs/lessons-learned.md`:

- **Lesson #4** (token-session students, not Supabase Auth) — RLS for student-side reads can't use `auth.uid()`; must use service-role + session validation. Mirror the v2 spec pattern.
- **Lesson #24** (line ~70) — migrations need `EXCEPTION WHEN duplicate_column` guards where re-runnable.
- **Lesson #38** (line ~145) — verify = assert expected VALUES, not just non-null. Tests must cross-reference code against schema CHECK constraints.
- **Lesson #41** (line 205) — NC revert for uncommitted files = Edit tool, not git checkout.
- **Lesson #43-46** (line 236) — Karpathy discipline: assumptions block, surgical scope, no speculative abstractions, capture truth from one real run.
- **Lesson #54** (registry drift) — Step 5c registry cross-check is mandatory.
- **Lesson #83** (line 1206) — every migration applied to prod gets a row in `applied_migrations` in the SAME session.
- **Lesson #86** (just banked) — loose coupling is the feature. Brief Reminder activity block (Layer 3, deferred) MUST read from `unit_briefs` at render time. Do NOT copy data into the block instance.

### 5. Audit-before-touch
Verify these surfaces match what the brief assumes:

```bash
# Confirm BoldTopNav exists and is the right surface
grep -nE "export (default |const )?BoldTopNav" src/components/student/BoldTopNav.tsx

# Confirm student unit layout wraps every unit page
ls -la src/app/(student)/unit/\[unitId\]/layout.tsx

# Confirm units table FK columns and types
psql "$DATABASE_URL" -c "\d public.units" 2>/dev/null | head -40 \
  || echo "No DATABASE_URL — use Supabase SQL editor probe instead"

# Confirm no /teacher/units/[unitId]/brief route exists
ls src/app/teacher/units/\[unitId\]/brief 2>/dev/null && echo "EXISTS — STOP" || echo "clear"

# Confirm /api/teacher/unit-brief and /api/student/unit-brief don't exist
ls src/app/api/teacher/unit-brief 2>/dev/null && echo "EXISTS — STOP" || echo "clear"
ls src/app/api/student/unit-brief 2>/dev/null && echo "EXISTS — STOP" || echo "clear"
```

### 6. Registry cross-check (Step 5c — MANDATORY)

| Registry | Action | Expected finding |
|---|---|---|
| `docs/schema-registry.yaml` | Read `units` entry (line 10666); read v2 Project Spec entries (lines 9673, 9731, 9772) as RLS templates | `units.author_teacher_id` is the right FK for `created_by`; v2 RLS pattern (teacher-only + service-role student access) is the template |
| `docs/api-registry.yaml` | Grep for `/api/teacher/unit-brief` and `/api/student/unit-brief` | Should be absent |
| `docs/projects/WIRING.yaml` | Read `unit-editor` (line 1525) and `unit-management` (line 1780) entries | Brief surface will need NEW system entry `unit-briefs` with `affects: [unit-editor, student-unit-chrome]` and `deps: [units, classes, students]` |
| `docs/feature-flags.yaml` | Search for any `brief_*` flags | Should be absent. No new flags needed for v1. |
| `docs/vendors.yaml` | N/A — no new vendors |  |
| `docs/ai-call-sites.yaml` | N/A — v1 has no AI |  |
| `docs/data-classification-taxonomy.md` | Confirm "teacher-authored content" classification for `brief_text` + `constraints` JSONB | Should match existing `units.content_data` classification (teacher-authored, no PII) |
| `docs/scanner-reports/rls-coverage.json` | After Phase A migration applies, verify scanner picks up both new tables with `rls_enabled: true` | Both tables should appear clean (RLS enabled + at least one policy) |

**Drift handling:** If `WIRING.yaml`'s `units` system has a stale `affects` list or missing entries, file as MEDIUM and close in Phase E (registry hygiene sub-phase). Do NOT pull on threads outside scope (Lesson #45).

### 7. STOP-AND-REPORT
Write an ASSUMPTIONS block to chat covering:
- Test baseline (exact number)
- All grep / ls / probe results from step 5
- Registry cross-check findings from step 6 (each row = one finding)
- Any drift between brief and code state — flag immediately

Wait for Matt's "ok proceed" before starting Phase A.

---

## Sub-phases

### Phase A — Schema + types (Matt Checkpoint A)

**Sizing:** half day.
**Goal:** Two new tables with RLS, type definitions, schema-registry updates, applied_migrations rows logged.

#### A.1 — Author migrations

Use timestamp prefix per CLAUDE.md migration discipline:
```bash
bash scripts/migrations/new-migration.sh unit_briefs_table
bash scripts/migrations/new-migration.sh unit_brief_amendments_table
```

Commit the empty stubs IMMEDIATELY (the script prints exact commands). This claims the timestamps on origin.

**Migration 1 — `unit_briefs` table:**

```sql
CREATE TABLE IF NOT EXISTS public.unit_briefs (
  unit_id      UUID PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  brief_text   TEXT,
  constraints  JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE public.unit_briefs ENABLE ROW LEVEL SECURITY;

-- Teacher who authored the unit can read + write
CREATE POLICY unit_briefs_teacher_owns ON public.unit_briefs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_briefs.unit_id
        AND u.author_teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_briefs.unit_id
        AND u.author_teacher_id = auth.uid()
    )
  );

-- Co-teachers with the unit assigned to one of their classes can read
CREATE POLICY unit_briefs_class_teacher_read ON public.unit_briefs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.class_units cu
        JOIN public.classes c ON c.id = cu.class_id
       WHERE cu.unit_id = unit_briefs.unit_id
         AND c.teacher_id = auth.uid()
         AND cu.is_active = true
    )
  );

-- Platform admins
CREATE POLICY unit_briefs_admin_all ON public.unit_briefs
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));

-- Student access via service-role only per Lesson #4. No student RLS policy.
```

**Migration 2 — `unit_brief_amendments` table:**

```sql
CREATE TABLE IF NOT EXISTS public.unit_brief_amendments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id       UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  version_label TEXT NOT NULL,            -- e.g. "v1.1", "v2.0"
  title         TEXT NOT NULL,            -- e.g. "Add LEDs"
  body          TEXT NOT NULL,            -- prose explaining the amendment
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_unit_brief_amendments_unit_id_created_at
  ON public.unit_brief_amendments (unit_id, created_at DESC);

ALTER TABLE public.unit_brief_amendments ENABLE ROW LEVEL SECURITY;

-- Mirror unit_briefs policies (teacher-owns + class-teacher-read + admin)
CREATE POLICY unit_brief_amendments_teacher_owns ON public.unit_brief_amendments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_brief_amendments.unit_id
        AND u.author_teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = unit_brief_amendments.unit_id
        AND u.author_teacher_id = auth.uid()
    )
  );

CREATE POLICY unit_brief_amendments_class_teacher_read ON public.unit_brief_amendments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.class_units cu
        JOIN public.classes c ON c.id = cu.class_id
       WHERE cu.unit_id = unit_brief_amendments.unit_id
         AND c.teacher_id = auth.uid()
         AND cu.is_active = true
    )
  );

CREATE POLICY unit_brief_amendments_admin_all ON public.unit_brief_amendments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()));
```

Down migrations: DROP TABLE for each, with safety guard refusing rollback if any rows reference the table (mirror the `_pitch-your-own` rollback pattern from `20260512053424_seed_pitch_your_own_choice_card.down.sql`).

#### A.2 — Apply migrations + log

Apply via Supabase SQL editor. Then INSERT into `applied_migrations` per Lesson #83:

```sql
INSERT INTO public.applied_migrations (name, applied_at, applied_by, source, notes)
VALUES
  ('<timestamp>_unit_briefs_table.sql', now(), 'matt', 'manual', 'Phase A Unit Briefs Foundation'),
  ('<timestamp>_unit_brief_amendments_table.sql', now(), 'matt', 'manual', 'Phase A Unit Briefs Foundation');
```

Run `bash scripts/migrations/check-applied.sh` — confirm clean.

#### A.3 — Type definitions

New file `src/types/unit-brief.ts`:

```typescript
export type UnitBriefConstraintArchetype = "design" | "generic";

export interface DesignConstraints {
  dimensions?: string;          // free-text, e.g. "max 200mm any axis"
  materials_whitelist?: string[]; // array of material chip ids
  budget?: string;               // free-text, e.g. "≤ AUD $20"
  audience?: string;             // free-text
  must_include?: string[];       // array of required-element prose entries
  must_avoid?: string[];         // array of banned-element prose entries
}

export type UnitBriefConstraints =
  | { archetype: "design"; data: DesignConstraints }
  | { archetype: "generic"; data: Record<string, never> };

export interface UnitBrief {
  unit_id: string;
  brief_text: string | null;
  constraints: UnitBriefConstraints;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface UnitBriefAmendment {
  id: string;
  unit_id: string;
  version_label: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string | null;
}
```

#### A.4 — Tests

`src/types/__tests__/unit-brief.test.ts`:
- Construct a valid `UnitBrief` with design archetype + all fields. Assert exact values.
- Construct a generic-archetype `UnitBrief` (for non-Design unit types). Assert `data` is empty object.
- Construct an amendment with `version_label: "v2.0"`, `title: "Add LEDs"`. Assert exact values.
- Cross-reference: assert `UnitBriefConstraints` discriminated union narrows correctly when `archetype === "design"`.

**Negative control:** mutate one expected value (e.g. change `version_label` assertion from `"v2.0"` to `"v3.0"`). Run tests — confirm failure. Revert via Edit tool (uncommitted, per Lesson #41).

#### Matt Checkpoint A — Sign-off criteria
- [ ] Both migrations applied to prod
- [ ] `applied_migrations` rows logged (verify via `check-applied.sh`)
- [ ] `src/types/unit-brief.ts` exists with discriminated-union types
- [ ] Type tests pass with NC verified
- [ ] `npm test` count = baseline + N new tests (state exact N)
- [ ] `npx tsc --noEmit` clean
- [ ] Three separate commits (one per migration, one for types + tests)

STOP and report. Wait for sign-off.

---

### Phase B — Teacher editor surface + API (Matt Checkpoint B)

**Sizing:** 1 day.
**Goal:** Teacher can author brief + Design constraints + initial version end-to-end via a new route.

#### B.1 — API routes

New files:
- `src/app/api/teacher/unit-brief/route.ts` — `GET ?unitId=X` returns `UnitBrief | null`, `POST` upserts via partial-patch (server merges patch with existing row, mirroring v2 product-brief pattern)
- `src/app/api/teacher/unit-brief/amendments/route.ts` — `POST` appends amendment, `GET ?unitId=X` returns amendment list ordered DESC by `created_at`

Auth: both routes use `requireTeacher()` per the hard rule. Authz: verify teacher owns the unit (`units.author_teacher_id = teacherId`) before any write; SELECT permitted via RLS for both author + co-teachers.

Response shape: `{ ok: true, brief: UnitBrief } | { ok: false, error: string }`. 4xx on bad payload, 5xx on infra. No silent errors (Lesson #67 family).

#### B.2 — Teacher editor route

New file `src/app/teacher/units/[unitId]/brief/page.tsx`.

Layout:
- Header — "Brief & Constraints" + unit title breadcrumb back to `/teacher/units/[unitId]`
- Section 1: **Brief** — multi-line textarea for `brief_text` (scenario / client request prose). Save-on-blur.
- Section 2: **Constraints (Design)** — only renders if `units.unit_type === 'design'`. Otherwise renders a banner: "Structured constraints available for Design units. This unit (type: X) uses prose-only brief."
  - Dimensions — single-line text
  - Materials — chip multi-select (reuse `MATERIALS_CHIPS` from `src/lib/project-spec/archetypes.ts`)
  - Budget — single-line text
  - Audience — single-line text
  - Must include — add-row repeater
  - Must avoid — add-row repeater
- Section 3: **Amendments** — list (most recent first) + "+ Add amendment" form (version_label + title + body, all required)

Component breakdown:
- `src/components/teacher/unit-brief/UnitBriefEditor.tsx` — top-level page component
- `src/components/teacher/unit-brief/DesignConstraintsEditor.tsx` — section 2
- `src/components/teacher/unit-brief/AmendmentsEditor.tsx` — section 3
- Reuse existing `MaterialsChipPicker` if it exists; otherwise inline

#### B.3 — Link from unit overview

In `src/app/teacher/units/[unitId]/page.tsx`, add a card / button: "📋 Brief & Constraints — set the scenario and design constraints students will reference throughout the unit." Click → `/teacher/units/[unitId]/brief`.

#### B.4 — Tests

- API route tests (mirroring v2 product-brief patterns): payload validation, auth (401 no auth / 403 wrong teacher), happy-path upsert, partial-patch merge correctness
- Component tests: editor renders prose field; renders Design constraints section ONLY when `unit_type === 'design'`; amendment form requires all three fields

#### Matt Checkpoint B — Sign-off criteria
- [ ] Teacher can navigate `/teacher/units/[unitId]` → `/teacher/units/[unitId]/brief` and back
- [ ] Author brief_text + Design constraints + save (no amendment yet)
- [ ] Reload → fields populate with saved values
- [ ] Non-Design unit type → constraints section shows the fallback banner
- [ ] All tests green
- [ ] tsc clean

STOP and report. Wait for sign-off.

---

### Phase C — Student chip + drawer (Matt Checkpoint C)

**Sizing:** half day.
**Goal:** Student sees the brief from every page in the unit, one click away.

#### C.1 — Student API

New file `src/app/api/student/unit-brief/route.ts` — `GET ?unitId=X`. Uses service-role + student session validation (Lesson #4). Returns `{ ok: true, brief: UnitBrief | null, amendments: UnitBriefAmendment[] }`. Confirms the student is enrolled in a class running this unit before returning; 403 otherwise.

#### C.2 — BoldTopNav chip

Modify `src/components/student/BoldTopNav.tsx`. Add a 📋 chip beside the unit title. Chip label: `Brief vX.Y` where the version is `v1.<amendments.length>` (so first amendment yields v1.1, second yields v1.2). If no brief exists, hide the chip.

Click opens `<BriefDrawer />` (new component, `src/components/student/unit-brief/BriefDrawer.tsx`). Drawer renders:
- Original brief prose at top
- Design constraints rendered as a labelled card (only if archetype is design)
- Amendments stacked chronologically below (oldest first — students should read them in order they were issued)
- Each amendment has its version label + title + body + date

Drawer state: local React state. No URL deeplink in v1.

#### C.3 — Data fetching

Drawer fetches lazily on first open (no need to hydrate on every page load — most students won't open it on most pages). Cache result for the session (simple useState, no react-query in v1).

#### C.4 — Tests

- API route: enrolled student gets brief; non-enrolled student gets 403; unit without brief gets `brief: null`
- Component: chip hidden when brief is null; chip label reflects amendment count (v1.0 → v1.1 → v1.2); drawer renders all sections in the right order

#### Matt Checkpoint C — Sign-off criteria
- [ ] Test student account can see the chip on every page in a unit that has a brief
- [ ] Click → drawer opens, brief renders, design constraints render, no amendments yet
- [ ] Different unit without a brief → no chip visible
- [ ] All tests green
- [ ] tsc clean

STOP and report. Wait for sign-off.

---

### Phase D — Amendments append flow (Matt Checkpoint D)

**Sizing:** half day.
**Goal:** Full v1.0 → v1.1 → v2.0 iteration lifecycle works end-to-end.

#### D.1 — Wire amendments add-form

The form was scaffolded in Phase B section 3. Wire it to `POST /api/teacher/unit-brief/amendments`. On success, refresh the list (optimistic update is fine — refetch on success).

#### D.2 — Version label discipline

Teacher types the version label as free text (`v1.1`, `v2.0`, `v1.5-emergency`). Validate non-empty + reasonable length (cap 20 chars). No format enforcement.

#### D.3 — Student drawer updates

On any new amendment, the chip label auto-updates because it's derived from amendments.length. Drawer should refetch when opened (no need for push — students notice via chip label change).

If teacher adds amendment v2.0 while student has drawer open, student doesn't see it until they close + reopen. Acceptable for v1.

#### D.4 — Tests

- Append amendment via teacher API, verify chip label increments
- Verify drawer renders amendments in chronological order (oldest first — the "story of how the brief evolved")
- Empty amendment fields → 400 from API; verify error surfaces in form

#### Matt Checkpoint D — Sign-off criteria
- [ ] Author "v1.0: Initial brief" (this is just the brief itself — no amendment row)
- [ ] Append amendment v1.1 with title + body — chip in student becomes "Brief v1.1"
- [ ] Append v2.0 — chip becomes "Brief v1.2"
- [ ] Student drawer shows amendments stacked in author-order
- [ ] All tests green
- [ ] tsc clean

STOP and report. Wait for sign-off.

---

### Phase E — Registry hygiene + saveme (Matt Checkpoint E)

**Sizing:** 30 min.
**Goal:** All five registries reflect reality. Single audit commit.

#### E.1 — schema-registry.yaml
Add `unit_briefs` and `unit_brief_amendments` entries with full column shapes, RLS policies, writers, readers, applied_via.

#### E.2 — api-registry.yaml
Run `python3 scripts/registry/scan-api-routes.py --apply`. Verify diff includes the 3 new routes (`/api/teacher/unit-brief`, `/api/teacher/unit-brief/amendments`, `/api/student/unit-brief`).

#### E.3 — WIRING.yaml
New system entry: `unit-briefs`. Fields:
- `name`: "Unit Briefs & Constraints"
- `status`: "complete"
- `deps`: `[units, classes, students, class_units, platform_admins]`
- `affects`: `[student-unit-chrome, teacher-unit-editor]`
- `data_fields`: `[brief_text, constraints (Design archetype), amendments (version_label/title/body)]`
- `key_files`: list the 4 new components + 3 new routes + 2 migrations + 1 type file
- `change_impacts`: "Changes to brief fetch logic require updating both teacher editor and student drawer. Amendment append must keep chronological order — student drawer relies on `created_at ASC`."

Update `units` system entry's `affects` to include `unit-briefs`.

#### E.4 — feature-flags.yaml + vendors.yaml + ai-call-sites.yaml
Re-run scanners. No-op expected; verify.

#### E.5 — Lessons banking (only if anything surprising surfaced)
If Phase B / C / D revealed a non-obvious wiring gotcha (e.g., BoldTopNav prop changes broke another consumer, or service-role student GET had an unexpected join cost), bank a new lesson in `docs/lessons-learned.md`.

#### E.6 — Saveme
Run the saveme ritual. Confirm:
- `applied_migrations` has both migration rows
- All 5 registries clean diff
- Changelog entry written
- Doc-manifest updated
- Handoff note written

#### Matt Checkpoint E — Sign-off criteria
- [ ] All 5 registries synced
- [ ] WIRING.yaml has new `unit-briefs` entry
- [ ] Single "Phase E: registry hygiene" commit (don't squash with feature work)
- [ ] Saveme ran clean
- [ ] PR merged to main

DONE.

---

## Stop triggers (DO NOT proceed past these)

- Pre-existing test failures in baseline → STOP, report, wait
- `units.author_teacher_id` is not the right FK target (e.g., schema drift not captured in registry) → STOP, investigate
- Existing `/teacher/units/[unitId]/brief` route already exists → STOP, audit before overwriting
- Migration applies but `applied_migrations` INSERT fails → STOP, don't proceed to next phase without tracker row (Lesson #83)
- Cross-teacher access leak surfaced in Phase B/C tests (e.g., teacher A can read teacher B's brief) → STOP, do NOT advance — RLS bug
- Student API returns 200 for a non-enrolled student → STOP, authorization bug
- `BoldTopNav` change breaks another consumer (e.g., dashboard rendering) → STOP, audit consumer count before patching

## Don't stop for

- Materials chip catalogue feeling incomplete (use what's in `MATERIALS_CHIPS` today; expansion is a follow-up)
- Drawer styling not perfect (functional > polished in v1)
- Amendment version-label format ambiguity (free text is the decision — don't enforce schema)
- Teacher unit overview page layout not feeling balanced (cosmetic; a follow-up)
- Mobile responsiveness imperfect (target desktop classroom screens first)
- No empty-state copy on the brief editor (file FU, don't slow phase)

## Open questions (decide before Phase B)

1. **Brief editor save UX** — save-on-blur per-field, or single "Save changes" button at bottom? Default: save-on-blur for the textarea / single-line fields, button-save for the chip-multi-select. Confirm before Phase B starts.
2. **Drawer position** — slide-in from right edge, or full-screen modal? Default: slide-in drawer (700px width), backdrop dims rest of page. Confirm.
3. **Chip placement in BoldTopNav** — beside unit title (left of "Lessons" / "Marking" / "Discovery" pills), or as a separate pill in the row? Default: separate purple-tinted pill on the right side of the nav row, matching Preflight nav pill pattern. Confirm.

## Sizing summary

| Phase | Estimate | Gating checkpoint |
|---|---|---|
| Pre-flight | 30 min | Matt sign-off on ASSUMPTIONS block |
| A — Schema + types | 4 hours | Matt Checkpoint A |
| B — Teacher editor + API | 6-8 hours | Matt Checkpoint B |
| C — Student chip + drawer | 3-4 hours | Matt Checkpoint C |
| D — Amendments lifecycle | 3 hours | Matt Checkpoint D |
| E — Registry hygiene + saveme | 30 min | Matt Checkpoint E |
| **Total** | **~2-3 days** | PR merged |

## Test count expectations

| Phase | Expected delta |
|---|---|
| A | +8 (type tests) |
| B | +18 (API route + component tests) |
| C | +12 (API route + chip + drawer tests) |
| D | +8 (amendment lifecycle tests) |
| **Cumulative** | baseline + ~46 |

## Follow-ups likely to surface (file when seen, don't preempt)

- `FU-BRIEFS-ACTIVITY-BLOCK-V1` (P3) — the Brief Reminder activity block (Layer 3). Deferred from this build. Spec exists in FU-PLATFORM-BRIEF-AND-CONSTRAINTS-SURFACE.
- `FU-BRIEFS-SERVICE-INQUIRY-ARCHETYPES` (P3) — when a Service or Inquiry unit teacher asks for structured constraints, build the archetype.
- `FU-BRIEFS-AMENDMENT-DEEPLINK` (P3) — open the drawer to a specific amendment via URL hash. Useful if amendments accumulate past ~5.
- `FU-BRIEFS-AI-SUGGEST-CONSTRAINTS` (P2) — given a brief prose, suggest Design constraint defaults. Only worth building once 10+ briefs have been authored organically to mine for patterns.
