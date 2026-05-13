# Phase Brief — Class DJ Card (SUPERSEDED)

> **⚠️ SUPERSEDED 13 May 2026** — Matt pivoted from a dashboard card to an Activity Block. See [`class-dj-block-brief.md`](./class-dj-block-brief.md) for the active brief. This file is retained for context (the AI prompt, safety blocklist plan, vote mechanic, and risks transfer cleanly).

**Project codename:** Class DJ
**Filed:** 13 May 2026
**Brief owner:** Matt
**Status:** SUPERSEDED — see class-dj-block-brief.md
**Tracker prefix:** `FU-DJ-*`
**Worktree:** `/Users/matt/CWORK/questerra` (main)
**Branch:** `class-dj-card` (cut from `main` at pre-flight)

---

## 1. Problem statement

Students always want music in class but never agree. The teacher ends up picking, or worse, the room spends 5 minutes negotiating. We can solve this with a tiny dashboard card: students drop a few quick taps about mood/energy/vetoes, an AI synthesizes a class consensus, and the room gets 3 named suggestions everyone can live with. Teacher controls whether the card is even visible (per class), and can reset the round.

This is a **classroom-culture quality-of-life feature**, not a learning feature. Keep scope tight, ship the joy, do not over-engineer.

## 2. Goals (and non-goals)

**Goals**
1. Per-class teacher toggle: Class DJ on/off (default OFF — opt-in).
2. Student-facing card on the v2 dashboard that appears only when (a) the student is enrolled in a class with Class DJ enabled AND (b) at least one such class exists.
3. ~10-second vote: mood chip (5 options), energy slider (1–5), optional veto text ("no country pls"), submit.
4. Vote count visible to all participants in the same session ("5 of 12 voted").
5. Anyone can request a synthesis once ≥ 3 votes are in. AI returns 3 suggestions — each `{ name, kind: 'artist' | 'band' | 'genre' | 'playlist-concept', why }`.
6. Suggestions are **school-appropriate by construction** — prompt-level constraint, not a content blocklist (v1).
7. Each session auto-expires after 4 hours; teacher can also hit "Reset round" from class settings.

**Non-goals (v1 — defer to FU-DJ-* tracker)**
- Real Spotify/YouTube integration (we ship "search this on Spotify" deep-link only).
- Realtime websocket updates — polling at 2s is fine for a 2-min window with a small class.
- Cross-class music trends / analytics.
- Custom teacher-editable artist blocklist UI (constants live in code for v1; FU-DJ-BLOCKLIST tracks the UI).
- Group consensus across multiple classes.
- "Why everyone voted this way" explanations — keep it light.

## 3. UX flow

**Teacher side** (one-time per class):
1. `/teacher/classes/[classId]/settings` (or wherever class-level toggles live — pre-flight confirms) gains a row: **"Class DJ" — let students suggest music together** with a switch. Default off. Toggle persists immediately via `PATCH /api/teacher/classes/[classId]/class-dj`.
2. Same panel has a **"Reset round"** ghost button that closes the open session for the class. Useful if vetoes get spammy or the suggestion bombed.

**Student side** (the card):
1. `Class DJ` card appears on `/dashboard` between the hero unit card and the activity queue. Compact (~one row height when collapsed), expands on tap.
2. State 1 — **Empty / no session open:** "Want music? Drop a vibe →" button. Tapping opens a session and shows the vote form.
3. State 2 — **Vote open, you haven't voted:** mood chips (Focus / Build / Vibe / Crit / Fun) → energy 1–5 → optional one-line veto → "Submit vibe". ~10 seconds.
4. State 3 — **You've voted, ≥ 1 voter, < 3 voters:** "Waiting on the rest of the room… 2 of 12 voted." No suggest button yet.
5. State 4 — **You've voted, ≥ 3 voters, no suggestion yet:** "Suggest 3 →" button is live for anyone to tap.
6. State 5 — **Suggestion shown:** 3 cards, each `{ name, kind chip, one-line why }`, with a "Search on Spotify" deep-link (just `https://open.spotify.com/search/{encoded}`). Plus a "Try another 3" button that re-runs AI with the same votes (counts as a new generation; capped at 3 per session to keep cost trivial).
7. Card collapses back to a "Pick again later" pill 30 minutes after a suggestion lands, OR if the teacher resets the round.

**Failure modes (must handle):**
- Card hidden entirely if no enrolled class has DJ enabled.
- Veto text fails `moderateAndLog` → vote still recorded with `veto = NULL` + `veto_flagged = true` (we don't block the student; we just drop the field). Teacher sees a tiny "1 veto withheld" badge.
- AI call fails (truncated, over_cap, no_credentials, api_error per `call.ts` discriminated union) → card shows "Couldn't read the room. Try again in a sec." with a retry. Don't expose the failure reason to students.
- AI returns suggestions that fail the post-AI safety check (see §6) → drop the offending row, ask for a fresh 3 once (one silent retry). If still bad, fail closed with the above message.

## 4. Schema

**One migration** minted via `bash scripts/migrations/new-migration.sh class_dj_card`. Timestamp prefix per policy. Claim immediately with empty stub commit BEFORE writing SQL. Apply-log row in `public.applied_migrations` written same session as prod-apply (Lesson #83).

```sql
-- {timestamp}_class_dj_card.sql

-- Per-class toggle (default OFF — opt-in)
ALTER TABLE public.classes
  ADD COLUMN class_dj_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- One open session per class at a time. Session closes automatically after 4h
-- or manually via teacher reset.
CREATE TABLE public.class_dj_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id      UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  opened_by     TEXT NOT NULL,                 -- 'student:<student_id>' or 'teacher:<teacher_id>'
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at     TIMESTAMPTZ NULL,              -- NULL = still open
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '4 hours'),
  suggest_count SMALLINT NOT NULL DEFAULT 0,   -- caps at 3 per session
  CONSTRAINT class_dj_sessions_suggest_cap CHECK (suggest_count BETWEEN 0 AND 3)
);

-- Partial unique: only one OPEN session per class at a time.
CREATE UNIQUE INDEX class_dj_sessions_one_open_per_class
  ON public.class_dj_sessions (class_id)
  WHERE closed_at IS NULL;

-- One vote per student per session; updates allowed.
CREATE TABLE public.class_dj_votes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.class_dj_sessions(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  mood          TEXT NOT NULL
                CHECK (mood IN ('focus','build','vibe','crit','fun')),
  energy        SMALLINT NOT NULL CHECK (energy BETWEEN 1 AND 5),
  veto          TEXT NULL,                     -- moderated; NULL if flagged or absent
  veto_flagged  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

-- AI suggestions written per generation. Many per session (capped at 3).
CREATE TABLE public.class_dj_suggestions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES public.class_dj_sessions(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  requested_by TEXT NOT NULL,                  -- 'student:<id>' or 'teacher:<id>'
  vote_count   SMALLINT NOT NULL,              -- snapshot at generation time
  items        JSONB NOT NULL,                 -- [{name, kind, why}] (length 3 enforced at write)
  prompt_hash  TEXT NULL                       -- for de-dup of "Try another 3"
);

CREATE INDEX class_dj_votes_session_idx ON public.class_dj_votes (session_id);
CREATE INDEX class_dj_suggestions_session_idx ON public.class_dj_suggestions (session_id);
```

**RLS** (all three new tables — RLS enabled, default-deny):
- `class_dj_sessions`: SELECT for students enrolled in the class (via `class_enrollments`) + the class teacher. INSERT for the same set (when `class_dj_enabled = true`). UPDATE (close) for the class teacher only. No DELETE (cascade only).
- `class_dj_votes`: SELECT for students enrolled in the class + the class teacher. INSERT/UPDATE only for `student_id = current_student()` AND the parent session is open. No DELETE.
- `class_dj_suggestions`: SELECT for students enrolled + class teacher. INSERT via service role only (the suggest API). No UPDATE/DELETE.

All three tables register in `schema-registry.yaml` with their writers/readers. Migration applied to prod inside Phase 2 → `applied_migrations` row written same session.

## 5. API routes

All under `src/app/api/`. Route guards per "hard rule on /api/teacher/* routes" — `requireTeacher()` for teacher routes; student routes use the existing student-session middleware that already gates the dashboard.

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/api/student/class-dj/state?classId=...` | Card hydration: enabled?, open session, my vote, total votes, latest suggestion | student |
| POST | `/api/student/class-dj/vote` | Body: `{ classId, mood, energy, veto? }`. Opens session if none, runs `moderateAndLog` on `veto`, upserts vote. | student |
| POST | `/api/student/class-dj/suggest` | Body: `{ sessionId }`. Aggregates votes, calls AI, writes row, returns `{ items }`. Rejects if `suggest_count >= 3` or votes < 3. | student |
| PATCH | `/api/teacher/classes/[classId]/class-dj` | Body: `{ enabled: boolean }`. Toggles `classes.class_dj_enabled`. | `requireTeacher()` |
| POST | `/api/teacher/classes/[classId]/class-dj/reset` | Closes the open session for the class. | `requireTeacher()` |

**Polling:** dashboard card polls `GET /api/student/class-dj/state` every 2s while card is expanded and a session is open. Stops polling when collapsed or when suggestion is shown (suggestion is terminal until reset / "Try another 3").

## 6. AI prompt (the actual content)

**Call site:** `src/lib/class-dj/suggest.ts` → `callAnthropicMessages` with:

```ts
{
  endpoint: "student/class-dj-suggest",
  model: "claude-haiku-4-5-20251001",
  maxTokens: 600,
  metadata: { classId, sessionId, voteCount, suggestIndex },
  studentId: null,        // class-attributed, no per-student budget
  teacherId: null,        // no BYOK
  systemPrompt: <below>,
  userPrompt: <vote summary, see below>,
}
```

**System prompt (frozen v1):**

> You are a music recommender for a high-school design & technology classroom (ages 11–18). The teacher has turned on a "Class DJ" feature where students vote on the vibe they want. Your job is to suggest 3 options that the whole room could live with — not the perfect album for one kid.
>
> Hard rules (non-negotiable):
> 1. School-appropriate only. Mainstream / radio-edit. No artists or genres whose primary catalogue is built on explicit content, violence, drug glorification, or themes inappropriate for under-18s. If you're unsure, pick the safer option.
> 2. Honor vetoes literally. If anyone vetoed a genre, do not suggest it or any close cousin.
> 3. Variety across the 3 suggestions — don't return three similar artists.
> 4. Each item must be a real, well-known artist, band, or named genre/playlist concept that a teenager could find on Spotify or YouTube in one search.
> 5. The "why" line is short (≤ 18 words), names the consensus you read in the votes, and is written for students — not for a teacher.
>
> Return JSON only, this exact shape:
> ```json
> {"items":[{"name":"...","kind":"artist|band|genre|playlist-concept","why":"..."},{...},{...}]}
> ```

**User prompt (built at runtime):**

```
Class has {N} students. {M} voted.

Mood tally:
- focus: {n_focus}
- build: {n_build}
- vibe: {n_vibe}
- crit: {n_crit}
- fun: {n_fun}

Average energy (1–5): {avg_energy}
Energy spread: {min}–{max}

Vetoes ({V}):
- "{veto_1}"
- "{veto_2}"
...

(If this is generation #2 or #3 in the same session, the prior suggestions were:
- "{prior_1}", "{prior_2}", "{prior_3}" — pick 3 different ones.)
```

**Post-AI safety check** (in `suggest.ts`, before returning to client):
1. JSON.parse + zod-validate the shape. If invalid → one silent retry, then fail.
2. For each item, lowercase-match `name` against a small **hardcoded code-level blocklist** (`src/lib/class-dj/blocklist.ts` — ~20 artist names + ~6 genre keywords like "drill", "horrorcore", etc.). Items that hit the blocklist are dropped. If we end up with < 3, one silent retry, then fail closed.
3. Stop-reason check per Lesson #39 — if `stop_reason !== 'end_turn'`, treat as `truncated` and surface 502.

**Lesson #54 note:** This change touches schema, api, ai-call-sites, feature-flags (optional kill-switch). The brief explicitly consults all 6 registries in §10 below.

## 7. UI components

```
src/components/class-dj/
├── ClassDjCard.tsx           ← composite, lives on DashboardClient
├── ClassDjVoteForm.tsx       ← mood chips + energy slider + veto textarea
├── ClassDjWaiting.tsx        ← "5 of 12 voted" + Suggest button
├── ClassDjSuggestion.tsx     ← 3 result cards + retry + Spotify deep-links
└── useClassDjPoll.ts         ← 2s polling hook, pauses on hidden tab
```

Card mounted in `DashboardClient.tsx` between the hero unit section and the activity queue (recon confirmed: hardcoded JSX, no card registry — sibling insert is correct).

Teacher toggle row added to whichever class-settings page is canonical (pre-flight to confirm path; likely `/teacher/classes/[classId]` somewhere).

## 8. Sub-phases (with named checkpoints)

| Phase | Scope | Stop trigger | Output |
|---|---|---|---|
| **Phase 1 — Pre-flight** | Clean git status confirmed; `npm test` baseline captured; re-read Lessons #38, #39, #54, #83; registry cross-check (all 6); audit existing class-settings page; confirm dashboard card insertion point | Any registry shows surprising drift; baseline tests fail | Report; brief amendments if needed |
| **Phase 2 — Schema** | Mint timestamp migration; empty stub committed FIRST; SQL written; RLS policies; apply to local; apply to prod; `applied_migrations` row written | RLS scanner reports `no_rls`; collision check fails; FK cascade behaviour unexpected | Migration applied + logged; `schema-registry.yaml` synced |
| **Phase 3 — Teacher toggle** | `PATCH /api/teacher/classes/[classId]/class-dj` route with `requireTeacher()`; toggle row in class-settings page; "Reset round" button → `POST .../reset` | `scan-role-guards.py` flags route as unguarded | Teacher can toggle on/off + reset |
| **Phase 4 — Vote API + moderation** | `GET /api/student/class-dj/state`; `POST /api/student/class-dj/vote` with `moderateAndLog` on veto; session-open logic + partial-unique race handling | Race condition on session-open under concurrent first-voters; moderation helper signature drifted from recon | Student can vote; flagged vetoes withheld + logged |
| **Phase 5 — AI suggest API + prompt safety** | `POST /api/student/class-dj/suggest`; `src/lib/class-dj/suggest.ts` calling `callAnthropicMessages`; zod schema; hardcoded blocklist; stop-reason guard; suggest_count cap | AI returns non-JSON consistently; stop_reason handling regresses Lesson #39 | Suggestions land, school-appropriate, blocklist enforced |
| **Phase 6 — Student card UI** | Components above; mount on `DashboardClient.tsx`; 2s polling hook; hide entirely when no DJ-enabled enrollment | Card renders for students without DJ-enabled classes; polling doesn't pause on collapse | Card visible end-to-end on dev |
| **Phase 7 — Tests + registry sync + handoff** | Vitest: RLS-shape (mocked), route handlers, suggest-prompt safety NC, blocklist NC; rerun all 5 registry scanners; update `WIRING.yaml` + `wiring-dashboard.html` + `system-architecture-map.html`; append `changelog.md` | NC tests false-green (per `feedback_negative_control_grep_tests.md`); registry diff surprises | Tests + registries clean; PR ready |
| **🛑 Matt Checkpoint M-DJ-1** | Live smoke: 1 teacher toggles on, 3+ students vote across 2 devices, AI suggests, room verdict | Suggestions feel off; vetoes ignored; card layout breaks on small screens | Sign-off → merge to main; Matt pushes |

**Estimated effort:** 1.5–2 days end-to-end. Could compress to 1 day if Phase 6 UI is simple, but the brief assumes "polished enough to actually use in a real class."

## 9. Don't-stop-for list

These look like blockers but aren't. Note and keep moving:
- Spotify deep-link doesn't show album art (out of scope; just opens the search).
- Card looks plain on first paint (we're not skinning it past Bold dashboard defaults).
- "What if a student is in 2 DJ-enabled classes?" → card asks which class up top via a pill selector. Keep simple.
- "Should the teacher see who voted what?" → no, v1 keeps individual votes private to the room. Teacher sees the suggestion + aggregate. FU-DJ-TEACHER-DRILLDOWN.
- "What if AI suggests the same artist three rounds in a row?" → `prompt_hash` + "pick 3 different ones" in the user prompt. Good enough.
- "Realtime feel" → polling at 2s is plenty for a 30-second decision.
- No analytics in v1.

## 10. Registry cross-check (Lesson #54 mandate)

Done at brief-time. Will re-verify in Phase 1 pre-flight.

| Registry | Touched? | Spot-check |
|---|---|---|
| `WIRING.yaml` | YES — new system `class-dj` with deps `auth-system`, `ai-call-sites`, `dashboard-v2`, `class-management`, `content-safety` | `auth-system.key_files` referenced exists (confirmed in recon: `src/lib/auth/require-teacher.ts`, `src/lib/auth/verify-teacher-unit.ts`) |
| `docs/schema-registry.yaml` | YES — 3 new tables + 1 new column on `classes` | `classes` table currently registered? **CONFIRM in pre-flight.** |
| `docs/api-registry.yaml` | YES — 5 new routes (auto-scanned in saveme) | Scanner has been re-run recently per CLAUDE.md saveme step 11b. Trust. |
| `docs/ai-call-sites.yaml` | YES — 1 new call site `student/class-dj-suggest` | Scanner auto-syncs. |
| `docs/feature-flags.yaml` | Optional — propose **no global kill-switch** in v1; the per-class toggle IS the kill switch. If we want a master kill, add `classDjGloballyEnabled` in `admin_settings`. **Defer decision to Phase 1.** |
| `docs/vendors.yaml` | NO — Anthropic already registered; Spotify deep-links are URLs, not API integration; no new sub-processor. |
| `docs/data-classification-taxonomy.md` | YES — `class_dj_votes.veto` is student free-text input → CAT-3 (student-authored, low-sensitivity, transient). Add row in classification spreadsheet entry in Phase 2. |

## 11. Open questions for Matt

1. **Card placement:** between hero unit and queue (my default), OR collapsed pill in the queue header, OR a floating mini-widget at the bottom of the dashboard?
2. **Default-on for your own classes?** I default it to OFF (opt-in per class). You can flip yours on instantly via the toggle. Or do you want me to default-on for `teacher_id = matt`?
3. **Class size assumption:** I cap "suggest" at `votes >= 3`. For a class of 5 that's fine. For a class of 25 should the gate be higher (e.g. ≥ 30% of enrolled)? Hold at 3 for v1?
4. **Multi-class students:** my plan adds a class-selector pill at the top of the card. Acceptable for v1, or just show one class at a time (the most-recently-active)?
5. **Vetoes — character cap?** 80 chars feels right. Sound okay?
6. **"Try another 3" cap:** 3 generations per session ≈ 3× Haiku call ≈ effectively free. Hold at 3?

If you have no strong opinion on any of these, my defaults stand and we move.

## 12. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| AI returns an artist who later has a single offensive song | Low | Code-level blocklist + system-prompt "mainstream / radio-edit" + post-AI silent retry. Acceptable residual risk for v1; teacher reset is one tap. |
| Student spams veto text with abuse | Low | `moderateAndLog` already drops flagged content + records in `student_content_moderation_log`. Vote still counted. |
| Concurrent first-vote → 2 sessions opened | Low | Partial unique index `class_dj_sessions_one_open_per_class` rejects the 2nd; route catches the UNIQUE violation and joins the existing session. |
| Polling overheats DB | Very low | 2s polling, ~12 students, ~10 endpoints/sec at peak. Trivial. State endpoint is a 2-table read. |
| Card visible but DJ disabled on all enrolled classes | Low | Hydration endpoint returns empty list → card unmounts entirely (not greyed out). |
| Realtime drift between 2 students on different devices | Low | Polling at 2s is the source of truth. Latest suggestion wins. |

## 13. Test plan (Phase 7 detail)

- **RLS shape tests** (Vitest, mocked Supabase): each table denies cross-class reads; each table denies non-enrolled writes; `class_dj_votes.student_id = self` enforced.
- **Route tests:** `vote` validates input shape; `vote` calls `moderateAndLog`; `suggest` rejects below 3 votes; `suggest` rejects 4th generation; teacher routes guarded by `requireTeacher()` (NC-verified per `feedback_negative_control_grep_tests.md`).
- **Prompt safety NC:** test asserts the literal system-prompt string contains the 5 hard rules; NC by deleting a rule, confirming test fails.
- **Blocklist NC:** test asserts a known-bad input artist is dropped; NC by emptying the blocklist, confirming test fails.
- **JSON-shape parser test:** asserts AI response validates against zod schema; asserts retry on parse failure.
- **Card-render tests:** RTL — 4 dashboard states (no DJ class, DJ class with no session, voted-waiting, suggestion-shown).

Target: +25–35 tests. Baseline captured in Phase 1.

## 14. After this ships

Followups go in `docs/projects/class-dj-followups.md`:
- FU-DJ-BLOCKLIST — teacher-editable artist/genre blocklist UI.
- FU-DJ-SPOTIFY-EMBED — embed a real Spotify player per suggestion.
- FU-DJ-TEACHER-DRILLDOWN — teacher view of individual vote breakdown.
- FU-DJ-VOTE-WEIGHTS — late voters get less weight in the synthesis.
- FU-DJ-CROSS-CLASS-TRENDS — "what's the school listening to this week."
- FU-DJ-REALTIME — Supabase Realtime channel to drop polling.

---

**Sign-off field:**

- [ ] Matt has read brief, answered §11, and approved Phase 1 pre-flight.

Once ticked, Phase 1 Code block goes out and we follow the methodology phase by phase through M-DJ-1.
