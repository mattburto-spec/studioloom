/**
 * Sentry PII redactor — runs in `beforeSend` and `beforeBreadcrumb` hooks.
 *
 * Closes P-2 of docs/security/security-plan.md. Sentry's dashboard-side
 * scrubbing was the only line of defence; one toggle flip leaks every error
 * report. This module is the in-code defence: Sentry sees `[REDACTED]` for
 * known-PII keys regardless of dashboard config.
 *
 * Smoke test: trigger a known error path with `{ email: "x@y.com" }` in scope
 * and confirm the resulting Sentry event has `[REDACTED]` for `email`.
 */
import type { ErrorEvent, EventHint, Breadcrumb, BreadcrumbHint } from "@sentry/nextjs";

/**
 * Substring matches against object keys (case-insensitive). Conservative —
 * better to over-redact than to leak. Add new entries here as PII surfaces
 * are discovered.
 *
 * Expanded 9 May 2026 after Gemini external review caught two gaps: bare
 * `ip` field wasn't matched (only `ip_address` / `ipaddress`), and the
 * `students.learning_profile` JSONB self-disclosures (anxiety, autism,
 * ADHD, dyslexia, learning_differences, accommodations) weren't on the
 * list — those would land in Sentry plaintext on any error in the
 * design-assistant or Open Studio mentor.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  // Identity
  "email",
  "password",
  "passwd",
  "classcode",
  "class_code",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "token", // catches access_token / refresh_token / provider_token
  "session",
  "cookie",
  "displayname",
  "display_name",
  "firstname",
  "first_name",
  "lastname",
  "last_name",
  "fullname",
  "full_name",
  "studentname",
  "student_name",
  // Network identifiers
  "ipaddress",
  "ip_address",
  "ip_addr",
  "ipv4",
  "ipv6",
  "x-forwarded-for",
  "x_forwarded_for",
  // Contact / sensitive
  "phone",
  "ssn",
  "dob",
  "date_of_birth",
  "birthdate",
  "address",
  // Self-disclosure (UDL / learning_profile JSONB) — added 9 May 2026
  // after Gemini external review.
  "learning_difference",
  "learning_differences",
  "accommodation",
  "accommodations",
  "udl_strength",
  "udl_strengths",
  "udl_barrier",
  "udl_barriers",
  "anxiety",
  "adhd",
  "autism",
  "dyslexia",
  "asd",
  "iep",
  "504_plan",
  "fivefourplan",
  "diagnosis",
  "medication",
  "communication_preference",
  "communication_preferences",
  // Location-of-origin (sometimes sensitive in international school context)
  "languages_at_home",
  "countries_lived_in",
  "country_of_birth",
];

/**
 * Bare-name match list (exact key match, case-insensitive). Used for keys
 * that are too short to safely substring-match — e.g. matching every key
 * containing "ip" would catch "tip", "skip", "recipient", etc.
 */
const SENSITIVE_EXACT_KEYS = new Set([
  "ip",
  "ssn",
  "dob",
]);

const REDACTED = "[REDACTED]" as const;
const REDACTED_OBJECT = { __redacted: true } as const;

function keyIsSensitive(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_EXACT_KEYS.has(lower)) return true;
  return SENSITIVE_KEY_FRAGMENTS.some((frag) => lower.includes(frag));
}

/**
 * Recursively walks an object, replacing values under sensitive keys with
 * `[REDACTED]`. Mutates the input for performance — Sentry events are local
 * to the request lifecycle.
 *
 * Cycle protection via WeakSet — Sentry events occasionally carry circular
 * references through `extra.error.cause`.
 */
export function scrubPII<T>(obj: T, seen: WeakSet<object> = new WeakSet()): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (seen.has(obj as object)) return obj;
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      obj[i] = scrubPII(obj[i], seen);
    }
    return obj;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (keyIsSensitive(key)) {
      record[key] = typeof record[key] === "object" && record[key] !== null
        ? REDACTED_OBJECT
        : REDACTED;
    } else if (typeof record[key] === "object" && record[key] !== null) {
      record[key] = scrubPII(record[key], seen);
    }
  }
  return obj;
}

/**
 * Pattern-match scrub for free-form strings (event.message,
 * exception.values[*].value, exception.values[*].type). Closes F-9 from the
 * 9 May external review (cowork). The key-walk in scrubPII() doesn't help
 * here — these are unstructured text strings where PII appears mid-message.
 *
 * Patterns covered:
 *   - Emails:           /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
 *   - Classcodes:       /\b[A-Z0-9]{6,8}\b/g (uppercase 6-8 alphanumeric;
 *                       matches StudioLoom classcode shape; some collateral
 *                       false-positives on UUIDs/SHA prefixes acceptable)
 *   - Bearer tokens:    /Bearer\s+[\w._-]+/gi
 *   - JWT-shape:        /eyJ[\w-]+\.[\w-]+\.[\w-]+/g (3-segment JWTs)
 *
 * Tradeoff: pattern-match WILL have false positives (a stack frame mentioning
 * "Component AB12CDEF" gets the second token redacted). That's the right
 * direction — better an over-redacted message than a leaked email. Per Lesson
 * #38, the locked tests below assert specific redaction patterns; widen the
 * regexes only with paired test capture-truth.
 */
const PATTERNS: { name: string; regex: RegExp; replacement: string }[] = [
  { name: "email", regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, replacement: REDACTED },
  { name: "jwt", regex: /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, replacement: REDACTED },
  { name: "bearer", regex: /Bearer\s+[\w._-]+/gi, replacement: `Bearer ${REDACTED}` },
  // Classcode = StudioLoom 6-8-char uppercase alphanumeric. Negative
  // lookbehind/ahead exclude `[` and `]` so the regex doesn't re-match
  // the literal "REDACTED" inside an already-redacted [REDACTED] token
  // (which is 8 chars all-uppercase and would match the simple form).
  // Also exclude word chars + `-` to skip mid-identifier matches.
  { name: "classcode", regex: /(?<![[\w-])[A-Z0-9]{6,8}(?![\]\w-])/g, replacement: REDACTED },
];

function scrubMessageString(s: string): string {
  if (!s) return s;
  let out = s;
  for (const p of PATTERNS) out = out.replace(p.regex, p.replacement);
  return out;
}

/**
 * Sentry `beforeSend` hook. Redacts PII from contexts/extra/request, drops
 * everything from `user` except `id`, scrubs query strings, and pattern-
 * scrubs free-form strings on event.message + exception.values[*].
 */
export function beforeSend(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.contexts) event.contexts = scrubPII(event.contexts);
  if (event.extra) event.extra = scrubPII(event.extra);
  if (event.tags) event.tags = scrubPII(event.tags);

  if (event.user) {
    event.user = event.user.id ? { id: event.user.id } : undefined;
  }

  // F-9 9 May 2026: scrub event.message — Sentry serialises it as plain
  // string when manually captured, OR as `{ message, formatted }` when it
  // comes from interpolated console captures.
  if (event.message) {
    if (typeof event.message === "string") {
      event.message = scrubMessageString(event.message);
    } else {
      const msgObj = event.message as { message?: string; formatted?: string };
      if (typeof msgObj.message === "string") msgObj.message = scrubMessageString(msgObj.message);
      if (typeof msgObj.formatted === "string") msgObj.formatted = scrubMessageString(msgObj.formatted);
    }
  }

  // F-9 9 May 2026: scrub exception.values[*].{value,type}. The value is the
  // thrown error's message (e.g. "Failed to find user with email x@y.com");
  // the type is the constructor name (rarely PII but bound by the same rule).
  if (event.exception?.values) {
    for (const ev of event.exception.values) {
      if (typeof ev.value === "string") ev.value = scrubMessageString(ev.value);
      if (typeof ev.type === "string") ev.type = scrubMessageString(ev.type);
    }
  }

  if (event.request) {
    // Cookies: Sentry types this as Record<string, string> | string. Strip
    // entirely (cookies routinely carry session tokens — never useful for
    // debugging at the cost of leak risk).
    if (event.request.cookies) {
      event.request.cookies = {} as typeof event.request.cookies;
    }
    if (event.request.headers) {
      const headers = event.request.headers as Record<string, string>;
      for (const key of Object.keys(headers)) {
        if (keyIsSensitive(key)) headers[key] = REDACTED;
      }
    }
    if (event.request.data) event.request.data = scrubPII(event.request.data);
    if (event.request.query_string && typeof event.request.query_string === "string") {
      event.request.query_string = redactQueryString(event.request.query_string);
    }
  }

  return event;
}

/**
 * Sentry `beforeBreadcrumb` hook. Drops fetch/xhr request bodies entirely —
 * the URL + status code is enough to debug; bodies frequently contain PII.
 */
export function beforeBreadcrumb(
  breadcrumb: Breadcrumb,
  _hint?: BreadcrumbHint
): Breadcrumb | null {
  if (breadcrumb.category === "fetch" || breadcrumb.category === "xhr") {
    if (breadcrumb.data) {
      breadcrumb.data = {
        ...breadcrumb.data,
        request_body_size: undefined,
        response_body_size: undefined,
      };
      if (typeof breadcrumb.data.url === "string") {
        breadcrumb.data.url = redactUrlQueryString(breadcrumb.data.url);
      }
    }
  }
  if (breadcrumb.data) breadcrumb.data = scrubPII(breadcrumb.data);
  return breadcrumb;
}

function redactQueryString(qs: string): string {
  try {
    const params = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
    for (const key of Array.from(params.keys())) {
      if (keyIsSensitive(key)) params.set(key, REDACTED);
    }
    return params.toString();
  } catch {
    return qs;
  }
}

function redactUrlQueryString(url: string): string {
  const qIndex = url.indexOf("?");
  if (qIndex === -1) return url;
  return url.slice(0, qIndex + 1) + redactQueryString(url.slice(qIndex + 1));
}
