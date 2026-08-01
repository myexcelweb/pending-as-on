// Port of InputScanner.cs
// Scans every uploaded .xlsx file, works out (a) which establishment it
// belongs to from the file name and (b) whether it's a PENDING or
// DISPOSED file from its columns, then hands back everything grouped
// by establishment.

import { resolveEstab, getCourtType } from "./establishmentResolver.js";
import { dedupeByCaseNo } from "./deduplicator.js";
import { loadPending, loadDisposed, loadWorkbookFromFile, buildDuplicatesCombinedWorkbook } from "./excelIO.js";
import { detectProforma } from "./proformaResolver.js";
import { readDashboardSheet, dedupeDashboardRows, buildDashboardWorkbook } from "./dashboardIO.js";

// files: array of File objects (from an <input type=file multiple> or drop)
// log: optional callback(message) for progress output
//
// Every file's proforma (QUERY_BUILDER or DASHBOARD) is auto-detected from
// its column headers. QUERY_BUILDER files feed the existing MOVE/DELETE/
// monthwise pipeline (grouped by establishment); DASHBOARD files are
// deduplicated and cleaned independently, ready to be zipped up separately.
export async function scanAll(files, log = () => {}) {
  const pendingByEstab = {};
  const disposedByEstab = {};
  const skipped = [];
  const errors = [];
  const dashboardFiles = []; // { path, buffer, fileName, type, recordCount, removedCount }

  const xlsxFiles = files
    .filter((f) => f.name.toLowerCase().endsWith(".xlsx") && !f.name.startsWith("~$"))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (xlsxFiles.length === 0) {
    log("No .xlsx files were provided.");
    return { pendingByEstab, disposedByEstab, allEstabs: [], skipped, errors, duplicateFiles: [], dashboardFiles: [] };
  }

  for (const file of xlsxFiles) {
    const fileName = file.name;
    const estab = resolveEstab(fileName);

    try {
      const workbook = await loadWorkbookFromFile(file);
      const sheet = workbook.worksheets[0];
      if (!sheet) {
        log(`[SKIPPED]  ${fileName}  -> workbook has no worksheets.`);
        skipped.push(fileName);
        continue;
      }

      const { proforma, type, headerRow, colMap } = detectProforma(sheet);

      if (proforma === "QUERY_BUILDER" && type === "Pending") {
        const records = loadPending(sheet, headerRow, colMap, fileName);
        const { result, duplicates } = dedupeByCaseNo(records); // same-file dedupe
        if (duplicates.length > 0) {
          log(`[DEDUPE]   ${fileName}  -> removed ${duplicates.length} duplicate Case No. entr${duplicates.length === 1 ? "y" : "ies"} within this file.`);
        }
        if (!pendingByEstab[estab]) pendingByEstab[estab] = [];
        pendingByEstab[estab].push(...result);
        log(`[QUERY_BUILDER / PENDING]  ${fileName}  -> ESTAB=${estab}, ${result.length} records`);
      } else if (proforma === "QUERY_BUILDER" && type === "Disposed") {
        const records = loadDisposed(sheet, headerRow, colMap, fileName);
        const { result, duplicates } = dedupeByCaseNo(records); // same-file dedupe
        if (duplicates.length > 0) {
          log(`[DEDUPE]   ${fileName}  -> removed ${duplicates.length} duplicate Case No. entr${duplicates.length === 1 ? "y" : "ies"} within this file.`);
        }
        if (!disposedByEstab[estab]) disposedByEstab[estab] = [];
        disposedByEstab[estab].push(...result);
        log(`[QUERY_BUILDER / DISPOSED] ${fileName}  -> ESTAB=${estab}, ${result.length} records`);
      } else if (proforma === "DASHBOARD" && (type === "Pending" || type === "Disposed")) {
        const { header, titleRows, rows, casesColIndex } = readDashboardSheet(sheet, headerRow, colMap);
        const { result, duplicates } = dedupeDashboardRows(rows, casesColIndex); // same-file dedupe
        if (duplicates.length > 0) {
          log(`[DEDUPE]   ${fileName}  -> removed ${duplicates.length} duplicate Cases entr${duplicates.length === 1 ? "y" : "ies"} within this file.`);
        }
        const buffer = await buildDashboardWorkbook(titleRows, header, result);
        dashboardFiles.push({
          path: `DASHBOARD/${type.toUpperCase()}/${fileName}`,
          buffer,
          fileName,
          type,
          estab,
          recordCount: result.length,
          removedCount: duplicates.length,
          // Kept (not just the rendered buffer) so the CONSOLIDATED
          // (DASHBOARD + QUERY_BUILDER) full outer join can read the
          // already-deduplicated rows straight back out again.
          header,
          rows: result,
          casesColIndex,
        });
        log(`[DASHBOARD / ${type.toUpperCase()}]  ${fileName}  -> ${result.length} records${duplicates.length ? `, ${duplicates.length} duplicate(s) removed` : ""}`);
      } else {
        log(`[SKIPPED]  ${fileName}  -> could not detect a known layout (QUERY_BUILDER or DASHBOARD, PENDING or DISPOSED).`);
        skipped.push(fileName);
      }
    } catch (ex) {
      log(`[ERROR]    ${fileName}  -> ${ex.message}`);
      errors.push({ fileName, message: ex.message });
    }
  }

  const duplicateFiles = await deduplicateEstablishmentWise(pendingByEstab, disposedByEstab, log);

  const allEstabs = Array.from(
    new Set([...Object.keys(pendingByEstab), ...Object.keys(disposedByEstab)])
  ).sort((a, b) => a.localeCompare(b));

  return { pendingByEstab, disposedByEstab, allEstabs, skipped, errors, duplicateFiles, dashboardFiles };
}

// Builds a per-uploaded-file breakdown of PENDING vs DISPOSED entry counts,
// for the dashboard on the main page. Each uploaded file becomes one row
// (or two, if — unusually — the same name appears as both types).
export function computeFileStats(scan) {
  const byFile = new Map(); // fileName -> { fileName, estab, pending, disposed }

  const tally = (byEstab, key) => {
    for (const estab of Object.keys(byEstab)) {
      for (const rec of byEstab[estab]) {
        const fileName = rec.sourceFileName || "(unknown file)";
        if (!byFile.has(fileName)) {
          byFile.set(fileName, { fileName, estab, pending: 0, disposed: 0 });
        }
        byFile.get(fileName)[key] += 1;
      }
    }
  };

  tally(scan.pendingByEstab, "pending");
  tally(scan.disposedByEstab, "disposed");

  const rows = Array.from(byFile.values()).sort((a, b) => a.fileName.localeCompare(b.fileName));

  const totals = rows.reduce(
    (acc, r) => {
      acc.pending += r.pending;
      acc.disposed += r.disposed;
      return acc;
    },
    { pending: 0, disposed: 0 }
  );
  totals.total = totals.pending + totals.disposed;

  return { rows, totals };
}

// Per-uploaded-file breakdown for DASHBOARD-proforma files, for the UI.
export function computeDashboardStats(scan) {
  const rows = (scan.dashboardFiles || []).map((f) => ({
    fileName: f.fileName,
    estab: f.estab,
    type: f.type,
    records: f.recordCount,
    removed: f.removedCount,
  }));
  const totals = rows.reduce(
    (acc, r) => {
      acc.records += r.records;
      acc.removed += r.removed;
      return acc;
    },
    { records: 0, removed: 0 }
  );
  return { rows, totals };
}

// Removes repeated Case No. entries, separately per establishment and
// separately for PENDING vs DISPOSED, mutating the byEstab maps in place.
// Returns the list of generated {ESTAB}_DUPLICATE.xlsx output descriptors.
async function deduplicateEstablishmentWise(pendingByEstab, disposedByEstab, log) {
  const duplicateFiles = [];
  const allEstabs = Array.from(
    new Set([...Object.keys(pendingByEstab), ...Object.keys(disposedByEstab)])
  );

  for (const estab of allEstabs) {
    let pendingDupes = [];
    if (pendingByEstab[estab]) {
      const { result, duplicates } = dedupeByCaseNo(pendingByEstab[estab]);
      pendingByEstab[estab] = result;
      pendingDupes = duplicates;
      if (duplicates.length > 0) {
        log(`[DEDUPE]   PENDING  ESTAB=${estab}: removed ${duplicates.length} duplicate Case No. entr${duplicates.length === 1 ? "y" : "ies"}.`);
      }
    }

    let disposedDupes = [];
    if (disposedByEstab[estab]) {
      const { result, duplicates } = dedupeByCaseNo(disposedByEstab[estab]);
      disposedByEstab[estab] = result;
      disposedDupes = duplicates;
      if (duplicates.length > 0) {
        log(`[DEDUPE]   DISPOSED ESTAB=${estab}: removed ${duplicates.length} duplicate Case No. entr${duplicates.length === 1 ? "y" : "ies"}.`);
      }
    }

    if (pendingDupes.length > 0 || disposedDupes.length > 0) {
      const courtType = getCourtType(estab);
      const dupFileName = `${estab}_DUPLICATE.xlsx`;
      const buffer = await buildDuplicatesCombinedWorkbook(pendingDupes, disposedDupes, courtType, estab);
      if (buffer) {
        duplicateFiles.push({ path: `OUTPUT/DUPLICATE/${dupFileName}`, buffer });
        log(`[DEDUPE]   ESTAB=${estab}: duplicates saved -> OUTPUT/DUPLICATE/${dupFileName}`);
      }
    }
  }

  return duplicateFiles;
}
