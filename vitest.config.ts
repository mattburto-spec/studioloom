import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/e2e/**/*.test.ts",
      "tests/pipeline/**/*.test.ts",
      // Tests for scripts/ (e.g. Access Model v2 backfill scripts).
      // Added 29 Apr 2026 with Phase 1.1b backfill — first script with
      // co-located unit tests. Generic; benefits any future scriptable work.
      "scripts/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/.git/**",
      "**/.claude/**",
    ],
    // E2E tests (tests/e2e/**) may hit the live Anthropic API when
    // RUN_E2E=1. The DOCX run took ~132s on 11 Apr 2026. 300s per test
    // gives headroom for Sonnet/Haiku slow days without hanging CI.
    testTimeout: 300_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
