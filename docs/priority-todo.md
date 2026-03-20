# StudioLoom — Priority Todo List

Generated from idea tracker analysis, March 2026. Items ordered by impact and dependency.

---

## Tier 1 — Do Before Bulk Upload (~5-8 hours)

- [x] **1. Prompt snapshot tests** — DONE. Vitest + 38 snapshot/unit tests across 3 files (`design-assistant-prompt`, `framework-vocabulary`, `prompts`). Run `npm run test`.
- [ ] **2. Upload pipeline integration test** — Protect knowledge base integrity. Test the full flow: upload → 3-pass analysis → chunking → embedding → retrieval. Confirm data isn't lost or corrupted.
- [x] **3. Rate limiting on design assistant** — DONE. In-memory sliding window: 30 req/min, 200 req/hour per user. Returns 429 with Retry-After header. See `src/lib/rate-limit.ts`.
- [ ] **4. Fix skeleton → approaches flicker bug in wizard** — Skeletons appear, then disappear (blank gap), then real approaches render. Keep skeletons visible until real data is ready, then crossfade.

---

## Tier 2 — High-Impact Features (~2-3 weeks)

- [ ] **5. Lesson timing visualization in unit editor** — Add a timing strip showing estimated minutes per section. Pull duration from activity cards and AI estimates. Show total vs. available period time. Allow drag-to-adjust.
- [ ] **6. Teacher Review UI for uploaded lessons** — The upload pipeline works but there's no way to see/verify the analysis. Build rich display of LessonProfile after upload with strengths, gaps, and actionable improvement suggestions.
- [ ] **7. AI marking/comment suggestions (agentic assessment)** — Highest-value feature gap per audit. Retrieve rubric strand descriptors → analyze student submission → generate strand-level feedback with evidence → suggest improvements with exemplar references. ~2-3 weeks, very high impact.
- [ ] **8. Keyword chip selection UX in wizard** — Make keyword/related idea chips clearly clickable with selection affordance. Add helper text ("Select any that resonate"). Optionally require 2-3 selections before Next activates.
- [ ] **9. Fun thinking messages during AI generation** — Array of ~20 rotating messages during wizard generation waits: "Consulting with Bloom about taxonomy levels...", "Asking Hattie what works best...", "Channeling Dieter Rams — less but better..." Cycle every 3-4 seconds.

---

## Tier 3 — New Features Worth Designing (~1 month+)

- [ ] **10. Feature flag system** — PostHog (includes feature flags + analytics) or custom `feature_flags` table. Super admin page to toggle features on/off for testing. Protected `/admin` route with role gating.
- [ ] **11. Teacher projector/present mode** — "Present" button opens full-screen, clean view of current lesson page. Large text, high contrast, keyboard navigation. Simpler than generating PPTs and more dynamic.
- [ ] **12. Feedback Station activity type** — Student's device becomes a feedback collection point. Other students walk up, see prototype context, respond to structured prompts. Data collects back to original student. QR code access.
- [ ] **13. Source restriction flags for knowledge base** — Add `source_restriction` field to knowledge_items: `unrestricted | reference_only | excluded`. Filter in RAG retrieval. Protects against plagiarism from copyrighted textbook content.
- [ ] **14. Free public activities for conversion funnel** — Make 5-10 activity cards publicly accessible without login. Preview of full library behind signup. Strong acquisition strategy for teachers to try before committing.
- [ ] **15. Kahoot-style quiz activity cards** — Start with self-paced quiz cards with class results view. New activity card type. Add live/synchronous mode later if there's demand.
- [ ] **16. "Generate one with..." variation buttons** — Replace single "Regenerate" with 3 contextual buttons: "more hands-on", "stronger scaffolding", "real-world connections". Dynamically chosen based on current approaches.
- [ ] **17. Lesson export pipeline (PPT, worksheets, PDF)** — Design what a "worksheet" looks like per page type. PPT template selection. Which pages become slides? Already roadmapped but needs detailed design.
- [x] **18. Sentry integration** — DONE. `@sentry/nextjs` installed with instrumentation files. **TODO: create Sentry project at sentry.io, add `NEXT_PUBLIC_SENTRY_DSN` to `.env.local`, restart dev server.**
- [x] **19. AI usage tracking table** — DONE. `ai_usage_log` table in migration 025. Fire-and-forget logging via `src/lib/usage-tracking.ts`. Wired into design assistant. **TODO: run `supabase db push` or apply migration 025 to create the table.**

---

## Tier 4 — Strategic / Long-term

- [ ] **20. VEX/Robotics curriculum profile** — Specialized CurriculumProfile for robotics/engineering contexts. Custom terminology, phases, assessment, activity types. Engineering notebook format as key artifact.
- [ ] **21. Backward design algorithm for Vibe Unit Planning** — AI receives end goal → identifies required competencies → works backwards to scaffold sequence → selects activities. Core of the Vibe Planning feature.
- [ ] **22. Cartoon character advisor** — Visual wrapper around Design Assistant. Character selection during onboarding. Character-specific personality delivers Socratic mentoring. High engagement for ages 11-16.
- [ ] **23. Asana-style Kanban board view for students** — Add "Board View" toggle to existing planning panel. Columns: Research → Design → Make → Evaluate. Draggable task cards.
- [ ] **24. Built-in photo annotation tools** — Draw on photos, add labels/arrows. For portfolio entries and prototype documentation. Planned in Phase 3 roadmap.
- [ ] **25. Core/spanning activity cards across lessons** — Activities that span multiple pages shown as connected visual elements. Drag-to-resize time allocation. Future UX exploration.
- [ ] **26. Clickable hotspot annotations on images** — Teacher places interactive hotspots on diagrams/images. Students click to reveal info. Activity card type for image analysis.
- [ ] **27. Peer feedback stations (gallery walk digitized)** — Structured feedback collection during class critiques. Rating scales, quick text, checkbox selections. Teacher-triggered class-wide activity.
- [ ] **28. Free competitive design challenges** — Timed ideation sprints, design battles, constraint challenges with peer voting. Marketing/acquisition + engagement tool.
- [ ] **29. Makloom code extraction** — Extract shared core (activity system, AI mentor, portfolio, KB, design cycle) into common package for consumer version at makloom.com.
- [ ] **30. Hardware packs business model** — Curated maker kits paired with specific units. Partnership with suppliers vs. direct sourcing from China. Revisit when platform has traction.

---

## Open Questions (Not Actionable Yet)

- **Marketing strategy** — When ready, use Cowork for: competitive analysis brief → landing page copy → pitch deck → email outreach templates
- **Textbooks vs AI-generated content** — Use textbooks as KB inputs to learn pedagogical patterns. AI generates customized content. Both have value.
- **Time & pace research (Hattie/HITS)** — Need to audit current model against HITS framework for pacing gaps. Add pacing metadata to LessonProfile.
- **Custom diagram generation** — Pre-built SVG templates (double diamond, design cycle) with AI-populated labels more reliable than fully AI-generated diagrams
- **Admin test sandbox hardcoded model bug** — Still uses `claude-sonnet-4-20250514` instead of config's model selection

---

*Last updated: 2026-03-16*
*Source: docs/idea-tracker.md (full analysis with roadmap mapping)*
