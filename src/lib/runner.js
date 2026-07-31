// Orchestrates the full pipeline: scan uploaded files -> run both
// operations -> package everything into a zip, mirroring what
// Program.cs did against the INPUT/OUTPUT folders on disk.

import JSZip from "jszip";
import { scanAll } from "./inputScanner.js";
import { runMonthwiseDisposeReport } from "./monthwiseDisposeReport.js";
import { runCourtCasePositionAsOnDate } from "./courtCasePositionAsOnDate.js";

export async function runPipeline(files, targetDate, log = () => {}) {
  log("=====================================================");
  log(" Court Case Report Generator (QUERY format only)");
  log("=====================================================");

  log("Scanning uploaded files...");
  const scan = await scanAll(files, log);

  const allOutputFiles = [...scan.duplicateFiles];

  log("");
  log(">>> Operation 1: Establishment-wise Monthwise Dispose Report");
  const op1Files = await runMonthwiseDisposeReport(scan.disposedByEstab, log);
  allOutputFiles.push(...op1Files);

  log("");
  log(">>> Operation 2: Court Case Position As On Date");
  const op2 = await runCourtCasePositionAsOnDate(scan, targetDate, log);
  allOutputFiles.push(...op2.outputFiles);

  log("");
  log("Both operations complete.");

  return {
    scan,
    outputFiles: allOutputFiles,
    allDataRows: op2.allDataRows,
    allDataBuffer: op2.allDataBuffer,
  };
}

export async function buildZip(outputFiles) {
  const zip = new JSZip();
  for (const f of outputFiles) {
    if (!f.buffer) continue;
    zip.file(f.path, f.buffer);
  }
  return zip.generateAsync({ type: "blob" });
}
