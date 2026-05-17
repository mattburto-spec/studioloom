import { describe, it, expect } from "vitest";
import { slugify, buildSlugWithId, parseSlugWithId, SLUG_ID_PREFIX_LENGTH } from "../slug";

describe("slugify", () => {
  it.each<[string | null | undefined, string]>([
    ["9 Design Science S2", "9-design-science-s2"],
    ["CO2 Dragsters #2", "co2-dragsters-2"],
    ["Mr. O'Brien's Year 7", "mr-obriens-year-7"],
    ["  spaces   collapsed  ", "spaces-collapsed"],
    ["", "untitled"],
    ["////", "untitled"],
    ["你好-world", "world"],
    [null, "untitled"],
    [undefined, "untitled"],
    ["Already-Kebab-Case", "already-kebab-case"],
    ["UPPERCASE", "uppercase"],
    // Quotes/apostrophes don't insert dashes (preserve word-shape)
    ["O'Brien", "obrien"],
    ["it's a test", "its-a-test"],
  ])("slugify(%j) → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe("buildSlugWithId", () => {
  it("builds <slug>-<6id> from a name + UUID", () => {
    expect(buildSlugWithId("9 Design Science S2", "b97888a4-c22e-49fb-b174-bec306729c2e"))
      .toBe("9-design-science-s2-b97888");
  });

  it("uses 'untitled' fallback when name is empty", () => {
    expect(buildSlugWithId("", "abcdef12-3456-7890-abcd-ef1234567890"))
      .toBe("untitled-abcdef");
  });

  it("throws when id is too short to extract the prefix", () => {
    expect(() => buildSlugWithId("Foo", "ab12")).toThrow(/shorter than/);
  });

  it("uses exactly SLUG_ID_PREFIX_LENGTH chars of the id", () => {
    const id = "1234567890abcdef-...";
    const result = buildSlugWithId("Foo", id);
    expect(result.split("-").pop()).toHaveLength(SLUG_ID_PREFIX_LENGTH);
  });
});

describe("parseSlugWithId", () => {
  it("parses new <slug>-<6id> format", () => {
    expect(parseSlugWithId("9-design-science-s2-b97888")).toEqual({
      slug: "9-design-science-s2",
      idPrefix: "b97888",
      isRawUuid: false,
    });
  });

  it("parses a raw UUID as legacy (isRawUuid: true)", () => {
    expect(parseSlugWithId("b97888a4-c22e-49fb-b174-bec306729c2e")).toEqual({
      slug: "",
      idPrefix: "b97888a4-c22e-49fb-b174-bec306729c2e",
      isRawUuid: true,
    });
  });

  it("UUID match is case-insensitive", () => {
    expect(parseSlugWithId("B97888A4-C22E-49FB-B174-BEC306729C2E").isRawUuid).toBe(true);
  });

  it("normalises slug-id suffix to lowercase", () => {
    expect(parseSlugWithId("Foo-ABC123").idPrefix).toBe("abc123");
  });

  it("falls back to whole-string idPrefix when format is unexpected", () => {
    expect(parseSlugWithId("malformed")).toEqual({
      slug: "",
      idPrefix: "malformed",
      isRawUuid: false,
    });
  });

  it("handles slugs that themselves contain dashes (round-trips with buildSlugWithId)", () => {
    const slug = buildSlugWithId("Year 7-A Co-op Class", "abc123de-f456-7890-abcd-ef1234567890");
    expect(slug).toBe("year-7-a-co-op-class-abc123");
    const parsed = parseSlugWithId(slug);
    expect(parsed.slug).toBe("year-7-a-co-op-class");
    expect(parsed.idPrefix).toBe("abc123");
    expect(parsed.isRawUuid).toBe(false);
  });
});
