/**
 * Editor image-upload wiring.
 *
 * Matt smoke caught it post-LIS: the unit editor's media field only
 * accepted a URL — no way to upload an image from device. Worse, the
 * ActivityBlock media tab's URL input had no onChange handler, so even
 * the paste-a-URL flow was dead.
 *
 * This test locks the wiring:
 *   - /api/teacher/upload-image route exists
 *   - ImageUploadButton component exists + posts to that route
 *   - ActivityBlock media tab fires onUpdate with media: {type, url}
 *   - LessonIntroEditor exposes the upload button + threads through
 *     looksLikeVideoUrl from the shared helper
 *
 * Source-static — mirrors the pattern used by the LIS dispatch tests.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROUTE_SRC = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "app",
    "api",
    "teacher",
    "upload-image",
    "route.ts",
  ),
  "utf-8",
);

const BUTTON_SRC = readFileSync(
  join(__dirname, "..", "ImageUploadButton.tsx"),
  "utf-8",
);

const ACTIVITY_BLOCK_SRC = readFileSync(
  join(__dirname, "..", "ActivityBlock.tsx"),
  "utf-8",
);

const INTRO_EDITOR_SRC = readFileSync(
  join(__dirname, "..", "LessonIntroEditor.tsx"),
  "utf-8",
);

const VIDEO_EMBED_SRC = readFileSync(
  join(__dirname, "..", "..", "..", "..", "lib", "video-embed.ts"),
  "utf-8",
);

describe("/api/teacher/upload-image route", () => {
  it("file exists at src/app/api/teacher/upload-image/route.ts", () => {
    const routePath = join(
      __dirname,
      "..",
      "..",
      "..",
      "..",
      "app",
      "api",
      "teacher",
      "upload-image",
      "route.ts",
    );
    expect(existsSync(routePath)).toBe(true);
  });

  it("gates on requireTeacher + validates file + unitId + size + image-only mime", () => {
    expect(ROUTE_SRC).toMatch(
      /import\s*\{\s*requireTeacher\s*\}\s*from\s*["']@\/lib\/auth\/require-teacher["']/,
    );
    expect(ROUTE_SRC).toMatch(/await requireTeacher\(request\)/);
    expect(ROUTE_SRC).toMatch(/file and unitId required/);
    expect(ROUTE_SRC).toMatch(/File too large/);
    expect(ROUTE_SRC).toMatch(/Only image files/);
    expect(ROUTE_SRC).toMatch(/5\s*\*\s*1024\s*\*\s*1024/); // 5MB cap
  });

  it("uploads to unit-images bucket under {unitId}/blocks/ path + returns proxy URL", () => {
    expect(ROUTE_SRC).toContain('"unit-images"');
    expect(ROUTE_SRC).toMatch(/\$\{unitId\}\/blocks\//);
    expect(ROUTE_SRC).toMatch(
      /buildStorageProxyUrl\(["']unit-images["'],\s*data\.path\)/,
    );
  });

  it("does NOT mutate units.thumbnail_url (sibling route /api/teacher/upload-unit-image owns that)", () => {
    // The route's docstring may MENTION thumbnail_url to explain the
    // distinction from the sibling route — that's fine. What we forbid
    // is actual mutation code: an admin.from("units") call OR an
    // update({thumbnail_url: ...}) call.
    expect(ROUTE_SRC).not.toMatch(/admin\.from\(["']units["']\)/);
    expect(ROUTE_SRC).not.toMatch(/\.update\(\{\s*thumbnail_url:/);
  });
});

describe("ImageUploadButton component", () => {
  it("POSTs to /api/teacher/upload-image with file + unitId FormData", () => {
    expect(BUTTON_SRC).toMatch(/fetch\(["']\/api\/teacher\/upload-image["']/);
    expect(BUTTON_SRC).toMatch(/formData\.append\(["']file["'],\s*file\)/);
    expect(BUTTON_SRC).toMatch(/formData\.append\(["']unitId["'],\s*unitId\)/);
  });

  it("calls onUploaded with the returned URL on success", () => {
    expect(BUTTON_SRC).toMatch(/onUploaded\(url\)/);
  });

  it("surfaces upload errors inline + auto-clears after 3500ms", () => {
    expect(BUTTON_SRC).toMatch(/setState\(["']error["']\)/);
    expect(BUTTON_SRC).toMatch(/setErrorMsg\(/);
    expect(BUTTON_SRC).toMatch(/setTimeout\([\s\S]{0,200}3500\)/);
  });

  it("resets input value after pick so the same file can be picked twice", () => {
    expect(BUTTON_SRC).toMatch(/e\.target\.value\s*=\s*""/);
  });
});

describe("ActivityBlock — media tab wiring", () => {
  it("imports ImageUploadButton + looksLikeVideoUrl", () => {
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /import\s*\{\s*ImageUploadButton\s*\}\s*from\s*["']\.\/ImageUploadButton["']/,
    );
    expect(ACTIVITY_BLOCK_SRC).toMatch(
      /import\s*\{\s*looksLikeVideoUrl\s*\}\s*from\s*["']@\/lib\/video-embed["']/,
    );
  });

  it("destructures unitId from props (required for ImageUploadButton)", () => {
    expect(ACTIVITY_BLOCK_SRC).toContain("unitId: string");
    expect(ACTIVITY_BLOCK_SRC).toMatch(/^\s*unitId,$/m);
  });

  it("media-tab URL input has a working onChange that writes activity.media (the pre-fix bug was no onChange at all)", () => {
    const mediaTabIdx = ACTIVITY_BLOCK_SRC.indexOf('activeTab === "media"');
    expect(mediaTabIdx).toBeGreaterThan(0);
    const slice = ACTIVITY_BLOCK_SRC.slice(mediaTabIdx, mediaTabIdx + 2500);
    expect(slice).toMatch(/value=\{activity\.media\?\.url\s*\|\|\s*""\}/);
    expect(slice).toMatch(/onChange=\{\(e\)\s*=>\s*\{[\s\S]{0,500}onUpdate\(/);
    expect(slice).toMatch(/looksLikeVideoUrl\(url\)/);
  });

  it("media-tab renders ImageUploadButton with unitId + onUploaded → image media", () => {
    // ImageUploadButton sits inside the activeTab === "media" branch.
    // The JSX spans the upload button + onUploaded handler that writes
    // a fresh image-typed media object into the section.
    const buttonIdx = ACTIVITY_BLOCK_SRC.indexOf("<ImageUploadButton");
    expect(buttonIdx).toBeGreaterThan(0);
    const buttonSlice = ACTIVITY_BLOCK_SRC.slice(buttonIdx, buttonIdx + 500);
    expect(buttonSlice).toContain("unitId={unitId}");
    expect(buttonSlice).toMatch(
      /onUploaded=\{[\s\S]{0,200}onUpdate\(\{\s*media:\s*\{\s*type:\s*["']image["']/,
    );
  });
});

describe("LessonIntroEditor — hero upload button wiring", () => {
  it("declares unitId in props + threads it through", () => {
    expect(INTRO_EDITOR_SRC).toContain("unitId: string");
    expect(INTRO_EDITOR_SRC).toMatch(/^\s*unitId,$/m);
  });

  it("imports ImageUploadButton + uses it next to the hero URL input", () => {
    expect(INTRO_EDITOR_SRC).toMatch(
      /import\s*\{\s*ImageUploadButton\s*\}\s*from\s*["']\.\/ImageUploadButton["']/,
    );
    expect(INTRO_EDITOR_SRC).toMatch(
      /<ImageUploadButton[\s\S]{0,200}unitId=\{unitId\}[\s\S]{0,200}onUploaded=\{\(url\)\s*=>\s*updateMediaUrl\(url\)\}/,
    );
  });

  it("uses the shared looksLikeVideoUrl helper (deleted local duplicate)", () => {
    expect(INTRO_EDITOR_SRC).toMatch(
      /import\s*\{\s*looksLikeVideoUrl\s*\}\s*from\s*["']@\/lib\/video-embed["']/,
    );
    // No local function declaration — shared helper only
    expect(INTRO_EDITOR_SRC).not.toMatch(/^function looksLikeVideo\(/m);
  });
});

describe("video-embed.ts — shared looksLikeVideoUrl helper", () => {
  it("exports looksLikeVideoUrl with the same heuristic the local copy used", () => {
    expect(VIDEO_EMBED_SRC).toMatch(/export function looksLikeVideoUrl/);
    expect(VIDEO_EMBED_SRC).toContain("youtube.com");
    expect(VIDEO_EMBED_SRC).toContain("youtu.be");
    expect(VIDEO_EMBED_SRC).toContain("vimeo.com");
    expect(VIDEO_EMBED_SRC).toContain(".mp4");
    expect(VIDEO_EMBED_SRC).toContain(".webm");
  });
});
