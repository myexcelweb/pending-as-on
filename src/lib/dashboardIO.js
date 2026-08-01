// Handles the DASHBOARD-format layout (Sr. No. / Cases / Party Name / ...).
// Unlike the QUERY_BUILDER layout, DASHBOARD files aren't run through the
// MOVE/DELETE/monthwise pipeline — they're auto-detected, deduplicated
// (same source file + repeated "Cases" value = duplicate), and re-saved
// as a clean workbook, ready to be zipped up proforma-wise.

import ExcelJS from "exceljs";

function cellRaw(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if (v.richText) return v.richText.map((rt) => rt.text).join("");
    if ("result" in v) return v.result ?? "";
    if ("text" in v) return v.text;
    if (v.error) return "";
  }
  return v;
}

// Reads the title row(s) above the header, the header row itself, and
// every non-empty data row below it, as plain arrays of cell values.
export function readDashboardSheet(sheet, headerRow, colMap) {
  const headerRowObj = sheet.getRow(headerRow);
  const colCount = Math.max(headerRowObj.cellCount, sheet.columnCount);

  const header = [];
  for (let c = 1; c <= colCount; c++) header.push(cellRaw(headerRowObj.getCell(c)) || "");

  const titleRows = [];
  for (let r = 1; r < headerRow; r++) {
    const rowObj = sheet.getRow(r);
    const vals = [];
    for (let c = 1; c <= colCount; c++) vals.push(cellRaw(rowObj.getCell(c)));
    titleRows.push(vals);
  }

  const rows = [];
  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const rowObj = sheet.getRow(r);
    const vals = [];
    let blank = true;
    for (let c = 1; c <= colCount; c++) {
      const v = cellRaw(rowObj.getCell(c));
      if (v !== "" && v !== null && v !== undefined) blank = false;
      vals.push(v);
    }
    if (blank) continue;
    rows.push(vals);
  }

  const casesColIndex = (colMap["cases"] ?? 2) - 1;
  return { header, titleRows, rows, casesColIndex };
}

// Removes rows with a repeated "Cases" value, keeping only the first
// occurrence. Call this once per uploaded file, BEFORE merging anything —
// a repeat is only a duplicate when it comes from the same source file.
export function dedupeDashboardRows(rows, casesColIndex) {
  const seen = new Set();
  const result = [];
  const duplicates = [];
  for (const r of rows) {
    const key = String(r[casesColIndex] ?? "").trim().toUpperCase();
    if (key !== "" && seen.has(key)) {
      duplicates.push(r);
    } else {
      if (key !== "") seen.add(key);
      result.push(r);
    }
  }
  return { result, duplicates };
}

function fmtCell(v) {
  if (v instanceof Date) {
    const dd = String(v.getDate()).padStart(2, "0");
    const mm = String(v.getMonth() + 1).padStart(2, "0");
    const yyyy = v.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return v;
}

// Writes a cleaned, deduplicated DASHBOARD-format workbook: original
// title row(s), the header row, then the deduped data rows with a
// re-numbered Sr. No. column (column 1).
export async function buildDashboardWorkbook(titleRows, header, rows, sheetName = "Sheet1") {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(sheetName);

  let r = 1;
  for (const tRow of titleRows) {
    const rowObj = sheet.getRow(r);
    tRow.forEach((v, i) => {
      rowObj.getCell(i + 1).value = fmtCell(v);
    });
    if (header.length > 1) sheet.mergeCells(r, 1, r, header.length);
    rowObj.getCell(1).font = { bold: true };
    rowObj.getCell(1).alignment = { wrapText: true };
    r++;
  }

  const headerRowObj = sheet.getRow(r);
  header.forEach((h, i) => {
    const cell = headerRowObj.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });
  r++;

  let sr = 1;
  for (const row of rows) {
    const rowObj = sheet.getRow(r);
    row.forEach((v, i) => {
      rowObj.getCell(i + 1).value = i === 0 ? sr : fmtCell(v);
    });
    sr++;
    r++;
  }

  header.forEach((h, i) => {
    let maxLen = (h || "").length;
    for (const row of rows) {
      const v = row[i];
      const len = v === null || v === undefined ? 0 : String(fmtCell(v)).length;
      if (len > maxLen) maxLen = len;
    }
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 60);
  });

  return wb.xlsx.writeBuffer();
}
