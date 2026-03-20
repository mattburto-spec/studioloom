# StudioLoom / Questerra — Idea Tracker

Organized from Matt's Apple Notes brain dump (March 2026). Each idea is categorized, mapped to the existing roadmap where applicable, and tagged with implementation status.

---

## Status Legend

| Tag | Meaning |
|-----|---------|
| **ROADMAPPED** | Already in `docs/roadmap.md` with a design |
| **PARTIALLY BUILT** | Some implementation exists in the codebase |
| **NEW IDEA** | Not currently in the roadmap — needs design decision |
| **QUESTION** | Open question, not an actionable feature yet |

---

## 1. Teacher Lesson Export & Presentation Tools

### 1a. Lesson Overview with Export Options (worksheets, PPT)
> *"How can a teacher create a lesson overview and export relevant files? Eg can click on 'create worksheets' or 'make PPT'"*

**Status:** ROADMAPPED (Phase 2 → "Teacher Resources (later layer)" — generate PPTs and printable worksheets from unit content)

**Roadmap ref:** Phase 2, bottom — "Generate PPTs from unit content / Generate printable worksheets/handouts"

**Notes:** This is listed as a "later layer" in the roadmap but hasn't been designed in detail. The core question is valid — teachers need their content in formats they can project, print, and hand out. Consider: a "Lesson Overview" page per unit that shows timing, activities, materials at a glance, with export buttons for PDF summary, PPT slides, and printable worksheet.

**Action needed:** Design the export pipeline. Key decisions: what does a "worksheet" look like for different page types? Does the PPT follow a template? Can teachers choose which pages become slides?

### 1b. Teacher-Preferred Formats / Lesson Readability
> *"Each teacher has preferred formats to view a lesson. Don't want teachers to have great lessons that look confusing and don't translate well to pdf or ppt"*

**Status:** NEW IDEA — not in roadmap

**Notes:** This is a UX design problem. The current unit page editor produces structured JSON content that renders well on-screen, but there's no "print view" or "presentation mode." Teachers who want to present a lesson to their class or share it with a colleague need it to look professional in their preferred format. Consider: lesson display templates (clean PDF, slide deck, one-page summary) that teachers can preview before exporting. Could also tie into the "teacher display/projector mode" idea below.

---

## 2. Marketing & Business Development

### 2a. Marketing Help
> *"Later on I'll need help marketing this product. Is Claude coworker better for that?"*

**Status:** QUESTION

**Notes:** Claude in Cowork mode can absolutely help with marketing — writing copy, creating pitch decks, drafting email sequences, competitive positioning, landing page content. When you're ready, a good starting sequence would be: competitive analysis brief → landing page copy → pitch deck for schools → email outreach templates. The product-management and design skills available in Cowork are well-suited for this.

### 2b. Selling Hardware Packs to Schools
> *"Do you think there are opportunities to sell packs of hardware to schools? I'm in china and can get stuff cheap."*

**Status:** NEW IDEA — business model question

**Notes:** Interesting but orthogonal to the software platform. Could be a revenue line (curated maker kits paired with specific units), but adds supply chain complexity. The safer path: partner with existing suppliers (Adafruit, SparkFun, local distributors) and include recommended materials lists in units. Revisit if the platform gains traction and you can bundle "StudioLoom Starter Kit" with a school subscription.

---

## 3. Specialized Contexts & Add-ons

### 3a. VEX Robotics / Engineering Layer
> *"Vex layer or other robotics layer... Gantt chart, to do, helping with engineer manual. Could be an add-on or something switched on/off manually."*

**Status:** NEW IDEA — relates to roadmap's CurriculumProfile architecture

**Notes:** This fits naturally into the CurriculumProfile system (roadmap → Market Expansion). A "VEX Robotics" or "Engineering" profile would customize: terminology, design cycle phases, assessment criteria, activity types, and resource suggestions. The Gantt/planning tools already exist. The engineering notebook format is the main new artifact. Consider this as a future CurriculumProfile rather than a separate product. Could be toggled on/off per class.

---

## 4. Super Admin & Feature Flagging

### 4a. Super User Admin Page
> *"With so many features is there a super user admin page to turn some on and off to test before fully functioning? Perhaps includes all other common options you'd find in a super admin page."*

**Status:** PARTIALLY BUILT — Admin AI Model Config panel exists, but no general feature flag system

**Notes:** The Admin AI Model Config panel (`/admin/ai-config`) exists with test sandbox, emphasis dials, and config history. But there's no general-purpose feature flag system. This is a solid idea for a platform with this many features. Implementation: a `feature_flags` table with `flag_key`, `enabled`, `rollout_percentage`, `allowed_users` — with an admin UI to toggle flags. PostHog (already recommended in roadmap for analytics) includes feature flags built-in, so you could get both analytics and feature flags from one tool.

**Action needed:** Decide whether to build a custom feature flag system or adopt PostHog (which includes feature flags). Either way, you need a protected `/admin` route with password/role gating. Currently the admin panel likely uses Supabase Auth — confirm this and ensure it's properly restricted.

---

## 5. Lesson Timing & Pacing

### 5a. Lesson Timing Visibility
> *"How does the AI or a human teacher know the timing of a lesson when looking at the lesson creation page? Needs to be some way to see that easily and perhaps modify easily."*

**Status:** PARTIALLY BUILT — grade-level timing profiles exist, but no UI for viewing/adjusting per-lesson timing

**Notes:** The system has `cognitive load caps by MYP year` (CLAUDE.md) and activity cards include `duration` metadata. The Lesson Intelligence types include `lesson_flow` with phases that have timing. But there's no visible timing bar or editable duration per page/section in the unit editor. This is a high-value UX addition: a timing strip at the top of the edit page showing estimated minutes per section, with drag handles to adjust. The AI could warn when a lesson exceeds the period length.

**Action needed:** Add a timing visualization to the unit page editor. Pull duration from activity cards and AI estimates. Show total vs. available period time. Allow drag-to-adjust.

### 5b. Time & Pace as Critical Teaching Factors (Hattie/HITS)
> *"Time and pace are critical and we forgot those. According to Hattie and other key meta studies, HITS (PDF)... Can you research then look at gaps in my model?"*

**Status:** PARTIALLY BUILT — timing profiles exist but pacing intelligence is thin

**Notes:** Hattie's research and HITS identify pacing, feedback timing, and lesson structure as high-impact strategies. The current model captures some of this (cognitive load caps, 3-tier ELL scaffolding, Bloom's adaptive mentoring) but doesn't explicitly model pacing. Gaps to investigate: lesson pace variation (fast intro → slow practice → fast wrap-up), time allocation per Bloom's level, pace adjustment based on student response patterns. The Lesson Intelligence 3-pass analysis could be enhanced to extract pacing patterns from uploaded lessons.

**Action needed:** Research HITS framework gaps against current model. Consider adding pacing metadata to LessonProfile and having the AI recommend pace adjustments based on student progress data.

---

## 6. Lesson Plan Upload & AI Review

### 6a. Upload Existing Lesson Plans for AI Suggestions
> *"Need to be able to upload existing lesson plan. And then have AI go over it and make suggestions."*

**Status:** PARTIALLY BUILT — upload pipeline and 3-pass analysis exist, but no suggestion/improvement UI

**Notes:** The upload pipeline already does: extract → 3-pass AI analysis → store profile → chunk → embed. The `LessonProfile` captures strengths, gaps, and improvement opportunities. What's missing is a "Review & Improve" UI that shows the teacher their uploaded lesson plan alongside AI suggestions for improvement — not just analysis metadata, but actionable recommendations ("Add a formative check here", "This section could use more scaffolding for ELL students", "Consider adding a hands-on activity before this theory section"). The Quick-Modify prompts are already built in types.

**Action needed:** This overlaps with "Teacher Review UI" (roadmap priority #6). Build the review UI to show both analysis AND actionable improvement suggestions. The quick-modify system ("make it more hands-on", "shorten for Friday afternoon") is the interaction model.

---

## 7. AI Marking & Assessment

### 7a. AI Marking/Comment Suggestions
> *"How hard is it for the AI in the current model to have a guess at marking comment suggestions based on what it can see and read?"*

**Status:** ROADMAPPED — highest-value feature gap per 2026-03 audit

**Roadmap ref:** Phase 4 → "Teacher Marking & Grading Assistance" + Priority #8 "Grading/Marking UI + Agentic Assessment"

**Notes:** The types are built (`AssessmentRecord`, `CriterionScore`, `AssessmentTag` in `assessment.ts`), the curriculum framework has criterion descriptors, and the AI can already access student responses. The agentic workflow would be: retrieve rubric strand descriptors → analyze student submission → generate strand-level feedback with evidence → suggest improvements with exemplar references. Claude's vision capabilities could also analyze prototype photos. This is ~2-3 weeks of work but very high impact.

---

## 8. Knowledge Base & Source Management

### 8a. Flag/Hide Textbook Sources to Avoid Plagiarism
> *"Want to be able to flag sources like textbooks to hide or remove from AI referencing so I don't later get caught for plagiarism... basically training AI on their stuff"*

**Status:** NEW IDEA — not in roadmap

**Notes:** This is a legitimate IP concern. If teachers upload copyrighted textbooks and the AI generates content that closely mirrors them, there's a plagiarism/copyright risk. Solutions: (1) Add a `source_type` field to knowledge items (original, textbook, copyrighted, open_source) with a flag to exclude copyrighted sources from direct content generation but allow them to inform pedagogical patterns. (2) Add a "reference only" mode where the AI can learn teaching approaches from the source but never reproduces specific content. (3) Add a per-item toggle: "Use for AI generation" vs "Reference only — do not reproduce content."

**Action needed:** Add `source_restriction` field to knowledge_items: `unrestricted | reference_only | excluded`. Filter in RAG retrieval. Show teachers which sources are being used in generation.

### 8b. AI-Generated Alternative Images from Textbooks
> *"Can AI later on recreate images from textbooks but be different enough from the original?"*

**Status:** NEW IDEA — relates to "Auto-Generated Visual Content" in Phase 4

**Notes:** AI image generation (DALL-E, Midjourney, etc.) can create diagrams and illustrations inspired by textbook concepts without copying them. For example: generating a new double diamond diagram, a custom design cycle visualization, or process flow diagrams. This ties into the roadmap's "Auto-Generated Visual Content" feature. The key is generating from the concept description, not from the source image itself.

---

## 9. Gamification & Student Engagement

### 9a. Unit Badges & Designer Journey Visualization
> *"Each unit could be a badge as students 'journey' as designers. Showing that journey visually would help with gamification. Perhaps with an avatar."*

**Status:** ROADMAPPED — Phase 1 (Progress Path + Streaks + Milestones) and Phase 3 (Skill Tracks & Badges)

**Notes:** The roadmap has a carefully scoped gamification plan: design cycle progress path, consistency streaks, and phase completion celebrations (Phase 1), expanding to skill tracks and badges (Phase 3). The "avatar" idea is new — a customizable design persona that levels up as students complete units and earn badges. This could be powerful for the 11-16 age group. Consider: avatar customization unlocks (new items for completing units), a journey map showing all completed units as "locations visited," and a profile card showing badges earned.

**Action needed:** The avatar concept is a nice addition to the existing gamification plan. Don't over-scope it early — start with unit completion badges and a visual journey map, then add avatar customization as engagement data shows what resonates.

### 9b. Built-in Kahoot-Style Quizzes
> *"Having Kahoot-like gameshow quizzes built in so students don't have to go to another site"*

**Status:** NEW IDEA

**Notes:** This could be a new activity type / response type. Live quiz mode where the teacher projects a question, students answer on their devices, and results show in real-time. Ties into the existing activity card system — quiz activities could be a card type. Consider: does this need to be live/synchronous (true Kahoot experience) or could it be self-paced quizzes with a leaderboard? Live mode is significantly more complex (WebSocket/Realtime). Self-paced with class results is much simpler and still engaging.

**Recommendation:** Start with self-paced quiz activity cards with a class results view. Add live mode later if there's demand.

---

## 10. Wizard UX Improvements

### 10a. Prompt Users to Click on Keywords/Related Ideas
> *"The wizard asks me to describe my thinking, then presents key words and related ideas but the user needs to be prompted to click on some of these otherwise they'll skip it"*

**Status:** NEW IDEA — UX fix for existing wizard

**Notes:** This is a UX discoverability issue. If the wizard surfaces keywords and related ideas but teachers skip past them, the value is lost. Solutions: (1) Make keywords clickable chips that visually "select" and feed back into the generation. (2) Add a gentle prompt: "Select any that resonate with your vision" with a minimum selection before proceeding. (3) Animate/highlight the chips to draw attention. (4) Show a brief tooltip on first use explaining why selecting keywords improves the output.

**Action needed:** Quick UX fix — add selection affordance to keyword chips, add helper text, optionally require 2-3 selections before the "Next" button activates.

### 10b. Fun "Thinking" Messages During AI Generation
> *"When the unit AI wizard is thinking it should change the text like Claude's to show its thinking. Perhaps even make some funny ones related to education with puns on famous educational guys"*

**Status:** NEW IDEA — UX polish

**Notes:** Great idea for personality. During AI generation waits, cycle through messages like: "Consulting with Bloom about taxonomy levels...", "Asking Hattie what works best...", "Channeling Dieter Rams — less but better...", "Running this by Vygotsky's zone of proximal development...", "Checking with de Bono — putting on the green hat..." This is a low-effort, high-charm addition. Implementation: array of ~20 messages, cycle every 3-4 seconds during generation.

**Action needed:** Create a message array and add a cycling text component to the wizard's loading state. Low effort, nice polish.

### 10c. Skeleton Approaches Flickering Issue
> *"The skeleton approach comes up straight away but then at some point they disappear for a while so it's blank. Then the real ones appear"*

**Status:** BUG — needs investigation

**Notes:** The skeleton/placeholder approaches should transition smoothly to real content. The blank gap suggests a state management issue — skeletons are cleared before real data arrives. Fix: keep skeletons visible until real data is ready to render, then crossfade.

### 10d. More Variation in Generated Approaches
> *"Instead of 1 'regenerate' at bottom of approaches, have 3 'generate one with...' buttons to add further variation"*

**Status:** NEW IDEA — UX improvement for wizard

**Notes:** Instead of a single "Regenerate" button, offer 3 contextual generation buttons like: "Generate one with more hands-on activities", "Generate one with stronger scaffolding", "Generate one with real-world connections." These could be dynamically chosen based on what the current approaches emphasize (if all are theory-heavy, suggest a practical variant). This makes regeneration purposeful rather than random.

---

## 11. Backward Design & Scaffolding Intelligence

### 11a. Journey Wizard Working Backwards from Final Destination
> *"Does this new journey wizard once it knows the final destination work backwards to think how to get students skills, knowledge and practice to that point through smart scaffolding?"*

**Status:** ROADMAPPED — this is the core of "Vibe Unit Planning" (Phase 2)

**Roadmap ref:** Phase 2 → "Vibe Unit Planning (Experimental)" + "Student-Driven Unit Discovery"

**Notes:** Yes, this backward design approach (Understanding by Design / Wiggins & McTighe) is the essence of the Vibe Unit Planning feature. The AI should: (1) Understand the end goal (final product/assessment), (2) Identify the skills, knowledge, and practice needed to reach it, (3) Work backwards to sequence learning activities that scaffold toward that goal, (4) Pull appropriate activities, resources, and tasks from the knowledge base and activity library. The current wizard generates forward (topic → activities → assessment). The Vibe Planning wrapper would invert this. This is a fundamental pedagogical improvement.

**Action needed:** When building Vibe Unit Planning, explicitly implement backward design as the planning algorithm. The AI prompt should receive: end goal → required competencies → scaffold sequence → activity selection.

### 11b. Student-Built Custom Units
> *"This custom builder unit will later be useful for if the teacher wants to give students freedom to build their own unit"*

**Status:** ROADMAPPED — "Student-Driven Unit Discovery (Guided Pathfinding)" in Phase 2

**Notes:** Already designed in detail in the roadmap with three outcomes: match to existing unit, adapt an existing unit, or generate from scratch. Teacher approval gate included.

---

## 12. Teacher Display / Projector Mode

### 12a. Teacher Display Option for Projecting
> *"Might be nice to have a teacher display option to project so not needing to download PPTs all the time"*

**Status:** NEW IDEA

**Notes:** A "Present" mode that turns the current lesson/unit page into a clean, projector-friendly view — large text, high contrast, minimal UI chrome, keyboard navigation (arrow keys for next/prev section). This is simpler than generating PPTs and more dynamic (can show real-time student responses, live polls, etc.). Many modern tools do this (Notion's presentation mode, Google Slides' speaker view). Could be as simple as a "Present" button that opens a full-screen, simplified view of the current page.

**Recommendation:** This could be a quick win — a CSS-only presentation mode that strips the editor UI and maximizes content. Add later: speaker notes panel, timer, student response overlay.

---

## 13. API Performance

### 13a. Slow API Calls
> *"Some of the API calls can be slow. Any ways to speed these up?"*

**Status:** KNOWN ISSUE — relates to operational infrastructure

**Notes:** Common causes and fixes for slow AI API calls: (1) Streaming responses — show content as it generates rather than waiting for completion (partially implemented for some endpoints). (2) Parallel requests — where multiple AI calls are independent, fire them simultaneously. (3) Caching — cache AI responses for identical inputs (unit skeletons for same parameters). (4) Model selection — Haiku is 5-10x faster than Sonnet for simpler tasks. (5) Prompt optimization — shorter prompts = faster responses. (6) Edge functions — move AI orchestration closer to the user. (7) Optimistic UI — show the interface as ready immediately and populate AI content asynchronously.

**Action needed:** Audit which specific endpoints are slow. The wizard generation is inherently slow (complex Sonnet calls), but skeleton loading, activity suggestions, and design assistant responses can likely be optimized.

---

## 14. Inspiration & Reference Sites

### 14a. MakeyMakey Lesson Flow Style
> *"I really like this lesson flow perspective — https://courses.makeymakey.com/101/"*

**Status:** REFERENCE — UX inspiration

**Notes:** MakeyMakey's lesson flow uses a clean, step-by-step progression with visual cards, embedded media, and clear "do this next" guidance. Key takeaways for StudioLoom: (1) Each step is visually distinct with clear numbering. (2) Media (images, videos) are inline, not hidden behind links. (3) Progress is visible but not overwhelming. (4) The tone is encouraging and action-oriented. Consider this as UX reference when building the student-facing lesson view.

### 14b. Google NotebookLM Reference
> *"Woo tang said: Google GEM, Google Classroom LM"*

**Status:** REFERENCE — competitive intelligence

**Notes:** Google's NotebookLM is an AI tool that lets users upload sources and have AI conversations grounded in those sources — similar to StudioLoom's knowledge base + RAG approach but consumer-facing. Worth studying for: how they handle source attribution, how they present AI-generated summaries, and their UX for "chat with your documents." Google Classroom integration is already on the roadmap (LMS integration via LTI).

### 14c. MakeMake Page Interactive Popups
> *"Make make page has nice clickable areas for popups on its pictures"*

**Status:** REFERENCE — UX pattern

**Notes:** Clickable hotspots on images that reveal popups/tooltips. This is a powerful UX pattern for design education — annotated images of products, processes, or prototypes where students can click on specific areas to learn more. Could be: (1) A response type where students annotate images, (2) A content type in lessons where teachers place hotspots on diagrams, (3) An activity card type for image analysis exercises. This relates to the "annotation layer" mentioned in Phase 3 (Portfolio-Worthy Responses).

### 14d. KJS Publications Engineering Workbook
> *"Engineering studies workbook — https://www.kjspublications.com.au/"*

**Status:** REFERENCE — content structure inspiration

**Notes:** Traditional engineering workbooks provide structured templates for documenting the design process — sketches, specifications, testing records, evaluations. StudioLoom's digital equivalent should capture this same rigor but with AI assistance. Good reference for what information engineering students need to document and how it maps to assessment criteria.

---

## 15. Card/Lesson Architecture Concepts

### 15a. Core Cards Running Through Multiple Lessons
> *"Some cards are core to a lesson and run through... the core activity that runs down a column through multiple lessons as a long card"*

**Status:** NEW IDEA — conceptual

**Notes:** This is an interesting architectural concept: some activities span multiple lessons (e.g., an ongoing research project, a multi-session build). The current model treats each page independently. A "spanning card" that visually connects across multiple pages would show continuity. Implementation could be: a `span` property on activities indicating which pages they cover, rendered as a connected visual element in the unit overview. The drag-to-resize time allocation is a nice touch — click the bottom edge and drag to extend/shorten the time spent on a spanning activity.

**Consideration:** This is a significant UI concept change. Park it as a future UX exploration after the core lesson view is solid.

---

## 16. Student Experience Enhancements

### 16a. Cartoon Character Advisor
> *"In student mode a little cartoon character they chose provides advice"*

**Status:** NEW IDEA — relates to gamification (avatars) and Design Assistant

**Notes:** This would be a visual wrapper around the existing Design Assistant (Socratic mentor). Instead of a chat-style interface, a chosen cartoon character delivers the advice with personality. For ages 11-16, this could increase engagement significantly. Implementation: character selection during onboarding, character avatar displayed next to mentor messages, character-specific voice/personality (e.g., a quirky inventor, a thoughtful architect, a bold artist). Could tie into the avatar/badge system from gamification.

### 16b. Photo Feature in Portfolio
> *"Is it possible to have a photo feature built into the portfolio?"*

**Status:** PARTIALLY BUILT — Quick Capture includes photo capture, portfolio timeline displays photos

**Notes:** Quick Capture already supports photo upload (camera/upload → crop → caption). Photos flow into the portfolio timeline. What might be missing: (1) Direct camera access from within the portfolio view (not just Quick Capture). (2) A dedicated "Photo Gallery" view in the portfolio. (3) Photo annotation tools (draw on photos, add labels). The annotation layer is planned in Phase 3.

### 16c. Scaffolding for Different Student Levels
> *"How to scaffold for students at different levels is also critical."*

**Status:** PARTIALLY BUILT — 3-tier ELL scaffolding exists, grade-level timing profiles, Bloom's adaptive mentoring

**Notes:** Current scaffolding: ELL tiers (sentence starters, guided prompts, extension challenges), grade-level cognitive load caps, Bloom's-adaptive Design Assistant. What's missing: (1) Within a single class, students at different ability levels seeing different scaffolding for the same activity. (2) Adaptive difficulty — if a student struggles, the AI offers more support; if they excel, it offers extension. (3) SEN-specific scaffolding (the `StudentLearningProfile` type exists but isn't yet used in generation). The `ClassCohortContext` and `StudentLearningProfile` types are built — they need to be wired into the AI generation pipeline.

---

## 17. Project Management Inspiration

### 17a. Asana-Style Project Management for Students
> *"How about Asana project management model but for design students?"*

**Status:** PARTIALLY BUILT — Gantt/Planning view exists, student task tracker with time logging

**Notes:** The Gantt/planning view is built. What Asana adds: (1) Board view (Kanban) — tasks in columns (To Do / In Progress / Done / Blocked). (2) Timeline dependencies — task B can't start until task A is done. (3) Workload view — how much each student has on their plate. (4) Templates — reusable task sets for common design processes. For design students, a simplified Kanban board (maybe 4 columns: Research → Design → Make → Evaluate) with draggable task cards would be very intuitive. The existing planning panel could add a "Board View" toggle.

---

## 18. Quick Lesson Tools

### 18a. Sick Day / Quick Lesson Generator
> *"Sick day / quick lesson generator / quick update editor"*

**Status:** ROADMAPPED — Phase 4 → "Teacher Landing Page Overhaul" → "Emergency mode"

**Roadmap ref:** "Teachers running late or calling in sick need to fire off a quick, tailored lesson... structured single-lesson plan (warm-up, main activity, wrap-up) in ~30 seconds"

**Notes:** Already designed. Key: this doesn't generate a full unit — just a single structured lesson plan with warm-up, main activity, and wrap-up. Optimized for speed over depth.

---

## 19. Problem-Based Unit Design

### 19a. Problems as Unit Starting Points
> *"Design tasks often start with a problem. Need to consider how to build this into a unit beginning."*

**Status:** ROADMAPPED — addressed in wizard flow and Student-Driven Unit Discovery

**Notes:** The wizard already asks for context/scenario. The Student-Driven Unit Discovery starts with "What problems have you noticed?" The Vibe Unit Planning starts with the end goal. The key insight is that MYP Design units should begin with a design problem/challenge — the wizard should make this prominent in Step 1 rather than buried in optional fields. Consider making "Design Challenge" the primary input field, with topic/subject as secondary context.

---

## 20. Textbooks vs AI-Generated Content

### 20a. Are Textbooks Redundant with AI?
> *"Are textbooks kinda redundant now with AI? We can study existing textbooks and once AI knows the curriculum and target audience can custom generate content..."*

**Status:** QUESTION — philosophical/strategic

**Notes:** Textbooks provide: (1) Expert-curated, peer-reviewed content, (2) Consistent quality baseline, (3) Visual design and diagrams, (4) Legal/institutional credibility. AI-generated content provides: (1) Customization to exact context, (2) Up-to-date information, (3) Adaptive difficulty, (4) Unlimited variation. The answer is "both" — textbooks as knowledge base inputs (informing AI about what good content looks like) while AI generates customized, contextual lessons. StudioLoom's approach of uploading lesson resources into the knowledge base and having AI learn pedagogical patterns is exactly right. The AI doesn't replace the textbook — it learns from it and generates something tailored.

**Re: custom diagrams (like double diamond):** AI can generate SVG diagrams, Mermaid charts, and simple illustrations. For design-specific diagrams (double diamond, design cycle, etc.), pre-built SVG templates with customizable labels would be more reliable than fully AI-generated diagrams. Consider a library of design process diagram templates that the AI populates with context-specific labels.

---

## 21. Feedback Collection Activities

### 21a. Peer Feedback Stations / Prototype Feedback Collection
> *"Some activities could be feedback collectors so students set their computer up next to their prototype, give instructions and prompts or quick surveys to collect data"*

**Status:** NEW IDEA — relates to Phase 5 (Peer Feedback & Collaboration)

**Notes:** This is a specific and clever activity type: "Feedback Station" mode where a student's device becomes a feedback collection point. Other students walk up, see the prototype/project context, and respond to structured prompts (rating scales, quick text, checkbox selections). The data collects back to the original student. This is very common in design classrooms (gallery walks, crit sessions) but rarely digitized. Implementation: a special "Feedback Station" page mode with a QR code to access, simplified input UI for respondents, and collected responses visible to the student and teacher.

**Recommendation:** Add this as an activity card type. Fits naturally into Phase 5 (Social Learning) but could be an early standalone feature since it's high-value for design classrooms.

---

## 22. Free Activities & Conversion Funnel

### 22a. Free Activities Without Login
> *"Selection of free activities you can use without logging in. Can see all but can't access all."*

**Status:** ROADMAPPED — relates to Phase 7 (Freemium) and Demo/Sandbox Mode

**Notes:** The roadmap includes a "Demo / Sandbox Mode" (Cross-Cutting Concerns) and a freemium tier with "5 free activities." The idea of making some activities publicly accessible without login is a strong acquisition strategy — teachers try an activity with their class, see the value, and sign up. The activity card library is a natural fit for this: make 5-10 cards publicly accessible with a preview of the full library behind signup.

---

## 23. Foundation Confidence & Testing

### 23a. Hesitant to Bulk Upload Until Foundation is Solid
> *"I'm still hesitant to start bulk uploading stuff till I know it's a solid foundation"*

**Status:** VALID CONCERN — zero automated tests, operational gaps

**Notes:** This concern is well-founded given the 2026-03 audit findings: zero test files, no rate limiting, no structured logging, no usage monitoring. Before bulk uploading valuable lesson content, you should have confidence that: (1) The upload pipeline doesn't lose data (needs integration tests). (2) The 3-pass analysis produces consistent results (needs prompt snapshot tests). (3) The chunking and embedding are correct (needs validation tests). (4) You can re-run analysis if prompts improve (already supported, but untested).

**Action needed:** The "Operational Quick Wins" from the roadmap (~5 hours) should be the priority before bulk upload. Specifically: prompt snapshot tests and an integration test for the upload → analyze → chunk → embed pipeline.

### 23b. Comprehensive Testing Todo List
> *"You'll need to give me a comprehensive todo list of all the things to test because I implemented a bunch of things but didn't test them fully."*

**Status:** ACTION NEEDED — see dedicated section below

---

## 24. Makloom / Consumer Version

### 24a. Expanding to Individual Makers/Home Users
> *"How to expand this resource to individual makers or home users. Lots of overlap. Would be another separate site but leverage the core already made."*

**Status:** NOTED in CLAUDE.md — "Sister project: Makloom (makloom.com) — consumer/individual version, ~60-70% code reusable"

**Notes:** Already identified as Makloom. Key differences from StudioLoom: no teacher/class structure, self-directed learning paths, community features instead of school features, different onboarding (interest-based rather than curriculum-based). The shared core: activity system, AI mentor, portfolio, knowledge base, design cycle framework. When ready, extract the shared code into a common package.

---

## 25. Competitive/Collaborative Activities

### 25a. Competitive Free Activities
> *"Some of these activities could be competitive?"*

**Status:** NEW IDEA — light gamification

**Notes:** Competitive design challenges (timed ideation sprints, design battles, constraint challenges) could work well as both engagement tools and marketing/acquisition features. Keep it design-focused: "Design a solution for X in 10 minutes" with peer voting on creativity, feasibility, etc. This ties into the Kahoot-style quiz idea and the free activities conversion funnel.

---

## Comprehensive Testing Checklist

Based on the features implemented but not fully tested, here's what needs verification:

**Critical Path (test first):**
1. Student login via token → page load → response submit → portfolio auto-capture
2. Teacher login → create class → import students → assign unit → view progress
3. Knowledge base upload → 3-pass analysis → chunking → embedding → retrieval
4. AI Unit Builder wizard → full 7-step flow → unit generation → save
5. Design Assistant conversation → Socratic mentoring → 3-strike gating → Bloom's tracking

**Unit Builder & Content:**
6. Flexible page architecture — add/remove/reorder pages in editor
7. All 10+ response types render and save correctly (text, upload, voice, canvas, Decision Matrix, PMI, Pairwise Comparison, Trade-off Sliders, etc.)
8. Activity card browser — search, filter, insert into page, AI adaptation
9. Skeleton generation in wizard — loading states, transitions to real approaches
10. Multi-option outlines in wizard — selecting different approaches

**Knowledge Base:**
11. PDF/DOCX/PPTX upload and text extraction
12. Hybrid search (vector + BM25 + quality weighting)
13. Lesson Profile creation and retrieval via `match_lesson_profiles()`
14. Chunk quality signals update (times_retrieved, times_used)
15. Re-analysis of existing uploads

**Student Experience:**
16. Quick Capture Bar — photo, link, note, mistake capture
17. Portfolio timeline — auto-populated entries, filtering, ordering
18. Planning/Gantt view — task creation, time logging, drag interactions
19. Design Assistant — token limits, effort gating, conversation persistence
20. ELL scaffolding tiers — correct content shown per tier level

**Teacher Dashboard:**
21. Class overview — student list, progress tracking
22. Progress grid — completion status per student per page
23. Grading — criterion scores input and save (if UI exists)
24. Due dates — setting and displaying

**Admin & Config:**
25. AI Model Config panel — model testing, emphasis dials, config history
26. Test Sandbox — both modes (unit skeleton + single lesson generation)
27. Framework selector with dynamic criteria toggles
28. BYOK key encryption/decryption (AES-256-GCM)

**LMS & Auth:**
29. LTI 1.0a SSO flow (Canvas, Blackboard, Google Classroom)
30. Student token sessions — creation, TTL, expiry handling
31. RLS policies — students can't access other students' data
32. Cookie security — HttpOnly, Secure, SameSite flags

**Edge Cases & Error Handling:**
33. AI provider fallback chain — Anthropic → Groq → Gemini
34. Self-healing validation — invalid AI output defaults gracefully
35. Large file uploads — what happens with a 50MB PDF?
36. Concurrent users — multiple students submitting responses simultaneously
37. Network interruption during AI generation — graceful recovery?

---

## Priority Ranking for Next Work Sessions

### Tier 1 — Do Before Bulk Upload (~5-8 hours)
1. Prompt snapshot tests (protect AI output quality)
2. Upload pipeline integration test (protect knowledge base integrity)
3. Rate limiting on design assistant (protect API credits)
4. Fix skeleton→approaches flicker bug in wizard

### Tier 2 — High-Impact Features (~2-3 weeks)
5. Lesson timing visualization in unit editor
6. Teacher Review UI for uploaded lessons (analysis display + suggestions)
7. AI marking/comment suggestions (agentic assessment)
8. Keyword chip selection UX in wizard
9. Fun thinking messages during AI generation

### Tier 3 — New Features Worth Designing (~1 month+)
10. Feature flag system (PostHog or custom)
11. Teacher projector/present mode
12. Feedback Station activity type
13. Source restriction flags for knowledge base (plagiarism protection)
14. Free public activities for conversion funnel
15. Kahoot-style quiz activity cards (self-paced first)

### Tier 4 — Strategic / Long-term
16. VEX/Robotics curriculum profile
17. Backward design algorithm for Vibe Unit Planning
18. Cartoon character advisor (Design Assistant skin)
19. Hardware packs business model exploration
20. Makloom (consumer version) code extraction
