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
});
