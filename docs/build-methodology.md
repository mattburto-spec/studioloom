# Build Methodology — How We Work

A reference for the disciplined phased-build approach we settled into during Dimensions3. Not a rigid process — the point is to avoid rediscovering these principles after they bite us.

## Core principle

Build methodically with scaffolding baked in, not bolted on. Rushing into a spec → code cycle creates gaps and silent bugs that surface later at much higher cost; gating the build with sandboxes, simulators, pre-flights, and signed-off checkpoints catches problems while they're still cheap. This is slower upfront and much faster overall. Matt is happy to be methodical; Claude should not mistake "move fast" for "skip the ritual".

## The phased-with-checkpoints model

Every non-trivial build is broken into phases, each ending in a **Matt Checkpoint** where Code pauses, reports in full, and waits for explicit sign-off. No phase ships without approval. Within a phase, smaller gates exist for individual steps — the audit before the disconnect, the truth-capture before the test, the smoke before the push. Dimensions3 v2 has 12 mandatory Matt Checkpoints; Phase 1 alone has 1.1, 1.2, 1.5, 1.6, 1.7.

## Spec with sandbox + simulation as first-class components

The Dimensions3 spec wasn't "build the pipeline" — it was "build the pipeline AND a sandbox debugger AND a simulator AND dryRun mode AND per-run cost tracking." The observation scaffolding ships with the feature, not after. At every checkpoint we can inspect what each stage is actually doing against real inputs, not guess from logs. When writing any new spec: ask "how will we observe this thing while it's running? what does the debug surface look like?" before asking "how do we build it?"

## The pre-flight ritual

Every phase starts with, in this order:

- `git status` clean, correct branch, expected HEAD
- `npm test` baseline captured (Lesson #34) — the new test count becomes the new baseline
- Relevant prior Lessons re-read (list them in the phase brief so Code sees them)
- Audit what exists before touching it — grep, list, map, count
- **If the phase adds a migration**: mint with `bash scripts/migrations/new-migration.sh <descriptor>` (timestamp-prefixed, claim-discipline workflow). Don't author 3-digit numbered migrations any more — we collided twice in 24 hours during Preflight Phase 8 / Lesson Bold overlap. Legacy helper `next-free-number.sh` still exists for emergency use only. Read `/Users/matt/CWORK/.active-sessions.txt` first to see which other worktrees are mid-flight.
- **If the phase adds a migration, before merging**: run `bash scripts/migrations/verify-no-collision.sh`. Exits non-zero on any same-prefix-different-filename collision against `origin/main`. This is a Matt Checkpoint gate — do not sign off without a clean run.
- **STOP and report the audit before any changes**

The pre-flight has caught more problems than any test suite. Skipping it is the most common failure mode.

## Stop triggers defined upfront

Every phase brief lists specific conditions that should make Code stop and report instead of pushing through. Examples we've used: "if the audit finds > 10 sites", "if a second unrelated bug surfaces after the first fix", "if Haiku 4.5 rejects 16000 max_tokens", "if sandbox output contradicts live output in a way that suggests the sandbox is mocking wrong." Stop triggers convert the LLM's helpfulness reflex (keep going, figure it out, ship) into an explicit wait-for-decision.

Complementary: an explicit **"don't stop for"** list. Small value drift, expected token cost, obvious noise — those aren't reasons to pause. Without it, Code stops too often on noise.

## Verify = assert expected values, not just non-null (Lesson #38)

Every verify step compares to specific captured values, not just "did something happen". Migration 067's verify block passed cleanly while every seed row was silently mis-classified — the check was `WHERE moderation_status IS NULL` when the bug was "rows have the wrong non-null value." Same rule for tests: capture truth from one real run, lock it in as an assertion, never write `expect(x).toBeDefined()` when you could write `expect(x).toBe(exact_value)`.

## Don't paper over surprises

Literal instruction in every phase brief. When Code finds something unexpected, it reports and waits. Pass A crashing on the first real document in Checkpoint 1.2 was the methodology working exactly as designed — the checkpoint was supposed to surface latent bugs like that, and it did.

## Audit-then-fix for pattern bugs

When a bug is pattern-shaped (missing `stop_reason` guard, same anti-pattern repeating), grep for every site with the same pattern BEFORE claiming the fix is complete. File audit results as follow-ups if they can't all be fixed in the current phase. **Rule (added to Lesson #39 after Pass A + Pass B in Phase 1.7): when fixing a pattern bug at one site, fix all similar sites in the same phase — don't wait for the bug to bite at the next site, because it will, and it did.**

## Capture truth from one real run

Don't guess expected values for tests. Run the thing once against a real fixture, capture what it produces, inspect the values for sanity, then lock them into the test. For tests with both sandbox and live variants, capture both sets separately. Comment with the capture date. Future regressions are detected by comparing against these frozen values.

## Separate commits, no squashing

Bug fix commits stay separate from feature commits. A phase can land as 2–4 commits, that's fine. The fix is independently valuable and might need to be cherry-picked, reverted, or referenced later without dragging the whole phase along.

## Push discipline

Don't push to `origin/main` until:

- Checkpoint is signed off in chat
- Any migrations are applied to prod Supabase
- Smoke-test run locally (or an honest flag that interactive smoke wasn't feasible)
- `bash scripts/migrations/verify-no-collision.sh` exits clean (if the phase added migrations)

Backup pattern: `git push origin main:phase-X-wip` pushes working state to a wip branch without triggering Vercel prod deploys. Keeps long phases safe without risking prod. `phase-X-wip` gets refreshed after every meaningful commit.

**Don't run merges in the main worktree** (`/Users/matt/CWORK/questerra`) if you're mid-session and might get interrupted. An in-progress merge with conflicts can strand WIP for days (we hit this 26 Apr). Either fast-forward via PR on origin, or use a throwaway worktree (`git worktree add ../questerra-merge main`) you delete after.

## Follow-ups tracked, never dropped

Out-of-scope bugs surfaced mid-phase become FU-N entries in a dedicated followups doc (`docs/projects/dimensions3-followups.md`) with priority, context, suggested investigation, and definition of done. They're cross-referenced from ALL-PROJECTS.md, the dashboard, and CLAUDE.md. A real bug surfaced in Phase 1.5 that doesn't fit Phase 1.5 doesn't disappear — it becomes FU-1 and gets scheduled deliberately.

## Lessons learned as running artifact

Every production bug, build disaster, or hard-won insight becomes a numbered Lesson entry in `docs/lessons-learned.md` with **rule + why + how-to-apply**. Lessons are re-read at the start of relevant phases (listed in the phase brief). Currently at #39. The Lessons log is load-bearing context, not a historical curiosity.

## Impact analysis via WIRING.yaml

Before modifying a system, check its `affects` list in WIRING.yaml. Before adding a system, create its entry. The impact analysis step is fast and prevents cross-system breakage. `saveme` syncs WIRING.yaml and the wiring-dashboard SYSTEMS array together.

## saveme as state-sync ritual

At the end of meaningful sessions, run `saveme`. The 10-step sync keeps ALL-PROJECTS.md, dashboard.html, changelog.md, WIRING.yaml, wiring-dashboard.html, doc-manifest.yaml, CLAUDE.md, and the Lessons log all aligned. Skipping `saveme` causes cross-session drift and makes the next session harder. If in doubt, `saveme`.

## Zero-user advantage — use it deliberately

With no users in prod, aggressive cleanup is cheap. Delete dead code (BatchUpload), rename routes (`/teacher/knowledge/*` → `/teacher/library/*`), relocate files, skip redirects and "this page has moved" breadcrumbs. The methodology adapts to opportunity. When users exist, the same principles apply but with caution on anything user-facing.

## When to apply the full discipline

**Yes:**
- Any complex build with multiple dependent stages (pipelines, migrations, system rebuilds)
- Any work touching auth, RLS, content resolution, or data integrity
- Any phase where the cost of a silent bug is high
- Anything generating content for real users

**Overkill:**
- Quick fixes obvious in diff
- Single-file edits to non-critical files
- Exploratory prototyping in scratch space

Judgement heuristic: if Claude is about to write code for more than ~10 minutes without checkpointing, it's probably under-disciplined. Stop, report, confirm.

## The meta-rule

The whole approach rests on one thing: **Claude should prefer the discipline even when Matt doesn't explicitly ask for it.** Matt's time is the scarce resource; a checkpoint Claude gates itself is cheaper than a bug that escapes to prod. When in doubt, add the stop trigger, capture the truth, write the audit, pre-flight the phase. Methodical over fast.
