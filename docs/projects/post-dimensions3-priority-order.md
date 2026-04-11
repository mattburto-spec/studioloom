# Post-Dimensions3 Priority Order

> Dependency-aware build order for everything after Dimensions3 ships.
> Created: 11 April 2026
> Source: analysis of [ALL-PROJECTS.md](ALL-PROJECTS.md) + dependency graph.
> Logic: dependency unlock value × pilot-readiness × shippability × strategic moat.

---

## Tier 1 — Quick wins & hygiene (~12–18 days)

Cheap, close out open P0 work, clear the runway before the big builds.

1. **MonitoredTextarea verification** (<1d, P0) — already built, just needs a fresh student session check. Close it out.
2. **API Deduplication** (2d) — 17× copied `callHaiku()` = ~2,890 wasted lines. Consolidate *before* Phase 2 D3 work layers more on top.
3. **MYPflex Phase 4** (2d, P0) — finishes framework-flexible assessment. Unblocks non-MYP teacher adoption, which matters the moment you go near a pilot.
4. **Auth / ServiceContext Seam** (1–2d) — cheap OS seam. Makes every subsequent service cleaner, and makes Makloom extraction possible later without a rewrite.
5. **Toolkit Redesign v5** (3–4d) — design approved, prototype exists, just build. Replaces live `/toolkit` and `/teacher/toolkit`.
6. **Lesson Pulse Phase 2** (4–5d, P0) — Voice/Personality + Sequencing Intuition. Rewire into the un-quarantined D3 generation. High quality delta per day.

---

## Tier 2 — Foundational unlocks (~25–34 days)

Force multipliers — everything downstream gets easier or is outright blocked on them.

7. **Student Learning Profile — Phase A** (11d, P0) — highest-leverage build in the whole backlog. Phase A alone (schema + Identity + SDT + passive signals + dimension registry + creative_voice) unblocks Designer Mentor matching, Discovery Cognitive Layer, Open Studio v2 plan health, Profile Consumers, group-project AI, and adaptive scaffolding. Resolve OQ-13/14/15 first.
8. **Skills Library — must-have slice** (4–6d, P1) — "the moat". Small schema, big strategic value. Directly unblocks Open Studio Mode's no-chatbot capability-gap surfacing and becomes the anchor for future Badge Engine and Safety Badge consolidation. 15 years of your own material is the one thing competitors cannot copy.
9. **AI Safety & Content Guardrails** (10–14d, P1) — non-negotiable before *any* school pilot. Gates revenue. Treat as a hard prerequisite, not a nice-to-have.

---

## Tier 3 — Pilot enablement (~20–30 days)

Once SLP Phase A and AI Safety exist, you can actually put StudioLoom in front of a school.

10. **School Readiness — Pre-Pilot tier** (~12–17d) — SSO, RBAC, Multi-Tenancy, Class polish, Teacher Dashboard. Nothing from the other tiers ships to a school without this.
11. **Open Studio Mode** (TBD — mostly reuses Skills Library joins) — ships the "no student-facing chatbot at launch" strategy cleanly. Depends on #8. High perceived value per day of build.
12. **SLP Phases B–D** (5+4+5 = 14d) — complete the profile once Phase A is stable. Phase B (trajectory + PeerInteractionWorker) is what group work and long-horizon features depend on.

---

## Tier 4 — Core product expansion (post-SLP, dependency-sequenced)

13. **Journey Engine — Phases A-B** (part of 17–22d) — required for Open Studio v2. Extracts Discovery's proven grammar into reusable blocks.
14. **Profile Consumers — Control Plane** (10–12d) — mandatory before any consumer ships. Sandbox + toggle registry + observability. Then: AI Mentor adaptation (1–2d) → Designer Mentor matching (2–3d).
15. **Designer Mentor System** — depends on SLP `creative_voice` (Phase A) and Control Plane. Creative signature feature.
16. **Open Studio v2** (15–17d) — Journey Engine's first complex consumer. Needs Journey A-B + SLP + Timetable (done).
17. **Student Work Pipeline** (19d, P1) + **Work Capture** — photo/video AI feedback. The thing that makes StudioLoom actually *about* D&T rather than generic LMS. Depends on Dimensions3.

---

## Tier 5 — Completion & polish (~25–35 days, reorderable)

Do in whatever order momentum suggests.

- **Lesson Plan Converter** (5–7d) — needs D3 Phase 1+2 ✅
- **Unified Upload Architecture** (3.5d)
- **Year Planner & Curriculum Connection** (5–7d)
- **Planning Tools / Student PM** (5d)
- **Discovery Engine Cognitive Layer** — depends on SLP
- **StudentDash Studio Desk** — v2 prototype is the cheaper ship; v1 for student testing comparison
- **NM Rocket Report** (2–3d, when Melbourne Metrics materials land)
- **Gamification / Student Levels** (8–10d) — depends on grading ✅ + subsystems
- **Student Choice Units** (4–5d)
- **Intelligence Profiles** — ⚠️ likely superseded by SLP. Audit before building separately; probably delete from tracker.

---

## Tier 6 — Long-horizon / research-heavy

- **3D Elements / Designville** (32d, P2, research) — resist until Tier 1–3 is done. Room prototypes are enough proof-of-concept to park it.
- **School Readiness Pre-Launch** (~15–21d)
- **School Readiness Pre-Scale** (~10–12d)
- **How-To Video System**
- **ELL — Language Support** (research spike first)
- **Monetisation & Tiers** (7–10d)

---

## Key sequencing rules

- **SLP Phase A before anything adaptive.** Designer Mentor, Profile Consumers, Discovery Cognitive, Open Studio v2 plan health, Journey Engine's student-profile reads — they all block on it. Don't start them in parallel and hope; ship Phase A first.
- **AI Safety is a revenue gate, not a feature.** Move it forward if a pilot conversation appears.
- **Skills Library before Open Studio Mode**, not alongside. The "no chatbot" strategy literally requires the library to resolve help moments.
- **Don't start Journey Engine until Dimensions3 Phase 2–4 is stable** — Activity Block schema is the foundation it pulls from.
- **Intelligence Profiles looks superseded by SLP.** Audit `docs/student-learning-intelligence.md` before building separately.
- **Tier 5 items are genuinely reorderable.** Do them based on which teacher (you) feels most friction that week.
- **3D Elements is a trap for now.** 32 days, P2, no revenue gate. Park it.

---

## Critical path (one line)

Tier 1 (quick wins) → **SLP Phase A** → **Skills Library** → **AI Safety** → School Readiness Pre-Pilot → Open Studio Mode → Journey Engine A-B → Profile Consumers Control Plane → Designer Mentor → Open Studio v2 → Student Work Pipeline → Tier 5 polish.
