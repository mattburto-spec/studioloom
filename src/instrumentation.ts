import * as Sentry from "@sentry/nextjs";
import { beforeSend, beforeBreadcrumb } from "@/lib/security/sentry-pii-filter";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      // PII redactor — see docs/security/security-plan.md P-2.
      beforeSend,
      beforeBreadcrumb,
      sendDefaultPii: false,
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      beforeSend,
      beforeBreadcrumb,
      sendDefaultPii: false,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
