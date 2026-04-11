# Skills Library — Design Note

**Status:** Draft v0.1
**Owner:** Matt
**Workshop project:** scheduled for next week
**Related docs:** Open Studio Mode spec, Stones, Wayfinder, Crit Board, Work Capture Pipeline

---

## 1. Why this matters

The skills library is the keystone of Loominary's "no chatbot" strategy. Every help-surfacing pattern in the student dashboard prototypes — Stone prerequisites, crit board pins, journal wikilinks, blocker suggestions, Open Studio recommendations — ultimately resolves to a skill card. If the library is thin, the dashboard is thin. If the library is rich, the dashboard becomes a genuinely capable scaffolding system without ever generating a sentence.

It is also Loominary's most defensible long-term asset. ManageBac and Toddle can ship features faster than a solo developer; they cannot ship fifteen years of MYP Design teaching. The PowerPoints, lesson materials, worked examples, and videos that already exist (and the new ones recorded going forward) are content competitors structurally cannot copy. The more it is tagged, interlinked, and reused, the more valuable it becomes — and the harder it is to leave Loominary for an alternative.

The strategic frame: **the library is not a feature. It is the moat.**

---

## 2. Principles

1. **One canonical card, many embed contexts.** A skill card is authored once and referenced from the library, lesson activity blocks, Stone prerequisites, Open Studio recommendations, crit board pins, and quiz gates. Never duplicated.
2. **Tags over hierarchy.** Folder structures break with curriculum changes; tag graphs survive them. Every card carries multiple tags reachable from many contexts.
3. **Polymorphic content.** Skill cards mix text, images, video, embedded interactives, and external links in one structured payload — not separate tables per type.
4. **Append-only completion record.** Skill completions are `learning_events`, derived into a current-state view, never stored as a mutable table. Consistent with the existing architectural commitment.
5. **Global by default, private by exception.** Skill cards default to network-visible so cross-school value compounds. Schools can mark cards private, fork to localise, or contribute upstream.
6. **Provenance preserved through forks.** Every card knows its origin and its lineage. Attribution is non-negotiable if the library is going to attract contributors later.
7. **Stale cards are flagged, not hidden.** Link rot is the silent killer of resource libraries. The system surfaces decay rather than letting it accumulate.

---

## 3. Anatomy of a skill card

A skill card is the unit of reusable instructional content. The minimum viable shape:

- **Title** — short, action-oriented (*"Solder a header pin"*, *"Use a multimeter for continuity testing"*).
- **Slug** — stable URL-safe identifier; survives renames.
- **Tags** — flat, multiple, drawn from a controlled vocabulary that grows over time. Examples: `electronics`, `soldering`, `safety`, `tool:multimeter`, `myp-design:criterion-c`.
- **Difficulty** — `foundational` / `intermediate` / `advanced`. Not a strict gate, just a hint for surfacing.
- **Estimated time** — minutes. Drives "you've got 20 min, here's a 15-min skill" surfacing.
- **Prerequisites** — references to other skill cards. Edges in a directed graph; cycle-checked at write time.
- **Body** — structured content blocks: prose, image, video, embedded interactive, callout, worked example, checklist. Stored as JSONB so the schema doesn't fight new block types.
- **External resources** — curated links to outside material (manufacturer datasheet, YouTube video, academic paper). Each link tracked separately for link-check.
- **Optional quiz** — question set for assessment-gated embeds. See §6.
- **Optional badge** — link to a badge that completion contributes toward. See §7.
- **Author** — the human who wrote it. Always visible.
- **Provenance** — `forked_from` reference if derived from another card; full lineage walkable.
- **Last reviewed** — timestamp of the most recent author check. Drives stale-card flagging.
- **Visibility** — `private` (author only), `school` (one school), `network` (all StudioLoom schools), `public` (anyone with the URL).

---

## 4. Data model sketch

The schema follows the same polymorphic pattern as `learning_events`. One core table, JSONB payloads, edges in join tables.

```sql
-- The card itself
skill_cards (
  id              uuid primary key,
  slug            text unique,
  title           text not null,
  body            jsonb not null,         -- ordered content blocks
  difficulty      text,                   -- foundational | intermediate | advanced
  estimated_min   int,
  visibility      text not null,          -- private | school | network | public
  author_id       uuid references users,
  school_id       uuid references schools,-- nullable; null = author personal
  forked_from     uuid references skill_cards,
  created_at      timestamptz default now(),
  last_reviewed_at timestamptz default now()
)

-- Many-to-many tags
skill_card_tags (
  skill_id        uuid references skill_cards,
  tag             text,
  primary key (skill_id, tag)
)

-- Directed prerequisite graph
skill_prerequisites (
  skill_id        uuid references skill_cards,
  prerequisite_id uuid references skill_cards,
  primary key (skill_id, prerequisite_id)
)

-- Curated external links (separately tracked for link-check)
skill_external_links (
  id              uuid primary key,
  skill_id        uuid references skill_cards,
  url             text not null,
  title           text,
  link_type       text,                   -- video | pdf | article | datasheet | other
  last_checked_at timestamptz,
  status          text                    -- ok | broken | redirect | unchecked
)

-- Quiz definition (optional, one per card)
skill_quizzes (
  skill_id        uuid primary key references skill_cards,
  questions       jsonb not null,         -- array of question objects
  pass_threshold  numeric default 0.8,
  retakes_allowed int default null        -- null = unlimited
)

-- Badge link (optional, many-to-many)
skill_badge_requirements (
  badge_id        uuid references badges,
  skill_id        uuid references skill_cards,
  requirement_type text                   -- viewed | quiz_passed | demonstrated
)
```

**Skill completions are not stored in their own table.** They are written as `learning_events` of type `skill.viewed`, `skill.quiz_passed`, `skill.demonstrated`. A `student_skill_state` view derives current state by aggregating these events. This keeps the system aligned with the existing append-only commitment and means skill records survive school transfers automatically.

---

## 5. Where skill cards appear (embed contexts)

The same canonical card surfaces in many places. Each context is a different *view* of the card, not a different copy.

| Context | What the student sees | Gate behaviour |
|---|---|---|
| **Library browse** | Full card view, tag-navigable, related skills sidebar | None — exploratory |
| **Stone prerequisite link** | Card opens from "revisit if stuck" panel | None — voluntary |
| **Lesson activity block embed** | Card embedded inline in the lesson flow | Configurable: none, viewed, quiz-passed |
| **Open Studio recommendation** | Surfaced from Stone capability gap | None — recommendation only |
| **Crit board pin** | Card linked alongside an exemplar | None — reference |
| **Badge requirement** | Card surfaced from the badge page | Configurable: viewed, quiz-passed, demonstrated |

The interesting case is the **lesson activity block embed**. A lesson is a sequence of activity blocks (instructions, prompts, work captures, embedded skill cards). When a teacher embeds a skill card in a lesson, they choose a gate level:

- **None** — student can scroll past without engaging. Card is reference material.
- **Viewed** — student must open the card and (optionally) scroll to the bottom before the next activity block unlocks.
- **Quiz-passed** — student must pass the card's quiz at the configured threshold before proceeding. Most strict.

The gate is per-embed, not per-card. The same multimeter card can be a hard gate in a Grade 7 lesson and a soft reference in a Grade 10 lesson. Gate state is recorded as a `learning_event` so the Wayfinder shows how a student progressed through the gates.

---

## 6. Quizzes

Quizzes exist to make gating credible. A "viewed" gate is easy to game; a "quiz-passed" gate requires actual engagement. The design constraint is that quizzes must be **gradable without a model** — no free text, no LLM evaluation, no ambiguity.

**Question types (v1):**

- Multiple choice (single answer)
- Multiple choice (multiple answer)
- True / false
- Image identification (tap the correct part of an image)
- Ordering (drag steps into the correct sequence)
- Matching (pair items from two columns)

That's enough to write meaningful assessments for almost any practical skill without ever needing free-text evaluation. Free-text reflection lives in the daily journal, not in quizzes.

**Behaviour:**

- Pass threshold defaults to 80%, configurable per quiz.
- Retakes are unlimited by default. Teachers can cap them per embed if needed.
- Failed attempts are logged as `learning_events` (not hidden) so a student's path through difficulty is visible to the teacher.
- The student sees which questions they got wrong but is encouraged to re-read the card before retaking, not given the answer key.

**Authoring:**

Quiz questions are authored alongside the card body in the same editor. A skill card without a quiz simply has no quiz embed; it can still be gated at the "viewed" level.

---

## 7. Badges

Some skills are valuable enough to certify formally. Safety badges are the canonical case — a student cannot use the laser cutter until they have earned the laser safety badge. The same mechanism extends to any skill the school wants to recognise as a discrete competency.

**Badge anatomy:**

- Name and visual icon
- Description and rationale
- One or more skill card requirements (each with required completion type: viewed / quiz-passed / demonstrated)
- Optional teacher verification step (the "demonstrated" type)
- Issued-at timestamp, issuing teacher, optional expiry (safety badges may expire annually)

**The "demonstrated" requirement type** is the bridge between the digital library and the physical workshop. A student can pass the laser cutter quiz online, but the badge isn't issued until a teacher signs off that they've actually demonstrated safe operation in person. The teacher sign-off is itself a `learning_event`. This avoids the trap of certifying purely on the basis of a quiz.

**Why badges matter strategically:**

Badges are the most natural unit of cross-school recognition. A laser safety badge earned at NIS should mean something at any other school running a fab lab. As StudioLoom expands to multiple schools, badges become a portable credential layer — and the student carries them per the existing architectural commitment that the student is the root entity.

This also opens a future path toward Mastery Transcript Consortium alignment. MTC's whole model is alternative credentials that universities accept; Loominary badges, properly designed, could feed into an MTC-style transcript without architectural change.

---

## 8. Open Studio capability-gap surfacing

This is one of the most valuable embed contexts and worth specifying clearly because it sounds AI-ish but is structurally simple.

**The mechanism:**

1. Each Stone declares its required skills (a tag set, or explicit skill card references).
2. Each student has a current skill state derived from `learning_events`.
3. When a student opens a Stone in Open Studio, the system computes the set difference: `required_skills - earned_skills`.
4. Any gap surfaces in the Stone's "you may want to revisit" panel.

That's it. No model, no recommendation algorithm, no embedding similarity. A join and a difference. Auditable, fast, predictable, and entirely transparent to the student — they can see exactly why a card was recommended ("this Stone needs continuity testing; you haven't completed that skill yet").

The same mechanism applies in reverse: when a student completes a skill quiz, any Stones whose requirements are now satisfied can surface as "you might be ready for this." Discovery driven by structure, not generation.

---

## 9. Authoring workflow

The library evolves through phases. The system has to support all of them but should not over-engineer for later phases at the cost of phase 1.

**Phase 1 — Matt at NIS (now → first pilot).** Single author, write-and-ship. No moderation, no review queue. Ship cards as drafts and revise in place. The goal is to bootstrap a few dozen high-value cards covering the most-used skills in MYP Design Grade 7 and 10.

**Phase 2 — NIS teachers (first pilot → end of pilot).** Other NIS teachers can author cards into the school namespace. Lightweight peer review (one other teacher views and signs off). Cards default to school visibility, can be promoted to network visibility by Matt or a designated reviewer.

**Phase 3 — Network contributors (post-pilot, multi-school).** Teachers at other StudioLoom schools can author cards into their school namespace and optionally publish to the network. Network publication requires meeting a quality bar (clear title, working links, at least one tag, author bio). No revenue, no marketplace yet.

**Phase 4 — Community marketplace (long-term).** Possible paid contributors, possible revenue share, possible curation team. Out of scope for this design note but the data model should not preclude it. Visibility, attribution, and forking are all already in the schema for this reason.

The forking model is important from phase 2 onward. When a teacher needs to localise a card (translate, swap units, adapt to a different framework), they fork rather than edit. The original is preserved, the fork records its lineage, and both authors get attribution. Forks can also be merged back upstream as suggestions, but that's a phase 3+ feature.

---

## 10. Maintenance

Link rot is the killer. A library that's 30% broken links is worse than no library — it actively damages student trust. Two mechanisms address this:

**Nightly link-check via pg_cron.** The `skill_external_links` table is iterated overnight; each link is HEAD-requested, status updated. Broken links surface in a maintenance queue that the card's author sees on next login. Already specced in the existing automation tooling (alongside the bug squash digest).

**Stale card flagging.** Cards older than a configurable threshold (default 12 months) without a `last_reviewed_at` update are flagged in the library browse view. Not hidden, not removed — just visibly marked so students know to ask a teacher before relying on them. The author sees the flag in their dashboard and can clear it with a one-click "still good" action that bumps the timestamp.

Neither of these requires moderation infrastructure. Both run in the background and surface decay rather than letting it accumulate quietly.

---

## 11. Cross-school sharing as network effect

This is the strategic core and worth restating plainly. Three things compound the library's value over time:

The library grows roughly linearly with the number of contributing teachers, but its value to *each* student grows faster than linearly — every new card potentially unlocks a connection from many existing Stones, lessons, and badges. A single laser-cutter safety card written at NIS becomes useful at every other StudioLoom school running a fab lab. The marginal cost of sharing is zero; the marginal value is real.

Schools that contribute their best material to the network gain proportionally more from other schools' contributions. This creates a soft incentive to publish rather than hoard, without needing a formal marketplace economy. The forking model means schools that need to localise can do so without losing access to upstream improvements.

A student transferring between StudioLoom schools carries their earned skills and badges with them — already true per the existing architectural commitment that the student is the root entity. The library makes this commitment *visible*: a student arriving at a new school finds the same skill cards, the same badges, the same vocabulary. Continuity at the content layer reinforces continuity at the data layer.

This is the moat. Nobody else can replicate fifteen years of teacher-authored, peer-reviewed, classroom-tested material distributed across a network of contributing schools. The longer Loominary runs, the deeper the moat gets.

---

## 12. Open questions

1. **Quiz question types beyond v1.** Is image identification worth shipping in the first cut, or start with MC and true/false only? Image identification is high-value for safety and tools but more authoring effort.
2. **Pass threshold default.** 80% is a guess. Worth piloting at NIS before locking it in.
3. **Retake limits.** Default unlimited is most pedagogically defensible but has gaming risks. Worth a teacher-side setting per embed.
4. **Demonstrated requirement workflow.** How does a teacher actually sign off a "demonstrated" badge? Walk over to the student's bench and tap a button on their phone? Sign off from the teacher dashboard? Both?
5. **Video hosting.** Self-host (expensive, controlled), YouTube (free, ads, content moderation risk in China), Cloudflare Stream (cheap, works in China, no ads). Cloudflare Stream looks like the strong default but worth confirming bandwidth costs.
6. **Localisation as fork vs overlay.** Forking is simpler and matches the data model. Overlay (translations attached to one canonical card) is more elegant but more complex. Start with fork; revisit if it gets messy.
7. **Search ranking at scale.** A library of 50 cards is browsable. A library of 500 needs real search. Worth deferring until we get to ~100 cards, but the schema should support full-text search from day one (Postgres `tsvector`).
8. **Tag governance.** Who decides whether `electronics` and `electronic` and `electrical` are the same tag? Phase 1: Matt decides. Phase 3+: this needs a process.
9. **Quiz gating accessibility.** A student with a cognitive load disability may struggle with a hard quiz gate. The gate level configuration probably needs a per-student override capability for IEPs. Worth specifying alongside the WCAG 2.1 AA compliance work already in the backlog.
10. **Badge expiry and re-certification.** Safety badges expire annually in many real-world contexts. Does Loominary support re-certification flows from day one, or defer?

---

## 13. Workshop project — suggested scope

Trying to ship all of this in one workshop project is a recipe for shipping nothing. A focused first slice that proves the core data model and one embed context:

**Must-have for the workshop project:**

- Schema implementation (cards, tags, prerequisites, external links, completions as learning_events)
- Basic authoring UI — markdown-ish editor with structured blocks (text, image, video embed, callout)
- Card view (the leaf experience) — the page a student lands on when they tap any skill link
- Library browse with tag filtering
- Stone prerequisite integration — the lowest-risk first embed context, already prototyped in the dashboard
- Nightly link-check job (can be a simple Edge Function — it's worth shipping from day one because retrofitting after links rot is much harder)

**Should-have if time permits:**

- Quiz engine (MC + true/false only for v1)
- Lesson activity block embedding with viewed-level gate
- Open Studio capability-gap surfacing (the join is trivial; the UI surfacing is the work)

**Defer to later projects:**

- Badge engine (it's a bigger spec; needs teacher sign-off workflow, expiry, visualisation)
- Forking and lineage UI (the schema supports it from day one but the UI can wait)
- Cross-school visibility (until there are multiple schools)
- Community contributor onboarding (phase 4, long way off)
- Image identification quiz type (phase 2)
- Search at scale (until the library is big enough to need it)

A reasonable target for the workshop project: **20–30 high-value skill cards covering the most-used skills in MYP Design Grade 7 and Grade 10, viewable in the library, linkable from Stones, with working link-check.** That alone is a complete loop and an immediately useful product surface — and it gives you the bootstrap content base for everything else.

---

## 14. Next steps

1. Confirm the "lesson activity block" mental model. The doc assumes lessons are sequences of activity blocks (instructions, prompts, work captures, embedded skill cards) distinct from Stones (the disposable execution layer). Worth verifying against the existing architecture before building.
2. Draft the controlled tag vocabulary for MYP Design — this is a 30-minute task but anchors everything else.
3. Pick the first 20–30 skill cards to author. Probably mined from existing PowerPoints and lesson materials.
4. Sketch the authoring UI — this is the experience Matt will live in for years and deserves design care.
5. Schema migration written and reviewed against the existing Supabase setup.
6. Stand up the link-check Edge Function before any external links are added, so the table starts clean.
