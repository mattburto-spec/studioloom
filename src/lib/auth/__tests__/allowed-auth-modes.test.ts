import { describe, it, expect } from "vitest";
import { resolveAllowedAuthModes, type AuthMode } from "../allowed-auth-modes";

const ALL: AuthMode[] = ["email_password", "google", "microsoft"];

describe("resolveAllowedAuthModes", () => {
  describe("no scope (no school, no class)", () => {
    it("returns the global default when school + class are null", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: null,
        classModes: null,
        globalModes: ALL,
      });
      expect(result).toEqual(ALL);
    });

    it("falls back to email_password if global is empty", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: null,
        classModes: null,
        globalModes: [],
      });
      expect(result).toEqual(["email_password"]);
    });
  });

  describe("school scope only", () => {
    it("returns the school's allowlist", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password"],
        classModes: null,
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password"]);
    });

    it("strips invalid modes from the school allowlist", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password", "facebook" as unknown as AuthMode],
        classModes: null,
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password"]);
    });
  });

  describe("class scope with NULL allowed_auth_modes", () => {
    it("inherits from the school", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password", "google"],
        classModes: null,
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password", "google"]);
    });
  });

  describe("class scope with non-null allowed_auth_modes", () => {
    it("intersects class with school", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password", "google", "microsoft"],
        classModes: ["email_password", "google"],
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password", "google"]);
    });

    it("strips a class mode that the school doesn't allow", () => {
      // Class tries to enable microsoft, school only allows email_password +
      // google. App-layer enforcement: class can only narrow, never widen.
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password", "google"],
        classModes: ["email_password", "google", "microsoft"],
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password", "google"]);
    });

    it("falls back to email_password when intersection is empty", () => {
      // School: email_password only. Class: google only. Intersection empty.
      // Safety net kicks in.
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password"],
        classModes: ["google"],
        globalModes: ALL,
      });
      expect(result).toEqual(["email_password"]);
    });
  });

  describe("safety-net guarantees", () => {
    it("always returns a non-empty array, even with all empty inputs", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: [],
        classModes: [],
        globalModes: [],
      });
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("email_password");
    });

    it("preserves email_password as last-resort fallback", () => {
      // No valid modes anywhere. Helper must not lock out the school.
      const result = resolveAllowedAuthModes({
        schoolModes: ["facebook" as unknown as AuthMode],
        classModes: null,
        globalModes: [],
      });
      expect(result).toEqual(["email_password"]);
    });
  });

  describe("apple forward-compat", () => {
    it("permits apple when present in school allowlist", () => {
      const result = resolveAllowedAuthModes({
        schoolModes: ["email_password", "apple"],
        classModes: null,
        globalModes: ["email_password", "google", "microsoft", "apple"],
      });
      expect(result).toEqual(["email_password", "apple"]);
    });
  });
});
