import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROUTE_PATH = path.join(
  process.cwd(),
  'src/app/api/student/nm-assessment/route.ts'
);

describe('FU-GG — nm-assessment classId fallback regression', () => {
  // --- 1. Source-static grep: no "unknown" sentinel in classId ---
  test('route does not use "unknown" as classId fallback', () => {
    const source = fs.readFileSync(ROUTE_PATH, 'utf-8');
    // The old bug: classId || "unknown" — truthy string bypasses
    // moderateAndLog's || null coercion, FK rejects the insert,
    // .catch() swallows the error, moderation event silently lost.
    expect(source).not.toMatch(/classId\s*\|\|\s*["']unknown["']/);
  });

  // --- 2. Route uses empty-string fallback (coerces to NULL via moderateAndLog) ---
  test('route uses empty-string fallback for missing classId', () => {
    const source = fs.readFileSync(ROUTE_PATH, 'utf-8');
    // Empty string is falsy → moderateAndLog's `context.classId || null`
    // coerces to NULL → FU-N dual-visibility policy picks up the row.
    expect(source).toMatch(/classId\s*\|\|\s*['"]['"],/);
  });

  // --- 3. moderateAndLog coerces empty string to null ---
  test('moderateAndLog helper coerces falsy classId to null', () => {
    const helperPath = path.join(
      process.cwd(),
      'src/lib/content-safety/moderate-and-log.ts'
    );
    const helperSource = fs.readFileSync(helperPath, 'utf-8');
    // The critical line: class_id: context.classId || null
    expect(helperSource).toMatch(/class_id:\s*context\.classId\s*\|\|\s*null/);
  });
});
