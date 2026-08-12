import { describe, expect, it } from "vitest";

import { toCsv, type CsvColumn } from "./csv";

interface Row {
  company: string;
  role: string;
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: "Company", value: (r) => r.company },
  { header: "Role", value: (r) => r.role },
];

function body(rows: Row[]): string[] {
  return toCsv(rows, COLUMNS).split("\r\n").slice(1);
}

describe("toCsv", () => {
  it("writes a header and a row per record", () => {
    expect(toCsv([{ company: "Acme", role: "Engineer" }], COLUMNS)).toBe(
      "Company,Role\r\nAcme,Engineer"
    );
  });

  it("writes just the header for no rows", () => {
    // An empty export should still open as a valid file with named columns,
    // not as a zero-byte file the user assumes is a failed download.
    expect(toCsv([], COLUMNS)).toBe("Company,Role");
  });

  it("quotes a value containing a comma", () => {
    expect(body([{ company: "Smith, Jones & Co", role: "Dev" }])).toEqual([
      '"Smith, Jones & Co",Dev',
    ]);
  });

  it("doubles embedded quotes", () => {
    expect(body([{ company: 'The "Best" Co', role: "Dev" }])).toEqual([
      '"The ""Best"" Co",Dev',
    ]);
  });

  it("quotes a value containing a newline", () => {
    expect(body([{ company: "Acme\nCorp", role: "Dev" }])).toEqual(['"Acme\nCorp",Dev']);
  });

  it("quotes a value with surrounding whitespace so it survives the round trip", () => {
    expect(body([{ company: "  Acme  ", role: "Dev" }])).toEqual(['"  Acme  ",Dev']);
  });

  it("renders null and undefined as empty, not as the words", () => {
    const columns: CsvColumn<{ a: null; b: undefined }>[] = [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ];
    expect(toCsv([{ a: null, b: undefined }], columns)).toBe("A,B\r\n,");
  });
});

describe("formula injection", () => {
  // These values are inert inside the app and become live code when the
  // exported file is opened. The export is the only place that can stop it.
  const dangerous = [
    '=HYPERLINK("http://evil.test","Click")',
    "+1+1",
    "-2+3",
    "@SUM(A1:A9)",
    "\tcmd",
  ];

  it.each(dangerous)("neutralises a cell starting with %j", (value) => {
    const [row] = body([{ company: value, role: "Dev" }]);
    // Either bare or quoted, but the apostrophe must come first either way.
    expect(row.startsWith("'") || row.startsWith("\"'")).toBe(true);
  });

  it("keeps the value readable rather than stripping it", () => {
    // A phone number of -44… must still say -44… once the cell is text.
    const [row] = body([{ company: "-4477", role: "Dev" }]);
    expect(row).toBe("'-4477,Dev");
  });

  it("leaves an ordinary value untouched", () => {
    expect(body([{ company: "Acme", role: "Engineer" }])).toEqual(["Acme,Engineer"]);
  });

  it("only treats the leading character as a trigger", () => {
    // An equals sign mid-string is just punctuation; prefixing every cell
    // containing one would make the export unreadable.
    expect(body([{ company: "A=B", role: "Dev" }])).toEqual(["A=B,Dev"]);
  });
});
