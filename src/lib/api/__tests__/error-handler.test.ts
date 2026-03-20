/**
 * Tests for the shared API error handler.
 */

import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { withErrorHandler } from "../error-handler";

function mockRequest(url = "http://localhost/api/test") {
  return new NextRequest(url, { method: "POST" });
}

describe("withErrorHandler", () => {
  it("passes through successful responses", async () => {
    const handler = withErrorHandler("test/route", async () => {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const response = await handler(mockRequest());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("catches thrown errors and returns 500", async () => {
    const handler = withErrorHandler("test/route", async () => {
      throw new Error("Something broke");
    });

    const response = await handler(mockRequest());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Internal server error");
  });

  it("catches non-Error throws", async () => {
    const handler = withErrorHandler("test/route", async () => {
      throw "string error";
    });

    const response = await handler(mockRequest());
    expect(response.status).toBe(500);
  });

  it("logs the error with route name", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = withErrorHandler("teacher/dashboard", async () => {
      throw new Error("DB connection failed");
    });

    await handler(mockRequest());

    expect(consoleSpy).toHaveBeenCalledWith(
      "[teacher/dashboard] Unhandled error:",
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});
