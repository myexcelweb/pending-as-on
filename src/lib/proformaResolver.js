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

import { findHeaderRow, buildColumnMap } from "./excelIO.js";

function has(colMap, name) {
  return colMap[name.toLowerCase()] !== undefined;
}

export function detectProforma(sheet) {
  const headerRow = findHeaderRow(sheet, "Sr. No.");
  if (headerRow === -1) {
    return { proforma: "UNKNOWN", type: "Unknown", headerRow: -1, colMap: {} };
  }

  const colMap = buildColumnMap(sheet, headerRow);

  const isQueryBuilder = has(colMap, "Case No.") && has(colMap, "CNR");
  const isDashboard = has(colMap, "Cases") && has(colMap, "Party Name");

  if (isQueryBuilder) {
    const hasDisposedCols = has(colMap, "Date of Decision") && has(colMap, "Nature of Disposal");
    const hasPendingCols = has(colMap, "Next Date") && has(colMap, "Purpose");
    if (hasDisposedCols) return { proforma: "QUERY_BUILDER", type: "Disposed", headerRow, colMap };
    if (hasPendingCols) return { proforma: "QUERY_BUILDER", type: "Pending", headerRow, colMap };
    return { proforma: "QUERY_BUILDER", type: "Unknown", headerRow, colMap };
  }

  if (isDashboard) {
    const hasDisposedCols = has(colMap, "Date of Decision");
    const hasPendingCols = has(colMap, "Next Date") || has(colMap, "Next Purpose");
    if (hasDisposedCols) return { proforma: "DASHBOARD", type: "Disposed", headerRow, colMap };
    if (hasPendingCols) return { proforma: "DASHBOARD", type: "Pending", headerRow, colMap };
    return { proforma: "DASHBOARD", type: "Unknown", headerRow, colMap };
  }

  return { proforma: "UNKNOWN", type: "Unknown", headerRow, colMap };
}
