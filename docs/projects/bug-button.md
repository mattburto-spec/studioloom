# Bug Button — In-App Issue Reporting

**Status:** PLANNING (Phase 2-3)
**Estimate:** 2-3 days
**Effort:** Low-Medium

## What is it

A floating button (🐛 icon, bottom-right corner) visible on all student and teacher pages. Click → modal pops up with auto-captured context:
- **Current page:** URL + route name (e.g., "/student/unit/[unitId]/lesson/page-2")
- **User info:** ID, type (student/teacher), class context
- **Browser:** OS, browser name, version, screen size
- **Timestamp:** When reported
- **Screenshot:** Optional (ask permission, don't auto-capture)
- **Console errors:** Last 5 JS errors from browser console (if any)
- **Description:** Free-text field for reporter to describe what went wrong
- **Severity:** Radio buttons (minor | moderate | major)

Data stored in `bug_reports` table. Admin gets dashboard view: list of reports, priority sort, drill-in to inspect context, workflow states (New → Investigating → Fixed → Closed).

Reporter can opt-in to get status updates: "We're looking into this" email, "Fixed in latest version" email on next login.

## Why it matters

**Quality signal:** Teachers/students find real bugs. Platform team discovers edge cases and UX friction that would take weeks to find through dogfooding.

**Speed:** No "email support" latency. Click a button, boom — we have all the data. Better than a Slack screenshot or vague email.

**Trust:** "We listen to users" → school adoption signal. Shows the team is responsive.

**Already referenced:** Dimensions3 spec Section 14.7 mentions bug reporting system. Low-hanging fruit to implement.

## What already exists

- **Admin panel** (partial): `/admin` exists but is minimal. Can expand it with bug report dashboard.
- **Console error collection:** Some routes log to Sentry already. Could extend to client-side console logs.
- **User context:** `user.id`, `user.type` (student/teacher) available in most pages via hooks.
- **Browser APIs:** Navigator API for OS/browser info, Screenshot API (Chrome), Console API for error capture.

## Architecture

**Data model:**
- `bug_reports` table:
  - id (uuid)
  - reporter_id (student_id or teacher_id, or null for anonymous)
  - reporter_type ('student' | 'teacher')
  - url (pathname, e.g., "/student/unit/...")
  - description (text, max 2000 chars)
  - severity ('minor' | 'moderate' | 'major')
  - status ('new' | 'investigating' | 'fixed' | 'closed') default 'new'
  - context JSONB: `{ browser: { os, name, version }, screen: { width, height }, console_errors: [...] }`
  - screenshot_data (bytea or URL to image storage, optional)
  - admin_notes (text, populated by support team)
  - created_at, updated_at
  - resolved_at (nullable, when status changes to 'fixed'/'closed')
  - RLS: reporters can view their own reports; admins (is_admin flag) can view all

**Client component (BugButton.tsx):**
- Floats in bottom-right, z-index 50 (above most page content, below modals)
- Opens modal on click → form with description + severity selector + optional screenshot
- Auto-populates context fields (read-only display, gray text)
- "Send Report" button → POST to `/api/bug-reports`, shows "Sent!" toast on success
- "Include optional info?" checkbox to capture screenshot + console logs (explicit consent, not auto)
- Mounted on all student/teacher layout roots

**API routes:**
- `POST /api/bug-reports` — create report (can be anonymous or authenticated)
- `GET /api/bug-reports` — admin list view with filters (status, severity, date range, reporter type)
- `GET /api/bug-reports/[id]` — admin detail view (inspect context, add notes, change status)
- `PATCH /api/bug-reports/[id]` — admin update status/notes
- `DELETE /api/bug-reports/[id]` — admin hard delete (rare; usually mark as 'closed' instead)
- `GET /api/bug-reports/reporter/[reporterId]` — reporter can see their own reports

**Admin UI (new dashboard tab or page):**
- `/admin/bug-reports` — list view with columns: severity (color-coded), description (preview), status, created_at, reporter_id
- Filter buttons: New/Investigating/Fixed/Closed, severity radio buttons, date picker
- Click row → detail modal: full description, context JSONB, screenshot (zoomable), admin notes textarea, status dropdown
- "Mark as Fixed" / "Mark as Closed" buttons
- Search box for description text (keyword match)

**Optional Phase 2:**
- Auto-notify reporter on status change (1 email when "fixed", optional)
- Aggregate analytics (most common bugs, severity distribution, resolution time)
- Public bug status page (what we're working on) — builds trust

## Context capture implementation

```typescript
// In BugButton.tsx
const captureContext = async (includeScreenshot = false, includeConsole = false) => {
  const context = {
    browser: {
      os: navigator.userAgent.match(/Win|Mac|Linux/)?.[0],
      name: detectBrowser(), // helper: detects Chrome/Safari/Firefox
      version: navigator.userAgent.match(/Version\/[\d.]+/)?.[0],
    },
    screen: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    timestamp: new Date().toISOString(),
    url: window.location.pathname,
    referrer: document.referrer,
  };

  if (includeConsole) {
    context.console_errors = window.__CONSOLE_ERRORS__ || []; // Sentry-style capture
  }

  if (includeScreenshot) {
    const canvas = await html2canvas(document.body, {
      backgroundColor: '#fff',
      scale: 0.5, // Keep small for storage
    });
    context.screenshot_data = canvas.toDataURL('image/jpeg', 0.6);
  }

  return context;
};
```

## Connection to existing systems

- **User authentication:** `requireStudentAuth` + `requireTeacherAuth` so we know who reported the bug.
- **Sentry integration:** Console errors can feed from existing Sentry setup (or replace it for JS errors).
- **Admin panel:** Extends `/admin` with new dashboard tab.
- **Email notification (optional):** Uses existing email infrastructure (Resend/SendGrid).

## Relationship to Dimensions3

Not part of Dimensions3 pipeline. A **Quality Assurance Layer**: Dimensions3 generates content, Bug Button ensures the platform works smoothly while that content is being used. Orthogonal concern. Could be built in parallel with Dimensions3 Phases A-B (foundation work).

## Build phases

**Phase 1 (1-2 days):** Data model + BugButton component + POST/GET admin API + basic admin list view + context capture (no screenshot/console)
**Phase 2 (1 day):** Screenshot capture + console error logging + detail modal + status/notes editing
**Phase 3 (optional):** Reporter notifications + analytics dashboard + public status page

## Success metrics

- Bug reports per week (signal of platform use + discovery of issues)
- Average resolution time (should be <1 week for "moderate" bugs)
- Unique reporters (sign of trust in the reporting channel)
- Bug report quality (how useful is the context; admin satisfaction)

## Privacy & consent

- **Anonymous reporting:** Allowed (reporter_id = null)
- **Screenshot:** Explicit checkbox "Include screenshot?" before capture
- **Console logs:** Explicit checkbox "Include browser info?" before capture
- **PII scanning (future Phase 2):** Before storing, scan description for emails/phone numbers and redact them
- **Data retention:** Delete reports after 12 months (or per school data retention policy)

## Notes

- **Severity levels:** Minor = typo, unclear label; Moderate = feature doesn't work as expected, students can't proceed; Major = data loss, security issue, platform crash
- **Button icon:** 🐛 emoji is friendly. Alternative: custom SVG bug icon in brand purple.
- **Floating position:** Test on mobile — FAB shouldn't overlap action buttons on lesson pages. Use `bottom: safe() + 1rem` (CSS safe-area-inset).
- **Rate limiting:** Prevent spam: 10 reports per user per day max. Show "Thanks for the report! We've got a few from you already — no need to send more duplicates."
- **Admin workflow:** Triage reports daily. Mark "Fixed" when code is deployed. Bulk-mark "Closed" weekly for ones that can't be reproduced or are feature requests (suggest parent Slack channel for those).

## Implementation notes

- Console error capture: Listen to `window.addEventListener('error', ...)` + `window.addEventListener('unhandledrejection', ...)`. Store in `window.__CONSOLE_ERRORS__` (max 5 most recent).
- Screenshot library: Use `html2canvas` (free, no API key), NOT Sentry's proprietary screenshot (Sentry would need to be upgraded).
- Browser detection: Lightweight `navigator.userAgent` parsing; don't over-complicate.
- Mobile-friendly: Modal should be full-height on mobile, centered drawer layout (Chakra's `useDisclosure` + `Drawer` component or React Native modal equivalent).
