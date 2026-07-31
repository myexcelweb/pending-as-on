// Port of Operations/MonthwiseDisposeReport.cs
// Operation 1: "Monthwise Dispose Report"
// Splits each establishment's disposed cases into one file per month
// based on Date of Decision.
// Output: OUTPUT/MONTHWISE_DISPOSE/{month}_{ESTAB}_{MONTH}{YY}.xlsx

import { getCourtType } from "./establishmentResolver.js";
import { newWorkbook, saveDisposed, workbookToBuffer } from "./excelIO.js";

const MONTH_LABELS = ["", "JAN", "FEB", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUG", "SEP", "OCT", "NOV", "DEC"];

export async function runMonthwiseDisposeReport(disposedByEstab, log = () => {}) {
  const outputFiles = [];
  const estabs = Object.keys(disposedByEstab).sort((a, b) => a.localeCompare(b));

  if (estabs.length === 0) {
    log("No DISPOSED records found. Nothing to do for Operation 1.");
    return outputFiles;
  }

  for (const estab of estabs) {
    const courtType = getCourtType(estab);
    const disposedRecords = disposedByEstab[estab];
    log(`Processing establishment: ${estab} (${disposedRecords.length} disposed records)`);

    const groups = new Map(); // key `${year}-${month}` -> records[]
    for (const r of disposedRecords) {
      const year = r.dateOfDecision.getUTCFullYear();
      const month = r.dateOfDecision.getUTCMonth() + 1;
      const key = `${year}-${month}`;
      if (!groups.has(key)) groups.set(key, { year, month, records: [] });
      groups.get(key).records.push(r);
    }

    const sortedGroups = Array.from(groups.values()).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month
    );

    for (const group of sortedGroups) {
      const monthLabel = MONTH_LABELS[group.month];
      const yy = String(group.year % 100).padStart(2, "0");
      const outFileName = `${group.month}_${estab}_${monthLabel}${yy}.xlsx`;

      const monthRecords = [...group.records].sort(
        (a, b) => a.dateOfDecision.getTime() - b.dateOfDecision.getTime()
      );

      const wb = newWorkbook();
      saveDisposed(wb, "Sheet1", monthRecords, courtType, estab, `_${monthLabel}_${group.year}`);
      const buffer = await workbookToBuffer(wb);

      outputFiles.push({ path: `OUTPUT/MONTHWISE_DISPOSE/${outFileName}`, buffer });
      log(`  Saved ${monthRecords.length} records to ${outFileName}`);
    }
  }

  log("Operation 1 complete.");
  return outputFiles;
}
