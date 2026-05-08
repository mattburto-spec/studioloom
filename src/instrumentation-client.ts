import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeBreadcrumb } from "@/lib/security/sentry-pii-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.1,
  // PII redactor — see docs/security/security-plan.md P-2.
  // Defence-in-depth alongside Sentry dashboard scrubbing.
  beforeSend,
  beforeBreadcrumb,
  sendDefaultPii: false,
});

// Required by Sentry v10+ for client-side navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
