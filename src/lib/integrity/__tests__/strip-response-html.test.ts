import { describe, it, expect } from "vitest";
import { stripResponseHtml } from "../strip-response-html";

describe("stripResponseHtml", () => {
  it("returns plain text unchanged", () => {
    expect(stripResponseHtml("Hello world.")).toBe("Hello world.");
  });

  it("returns empty string for non-strings + empty", () => {
    expect(stripResponseHtml(null)).toBe("");
    expect(stripResponseHtml(undefined)).toBe("");
    expect(stripResponseHtml({})).toBe("");
    expect(stripResponseHtml(123)).toBe("");
    expect(stripResponseHtml("")).toBe("");
  });

  it("strips a vocabulary look-up button to its inner text", () => {
    const html =
      'A <button type="button" class="inline border-0 bg-transparent" aria-label="Look up marble">marble</button> rolls down.';
    expect(stripResponseHtml(html)).toBe("A marble rolls down.");
  });

  it("strips multiple consecutive look-up buttons + style spans", () => {
    const html =
      '<span style="color: oklch(0.21 0.034 264.665); font-size: 20px;">Top</span><button aria-label="Look up of">of</button><span>&nbsp;</span><button aria-label="Look up the">the</button> hill.';
    expect(stripResponseHtml(html)).toBe("Topof the hill.");
    // Note: tight concatenation when buttons are adjacent (no space).
    // That mirrors the source string, which has no whitespace between
    // <span></span> and the next <button>. Good enough — teacher sees
    // prose, not markup.
  });

  it("decodes &nbsp;, &amp;, &lt;, &gt;, &quot;, &#39;, &apos;", () => {
    expect(stripResponseHtml("a&nbsp;b")).toBe("a b");
    expect(stripResponseHtml("Tom&amp;Jerry")).toBe("Tom&Jerry");
    expect(stripResponseHtml("&lt;tag&gt;")).toBe("<tag>");
    expect(stripResponseHtml("&quot;hi&quot;")).toBe('"hi"');
    expect(stripResponseHtml("it&#39;s")).toBe("it's");
    expect(stripResponseHtml("it&apos;s")).toBe("it's");
  });

  it("converts block-level boundaries to paragraph breaks (2 newlines)", () => {
    const html = "<p>One.</p><p>Two.</p><p>Three.</p>";
    // Each </p> + <p> pair produces \n\n — preserves the paragraph break for
    // readability. Max collapse is 2 consecutive (3+ → 2).
    expect(stripResponseHtml(html)).toBe("One.\n\nTwo.\n\nThree.");
  });

  it("converts <br> to newline", () => {
    expect(stripResponseHtml("Line A<br>Line B")).toBe("Line A\nLine B");
    expect(stripResponseHtml("Line A<br/>Line B")).toBe("Line A\nLine B");
    expect(stripResponseHtml("Line A<br />Line B")).toBe("Line A\nLine B");
  });

  it("collapses runs of spaces to a single space", () => {
    expect(stripResponseHtml("a   b\t\tc")).toBe("a b c");
  });

  it("trims leading + trailing whitespace", () => {
    expect(stripResponseHtml("  <p>hello</p>  ")).toBe("hello");
  });

  it("survives the screenshot scenario — Look-up-word wall", () => {
    // Compressed version of the actual screenshot input
    const html = `<button type="button" class="inline border-0 bg-transparent p-0 m-0 font-inherit text-inherit cursor-pointer" aria-label="Look up Top">Top</button><span style="color: oklch(0.21 0.034 264.665); font-size: 20px; font-weight: 600; background-color: rgb(245, 241, 234);">&nbsp;</span><button aria-label="Look up of">of</button><span>&nbsp;</span><button aria-label="Look up the">the</button><span>&nbsp;</span><button aria-label="Look up hill">hill</button>,<span>&nbsp;</span><button aria-label="Look up first">first</button>.`;
    const result = stripResponseHtml(html);
    expect(result).toContain("Top");
    expect(result).toContain("of");
    expect(result).toContain("hill");
    expect(result).not.toContain("button");
    expect(result).not.toContain("oklch");
    expect(result).not.toContain("aria-label");
    expect(result).not.toContain("&nbsp");
    // No raw HTML markup leaks through
    expect(result).not.toMatch(/<[a-z]/);
  });
});
