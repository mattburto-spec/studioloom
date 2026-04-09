# Sentry Setup Audit: StudioLoom (Questerra)
**Date:** 2026-04-07
**Status:** PARTIALLY CONFIGURED (functional but incomplete)

---

## SUMMARY
- **Setup Status:** Sentry is integrated and functional for error tracking
- **Main Gap:** No source map upload configured (missing SENTRY_AUTH_TOKEN)
- **Environment:** DSN is configured and active
- **Coverage:** Client-side errors, server-side errors, and API routes covered

---

## FILES FOUND & ANALYZED

### 1. `src/instrumentation.ts` ✅ EXISTS — CONFIGURED
**Purpose:** Server-side Sentry initialization for Node.js and Edge runtime

**Configuration:**
```
- DSN: Uses NEXT_PUBLIC_SENTRY_DSN env var
- Enabled: Conditional on DSN presence
- Traces sample rate: 10% (0.1)
- Runtime detection: Separate init for nodejs and edge runtime
- Error handler: Exports onRequestError = Sentry.captureRequestError
```

**Quality:** Good — separate initialization for both runtimes, conditional enabling

---

### 2. `src/instrumentation-client.ts` ✅ EXISTS — CONFIGURED
**Purpose:** Client-side Sentry initialization for browser

**Configuration:**
```
- DSN: Uses NEXT_PUBLIC_SENTRY_DSN env var
- Enabled: Conditional on DSN presence
- Traces sample rate: 10% (0.1)
- Session replays: Disabled (0)
- Error replays: 10% (0.1)
- Router instrumentation: Exports onRouterTransitionStart hook
```

**Quality:** Good — client replay sampling configured, lightweight

---

### 3. `next.config.ts` ✅ EXISTS — CONFIGURED
**Purpose:** Next.js Sentry wrapper for build-time source map handling

**Configuration:**
```
- Wrapper: withSentryConfig applied (line 83)
- Source map upload: Conditional on SENTRY_AUTH_TOKEN
- Silent mode: true (no verbose logging)
- Bundle size optimizations:
  - excludeDebugStatements: true
  - excludeReplayIframe: true
  - excludeReplayShadowDom: true
```

**Quality:** Excellent — proper source map upload gating, optimizations enabled

---

### 4. `src/app/global-error.tsx` ✅ EXISTS — CONFIGURED
**Purpose:** Root-level error boundary for uncaught client errors

**Configuration:**
```
- Uses Sentry.captureException() in useEffect
- Captures Error + digest
- Provides user-friendly error UI with reset button
```

**Quality:** Good — captures global errors before React crash

---

### 5. `src/lib/api/error-handler.ts` ✅ EXISTS — CONFIGURED
**Purpose:** Centralized error handling wrapper for API routes

**Features:**
```
- Wraps API route handlers
- Dynamic Sentry import (no-op if unavailable)
- Tags errors with: route name, layer: "api-route"
- Adds extra context: HTTP method, URL
- Returns clean 500 JSON response
```

**Usage Pattern:** `export const POST = withErrorHandler("route-name", handler)`

**Quality:** Excellent — well-designed, defensive, proper tagging

---

### 6. `.env.local` ✅ EXISTS — PARTIALLY CONFIGURED
```
NEXT_PUBLIC_SENTRY_DSN=https://fbde420812a8e761490aa0c1a04f5a29@o4511058537021440.ingest.us.sentry.io/4511058582634496
✅ Present and valid

SENTRY_AUTH_TOKEN=
❌ MISSING — not set in .env.local
```

---

### 7. `.env.example` ✅ EXISTS — DOCUMENTED
```
Lines 56-67 document both required variables:
- NEXT_PUBLIC_SENTRY_DSN (client-visible, browser reporting)
- SENTRY_AUTH_TOKEN (server-only, source map upload)
```

---

## FILES NOT FOUND (NOT REQUIRED)

### ❌ `sentry.client.config.ts`
**Why missing:** Not needed with Next.js 15.3.3 + Sentry v10.43.0
- Client init handled by `instrumentation-client.ts` (Next.js convention)
- Sentry v10 doesn't require separate config files

### ❌ `sentry.server.config.ts`
**Why missing:** Not needed with Next.js 15.3.3 + Sentry v10.43.0
- Server init handled by `instrumentation.ts` (Next.js convention)
- Sentry v10 uses per-runtime `register()` function

### ❌ `sentry.edge.config.ts`
**Why missing:** Edge runtime handled inline in `instrumentation.ts` (lines 12-18)
- No separate file needed — modern Sentry approach

### ❌ `.sentryclirc`
**Why missing:** Not needed
- Source map upload gated by SENTRY_AUTH_TOKEN in next.config.ts
- Sentry CLI runs during build if token is set

### ❌ `.github/workflows/`
**Status:** Directory doesn't exist
- No automated CI/CD workflows configured
- No automated source map uploads on deploy

---

## CONFIGURATION ANALYSIS

### What's Working ✅
1. **Error Capture:** Global errors, API errors, and unhandled exceptions are reported
2. **Client Instrumentation:** Browser errors + replay sampling active
3. **Server Instrumentation:** Node.js and Edge runtime both capture errors
4. **Request Handling:** withErrorHandler wrapper catches API route errors
5. **DSN Active:** Sentry project is receiving events
6. **Next.js Integration:** Proper use of instrumentation.ts + withSentryConfig

### What's Missing ❌
1. **Source Map Upload:** SENTRY_AUTH_TOKEN not set
   - **Impact:** Stack traces won't be symbolicated (will show minified function names)
   - **Severity:** MEDIUM — app still works, but debugging is harder
   - **Fix:** Add SENTRY_AUTH_TOKEN to `.env.local` or Vercel secrets

2. **Automated CI/CD:** No .github/workflows for deploy-time source map upload
   - **Impact:** Manual Sentry integration during builds
   - **Severity:** LOW — less important on Vercel (which has native integration)
   - **Fix:** Optional — Vercel can auto-upload if SENTRY_AUTH_TOKEN is set

3. **Release Tracking:** No explicit Sentry releases configured
   - **Impact:** Can't track which deploy caused an error
   - **Severity:** LOW — Sentry auto-creates releases, but manual labeling is better
   - **Fix:** Add `release: process.env.GIT_COMMIT_SHA` to init config

4. **Environment Tagging:** No explicit environment (dev/staging/prod)
   - **Impact:** Can't filter errors by environment in Sentry dashboard
   - **Severity:** LOW — helpful for multi-env setups
   - **Fix:** Add `environment: process.env.NODE_ENV` to init config

---

## ENVIRONMENT VARIABLES STATUS

| Variable | Status | Location | Usage |
|----------|--------|----------|-------|
| NEXT_PUBLIC_SENTRY_DSN | ✅ SET | .env.local | Client + server initialization |
| SENTRY_AUTH_TOKEN | ❌ MISSING | .env.local | Source map upload (build-time) |

---

## RECOMMENDATIONS (Priority Order)

### 🔴 CRITICAL — Do Not Ignore
None. Sentry is functional.

### 🟡 HIGH — Should Fix Soon
1. **Add SENTRY_AUTH_TOKEN to environment**
   ```bash
   # Get from: https://sentry.io → Settings → Auth Tokens
   # Paste into Vercel project settings (Secrets)
   # Or add to .env.local for local development
   ```
   **Benefit:** Stack traces will be readable instead of minified

2. **Test source map upload works**
   ```bash
   npm run build  # Should upload maps if token is set
   # Check Sentry dashboard → Releases → Latest
   ```

### 🟢 MEDIUM — Nice to Have
3. **Add release tracking** (optional)
   ```typescript
   // In src/instrumentation.ts and instrumentation-client.ts:
   Sentry.init({
     // ... existing config
     release: process.env.GIT_COMMIT_SHA || "development",
   });
   ```

4. **Add environment tagging** (optional)
   ```typescript
   Sentry.init({
     // ... existing config
     environment: process.env.NODE_ENV || "development",
   });
   ```

5. **Create .github/workflows/sentry-release.yml** (optional, Vercel alternative)
   - Auto-creates Sentry releases on deploy
   - Useful if not using Vercel's native integration

---

## API ROUTE COVERAGE

Files checked that use withErrorHandler (14 routes):
- ✅ `/api/student/quest/milestones/*`
- ✅ `/api/student/design-assistant`
- ✅ `/api/student/safety/badges/*`
- ✅ `/api/student/tool-sessions/*`
- ✅ `/api/teacher/badges/*`
- ✅ `/api/tools/report-writer/*`
- ✅ `/api/tools/marking-comments`

**Status:** Good coverage for critical routes. All listed routes properly wrapped.

---

## NEXT STEPS

1. **Immediate (< 5 min):**
   - Get SENTRY_AUTH_TOKEN from https://sentry.io → Settings → Auth Tokens
   - Add to Vercel project environment secrets (or .env.local for local dev)

2. **Verify (< 10 min):**
   - Run `npm run build` to confirm source map upload
   - Check Sentry dashboard Releases section
   - Trigger a test error to confirm reporting works

3. **Optional (20-30 min):**
   - Add release + environment tracking
   - Create Sentry release automation if needed

---

## TESTING CHECKLIST

- [ ] Visit Sentry dashboard: https://sentry.io
- [ ] Confirm NEXT_PUBLIC_SENTRY_DSN project is receiving events
- [ ] Add SENTRY_AUTH_TOKEN to environment
- [ ] Run `npm run build` and verify source maps upload
- [ ] Check Releases section in Sentry for latest build
- [ ] Trigger test error (`throw new Error("test")`) and verify it appears in Sentry
- [ ] Check that stack trace is fully symbolicated (readable, not minified)
