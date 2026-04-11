# StudioLoom North Star

**Purpose:** A reference doc to read whenever you're tempted to build something that doesn't move the moat. Re-read before any major roadmap decision, before any "we should add X to compete with Canvas" instinct, and before any feature that lives *next to* the brain instead of *inside* it.

**Last reviewed:** 2026-04-11

---

## The one-line version

StudioLoom wins by being the only AI tool that *learns how design teaching actually works* and gets measurably better at it over time. Every roadmap call gets filtered through that sentence.

---

## The three things no competitor has

These are the moat. Protect them, deepen them, and build everything else in service of them.

### 1. A real pedagogical brain
The Design Teaching Corpus, Workshop Model, timing model, teacher style profiles, and the 65+ Teaching Moves Library together encode something most ed-tech AI products do not have: an actual model of how good design teachers teach. Almost all competitors ship "ChatGPT with a school skin." StudioLoom ships pedagogy with AI underneath. Every feature should ask: does this make the brain smarter, or is it surface polish?

### 2. The interactive toolkit (27 tools and counting)
The toolkit's defining principle — *structure thinking, do not offload it to a chatbot* — is the most defensible product principle StudioLoom has. SCAMPER is the reference implementation. Every tool gates effort, runs Socratic feedback, stages cognitive load, and uses soft gating instead of dumping students into an open chat. This is the opposite of how nearly every other AI ed-tech product is built. Hold the line: **no chatbots for students, ever.** The thinking is the point.

### 3. Framework-agnostic via FrameworkAdapter
MYP, GCSE, A-Level, IGCSE, ACARA, PLTW, NESA, Victorian, custom — all rendered from the same neutral content layer. No competitor that started inside a single framework can catch up without a full rewrite. Keep the neutral criterion taxonomy clean and never let framework-specific vocabulary leak into content.

---

## The closed learning loop (the thing that turns the moat into a fortress)

The single highest-leverage build remaining is closing this loop end-to-end:

> Teacher uploads → blocks ingested with efficacy → unit generated → lessons taught → student work captured → AI feedback → outcomes → block efficacy updated → next generation is measurably better.

Roughly 80% of the pieces exist. The missing 20% is **Pipeline 2 (student work capture) feeding back into Pipeline 1 (block library)** with measurable efficacy lifts. Until that loop closes, the brain learns from teacher signals only. Once it closes, no new entrant can catch up by hiring more engineers because what they need is twelve months of real classroom data, and you'll have a head start on producing it.

**This is the next strategic build after Dimensions3 lands.** Everything else waits.

---

## What StudioLoom is *not* and must never become

### Not an LMS
You will lose to Canvas and Google Classroom on LMS features and you should be relieved about that. Ship the integrations (Drive sync, Classroom roster sync, Google SSO) and stop. Never build a gradebook, never build attendance tracking, never build a parent portal, never build school-admin features. These are tar pits that drain solo-dev time and make StudioLoom look like a worse version of a product that already exists.

### Not a chatbot wrapper
The moment a student-facing feature becomes "talk to the AI about your project," the moat erodes. AI for students is gated, structured, and earned through effort. AI for teachers can be conversational because teachers have the expertise to push back on bad outputs.

### Not "everything for everyone"
Design and technology is the wedge. The framework-agnostic plumbing means StudioLoom *can* serve other subjects later, but every distraction toward "let's add a science unit type now" defers the closed loop. Win DT first. Earn the right to expand.

### Not a generic AI lesson generator
Generic generators are commoditised already. StudioLoom's generation is valuable because it carries the brain — Workshop Model timing, Teaching Moves, teacher style, block efficacy, neutral criteria. If a feature could be replicated by anyone with a Claude API key in a weekend, it is not the moat.

---

## The decision filter

Before building anything that takes more than three days, ask in this order:

1. **Does this deepen the brain or close the loop?** If yes, build it. If no, continue.
2. **Does this make a teacher reach "this saved me an hour" faster than today?** If yes, consider it. If no, continue.
3. **Is it an integration tar pit (gradebook, attendance, parent portal, LMS feature)?** If yes, refuse. Direct users to Canvas/Classroom integration instead.
4. **Is it a feature a competitor with $5M and 8 engineers could ship in two weeks?** If yes, deprioritise — they can match it. Spend the time on the loop instead.
5. **Is this a distraction disguised as polish?** Polish is fine after the moat work ships, not before.

If a feature passes 1 *or* 2 and survives 3, 4, 5 — build it.

---

## The bets worth taking seriously

These are not the next thing — Pipeline 2 is. But they sit on the strategic radar.

**Open Studio v2 as a separate wedge.** Self-directed project work is a category nobody owns and it is where the "AI mentor not chatbot" principle is most defensible. There may be a freemium funnel here where individual students or homeschoolers use Open Studio standalone, then schools adopt full StudioLoom because their kids are already in it.

**Teacher style learning as the product spine.** "AI that learns how *you* teach" is more defensible positioning than "AI that generates lessons." Make the teacher style profile *visible to the teacher* — let them see and edit their own brain. This turns a hidden plumbing feature into a marketing surface and a retention hook.

**The hosted demo path.** Solo-dev products live or die on how fast a new teacher gets to "this saved me an hour." Once Dimensions3 is solid, a no-login hosted demo where a teacher pastes a curriculum doc and sees a generated unit in 90 seconds is the single most leveraged marketing asset you can build. It doubles as a regression test for the pipeline.

**A unifying visual language for student-facing surfaces.** The 27 toolkit tools, Discovery Engine, Open Studio, and 3D Elements currently look like good individual things rather than chapters of one universe. A two-week design sprint to pick a unifying metaphor (the studio? Kit's world? the workshop?) and force every student surface through it would be worth more than another five features. This is polish that *is* moat, because it makes StudioLoom feel like a product instead of a toolkit.

---

## The uncomfortable truth about speed

The phased-with-checkpoints methodology is genuinely world-class for a solo build. It is also slower than competitors. The risk is not quality — it is that someone with funding ships a worse version first and captures the category before StudioLoom is ready.

The defence is **not going faster**. Going faster reintroduces the silent bugs the methodology exists to prevent, and those bugs are far more expensive than the methodology. The defence is **closing the loop sooner** so the data moat starts compounding. A worse product with twelve months of real efficacy data beats a better product with none. Pipeline 2 is more important than any individual feature.

---

## What "winning" looks like in concrete terms

You will know StudioLoom has won when:

1. Teachers describe it as "the AI that actually understands how I teach," not as "an AI lesson generator."
2. The block library has efficacy data on enough activities that generated units measurably outperform manually built ones on student outcomes — and you can prove it.
3. Open Studio is the canonical answer when anyone in DT education says "how do you handle self-directed projects with AI."
4. A new teacher gets from signup to "first usable unit" in under five minutes without help.
5. At least one competing product has tried to copy the toolkit's no-chatbot approach because it became the obvious right answer.
6. You can take a vacation without the product going stale, because the brain is learning from real classroom signals on its own.

---

## When to re-read this doc

- Before any roadmap planning session
- Before saying yes to any feature request from a school
- Before any "we should add LMS feature X" instinct
- Whenever a competitor ships something flashy
- Before starting a new build phase
- When tempted to build a chatbot for students (the answer is always no)
- Before any decision that would slow down Pipeline 2

---

## Related canonical docs

- [`docs/projects/ALL-PROJECTS.md`](../projects/ALL-PROJECTS.md) — what's actually being built
- [`docs/projects/studentwork.md`](../projects/studentwork.md) — Pipeline 2 spec (the next moat build)
- [`docs/build-methodology.md`](../build-methodology.md) — how phases work
- [`docs/brain/ai-intelligence-architecture.md`](../brain/ai-intelligence-architecture.md) — the brain
- [`docs/education-ai-patterns.md`](../education-ai-patterns.md) — the no-chatbot principles
- [`docs/decisions-log.md`](../decisions-log.md) — historical "why"
