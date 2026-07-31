// Port of Operations/CourtCasePositionAsOnDate.cs
// Operation 2: "Court Case Position As On Date"
// Produces a snapshot of case position as on a given date, establishment
// wise, in folders: PENDING / DISPOSE AS ON / MOVE / DELETE / DUPLICATE,
// plus one merged ALL_DATA.xlsx.

import { getCourtType } from "./establishmentResolver.js";
import { dedupeByCaseNo } from "./deduplicator.js";
import { formatDate } from "./dateUtils.js";
import {
  newWorkbook, savePending, saveDisposed, workbookToBuffer,
  buildDeletedCombinedWorkbook, buildDuplicatesCombinedWorkbook, buildAllDataWorkbook,
} from "./excelIO.js";
import { fromPending, fromDisposed } from "./allDataRow.js";

export async function runCourtCasePositionAsOnDate(scan, targetDate, log = () => {}) {
  const outputFiles = [];
  const rootFolder = `OUTPUT/PENDING AS ON ${formatDate(targetDate)}`;

  const { pendingByEstab, disposedByEstab, allEstabs } = scan;

  if (allEstabs.length === 0) {
    log("No PENDING or DISPOSED records found. Nothing to do for Operation 2.");
    return outputFiles;
  }

  const allDataRows = [];

  for (const estab of allEstabs) {
    const courtType = getCourtType(estab);
    log(`Processing establishment: ${estab}`);

    const pendingRecords = pendingByEstab[estab] ?? [];
    const disposedRecords = disposedByEstab[estab] ?? [];

    // ---- Split PENDING by registration date ----
    const filteredPending = pendingRecords.filter((r) => r.dateOfRegistration.getTime() <= targetDate.getTime());
    const deletedPending = pendingRecords.filter((r) => r.dateOfRegistration.getTime() > targetDate.getTime());

    // ---- Split DISPOSED by registration/decision date ----
    const keepDisposed = [];
    const moveToPending = [];
    const deletedDisposed = [];

    for (const r of disposedRecords) {
      if (r.dateOfRegistration.getTime() > targetDate.getTime()) {
        deletedDisposed.push(r);
        continue;
      }
      if (r.dateOfDecision.getTime() <= targetDate.getTime()) {
        keepDisposed.push(r);
      } else {
        moveToPending.push(r);
      }
    }

    // ---- MOVE: disposed records whose decision is after the target date
    //      become pending as on that date ----
    const movedRecords = [];
    if (moveToPending.length > 0) {
      let maxSr = filteredPending.length > 0 ? Math.max(...filteredPending.map((r) => r.srNo)) : 0;
      for (const d of moveToPending) {
        const movedRec = {
          srNo: ++maxSr,
          caseNo: d.caseNo,
          cnr: d.cnr,
          petitionerVsRespondent: d.petitionerVsRespondent,
          advocate: d.advocate,
          dateOfRegistration: d.dateOfRegistration,
          nextDate: d.dateOfDecision,
          purpose: "Moved from disposed (decision after target date)",
          actSection: d.actSection,
          nature: d.nature,
          designation: d.designation,
          isMovedFromDisposed: true,
          sourceFileName: d.sourceFileName,
        };
        filteredPending.push(movedRec);
        movedRecords.push(movedRec);
      }

      const movedFileName = `${estab}_MOVE_PORBANDAR_${courtType}_COURT_ALL_COURTS_ALL.xlsx`;
      const wb = newWorkbook();
      savePending(wb, "Sheet1", movedRecords, courtType, estab, "_MOVED (from disposed, decision after target date)");
      const buffer = await workbookToBuffer(wb);
      outputFiles.push({ path: `${rootFolder}/MOVE/${movedFileName}`, buffer });
      log(`  MOVE:   ${movedRecords.length} records -> ${movedFileName}`);
    }

    // ---- De-duplicate by Case No. within each estab before saving ----
    const { result: pendingDeduped, duplicates: pendingDupes } = dedupeByCaseNo(filteredPending);
    const { result: disposedDeduped, duplicates: disposedDupes } = dedupeByCaseNo(keepDisposed);
    if (pendingDupes.length > 0) log(`  DEDUPE: removed ${pendingDupes.length} duplicate Case No. from PENDING.`);
    if (disposedDupes.length > 0) log(`  DEDUPE: removed ${disposedDupes.length} duplicate Case No. from DISPOSE AS ON.`);

    if (pendingDupes.length > 0 || disposedDupes.length > 0) {
      const dupFileName = `${estab}_DUPLICATE.xlsx`;
      const buffer = await buildDuplicatesCombinedWorkbook(pendingDupes, disposedDupes, courtType, estab);
      if (buffer) {
        outputFiles.push({ path: `${rootFolder}/DUPLICATE/${dupFileName}`, buffer });
        log(`  DUPLICATE:    saved -> ${dupFileName}`);
      }
    }

    // ---- PENDING ----
    const pendingFileName = `${estab}_PENDING_PORBANDAR_${courtType}_COURT_ALL_COURTS_ALL.xlsx`;
    {
      const wb = newWorkbook();
      savePending(wb, "Sheet1", pendingDeduped, courtType, estab);
      const buffer = await workbookToBuffer(wb);
      outputFiles.push({ path: `${rootFolder}/PENDING/${pendingFileName}`, buffer });
      log(`  PENDING:      ${pendingDeduped.length} records -> ${pendingFileName}`);
    }

    // ---- DISPOSE AS ON ----
    const disposedFileName = `${estab}_DISPOSED_PORBANDAR_${courtType}_COURT_ALL_COURTS_ALL.xlsx`;
    {
      const wb = newWorkbook();
      saveDisposed(wb, "Sheet1", disposedDeduped, courtType, estab);
      const buffer = await workbookToBuffer(wb);
      outputFiles.push({ path: `${rootFolder}/DISPOSE AS ON/${disposedFileName}`, buffer });
      log(`  DISPOSE AS ON: ${disposedDeduped.length} records -> ${disposedFileName}`);
    }

    // ---- DELETE ----
    if (deletedPending.length > 0 || deletedDisposed.length > 0) {
      const deleteFileName = `${estab}_DELETED_PORBANDAR_${courtType}_COURT_ALL_COURTS_ALL.xlsx`;
      const buffer = await buildDeletedCombinedWorkbook(deletedPending, deletedDisposed, courtType, estab);
      if (buffer) {
        outputFiles.push({ path: `${rootFolder}/DELETE/${deleteFileName}`, buffer });
        log(`  DELETE:       ${deletedPending.length} pending + ${deletedDisposed.length} disposed -> ${deleteFileName}`);
      }
    } else {
      log("  DELETE:       none");
    }

    // ---- Feed everything into the merged ALL_DATA rows ----
    for (const r of pendingDeduped) allDataRows.push(fromPending(estab, r.isMovedFromDisposed ? "MOVE" : "PENDING", r));
    for (const r of disposedDeduped) allDataRows.push(fromDisposed(estab, "DISPOSE", r));
    for (const r of deletedPending) allDataRows.push(fromPending(estab, "DELETE", r));
    for (const r of deletedDisposed) allDataRows.push(fromDisposed(estab, "DELETE", r));
    for (const r of pendingDupes) allDataRows.push(fromPending(estab, "DUPLICATE", r));
    for (const r of disposedDupes) allDataRows.push(fromDisposed(estab, "DUPLICATE", r));
  }

  // ---- ALL_DATA.xlsx ----
  const allDataBuffer = await buildAllDataWorkbook(allDataRows);
  outputFiles.push({ path: `${rootFolder}/ALL_DATA.xlsx`, buffer: allDataBuffer });
  log(`ALL_DATA: ${allDataRows.length} total rows -> ALL_DATA.xlsx`);

  log("Operation 2 complete.");
  return { outputFiles, allDataRows, allDataBuffer };
}
