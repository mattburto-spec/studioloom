# Tasks Architecture Probe — Design Prototype

> **Source:** Claude Design (claude.ai/design) handoff bundle, fetched 5 May 2026.
> **Original prompt:** drafted in CWORK conversation 4 May 2026 mid-Lever-MM close-out, after independent reviews from Cowork + Gemini converged on Option A (unified `assessment_tasks` primitive). The probe tested whether the *teacher's create surface* should follow the same unification or split.
> **Status:** **CANONICAL design for the upcoming Task System Architecture brief** (`docs/projects/task-system-architecture.md` — to be written next). The brief will absorb both this verdict and the existing G1 grading work.

---

## How to view

Open `Tasks Architecture Probe.html` directly in a browser. The page is a Babel-compiled React 18 prototype on a DesignCanvas (zoom, pan, multiple artboards). Three artboards render top-to-bottom:

1. **01 — Unified surface** — one screen, type-aware. Two configured states side-by-side: a quick formative check vs a full summative project. Demonstrates the unification problem visually.
2. **02 — Split surfaces** — chooser up front; inline-row form for quick checks; multi-step (5-tab) configuration for projects. Rubric is tab 3, self-assessment locked on next to it.
3. **03 — The decision** — verdict panel with three named teacher-friction moments where the unified surface breaks.

The HTML/JSX uses React 18.3.1 + Babel standalone from CDN. No build step. Component composition: `design-canvas.jsx` (frame), `bits.jsx` (shared atoms — Dot, CritPill, Label, StatusPill, icons), one `artboardN.jsx` per panel.

---

## The verdict — `Ship split surfaces.`

Quoting the decision panel verbatim:

> "The data model staying unified is fine — it's an implementation detail. But the teacher's *create* surface should follow the shape of the work, not the shape of the table. A formative check and a summative project are different jobs done by the same person at different cognitive budgets, and the UI should respect that asymmetry."

> "Underneath, both still write to `assessment_tasks`. The discriminator earns its keep at query time, not at create time."

So:
- **Data model:** **UNIFIED** — single `assessment_tasks` table with `task_type` discriminator. Confirmed by Cowork, Gemini, and Wiggins/McTighe research alignment (formative vs summative are different *purposes for gathering evidence*, not different *structures*).
- **Teacher UI:** **SPLIT** — two separate create flows. The data unification is invisible to teachers; their cognitive load matches the work they're doing.

---

## What "split surfaces" looks like in practice

### Formative quick-check (4 fields, inline row, ~30 seconds)

Renders as an inline row in the unit's Tasks table. Click "+ Add quick check" → a row expands with four fields: title, criterion (single-select pill), due date, contributing section/lesson. ↵ to save, no modal. The whole interaction stays in the tasks table.

Use cases the prototype names: exit ticket, comprehension probe, draft milestone.

### Summative project (multi-step, 5 tabs, ~8–15 minutes)

Renders as a focused configuration page with 5 tabs in a fixed order:

1. **GRASPS** — Goal · Role · Audience · Situation · Performance · Standards (Wiggins/McTighe authentic-task framing). Tab 1 of 5 because backward design wants this *first*.
2. **Submission** — format (text / upload / multi), word count, AI-use policy (allowed / allowed_with_citation / not_allowed), academic integrity declaration.
3. **Rubric** — per-criterion descriptors at 4 achievement levels. **Self-assessment locked on**, next to the rubric, impossible to miss (Hattie d=1.33).
4. **Timeline** — due date, late policy, resubmission window, contributing lessons.
5. **Policy** — group/individual, peer-evaluator config (when peer-review type ships), notification settings.

Use cases the prototype names: design briefs, projects, MYP-criterion-summative-tasks, AP coursework.

---

## The three friction moments — why split wins

The decision panel argues from three named teacher moments where the unified surface breaks. Quoting verbatim:

### Friction 01 — *Tuesday, 11:42am · Ms. Okafor, between Y9 periods 3 and 4*

> "Wants to add an exit ticket on Newton's 2nd Law before Period 4 walks in. Opens the unified surface, sees the type toggle pre-set to summative because that was her last task. Switches it. Watches GRASPS, Rubric, Self-assessment collapse into 'not used for formative' rows. Wonders if she's missing something. Scrolls. Loses 90 seconds of a 5-minute window deciding whether to trust the collapsed state."

### Friction 02 — *Sunday, 8:15pm · Mr. Patel, planning a 6-week unit*

> "Designing the roller-coaster brief that anchors the whole unit. Backward design wants him to define summative first and design lessons backwards. The unified surface starts at title and lets him save with the rubric blank — because formative tasks save with it blank. He drafts the unit, returns Wednesday, finds three lessons already written and a rubric still empty. The shape of the form didn't push him."

### Friction 03 — *Wednesday, 9:03am · A first-year MYP teacher*

> "Knows GRASPS exists in theory, has never written one. On the unified surface, GRASPS is one accordion among many, framed as 'type-specific, optional below.' She skips it. On the split surface, GRASPS is tab 1 of 5 — the first thing the project flow asks her to do. **The UI taught her the practice.**"

The third one is the clinching argument: the split surface isn't just easier — it's *pedagogically active*. It teaches teachers UbD-aligned practice through forced sequencing.

---

## What we give up

Quoting again:

> "Two surfaces means two empty states, two help docs, two places to add a future field. Real cost. Mitigated by the fact that 80% of fields live on the project surface; the quick-check is a row, and rows don't need help docs."

> "And we lose the elegant story of 'one task, one form.' Engineering will mourn it. Teachers won't notice. Teachers don't read the schema."

---

## What this prototype is, and isn't

**Is:**
- The locked design decision on unified-data / split-UI for tasks creation
- A visual reference for the Task System Architecture brief that comes next
- The component-extraction blueprint when implementation begins (ChooserCard, FrictionMoment, segment toggle, status pills, etc.)
- A traceable artifact — the decision panel's three friction moments are the canonical rationale to cite when this design is questioned later

**Isn't:**
- Production code — recreate pixel-perfectly in React when build phase begins
- A grading-side design (G1's existing `docs/prototypes/grading-v2/` covers Calibrate / Synthesize / Studio Floor — that work stands; tile-grades just gain a `task_id` parent FK)
- A student submission UX (different design pass; deferred until after the schema lands)
- Final on the rubric editor's own internal design — Tab 3 is sketched as a "rubric editor" but the actual editor's interaction model is its own design problem

---

## Visual language used (matches grading-v2 prototype)

- Background: `#F5F1EA` (warm paper) and `#FBF8F2` (paper card) for surfaces; `#F0EBDF` (paper edge) for sub-panels
- Type: **Manrope** (sans, weights 400-800) for body + display; **Instrument Serif italic** for accents and "Friction Moment" copy; **JetBrains Mono** (tabular) for codes / unit IDs / versions
- Borders: **Dashed** = unconfirmed/draft/optional. **Solid** = confirmed/required/published. Same convention as grading-v2.
- Category dots: response = indigo, content = blue, toolkit = purple, **assessment = amber**, collaboration = emerald. Tasks belong to the assessment family — amber is the leading colour for the tasks UI.
- Criterion pills: A = teal, B = magenta, C = orange, D = blue (matching framework adapter constants)

---

## What the brief will lock in (next step)

When `docs/projects/task-system-architecture.md` gets written, it'll capture:

1. **Data model:** unified `assessment_tasks` table, schema corrections from Cowork's review (submissions split out, weight on the criterion-task edge, lessons → tasks via join table not array, JSONB config for type-specific fields, version-based resubmissions, cross-unit task support)
2. **Teacher UI:** SPLIT surfaces per this prototype's verdict
3. **Existing G1 work:** roll forward — keep the Calibrate / Synthesize UX + ScorePill components; re-mint `student_tile_grades` migration with `task_id` NOT NULL FK
4. **NM checkpoints:** STAYS PARALLEL. Not a `task_type` of `assessment_tasks`. Document why explicitly per Cowork's call.
5. **Backfill:** existing single-grade-per-unit rows → one `assessment_task` per unit with `task_type='summative'`, title `"Unit Final Grade"`
6. **Sequence:** brief locks the schema BEFORE Lever 0 (manual unit builder) starts implementation. After schema lock, Lever 0 + tasks-grading can build in parallel.

---

## Files

| File | Purpose |
|---|---|
| `Tasks Architecture Probe.html` | Entry point — composes the three artboards via `DesignCanvas` |
| `design-canvas.jsx` | Canvas frame (zoom, pan, artboard layout) |
| `bits.jsx` | Shared atoms — Dot, CritPill, Label, StatusPill, icon set, category-color map |
| `artboard1.jsx` | Unified-surface mock (formative + summative states) |
| `artboard2.jsx` | Split-surface mock (chooser + inline row + tabbed config) |
| `artboard3.jsx` | Decision panel + 3 named friction moments |
| `styles.css` | Token definitions + utility classes (warm-paper palette, dashed/solid border conventions, segment toggle, status pills) |
| `chats/chat1.md` | Original Claude Design conversation transcript |

---

## Reading order if you're new to this

1. This README (you're here)
2. The decision panel verbatim text in `artboard3.jsx` lines ~25-95 — the *argument*, not just the verdict
3. The chat transcript at `chats/chat1.md` — the *intent* behind the design
4. The visual prototype itself by opening `Tasks Architecture Probe.html` in a browser — only AFTER reading the above three, so the visual lands with context

When the brief gets written: cite this prototype's URL or commit hash, quote the friction moments verbatim, link to the chat transcript for traceability.
