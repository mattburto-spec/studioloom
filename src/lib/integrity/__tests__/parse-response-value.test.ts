import { describe, it, expect } from "vitest";
import {
  parseResponseValue,
  formatFileSize,
} from "../parse-response-value";

describe("parseResponseValue", () => {
  it("returns null for non-string input", () => {
    expect(parseResponseValue(null)).toBeNull();
    expect(parseResponseValue(undefined)).toBeNull();
    expect(parseResponseValue(42)).toBeNull();
    expect(parseResponseValue({ type: "upload" })).toBeNull();
    expect(parseResponseValue([])).toBeNull();
  });

  it("returns null for plain text strings", () => {
    expect(parseResponseValue("Hello world.")).toBeNull();
    expect(parseResponseValue("")).toBeNull();
    expect(parseResponseValue("not json at all")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseResponseValue("{not valid json}")).toBeNull();
    expect(parseResponseValue("{")).toBeNull();
  });

  it("returns null for JSON without a recognised type", () => {
    expect(parseResponseValue('{"foo":"bar"}')).toBeNull();
    expect(parseResponseValue('{"type":"unknown","url":"x"}')).toBeNull();
  });

  it("parses an image upload (mimeType image/*)", () => {
    const raw =
      '{"type":"upload","url":"https://example.com/foo.png","filename":"foo.png","size":12345,"mimeType":"image/png"}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "upload",
      url: "https://example.com/foo.png",
      filename: "foo.png",
      size: 12345,
      mimeType: "image/png",
      isImage: true,
    });
  });

  it("parses a non-image upload (PDF) — isImage:false", () => {
    const raw =
      '{"type":"upload","url":"https://example.com/report.pdf","filename":"report.pdf","size":98765,"mimeType":"application/pdf"}';
    const result = parseResponseValue(raw);
    expect(result).toMatchObject({
      kind: "upload",
      isImage: false,
      mimeType: "application/pdf",
    });
  });

  it("parses an upload with missing size + mimeType (defaults null + isImage:false)", () => {
    const raw = '{"type":"upload","url":"https://x.com/f","filename":"f"}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "upload",
      url: "https://x.com/f",
      filename: "f",
      size: null,
      mimeType: null,
      isImage: false,
    });
  });

  it("rejects an upload missing url or filename (returns null)", () => {
    expect(parseResponseValue('{"type":"upload","filename":"x"}')).toBeNull();
    expect(parseResponseValue('{"type":"upload","url":"x"}')).toBeNull();
  });

  it("parses a link with title", () => {
    const raw = '{"type":"link","url":"https://example.com","title":"Example"}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "link",
      url: "https://example.com",
      title: "Example",
    });
  });

  it("parses a link without title (title:null)", () => {
    const raw = '{"type":"link","url":"https://example.com"}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "link",
      url: "https://example.com",
      title: null,
    });
  });

  it("treats whitespace-only title as null", () => {
    const raw = '{"type":"link","url":"https://example.com","title":"   "}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "link",
      url: "https://example.com",
      title: null,
    });
  });

  it("parses a voice recording with duration", () => {
    const raw = '{"type":"voice","url":"https://x.com/v.mp3","duration":12.5}';
    expect(parseResponseValue(raw)).toEqual({
      kind: "voice",
      url: "https://x.com/v.mp3",
      duration: 12.5,
    });
  });

  it("survives the production screenshot — Supabase-storage upload payload", () => {
    const raw =
      '{"type":"upload","url":"https://cxxbfmnbwihuskaaltlk.supabase.co/storage/v1/object/public/responses/abc.png","filename":"Screenshot 2026-05-04 at 6.49.02 pm.png","size":95663,"mimeType":"image/png"}';
    const result = parseResponseValue(raw);
    expect(result?.kind).toBe("upload");
    if (result?.kind === "upload") {
      expect(result.isImage).toBe(true);
      expect(result.filename).toBe("Screenshot 2026-05-04 at 6.49.02 pm.png");
      expect(result.size).toBe(95663);
    }
  });
});

describe("formatFileSize", () => {
  it("formats bytes < 1KB as 'N B'", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats bytes < 1MB as 'N KB' (rounded)", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(95663)).toBe("93 KB");
    expect(formatFileSize(1024 * 1023)).toBe("1023 KB");
  });

  it("formats >= 1MB as 'N.N MB' (1 decimal)", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
    expect(formatFileSize(10 * 1024 * 1024)).toBe("10.0 MB");
  });
});
