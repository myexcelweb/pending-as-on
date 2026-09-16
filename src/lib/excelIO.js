// Port of ExcelIO.cs using exceljs instead of EPPlus.
// The program only understands the QUERY layout (Sr. No., Case No., CNR,
// Petitioner Name VS Respondent Name, Advocate, Date of Registration, plus
// either Next Date/Purpose for PENDING or Date of Decision/Nature of
// Disposal for DISPOSED). The DASHBOARD layout is not supported.

import ExcelJS from "exceljs";
import { formatDate, parseDateRequired, parseFlexibleDate } from "./dateUtils.js";

export const PENDING_REQUIRED_COLUMNS = [
  "Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
  "Date of Registration", "Next Date", "Purpose", "Act Section", "Nature", "Designation",
];

export const DISPOSED_REQUIRED_COLUMNS = [
  "Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
  "Date of Registration", "Date of Decision", "Nature of Disposal", "Act Section", "Nature", "Designation",
];

const LIGHT_GREEN = "FF90EE90"; // matches System.Drawing.Color.LightGreen (#90EE90)

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

// Cell.Text equivalent: formatted display text for a cell value.
function cellText(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatDate(v);
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((rt) => rt.text).join("");
    if ("result" in v) return v.result === null || v.result === undefined ? "" : String(v.result);
    if ("text" in v) return String(v.text);
    if (v.error) return "";
  }
  return String(v);
}

export async function loadWorkbookFromFile(file) {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

// Scans the first N rows/cols for a marker header ("Sr. No."), same as
// ExcelIO.FindHeaderRow (scans up to 10 rows).
export function findHeaderRow(sheet, markerHeader) {
  const maxScanRow = Math.min(sheet.rowCount, 10);
  for (let row = 1; row <= maxScanRow; row++) {
    const rowObj = sheet.getRow(row);
    const colCount = Math.max(rowObj.cellCount, sheet.columnCount);
    for (let col = 1; col <= colCount; col++) {
      const text = cellText(rowObj.getCell(col)).trim();
      if (text.toLowerCase() === markerHeader.toLowerCase()) return row;
    }
  }
  return -1;
}

export function buildColumnMap(sheet, headerRow) {
  const map = {};
  const rowObj = sheet.getRow(headerRow);
  const colCount = Math.max(rowObj.cellCount, sheet.columnCount);
  for (let col = 1; col <= colCount; col++) {
    const header = cellText(rowObj.getCell(col)).trim();
    const key = header.toLowerCase();
    if (header !== "" && !(key in map)) map[key] = col;
  }
  return map;
}

function mapGet(colMap, name) {
  return colMap[name.toLowerCase()];
}

// DetectFileType: look at the header row and decide PENDING / DISPOSED / UNKNOWN.
export function detectFileType(sheet) {
  const headerRow = findHeaderRow(sheet, "Sr. No.");
  if (headerRow === -1) return { type: "Unknown", headerRow: -1, colMap: {} };

  const colMap = buildColumnMap(sheet, headerRow);
  const hasDisposedCols = mapGet(colMap, "Date of Decision") && mapGet(colMap, "Nature of Disposal");
  const hasPendingCols = mapGet(colMap, "Next Date") && mapGet(colMap, "Purpose");

  if (hasDisposedCols) return { type: "Disposed", headerRow, colMap };
  if (hasPendingCols) return { type: "Pending", headerRow, colMap };
  return { type: "Unknown", headerRow, colMap };
}

function validateColumns(colMap, required, fileName) {
  for (const req of required) {
    if (mapGet(colMap, req) === undefined) {
      throw new Error(`Column '${req}' not found in '${fileName}'.`);
    }
  }
}

function parseIntSafe(text) {
  const n = parseInt(String(text).trim(), 10);
  return Number.isNaN(n) ? 0 : n;
}

export function loadPending(sheet, headerRow, colMap, fileName) {
  const records = [];
  validateColumns(colMap, PENDING_REQUIRED_COLUMNS, fileName);
  const rowCount = sheet.rowCount;

  for (let row = headerRow + 1; row <= rowCount; row++) {
    const rowObj = sheet.getRow(row);
    const srText = cellText(rowObj.getCell(mapGet(colMap, "Sr. No.")));
    if (srText.trim() === "") continue;

    records.push({
      srNo: parseIntSafe(srText),
      caseNo: cellText(rowObj.getCell(mapGet(colMap, "Case No."))),
      cnr: cellText(rowObj.getCell(mapGet(colMap, "CNR"))),
      petitionerVsRespondent: cellText(rowObj.getCell(mapGet(colMap, "Petitioner Name VS Respondent Name"))),
      advocate: cellText(rowObj.getCell(mapGet(colMap, "Advocate"))),
      dateOfRegistration: parseDateRequired(rawValue(rowObj, colMap, "Date of Registration")),
      nextDate: parseFlexibleDate(rawValue(rowObj, colMap, "Next Date")),
      purpose: cellText(rowObj.getCell(mapGet(colMap, "Purpose"))),
      actSection: cellText(rowObj.getCell(mapGet(colMap, "Act Section"))),
      nature: cellText(rowObj.getCell(mapGet(colMap, "Nature"))),
      designation: cellText(rowObj.getCell(mapGet(colMap, "Designation"))),
      isMovedFromDisposed: false,
      sourceFileName: fileName,
    });
  }
  return records;
}

export function loadDisposed(sheet, headerRow, colMap, fileName) {
  const records = [];
  validateColumns(colMap, DISPOSED_REQUIRED_COLUMNS, fileName);
  const rowCount = sheet.rowCount;

  for (let row = headerRow + 1; row <= rowCount; row++) {
    const rowObj = sheet.getRow(row);
    const srText = cellText(rowObj.getCell(mapGet(colMap, "Sr. No.")));
    if (srText.trim() === "") continue;

    records.push({
      srNo: parseIntSafe(srText),
      caseNo: cellText(rowObj.getCell(mapGet(colMap, "Case No."))),
      cnr: cellText(rowObj.getCell(mapGet(colMap, "CNR"))),
      petitionerVsRespondent: cellText(rowObj.getCell(mapGet(colMap, "Petitioner Name VS Respondent Name"))),
      advocate: cellText(rowObj.getCell(mapGet(colMap, "Advocate"))),
      dateOfRegistration: parseDateRequired(rawValue(rowObj, colMap, "Date of Registration")),
      dateOfDecision: parseDateRequired(rawValue(rowObj, colMap, "Date of Decision")),
      natureOfDisposal: cellText(rowObj.getCell(mapGet(colMap, "Nature of Disposal"))),
      actSection: cellText(rowObj.getCell(mapGet(colMap, "Act Section"))),
      nature: cellText(rowObj.getCell(mapGet(colMap, "Nature"))),
      designation: cellText(rowObj.getCell(mapGet(colMap, "Designation"))),
      sourceFileName: fileName,
    });
  }
  return records;
}

// Prefer the raw cell.value for date columns (so real Excel date cells
// parse correctly), falling back to formatted text.
function rawValue(rowObj, colMap, name) {
  const col = mapGet(colMap, name);
  const cell = rowObj.getCell(col);
  if (cell.value instanceof Date) return cell.value;
  const text = cellText(cell);
  return text;
}

// ---------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------

function writeHeaderStyle(sheet, headers) {
  headers.forEach((h, i) => {
    const cell = sheet.getRow(2).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });
}

function autoFitColumns(sheet, headers) {
  headers.forEach((h, i) => {
    let maxLen = h.length;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const v = row.getCell(i + 1).value;
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > maxLen) maxLen = len;
    });
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 60);
  });
}

function fillLightGreen(row, colCount) {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: LIGHT_GREEN },
    };
  }
}

export function newWorkbook() {
  return new ExcelJS.Workbook();
}

export function savePending(workbook, sheetName, records, courtType, estab, titleSuffix = "") {
  const sheet = workbook.addWorksheet(sheetName);
  const headers = ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Next Date", "Purpose", "Act Section", "Nature", "Designation"];

  sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_PENDING${titleSuffix}`;
  sheet.mergeCells(1, 1, 1, 11);
  writeHeaderStyle(sheet, headers);

  let row = 3;
  let sr = 1;
  for (const rec of records) {
    const r = sheet.getRow(row);
    r.getCell(1).value = sr++;
    r.getCell(2).value = rec.caseNo;
    r.getCell(3).value = rec.cnr;
    r.getCell(4).value = rec.petitionerVsRespondent;
    r.getCell(5).value = rec.advocate;
    r.getCell(6).value = formatDate(rec.dateOfRegistration);
    r.getCell(7).value = rec.nextDate ? formatDate(rec.nextDate) : "";
    r.getCell(8).value = rec.purpose;
    r.getCell(9).value = rec.actSection;
    r.getCell(10).value = rec.nature;
    r.getCell(11).value = rec.designation;

    if (rec.isMovedFromDisposed) fillLightGreen(r, 11);
    row++;
  }
  autoFitColumns(sheet, headers);
  return sheet;
}

export function saveDisposed(workbook, sheetName, records, courtType, estab, titleSuffix = "") {
  const sheet = workbook.addWorksheet(sheetName);
  const headers = ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Date of Decision", "Nature of Disposal", "Act Section", "Nature", "Designation"];

  sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_DISPOSED${titleSuffix}`;
  sheet.mergeCells(1, 1, 1, 11);
  writeHeaderStyle(sheet, headers);

  let row = 3;
  let sr = 1;
  for (const rec of records) {
    const r = sheet.getRow(row);
    r.getCell(1).value = sr++;
    r.getCell(2).value = rec.caseNo;
    r.getCell(3).value = rec.cnr;
    r.getCell(4).value = rec.petitionerVsRespondent;
    r.getCell(5).value = rec.advocate;
    r.getCell(6).value = formatDate(rec.dateOfRegistration);
    r.getCell(7).value = formatDate(rec.dateOfDecision);
    r.getCell(8).value = rec.natureOfDisposal;
    r.getCell(9).value = rec.actSection;
    r.getCell(10).value = rec.nature;
    r.getCell(11).value = rec.designation;
    row++;
  }
  autoFitColumns(sheet, headers);
  return sheet;
}

// Builds a standalone workbook (as a Blob) with PENDING_DELETED / DISPOSED_DELETED
// sheets — mirrors ExcelIO.SaveDeletedCombined.
export async function buildDeletedCombinedWorkbook(deletedPending, deletedDisposed, courtType, estab) {
  const wb = newWorkbook();
  const pendingHeaders = ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Next Date", "Purpose", "Act Section", "Nature", "Designation"];
  const disposedHeaders = ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Date of Decision", "Nature of Disposal", "Act Section", "Nature", "Designation"];

  if (deletedPending.length > 0) {
    const sheet = wb.addWorksheet("PENDING_DELETED");
    sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_PENDING_DELETED (Registration after target date)`;
    sheet.mergeCells(1, 1, 1, 11);
    writeHeaderStyle(sheet, pendingHeaders);
    let row = 3, sr = 1;
    for (const rec of deletedPending) {
      const r = sheet.getRow(row);
      r.getCell(1).value = sr++;
      r.getCell(2).value = rec.caseNo;
      r.getCell(3).value = rec.cnr;
      r.getCell(4).value = rec.petitionerVsRespondent;
      r.getCell(5).value = rec.advocate;
      r.getCell(6).value = formatDate(rec.dateOfRegistration);
      r.getCell(7).value = rec.nextDate ? formatDate(rec.nextDate) : "";
      r.getCell(8).value = rec.purpose;
      r.getCell(9).value = rec.actSection;
      r.getCell(10).value = rec.nature;
      r.getCell(11).value = rec.designation;
      row++;
    }
    autoFitColumns(sheet, pendingHeaders);
  }

  if (deletedDisposed.length > 0) {
    const sheet = wb.addWorksheet("DISPOSED_DELETED");
    sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_DISPOSED_DELETED (Registration after target date)`;
    sheet.mergeCells(1, 1, 1, 11);
    writeHeaderStyle(sheet, disposedHeaders);
    let row = 3, sr = 1;
    for (const rec of deletedDisposed) {
      const r = sheet.getRow(row);
      r.getCell(1).value = sr++;
      r.getCell(2).value = rec.caseNo;
      r.getCell(3).value = rec.cnr;
      r.getCell(4).value = rec.petitionerVsRespondent;
      r.getCell(5).value = rec.advocate;
      r.getCell(6).value = formatDate(rec.dateOfRegistration);
      r.getCell(7).value = formatDate(rec.dateOfDecision);
      r.getCell(8).value = rec.natureOfDisposal;
      r.getCell(9).value = rec.actSection;
      r.getCell(10).value = rec.nature;
      r.getCell(11).value = rec.designation;
      row++;
    }
    autoFitColumns(sheet, disposedHeaders);
  }

  if (wb.worksheets.length === 0) return null;
  return wb.xlsx.writeBuffer();
}

// Mirrors ExcelIO.SaveDuplicatesCombined
// duplicatePendingReport / duplicateDisposedReport: arrays of records from
// dedupeByCaseNo's `report` output — i.e. BOTH the KEPT copy and the
// REMOVED copy(ies) for every CNR that repeated within this establishment,
// each already tagged with `dedupeStatus: "KEPT" | "REMOVED"` and carrying
// `sourceFileName` (which file that particular copy came from).
//
// Two extra columns are written vs. the plain PENDING/DISPOSED sheets:
//   - "Status"       -> KEPT or REMOVED
//   - "Source File"  -> the uploaded file that row came from
// so the DUPLICATE workbook is a self-contained audit trail: for every
// duplicate CNR you can see every copy, which file each one came from, and
// which single copy was kept.
export async function buildDuplicatesCombinedWorkbook(duplicatePendingReport, duplicateDisposedReport, courtType, estab) {
  const wb = newWorkbook();
  // "Status" is now split into two separate columns — "Keep" and
  // "Removed/Deleted" — so each row shows a mark in exactly ONE of the two
  // columns, rather than one shared status column with two possible values.
  const pendingHeaders = ["Sr. No.", "Keep", "Removed/Deleted", "Source File", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Next Date", "Purpose", "Act Section", "Nature", "Designation"];
  const disposedHeaders = ["Sr. No.", "Keep", "Removed/Deleted", "Source File", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
    "Date of Registration", "Date of Decision", "Nature of Disposal", "Act Section", "Nature", "Designation"];

  if (duplicatePendingReport.length > 0) {
    const sheet = wb.addWorksheet("PENDING_DUPLICATE");
    sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_PENDING_DUPLICATE (same CNR within establishment — KEPT + REMOVED)`;
    sheet.mergeCells(1, 1, 1, pendingHeaders.length);
    writeHeaderStyle(sheet, pendingHeaders);
    let row = 3, sr = 1;
    for (const rec of duplicatePendingReport) {
      const r = sheet.getRow(row);
      const isKept = rec.dedupeStatus === "KEPT";
      r.getCell(1).value = sr++;
      r.getCell(2).value = isKept ? "KEEP" : "";
      r.getCell(3).value = isKept ? "" : "DELETED";
      r.getCell(4).value = rec.sourceFileName;
      r.getCell(5).value = rec.caseNo;
      r.getCell(6).value = rec.cnr;
      r.getCell(7).value = rec.petitionerVsRespondent;
      r.getCell(8).value = rec.advocate;
      r.getCell(9).value = formatDate(rec.dateOfRegistration);
      r.getCell(10).value = rec.nextDate ? formatDate(rec.nextDate) : "";
      r.getCell(11).value = rec.purpose;
      r.getCell(12).value = rec.actSection;
      r.getCell(13).value = rec.nature;
      r.getCell(14).value = rec.designation;
      if (!isKept) fillLightGreen(r, pendingHeaders.length);
      row++;
    }
    autoFitColumns(sheet, pendingHeaders);
  }

  if (duplicateDisposedReport.length > 0) {
    const sheet = wb.addWorksheet("DISPOSED_DUPLICATE");
    sheet.getCell(1, 1).value = `PORBANDAR_${courtType}_COURT_${estab}_DISPOSED_DUPLICATE (same CNR within establishment — KEPT + REMOVED)`;
    sheet.mergeCells(1, 1, 1, disposedHeaders.length);
    writeHeaderStyle(sheet, disposedHeaders);
    let row = 3, sr = 1;
    for (const rec of duplicateDisposedReport) {
      const r = sheet.getRow(row);
      const isKept = rec.dedupeStatus === "KEPT";
      r.getCell(1).value = sr++;
      r.getCell(2).value = isKept ? "KEEP" : "";
      r.getCell(3).value = isKept ? "" : "DELETED";
      r.getCell(4).value = rec.sourceFileName;
      r.getCell(5).value = rec.caseNo;
      r.getCell(6).value = rec.cnr;
      r.getCell(7).value = rec.petitionerVsRespondent;
      r.getCell(8).value = rec.advocate;
      r.getCell(9).value = formatDate(rec.dateOfRegistration);
      r.getCell(10).value = formatDate(rec.dateOfDecision);
      r.getCell(11).value = rec.natureOfDisposal;
      r.getCell(12).value = rec.actSection;
      r.getCell(13).value = rec.nature;
      r.getCell(14).value = rec.designation;
      if (!isKept) fillLightGreen(r, disposedHeaders.length);
      row++;
    }
    autoFitColumns(sheet, disposedHeaders);
  }

  if (wb.worksheets.length === 0) return null;
  return wb.xlsx.writeBuffer();
}

// Mirrors ExcelIO.SaveAllDataMerged
export async function buildAllDataWorkbook(rows) {
  const wb = newWorkbook();
  const sheet = wb.addWorksheet("ALL_DATA");
  const headers = ["Sr. No.", "Estab", "Status", "Case No.", "CNR", "Petitioner Name VS Respondent Name",
    "Advocate", "Date of Registration", "Next Date", "Purpose", "Date of Decision",
    "Nature of Disposal", "Act Section", "Nature", "Designation", "Original File Name"];

  sheet.getCell(1, 1).value = "ALL_DATA (merged: PENDING / DISPOSE / MOVE / DUPLICATE / DELETE)";
  sheet.mergeCells(1, 1, 1, headers.length);
  headers.forEach((h, i) => {
    const c = sheet.getRow(2).getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
  });

  let row = 3;
  let sr = 1;
  for (const rec of rows) {
    const r = sheet.getRow(row);
    r.getCell(1).value = sr++;
    r.getCell(2).value = rec.estab;
    r.getCell(3).value = rec.status;
    r.getCell(4).value = rec.caseNo;
    r.getCell(5).value = rec.cnr;
    r.getCell(6).value = rec.petitionerVsRespondent;
    r.getCell(7).value = rec.advocate;
    r.getCell(8).value = formatDate(rec.dateOfRegistration);
    r.getCell(9).value = rec.nextDate ? formatDate(rec.nextDate) : "";
    r.getCell(10).value = rec.purpose;
    r.getCell(11).value = rec.dateOfDecision ? formatDate(rec.dateOfDecision) : "";
    r.getCell(12).value = rec.natureOfDisposal;
    r.getCell(13).value = rec.actSection;
    r.getCell(14).value = rec.nature;
    r.getCell(15).value = rec.designation;
    r.getCell(16).value = rec.originalFileName;

    if ((rec.status || "").toUpperCase() === "MOVE") fillLightGreen(r, headers.length);
    row++;
  }
  autoFitColumns(sheet, headers);
  return wb.xlsx.writeBuffer();
}

export async function workbookToBuffer(workbook) {
  return workbook.xlsx.writeBuffer();
}
