# Spec: Anonymous Mode (hidden class-creation flag, v1)

**Status:** SPEC — drafted 2026-05-09 (PM)
**Project:** [Privacy-First Positioning](privacy-first-positioning.md)
**Workstream:** 2 of 9 (the proof point — ships before the full Privacy Control Panel in WS3)
**Owner:** Matt
**Estimated effort:** ~1 week (writing + build + smoke). Spec writing ~½ day; implementation ~3-4 days; smoke + documentation ~1 day.

## Goal

Anonymous Mode is the demonstrable artefact that proves the brand pillar is real. When a class is created with the Anonymous flag on, **the server only ever stores handles for those students**. Real names live in the teacher's browser via `localStorage` (and an explicit encrypted export/import for cross-device). AI mentors and the audit log never see real names for those students.

Two reasons it ships ahead of the full Privacy Control Panel (WS3):

1. **Marketing screenshot lands ~3 weeks earlier.** WS1 (privacy posture page) needs a working demo to be credible; without WS2 the page is aspirational copy. With WS2 — even hidden behind a feature flag — the page can show a side-by-side "Open class vs Anonymous class" with real screenshots.
2. **The proof point is harder to walk back once it's real.** A team that has built handles-only-on-the-wire is unlikely to reverse-architect later for a "we just need DOB for this one feature" request.

The "hidden" framing is intentional. v1 has no public UI surface, no marketing copy, no help-centre page. Only people who toggle the feature flag (Matt, internal demos, first IB pilot) see it. WS3 wraps a presets-first control panel around it and is what schools eventually see.

## Audience

**Primary:** Matt (internal demos, first IB pilot teachers). The flag is hidden from regular teachers in v1.
**Secondary:** the procurement audience reading the privacy posture page once WS1 ships — they consume Anonymous Mode through screenshots and the live demo, not by toggling it themselves.

## Scope — what v1 does

A teacher with the feature flag on sees an extra checkbox at class creation: **"Anonymous Mode — student names stay in this browser only."** Tick it, and from that moment:

1. **Server-side state for that class is handles-only.** The student row's display name is the handle. No real-name column is populated for the student. The `students` (or equivalent) table never sees the real name for an Anonymous-class student.
2. **Teacher's browser stores the mapping.** A scoped `localStorage` blob — keyed by class id, encrypted at rest with a per-class key derived from a passphrase the teacher sets at class creation — maps `handle → real name`.
3. **Teacher UI optionally renders the real name.** The roster page, the gradebook, the "who submitted what" surface all default to handles. A toggle ("Show real names (this browser only)") swaps to real names by reading the local mapping. Toggle state is itself local; it never reaches the server.
4. **Students see handles for themselves and their peers.** Their own handle is what they log in with (same classcode + handle pattern). Their peers' work in gallery/peer review is labelled by handle.
5. **AI mentor never sees real names.** Existing redaction primitive ([`src/lib/security/student-name-placeholder.ts`](../../src/lib/security/student-name-placeholder.ts)) already swaps in `STUDENT_NAME_PLACEHOLDER` for the prompt. In Anonymous classes the placeholder swap is **a no-op restoration** — the response comes back referring to "Student", and that's what the teacher sees server-side. Real-name restoration happens client-side in the teacher's browser, only if and when the teacher has toggled "show real names."
6. **Audit log writes handles, not names.** `audit_events.target_label` (or equivalent) for an Anonymous-class student is the handle. No code path writes a real name to the audit log for these students.
7. **Cross-device export/import.** Teacher can export the local mapping as a password-protected JSON file (PBKDF2 + AES-GCM, all client-side). Import restores the mapping in another browser. v1 is manual file transfer only — no server-side blob, no auto-sync.

## Out of scope (v1) — deferred to v2 / v3

- **Server-side encrypted blob for cross-device sync.** v1 is manual file. v2 adds an opt-in encrypted blob on the server (key never leaves the teacher's browser), so signing in on a new device retrieves and decrypts.
- **Mode toggle on existing classes.** The flag is set at class creation and is immutable in v1. Switching modes mid-flight requires a data migration story (real names already on the server in Standard mode → handles only) that's better addressed in WS3 when the control panel ships.
- **Co-teacher mapping share.** Co-teachers each have their own browser mapping. Sharing across co-teachers is via the same encrypted file export/import, exchanged out-of-band. v2 considers a team-shared encrypted server blob.
- **Per-school default.** Schools want to say "all our classes default to Anonymous." That's WS3 work. v1 is per-class only.
- **Recovery flow for lost mappings.** If a teacher loses their browser data and has no export, the mapping is gone. v1 documents this risk and forces an "I have downloaded my export" acknowledgement at class creation. v2 + v3 may add server-side encrypted backup or a per-student opt-in to disclose their real name back to the teacher.
- **Visible UI surface.** Hidden behind feature flag in v1. WS3 brings the presets UI; this spec doesn't try to short-circuit that work.

## Architecture

### Handle generation

Server-side, at student-creation time. Memorable but unique within a class. Two-word format: `<adjective>-<noun>` (e.g. `quiet-otter`, `bold-fern`) drawn from a curated wordlist that excludes anything offensive or PII-shaped. Collision check within the class — retry on collision. Deterministic seeding from `(classId, creationOrder)` is preferred over random so handles are reproducible if a row is rebuilt.

Wordlist size: ~500 adjectives × ~500 nouns = 250k combinations. Plenty for any single class.

### localStorage shape

```
key:   studioloom.anonymous.<classId>
value: AES-GCM ciphertext of JSON { mappings: { <handle>: <realName>, ... }, version: 1 }
```

Per-class encryption key derived from a teacher-set passphrase via PBKDF2 (≥ 200k iterations, SHA-256). Passphrase is set at class creation alongside the Anonymous flag, never sent to the server. Stored in `sessionStorage` for the active session only — re-prompted on next session.

Trade-off: the passphrase ergonomic cost (re-enter once per session per Anonymous class) is real. v1 accepts this. v2 may explore WebCrypto-backed key wrapping with a single class-collection passphrase per teacher.

### Server-side schema

Pre-flight: confirm whether the `students` table already has a `display_name` column that can hold the handle, or whether a new `handle` column is needed. Either way, **no real-name column for Anonymous-class students**. Likely path: re-use `display_name` and add a class-level boolean `anonymous_mode` on `classes`.

Migration footprint: one column on `classes` (`anonymous_mode boolean default false`), no new tables. No backfill.

### AI prompt path

Existing flow:
1. Server builds prompt with `STUDENT_NAME_PLACEHOLDER` swap.
2. AI call goes out — Anthropic sees "Student", never the real name.
3. Response comes back referring to "Student".
4. Server restores the real name into the response before storing/returning.

In an Anonymous class, **step 4 is skipped on the server** — the server doesn't know the real name. The response is stored verbatim with "Student" in it. When the teacher views the response in their browser, a client-side restoration pass swaps "Student" → the handle (from server state) → the real name (from `localStorage`, only if toggle is on). Same primitive on both ends; the swap key just lives in different places.

This is the architectural subtlety worth getting right in v1: the redaction is the same; what changes is *where the name lives*.

### Login flow for students

Students log in via classcode + their handle (instead of classcode + real name). The login form is the same; only the placeholder text changes ("Enter your handle"). Pre-filled login URL (from the recently-shipped `/login/[classcode]` work) still works — the student arrives, sees `ABC123` pre-filled in step 1, advances, types their handle.

Open question: should the teacher be able to print a class roster of `(real name, handle)` pairs at class creation, so they can hand each student their handle on the first day? Likely yes — it's the natural onboarding story. Adds a one-time PDF/print export from the teacher's browser, locally rendered.

## Behaviour matrix — what works, what changes, what breaks

| Surface | Standard class | Anonymous class |
|---|---|---|
| Student login | classcode + name | classcode + handle |
| Roster (teacher) | names | handles, with "Show real names" local toggle |
| Gradebook | names | handles |
| AI mentor responses | "Hi Sarah, ..." | "Hi Student, ..." (client-restored to handle, optionally to real name) |
| Audit log | name in `target_label` | handle in `target_label` |
| Gallery / peer review | name | handle |
| Fabrication print labels | name | handle |
| Parent email for fab notifications | parent email field works | **disabled** — parent email is PII; teacher mediates |
| Bug reports filed by student | student id + name | student id + handle |
| Export (CSV grade dump) | names | handles, with optional teacher-side post-processing using local mapping |

The "Anonymous breaks parent email" row is the one to flag in the privacy posture page. It's the right behaviour, but it's a feature change schools should know about.

## UI surfaces

1. **Class creation form** (behind feature flag): new checkbox group containing Anonymous Mode toggle + a passphrase field that appears when toggle is on + a "I understand I must export the mapping if I want it on another device" acknowledgement that appears when toggle is on.
2. **Class list**: small `🎭 Anonymous` pill on the class card.
3. **Roster page**: handles by default; "Show real names (this browser only)" toggle in the page header. Toggle is unavailable if the local mapping is missing/locked.
4. **Settings → privacy** (per-class teacher view, hidden behind flag): export mapping (download encrypted JSON), import mapping (upload encrypted JSON + passphrase), forget local mapping (clears `localStorage`).

That's it for v1. No marketing-site surface, no help-centre article, no admin dashboard tile. Hidden flag means hidden.

## Edge cases to think through (resolve in pre-flight)

- **Mid-class browser change.** Teacher imports the export on the new browser. Documented in the export/import flow.
- **Browser-data wipe with no export.** Mapping is gone. Recovery: students disclose their handles back to the teacher (handles persist on the server). Teacher rebuilds the mapping by hand. Not pretty; v1 accepts this as a "you were warned at creation time" risk.
- **Co-teacher added after creation.** Co-teacher needs the export from the lead teacher, exchanged out-of-band. v2 problem to solve elegantly.
- **Class transfer (Access Model v2 ownership change).** Same problem as co-teacher — the new owner gets the encrypted file from the previous owner. Out of v1 scope.
- **Student logs in from a shared device.** No change — auth flow already protects against this via session cookies. The mapping is teacher-side; students don't carry it.
- **Student forgets their handle.** Teacher looks it up in the roster (with toggle on) and tells them. If the teacher has no mapping either, the student tells the teacher their identifying detail and they figure it out together. v1 accepts this.
- **Substitute teacher.** Gets a temporary export from the lead teacher, or works with handles only. Documented.
- **Audit log forensics across an incident.** If a safeguarding event requires identifying a specific student from their handle, the lead teacher does the lookup in their browser and shares the real identity through normal safeguarding channels. The audit log itself never gains a name.

## Risks / non-goals

- **Not absolute anonymity.** IPs, behavioural data, and the content of student writing still reach the server and (for AI calls) Anthropic. Anonymous Mode is "minimum PI by design," not "zero PI." Section 6 of the privacy posture page already addresses this honestly.
- **Not a substitute for content moderation.** A student who types their full name into a free-text field is still disclosing it. Content moderation + the AI redaction primitive handle that separately.
- **Not a magic safeguarding bypass.** Mandatory reporting still applies. The lead teacher always retains the ability to identify a student via their browser-side mapping; the audit + safeguarding chain still works, it just takes one extra step.
- **Not designed to scale to 1000-student classes.** Handle uniqueness within a class works fine to ~200 students. Beyond that the wordlist gets thin and collisions grow. v2 introduces three-word handles or class-prefix scoping if the use case appears.

## Open questions (resolve before build kicks off)

- **Q1.** Re-use existing `students.display_name` for the handle, or add a dedicated `handle` column? Pre-flight via schema-registry.yaml.
- **Q2.** Is the per-class passphrase a hard requirement, or can v1 ship with the mapping stored unencrypted in `localStorage` and accept the trade-off? (Argument for unencrypted: ergonomics. Argument against: a logged-in school computer left at lunch leaks the whole class to anyone who opens DevTools.) Lean: encrypted, accept the re-entry friction in v1, revisit in v2.
- **Q3.** Print-friendly handle roster at creation: yes/no for v1?
- **Q4.** Where does the class-creation feature flag live — `feature-flags.yaml` (preferred, gives the registry track) or hardcoded constant on the new field? Lean: registry.
- **Q5.** What does the teacher-side "I understand I must export" acknowledgement look like in practice — modal, inline checkbox, second-step confirm? Smallest path: inline checkbox that has to be ticked before submit enables.
- **Q6.** Login UX: do we add inline help text under the handle field on the student login form, only when a Anonymous classcode is detected? Lean: yes — "Your teacher gave you a two-word handle on your first day."

## Pre-flight (before any code)

1. Read [`src/lib/security/student-name-placeholder.ts`](../../src/lib/security/student-name-placeholder.ts) end to end. Confirm the swap-and-restore primitive's call sites and assumptions.
2. Read the relevant rows of [`docs/schema-registry.yaml`](../schema-registry.yaml) for `students` and `classes` — confirm column names, RLS policies, writers, readers.
3. Read [`docs/api-registry.yaml`](../api-registry.yaml) for any route that returns a student name in its payload — that's the audit list that needs to switch to handles in Anonymous mode.
4. Check [`docs/feature-flags.yaml`](../feature-flags.yaml) for an existing pattern that matches the "hidden flag, internal-only" use case. If none, add one.
5. Pre-write the smoke checklist: create Anonymous class → log in as student → submit response → teacher views with toggle off + on → export mapping → import on second browser → confirm real-name restoration works → confirm AI response is `STUDENT_NAME_PLACEHOLDER` end-to-end.

## Done = success criteria

- A teacher with the feature flag on can create an Anonymous class. From that point forward, the server has no real-name column populated for those students.
- The teacher can toggle "Show real names" in their browser and see the roster in either form.
- AI mentor responses for those students never reach Anthropic with the real name in the prompt.
- The audit log for those students records handles, not names.
- The teacher can export the mapping as an encrypted file, open it in a different browser with the passphrase, and continue working.
- The privacy posture page (WS1) has a working live demo class to screenshot.
- Smoke run end-to-end on Vercel preview before flag is flipped on for the first IB pilot.

## Follow-ups out of scope here

- **`FU-ANON-MODE-SERVER-BLOB`** (P2) — v2 server-side encrypted mapping blob for cross-device auto-sync.
- **`FU-ANON-MODE-MID-FLIGHT-TOGGLE`** (P2) — let teachers switch a class from Standard to Anonymous (or back) mid-term, with the data migration story figured out.
- **`FU-ANON-MODE-COTEACHER-SHARE`** (P2) — team-shared encrypted blob so co-teachers don't have to swap files manually.
- **`FU-ANON-MODE-SCHOOL-DEFAULT`** (P3) — school-level default that cascades to new classes. Subsumed by WS3 control panel.
- **`FU-ANON-MODE-RECOVERY`** (P2) — formal recovery flow when a teacher loses both browser data and export. Currently "you were warned." Could be a per-student opt-in to disclose their real name back to a new teacher device.
- **`FU-ANON-MODE-WORDLIST-EXPANSION`** (P3) — three-word handles for very large classes. Triggered when the first 200+ student class appears.

## Registry sync (per CLAUDE.md build methodology)

This workstream touches code + one schema column + one feature flag. Registry impact:

- **`schema-registry.yaml`** — `classes` table gets a new `anonymous_mode boolean default false` column.
- **`feature-flags.yaml`** — new flag `anonymous_mode_v1` (internal-only, hidden default).
- **`api-registry.yaml`** — re-scan; routes that read student names need a behavioural branch when the class is Anonymous.
- **`ai-call-sites.yaml`** — no new call sites; the existing `STUDENT_NAME_PLACEHOLDER` redaction is unchanged. Add a metadata note on the relevant call sites that they're now serving Anonymous-mode classes.
- **`vendors.yaml`** — no change. Anonymous Mode reduces what reaches Anthropic but doesn't add a vendor.
- **`data-classification-taxonomy.md`** — review the `students` and `classes` rows to confirm the data-classification claim still holds when Anonymous Mode is on.
- **`WIRING.yaml`** — when this ships, add a system entry for `anonymous-mode` (or absorb into a future `privacy-control-panel` system that comes with WS3). Not required at SPEC stage.
