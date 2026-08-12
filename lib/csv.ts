// CSV export.
//
// The values here are company names, roles and email addresses that arrived
// from a scraped job posting — text this app has never validated and cannot
// vouch for. Two separate things therefore have to be escaped, and only one of
// them is about CSV.

/**
 * The characters that make Excel, Sheets and LibreOffice treat a cell as a
 * formula rather than as text.
 *
 * A scraped company field of `=HYPERLINK("http://evil","Click")` is inert
 * everywhere in this app — React escapes it, Mongo stores it as a string — and
 * then becomes live code the moment the user opens the export. The file is the
 * attack surface, so the file is where it gets neutralised.
 */
const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  // A leading apostrophe is what spreadsheets read as "the rest of this is
  // text". Prefixing rather than stripping keeps the value intact and
  // readable — a phone number of -44… should still say -44… in the cell.
  if (FORMULA_TRIGGERS.some((c) => text.startsWith(c))) {
    text = `'${text}`;
  }

  // Ordinary CSV quoting, which is a separate concern from the above: a
  // company called `Smith, Jones & Co` must not become two columns.
  if (/[",\n\r]/.test(text) || text !== text.trim()) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

/** Rows to a CSV string, with a header line. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => escapeCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  // CRLF: the line ending the CSV RFC specifies, and the one Excel wants on
  // the platform most of these files will be opened on.
  return lines.join("\r\n");
}

/** Hand a generated CSV to the browser as a download. */
export function downloadCsv(filename: string, content: string): void {
  // The BOM is what stops Excel from rendering a UTF-8 name like "Grønland"
  // as mojibake. It is invisible to every other reader.
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();

  // Without this the blob is held for the lifetime of the document, which for
  // a single-page app is until the tab closes.
  URL.revokeObjectURL(url);
}
