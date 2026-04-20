import { describe, it, expect } from "vitest";
import { generateFabToken, hashFabToken } from "../token";

describe("generateFabToken", () => {
  it("produces 43-character base64url tokens (no padding)", () => {
    const token = generateFabToken();
    // 32 bytes → base64url → 43 chars (256/6 = 42.67 rounded up, no '=' padding)
    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces distinct tokens across calls", () => {
    const a = generateFabToken();
    const b = generateFabToken();
    expect(a).not.toBe(b);
  });
});

describe("hashFabToken", () => {
  it("produces 64-character hex SHA-256 digests", () => {
    const hash = hashFabToken("some-token");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashFabToken("abc")).toBe(hashFabToken("abc"));
  });

  it("differs across different inputs", () => {
    expect(hashFabToken("abc")).not.toBe(hashFabToken("abd"));
  });

  it("matches the known SHA-256 vector for empty string", () => {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hashFabToken("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });
});
