/**
 * parse-csv.ts — CSV / TSV / TXT roster parser.
 *
 * Takes a raw text file (typical school-SIS export) and produces a list of
 * strings formatted for the /teacher/welcome and /teacher/classes roster
 * textareas, which already accept:
 *
 *   "Full Name"
 *   "username"
 *   "username, Full Name"
 *
 * The server-side add-roster route re-parses these into ParsedStudent rows,
 * so this module only needs to reduce spreadsheet rows down to one of the
 * three line shapes above. No network or Supabase calls — pure string work.
 *
 * Heuristics:
 *   - Delimiter = comma, tab, or semicolon (whichever appears most on line 1).
 *   - First row is treated as a header if any cell matches a known header
 *     keyword (name / username / email / first / last / student / user / login / id).
 *   - With headers: use `name`, or combine `first name` + `last name`;
 *     prefer explicit `username`, else derive from `email` local part.
 *   - Without headers: 1 col → full name; 2 cols → (username,name) or
 *     (name,username) depending on which contains whitespace;
 *     3+ cols → first col as name.
 *   - BOM, CR/LF, and trailing blank rows are cleaned up.
 *   - Quoted fields with escaped `""` are supported.
 *
 * Designed to be forgiving. If the file is unparseable the caller still gets
 * back an empty list — no throws. Callers show an error in that case.
 */

export interface ParsedRosterFile {
  /**
   * Lines ready to drop into the roster textarea, one student per line, in
   * "username, Full Name" or "Full Name" or "username" form.
   */
  lines: string[];
  /**
   * True if the parser treated row 0 as a header row.
   */
  usedHeaders: boolean;
  /**
   * Delimiter we decided on ("," / "\t" / ";").
   */
  delimiter: string;
}

const HEADER_KEYWORDS = [
  "name",
  "username",
  "first",
  "last",
  "student",
  "email",
  "user",
  "login",
  "id",
  "surname",
  "given",
];

export function parseRosterFile(text: string): ParsedRosterFile {
  // Strip UTF-8 BOM if present (common from Excel/Numbers exports).
  const clean = text.replace(/^\uFEFF/, "");

  const rawRows = clean.split(/\r?\n/);
  const firstLine = rawRows.find((l) => l.trim().length > 0) ?? "";

  // Pick the delimiter from the first non-blank line.
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  const semis = (firstLine.match(/;/g) || []).length;
  const delimiter =
    tabs > commas && tabs > semis
      ? "\t"
      : semis > commas && semis > tabs
        ? ";"
        : ",";

  const rows = rawRows
    .map((line) => parseRow(line, delimiter))
    .filter((row) => row.some((cell) => cell.trim().length > 0));

  if (rows.length === 0) {
    return { lines: [], usedHeaders: false, delimiter };
  }

  // Treat row 0 as headers if ANY cell matches a known keyword.
  const usedHeaders = rows[0].some((c) => {
    const lc = c.toLowerCase().trim();
    return HEADER_KEYWORDS.some((kw) => lc === kw || lc.includes(kw));
  });

  const dataRows = usedHeaders ? rows.slice(1) : rows;
  const headerMap: Record<string, number> = {};

  if (usedHeaders) {
    rows[0].forEach((cell, idx) => {
      const lc = cell.toLowerCase().trim().replace(/\s+/g, " ");
      if (!lc) return;
      // Only record the first occurrence of each heading keyword.
      if (lc === "name" || lc === "full name" || lc === "display name" || lc === "student" || lc === "student name") {
        headerMap.name ??= idx;
      } else if (lc === "first name" || lc === "first" || lc === "firstname" || lc === "given name" || lc === "given") {
        headerMap.first ??= idx;
      } else if (lc === "last name" || lc === "last" || lc === "lastname" || lc === "surname" || lc === "family name") {
        headerMap.last ??= idx;
      } else if (lc === "username" || lc === "user" || lc === "user id" || lc === "login" || lc === "id") {
        headerMap.username ??= idx;
      } else if (lc === "email" || lc === "email address" || lc === "e-mail") {
        headerMap.email ??= idx;
      }
    });
  }

  const lines: string[] = [];
  for (const row of dataRows) {
    const line = rowToRosterLine(row, usedHeaders, headerMap);
    if (line) lines.push(line);
  }

  return { lines, usedHeaders, delimiter };
}

/**
 * Parse a single line into cells. Handles:
 *   - delimiter selection,
 *   - `"quoted cells"` with escaped `""` for literal quote,
 *   - stray whitespace around cells (trimmed downstream, not here).
 */
function parseRow(line: string, delim: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === delim) {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  cells.push(cur);
  return cells;
}

/**
 * Produce a single roster textarea line from a row. Returns null if we can't
 * extract anything useful (row is blank or no recognizable columns).
 */
function rowToRosterLine(
  row: string[],
  hasHeaders: boolean,
  headerMap: Record<string, number>
): string | null {
  let displayName = "";
  let username = "";

  if (hasHeaders) {
    const name = headerMap.name !== undefined ? row[headerMap.name] : undefined;
    const first = headerMap.first !== undefined ? row[headerMap.first] : undefined;
    const last = headerMap.last !== undefined ? row[headerMap.last] : undefined;
    const uname = headerMap.username !== undefined ? row[headerMap.username] : undefined;
    const email = headerMap.email !== undefined ? row[headerMap.email] : undefined;

    if (name && name.trim()) {
      displayName = name.trim();
    } else if ((first && first.trim()) || (last && last.trim())) {
      displayName = [first?.trim(), last?.trim()].filter(Boolean).join(" ");
    }

    if (uname && uname.trim()) {
      username = uname.trim();
    } else if (email && email.trim() && email.includes("@")) {
      username = email.split("@")[0].trim();
    }
  } else {
    // Headerless — lean on column count.
    const cols = row.map((c) => c.trim()).filter((c) => c.length > 0);
    if (cols.length === 0) return null;

    if (cols.length === 1) {
      displayName = cols[0];
    } else if (cols.length === 2) {
      const [a, b] = cols;
      const aHasSpace = a.includes(" ");
      const bHasSpace = b.includes(" ");
      if (aHasSpace && !bHasSpace) {
        // "Jane Doe, jdoe"
        displayName = a;
        username = b;
      } else if (!aHasSpace && bHasSpace) {
        // "jdoe, Jane Doe" — matches the existing textarea convention.
        username = a;
        displayName = b;
      } else if (aHasSpace && bHasSpace) {
        // Both look like names (e.g. "Jane, Doe" or "Jane Doe, Mary Smith"). Keep first.
        displayName = a;
      } else {
        // Both single-token — treat as (username, name) for consistency.
        username = a;
        displayName = b;
      }
    } else {
      // 3+ columns: fall back to the first non-empty cell as the name.
      displayName = cols[0];
    }
  }

  if (!displayName && !username) return null;

  if (username && displayName) return `${username}, ${displayName}`;
  if (displayName) return displayName;
  return username;
}
