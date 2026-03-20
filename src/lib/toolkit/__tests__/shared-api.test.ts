/**
 * Tests for shared toolkit API helpers.
 *
 * These functions are called by every toolkit route — one bug breaks 25 routes.
 * Focus on parseToolkitJSON and parseToolkitJSONArray since they handle
 * unpredictable AI output.
 */

import { describe, it, expect } from "vitest";
import { parseToolkitJSON, parseToolkitJSONArray } from "../shared-api";

// ---------------------------------------------------------------------------
// parseToolkitJSON
// ---------------------------------------------------------------------------

describe("parseToolkitJSON", () => {
  const fallback = { acknowledgment: "", nudge: "", effortLevel: "medium" };

  it("parses clean JSON", () => {
    const input = '{"acknowledgment":"Nice!","nudge":"What else?","effortLevel":"high"}';
    const result = parseToolkitJSON(input, fallback);
    expect(result.acknowledgment).toBe("Nice!");
    expect(result.nudge).toBe("What else?");
    expect(result.effortLevel).toBe("high");
  });

  it("parses JSON wrapped in markdown code block", () => {
    const input = `Here's the feedback:
\`\`\`json
{"acknowledgment":"Good start","nudge":"Go deeper","effortLevel":"medium"}
\`\`\``;
    const result = parseToolkitJSON(input, fallback);
    expect(result.acknowledgment).toBe("Good start");
    expect(result.nudge).toBe("Go deeper");
  });

  it("extracts fields via regex when JSON is malformed", () => {
    const input = 'Sure! Here\'s feedback: "acknowledgment": "Great idea", and "nudge": "Try another angle"';
    const result = parseToolkitJSON(input, fallback);
    expect(result.acknowledgment).toBe("Great idea");
    expect(result.nudge).toBe("Try another angle");
  });

  it("returns fallback when nothing can be extracted", () => {
    const input = "I don't know what to say";
    const result = parseToolkitJSON(input, fallback);
    expect(result).toEqual(fallback);
  });

  it("handles JSON with extra text before and after", () => {
    const input = 'Here is the response: {"acknowledgment":"Yes","nudge":"More?","effortLevel":"low"} Hope that helps!';
    const result = parseToolkitJSON(input, fallback);
    expect(result.acknowledgment).toBe("Yes");
    expect(result.effortLevel).toBe("low");
  });

  it("handles empty string input", () => {
    const result = parseToolkitJSON("", fallback);
    expect(result).toEqual(fallback);
  });

  it("handles JSON with newlines inside values", () => {
    const input = '{"acknowledgment":"Line 1\\nLine 2","nudge":"Think more","effortLevel":"high"}';
    const result = parseToolkitJSON(input, fallback);
    expect(result.acknowledgment).toBe("Line 1\nLine 2");
  });

  it("preserves unknown fields from AI response", () => {
    const input = '{"acknowledgment":"Hi","nudge":"Go","effortLevel":"high","bonus":"extra"}';
    const result = parseToolkitJSON(input, fallback);
    expect((result as Record<string, unknown>).bonus).toBe("extra");
  });
});

// ---------------------------------------------------------------------------
// parseToolkitJSONArray
// ---------------------------------------------------------------------------

describe("parseToolkitJSONArray", () => {
  it("parses clean JSON array", () => {
    const input = '["insight one", "insight two", "insight three"]';
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["insight one", "insight two", "insight three"]);
  });

  it("parses array wrapped in markdown", () => {
    const input = `Here are the insights:
\`\`\`json
["first", "second"]
\`\`\``;
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["first", "second"]);
  });

  it("extracts quoted strings as last resort", () => {
    const input = 'The key insights are "innovation matters" and "users come first"';
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["innovation matters", "users come first"]);
  });

  it("returns null when nothing extractable", () => {
    const input = "No structured data here at all";
    const result = parseToolkitJSONArray(input);
    expect(result).toBeNull();
  });

  it("trims whitespace from array items", () => {
    const input = '["  padded  ", "  also padded  "]';
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["padded", "also padded"]);
  });

  it("handles array with extra text around it", () => {
    const input = 'Response: ["one", "two"] done.';
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["one", "two"]);
  });

  it("converts non-string array items to strings", () => {
    const input = '["text", 42, true]';
    const result = parseToolkitJSONArray(input);
    expect(result).toEqual(["text", "42", "true"]);
  });
});
