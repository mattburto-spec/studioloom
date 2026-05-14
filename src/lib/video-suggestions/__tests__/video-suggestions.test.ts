/**
 * Unit tests for the pure helpers backing the AI video suggestions
 * route. No DOM, no mocked Supabase, no Anthropic — just text and
 * shape transforms.
 *
 * The orchestrator route at /api/teacher/suggest-videos is covered by
 * Vercel preview smoke tests + the source-static API-registry scanner.
 */
import { describe, it, expect } from "vitest";
import {
  composeUserPrompt,
  heuristicQuery,
  sanitiseQuery,
} from "../build-query";
import {
  parseIsoDurationSeconds,
  pickThumbnail,
  mergeIntoRawItems,
} from "../fetch-youtube";
import {
  composeRerankPrompt,
  assembleCandidates,
} from "../rerank";
import type { YouTubeRawItem } from "../types";

describe("build-query — composeUserPrompt", () => {
  it("includes only the fields that are present", () => {
    const out = composeUserPrompt({
      unitTitle: "Empathy in Aged Care",
      gradeLevel: "Year 7",
      task: "Conduct three empathy interviews with residents.",
    });
    expect(out).toContain("Unit: Empathy in Aged Care");
    expect(out).toContain("Grade level: Year 7");
    expect(out).toContain("Task: Conduct three empathy interviews");
    expect(out).not.toContain("Subject:");
    expect(out).not.toContain("Framing:");
    expect(out).toContain("Return only the search query");
  });
});

describe("build-query — heuristicQuery", () => {
  it("concatenates grade, subject, unit and the first words of framing/task", () => {
    const out = heuristicQuery({
      gradeLevel: "Year 7",
      subject: "Design Technology",
      unitTitle: "Aged Care",
      framing: "We learn to listen for friction in everyday tasks.",
    });
    expect(out).toMatch(/^Year 7 Design Technology Aged Care/);
    // First six words of framing should be appended.
    expect(out).toContain("We learn to listen for friction");
  });

  it("works with a minimal context (only one field)", () => {
    const out = heuristicQuery({ task: "Centre of mass demo." });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("Centre of mass");
  });

  it("caps total length at 120 chars", () => {
    const long = "x".repeat(500);
    const out = heuristicQuery({ task: long });
    expect(out.length).toBeLessThanOrEqual(120);
  });
});

describe("build-query — sanitiseQuery", () => {
  it("strips wrapping quotes and collapses whitespace", () => {
    expect(sanitiseQuery('  "  empathy interviews   year 7  "  ')).toBe(
      "empathy interviews year 7",
    );
  });

  it("collapses newlines to spaces", () => {
    expect(sanitiseQuery("foo\nbar\r\nbaz")).toBe("foo bar baz");
  });

  it("caps at 120 chars", () => {
    const out = sanitiseQuery("a ".repeat(200));
    expect(out.length).toBeLessThanOrEqual(120);
  });
});

describe("fetch-youtube — parseIsoDurationSeconds", () => {
  it("parses minute+second form (PT5M30S)", () => {
    expect(parseIsoDurationSeconds("PT5M30S")).toBe(330);
  });

  it("parses hour+minute+second form (PT1H2M3S)", () => {
    expect(parseIsoDurationSeconds("PT1H2M3S")).toBe(3723);
  });

  it("parses seconds-only (PT45S)", () => {
    expect(parseIsoDurationSeconds("PT45S")).toBe(45);
  });

  it("parses minutes-only (PT10M)", () => {
    expect(parseIsoDurationSeconds("PT10M")).toBe(600);
  });

  it("returns 0 for empty / malformed input", () => {
    expect(parseIsoDurationSeconds("")).toBe(0);
    expect(parseIsoDurationSeconds("garbage")).toBe(0);
    expect(parseIsoDurationSeconds("5:30")).toBe(0);
  });
});

describe("fetch-youtube — pickThumbnail", () => {
  it("prefers medium over default and high", () => {
    const url = pickThumbnail({
      default: { url: "DEFAULT" },
      medium: { url: "MEDIUM" },
      high: { url: "HIGH" },
    });
    expect(url).toBe("MEDIUM");
  });

  it("falls back to high then default", () => {
    expect(pickThumbnail({ high: { url: "H" }, default: { url: "D" } })).toBe(
      "H",
    );
    expect(pickThumbnail({ default: { url: "D" } })).toBe("D");
  });

  it("returns empty string when no thumbnails", () => {
    expect(pickThumbnail({})).toBe("");
  });
});

describe("fetch-youtube — mergeIntoRawItems", () => {
  const baseSnippet = {
    title: "Empathy interviews for designers",
    channelTitle: "Crash Course Design",
    description: "Short intro.",
    thumbnails: { medium: { url: "thumb.jpg" } },
  };

  it("merges search + details + filters non-embeddable", () => {
    const search = [
      { id: { videoId: "OK1" }, snippet: baseSnippet },
      { id: { videoId: "NOPE" }, snippet: baseSnippet },
    ];
    const details = new Map([
      [
        "OK1",
        {
          id: "OK1",
          status: { embeddable: true },
          contentDetails: { duration: "PT8M" },
        },
      ],
      [
        "NOPE",
        {
          id: "NOPE",
          status: { embeddable: false },
          contentDetails: { duration: "PT8M" },
        },
      ],
    ]);
    const out = mergeIntoRawItems(search, details, { maxDurationSeconds: 1200 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject<Partial<YouTubeRawItem>>({
      videoId: "OK1",
      durationSeconds: 480,
      thumbnail: "thumb.jpg",
      embeddable: true,
    });
  });

  it("filters out videos longer than maxDurationSeconds", () => {
    const search = [{ id: { videoId: "LONG" }, snippet: baseSnippet }];
    const details = new Map([
      [
        "LONG",
        {
          id: "LONG",
          status: { embeddable: true },
          contentDetails: { duration: "PT45M" },
        },
      ],
    ]);
    const out = mergeIntoRawItems(search, details, { maxDurationSeconds: 1200 });
    expect(out).toHaveLength(0);
  });

  it("drops items with no details match", () => {
    const search = [{ id: { videoId: "ORPHAN" }, snippet: baseSnippet }];
    const out = mergeIntoRawItems(search, new Map(), { maxDurationSeconds: 1200 });
    expect(out).toHaveLength(0);
  });

  it("drops items with zero duration (unparseable)", () => {
    const search = [{ id: { videoId: "BAD" }, snippet: baseSnippet }];
    const details = new Map([
      [
        "BAD",
        {
          id: "BAD",
          status: { embeddable: true },
          contentDetails: { duration: "garbage" },
        },
      ],
    ]);
    const out = mergeIntoRawItems(search, details, { maxDurationSeconds: 1200 });
    expect(out).toHaveLength(0);
  });
});

describe("rerank — composeRerankPrompt", () => {
  it("includes context lines and numbered candidates", () => {
    const items: YouTubeRawItem[] = [
      {
        videoId: "abc",
        title: "Empathy mapping basics",
        channelTitle: "IDEO",
        description: "A short overview…",
        thumbnail: "t.jpg",
        durationSeconds: 360,
        embeddable: true,
      },
    ];
    const out = composeRerankPrompt(
      { task: "Run empathy interviews", gradeLevel: "Year 7" },
      items,
    );
    expect(out).toContain("Grade level: Year 7");
    expect(out).toContain("Task: Run empathy interviews");
    expect(out).toContain("[1] videoId=abc");
    expect(out).toContain("title: Empathy mapping basics");
    expect(out).toContain("channel: IDEO");
    expect(out).toContain("duration: 6 min");
    expect(out).toContain("submit_rerank");
  });
});

describe("rerank — assembleCandidates", () => {
  const items: YouTubeRawItem[] = [
    {
      videoId: "A",
      title: "Alpha",
      channelTitle: "ChA",
      description: "",
      thumbnail: "tA",
      durationSeconds: 300,
      embeddable: true,
    },
    {
      videoId: "B",
      title: "Beta",
      channelTitle: "ChB",
      description: "",
      thumbnail: "tB",
      durationSeconds: 400,
      embeddable: true,
    },
  ];

  it("matches picks back to source items and builds the URL", () => {
    const out = assembleCandidates(
      [
        { videoId: "B", caption: "Fits because of X." },
        { videoId: "A", caption: "Fits because of Y." },
      ],
      items,
    );
    expect(out).toHaveLength(2);
    expect(out[0].videoId).toBe("B");
    expect(out[0].url).toBe("https://www.youtube.com/watch?v=B");
    expect(out[0].caption).toBe("Fits because of X.");
    expect(out[1].videoId).toBe("A");
  });

  it("drops picks whose videoId isn't in the candidate set (hallucination guard)", () => {
    const out = assembleCandidates(
      [
        { videoId: "A", caption: "real" },
        { videoId: "MADE_UP", caption: "hallucinated" },
      ],
      items,
    );
    expect(out).toHaveLength(1);
    expect(out[0].videoId).toBe("A");
  });

  it("returns empty array when no picks provided", () => {
    expect(assembleCandidates([], items)).toEqual([]);
  });

  it("trims whitespace from captions", () => {
    const out = assembleCandidates(
      [{ videoId: "A", caption: "  padded.  " }],
      items,
    );
    expect(out[0].caption).toBe("padded.");
  });
});
