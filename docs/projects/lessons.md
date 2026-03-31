# Project: Student Lesson Content UX
**Created: 31 March 2026**
**Last updated: 31 March 2026**
**Status: Planning — audit complete, ready to build**

---

## What This Is

A UX overhaul of the student lesson experience — how content is displayed, how multimedia works, how toolkit tools integrate inline, and the overall feel of moving through a lesson. The goal: make each lesson feel like a polished learning experience, not a form to fill in.

---

## Why Now

The student lesson page (`/unit/[unitId]/[pageId]/page.tsx`) is functional but utilitarian. It renders content in a linear stack: context block → activity prompts → response inputs → complete button. There's no visual rhythm, no breathing room between sections, no multimedia richness beyond basic image/video embeds. With 27 toolkit tools now embeddable inline, the lesson page needs to handle diverse content gracefully — a brainstorming tool followed by a video followed by a written reflection should feel like a coherent experience, not three unrelated widgets stacked vertically.

---

## Current State

### What Works Well
- **11 response types** — text, upload, voice, link, multi, decision-matrix, pmi, pairwise, trade-off-sliders, toolkit-tool, canvas
- **27 toolkit tools** embedded inline via `ToolkitResponseInput.tsx` with code-splitting
- **Auto-save** (2s debounce) with subtle save indicator
- **ELL scaffolding** — sentence starters (ELL 1-2), extension prompts (ELL 3), vocabulary warmup
- **Academic integrity monitoring** — MonitoredTextarea silently tracks writing behavior
- **Text-to-speech** on learning goals and prompts
- **Portfolio auto-capture** on flagged activities
- **Sticky top nav** with Dashboard button, page counter
- **NM Competency Pulse** self-assessment above completion button
- **Design Assistant** chat widget (bottom-right)
- **Activity tracking** (Dimensions Phase 3) — per-activity time_spent, attempt_number, effort_signals

### What Needs Work

**Content Display:**
- Text content is plain paragraphs with no typographic hierarchy or visual interest
- No support for callout boxes, tips, warnings, key concept highlights
- No expandable/collapsible content sections (accordion)
- No step-by-step instruction blocks with numbered visual steps
- Learning goals render as a colored box but nothing else has visual distinction
- Long text walls with no visual breaks

**Multimedia:**
- Video is basic iframe embed (YouTube/Vimeo) — no playback controls, no chapters, no timestamps
- No native video upload/hosting (teacher must use YouTube/Vimeo links)
- No audio content blocks (teacher-recorded explanations, podcasts)
- No image galleries or lightbox for multiple images
- No embedded PDFs or document viewers
- No interactive diagrams or annotatable images
- No 3D model viewer (relevant for Design/Technology)

**Activity Flow:**
- All activities render the same way regardless of type — no visual differentiation between a quick check-in and a major assessment piece
- No visual weight indicators matching Dimensions timeWeight (quick activities should feel lighter)
- No transition animations between activities
- No progress indicator within a lesson (which activities done, which remaining)
- Toolkit tools render inline but feel disconnected from surrounding content
- No "content-only" blocks that are visually distinct from response-required blocks

**Navigation & Flow:**
- Linear-only progression — no branching based on responses
- No "estimated time remaining" for the lesson
- No activity-level bookmarking or "come back to this"
- No peer content visibility (seeing classmates' ideas for inspiration)
- Mobile bottom nav exists but lesson content isn't optimized for mobile reading

**Teacher Content Authoring (Lesson Editor side):**
- Limited rich text support — prompts are plain text, no markdown rendering for students
- No content block types beyond text + image + video + link
- No drag-and-drop media uploads in editor
- No content preview ("see as student")

---

## Architecture Vision

### Content Block System

Replace the current "prompt string + optional media" model with a richer content block system:

```typescript
type ContentBlock =
  | { type: "text"; content: string; style?: "default" | "callout" | "tip" | "warning" | "key-concept" }
  | { type: "heading"; content: string; level: 2 | 3 }
  | { type: "image"; url: string; caption?: string; alt: string; size?: "small" | "medium" | "full" }
  | { type: "video"; url: string; caption?: string; startTime?: number }
  | { type: "audio"; url: string; caption?: string }
  | { type: "gallery"; images: { url: string; caption?: string; alt: string }[] }
  | { type: "steps"; steps: { title: string; content: string; image?: string }[] }
  | { type: "accordion"; items: { title: string; content: string }[] }
  | { type: "divider"; style?: "simple" | "wave" | "dots" }
  | { type: "embed"; url: string; height?: number }  // generic iframe embed
```

**Key constraint:** Content blocks are authored in the lesson editor (Phase 0.5) and stored in `content_data` JSONB. They must be backward compatible — existing `prompt: string` activities render exactly as today.

### Visual Weight System

Activities should visually reflect their Dimensions metadata:

| timeWeight | Visual Treatment |
|-----------|-----------------|
| `quick` | Compact card, subtle border, smaller prompt text, no breathing room |
| `moderate` | Standard card with padding, normal text, section divider above |
| `extended` | Full-width card with generous padding, larger prompt, "main event" visual emphasis |
| `flexible` | Standard card with clock icon indicating student-paced |

Summative assessment activities (from grading project) get additional visual emphasis: colored left border + "Assessment" badge.

### Lesson Flow Improvements

- **In-lesson progress bar** — dots or mini-bar showing activities completed vs remaining
- **Activity transitions** — subtle fade/slide between sections instead of static stack
- **Content-only detection** — activities with no responseType render as pure content blocks (no input area, no "submit" affordance)
- **Estimated time** — computed from activity timeWeights + class velocity data, shown in lesson header
- **Bookmarking** — student can flag an activity to revisit (saved in student_progress, shown on dashboard)

---

## Implementation Phases

### Phase 1: Visual Polish & Content Styling (~2 days)
- [ ] Style activity cards based on timeWeight (compact/standard/generous layouts)
- [ ] Add visual distinction for content-only blocks (no response) vs response-required
- [ ] Render prompts as markdown (bold, italic, lists, links) instead of plain text
- [ ] Add callout/tip/warning/key-concept styled text blocks
- [ ] Add section dividers between Workshop Model phases
- [ ] Improve image display (lightbox on click, proper captions, responsive sizing)
- [ ] Add activity-level progress indicator (dots in sticky nav)

### Phase 2: Rich Content Blocks (~3 days)
- [ ] Content block type system (text, heading, image, video, audio, gallery, steps, accordion)
- [ ] Lesson editor: block picker for content sections (not just prompt textarea)
- [ ] Image gallery component with lightbox viewer
- [ ] Step-by-step instruction renderer (numbered visual steps)
- [ ] Accordion/collapsible sections for reference material
- [ ] Backward compatibility: existing `prompt: string` auto-wrapped as `[{ type: "text", content: prompt }]`

### Phase 3: Multimedia Enhancement (~2 days)
- [ ] Video player upgrade: custom controls, playback speed, timestamp links
- [ ] Audio content blocks (teacher-recorded explanations)
- [ ] Teacher media upload in lesson editor (drag-and-drop images/audio to Supabase Storage)
- [ ] Embedded PDF viewer for reference documents
- [ ] Image annotation overlay (student can mark up images)

### Phase 4: Flow & Navigation (~2 days)
- [ ] Estimated time remaining in lesson header (from timeWeight + velocity data)
- [ ] Activity bookmarking ("come back to this")
- [ ] Subtle entrance animations for activities as student scrolls
- [ ] Content preview in lesson editor ("View as student" toggle)
- [ ] Mobile reading optimization (font size, spacing, swipe gestures)

### Phase 5: Advanced Content (~2 days, future)
- [ ] Branching content (show different activities based on prior response)
- [ ] Peer inspiration panel (anonymized classmate responses for reference)
- [ ] 3D model viewer (relevant for Design/Technology curriculum)
- [ ] Interactive diagram annotation
- [ ] Timer/countdown for timed activities

---

## Estimated Effort

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|-------------|
| 1 | Visual polish & styling | ~2 days | Dimensions Phase 4 (DONE) |
| 2 | Rich content blocks | ~3 days | Phase 1 |
| 3 | Multimedia enhancement | ~2 days | Phase 2 |
| 4 | Flow & navigation | ~2 days | Phase 1 |
| 5 | Advanced content | ~2 days | Phases 1-4, velocity data |
| **Total** | | **~11 days** | |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content block storage | **Array of ContentBlock in activity `content_blocks` field** | Keeps backward compat (`prompt` still works, `content_blocks` is optional upgrade). Forks with unit content. |
| Markdown rendering | **Yes, in student view** | Teachers already write markdown-ish prompts (bold with \*\*, lists). Rendering it properly costs nothing and looks much better. Use a lightweight renderer (no full MDX). |
| Media hosting | **Supabase Storage** | Already used for voice recordings and uploads. Add teacher upload endpoint with size limits (10MB images, 100MB video). |
| Video player | **Custom wrapper around native `<video>` for hosted, iframe for YouTube/Vimeo** | YouTube/Vimeo iframes can't be customized. For teacher-uploaded video, use native player with controls. |
| Visual weight | **CSS-only, no additional data** | timeWeight already exists on activities. CSS classes derive from it — no new fields needed. |
| Backward compatibility | **Mandatory** | Every existing lesson must render exactly as it does today. New features are opt-in additions to content_data. |

---

## Design Principles

1. **Content first, chrome second** — the lesson content should dominate the screen. Navigation, tools, and UI elements are secondary.
2. **Visual rhythm** — alternate between content consumption (reading, watching) and active response (writing, creating). Never stack 5 text prompts in a row without visual breaks.
3. **Respect timeWeight** — a quick check-in should LOOK quick. An extended project activity should FEEL substantial. The visual weight matches the cognitive weight.
4. **Mobile is a first-class citizen** — many students use tablets in class. Every content block must be readable and usable on a 10" screen.
5. **Progressive enhancement** — new content block types add richness but the lesson works without them. A lesson with just text prompts and text responses is still a complete lesson.

---

## Related Files

- `src/app/(student)/unit/[unitId]/[pageId]/page.tsx` — Main student lesson page
- `src/components/student/ResponseInput.tsx` — Response type router (11 types)
- `src/components/student/ToolkitResponseInput.tsx` — 27 toolkit tool embedder
- `src/components/student/MonitoredTextarea.tsx` — Integrity-tracked textarea
- `src/components/student/ActivityCard.tsx` — Activity renderer
- `src/hooks/usePageData.ts` — Lesson data fetcher
- `src/hooks/usePageResponses.ts` — Response state + auto-save
- `src/hooks/useActivityTracking.ts` — Per-activity engagement tracking
- `src/components/teacher/lesson-editor/ActivityBlock.tsx` — Editor side (author content)
- `src/types/index.ts` — ActivitySection, PageContent, ResponseType
