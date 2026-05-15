/**
 * YouTube Data API v3 fetcher — `search.list` to find candidate
 * videos, then `videos.list` to pull duration + embeddable flag.
 *
 * Two-step pattern because `search.list` returns lightweight metadata
 * only. `videos.list` adds `contentDetails.duration` (ISO 8601) and
 * `status.embeddable` — both required by the brief.
 *
 * Pure: no AI, no Supabase. Tested directly without mocks via
 * passing the parsed payload shape.
 */

import type { YouTubeRawItem } from "./types";

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

/**
 * Parse YouTube ISO 8601 duration ("PT5M30S", "PT1H2M3S", "PT45S")
 * into total seconds. Returns 0 for unparseable input — caller can
 * decide whether to drop the item.
 */
export function parseIsoDurationSeconds(iso: string): number {
  if (!iso) return 0;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const [, h, m, s] = match;
  return (
    (h ? parseInt(h, 10) * 3600 : 0) +
    (m ? parseInt(m, 10) * 60 : 0) +
    (s ? parseInt(s, 10) : 0)
  );
}

/** Pick the best thumbnail URL — prefer medium, fall back to default. */
export function pickThumbnail(thumbs: Record<string, { url?: string }>): string {
  return (
    thumbs?.medium?.url ||
    thumbs?.high?.url ||
    thumbs?.default?.url ||
    ""
  );
}

/**
 * Parse the merged search + details payloads into our normalised
 * shape. Filters out videos that aren't embeddable, are too long
 * (> 1200s / 20min), or are missing required fields.
 */
interface RawSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    thumbnails: Record<string, { url?: string }>;
  };
}

interface RawVideoDetails {
  id: string;
  status?: { embeddable?: boolean };
  contentDetails?: { duration?: string };
}

export function mergeIntoRawItems(
  searchItems: RawSearchItem[],
  detailsById: Map<string, RawVideoDetails>,
  opts: { maxDurationSeconds: number },
): YouTubeRawItem[] {
  const out: YouTubeRawItem[] = [];
  for (const item of searchItems) {
    const videoId = item.id?.videoId;
    if (!videoId) continue;
    const details = detailsById.get(videoId);
    if (!details) continue;
    if (details.status?.embeddable !== true) continue;
    const durationSeconds = parseIsoDurationSeconds(
      details.contentDetails?.duration ?? "",
    );
    if (durationSeconds <= 0) continue;
    if (durationSeconds > opts.maxDurationSeconds) continue;
    out.push({
      videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      description: item.snippet.description,
      thumbnail: pickThumbnail(item.snippet.thumbnails),
      durationSeconds,
      embeddable: true,
    });
  }
  return out;
}

export type DurationBucket = "short" | "medium" | "long" | "any";

export interface FetchVideosOptions {
  apiKey: string;
  /** How many search hits to ask YouTube for (we filter down). */
  searchLimit?: number;
  /** Hard duration cap in seconds — videos longer than this are dropped. */
  maxDurationSeconds?: number;
  /** Video IDs to exclude (Suggest again flow). */
  excludeVideoIds?: string[];
  /**
   * YouTube duration bucket. Default "medium" (4–20 min). "any" skips
   * the duration filter entirely (so the post-fetch
   * maxDurationSeconds gate becomes the only ceiling — bump that too
   * if you want long videos through).
   */
  duration?: DurationBucket;
  /** Optional AbortSignal so the route can time-cap the upstream fetch. */
  signal?: AbortSignal;
}

/**
 * Run the two-step search → details fetch against YouTube Data API v3.
 *
 * Returns parsed + filtered items. Throws on transport / non-2xx
 * responses so the caller's try/catch can map to a 502 / 500.
 */
export async function fetchYouTubeVideos(
  query: string,
  opts: FetchVideosOptions,
): Promise<YouTubeRawItem[]> {
  const searchLimit = opts.searchLimit ?? 10;
  const maxDurationSeconds = opts.maxDurationSeconds ?? 20 * 60;
  const duration: DurationBucket = opts.duration ?? "medium";

  const searchParams = new URLSearchParams({
    key: opts.apiKey,
    q: query,
    part: "snippet",
    type: "video",
    maxResults: String(searchLimit),
    safeSearch: "strict",
    videoEmbeddable: "true",
    relevanceLanguage: "en",
  });
  // "any" skips the videoDuration filter — broadens the candidate pool
  // (and only the post-fetch maxDurationSeconds gate trims). Short / medium
  // / long pass through to YouTube directly.
  if (duration !== "any") {
    searchParams.set("videoDuration", duration);
  }

  const searchRes = await fetch(`${YT_SEARCH_URL}?${searchParams}`, {
    signal: opts.signal,
  });
  if (!searchRes.ok) {
    const body = await searchRes.text().catch(() => "");
    throw new Error(
      `YouTube search.list ${searchRes.status}: ${body.slice(0, 200)}`,
    );
  }
  const searchJson = (await searchRes.json()) as { items?: RawSearchItem[] };
  const exclude = new Set(opts.excludeVideoIds ?? []);
  const searchItems = (searchJson.items ?? []).filter(
    (i) => i.id?.videoId && !exclude.has(i.id.videoId),
  );
  if (searchItems.length === 0) return [];

  const ids = searchItems.map((i) => i.id.videoId).join(",");
  const detailsParams = new URLSearchParams({
    key: opts.apiKey,
    id: ids,
    part: "contentDetails,status",
  });
  const detailsRes = await fetch(`${YT_VIDEOS_URL}?${detailsParams}`, {
    signal: opts.signal,
  });
  if (!detailsRes.ok) {
    const body = await detailsRes.text().catch(() => "");
    throw new Error(
      `YouTube videos.list ${detailsRes.status}: ${body.slice(0, 200)}`,
    );
  }
  const detailsJson = (await detailsRes.json()) as {
    items?: RawVideoDetails[];
  };
  const detailsById = new Map<string, RawVideoDetails>();
  for (const d of detailsJson.items ?? []) detailsById.set(d.id, d);

  return mergeIntoRawItems(searchItems, detailsById, {
    maxDurationSeconds,
  });
}
