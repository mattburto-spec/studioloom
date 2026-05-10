/**
 * Tests for the Sentry PII redactor (security-plan.md P-2).
 */
import { describe, it, expect } from "vitest";
import type { ErrorEvent, Breadcrumb } from "@sentry/nextjs";
import { scrubPII, beforeSend, beforeBreadcrumb } from "../sentry-pii-filter";

describe("scrubPII", () => {
  it("redacts known sensitive keys at top level", () => {
    const out = scrubPII({ email: "x@y.com", classcode: "ABC123", topic: "ok" });
    expect(out).toEqual({ email: "[REDACTED]", classcode: "[REDACTED]", topic: "ok" });
  });

  it("redacts case-insensitively and across naming conventions", () => {
    const out = scrubPII({
      Email: "x@y.com",
      Class_Code: "ABC123",
      firstName: "Maya",
      first_name: "Maya",
      DisplayName: "Maya B",
      passwd: "secret",
    });
    expect(out.Email).toBe("[REDACTED]");
    expect(out.Class_Code).toBe("[REDACTED]");
    expect(out.firstName).toBe("[REDACTED]");
    expect(out.first_name).toBe("[REDACTED]");
    expect(out.DisplayName).toBe("[REDACTED]");
    expect(out.passwd).toBe("[REDACTED]");
  });

  it("walks nested objects", () => {
    const out = scrubPII({
      ctx: { user: { email: "x@y.com", id: "u1" } },
      payload: { studentName: "Maya", topic: "ok" },
    });
    expect((out.ctx as { user: { email: string; id: string } }).user.email).toBe("[REDACTED]");
    expect((out.ctx as { user: { email: string; id: string } }).user.id).toBe("u1");
    expect((out.payload as { studentName: string; topic: string }).studentName).toBe("[REDACTED]");
    expect((out.payload as { studentName: string; topic: string }).topic).toBe("ok");
  });

  it("walks arrays", () => {
    const out = scrubPII([{ email: "a@b.com" }, { topic: "ok" }]);
    expect((out[0] as { email: string }).email).toBe("[REDACTED]");
    expect((out[1] as { topic: string }).topic).toBe("ok");
  });

  it("redacts whole nested object when key is sensitive", () => {
    const out = scrubPII({ session: { token: "xxx", expiresAt: 123 } });
    expect(out.session).toEqual({ __redacted: true });
  });

  it("redacts Supabase Auth token names (substring match on 'token')", () => {
    const out = scrubPII({
      access_token: "eyJ...",
      refresh_token: "eyJ...",
      provider_token: "ya29...",
      provider_refresh_token: "1//...",
    });
    expect(out.access_token).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect(out.provider_token).toBe("[REDACTED]");
    expect(out.provider_refresh_token).toBe("[REDACTED]");
  });

  it("redacts bare 'ip' field via the exact-keys list", () => {
    const out = scrubPII({ ip: "1.2.3.4", topic: "ok" });
    expect(out.ip).toBe("[REDACTED]");
    expect(out.topic).toBe("ok");
  });

  it("does NOT over-redact substrings of 'ip' (tip, skip, recipient)", () => {
    const out = scrubPII({ tip: "ok", skip: "ok", recipient: "ok" });
    expect(out.tip).toBe("ok");
    expect(out.skip).toBe("ok");
    expect(out.recipient).toBe("ok");
  });

  it("redacts learning_profile self-disclosures", () => {
    const out = scrubPII({
      learning_differences: ["dyslexia", "adhd"], // array → object marker
      accommodations: { extended_time: true }, // object → object marker
      udl_strengths: ["visual"], // array → object marker
      anxiety: true, // primitive → string marker
      diagnosis: "ASD level 1", // primitive → string marker
      medication: "Ritalin", // primitive → string marker
    });
    expect(out.learning_differences).toEqual({ __redacted: true });
    expect(out.accommodations).toEqual({ __redacted: true });
    expect(out.udl_strengths).toEqual({ __redacted: true });
    expect(out.anxiety).toBe("[REDACTED]");
    expect(out.diagnosis).toBe("[REDACTED]");
    expect(out.medication).toBe("[REDACTED]");
  });

  it("redacts forwarded-for headers", () => {
    const out = scrubPII({
      "x-forwarded-for": "1.2.3.4",
      "X-Forwarded-For": "5.6.7.8",
    });
    expect(out["x-forwarded-for"]).toBe("[REDACTED]");
    expect(out["X-Forwarded-For"]).toBe("[REDACTED]");
  });

  it("survives circular references", () => {
    const obj: Record<string, unknown> = { topic: "ok" };
    obj.self = obj;
    expect(() => scrubPII(obj)).not.toThrow();
  });

  it("preserves primitives unchanged", () => {
    expect(scrubPII(42)).toBe(42);
    expect(scrubPII("hello")).toBe("hello");
    expect(scrubPII(null)).toBe(null);
    expect(scrubPII(undefined)).toBe(undefined);
  });
});

describe("beforeSend", () => {
  it("redacts contexts/extra/tags", () => {
    const event = {
      contexts: { foo: { email: "x@y.com" } },
      extra: { studentName: "Maya" },
      tags: { user_email: "x@y.com" },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out).not.toBeNull();
    expect((out!.contexts as { foo: { email: string } }).foo.email).toBe("[REDACTED]");
    expect((out!.extra as { studentName: string }).studentName).toBe("[REDACTED]");
    expect((out!.tags as { user_email: string }).user_email).toBe("[REDACTED]");
  });

  it("strips user object to id only", () => {
    const event = {
      user: { id: "u1", email: "x@y.com", username: "maya" },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out!.user).toEqual({ id: "u1" });
  });

  it("drops user entirely when no id", () => {
    const event = { user: { email: "x@y.com" } } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out!.user).toBeUndefined();
  });

  it("redacts request cookies + sensitive headers + body + query", () => {
    const event = {
      request: {
        cookies: "sb-access=abc; classcode=ABC123",
        headers: { Authorization: "Bearer xxx", "User-Agent": "ok" },
        data: { email: "x@y.com", topic: "ok" },
        query_string: "email=x%40y.com&topic=ok",
      },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out!.request!.cookies).toEqual({});
    expect((out!.request!.headers as { Authorization: string })["Authorization"]).toBe("[REDACTED]");
    expect((out!.request!.headers as { "User-Agent": string })["User-Agent"]).toBe("ok");
    expect((out!.request!.data as { email: string; topic: string }).email).toBe("[REDACTED]");
    expect((out!.request!.data as { email: string; topic: string }).topic).toBe("ok");
    expect(out!.request!.query_string).toContain("email=%5BREDACTED%5D");
    expect(out!.request!.query_string).toContain("topic=ok");
  });
});

describe("beforeSend — message + exception scrub (F-9)", () => {
  it("scrubs an email out of event.message (string form)", () => {
    const event = {
      message: "Failed to find user with email maya@school.example.com",
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(typeof out!.message).toBe("string");
    const msg = out!.message as unknown as string;
    expect(msg).not.toContain("maya@school.example.com");
    expect(msg).toContain("[REDACTED]");
    expect(msg).toContain("Failed to find user with email");
  });

  it("scrubs an email out of event.message (object form: {message, formatted})", () => {
    const event = {
      message: {
        message: "Lookup failed for student@example.org during checkin",
        formatted: "Lookup failed for student@example.org during checkin",
      },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const msgObj = out!.message as unknown as { message: string; formatted: string };
    expect(msgObj.message).not.toContain("@example.org");
    expect(msgObj.formatted).not.toContain("@example.org");
    expect(msgObj.message).toContain("[REDACTED]");
  });

  it("scrubs a classcode-shaped token out of event.message", () => {
    const event = {
      message: "Classcode AB12CDEF expired during login",
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const msg = out!.message as unknown as string;
    expect(msg).not.toContain("AB12CDEF");
    expect(msg).toContain("[REDACTED]");
  });

  it("scrubs an email out of exception.values[0].value", () => {
    const event = {
      exception: {
        values: [
          {
            type: "AuthError",
            value: "Token issued for parent@school.com is invalid",
          },
        ],
      },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out!.exception!.values![0].value).not.toContain("parent@school.com");
    expect(out!.exception!.values![0].value).toContain("[REDACTED]");
    // Type ("AuthError") is a class name — NOT an email, NOT a classcode-shape.
    expect(out!.exception!.values![0].type).toBe("AuthError");
  });

  it("scrubs a JWT-shape token (eyJ...) out of event.message", () => {
    const event = {
      message:
        "Refresh failed: token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature was rejected",
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const msg = out!.message as unknown as string;
    expect(msg).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
    expect(msg).toContain("[REDACTED]");
  });

  it("scrubs a Bearer token out of event.message", () => {
    const event = {
      message: "Header had Authorization: Bearer abc123def456 and was rejected",
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const msg = out!.message as unknown as string;
    expect(msg).not.toContain("abc123def456");
    expect(msg).toContain("Bearer [REDACTED]");
  });

  it("does NOT touch a benign exception with no PII shapes", () => {
    const event = {
      exception: {
        values: [{ type: "TypeError", value: "Cannot read property 'foo' of undefined" }],
      },
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    expect(out!.exception!.values![0].value).toBe(
      "Cannot read property 'foo' of undefined",
    );
    expect(out!.exception!.values![0].type).toBe("TypeError");
  });

  it("scrubs all 4 pattern shapes in a single multi-leak message", () => {
    const event = {
      message:
        "User maya@school.com (classcode AB12CDEF) sent Bearer xyz999 with eyJhbc.def.ghi",
    } as unknown as ErrorEvent;
    const out = beforeSend(event, {});
    const msg = out!.message as unknown as string;
    expect(msg).not.toContain("@school.com");
    expect(msg).not.toContain("AB12CDEF");
    expect(msg).not.toContain("xyz999");
    expect(msg).not.toMatch(/eyJ[\w-]+\.[\w-]+\.[\w-]+/);
  });
});

describe("beforeBreadcrumb", () => {
  it("redacts query strings on fetch URLs", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: { url: "https://api.example.com/x?email=a%40b.com&topic=ok", method: "GET" },
    };
    const out = beforeBreadcrumb(crumb);
    expect(out).not.toBeNull();
    const url = out!.data!.url as string;
    expect(url).toContain("email=%5BREDACTED%5D");
    expect(url).toContain("topic=ok");
  });

  it("scrubs PII keys from breadcrumb data", () => {
    const crumb: Breadcrumb = {
      category: "console",
      data: { studentEmail: "x@y.com", topic: "ok" },
    };
    const out = beforeBreadcrumb(crumb);
    expect((out!.data as { studentEmail: string; topic: string }).studentEmail).toBe("[REDACTED]");
    expect((out!.data as { studentEmail: string; topic: string }).topic).toBe("ok");
  });

  // F-20 9 May 2026 — UUID segments in path get redacted (not just query).
  it("redacts UUID segments in /api/storage/responses/{uuid}/... breadcrumb URLs", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "/api/storage/responses/f706d6d1-ab8f-4d6c-b3d1-52dc076d1343/avatar/img.jpg",
        method: "GET",
      },
    };
    const out = beforeBreadcrumb(crumb);
    const url = out!.data!.url as string;
    expect(url).not.toContain("f706d6d1-ab8f-4d6c-b3d1-52dc076d1343");
    expect(url).toContain("[REDACTED]");
    // Path structure preserved
    expect(url).toContain("/api/storage/responses/");
    expect(url).toContain("/avatar/img.jpg");
  });

  it("redacts UUID segments in unit-images / knowledge-media URLs too", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "https://www.studioloom.org/api/storage/unit-images/abcdef01-2345-6789-abcd-ef0123456789/thumb.jpg",
        method: "GET",
      },
    };
    const out = beforeBreadcrumb(crumb);
    const url = out!.data!.url as string;
    expect(url).not.toContain("abcdef01-2345-6789-abcd-ef0123456789");
    expect(url).toContain("[REDACTED]");
  });

  it("redacts UUID segments AND query-string PII in the same URL", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "/api/storage/responses/11111111-1111-1111-1111-111111111111/x.jpg?email=leak%40example.com&token=abc",
        method: "GET",
      },
    };
    const out = beforeBreadcrumb(crumb);
    const url = out!.data!.url as string;
    expect(url).not.toContain("11111111-1111-1111-1111-111111111111");
    expect(url).not.toContain("leak%40example.com");
    expect(url).not.toContain("leak@example.com");
    // Both redacted
    expect(url.match(/\[REDACTED\]|%5BREDACTED%5D/g)?.length).toBeGreaterThan(1);
  });

  it("does NOT redact non-UUID path segments", () => {
    const crumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: "/api/teacher/badges/12345678-1234-1234-1234-123456789012/results",
        method: "GET",
      },
    };
    const out = beforeBreadcrumb(crumb);
    const url = out!.data!.url as string;
    // The badge id IS a UUID — gets redacted (correct). The static
    // /api/teacher/badges/ + /results portions remain intact.
    expect(url).toContain("/api/teacher/badges/");
    expect(url).toContain("/results");
    expect(url).not.toContain("12345678-1234-1234-1234-123456789012");
  });
});
