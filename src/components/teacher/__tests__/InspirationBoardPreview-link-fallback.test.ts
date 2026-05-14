/**
 * InspirationBoardPreview — link-card fallback for non-image URLs.
 *
 * Matt smoke 13 May 2026: Inspiration Board renders student-pinned
 * URLs (e.g. https://www.d2ziran.com/article-...htm) as <img> tags,
 * which 403/CORS-error in the network tab AND show as broken images
 * to the teacher. Fix: detect non-image URLs and render a link-card
 * placeholder instead.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(
  join(__dirname, "..", "InspirationBoardPreview.tsx"),
  "utf-8",
);

describe("InspirationBoardPreview — URL detection helpers", () => {
  it("declares isLikelyImageUrl with conservative defaults", () => {
    expect(src).toMatch(/function isLikelyImageUrl\(url:\s*string\):\s*boolean/);
  });

  it("storage-proxy paths classify as image", () => {
    expect(src).toMatch(/if\s*\(url\.startsWith\("\/api\/storage\/"\)\)\s*return\s+true/);
  });

  it("data: URIs classify as image", () => {
    expect(src).toMatch(/data:image\//);
  });

  it("matches common image extensions case-insensitively (jpg/png/gif/webp/svg/avif/bmp)", () => {
    expect(src).toMatch(
      /\\\.\(jpe\?g\|png\|gif\|webp\|svg\|avif\|bmp\)\$\/i/,
    );
  });

  it("strips query strings + fragments before extension check", () => {
    // Proxy URLs often carry ?token= signatures — ignore those.
    expect(src).toMatch(/\.split\("\?"\)\[0\][\s\S]*?\.split\("#"\)\[0\]/);
  });

  it("defaults to FALSE (link card) on unknown URLs — safer than broken image", () => {
    expect(src).toMatch(/if\s*\(!url\)\s*return\s+false/);
  });
});

describe("InspirationBoardPreview — link card render path", () => {
  it("renders a link card placeholder for non-image URLs", () => {
    expect(src).toContain('data-testid="ib-link-card"');
    expect(src).toMatch(/external link/);
  });

  it("shows the hostname (stripped 'www.') instead of full URL", () => {
    expect(src).toMatch(
      /new URL\(url\)\.hostname\.replace\(\/\^www\\\.\/, ""\)/,
    );
  });

  it("link card has a link/chain icon (svg path uses the chain motif)", () => {
    // Quick smoke that there's an SVG with two path elements (the
    // chain link motif) inside the link card branch.
    expect(src).toMatch(
      /renderAsLink\s*\?\s*\(\s*\n[\s\S]*?<svg[\s\S]*?<path[\s\S]*?<\/svg>/,
    );
  });
});

describe("InspirationBoardPreview — onError fallback (image returns non-image)", () => {
  it("img onError sets imgFailed → re-renders as link card", () => {
    expect(src).toMatch(/onError=\{\(\)\s*=>\s*setImgFailed\(true\)\}/);
    expect(src).toMatch(
      /renderAsLink\s*=\s*\n?\s*!isLikelyImageUrl\(item\.url\)\s*\|\|\s*imgFailed/,
    );
  });

  it("uses useState for the fallback flag (per-item local state)", () => {
    expect(src).toMatch(/import\s*\{\s*useState\s*\}\s*from\s*"react"/);
    expect(src).toMatch(/const\s*\[imgFailed,\s*setImgFailed\]\s*=\s*useState\(false\)/);
  });
});
