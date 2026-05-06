/**
 * AG.4 follow-up — CalibrationMiniView source-static guards.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const MINIVIEW_SRC = readFileSync(
  join(__dirname, "..", "CalibrationMiniView.tsx"),
  "utf-8"
);

const PANEL_SRC = readFileSync(
  join(__dirname, "..", "UnitAttentionPanel.tsx"),
  "utf-8"
);

describe("CalibrationMiniView", () => {
  it("loads via typed client (loadCalibrationForStudent + saveCalibration)", () => {
    expect(MINIVIEW_SRC).toContain('from "@/lib/unit-tools/attention/calibration-client"');
    expect(MINIVIEW_SRC).toContain("loadCalibrationForStudent");
    expect(MINIVIEW_SRC).toContain("saveCalibration");
  });

  it("renders 4 load states (loading / error / no-elements / ready)", () => {
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-loading"');
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-error"');
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-no-elements"');
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-element-list"');
  });

  it("dialog uses role/aria-modal/ESC/scrim/close-button", () => {
    expect(MINIVIEW_SRC).toContain('role="dialog"');
    expect(MINIVIEW_SRC).toContain('aria-modal="true"');
    expect(MINIVIEW_SRC).toMatch(/e\.key === "Escape"/);
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-scrim"');
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-close"');
  });

  it("seeds pending state from existing teacher observations on load", () => {
    // Loop body sets pending[element.id] = { rating: e.teacherRating, comment: e.teacherComment ?? '' }
    expect(MINIVIEW_SRC).toMatch(
      /seeded\[e\.element\.id\]\s*=\s*\{[\s\S]{0,200}rating:\s*e\.teacherRating/
    );
    expect(MINIVIEW_SRC).toMatch(/comment:\s*e\.teacherComment\s*\?\?\s*""/);
  });

  it("rating button toggles off when re-clicked (idempotent)", () => {
    // setRating: prev[id]?.rating === rating ? null : rating
    expect(MINIVIEW_SRC).toMatch(
      /prev\[elementId\]\?\.rating\s*===\s*rating\s*\?\s*null\s*:\s*rating/
    );
  });

  it("buildAssessments skips rows that are unchanged from existing teacher obs", () => {
    expect(MINIVIEW_SRC).toContain("ratingUnchanged");
    expect(MINIVIEW_SRC).toContain("commentUnchanged");
    expect(MINIVIEW_SRC).toMatch(
      /if\s*\(ratingUnchanged\s*&&\s*commentUnchanged\)\s*continue/
    );
  });

  it("buildAssessments skips rows with no rating (rating === null)", () => {
    expect(MINIVIEW_SRC).toMatch(/if\s*\(!p\s*\|\|\s*p\.rating\s*===\s*null\)\s*continue/);
  });

  it("Save button POSTs via saveCalibration with correct args", () => {
    expect(MINIVIEW_SRC).toMatch(
      /saveCalibration\(\{[\s\S]{0,200}unitId,[\s\S]{0,200}classId,[\s\S]{0,200}studentId,[\s\S]{0,200}assessments,/
    );
  });

  it("calls onSaved callback after successful save (so panel can refresh)", () => {
    expect(MINIVIEW_SRC).toContain("onSaved?.()");
  });

  it("auto-closes ~900ms after save (toast then dismiss)", () => {
    const idx = MINIVIEW_SRC.indexOf("Saved ${assessments.length}");
    expect(idx).toBeGreaterThan(-1);
    const after = MINIVIEW_SRC.slice(idx, idx + 600);
    expect(after).toMatch(/setTimeout\(\(\)\s*=>\s*\{[\s\S]*?onClose\(\)/);
  });

  it("renders one ElementRow per element with stable testid", () => {
    expect(MINIVIEW_SRC).toMatch(
      /data-testid=\{`calibration-row-\$\{element\.element\.id\}`\}/
    );
  });

  it("4 rating buttons per element row (TEACHER_RATING_SCALE — 1..4)", () => {
    expect(MINIVIEW_SRC).toContain("TEACHER_RATING_SCALE.map");
    expect(MINIVIEW_SRC).toMatch(
      /data-testid=\{`calibration-rating-\$\{element\.element\.id\}-\$\{opt\.value\}`\}/
    );
    // role=radiogroup + radio for accessibility
    expect(MINIVIEW_SRC).toMatch(/role="radiogroup"/);
    expect(MINIVIEW_SRC).toMatch(/role="radio"/);
  });

  it("shows student self-rating as a chip (read-only) or 'Not rated yet' fallback", () => {
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-self-rating"');
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-self-rating-empty"');
    expect(MINIVIEW_SRC).toContain("Not rated yet");
  });

  it("element row has color-coded left border from element.color", () => {
    expect(MINIVIEW_SRC).toMatch(/borderLeft:\s*`4px solid \$\{element\.element\.color\}`/);
  });

  // ─── Round 9 (6 May 2026) — history + date stamps ────────────────────────

  it("self-rating chip carries a relative date stamp + tooltip", () => {
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-self-rating-date"');
    expect(MINIVIEW_SRC).toMatch(/formatRelative\(element\.studentRatedAt\)/);
  });

  it("teacher 'current' label shows relative date alongside the rating", () => {
    expect(MINIVIEW_SRC).toContain('data-testid="calibration-teacher-current-date"');
    expect(MINIVIEW_SRC).toMatch(/formatRelative\(element\.teacherRatedAt\)/);
  });

  it("renders a 'Past observations' details section when history exists", () => {
    expect(MINIVIEW_SRC).toMatch(
      /data-testid=\{`calibration-history-\$\{element\.element\.id\}`\}/
    );
    expect(MINIVIEW_SRC).toContain("Past observations");
    // Gated on history.length > 0
    expect(MINIVIEW_SRC).toMatch(
      /element\.teacherHistory\.length\s*>\s*0/
    );
  });

  it("history entries map TEACHER_RATING_SCALE label per entry", () => {
    expect(MINIVIEW_SRC).toMatch(
      /element\.teacherHistory\.map\(\(entry,\s*i\)\s*=>/
    );
    // Multiline regex — the .find call wraps onto two lines in the source.
    expect(MINIVIEW_SRC).toMatch(
      /TEACHER_RATING_SCALE\.find\([\s\S]{0,80}r\.value\s*===\s*entry\.rating[\s\S]{0,30}\)/
    );
  });

  it("formatRelative helper exists at the bottom of the file", () => {
    expect(MINIVIEW_SRC).toMatch(/function formatRelative\(iso:\s*string\):\s*string/);
  });
});

describe("UnitAttentionPanel — calibration row click wiring", () => {
  it("imports CalibrationMiniView", () => {
    expect(PANEL_SRC).toContain('from "./CalibrationMiniView"');
  });

  it("tracks calibrationFor state (studentId + displayName)", () => {
    expect(PANEL_SRC).toMatch(/setCalibrationFor\(\{\s*studentId:\s*row\.studentId/);
  });

  it("row passes onClick → setCalibrationFor", () => {
    // Inside data.rows.map → AttentionRowItem onClick={() => setCalibrationFor({...})}
    const idx = PANEL_SRC.indexOf("<AttentionRowItem");
    expect(idx).toBeGreaterThan(0);
    const slice = PANEL_SRC.slice(idx, idx + 600);
    expect(slice).toContain("onClick={() =>");
    expect(slice).toContain("setCalibrationFor({");
  });

  it("AttentionRowItem renders with role=button + Enter/Space keyboard handler (a11y)", () => {
    expect(PANEL_SRC).toMatch(/role="button"/);
    expect(PANEL_SRC).toMatch(/tabIndex=\{0\}/);
    expect(PANEL_SRC).toMatch(/e\.key === "Enter" \|\| e\.key === " "/);
  });

  it("CalibrationMiniView mounted when calibrationFor is non-null", () => {
    expect(PANEL_SRC).toMatch(
      /\{calibrationFor\s*&&\s*\(\s*<CalibrationMiniView/
    );
  });

  it("onSaved callback bumps refreshKey to re-fetch the panel", () => {
    expect(PANEL_SRC).toContain("setRefreshKey");
    expect(PANEL_SRC).toMatch(/onSaved=\{reload\}/);
    // useEffect deps include refreshKey
    expect(PANEL_SRC).toMatch(/\[unitId,\s*classId,\s*refreshKey\]/);
  });
});
