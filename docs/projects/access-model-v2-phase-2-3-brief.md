# Phase 2.3 — Auth-mode Allowlist Schema + UI: Build Brief

**Sub-phase of:** [Phase 2 — OAuth + Email/Password](access-model-v2-phase-2-brief.md)
**Estimate:** 5-6 hours
**Status:** PROPOSED — awaiting sign-off
**Drafted:** 1 May 2026

---

## 1. Goal

Add per-school + per-class controls over which authentication modes are
offered on the login page. Lets China-locked schools restrict to
`email_password` only (Google + Microsoft are blocked in China for many
school networks) and lets schools standardise on a single SSO provider
when their IT department mandates it.

End state: schools can disable Google/Microsoft, and individual classes
can further narrow that. The login page reads `?school=<slug>` or
`?class=<code>` URL params and filters the buttons it shows.

---

## 2. Schema additions (1 migration)

**Table `schools`** — add column:
```sql
ALTER TABLE schools
  ADD COLUMN allowed_auth_modes TEXT[] NOT NULL
  DEFAULT ARRAY['email_password', 'google', 'microsoft']::TEXT[];
```
- Existing rows backfilled to the default (all three modes allowed).
- Indexed implicitly by being a small array; no GIN index needed at v1
  scale (~10s of schools).

**Table `classes`** — add column:
```sql
ALTER TABLE classes
  ADD COLUMN allowed_auth_modes TEXT[] NULL;
```
- NULL means "inherit from school".
- Non-null narrows further (must be a subset of the school's allowlist —
  enforced in app layer, not DB, to avoid cross-table CHECK complexity;
  see Lesson #61).

**CHECK constraint** on both — values must be from the canonical set:
```sql
ALTER TABLE schools
  ADD CONSTRAINT schools_allowed_auth_modes_valid
  CHECK (allowed_auth_modes <@ ARRAY['email_password', 'google', 'microsoft', 'apple']::TEXT[]);

ALTER TABLE classes
  ADD CONSTRAINT classes_allowed_auth_modes_valid
  CHECK (allowed_auth_modes IS NULL OR allowed_auth_modes <@ ARRAY['email_password', 'google', 'microsoft', 'apple']::TEXT[]);
```
- `apple` included so Phase 2.4's feature flag doesn't need a follow-up
  migration when it lands.

**No RLS changes** — `schools.allowed_auth_modes` and
`classes.allowed_auth_modes` are read by the unauthenticated login page,
so they need to be readable by anonymous users. The login-page query
will use a service-role read scoped to the `?school=` or `?class=`
filter param — never returning the entire table.

---

## 3. Code changes

### 3a. Login page filtering (`src/app/teacher/login/page.tsx`)

- Read `?school=<slug>` and `?class=<code>` from the URL on mount (server
  component or client useSearchParams).
- Server-side helper `getAllowedAuthModes(scope)`:
  - If `?class=<code>` provided → join classes → schools, intersect.
  - Else if `?school=<slug>` → schools.allowed_auth_modes.
  - Else → return all globally-enabled modes from feature flags.
- Each OAuth button conditionally renders based on the allowed list.
- Email/password form section conditionally renders.

### 3b. Server helper

New file: `src/lib/auth/allowed-auth-modes.ts` exporting:
```ts
export type AuthMode = "email_password" | "google" | "microsoft" | "apple";

export async function getAllowedAuthModes(opts: {
  classCode?: string;
  schoolSlug?: string;
}): Promise<AuthMode[]>;
```

### 3c. Tests

- Migration shape test (column exists, default value, CHECK constraint).
- `getAllowedAuthModes` unit tests covering 4 cases:
  1. No scope → returns all globally-enabled.
  2. School scope → returns school's allowlist.
  3. Class scope with NULL → inherits school.
  4. Class scope with subset → returns the subset.
- Login page integration test: with `?school=china-locked-school` →
  only email/password form renders, no OAuth buttons.

---

## 4. NOT in scope (defer)

- Settings UI (`/school/[id]/settings`, `/teacher/classes/[classId]/settings`)
  — defer to Phase 4 or a separate sub-phase. For Phase 2.3 v1, schema
  + login page filtering only. Editing the allowlist will be done via
  Supabase SQL editor during the pilot.
- Per-provider config (Microsoft tenant restriction, Google `hd` claim)
  — separate column or table when actually needed.
- Auto-detection of school from the user's email domain — Phase 4.

---

## 5. Don't-stop-for list

- Settings UI not built yet — accepted for v1, schema-only.
- China access edge cases beyond the allowlist (e.g. Tencent CDN Email
  delivery) — different track.
- Forgot-password integration with the allowlist — covered later because
  the email-password reset path uses the same form regardless of mode.

---

## 6. Stop triggers

- Migration fails to apply on prod Supabase → STOP, investigate before
  pushing further.
- The CHECK constraint conflicts with existing prod data in `schools`
  (shouldn't, since Phase 0 added 'email_password', 'google', 'microsoft'
  as valid; 'apple' is forward-compat) → STOP, audit.
- `getAllowedAuthModes` returns empty array for valid scope → STOP, the
  fallback logic is broken (a school must always have at least
  `email_password`).
- Same-email collision when a teacher's school has email_password disabled
  but they have a legacy email-password account → STOP, design call.

---

## 7. Pre-flight ritual checklist

- [x] git status clean (verified 1 May 2026).
- [x] On branch `main`, in sync with `origin/main`.
- [x] Schema registry consulted — `schools` + `classes` shape captured;
      `allowed_auth_modes` is the only addition.
- [x] WIRING.yaml `auth-system` checked — has `affects: [teacher-dashboard,
      …]`. After 2.3, add `school-readiness` and `china-deployment` to
      affects.
- [x] Lesson #54 (registry drift) absorbed — registries will be re-synced
      via saveme after migration applies.
- [ ] **Baseline `npm test` passes** — run before code (~3 min, expected
      2817 passed | 11 skipped per handoff).

---

## 8. Commit plan

| # | Commit subject | Files |
|---|----------------|-------|
| 1 | feat(schema): allowed_auth_modes on schools + classes (migration) | `supabase/migrations/<ts>_allowed_auth_modes.sql` |
| 2 | feat(auth): getAllowedAuthModes helper + tests | `src/lib/auth/allowed-auth-modes.ts`, tests |
| 3 | feat(auth): login page filters buttons by allowed_auth_modes | `src/app/teacher/login/page.tsx` |
| 4 | chore(registry): sync schema-registry + WIRING for Phase 2.3 | `docs/schema-registry.yaml`, `docs/projects/WIRING.yaml` |

---

## 9. Phase 2.3 Checkpoint criteria (gate before 2.4)

### Code
- [ ] Migration applied to dev, staging, prod Supabase.
- [ ] `getAllowedAuthModes` covers 4 test cases above.
- [ ] Login page filters buttons correctly with `?school=` + `?class=`.
- [ ] No regressions in existing email/password or OAuth flows.

### Smoke (prod)
- [ ] Sign in unscoped → all 3 buttons render.
- [ ] Manually `UPDATE schools SET allowed_auth_modes = ARRAY['email_password']`
      for one school → load `/teacher/login?school=<slug>` → only
      email/password form renders, OAuth buttons hidden.
- [ ] Set `classes.allowed_auth_modes = ARRAY['email_password']` for one
      class → load `/teacher/login?class=<code>` → only email/password.
- [ ] Reset both rows; flow returns to the default state.

### Tests
- [ ] `npm test` green; new tests included; net delta ≥ +6 tests.
- [ ] tsc strict 0 errors.

### Documentation
- [ ] Decision logged in `docs/decisions-log.md`: "TEXT[] vs JSONB chosen
      for `allowed_auth_modes` because per-mode config (tenant, hd) goes
      in a future separate column when actually needed."
- [ ] Phase 2.3 sub-phase marked DONE in `access-model-v2-phase-2-brief.md`.

---

## 10. Post-Checkpoint-2.3 — what unlocks

- Phase 2.4 (Apple OAuth feature flag scaffold, ~1h).
- Phase 2.5 (Checkpoint A3 verification + smoke, ~1-2h).
- China-locked schools can be onboarded to the pilot (real revenue
  unlock).

---

## 11. Risks + mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| App-layer subset enforcement drifts (class subset logic broken) | School allows X but class somehow allows X+Y | Medium | Unit tests cover 4 cases + integration test on the merge logic. |
| Anonymous read of `allowed_auth_modes` exposes too much | Schema info leak | Low | Login page query reads only the single row matched by `?school=` or `?class=`, not the table. |
| Existing prod rows fail the CHECK constraint | Migration fails | Very low | Pre-migration query `SELECT count(*) FROM schools WHERE NOT allowed_auth_modes <@ ARRAY[…]` — defaults will satisfy. |
| Login-page UI confused when zero modes are allowed | User can't sign in | Medium | App-layer guarantee: if `allowed_auth_modes` is empty after intersection, fall back to email_password (with banner "your school has restricted sign-in; contact your admin"). |

---

## 12. Sign-off

Ready to start coding when:
1. Matt confirms scope (settings UI deferred is OK).
2. Matt confirms `email_password` is always implicitly available as a
   safety fallback (or override that decision).
3. Matt confirms `apple` should be in the CHECK constraint allowlist now
   (forward-compat for Phase 2.4) vs deferred to that phase.
