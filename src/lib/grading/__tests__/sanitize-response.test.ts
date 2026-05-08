import { describe, it, expect } from "vitest";
import { sanitizeResponseText } from "../sanitize-response";

describe("sanitizeResponseText", () => {
  it("returns empty string for null/undefined/empty input", () => {
    expect(sanitizeResponseText(null)).toBe("");
    expect(sanitizeResponseText(undefined)).toBe("");
    expect(sanitizeResponseText("")).toBe("");
  });

  it("passes plain text through unchanged", () => {
    expect(sanitizeResponseText("hello world")).toBe("hello world");
  });

  it("converts contenteditable <div> structure to newlines", () => {
    const raw = "start timyalkjfkld<div>asdfsd</div><div>asdfsad</div><div>asdfsa</div><div><br></div>";
    expect(sanitizeResponseText(raw)).toBe(
      "start timyalkjfkld\nasdfsd\nasdfsad\nasdfsa",
    );
  });

  it("converts <br> tags to newlines (with and without self-closing slash)", () => {
    expect(sanitizeResponseText("a<br>b<br/>c<br />d")).toBe("a\nb\nc\nd");
  });

  it("strips <span>, <strong>, <em> and other formatting tags", () => {
    expect(sanitizeResponseText("hello <strong>bold</strong> and <em>italic</em>")).toBe(
      "hello bold and italic",
    );
    expect(sanitizeResponseText('text with <span class="x">span</span>')).toBe(
      "text with span",
    );
  });

  it("collapses 3+ consecutive newlines into 2 (paragraph break max)", () => {
    expect(sanitizeResponseText("a<br><br><br><br>b")).toBe("a\n\nb");
  });

  it("decodes common HTML entities", () => {
    expect(sanitizeResponseText("a &amp; b")).toBe("a & b");
    expect(sanitizeResponseText("&lt;script&gt;")).toBe("<script>");
    expect(sanitizeResponseText("she said &quot;hi&quot;")).toBe('she said "hi"');
    expect(sanitizeResponseText("non&nbsp;breaking")).toBe("non breaking");
  });

  it("decodes numeric entities defensively", () => {
    expect(sanitizeResponseText("smile &#8482;")).toBe("smile ™");
  });

  it("converts <p> blocks like <div> blocks", () => {
    expect(sanitizeResponseText("<p>one</p><p>two</p>")).toBe("one\ntwo");
  });

  it("converts <li> blocks like <div> blocks (no bullets, just lines)", () => {
    expect(sanitizeResponseText("<ul><li>one</li><li>two</li></ul>")).toBe("one\ntwo");
  });

  it("strips dangerous tags (defensive — output is rendered as text anyway)", () => {
    expect(sanitizeResponseText('<script>alert("x")</script>safe text')).toBe('alert("x")safe text');
    expect(sanitizeResponseText('<img src="x" onerror="hack()">caption')).toBe("caption");
  });

  it("trims leading + trailing whitespace", () => {
    expect(sanitizeResponseText("<div>hello</div>")).toBe("hello");
    expect(sanitizeResponseText("   plain   ")).toBe("plain");
  });

  it("preserves intentional double-newlines for paragraph breaks", () => {
    expect(sanitizeResponseText("para 1<br><br>para 2")).toBe("para 1\n\npara 2");
  });
});
