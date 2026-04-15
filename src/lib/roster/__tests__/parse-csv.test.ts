/**
 * parse-csv.test.ts — coverage for the roster CSV / TSV / TXT parser used by
 * the /teacher/welcome upload-csv flow.
 *
 * Covers the shapes teachers actually upload in the wild:
 *   - SIS exports with "First Name, Last Name, Email" headers
 *   - Google Sheets copy-paste ("Name,Username")
 *   - Plain Excel "Full Name" column with BOM + CRLF
 *   - Headerless 2-column files that match our existing textarea format
 *   - Tabs + semicolons + quoted cells with embedded commas
 */

import { describe, it, expect } from "vitest";
import { parseRosterFile } from "../parse-csv";

describe("parseRosterFile", () => {
  it("empty input → empty lines", () => {
    const r = parseRosterFile("");
    expect(r.lines).toEqual([]);
  });

  it("single column of full names (headerless)", () => {
    const r = parseRosterFile("John Smith\nMaria Garcia\nChen Wei");
    expect(r.usedHeaders).toBe(false);
    expect(r.lines).toEqual(["John Smith", "Maria Garcia", "Chen Wei"]);
  });

  it("SIS export with First/Last/Email headers → derives username from email", () => {
    const csv = [
      "First Name,Last Name,Email",
      "John,Smith,jsmith@school.org",
      "Maria,Garcia,mgarcia@school.org",
    ].join("\n");
    const r = parseRosterFile(csv);
    expect(r.usedHeaders).toBe(true);
    expect(r.lines).toEqual([
      "jsmith, John Smith",
      "mgarcia, Maria Garcia",
    ]);
  });

  it("explicit username column wins over email", () => {
    const csv = [
      "Name,Username,Email",
      "Jane Doe,jdoe,jane.doe@school.org",
    ].join("\n");
    expect(parseRosterFile(csv).lines).toEqual(["jdoe, Jane Doe"]);
  });

  it("BOM + CRLF from Excel export is cleaned up", () => {
    const csv = "\uFEFFFull Name,Username\r\nJohn Smith,jsmith\r\nMaria Garcia,mgarcia\r\n";
    const r = parseRosterFile(csv);
    expect(r.usedHeaders).toBe(true);
    expect(r.lines).toEqual(["jsmith, John Smith", "mgarcia, Maria Garcia"]);
  });

  it("tab-separated Google Sheets paste", () => {
    const tsv = "Name\tUsername\nJohn Smith\tjsmith\nMaria Garcia\tmgarcia";
    const r = parseRosterFile(tsv);
    expect(r.delimiter).toBe("\t");
    expect(r.lines).toEqual(["jsmith, John Smith", "mgarcia, Maria Garcia"]);
  });

  it("semicolon-separated Euro export", () => {
    const csv = "Name;Username\nJohn Smith;jsmith";
    const r = parseRosterFile(csv);
    expect(r.delimiter).toBe(";");
    expect(r.lines).toEqual(["jsmith, John Smith"]);
  });

  it("quoted cells with commas inside are preserved", () => {
    const csv = [
      "Name,Email",
      '"Smith, John",jsmith@s.org',
      '"Garcia, Maria",mgarcia@s.org',
    ].join("\n");
    const r = parseRosterFile(csv);
    expect(r.lines).toEqual([
      "jsmith, Smith, John",
      "mgarcia, Garcia, Maria",
    ]);
  });

  it("escaped double-quote inside a quoted cell", () => {
    const csv = 'Name\n"He said ""hi"""\nMaria';
    expect(parseRosterFile(csv).lines).toEqual(['He said "hi"', "Maria"]);
  });

  it("headerless 2-col: (username, name) — existing textarea convention", () => {
    // First col is a bare token, second col has a space → treated as username, name.
    const csv = "jdoe,Jane Doe\nmgarcia,Maria Garcia";
    expect(parseRosterFile(csv).lines).toEqual([
      "jdoe, Jane Doe",
      "mgarcia, Maria Garcia",
    ]);
  });

  it("headerless 2-col: (name, username) — inverse layout also supported", () => {
    const csv = "Jane Doe,jdoe\nMaria Garcia,mgarcia";
    expect(parseRosterFile(csv).lines).toEqual([
      "jdoe, Jane Doe",
      "mgarcia, Maria Garcia",
    ]);
  });

  it("headerless 3-col: falls back to first column as name", () => {
    const csv = "John Smith,12345,Year 8\nMaria Garcia,12346,Year 8";
    expect(parseRosterFile(csv).lines).toEqual(["John Smith", "Maria Garcia"]);
  });

  it("skips blank rows", () => {
    const csv = "John Smith\n\n\nMaria Garcia\n\n";
    expect(parseRosterFile(csv).lines).toEqual(["John Smith", "Maria Garcia"]);
  });

  it("only-headers file produces empty lines", () => {
    const csv = "Name,Username";
    const r = parseRosterFile(csv);
    expect(r.usedHeaders).toBe(true);
    expect(r.lines).toEqual([]);
  });

  it("header row with missing Email falls back to name only", () => {
    const csv = "Name\nJane Doe\nMaria Garcia";
    expect(parseRosterFile(csv).lines).toEqual(["Jane Doe", "Maria Garcia"]);
  });

  it("First+Last headers without a combined Name column", () => {
    const csv = "First,Last\nJane,Doe\nMaria,Garcia";
    expect(parseRosterFile(csv).lines).toEqual(["Jane Doe", "Maria Garcia"]);
  });

  it("extra whitespace around cells is trimmed", () => {
    const csv = "Name, Username\n  Jane Doe  ,  jdoe  ";
    expect(parseRosterFile(csv).lines).toEqual(["jdoe, Jane Doe"]);
  });

  it("Student column is recognised as a name column", () => {
    const csv = "Student,ID\nJane Doe,12345";
    // ID is mapped as username (id header maps to username).
    expect(parseRosterFile(csv).lines).toEqual(["12345, Jane Doe"]);
  });
});
