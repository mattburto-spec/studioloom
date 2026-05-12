# Platform UX & IA — Follow-up Tickets

> Cross-cutting UX, information-architecture, and rollout-discipline items
> that don't belong to a single project tracker. Each entry: short title,
> when surfaced, symptom, suspected cause, suggested investigation, target
> phase or trigger.
>
> Created 11 May 2026 after the AISB student review of Toddle
> ([thebite.aisb.ro, Dec 2024](https://thebite.aisb.ro/switching-to-toddle-a-change-that-missed-the-mark/))
> surfaced four platform-level hygiene items at once. See also:
> [`docs/build-methodology.md`](../build-methodology.md),
> [`docs/design-guidelines.md`](../design-guidelines.md),
> [`docs/changelog.md`](../changelog.md).

---

## FU-NOTIFY-UNIFIED-PREFS — Single notification preference center
**Surfaced:** 11 May 2026, Toddle review analysis
**Target phase:** Trigger when ≥3 emitters live OR first parent complaint at a pilot school
**Severity:** 🟡 MEDIUM (compound risk; each new emitter raises noise floor)

**Origin:** AISB Toddle review's top parent complaint — "every
assignment, class note, reminder and message their kid receives on
Toddle gets forwarded to their inbox. One has to wonder: Is this
really necessary?" Over 75% of surveyed parents only slightly
satisfied or not satisfied.

Preflight already got this right defensively with per-{jobId,kind}
idempotency in `notifications_sent` and the `fabricationNotifyEmail`
opt-out on `student_preferences`. But each new system currently owns
its own emit logic + opt-out path:
- Preflight job updates (`src/lib/preflight/notifications.ts`)
- Dashboard bell (Phase 9 work-in-flight in dashboard-v2)
- Safety alerts (Dimensions3 Phase 6 admin feed)
- (planned) Open Studio check-ins, gallery comments, journey nudges

As emitter count grows, parents end up subscribed-by-default to N
independent firehoses with N independent opt-outs, exactly the Toddle
failure mode.

**Action when triggered:**
1. Audit current emitters — every code path that sends email or
   creates an in-app notification. Catalogue: channel, default state,
   opt-out path, parent CC behaviour.
2. Build `/student/preferences` and `/teacher/preferences` notification
   panel with per-feature × per-channel matrix (email / in-app / parent-CC).
3. Migrate existing opt-outs (`student_preferences.fabricationNotifyEmail`,
   etc.) into a unified `notification_preferences` table or single
   JSONB column.
4. Register emitters in a new `docs/notification-emitters.yaml` (sibling
   to `feature-flags.yaml`) with default channels + opt-out behaviour.
   Scanner enforces "every emitter is registered" at saveme.

**Don't build sooner because:** at 2 emitters (Preflight + bell) the
per-feature opt-outs are fine. Premature centralisation costs more in
schema migrations than the noise it prevents.

---

## FU-CLICK-COUNT-REGISTRY — Top-N actions registry with click-depth tracking
**Surfaced:** 11 May 2026, Toddle review analysis
**Target phase:** Trigger before school 3 onboards OR when adding any new top-level surface
**Severity:** 🟢 LOW now → 🟡 MEDIUM once school 3 onboards

**Origin:** AISB Toddle review, Ian Edwards (former AISB teacher now
at ISP): Toddle "has the appearance of ease in terms of features and
uses, and yet it takes double the clicks and the time to create
something that used to be done fairly easily in Google Classroom."
Students: "minutes are wasted until the said task is located, opened,
and actually worked on."

StudioLoom is now at the size where teachers juggle Class Gallery +
Teaching Mode + Open Studio + Preflight + Knowledge Base + Toolkit +
Unit Builder + Lesson Editor + Discovery Engine + dashboard-v2. Same
for students: dashboard + Open Studio plan + fab queue + gallery +
journeys + toolkit tools. Without IA discipline, surface area grows
faster than it can be navigated.

The api-registry / ai-call-sites / schema-registry pattern works for
backend drift. Same pattern for IA drift: register the top primary
actions per persona, track current click-depth, refuse to ship phase
work that pushes a registered action past its target.

**Action when triggered:**
1. `docs/student-actions-registry.yaml` — top ~20 actions a student
   does in a typical week. Schema per entry:
   ```yaml
   action: "Submit current assignment for feedback"
   path: ["/dashboard", "card.cta", "/lesson/[id]", "submit_button"]
   click_count: 3
   target_click_count: 3
   last_audited: 2026-05-11
   notes: "Bold dashboard exposes CTA directly; no list-traversal."
   ```
2. `docs/teacher-actions-registry.yaml` — same for teachers
   (~20 actions). Include the small-admin items that bit Toddle:
   "extend a deadline", "give written feedback on a submission",
   "post a grade", "see who hasn't submitted yet."
3. Scanner script `scripts/registry/scan-action-paths.py` — visits
   routes and counts clicks (heuristic; can be manual to start).
4. Phase brief template adds explicit question: "Does this phase add
   a click to any registered action? If yes, justify or rework."
5. saveme step rerunning the scanner.

**Don't build sooner because:** at 1 school the friction surfaces
in conversation; the registry's value is preventing drift across
school 3 / 4 / 5 when feedback channels widen.

---

## FU-PILOT-SIGNOFF-DISCIPLINE — Explicit pilot-school signoff rule in phase briefs
**Surfaced:** 11 May 2026, Toddle review analysis
**Target phase:** School 4 onboarding sequence (gate the trigger)
**Severity:** 🟡 MEDIUM (preventive; consequences only visible after a botched rollout)

**Origin:** AISB Toddle review's deepest complaint, repeated three
times in the piece: "this major change wasn't run past the students...
we have to suffer from this decision made by Secondary leadership."
"A major change such as this one will be run by ALL the students,
teachers, and parents." 85% of surveyed students slightly satisfied
or not satisfied at all.

StudioLoom's pilot-school model (NIS production + 3 internal pilots
queued + PYP coord meeting week of 27 Apr 2026) structurally inverts
the Toddle failure — schools test new modes before they go GA. But
the discipline is currently implicit: it lives in Matt's head, not in
the methodology doc. As schools 4 / 5 / N land, the temptation to
ship features without piloting will grow.

**Action when triggered:**
1. Amend [`docs/build-methodology.md`](../build-methodology.md) with
   an explicit "Pilot Signoff" section: no new student-facing mode
   (Open Studio v2, Discovery Engine GA, dashboard-v2 cutover, future
   modes) reaches a non-pilot school until ≥1 pilot has done a smoke
   round AND a teacher debrief.
2. Phase brief template checkbox row:
   `Pilot smoke complete: ☐ NIS ☐ [pilot 2] ☐ [pilot 3]`
   with target = ≥1 ticked before GA flip.
3. Document the "council" pattern — when a school onboards, name
   ≥1 student + ≥1 teacher who reviews UX changes pre-GA. Doesn't
   need to be a formal body; needs a named human.
4. Save the pre-flip smoke notes in `docs/handoff/` or a dedicated
   `docs/pilots/<school>/<mode>.md` so the audit trail outlives the
   session.

**Don't build sooner because:** at 1 pilot school the discipline is
trivially "ask Matt" — the value is preserved muscle memory when
school 3 / 4 / 5 widen the feedback surface.

---

## FU-TEACHING-MODE-PARITY — Every new teacher feature must answer "where does this live during class?"
**Surfaced:** 11 May 2026, Toddle review analysis
**Target phase:** Next phase brief drafted (~immediate; low cost to add to template now)
**Severity:** 🟡 MEDIUM (silent IA debt; surfaces as in-class friction reports)

**Origin:** AISB Toddle review: "minutes are wasted until the task is
located, opened, and actually worked on. This is because students are
clueless as to how each classroom is set up and what the purposes of
all the different features are." Multiple teacher complaints to the
same effect.

Teaching Mode (live cockpit + projector) is StudioLoom's explicit
structural answer — during a class period the teacher does not
navigate the broader app. They drive a class through pre-staged
content. Risk: new features ship without a Teaching Mode story,
fragmenting the in-class experience over time.

**Action when triggered (do now, low cost):**
1. Amend phase brief template (lives in
   [`docs/build-methodology.md`](../build-methodology.md)) with an
   explicit "Teaching Mode story" section: every teacher-facing
   feature must answer "where does this live during a 60-minute class
   period?" If the answer is "outside Teaching Mode", justify (with
   a short rationale — e.g. "this is a prep-time admin task, not
   in-class") or fix.
2. Retroactive audit of current teacher surfaces against the same
   question. Catalogue gaps:
   - Class Gallery — has projector view? When does teacher visit?
   - Open Studio plan approval — only outside class, fine.
   - Preflight admin (machines, fabricators, queue) — admin-time only,
     fine.
   - Knowledge Base management — admin-time only, fine.
   - Lesson Editor / Unit Builder — admin-time only, fine.
   - Grading / feedback — mixed; needs explicit story per surface.
3. Anything failing the audit gets a follow-up filed under its own
   project tracker.

**Don't defer because:** the template amendment is a 10-minute change
that prevents debt from accumulating in every future phase brief. The
retroactive audit can wait, but the template guard should land in the
next brief drafted.

---
