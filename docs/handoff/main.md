# Handoff — main (post S1–S7 security closure)

**Last session ended:** 2026-05-10T09:50Z
**Worktree:** `/Users/matt/CWORK/questerra`
**HEAD:** `df49623` "S7: bundle P3s — F-15, F-16, F-18, F-19, F-20"

## What just happened

- **Closed ALL 20 cowork external-review findings** (F-1..F-20) across 7 sequenced phases (S1–S7), 22 commits, 2 prod migrations applied. Brief: [`docs/projects/security-closure-2026-05-09-brief.md`](../projects/security-closure-2026-05-09-brief.md). Findings: [`docs/security/external-review-2026-05-09-findings.md`](../security/external-review-2026-05-09-findings.md). Tracking table: [`docs/security/security-plan.md`](../security/security-plan.md).
- **Migrations applied to prod:** `20260509034943_rls_hardening_external_review` (S1) + `20260510090841_fabricators_failed_login_lockout` (S6).
- **Net new code surface:** `requireTeacher` on 80 long-tail teacher routes (S3); `authorize.ts` per-bucket scoping for storage proxy (S5); fab login DUMMY_HASH timing equalize + DB-column lockout (S6); Sentry filter extended to `event.message` + `event.exception.values[*]` + breadcrumb URL UUID-segment redaction (S4 + S7); BYOK decrypt failure now logs + emits `audit_events.byok.decrypt_failed` (S7); marking-comments AI prompt has explicit "refer to writer as 'the student'" privacy rule (S7).
- **Doc-vs-code drift fixed:** CLAUDE.md + preflight-1b-2 brief now correctly say "bcryptjs" not "Argon2id" (S6/F-13); mig 025 RLS comment corrected (S7/F-18).
- **Tests 5006 → 5180** (+174 net). Scanners all clean (RLS 123/123, role-guards 198+8 allowlisted / 0 missing, audit-coverage 0 missing, AI budget 5/5).
- **Spinoff follow-ups filed** during the closure: `FU-SEC-BADGE-ASSIGN-PER-STUDENT` P2 (S3), `FU-SEC-REQUEST-ACCESS-TURNSTILE` P2 (S3), `FU-SEC-MIG-035-PUBLIC-READ-AUDIT` P3 (S1 pre-flight). Two FUs closed in flight (`FU-SEC-UNIT-IMAGES-SCOPING`, `FU-SEC-KNOWLEDGE-MEDIA-SCOPING`) via S5.

## State of working tree

- Clean post-saveme (this commit).
- Test count: 5180 passing / 11 skipped / 0 failed.
- tsc --noEmit: clean.
- Pending push count: 0 immediately after saveme commit + push.
- All security migrations applied to prod.

## Next steps

- [ ] **No pending closure work** — the cowork external-review pipeline is fully closed.
- [ ] If picking up security work next: pick from the remaining internal-audit items in `security-plan.md` tracking table — most likely candidates are P-7 CSP+HSTS (~1 day), P-8 distributed rate-limit (~2 days), or P-11 MFA route-level enforcement (~1 day). All P0-P1 from internal audit done; P2 cluster is the next tier.
- [ ] If picking up the 4 still-open spinoff follow-ups:
  - `FU-SEC-BADGE-ASSIGN-PER-STUDENT` (P2, 0.5d) — `POST /api/teacher/badges/[id]/assign` accepts `studentIds[]` — needs per-student `verifyTeacherCanManageStudent` (closes cross-class teacher self-grant; requireTeacher closed only the student-self-grant path)
  - `FU-SEC-REQUEST-ACCESS-TURNSTILE` (P2, 1h) — `/api/teacher/request-access` is anonymous-public + allowlisted in scan-role-guards; mirror `welcome/request-school-access` Turnstile pattern
  - `FU-SEC-RESPONSES-PATH-MIGRATION` (deferred from P-3) — JSONB-embedded URLs in `student_progress.responses` weren't rewritten by the storage privatisation migration
  - `FU-SEC-MIG-035-PUBLIC-READ-AUDIT` (P3, 1h) — confirm `safety_sessions_read_by_code` is intentional public read or scope it
- [ ] If switching projects: nothing in flight here; main is fully clean.

## Open questions / blockers

_None._
