/**
 * Asserts the shape of migration 20260502025737_phase_4_1_seed_schools_extension.sql.
 *
 * Phase: Access Model v2 Phase 4.1 (data-only seed)
 *
 * Adds ~100 schools across 6 markets to the existing 085_schools_seed.sql
 * (~85 IB schools). Curation-criteria-driven (brief §3.8 Q11): NOT a
 * directory dump.
 *
 * Tests cover:
 *   - source='imported' for every entry (Phase 4 batch tag)
 *   - verified=true (hand-curated)
 *   - ON CONFLICT (normalized_name, country) DO NOTHING (idempotent)
 *   - Approximate row count by market (UK ≥20, AU ≥20, US ≥20, etc.)
 *   - UTF-8 encoding holds (Latin-1 names: École, Düsseldorf, Chesières)
 *   - Marquee Matt-pitch entries present (Sydney Grammar, Westminster, Phillips Exeter)
 *   - Sanity check DO block present
 *   - DOWN script bounded by created_at (won't nuke source=imported pre-Phase-4 rows)
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const TIMESTAMP = '20260502025737';

function loadMigration(suffix: string): string {
  const all = fs.readdirSync(MIGRATIONS_DIR);
  const file = all.find(
    (f) => f.startsWith(TIMESTAMP) && f.endsWith(suffix)
  );
  if (!file) {
    throw new Error(
      `Migration with timestamp ${TIMESTAMP} and suffix ${suffix} not found`
    );
  }
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
}

describe('Migration: 20260502025737_phase_4_1_seed_schools_extension', () => {
  const sql = loadMigration('_phase_4_1_seed_schools_extension.sql');

  // ─── Shape ───────────────────────────────────────────────────────

  it("opens with INSERT INTO schools using the canonical column order", () => {
    expect(sql).toMatch(
      /INSERT INTO schools \(name, city, country, ib_programmes, source, verified, created_by\)/
    );
  });

  it("ends with ON CONFLICT (normalized_name, country) DO NOTHING — idempotent", () => {
    expect(sql).toMatch(/ON CONFLICT \(normalized_name, country\) DO NOTHING/);
  });

  it("includes a DO block sanity check that counts source='imported' entries", () => {
    expect(sql).toContain('SELECT COUNT(*) INTO v_imported_count FROM schools');
    expect(sql).toContain("WHERE source='imported'");
    expect(sql).toContain('RAISE NOTICE');
  });

  // ─── Source + verified consistency ───────────────────────────────

  it("uses source='imported' for every Phase 4 entry (chosen over 'ibo' to flag curation batch)", () => {
    // Pull all ('...','...','XX',{...},'src',bool,NULL) tuples
    const rows = sql.match(
      /\('([^']+(?:''[^']*)*)',\s*'([^']+(?:''[^']*)*)',\s*'([A-Z]{2})',\s*'\{[^}]*\}',\s*'(\w+)',\s*(true|false),\s*NULL\)/g
    );
    expect(rows).toBeTruthy();
    expect(rows!.length).toBeGreaterThanOrEqual(95);
    // Every row uses source='imported' and verified=true
    for (const row of rows!) {
      expect(row).toMatch(/'imported',\s*true/);
    }
  });

  // ─── Approximate row count by market ─────────────────────────────

  it("includes ≥20 UK entries", () => {
    const ukRows = sql.match(/'GB',\s*'\{[^}]*\}',\s*'imported'/g);
    expect(ukRows?.length).toBeGreaterThanOrEqual(20);
  });

  it("includes ≥20 Australia entries", () => {
    const auRows = sql.match(/'AU',\s*'\{[^}]*\}',\s*'imported'/g);
    expect(auRows?.length).toBeGreaterThanOrEqual(20);
  });

  it("includes ≥20 US entries", () => {
    const usRows = sql.match(/'US',\s*'\{[^}]*\}',\s*'imported'/g);
    expect(usRows?.length).toBeGreaterThanOrEqual(20);
  });

  it("total row count is in 90-130 range (brief §3.8 Q11: ~100 entries)", () => {
    const allRows = sql.match(/'imported',\s*true,\s*NULL\)/g);
    expect(allRows?.length).toBeGreaterThanOrEqual(90);
    expect(allRows?.length).toBeLessThanOrEqual(130);
  });

  // ─── Marquee Matt-pitch entries ──────────────────────────────────

  it("contains marquee UK indies (Westminster, Eton, Wycombe Abbey, St Paul's)", () => {
    expect(sql).toContain("'Westminster School'");
    expect(sql).toContain("'Eton College'");
    expect(sql).toContain("'Wycombe Abbey'");
    expect(sql).toContain("'St Paul''s School'"); // double-apostrophe escape
  });

  it("contains marquee Australia indies (Sydney Grammar, Knox, Scotch Melbourne, MLC Sydney)", () => {
    expect(sql).toContain("'Sydney Grammar School'");
    expect(sql).toContain("'Knox Grammar School'");
    expect(sql).toContain("'Scotch College Melbourne'");
    expect(sql).toContain("'MLC School'");
  });

  it("contains marquee US NAIS (Phillips Exeter, Sidwell, Lakeside, Punahou)", () => {
    expect(sql).toContain("'Phillips Exeter Academy'");
    expect(sql).toContain("'Sidwell Friends School'");
    expect(sql).toContain("'Lakeside School'");
    expect(sql).toContain("'Punahou School'");
  });

  // ─── UTF-8 encoding (Lesson #6 risk: Latin-1 chars in school names) ─

  it("preserves non-ASCII characters in school names (École, Düsseldorf, Chesières, São Paulo precedent)", () => {
    expect(sql).toMatch(/École Active Bilingue/);
    expect(sql).toMatch(/Düsseldorf/);
    expect(sql).toMatch(/Chesières/);
  });

  // ─── ib_programmes shape ─────────────────────────────────────────

  it("uses '{}' (empty array) for non-IB schools, not NULL", () => {
    // UK indies are non-IB by selection — at least 15 should have '{}'
    const emptyProgrammes = sql.match(/'GB',\s*'\{\}'/g);
    expect(emptyProgrammes?.length).toBeGreaterThanOrEqual(15);
  });

  it("preserves IB programme arrays for the few IB schools in the seed", () => {
    // Saint Maur (Yokohama) is IB MYP/DP/PYP
    expect(sql).toMatch(/'Saint Maur International School'.*\{MYP,DP,PYP\}/);
  });

  // ─── Down script ─────────────────────────────────────────────────

  describe('paired DOWN script', () => {
    const downSql = loadMigration('_phase_4_1_seed_schools_extension.down.sql');

    it('bounds DELETE by created_at to protect future source=imported rows', () => {
      expect(downSql).toMatch(/created_at >= '2026-05-02/);
      expect(downSql).toMatch(/created_at < '2026-05-03/);
    });

    it("only touches source='imported' rows (never ibo / user_submitted)", () => {
      expect(downSql).toContain("source = 'imported'");
      expect(downSql).not.toContain("source = 'ibo'");
      expect(downSql).not.toContain("source = 'user_submitted'");
    });
  });
});
