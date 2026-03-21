# Class Gallery & Peer Review — Feature Spec
**Author:** Matt Burton + Claude | **Date:** 21 March 2026 | **Status:** Draft

---

## Problem Statement

Design education thrives on critique — sharing work-in-progress and getting structured feedback from peers. Currently in StudioLoom, student work lives in isolated silos. A student completes a portfolio page, a toolkit session, or an activity, and nobody sees it except the teacher during grading. There's no mechanism for students to share work with classmates, give each other structured feedback, or learn from what others are doing.

This is a missed opportunity. In real design studios, pin-up crits are a core practice: students put work on the wall, the class walks around, and everyone gives feedback using structured protocols. IB MYP explicitly expects peer feedback as part of the design cycle. Teachers already do this physically — StudioLoom should make it digital, structured, and trackable.

## The Idea

A student selects a piece of work from their portfolio and sends it to a **Class Gallery** — a shared space where all classmates can browse submissions. The teacher can optionally require structured feedback using a toolkit tool (PMI, Six Hats, or a simple comment form). Students cycle through submissions and provide feedback. The teacher sees a dashboard of who has submitted, who has reviewed, and the quality of feedback given.

## Goals

1. **Students can share portfolio work to a class gallery** — one-click "Share to Class" from any portfolio item or completed page
2. **Classmates can browse and review shared work** — carousel or grid view, one submission at a time
3. **Teachers can require structured feedback** — attach a toolkit tool (PMI, comment form, or custom) as the review format
4. **Minimum review requirements** — teacher sets a minimum number of reviews per student (e.g., "review at least 3 classmates' work")
5. **Teacher dashboard shows completion** — who submitted, who reviewed, who hasn't, feedback quality indicators
6. **Feedback flows back to the original student** — the person who shared sees all peer feedback on their work
7. **Everything is anonymous or named** — teacher controls whether reviewers' names are visible to the author

## Non-Goals

- **Real-time collaborative editing** — this is async review, not Google Docs-style co-editing
- **Voting or ranking submissions** — no "best design" competitions. MYP is criterion-referenced, not competitive
- **Teacher grading of peer reviews** — reviews aren't graded, but completion is tracked
- **Cross-class galleries** — reviews are within a single class, not across classes
- **Video/audio feedback** — text and structured tool responses only for v1

---

## User Flows

### Flow 1: Teacher Creates a Gallery Round

1. Teacher is on the unit detail page or teaching dashboard
2. Clicks "New Gallery Round" (or "Pin-Up Crit")
3. Selects which unit page(s) students should share work from
4. Chooses review format:
   - **Quick Comment** — free-text with optional sentence starters
   - **PMI** — structured Plus/Minus/Interesting per submission
   - **Two Stars & a Wish** — 2 positive observations + 1 suggestion
   - **Custom toolkit tool** — any interactive tool (Six Hats on someone else's design, etc.)
5. Sets minimum reviews required (default: 3)
6. Sets visibility: anonymous reviews or named
7. Sets deadline (optional)
8. Publishes — students see a notification on their dashboard

### Flow 2: Student Submits to Gallery

1. Student sees "Gallery Round: Share your [page name] work" on their dashboard or unit page
2. Clicks "Share to Gallery" — their completed work (text responses, uploaded images, toolkit outputs) is bundled into a submission
3. Student can add a short context note ("I'm stuck on the handle design" or "Feedback on my colour choices please")
4. Submission appears in the class gallery

### Flow 3: Student Reviews Peers

1. Student opens the Gallery (from dashboard notification or unit page)
2. Sees a carousel of classmate submissions (their own excluded)
3. For each submission:
   - Views the shared work (text, images, toolkit outputs rendered inline)
   - Completes the required review format (PMI, comment, etc.)
   - Submits review — cannot skip to next without completing
4. Progress indicator: "3/3 reviews completed" (or "2/5" if teacher set 5)
5. After hitting minimum, student can optionally review more
6. Student can see reviews RECEIVED on their own submission only after completing their minimum reviews (effort-gate)

### Flow 4: Teacher Monitors

1. Teacher sees Gallery Round on their dashboard or teaching cockpit
2. Dashboard shows:
   - Submission count: 18/24 students submitted
   - Review completion: 15/24 students completed minimum reviews
   - Per-student row: submitted (yes/no), reviews given (count), reviews received (count)
   - Students who haven't submitted or reviewed are highlighted
3. Teacher can click into any submission to see all peer reviews
4. Teacher can close the round (no more submissions/reviews)

---

## Data Model

### `gallery_rounds` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| unit_id | text | Which unit this gallery is for |
| class_id | text | Which class |
| teacher_id | uuid | Creator |
| title | text | e.g., "Criterion B Pin-Up: Share your design ideas" |
| page_ids | text[] | Which unit pages are included in submissions |
| review_format | text | 'comment', 'pmi', 'two-stars-wish', or a tool_id |
| min_reviews | int | Minimum reviews required per student (default 3) |
| anonymous | boolean | Whether reviewer names are hidden from authors |
| status | text | 'open', 'closed' |
| deadline | timestamptz | Optional deadline |
| created_at | timestamptz | |

### `gallery_submissions` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| round_id | uuid | FK to gallery_rounds |
| student_id | text | Who submitted |
| context_note | text | Optional student note requesting specific feedback |
| content | jsonb | Snapshot of their work (responses, images, tool outputs) |
| created_at | timestamptz | |

### `gallery_reviews` table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| submission_id | uuid | FK to gallery_submissions |
| reviewer_id | text | Student who reviewed |
| review_data | jsonb | The review content (comment text, PMI data, tool session state) |
| created_at | timestamptz | |

RLS policies: students can read submissions in their class's open rounds, can only create reviews (not edit/delete), can only see reviews on their own submission after completing min_reviews.

---

## Key Design Decisions

### Effort-gating on receiving feedback
Students must complete their minimum reviews BEFORE they can see feedback on their own work. This prevents the "submit and immediately check what people said about me" loop. Forces genuine engagement with peers' work first. Same pattern as toolkit effort-gating.

### Submission is a snapshot, not a live link
When a student submits to the gallery, their work is snapshotted into the `content` JSONB column. If they later edit their original response, the gallery version stays as-is. This prevents confusion during review and gives an honest record of what was reviewed.

### Review format is flexible
The `review_format` field can be a simple string ('comment', 'pmi', 'two-stars-wish') or a toolkit tool_id ('six-thinking-hats', 'swot-analysis'). When it's a tool_id, the review interface renders the full interactive toolkit tool with the peer's submission as the "challenge" context. This means any toolkit tool can become a peer review format.

### No ranking, no voting
Deliberately excluded. MYP is criterion-referenced — students assess against criteria, not against each other. A "best design" vote would undermine the pedagogical model. The gallery is for giving and receiving constructive feedback, not competition.

### Anonymous by default for younger students
Teacher controls the `anonymous` flag. Recommendation: anonymous for Year 7-8 (ages 12-13) where social dynamics are intense, named for Year 9-10+ where students benefit from learning to give signed feedback professionally.

### Teacher can see everything
Even in anonymous mode, the teacher can see who wrote each review. This is for safeguarding — teachers need to intervene if reviews are inappropriate or unconstructive.

---

## UI Components

### `GalleryRoundCard` (teacher dashboard)
Summary card showing: title, submission count, review completion, deadline, status pill. Click to expand into full monitoring view.

### `GallerySubmitPrompt` (student dashboard / unit page)
Banner or card prompting the student to share their work. Shows which page(s) to submit, context note input, "Share to Gallery" button.

### `GalleryBrowser` (student view)
Carousel or card-based view of peer submissions. Renders the submitted content (text, images, toolkit outputs). Below each submission: the review form (comment box, PMI tool, etc.). Progress indicator for reviews completed.

### `GalleryFeedbackView` (student — own submission)
Shows all peer reviews received on the student's submission. Locked until min_reviews completed. Reviews are rendered in the format they were given (PMI columns, comment cards, etc.).

### `GalleryMonitor` (teacher view)
Per-student grid: submitted? reviews given? reviews received? Highlight students who haven't engaged. Click into any submission to see all reviews. Bulk actions: remind students, close round.

---

## Integration Points

- **Portfolio**: "Share to Gallery" button appears on completed portfolio items and unit page responses
- **Toolkit**: any toolkit tool can be used as a review format — the tool receives the peer's submission as context
- **Teaching Mode**: gallery round status visible in the teaching cockpit — teacher can see who's reviewing in real-time
- **Design Assistant**: AI can reference gallery feedback in mentor conversations ("Your classmates noticed X about your design — have you considered...")
- **Notifications**: students get notified when a gallery round opens and when they receive feedback

---

## Implementation Phases

### Phase 1: Core Gallery (~3 days)
- Migration: `gallery_rounds`, `gallery_submissions`, `gallery_reviews` tables + RLS
- Teacher create/manage gallery round (CRUD API + UI)
- Student submit to gallery (snapshot work, context note)
- Student browse & review (carousel + comment format only)
- Teacher monitoring dashboard (submission/review counts)

### Phase 2: Structured Review Formats (~2 days)
- PMI as review format (render PMI tool with peer's work as context)
- Two Stars & a Wish format
- Toolkit tool as review format (any tool_id)
- Review format renders inline in gallery browser

### Phase 3: Feedback Loop (~1.5 days)
- Effort-gated feedback viewing (min_reviews gate)
- Feedback view for students (all reviews on their submission)
- Notification when feedback available
- AI assistant integration (reference peer feedback in conversations)

### Phase 4: Polish (~1 day)
- Anonymous/named toggle
- Deadline enforcement
- Remind students who haven't submitted/reviewed
- Gallery round history (past rounds viewable)
- Mobile-responsive carousel

**Total estimate: ~7.5 days**

---

## Why This Matters

Pin-up crits are the single most common formative assessment activity in design classrooms worldwide. Every design teacher does some version of "put your work up, walk around, give feedback." StudioLoom making this digital, structured, and trackable is a genuine differentiator. The effort-gating (must review before seeing your own feedback) ensures quality engagement. The flexible review format (any toolkit tool) means the gallery grows more powerful as more tools are built. And the teacher dashboard showing completion at a glance solves the perennial problem of "who actually did the peer review?"

For MYP specifically: Criterion D (Evaluating) explicitly requires students to evaluate their own and others' work. This feature makes that trackable and structured rather than a vague "discuss with your partner."
