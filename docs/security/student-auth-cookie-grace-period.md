# Student Auth Cookie Grace Period (Phase 1)

**Phase:** Access Model v2 Phase 1.6 (cleanup deliverable)
**Brief:** [`docs/projects/access-model-v2-phase-1-brief.md`](../projects/access-model-v2-phase-1-brief.md) §4.6
**Created:** 30 April 2026

## TL;DR

Phase 1 introduces a new student auth path (Supabase Auth via `sb-*-auth-token` cookies) alongside the legacy custom-token system (`questerra_student_session` cookie). **Both paths coexist during a grace period.** Phase 6 cutover removes the legacy path.

## What changed in Phase 1

- **Phase 1.2** — new `POST /api/auth/student-classcode-login` route mints Supabase sessions via `generateLink({ type: 'magiclink' })` + `verifyOtp({ token_hash })`. Sets `sb-cxxbfmnbwihuskaaltlk-auth-token.0` + `.1` cookies (Supabase split-cookie format).

- **Phase 1.4a** — legacy `requireStudentAuth(request)` from `src/lib/auth/student.ts` was rewritten to be **dual-mode**:
  1. Try `getStudentSession(request)` from `@/lib/access-v2/actor-session` (reads sb-* cookies via SSR client).
  2. Fall back to legacy `student_sessions` table lookup (reads `questerra_student_session` cookie).

- **Phase 1.4b** — 6 GET routes (`grades`, `units`, `insights`, `safety/pending`, `me/support-settings`, `me/unit-context`) explicitly migrated to `requireStudentSession`. Other 57 student routes still call `requireStudentAuth` — they get the new auth automatically via the dual-mode wrapper.

## Cookie surface during the grace period

A student request to any `/api/student/*` route may carry one OR both cookie types:

| Scenario | Cookies present | Resolved by |
|---|---|---|
| Logged in via Phase 1.2 new flow | `sb-*-auth-token.0/.1` only | New path (`getStudentSession`) |
| Logged in via legacy `/api/auth/student-login` | `questerra_student_session` only | Legacy table lookup |
| Mid-session — both flows hit during transition | Both | Sb-* wins (checked first); legacy ignored |

The legacy route at `/api/auth/student-login` is **NOT deprecated yet.** Both `/api/auth/student-login` and `/api/auth/student-classcode-login` are callable. Front-end code can switch to the new endpoint at any time during the grace window.

## When the grace period ends

**Phase 6 cutover** (post-pilot) — the canonical end of the grace period:

1. Front-end fully migrated to new endpoint
2. All routes migrated to explicit `requireStudentSession` (Phase 1.4c)
3. Legacy `requireStudentAuth` deletion + `student_sessions` table dropped
4. `questerra_student_session` cookie no longer set or read anywhere

Until Phase 6:
- Legacy users keep working without re-login
- New users (via Phase 1.2 endpoint) work via Supabase Auth
- Both groups get correct identity resolution

## Operational considerations

### Stale-token edge case

A user with a valid `questerra_student_session` (legacy) but expired/missing `sb-*` cookie still resolves correctly via the dual-mode fallback. They effectively "downgrade" to legacy auth for that request. No user-visible disruption.

A user with valid sb-* cookies but no legacy cookie resolves via the new path. They effectively "upgrade" to Supabase Auth.

### RLS implications

Phase 1.5 + 1.5b shipped 14 student-side RLS policies via the canonical `auth.uid() → students.user_id → students.id` chain. **These policies are pre-positioned but NOT load-bearing yet** — routes still use `createAdminClient()` for student data reads, which bypasses RLS.

Routes will switch to RLS-respecting clients in **Phase 1.4 client-switch** (deferred to follow-up `FU-AV2-PHASE-14-CLIENT-SWITCH`). Until then:
- New auth path works (verified end-to-end in prod-preview).
- App-level filtering remains the primary line of defense for student data isolation.
- RLS policies serve as a documented backstop ready to activate per-route as client-switch proceeds.

### Audit trail

Phase 1.2's new login route writes `audit_events` rows on every outcome:
- `student.login.classcode.success` (severity=info, actor_id populated)
- `student.login.classcode.failed` (severity=warn, actor_id NULL, payload includes `failureReason`)
- `student.login.classcode.rate_limited` (severity=warn, hits per-IP or per-classcode rate limit)

The legacy `/api/auth/student-login` route does NOT write audit_events. Logins through the legacy path are uninstrumented during the grace period; this is acceptable for the pilot but flagged for Phase 5 systemic audit-log wiring.

## Related

- Phase 1 brief: [`docs/projects/access-model-v2-phase-1-brief.md`](../projects/access-model-v2-phase-1-brief.md)
- Master spec: [`docs/projects/access-model-v2.md`](../projects/access-model-v2.md)
- Lesson #62: pg_catalog vs information_schema for cross-schema FK verification
- Lesson #63: Vercel preview URLs are deployment-specific
- FU-AV2-PHASE-14B-2 (P3): 18 remaining GET routes mechanical migration
- FU-AV2-PHASE-14-CLIENT-SWITCH (P2): client-switch + supporting-table policies
- FU-AV2-UI-STUDENT-INSERT-REFACTOR (P2): 4 client-side UI INSERT sites Phase 1.4 will refactor

## Sign-off

Phase 1 closes with both auth paths active. Verified end-to-end in prod-preview on 29 April 2026 evening (Tests 1/2/3 all 200). All 8 RLS migrations applied to prod on 30 April 2026.
