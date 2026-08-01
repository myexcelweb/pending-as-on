// Builds the CONSOLIDATED (DASHBOARD + QUERY_BUILDER) proforma-wise
// workbooks: a FULL OUTER JOIN — "keep everything" — of every
// QUERY_BUILDER record and every DASHBOARD row, matched on
// Case No. / Cases (normalized: trimmed, upper-cased).
//
// Every row from BOTH sides is kept:
//   - a Case No. found in QUERY_BUILDER only  -> QUERY_BUILDER columns filled, DASHBOARD columns blank
//   - a Case found in DASHBOARD only          -> DASHBOARD columns filled, QUERY_BUILDER columns blank
//   - found on both sides                     -> every column filled, "Match Status" = BOTH
//
// Input is taken from the already-deduplicated data (per-file AND, for
// QUERY_BUILDER, establishment-wise) produced by inputScanner.scanAll, so
// this join never re-introduces a same-file duplicate.
//
// Produces one workbook per type: PENDING_CONSOLIDATED.xlsx and
// DISPOSED_CONSOLIDATED.xlsx (only for the type(s) actually present).

import ExcelJS from "exceljs";
import { formatDate } from "./dateUtils.js";

function normKey(v) {
  return String(v ?? "").trim().toUpperCase();
}

function fmtVal(v) {
  if (v instanceof Date) return formatDate(v);
  return v === null || v === undefined ? "" : v;
}

// Flattens scan.pendingByEstab / scan.disposedByEstab into one list,
// tagging each record with its establishment.
function flattenQueryBuilder(byEstab) {
  const list = [];
  for (const estab of Object.keys(byEstab || {})) {
    for (const rec of byEstab[estab]) list.push({ ...rec, estab });
  }
  return list;
}

const QB_COLUMNS = {
  Pending: [
    ["Estab", (r) => r.estab],
    ["CNR", (r) => r.cnr],
    ["Petitioner Name VS Respondent Name", (r) => r.petitionerVsRespondent],
    ["Advocate", (r) => r.advocate],
    ["Date of Registration", (r) => fmtVal(r.dateOfRegistration)],
    ["Next Date", (r) => (r.nextDate ? fmtVal(r.nextDate) : "")],
    ["Purpose", (r) => r.purpose],
    ["Act Section", (r) => r.actSection],
    ["Nature", (r) => r.nature],
    ["Designation", (r) => r.designation],
    ["QB Source File", (r) => r.sourceFileName],
  ],
  Disposed: [
    ["Estab", (r) => r.estab],
    ["CNR", (r) => r.cnr],
    ["Petitioner Name VS Respondent Name", (r) => r.petitionerVsRespondent],
    ["Advocate", (r) => r.advocate],
    ["Date of Registration", (r) => fmtVal(r.dateOfRegistration)],
    ["Date of Decision", (r) => fmtVal(r.dateOfDecision)],
    ["Nature of Disposal", (r) => r.natureOfDisposal],
    ["Act Section", (r) => r.actSection],
    ["Nature", (r) => r.nature],
    ["Designation", (r) => r.designation],
    ["QB Source File", (r) => r.sourceFileName],
  ],
};

// Builds the FULL OUTER JOIN workbook for a single type (Pending/Disposed).
async function buildConsolidatedType(type, qbRecords, dashboardEntries, log) {
  const qbCols = QB_COLUMNS[type];

  // DASHBOARD column template (header minus the Sr.No. col and the Cases
  // col itself, since Case No./Cases is already the shared join column) —
  // taken from the first DASHBOARD file of this type that was uploaded.
  const template = dashboardEntries.find((d) => d.type === type);
  const dbCasesIdx = template ? template.casesColIndex : 1;
  const dbHeaderIdxs = template
    ? template.header.map((_, i) => i).filter((i) => i !== 0 && i !== dbCasesIdx)
    : [];
  const dbHeader = template ? dbHeaderIdxs.map((i) => template.header[i] || `Col${i + 1}`) : [];

  // key -> { qb, db, dbFile }
  const joined = new Map();

  for (const rec of qbRecords) {
    const key = normKey(rec.caseNo);
    if (key === "") continue;
    if (!joined.has(key)) joined.set(key, { qb: null, db: null, dbFile: null });
    const slot = joined.get(key);
    if (!slot.qb) slot.qb = rec; // same-file/estab dedupe already happened upstream
  }

  for (const entry of dashboardEntries) {
    if (entry.type !== type) continue;
    for (const row of entry.rows) {
      const key = normKey(row[entry.casesColIndex]);
      if (key === "") continue;
      if (!joined.has(key)) joined.set(key, { qb: null, db: null, dbFile: null });
      const slot = joined.get(key);
      if (!slot.db) {
        slot.db = row;
        slot.dbFile = entry.fileName;
      }
    }
  }

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet(`${type.toUpperCase()}_CONSOLIDATED`);
  const headers = [
    "Sr. No.",
    "Match Status",
    "Case No. / Cases",
    ...qbCols.map((c) => c[0]),
    ...dbHeader,
    "DB Source File",
  ];
  headers.forEach((h, i) => {
    const cell = sheet.getRow(1).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });

  const sortedKeys = Array.from(joined.keys()).sort((a, b) => a.localeCompare(b));
  let bothCount = 0;
  let qbOnlyCount = 0;
  let dbOnlyCount = 0;
  let r = 2;
  let sr = 1;

  for (const key of sortedKeys) {
    const { qb, db, dbFile } = joined.get(key);
    const status = qb && db ? "BOTH" : qb ? "QUERY_BUILDER ONLY" : "DASHBOARD ONLY";
    if (status === "BOTH") bothCount++;
    else if (status === "QUERY_BUILDER ONLY") qbOnlyCount++;
    else dbOnlyCount++;

    const rowObj = sheet.getRow(r);
    let c = 1;
    rowObj.getCell(c++).value = sr++;
    rowObj.getCell(c++).value = status;
    rowObj.getCell(c++).value = qb ? qb.caseNo : db[template.casesColIndex];
    for (const [, getter] of qbCols) rowObj.getCell(c++).value = qb ? fmtVal(getter(qb)) : "";
    for (const idx of dbHeaderIdxs) rowObj.getCell(c++).value = db ? fmtVal(db[idx]) : "";
    rowObj.getCell(c++).value = dbFile || "";

    if (status === "BOTH") {
      for (let cc = 1; cc <= headers.length; cc++) {
        rowObj.getCell(cc).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
      }
    }
    r++;
  }

  headers.forEach((h, i) => {
    let maxLen = (h || "").length;
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const v = row.getCell(i + 1).value;
      const len = v === null || v === undefined ? 0 : String(v).length;
      if (len > maxLen) maxLen = len;
    });
    sheet.getColumn(i + 1).width = Math.min(Math.max(maxLen + 2, 10), 60);
  });

  log(
    `[CONSOLIDATED] ${type.toUpperCase()} -> ${joined.size} unique Case No./Cases ` +
      `(BOTH=${bothCount}, QUERY_BUILDER ONLY=${qbOnlyCount}, DASHBOARD ONLY=${dbOnlyCount}).`
  );

  return {
    buffer: await wb.xlsx.writeBuffer(),
    stats: { total: joined.size, both: bothCount, qbOnly: qbOnlyCount, dbOnly: dbOnlyCount },
  };
}

// Builds PENDING_CONSOLIDATED.xlsx and/or DISPOSED_CONSOLIDATED.xlsx — a
// FULL OUTER JOIN (keep everything) of QUERY_BUILDER + DASHBOARD data,
// matched on Case No. / Cases. Returns { files, stats } ready to zip.
export async function buildConsolidatedFiles(scan, log = () => {}) {
  const files = [];
  const stats = {};
  if (!scan) return { files, stats };

  const pendingQb = flattenQueryBuilder(scan.pendingByEstab);
  const disposedQb = flattenQueryBuilder(scan.disposedByEstab);
  const dashboardEntries = scan.dashboardFiles || [];

  const hasPending = pendingQb.length > 0 || dashboardEntries.some((d) => d.type === "Pending");
  const hasDisposed = disposedQb.length > 0 || dashboardEntries.some((d) => d.type === "Disposed");

  if (hasPending) {
    const { buffer, stats: s } = await buildConsolidatedType("Pending", pendingQb, dashboardEntries, log);
    files.push({ path: "CONSOLIDATED/PENDING_CONSOLIDATED.xlsx", buffer });
    stats.pending = s;
  }

  if (hasDisposed) {
    const { buffer, stats: s } = await buildConsolidatedType("Disposed", disposedQb, dashboardEntries, log);
    files.push({ path: "CONSOLIDATED/DISPOSED_CONSOLIDATED.xlsx", buffer });
    stats.disposed = s;
  }

  return { files, stats };
}
