// Auto-detects which "proforma" (source layout) an uploaded case-register
// file uses, purely from its column headers — never from the file name:
//
//   QUERY_BUILDER  -> Sr. No. / Case No. / CNR / Petitioner Name VS
//                      Respondent Name / Advocate / ... (the original
//                      QUERY-export layout)
//   DASHBOARD      -> Sr. No. / Cases / Party Name / ... (the DASHBOARD
//                      export layout)
//
// Also works out whether the file is a PENDING or DISPOSED register from
// its columns. Returns UNKNOWN/Unknown for anything that matches neither.
//
// NOTE: header matching is now tolerant of common real-world variations —
// extra whitespace, trailing periods, and a handful of known alternate
// spellings — instead of requiring an exact string match. This prevents a
// genuine DASHBOARD (or QUERY_BUILDER) file from being silently counted as
// UNKNOWN just because a column was labelled "Party" instead of
// "Party Name", or "Case No" instead of "Case No.", etc.

import { findHeaderRow, buildColumnMap } from "./excelIO.js";

// Strips periods and collapses whitespace so "Case No." / "Case No" /
// "Case  No." all normalize to the same key.
function normalize(str) {
  return str
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns true if colMap has a column matching ANY of the given aliases.
function hasAny(colMap, aliases) {
  const normalizedKeys = Object.keys(colMap).map(normalize);
  return aliases.some((alias) => normalizedKeys.includes(normalize(alias)));
}

// Known alternate header spellings, grouped by logical field.
const ALIASES = {
  caseNo: ["Case No.", "Case No", "Case Number", "CaseNo"],
  cnr: ["CNR", "CNR No.", "CNR No", "CNR Number"],
  cases: ["Cases", "Case", "Case(s)"],
  partyName: ["Party Name", "Party", "Parties", "Parties Name", "Party Names"],
  dateOfDecision: ["Date of Decision", "Date Of Decision", "Decision Date"],
  natureOfDisposal: ["Nature of Disposal", "Nature Of Disposal", "Disposal Nature"],
  nextDate: ["Next Date", "Next Date Of Hearing", "Next Hearing Date"],
  purpose: ["Purpose", "Purpose Of Hearing"],
  nextPurpose: ["Next Purpose", "Next Purpose Of Hearing"],
};

export function detectProforma(sheet) {
  const headerRow = findHeaderRow(sheet, "Sr. No.");
  if (headerRow === -1) {
    return { proforma: "UNKNOWN", type: "Unknown", headerRow: -1, colMap: {} };
  }

  const colMap = buildColumnMap(sheet, headerRow);

  const isQueryBuilder = hasAny(colMap, ALIASES.caseNo) && hasAny(colMap, ALIASES.cnr);
  const isDashboard = hasAny(colMap, ALIASES.cases) && hasAny(colMap, ALIASES.partyName);

  if (isQueryBuilder) {
    const hasDisposedCols =
      hasAny(colMap, ALIASES.dateOfDecision) && hasAny(colMap, ALIASES.natureOfDisposal);
    const hasPendingCols = hasAny(colMap, ALIASES.nextDate) && hasAny(colMap, ALIASES.purpose);
    if (hasDisposedCols) return { proforma: "QUERY_BUILDER", type: "Disposed", headerRow, colMap };
    if (hasPendingCols) return { proforma: "QUERY_BUILDER", type: "Pending", headerRow, colMap };
    return { proforma: "QUERY_BUILDER", type: "Unknown", headerRow, colMap };
  }

  if (isDashboard) {
    const hasDisposedCols = hasAny(colMap, ALIASES.dateOfDecision);
    const hasPendingCols = hasAny(colMap, ALIASES.nextDate) || hasAny(colMap, ALIASES.nextPurpose);
    if (hasDisposedCols) return { proforma: "DASHBOARD", type: "Disposed", headerRow, colMap };
    if (hasPendingCols) return { proforma: "DASHBOARD", type: "Pending", headerRow, colMap };
    return { proforma: "DASHBOARD", type: "Unknown", headerRow, colMap };
  }

  return { proforma: "UNKNOWN", type: "Unknown", headerRow, colMap };
}
