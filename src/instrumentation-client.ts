import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeBreadcrumb } from "@/lib/security/sentry-pii-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // F-10 9 May 2026: Replay disabled until intentionally configured with
  // masking. Pre-pilot, Replay isn't load-bearing for debugging — when a
  // concrete debugging need arises, re-enable WITH
  //   Sentry.replayIntegration({ maskAllText: true, maskAllInputs: true,
  //                              blockAllMedia: true })
  // and document the masking config in
  // docs/security/sentry-pii-scrub-procedure.md before flipping the rate
  // off zero. See security-plan.md F-10 for the full tradeoff.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  // PII redactor — see docs/security/security-plan.md P-2 + F-9.
  // Defence-in-depth alongside Sentry dashboard scrubbing.
  beforeSend,
  beforeBreadcrumb,
  sendDefaultPii: false,
});

// Required by Sentry v10+ for client-side navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
