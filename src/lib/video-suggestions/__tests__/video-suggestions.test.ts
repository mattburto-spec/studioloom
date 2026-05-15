/**
 * Unit tests for the pure helpers backing the AI video suggestions
 * route. No DOM, no mocked Supabase, no Anthropic — just text and
 * shape transforms.
 *
 * The orchestrator route at /api/teacher/suggest-videos is covered by
 * Vercel preview smoke tests + the source-static API-registry scanner.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  composeFinalQuery,
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

describe("build-query — composeFinalQuery (search criteria controls)", () => {
  it("returns the base query when no extras given", () => {
    expect(composeFinalQuery("empathy interviews year 7")).toBe(
      "empathy interviews year 7",
    );
  });

  it("appends extra keywords verbatim as positive terms", () => {
    expect(
      composeFinalQuery("empathy interviews", "animation primary school"),
    ).toBe("empathy interviews animation primary school");
  });

  it("prefixes exclude keywords with `-` for YouTube negation", () => {
    expect(composeFinalQuery("empathy", undefined, "music shorts")).toBe(
      "empathy -music -shorts",
    );
  });

  it("splits exclude keywords on commas as well as whitespace", () => {
    expect(composeFinalQuery("empathy", undefined, "music, shorts ,reaction")).toBe(
      "empathy -music -shorts -reaction",
    );
  });

  it("leaves exclude terms already prefixed with `-` as-is (power-user input)", () => {
    expect(composeFinalQuery("empathy", undefined, "-music shorts")).toBe(
      "empathy -music -shorts",
    );
  });

  it("combines extra + exclude correctly", () => {
    expect(
      composeFinalQuery(
        "empathy interviews",
        "animation",
        "music shorts",
      ),
    ).toBe("empathy interviews animation -music -shorts");
  });

  it("handles empty / whitespace-only extras as missing", () => {
    expect(composeFinalQuery("empathy", "   ", "  ")).toBe("empathy");
  });

  it("caps at 200 chars", () => {
    const long = "a ".repeat(200);
    expect(composeFinalQuery("base", long).length).toBeLessThanOrEqual(200);
  });
});

describe("composeRerankPrompt — count + teacher keywords surface in prompt", () => {
  const item: YouTubeRawItem = {
    videoId: "abc",
    title: "Empathy mapping basics",
    channelTitle: "IDEO",
    description: "Short overview",
    thumbnail: "t",
    durationSeconds: 360,
    embeddable: true,
  };

  it("default count=3 reflects in the instruction sentence", () => {
    const out = composeRerankPrompt(
      { task: "Run empathy interviews" },
      [item],
    );
    expect(out).toContain("up to 3 picks");
    expect(out).toContain("Never exceed 3");
  });

  it("count=5 propagates to the instruction sentence", () => {
    const out = composeRerankPrompt(
      { task: "Run empathy interviews" },
      [item],
      5,
    );
    expect(out).toContain("up to 5 picks");
    expect(out).toContain("Never exceed 5");
  });

  it("count=10 propagates to the instruction sentence", () => {
    const out = composeRerankPrompt(
      { task: "Run empathy interviews" },
      [item],
      10,
    );
    expect(out).toContain("up to 10 picks");
  });

  it("includes teacher's extraKeywords + excludeKeywords in the context block", () => {
    const out = composeRerankPrompt(
      {
        task: "Run empathy interviews",
        extraKeywords: "animation",
        excludeKeywords: "music shorts",
      },
      [item],
    );
    expect(out).toContain("Teacher's extra keywords: animation");
    expect(out).toContain("Teacher's exclude keywords: music shorts");
  });

  it("omits the keyword context lines when not provided", () => {
    const out = composeRerankPrompt(
      { task: "Run empathy interviews" },
      [item],
    );
    expect(out).not.toContain("Teacher's extra keywords");
    expect(out).not.toContain("Teacher's exclude keywords");
  });
});

// ─── Source-static guards for the new controls wiring ─────────────────

const FETCH_YOUTUBE_SRC = readFileSync(
  join(__dirname, "..", "fetch-youtube.ts"),
  "utf-8",
);

const RERANK_SRC = readFileSync(join(__dirname, "..", "rerank.ts"), "utf-8");

const ROUTE_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "app", "api", "teacher", "suggest-videos", "route.ts"),
  "utf-8",
);

const MODAL_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "components",
    "teacher",
    "lesson-editor",
    "VideoSuggestionsModal.tsx",
  ),
  "utf-8",
);

describe("fetch-youtube — duration option wired through (controls)", () => {
  it("exposes DurationBucket type alias", () => {
    expect(FETCH_YOUTUBE_SRC).toMatch(
      /export type DurationBucket = "short" \| "medium" \| "long" \| "any"/,
    );
  });

  it("only sets videoDuration param when duration !== 'any'", () => {
    expect(FETCH_YOUTUBE_SRC).toMatch(/if \(duration !== "any"\)/);
    expect(FETCH_YOUTUBE_SRC).toMatch(
      /searchParams\.set\("videoDuration", duration\)/,
    );
  });
});

describe("rerank — count enforced + extraKeywords surfaced (controls)", () => {
  it("tool schema maxItems bumped to 10 to support count=10", () => {
    expect(RERANK_SRC).toMatch(/maxItems:\s*10,/);
  });

  it("rerankWithClaude accepts count and clamps to [1, 10]", () => {
    expect(RERANK_SRC).toContain(
      "Math.min(Math.max(opts.count ?? 3, 1), 10)",
    );
  });

  it("response picks are sliced to count as defensive over-cap guard", () => {
    expect(RERANK_SRC).toMatch(
      /input\?\.picks\)\s*\?\s*input\.picks\.slice\(0,\s*count\)/,
    );
  });

  it("metadata captures requestedCount for breakdown attribution", () => {
    expect(RERANK_SRC).toContain("requestedCount: count");
  });
});

describe("orchestrator route — body parsing + composeFinalQuery + duration/count pass-through (controls)", () => {
  it("validates duration against the 4-bucket allowlist", () => {
    expect(ROUTE_SRC).toContain(
      'const VALID_DURATIONS: ReadonlyArray<DurationBucket> = [',
    );
    expect(ROUTE_SRC).toContain('"short"');
    expect(ROUTE_SRC).toContain('"medium"');
    expect(ROUTE_SRC).toContain('"long"');
    expect(ROUTE_SRC).toContain('"any"');
  });

  it("validates count against [3, 5, 10] set", () => {
    expect(ROUTE_SRC).toMatch(/VALID_COUNTS = new Set\(\[3, 5, 10\]\)/);
  });

  it("threads extraKeywords + excludeKeywords through composeFinalQuery", () => {
    expect(ROUTE_SRC).toMatch(
      /composeFinalQuery\(\s*aiQuery,\s*ctx\.extraKeywords,\s*ctx\.excludeKeywords/,
    );
  });

  it("bumps searchLimit when teacher asks for more candidates (>=10 floor)", () => {
    expect(ROUTE_SRC).toMatch(/Math\.max\(10, count \* 3\)/);
  });
});

describe("VideoSuggestionsModal — controls UI + body pass-through (controls)", () => {
  it("renders the 4 duration pills (Short / Medium / Long / Any)", () => {
    expect(MODAL_SRC).toContain('label: "Short"');
    expect(MODAL_SRC).toContain('label: "Medium"');
    expect(MODAL_SRC).toContain('label: "Long"');
    expect(MODAL_SRC).toContain('label: "Any"');
  });

  it("renders the 3 count options ([3, 5, 10])", () => {
    expect(MODAL_SRC).toMatch(/COUNT_OPTIONS:\s*SuggestionCount\[\]\s*=\s*\[3,\s*5,\s*10\]/);
  });

  it("controls write to local state via setDuration / setCount / setExtraKeywords / setExcludeKeywords", () => {
    expect(MODAL_SRC).toContain("setDuration(pill.value)");
    expect(MODAL_SRC).toContain("setCount(n)");
    expect(MODAL_SRC).toContain("setExtraKeywords(e.target.value)");
    expect(MODAL_SRC).toContain("setExcludeKeywords(e.target.value)");
  });

  it("POST body includes duration / count / extraKeywords / excludeKeywords", () => {
    expect(MODAL_SRC).toMatch(/duration,\s*\n\s*count,\s*\n\s*extraKeywords:/);
    expect(MODAL_SRC).toMatch(/extraKeywords:\s*extraKeywords\.trim\(\)\s*\|\|\s*undefined/);
    expect(MODAL_SRC).toMatch(/excludeKeywords:\s*excludeKeywords\.trim\(\)\s*\|\|\s*undefined/);
  });

  it('has a "Search with these settings" action that re-runs', () => {
    expect(MODAL_SRC).toContain("Search with these settings");
    expect(MODAL_SRC).toContain("handleSearchAgain");
  });
});
