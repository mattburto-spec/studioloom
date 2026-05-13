/**
 * Source-static guards for /api/teacher/unit-brief/diagram (POST + DELETE).
 *
 * Mirrors src/app/api/teacher/unit-brief/__tests__/route.test.ts. Reads
 * the route file and asserts patterns appear. The Supabase + sharp
 * thicket would require a full integration harness to exercise live —
 * the static assertions cover the load-bearing regression cases.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const src = readFileSync(join(__dirname, "..", "route.ts"), "utf-8");

function sliceMethodBody(method: "POST" | "DELETE"): string {
  const start = src.indexOf(`export const ${method} = withErrorHandler`);
  if (start < 0) throw new Error(`Could not find ${method} export`);
  const nextStart =
    method === "POST"
      ? src.indexOf("export const DELETE = withErrorHandler", start + 1)
      : src.length;
  return method === "POST" ? src.slice(start, nextStart) : src.slice(start);
}

describe("/api/teacher/unit-brief/diagram — module-level guards", () => {
  it("imports requireTeacher", () => {
    expect(src).toMatch(
      /import \{ requireTeacher \} from "@\/lib\/auth\/require-teacher"/,
    );
  });

  it("imports verifyTeacherHasUnit", () => {
    expect(src).toMatch(
      /import \{ verifyTeacherHasUnit \} from "@\/lib\/auth\/verify-teacher-unit"/,
    );
  });

  it("imports sharp + createAdminClient + buildStorageProxyUrl", () => {
    expect(src).toContain('import sharp from "sharp"');
    expect(src).toMatch(
      /import \{ createAdminClient \} from "@\/lib\/supabase\/admin"/,
    );
    expect(src).toMatch(
      /import \{ buildStorageProxyUrl \} from "@\/lib\/storage\/proxy-url"/,
    );
  });

  it("targets the unit-images bucket (path[0] = unitId for proxy auth)", () => {
    expect(src).toContain('const BUCKET = "unit-images"');
    expect(src).toContain(
      "${unitId}/brief-diagram-",
    );
  });

  it("caps raw upload at 10MB (matches client-side check + Sharp doc cap)", () => {
    expect(src).toContain("const MAX_BYTES = 10 * 1024 * 1024");
  });

  it("audit-skip annotation present (Phase B.5 inherits parent route's audit class)", () => {
    expect(src.slice(0, 200)).toContain("audit-skip:");
  });

  it("pathFromProxyUrl parses storage path out of the /api/storage/<bucket>/ prefix", () => {
    expect(src).toContain("function pathFromProxyUrl");
    expect(src).toContain("`/api/storage/${BUCKET}/`");
  });
});

describe("/api/teacher/unit-brief/diagram — POST", () => {
  const body = sliceMethodBody("POST");

  it("auth gate: requireTeacher then short-circuit on .error", () => {
    expect(body).toContain("requireTeacher(request)");
    expect(body).toMatch(/if \(teacher\.error\) return teacher\.error/);
  });

  it("returns 400 on missing unitId in FormData", () => {
    expect(body).toContain("unitId required (string)");
    expect(body).toMatch(/status:\s*400/);
  });

  it("returns 400 on missing file in FormData", () => {
    expect(body).toContain("file required (image)");
  });

  it("rejects non-image MIME types", () => {
    expect(body).toContain("Only image files are allowed");
    expect(body).toMatch(/file\.type\.startsWith\("image\/"\)/);
  });

  it("rejects files larger than 10MB", () => {
    expect(body).toContain("File too large (max 10MB)");
    expect(body).toMatch(/file\.size > MAX_BYTES/);
  });

  it("requires the teacher to be the unit AUTHOR (not just have access)", () => {
    expect(body).toMatch(/if \(!access\.isAuthor\)/);
    expect(body).toContain("Only the unit author can upload a brief diagram");
    expect(body).toMatch(/status:\s*403/);
  });

  it("compresses via sharp before upload (best-effort with raw fallback)", () => {
    expect(body).toContain("compressDiagram");
    // Fall-through to the raw ArrayBuffer if sharp throws — matches the
    // upload-unit-image robustness pattern.
    expect(body).toMatch(/imageBuffer = Buffer\.from\(arrayBuffer\)/);
  });

  it("uploads with upsert:false so each upload gets a unique timestamped path", () => {
    expect(body).toMatch(/upsert:\s*false/);
  });

  it("cleans up the new storage object if the DB upsert fails (no orphans)", () => {
    expect(body).toContain(
      ".storage.from(BUCKET).remove([storagePath])",
    );
  });

  it("best-effort deletes the previous diagram after a successful new upload", () => {
    // The oldPath is parsed from existingRow.diagram_url. After the
    // upsert succeeds, we remove it if oldPath !== storagePath.
    expect(body).toMatch(/oldPath\s*&&\s*oldPath\s*!==\s*storagePath/);
  });

  it("returns the freshly-upserted brief row (not the existing row)", () => {
    expect(body).toMatch(/brief:\s*rowToBrief\(data\)/);
  });
});

describe("/api/teacher/unit-brief/diagram — DELETE", () => {
  const body = sliceMethodBody("DELETE");

  it("auth gate: requireTeacher then isAuthor", () => {
    expect(body).toContain("requireTeacher(request)");
    expect(body).toMatch(/if \(!access\.isAuthor\)/);
    expect(body).toContain("Only the unit author can delete a brief diagram");
  });

  it("returns 400 when unitId query param is missing", () => {
    expect(body).toContain("unitId query parameter required");
    expect(body).toMatch(/status:\s*400/);
  });

  it("idempotent: returns brief:null when no row exists (not 404)", () => {
    expect(body).toMatch(/return NextResponse\.json\(\{ brief: null \}\)/);
  });

  it("sets diagram_url = null via plain UPDATE, then best-effort removes the file", () => {
    expect(body).toMatch(/\.update\(\{ diagram_url: null \}\)/);
    expect(body).toContain(".storage.from(BUCKET).remove([oldPath])");
  });
});
