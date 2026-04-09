# StudioLoom Toolkit Audit — 19 March 2026
**Scope:** All 42 tools in the Design Thinking Toolkit
**Auditor:** Claude session

---

## Summary

- **23 interactive AI-powered tools** (have pages, components, and most have API routes)
- **19 template-only tools** (listed in catalog but no interactive version)
- **4 tools missing their API routes** (Fishbone and Biomimicry use shortened paths — actually work)
- **2 stub components** (Decision Matrix and How Might We — pages work but shared components are placeholders)

---

## Interactive Tools (23) — Full Audit

### Tier 1: Flagship Tools (world-class AI, effort-gating, per-step rules)

| # | Tool | Lines | Working | AI Usage | Effort Gate | Per-Step Rules | UX Quality | Who Does It Better | One Improvement |
|---|------|-------|---------|----------|-------------|----------------|------------|-------------------|-----------------|
| 1 | **SCAMPER** | 1,042 | ✅ | Staged prompts + effort-gated nudge + cross-step synthesis | ✅ Word count + linguistic markers | ✅ 7 step-specific AI personalities | ⭐⭐⭐⭐⭐ | Nobody — only AI-guided SCAMPER | "Pick Best 3" convergent step ✅ DONE |
| 2 | **Six Thinking Hats** | 866 | ✅ | Per-hat AI personality + nudge + synthesis | ✅ | ✅ 6 hat-specific rules (Black=only critical hat) | ⭐⭐⭐⭐⭐ | Miro has template, no AI | Thinking balance chart ✅ DONE |
| 3 | **PMI Chart** | 678 | ✅ | Column-specific prompts + nudge + cross-column synthesis | ✅ | ✅ Plus/Minus/Interesting each different | ⭐⭐⭐⭐⭐ | Nobody has "Interesting" column AI push | Verdict step ✅ DONE |
| 4 | **Five Whys** | 594 | ✅ | **Depth detection** — sideways vs deeper | ✅ | ✅ Each Why level has different context | ⭐⭐⭐⭐⭐ | Unique depth detection — nobody else | Drill visualization ✅ DONE |
| 5 | **Empathy Map** | 632 | ✅ | Quadrant-specific + contradictory emotions push | ✅ + quote detection for Says | ✅ 4 quadrant-specific rules | ⭐⭐⭐⭐⭐ | NNGroup has guide, no AI | Persona snapshot — LOST in Framer disaster |
| 6 | **Lotus Diagram** | 731 | ✅ | Step-specific prompts + synthesis | ✅ | ✅ Center vs petals | ⭐⭐⭐⭐ | Very rare as digital tool | 9-box visual — LOST in Framer disaster |
| 7 | **SWOT Analysis** | 844 | ✅ | Quadrant-specific (internal/external × positive/negative) | ✅ | ✅ 4 distinct quadrant rules | ⭐⭐⭐⭐ | Many SWOT tools, none AI-guided per quadrant | Strategic priority step ✅ DONE |
| 8 | **Stakeholder Map** | 830 | ✅ | 3-step progressive discovery + synthesis | ✅ | ✅ List→Categorise→Needs | ⭐⭐⭐⭐ | Miro template, no guided process | Power/Interest 2×2 grid ✅ DONE |

### Tier 2: Solid Interactive Tools (AI nudges + synthesis, good UX)

| # | Tool | Lines | Working | AI Usage | Effort Gate | Per-Step Rules | UX Quality | Who Does It Better | One Improvement |
|---|------|-------|---------|----------|-------------|----------------|------------|-------------------|-----------------|
| 9 | **Affinity Diagram** | 673 | ✅ | AI-suggested clusters + synthesis | ✅ | Partial (dump vs cluster phases) | ⭐⭐⭐⭐ | Miro/FigJam have drag clustering | Sticky note visual ✅ DONE |
| 10 | **Morphological Chart** | 714 | ✅ | Parameter prompts + synthesis | ✅ | Partial | ⭐⭐⭐⭐ | Almost non-existent digitally | Combination spotlight — LOST in Framer disaster |
| 11 | **Reverse Brainstorm** | 522 | ✅ | Bad ideas → flip to solutions + synthesis | ✅ | ✅ Step 1 divergent, Step 2 convergent | ⭐⭐⭐⭐ | Very rare tool | Flip quality score — LOST in Framer disaster |
| 12 | **Mind Map** | 549 | ✅ | Breadth→Depth→Connections progression | ✅ | ✅ 3 step-specific rules | ⭐⭐⭐⭐ | MindMeister, Miro (visual), no AI guidance | Visual branch preview |
| 13 | **Brainstorm Web** | 518 | ✅ | Pure divergent + combine + wild ideas | ✅ | ✅ 3 round-specific rules | ⭐⭐⭐⭐ | Many brainstorm tools, none with round-based AI | Idea clustering in summary |

### Tier 3: New Interactive Tools (functional, need polish)

| # | Tool | Lines | Working | AI Usage | Effort Gate | Per-Step Rules | UX Quality | Who Does It Better | One Improvement |
|---|------|-------|---------|----------|-------------|----------------|------------|-------------------|-----------------|
| 14 | **Journey Map** | 537 | ✅ | Phase-specific + emotion tracking + synthesis | ✅ | ✅ 5 journey phases | ⭐⭐⭐ | UXPressia, Smaply (visual), no AI | Visual emotion timeline chart |
| 15 | **Systems Map** | 469 | ✅ | Element→Connection→Feedback loop detection | ✅ | ✅ 3 analysis steps | ⭐⭐⭐ | Kumu, Loopy (visual), no AI | Visual node-link diagram |
| 16 | **User Persona** | 439 | ✅ | Section-specific prompts + synthesis | ✅ | ✅ 5 persona sections | ⭐⭐⭐ | Xtensio (visual cards), no AI | Visual persona card layout |
| 17 | **Fishbone Diagram** | 527 | ✅ | 6-category cause analysis | ✅ | ✅ Per-category rules | ⭐⭐⭐ | Creately, Lucidchart (visual), no AI | Visual fishbone shape |
| 18 | **Biomimicry Cards** | 528 | ✅ | Nature→Principle→Application pipeline | ✅ | ✅ 4 bio-inspired steps | ⭐⭐⭐ | AskNature.org (reference), no interactive AI | Nature image references |
| 19 | **Feedback Capture Grid** | 433 | ✅ | 4-quadrant (Likes/Wishes/Questions/Ideas) + action items | Basic | Partial | ⭐⭐⭐ | Google Forms, Miro template | Visual 2×2 grid layout |
| 20 | **Impact/Effort Matrix** | 579 | ✅ | 2×2 scoring + recommendations | Basic | Partial | ⭐⭐⭐ | Many prioritization tools | Visual scatter plot of scored items |
| 21 | **Pairwise Comparison** | 500 | ✅ | **Circular preference detection** | Basic | Partial | ⭐⭐⭐ | Rare as digital tool | Visual ranking animation |
| 22 | **POV Statement** | 390 | ✅ | User→Need→Insight guided composition | Basic | ✅ 3 parts with tough Insight push | ⭐⭐⭐ | Stanford d.school templates | Formatted POV card export |
| 23 | **Design Specification** | 414 | ✅ | 5-section guided composition + completeness check | Basic | ✅ 5 section-specific rules | ⭐⭐⭐ | Generic spec templates | Auto-populate from earlier research |

### Stub Components (pages work, shared components are placeholders)

| # | Tool | Status | Issue |
|---|------|--------|-------|
| — | **Decision Matrix** | Page works at `/toolkit/decision-matrix` | Shared component is 53-line stub — needs extraction for embedded mode |
| — | **How Might We** | Page works at `/toolkit/how-might-we` | Shared component is 53-line stub — needs extraction for embedded mode |

---

## Template-Only Tools (19) — No Interactive Version

These are listed in the catalog but have no interactive page. Categorized by what they should become:

### Should eventually be interactive (Category B from earlier assessment)

| Tool | Type | Why Template Is OK For Now |
|------|------|---------------------------|
| Observation Sheet | Research | Form-based — guided template with AI summary at end |
| Annotation Template | Communication | Visual markup — hard to do in text-only |
| Design Journal | Reflection | Free-form writing — AI summary at end |
| Before & After | Evaluation | Simple comparison — doesn't need step-by-step AI |
| Testing Protocol | Planning | Checklist format — guided template sufficient |
| Peer Review Protocol | Evaluation | Structured checklist — guided template sufficient |
| Mood Board | Research | Visual-first — needs image upload, not text |
| Storyboard | Communication | Sequential visual — needs drawing/image capability |
| Wireframe Template | Communication | Visual layout — needs canvas/drawing |
| Resource Planner | Planning | Table/form — guided template sufficient |
| Gantt Planner | Planning | Already built as separate PlanningPanel component |
| Trade-off Sliders | Evaluation | Already built as ResponseInput slider component |
| Design Specification (duplicate?) | — | May be duplicate of interactive version |

### Should stay template/physical only (Category C)

| Tool | Why |
|------|-----|
| Crazy 8s | Timed sketching on paper — the whole point is speed with pencil |
| Gallery Walk | Physical movement activity — walking around the room |
| Round Robin | Verbal group activity — students take turns talking |
| Dot Voting | Physical sticky dots or simple poll |
| Reverse Brainstorming (duplicate) | Duplicate of "Reverse Brainstorm" — should be merged/removed |
| Journey Map (Template) | Duplicate of interactive Journey Map — renamed with "(Template)" |
| Impact/Effort Matrix (Template) | Duplicate of interactive version — renamed with "(Template)" |
| User Persona Card (Template) | Duplicate of interactive version — renamed with "(Template)" |

---

## Cross-Cutting Issues

### 1. Duplicate Entries in tools-data.ts
Three tools have both an interactive version and a template version listed:
- Journey Map + Journey Map (Template)
- Impact/Effort Matrix + Impact/Effort Matrix (Template)
- User Persona Card + User Persona Card (Template)

Plus "Reverse Brainstorm" and "Reverse Brainstorming" are duplicates.

**Fix:** Remove the template duplicates entirely (the interactive versions supersede them). Merge/remove "Reverse Brainstorming."

### 2. Missing API Routes (False Alarm)
Fishbone and Biomimicry components correctly call `/api/tools/fishbone` and `/api/tools/biomimicry` — the routes exist but with shortened slugs. Not an issue.

### 3. Tier 3 Tools Need Visual Upgrades
The newer tools (Journey Map, Systems Map, Fishbone, etc.) are text-based step sequences where the original method is inherently VISUAL (node diagrams, timelines, fishbone shapes). Adding visual output representations in the summary screen would elevate these significantly.

### 4. Lost Improvements (from Framer Motion incident)
4 tool improvements need to be re-added:
- Empathy Map: persona snapshot auto-generation
- Lotus Diagram: 9-box status visualization
- Morphological Chart: combination spotlight
- Reverse Brainstorm: flip quality creativity score

---

## AI Appropriateness Assessment

**Overall: EXCELLENT.** The AI pattern across all tools is pedagogically sound:

1. **AI never generates ideas for students** — it nudges, questions, and challenges
2. **Effort-gating prevents AI from rewarding laziness** — low-effort responses get "try harder" not praise
3. **Per-step rules change the AI's personality** — Six Hats Black hat is the ONLY hat that encourages criticism; SCAMPER Eliminate step pushes for "what can be removed?"
4. **Phase-aware feedback** — ideation tools use divergent language, evaluation tools use convergent language
5. **Synthesis is the reward** — AI provides cross-step insights only AFTER the student has done the thinking
6. **Prompts are read-only** — students can never click a prompt to auto-fill their response

**The only tools where AI could be stronger:**
- Feedback Capture Grid, Impact/Effort Matrix, Pairwise Comparison, POV Statement, Design Specification — these have basic AI (synthesis only) but could benefit from per-step nudges with effort gating
