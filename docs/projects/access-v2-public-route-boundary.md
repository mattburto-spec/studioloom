# Public / Anonymous Route Boundary

**Phase:** Access Model v2 Phase 4.8b (freemium-build seam)
**Status:** Authoritative reference. Do not open new public surface without updating this doc.

## The rule

A route is "public / anonymous" iff **either** of the following is true:

1. Its pathname is matched by the public-routes block in [`middleware.ts:7-30`](../../middleware.ts).
2. It lives under `/api/public/*` or another path explicitly marked as public.

Public routes:
- ship with **no auth context** (no ActorSession, no `auth.uid()`-bound RLS)
- emit **no `audit_events` rows** (Phase 5 audit-log scanner skips them)
- assume the caller is anonymous; treat any user-supplied identity as untrusted input

## Why this boundary exists

- **Phase 5 audit-log instrumentation** (the `logAuditEvent()` wrapper) is wired into every state-mutating route. The `scan-api-routes.py` CI gate flags routes that lack the wrapper. That gate needs to know which routes are *deliberately* anonymous so it doesn't fire false-positive "missing logAuditEvent" alerts on `/api/public/*` etc.
- **Tier-aware membership** (Phase 4.7b) protects authenticated school-scoped surfaces. Public routes don't have a tier-gate to enforce — they're equally available to free / pro / school / unauthenticated users.
- **Marketing + standalone tools** (Preflight standalone scanner, Teaching Moves browse, toolkit demos, public marketing surfaces) are deliberately anonymous to lower the friction of discovery / sharing. That's a feature, not a leak.

## Current public surface (snapshot 3 May 2026)

The public-routes block in `middleware.ts` allows the following without auth:

```ts
pathname === "/" ||
pathname === "/login" ||
pathname === "/teacher/login" ||
pathname === "/admin/login" ||
pathname.startsWith("/api/auth/") ||
pathname.startsWith("/api/tools/") ||
pathname.startsWith("/tools") ||
pathname.startsWith("/toolkit") ||
pathname.startsWith("/safety/projector") ||
pathname.startsWith("/api/public/") ||
pathname.startsWith("/_next/") ||
pathname.startsWith("/favicon")
```

Plus the view-as guard immediately above (which 403s any non-GET request bearing `?as_token=`).

Notable points:
- `/api/auth/*` includes signup, signin, password reset, OAuth callbacks. These ARE legitimate state-mutators; they're public because the caller has no session yet. The signup path WILL eventually emit audit rows (Phase 5 wires this), but the current public-routes block doesn't strip a session that doesn't exist yet.
- `/api/tools/*` and `/tools` / `/toolkit` are the public Design Thinking Toolkit (24 tools). Non-trivial AI calls happen here; the freemium build will need a tier-gate at the route layer (`requires_plan: public` → universally available; `requires_plan: free` → require auth; etc.) — not strictly an RLS concern.
- `/api/public/*` is the explicit public-API namespace. Only one route lives there today: `/api/public/safety-badges`.

## Phase 5 audit-log integration

When Phase 5 ships `logAuditEvent()` and the CI scanner:

- The scanner reads the `middleware.ts` public-routes block via AST parse, builds a deny-list, and skips those paths when checking for missing audit calls.
- The scanner ALSO reads this doc to allow exemptions documented here (e.g., a future internal endpoint that's authenticated but deliberately not audit-logged for performance reasons — none today).
- Any route NOT in the public list AND NOT exempted MUST call `logAuditEvent()` for state-mutating methods (POST / PATCH / PUT / DELETE).

## Adding a new public route

Phase 4 part 2 does NOT open new public surface. Future additions require:

1. Update `middleware.ts` public-routes block.
2. Update this doc with the new route + a one-line justification.
3. Confirm the route does NOT process user-identified data without re-validating identity (no `?user_id=` parameters that downstream code trusts).
4. If the route is state-mutating, document why it's exempt from audit-log instrumentation (typically: pre-auth, the actor isn't yet known).

## Phase 6 cutover audit

Pre-pilot cutover (Phase 6 close) re-audits this list:
- Are all entries still needed?
- Has any path drifted (e.g., a route that started public got auth checks added but is still in the public list)?
- Is the `/api/auth/*` exemption still warranted, or have we matured enough to call audit there too?

The post-pilot expansion to a 2nd school is the trigger; until then the current list stands.
