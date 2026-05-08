/**
 * Tests for the storage proxy URL helper (security-plan.md P-3).
 */
import { describe, it, expect } from "vitest";
import { buildStorageProxyUrl, parseStorageUrl } from "../proxy-url";

describe("buildStorageProxyUrl", () => {
  it("builds for the responses bucket", () => {
    expect(buildStorageProxyUrl("responses", "abc/avatar/img.jpg")).toBe(
      "/api/storage/responses/abc/avatar/img.jpg",
    );
  });

  it("encodes path segments individually but preserves slashes", () => {
    expect(buildStorageProxyUrl("responses", "abc/foo bar/img.jpg")).toBe(
      "/api/storage/responses/abc/foo%20bar/img.jpg",
    );
  });

  it("encodes unicode + special characters", () => {
    expect(
      buildStorageProxyUrl("responses", "abc/résumé/file.pdf"),
    ).toBe("/api/storage/responses/abc/r%C3%A9sum%C3%A9/file.pdf");
  });

  it("works for unit-images and knowledge-media", () => {
    expect(buildStorageProxyUrl("unit-images", "123/thumb.png")).toBe(
      "/api/storage/unit-images/123/thumb.png",
    );
    expect(buildStorageProxyUrl("knowledge-media", "folder/image.webp")).toBe(
      "/api/storage/knowledge-media/folder/image.webp",
    );
  });

  it("throws for unknown buckets", () => {
    expect(() => buildStorageProxyUrl("foo", "bar")).toThrow(/not in allowlist/);
  });
});

describe("parseStorageUrl", () => {
  it("parses a proxy URL back to bucket + path", () => {
    expect(
      parseStorageUrl("/api/storage/responses/abc/avatar/img.jpg"),
    ).toEqual({ bucket: "responses", path: "abc/avatar/img.jpg" });
  });

  it("decodes encoded segments back to raw path", () => {
    expect(
      parseStorageUrl("/api/storage/responses/abc/foo%20bar/img.jpg"),
    ).toEqual({ bucket: "responses", path: "abc/foo bar/img.jpg" });
  });

  it("parses a legacy public Supabase URL", () => {
    expect(
      parseStorageUrl(
        "https://xxxx.supabase.co/storage/v1/object/public/responses/abc/avatar/img.jpg",
      ),
    ).toEqual({ bucket: "responses", path: "abc/avatar/img.jpg" });
  });

  it("parses a legacy signed Supabase URL (sign endpoint)", () => {
    expect(
      parseStorageUrl(
        "https://xxxx.supabase.co/storage/v1/object/sign/responses/abc/avatar/img.jpg?token=foo",
      ),
    ).toEqual({ bucket: "responses", path: "abc/avatar/img.jpg" });
  });

  it("rejects URLs from non-allowlisted buckets", () => {
    expect(
      parseStorageUrl(
        "https://xxxx.supabase.co/storage/v1/object/public/some-other-bucket/x.jpg",
      ),
    ).toBeNull();
  });

  it("returns null for unrelated URLs", () => {
    expect(parseStorageUrl("https://example.com/foo.jpg")).toBeNull();
    expect(parseStorageUrl("/api/teacher/units")).toBeNull();
    expect(parseStorageUrl("")).toBeNull();
  });

  it("round-trips: build then parse returns the same bucket + path", () => {
    const cases: { bucket: string; path: string }[] = [
      { bucket: "responses", path: "abc/avatar/img.jpg" },
      { bucket: "unit-images", path: "deep/nested/path/x.webp" },
      { bucket: "knowledge-media", path: "single.pdf" },
    ];
    for (const tc of cases) {
      const url = buildStorageProxyUrl(tc.bucket, tc.path);
      expect(parseStorageUrl(url)).toEqual(tc);
    }
  });
});
