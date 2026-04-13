import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const API_DIR = path.resolve(__dirname, '../../../../src/app/api/student');

const WIRED_ENDPOINTS = [
  // 5F-a: Core endpoints
  { file: 'progress/route.ts', marker: 'moderateAndLog' },
  { file: 'tool-sessions/route.ts', marker: 'moderateAndLog' },
  { file: 'tool-sessions/[id]/route.ts', marker: 'moderateAndLog' },
  { file: 'gallery/submit/route.ts', marker: 'moderateAndLog' },
  { file: 'gallery/review/route.ts', marker: 'moderateAndLog' },
  { file: 'upload/route.ts', marker: 'moderateAndLog' },
  // 5F-b: Remaining endpoints
  { file: 'design-assistant/route.ts', marker: 'moderateAndLog' },
  { file: 'portfolio/route.ts', marker: 'moderateAndLog' },
  { file: 'quest/evidence/route.ts', marker: 'moderateAndLog' },
  { file: 'quest/milestones/route.ts', marker: 'moderateAndLog' },
  { file: 'quest/contract/route.ts', marker: 'moderateAndLog' },
  { file: 'quest/sharing/route.ts', marker: 'moderateAndLog' },
  { file: 'open-studio/session/route.ts', marker: 'moderateAndLog' },
  { file: 'planning/route.ts', marker: 'moderateAndLog' },
  { file: 'avatar/route.ts', marker: 'moderateAndLog' },
];

describe('5F-a wiring: moderateAndLog present in endpoints', () => {
  for (const ep of WIRED_ENDPOINTS) {
    it(`${ep.file} imports and calls ${ep.marker}`, () => {
      const filePath = path.join(API_DIR, ep.file);
      const src = fs.readFileSync(filePath, 'utf-8');
      expect(src).toContain(`import { moderateAndLog }`);
      // Ensure at least one call site (not just import)
      const callCount = (src.match(/moderateAndLog\(/g) || []).length;
      expect(callCount).toBeGreaterThanOrEqual(1);
    });
  }

  it('covers exactly 15 endpoint files', () => {
    expect(WIRED_ENDPOINTS).toHaveLength(15);
  });
});
