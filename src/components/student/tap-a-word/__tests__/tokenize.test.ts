import { describe, it, expect } from "vitest";
import { tokenize, type Token } from "../tokenize";

const tappableWords = (tokens: Token[]): string[] =>
  tokens.filter((t) => t.tappable).map((t) => t.text);

const allText = (tokens: Token[]): string =>
  tokens.map((t) => t.text).join("");

describe("tokenize", () => {
  it("splits a simple sentence into 4 tappable words and skips the period", () => {
    const tokens = tokenize("Sort your interview notes.");
    expect(tappableWords(tokens)).toEqual(["Sort", "your", "interview", "notes"]);
    // 4 words + 3 spaces + 1 period = 8 tokens
    expect(tokens).toHaveLength(8);
    expect(allText(tokens)).toBe("Sort your interview notes.");
  });

  it("treats internal apostrophes as part of the word", () => {
    const tokens = tokenize("don't worry");
    expect(tappableWords(tokens)).toEqual(["don't", "worry"]);
    expect(tokens).toHaveLength(3); // 2 words + 1 space
  });

  it("treats internal hyphens as part of the word", () => {
    const tokens = tokenize("project-based learning");
    expect(tappableWords(tokens)).toEqual(["project-based", "learning"]);
    expect(tokens).toHaveLength(3);
  });

  it("skips URLs entirely (the whole non-whitespace chunk is untappable)", () => {
    const tokens = tokenize("Visit https://example.com today");
    expect(tappableWords(tokens)).toEqual(["Visit", "today"]);
    // Verify the URL chunk's sub-tokens (https, ://, example, ., com) are all untappable
    const urlSubTokens = tokens.filter(
      (t) => t.text === "https" || t.text === "example" || t.text === "com"
    );
    expect(urlSubTokens.every((t) => !t.tappable)).toBe(true);
    expect(allText(tokens)).toBe("Visit https://example.com today");
  });

  it("skips 1-char letter tokens and pure numbers", () => {
    const tokens = tokenize("I am 12");
    // "I" is too short, "12" is digits (not letters)
    expect(tappableWords(tokens)).toEqual(["am"]);
    expect(tokens).toHaveLength(5); // I, _, am, _, 12
  });

  it("returns [] on empty string", () => {
    expect(tokenize("")).toEqual([]);
  });

  it("treats whitespace-only input as a single untappable token", () => {
    const tokens = tokenize("   ");
    expect(tokens).toEqual([{ text: "   ", tappable: false }]);
  });

  it("preserves the original text exactly when joined", () => {
    const inputs = [
      "Sort your interview notes.",
      "don't worry",
      "project-based learning",
      "Visit https://example.com today",
      "I am 12",
      "Hello, world! How are you?",
    ];
    for (const input of inputs) {
      expect(allText(tokenize(input))).toBe(input);
    }
  });

  it("handles Unicode letters (international content)", () => {
    const tokens = tokenize("café résumé");
    expect(tappableWords(tokens)).toEqual(["café", "résumé"]);
  });

  it("handles curly apostrophes (U+2019)", () => {
    // Note: source uses U+2019, the curly right single quotation mark
    const tokens = tokenize("don’t worry");
    expect(tappableWords(tokens)).toEqual(["don’t", "worry"]);
  });

  it("treats trailing punctuation as separate untappable tokens", () => {
    const tokens = tokenize("Hello, world!");
    expect(tappableWords(tokens)).toEqual(["Hello", "world"]);
    // Hello + , + space + world + !
    expect(tokens).toHaveLength(5);
    expect(tokens[1]).toEqual({ text: ",", tappable: false });
    expect(tokens[4]).toEqual({ text: "!", tappable: false });
  });

  it("does not treat leading apostrophes as part of the word", () => {
    const tokens = tokenize("'twas brillig");
    // ' is its own punct token, twas is a word, _, brillig is a word
    expect(tappableWords(tokens)).toEqual(["twas", "brillig"]);
    expect(tokens[0]).toEqual({ text: "'", tappable: false });
  });

  it("counts every token text in the result", () => {
    const tokens = tokenize("a b cd");
    // a (1 char, untappable letter), space, b (1 char, untappable), space, cd (2+ char, tappable)
    expect(tokens.map((t) => ({ text: t.text, tappable: t.tappable }))).toEqual([
      { text: "a", tappable: false },
      { text: " ", tappable: false },
      { text: "b", tappable: false },
      { text: " ", tappable: false },
      { text: "cd", tappable: true },
    ]);
  });
});

// ---------------------------------------------------------------------------
// NEGATIVE CONTROL note (manual; not a passing test):
// To verify the test suite actually catches regressions, mutate
// `MIN_TAPPABLE_LENGTH = 2` → `MIN_TAPPABLE_LENGTH = 1` in tokenize.ts.
// Expected failures on re-run:
//   - "skips 1-char letter tokens and pure numbers" (now "I" is also tappable)
//   - "counts every token text in the result" ("a" and "b" both flip to tappable)
// Revert via the Edit tool (NOT git checkout — file is uncommitted at NC time
// per Lesson #41), then re-run to confirm green.
// ---------------------------------------------------------------------------
