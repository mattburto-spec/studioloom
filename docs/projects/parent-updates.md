# Parent Weekly Updates

**Status:** PLANNING (Phase 2-3)
**Estimate:** 5-7 days
**Effort:** Medium

## What is it

Automated weekly email digest sent to parents/guardians summarizing their child's progress in the class. Uses existing data (student_progress, pace feedback, portfolio snapshots, grades, toolkit engagement, safety badges) to generate a brief, encouraging report.

Example digest:
> **Design Project: Packaging Redesign** (Week of Mar 24)
>
> This week, [Student] completed 3 lessons and submitted work on materials research and prototype testing. Pace feedback shows they prefer a steady pace. Peer review went well — 2 classmates gave positive feedback. Next week: finalizing designs.
>
> **Progress:** 3 of 5 lessons complete (60%) | **Portfolio:** 8 pieces added
>
> [View portfolio] [Reply to teacher note] [Settings]

Configurable per-teacher/class:
- Frequency (weekly, bi-weekly, monthly)
- What shows (progress %, grades, badges, portfolio, peer feedback, teacher notes, safety compliance)
- Tone (formal, friendly, bilingual)
- Recipient list (parents, guardians, both)
- Privacy level (anonymous grades, no peer names, etc.)

## Why it matters

**School adoption:** Parents want visibility into what their child is doing. StudioLoom lacks a parent interface, which is a barrier to school sales. Weekly emails = low-friction trust-building without building a full parent portal.

**Engagement:** "I got an email about my kid" is powerful for parent conferences and retention.

**Feedback loop:** Parents see progress → sign off on their child's learning → teacher gets family buy-in → better student outcomes.

**Precursor to Parent Portal:** Proves the data pipeline + template rendering. Parent Portal (Phase 5.5 in roadmap) adds login access, message replies, achievement certificates, etc. Emails are the MVP.

## What already exists

- **Student progress tracking** (student_progress, student_responses, planning_tasks): Raw data exists, just needs aggregation.
- **Pace feedback** (lesson_feedback table): Teachers or students rate pace (slow/just right/fast).
- **Portfolio system**: Auto-captures responses + reflections + snapshot data.
- **Class Gallery + peer review** (gallery_rounds, gallery_reviews): Peer feedback exists.
- **New Metrics / Melbourne Metrics** (competency_assessments): Self-assessment + teacher observations.
- **Safety badge system** (student_badges): Badges earned/granted tracked.
- **Email infrastructure:** Vercel Functions + Resend or SendGrid (TBD).
- **Teacher locale settings**: Teachers have `email_frequency`, `email_tone`, etc. (future column on teachers table).

## Architecture

**Data model:**
- `parent_email_settings` table: teacher_id, class_id, enabled, frequency (weekly|bi_weekly|monthly), tone (formal|friendly), include_grades, include_peer_feedback, include_badges, include_portfolio, language, timezone, created_at, updated_at
- `parent_email_log` table: id, teacher_id, class_id, student_id, sent_at, recipient_email, delivery_status (queued|sent|bounced|complained), digest_data JSONB (what was included, for resend if bounced)

**Email generation pipeline (Vercel Cron):**
1. **Scheduled job** (weekly at 4pm teacher's timezone): Query `parent_email_settings` for enabled classes
2. **Aggregation** per (student, class, week):
   - `student_progress` count + completion % this week
   - `lesson_feedback` avg pace rating
   - `student_responses` count + average response length (effort signal)
   - `gallery_reviews` count + summary of feedback received
   - `student_badges` earned this week
   - `competency_assessments` recent teacher observations
   - `planning_tasks` completion status
3. **Template render:** Jinja2 or React Server Components to generate HTML email with narrative ("This week, [Student] did...") + data cards + action buttons
4. **Privacy filter:** Teacher settings control what appears (e.g., if `include_grades=false`, omit % complete)
5. **Send:** Resend/SendGrid API with proper error handling, retry queue

**API routes:**
- `POST /api/teacher/parent-email-settings` — update email preferences per class
- `GET /api/teacher/parent-emails` — admin view of sent emails + delivery status + resend
- `POST /api/email/send-test` — send test digest to teacher's own email before enabling
- `GET /api/parent/email/[digestToken]` — view digest in browser (token-based, no login required)
- `POST /api/parent/email/[digestToken]/unsubscribe` — one-click unsubscribe per class (updates parent_email_settings.enabled)

**Student-side:**
- Digest mentions the student's portfolio: "View your progress" button links to `/student/portfolio` or snapshot view
- Teacher note (optional one-liner per week) included in digest, e.g., "Keep up your momentum!"

## Connection to existing systems

- **Student progress table** (data source): All unit + lesson completion, time spent, responses
- **Planning tasks** (data source): What's due next, what's completed
- **Portfolio system** (data source): Recent pieces added, counts per week
- **Pace feedback** (data source): How fast/slow the unit is feeling
- **New Metrics** (data source): Teacher observations + student self-assessment
- **Class Gallery** (data source): Peer feedback received this week
- **Safety badges** (data source): Badges earned, tests passed
- **Parent Portal (Phase 5.5)** (future): Portal will allow parents to reply to emails, see full portfolio, update preferences, view detailed analytics. Emails are the MVP that proves demand.

## Relationship to Dimensions3

Not directly part of Dimensions3 pipeline. But **Phase F (Post-Generation Support):** Dimensions3 produces teaching/student data; Parent Updates consumes that data for stakeholder communication. Requires data aggregation layer built in parallel with Phase E (Quality Scoring). Low dependency on generation — works with current data shapes immediately.

## Build phases

**Phase 1 (2-3 days):** Data model + email template + single-format test (weekly HTML digest, English only) + test cron job via Vercel
**Phase 2 (2-3 days):** Teacher settings UI (class-level toggle, frequency, tone, what to include, recipient email list) + email log viewer + test send
**Phase 3 (1-2 days):** Localization (tone variants, bilingual templates), privacy filters, unsubscribe workflow
**Phase 4 (future):** Parent Portal (login, message replies, certificates, full analytics)

## Example email template structure

```
Subject: [Class Name] Weekly Update - [Student Name] (Mar 24-30)

Hi [Parent Name],

This week, [Student Name] made progress on the [Unit Name] project:

PROGRESS
  3 of 5 lessons completed (60%)
  Submitted work on: materials research, prototype testing
  Time spent: 4h 20m (on pace)

PEER FEEDBACK
  2 classmates reviewed your work
  "Great material choice" — Alex
  "Consider testing durability" — Jordan

NEW SKILLS EARNED
  🎖 Safety: Laser Cutter Certified

WHAT'S NEXT
  Week of Mar 31: finalize designs, prepare presentation

Questions? Reply to this email or log into [Parent Portal link] to see more details.

[Student Portfolio] [Class Calendar] [Unsubscribe]
```

## Success metrics

- Email open rate (via Resend/SendGrid tracking)
- Click-through rate to portfolio/calendar
- Parent sentiment (future survey)
- School adoption (% of classes with emails enabled)
- Reduction in "I don't know what my kid is doing" parent complaints
- Precursor metric: successful parent email → easier Parent Portal launch (parent already in email habit)

## Notes

- **No login required:** Parent just clicks email link, no password. Token-based access like Vercel preview URLs.
- **Frequency tuning:** Weekly = default. Some teachers might want monthly (parents with multiple kids). Respect teacher preference.
- **Tone matters:** Formal tone for traditional schools, friendly for progressive schools. Template string swaps vocabulary.
- **Respect privacy:** Teacher controls what appears. FERPA/GDPR compliant by design (no grades without consent, etc.).
- **Bilingual support:** Email locale pulled from teacher_profiles.locale or parent's preferred language (if collected).
- **Unsubscribe:** GDPR/CAN-SPAM requirement. One-click unsubscribe per class, stored as `parent_email_settings.enabled = false`.

## Risk

- Email deliverability: spam filters might catch them. Mitigate with DKIM/SPF setup + testing with real email providers.
- Parent expectations: Parents might reply to digest email expecting 1:1 teacher response. Needs clear "this is automated" messaging.
- Data freshness: Week-old snapshot might feel stale. Weekday delivery (Thursday/Friday) feels more timely than Monday.
