// Orchestrates the full pipeline: scan uploaded files -> run both
// operations -> package everything into a zip, mirroring what
// Program.cs did against the INPUT/OUTPUT folders on disk.

import JSZip from "jszip";
import { scanAll } from "./inputScanner.js";
import { runMonthwiseDisposeReport } from "./monthwiseDisposeReport.js";
import { runCourtCasePositionAsOnDate } from "./courtCasePositionAsOnDate.js";
import { buildConsolidatedFiles } from "./consolidator.js";

export async function runPipeline(files, targetDate, log = () => {}) {
  log("=====================================================");
  log(" Court Case Report Generator");
  log(" Auto-detecting proforma per file: QUERY_BUILDER / DASHBOARD");
  log("=====================================================");

  log("Scanning uploaded files...");
  const scan = await scanAll(files, log);

  const queryBuilderFiles = [...scan.duplicateFiles];

  log("");
  log(">>> QUERY_BUILDER: Establishment-wise Monthwise Dispose Report");
  const op1Files = await runMonthwiseDisposeReport(scan.disposedByEstab, log);
  queryBuilderFiles.push(...op1Files);

  log("");
  log(">>> QUERY_BUILDER: Court Case Position As On Date");
  const op2 = await runCourtCasePositionAsOnDate(scan, targetDate, log);
  queryBuilderFiles.push(...op2.outputFiles);

  const dashboardFiles = scan.dashboardFiles.map((f) => ({ path: f.path, buffer: f.buffer }));

  log("");
  log(`>>> DASHBOARD: ${scan.dashboardFiles.length} file(s) auto-detected, deduplicated & cleaned.`);

  log("");
  log(">>> CONSOLIDATED: DASHBOARD + QUERY_BUILDER full outer join (Case No. / Cases)");
  const { files: consolidatedFiles, stats: consolidatedStats } = await buildConsolidatedFiles(scan, log);

  log("");
  log("All proforma pipelines complete.");

  return {
    scan,
    queryBuilderFiles,
    dashboardFiles,
    consolidatedFiles,
    consolidatedStats,
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
