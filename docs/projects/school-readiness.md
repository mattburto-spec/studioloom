# School Readiness — Enterprise Requirements Checklist

**Status:** PLANNED
**Created:** 4 April 2026
**Priority:** Mixed — some items are pre-pilot blockers, others are pre-launch, others are scaling concerns
**Source:** Matt's school requirements analysis (4 Apr 2026)

---

## Overview

This is the definitive list of what schools need before they'll adopt StudioLoom. Organized into 3 tiers by when they're needed, with current status of each item.

---

## Tier 1: Build Before Any School Pilot

These are hard gates — without them, IT departments won't approve the platform.

### 1. Authentication & SSO
**Status:** 🟡 PARTIAL — Supabase Auth exists but only email/password + student token sessions

Google Workspace OAuth and Microsoft 365 SSO are the single biggest gate. Schools run on one or the other. If teachers and students can't sign in with their school account, adoption dies at the IT approval stage.

**What exists:**
- Supabase Auth for teachers (email/password)
- Student token sessions (nanoid(48), 7-day TTL, class code join)
- LTI 1.0a SSO (Canvas, Blackboard, Google Classroom) — built but untested in production

**What's needed:**
- Google OAuth provider configuration in Supabase
- Microsoft Azure AD / Entra ID OAuth
- Auto-provision teacher accounts on first SSO login
- Student SSO flow (Google Classroom roster → auto-create student accounts)
- Class rostering from Google Classroom or CSV import (not just manual entry)

**Estimate:** ~3-4 days (Google OAuth ~1d, Microsoft ~1d, roster sync ~2d)

### 2. Role-Based Access Control (RBAC)
**Status:** 🟡 PARTIAL — 3 roles exist (admin/teacher/student), parent role missing

Four roles minimum: admin, teacher, student, parent/visitor. Each sees a different platform. This isn't just UI hiding — it's row-level security in Supabase on every table. A student should never be able to query another student's data even if they inspect network requests.

**What exists:**
- Teacher dashboard (full access to own classes/units)
- Student experience (scoped to enrolled classes)
- Admin page (`/admin`) with AI controls
- RLS policies on most tables (but audit needed for completeness)

**What's needed:**
- Parent role (read-only view of child's work — see Phase 5.5 Parent Portal)
- `is_admin` flag enforcement across all admin routes
- Comprehensive RLS audit (ensure every table has policies, no student can query another's data)
- Role column on a shared `users` table or role derivation from Supabase Auth metadata

**Estimate:** ~2-3 days (RLS audit ~1d, parent role stub ~1d, admin hardening ~1d)

### 3. Multi-Tenancy / School Isolation
**Status:** 🔴 NOT BUILT — no `school_id` on tables

Every row in the database needs a `school_id`. School A's data is completely invisible to School B. This is non-negotiable for any school buying a SaaS product. Supabase RLS policies enforce this at the database level.

**What exists:**
- `teacher_profiles` has school-related fields (school_name, etc.)
- Single-teacher model works for solo use
- Dimensions3 §18 (Same-School Architecture) has 3 "don't accidentally prevent this" notes

**What's needed:**
- `schools` table (id, name, domain, settings JSONB, created_at)
- `school_id` FK on: teachers, students, classes, units, class_units, knowledge_items, activity_blocks, badges, gallery_rounds, discovery_sessions, etc.
- RLS policies updated to include `school_id` isolation
- School creation + teacher invitation flow
- Student uniqueness scoped to school (not global)

**Critical warning:** Retrofitting multi-tenancy is brutal. Design this into every new table from day one. Dimensions3 Phase A migration should include `school_id` on `activity_blocks`.

**Estimate:** ~5-7 days (schema migration ~2d, RLS rewrite ~2d, UI flows ~2-3d)

### 4. Class & Enrollment Management
**Status:** ✅ MOSTLY BUILT — functional but needs polish

Teachers need to create classes, add students (via code, link, CSV, or Google Classroom sync), assign units to classes, and see a roster. Students need to join via class code. This is the operational backbone.

**What exists:**
- Class creation with framework selector
- Student join via class code
- `class_students` junction table for multi-class enrollment
- Class Hub with tabs (Overview, Progress, Grade, Badges, NM, Students, Open Studio, Gallery)
- Students tab with CRUD (add/remove students to class)

**What's needed:**
- CSV import for student rosters
- Google Classroom roster sync
- Invitation links (shareable URL that auto-joins class)
- Bulk student operations (archive, move between classes)

**Estimate:** ~2-3 days (CSV import ~1d, invite links ~0.5d, bulk ops ~1d, GClassroom sync ~1d)

### 5. Basic Teacher Progress Dashboard
**Status:** ✅ BUILT — Smart Insights, progress grids, class overview

**What exists:**
- Teacher dashboard with Smart Insights panel (6 alert types, priority-sorted)
- Per-student progress grids on Class Hub
- Teaching Mode with live student status polling
- Pace feedback aggregation
- Integrity monitoring indicators

**What's still needed for school pilots:**
- Admin-level view across all teachers (see item 6 in Tier 2)
- Export of progress data (see item 7 in Tier 2)

---

## Tier 2: Build Before Paid Launch

These won't stop a pilot but will stop a purchase order.

### 6. Analytics & Reporting Dashboard
**Status:** 🟡 PARTIAL — teacher-level exists, admin-level missing

Teachers need: who's completed what, who's falling behind, class-wide progress, time spent. Admins need: teacher adoption rates, student engagement, usage trends. Schools making purchasing decisions want data proving the platform works.

**What exists:**
- Teacher dashboard (unit progress, Smart Insights)
- Teaching Mode (live student tracking)
- Pace feedback aggregation

**What's needed:**
- Admin analytics dashboard (school-wide: active teachers, active students, units in use, engagement trends)
- Per-teacher adoption metrics (for heads of department)
- Exportable reports for school leadership presentations
- Time-series data (is usage growing week over week?)

**Estimate:** ~4-5 days

### 7. Export & Portability
**Status:** 🔴 NOT BUILT

Students need portfolio export (PDF or zip). Teachers need grade/progress export (CSV). Schools need to extract all their data if they leave the platform. If schools feel locked in, they won't buy in. Also a GDPR right (data portability).

**What exists:**
- Portfolio timeline view (display only, no export)
- Grading page (display only, no export)

**What's needed:**
- Student portfolio PDF export (Behance-style narrative)
- Teacher grade CSV export (per class, per unit)
- Full school data export (admin-initiated, all tables, zip)
- Student data deletion endpoint (GDPR "right to be forgotten")

**Estimate:** ~4-5 days

### 8. Data Privacy & Compliance
**Status:** 🟡 PARTIAL — types defined, UI not built

Schools will ask "where is student data stored?" and "are you GDPR/COPPA/FERPA compliant?"

**What exists:**
- `DataPrivacySettings` type in `school.ts` covering 8 regimes
- Privacy considerations documented in design guidelines
- No Google Analytics on student-facing pages (Plausible planned)
- Content Safety & Moderation spec (Dimensions3 §17)

**What's needed:**
- Privacy policy page (public)
- Data processing agreement template (downloadable)
- Data residency clarity (Supabase region selection documented)
- Data retention policy (auto-delete after X years configurable)
- Student data deletion on request (API + admin UI)
- Cookie consent (minimal — we barely use cookies, but need the banner)
- China-specific considerations (local data laws, see CLAUDE.md notes)

**Estimate:** ~3-4 days (policy pages ~1d, deletion API ~1d, DPA template ~0.5d, retention ~1d)

### 9. Accessibility (WCAG 2.1 AA)
**Status:** 🟡 UNKNOWN — no formal audit done

International schools have inclusion policies and will audit this. Screen reader support, keyboard navigation, sufficient color contrast, alt text on images, captions on video.

**What's needed:**
- Formal WCAG 2.1 AA audit of all student-facing pages
- Keyboard navigation through all interactive elements
- Screen reader testing (VoiceOver + NVDA)
- Color contrast fixes (dark theme toolkit may have issues)
- Alt text on all images (including SVG thumbnails)
- Text fallbacks for any future 3D content (3delements spec notes this)
- Focus management in modals and slide-outs

**Estimate:** ~3-5 days (audit ~1d, fixes ~2-4d depending on findings)

### 10. Moderation System
**Status:** ✅ SPEC COMPLETE — Dimensions3 §17 + `3delements/lesson-architecture.md`

Content Safety & Moderation covers 7 content streams with 2-layer architecture (client-side blocklist + server-side AI moderation). Teacher Safety Alerts in Smart Insights. COPPA/KCSIE/eSafety/FERPA compliance. Built into Dimensions3 phases.

### 11. Notification System
**Status:** 🔴 NOT BUILT

Teachers need to know when students submit work, when someone's stuck, when moderation flags something. Students need to know when teacher gives feedback, when a new unit is assigned.

**What's needed:**
- In-app notification system (bell icon with unread count)
- Notification types: submission, feedback, moderation flag, unit assigned, badge earned, gallery round open
- Notification preferences (per type toggle)
- Email notifications (Phase 2 — complex with school email policies)

**Estimate:** ~3-4 days (in-app ~2d, email ~2d)

### 12. Audit Logging
**Status:** 🔴 NOT BUILT

Who did what, when. Teacher edited a grade, admin changed a role, student submitted work, AI generated a response. Schools need this for safeguarding compliance and dispute resolution.

**What's needed:**
- `audit_log` append-only table (actor_id, actor_role, action, entity_type, entity_id, metadata JSONB, timestamp)
- Auto-logging on grade changes, role changes, data deletion, moderation actions
- Admin viewer (filterable by actor, action, date range)
- Retention policy (keep N years, configurable per school)

**Estimate:** ~2-3 days

---

## Tier 3: Build Before Scaling

Not needed for early adopters but needed to grow past a handful of schools.

### 13. Microsoft SSO
**Status:** 🔴 NOT BUILT
Google OAuth covers ~60% of international schools. Microsoft covers the rest. ~1 day once Google OAuth pattern exists.

### 14. Google Classroom Sync
**Status:** 🔴 NOT BUILT
Auto-import class rosters, sync assignments, push grades back. Google Classroom API integration. ~2-3 days.

### 15. Admin Analytics (School-Wide)
**Status:** 🔴 NOT BUILT
Head of department / principal view. Teacher adoption rates, student engagement trends, usage across departments. ~3-4 days.

### 16. Offline Resilience
**Status:** 🔴 NOT BUILT
School WiFi drops out. Save draft work locally, sync when connection returns, show clear "you're offline" states. Service workers can cache lesson content. ~3-4 days.

### 17. Backup & Recovery Documentation
**Status:** 🟡 PARTIAL — Supabase handles DB backups
Need documented recovery procedure, point-in-time restore capability, and answers for procurement questionnaires. ~0.5 days (documentation only).

---

## Framework Versioning & Evolution

**Critical consideration:** MYP criteria change. GCSE specifications get rewritten. A-Level content updates. ACARA reviews happen. Every curriculum framework StudioLoom supports WILL be revised at some point.

**What this means for the platform:**
- Framework definitions (criteria names, assessment scales, phase labels, command verbs) cannot be hardcoded constants that require a code deploy to update
- Need a `framework_versions` table or versioned JSONB: `{ "IB_MYP": { "version": "2025", "criteria": [...] } }`
- When a framework updates, existing units created under the old version must continue to work (don't break historical data)
- Teachers need to see which framework version their class uses
- Admin needs to activate new framework versions and migrate classes
- The FrameworkAdapter (Dimensions3 §7) already maps neutral → framework-specific at render time — this is the right architecture. The adapter just needs to support multiple versions of each framework
- Curriculum context dropdown in wizard (preset options per type) needs to be data-driven, not hardcoded

**Implications for Dimensions3:**
- `activity_blocks` should NOT store framework-specific vocabulary (already decided — blocks are neutral)
- FrameworkAdapter mapping tables should be stored in DB (not TypeScript constants) so they can be updated without deploy
- Block efficacy scores should be framework-version-aware (a block that works great under MYP 2025 criteria may need adjustment for MYP 2028)

**Timeline:** Not urgent for pilot (current framework versions are stable). Must be solved before scaling to multiple schools on different framework versions. ~2-3 days to make framework definitions data-driven. Include as consideration in Dimensions3 Phase A.

---

## Priority Summary

| Priority | Items | Estimate |
|----------|-------|----------|
| **Pre-Pilot** | SSO (Google), RBAC audit, school_id multi-tenancy, class management polish | ~12-17 days |
| **Pre-Launch** | Export, privacy/compliance, accessibility audit, notifications, audit logging | ~15-21 days |
| **Pre-Scale** | Microsoft SSO, GClassroom sync, admin analytics, offline, backup docs | ~10-12 days |
| **Total** | All school readiness items | ~37-50 days |

**Note:** Many of these overlap with existing roadmap items (Parent Portal, Data Privacy UI, Admin Dashboard). The value of this checklist is having them in one place with clear "when do we need this?" tiers.

---

## Cross-References

- `docs/projects/dimensions3.md` §17 — Content Safety & Moderation
- `docs/projects/dimensions3.md` §18 — Same-School Architecture
- `docs/projects/parent-updates.md` — Parent Weekly Updates (Tier 2 precursor)
- `docs/projects/bug-button.md` — Bug Button (feeds into audit logging)
- `docs/projects/i18n.md` — Multi-Language Support (international school readiness)
- `docs/roadmap.md` — Trust Builders section, Phase 5.5 Parent Portal, Phase 3.5 School Identity
- `3delements/lesson-architecture.md` lines 815-974 — Content moderation 3-tier architecture
