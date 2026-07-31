// Regression test: builds a handful of synthetic PENDING/DISPOSED registers
// (mirroring the shape of the original C# tool's sample INPUT files),
// runs them through the ported pipeline, and asserts the output matches
// the original tool's documented behaviour (dedup, MOVE, DELETE, monthwise
// split, PBR default, dashboard-file skip).
//
// Run with: npm test
import ExcelJS from "exceljs";
import { runPipeline, buildZip } from "../src/lib/runner.js";
import fs from "node:fs";

async function makeRegisterFile(fileName, kind, rows) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  const headers =
    kind === "pending"
      ? ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
         "Date of Registration", "Next Date", "Purpose", "Act Section", "Nature", "Designation"]
      : ["Sr. No.", "Case No.", "CNR", "Petitioner Name VS Respondent Name", "Advocate",
         "Date of Registration", "Date of Decision", "Nature of Disposal", "Act Section", "Nature", "Designation"];

  sheet.getCell(1, 1).value = `SAMPLE_${kind.toUpperCase()}`;
  headers.forEach((h, i) => (sheet.getRow(2).getCell(i + 1).value = h));

  rows.forEach((row, i) => {
    const r = sheet.getRow(3 + i);
    row.forEach((v, ci) => (r.getCell(ci + 1).value = v));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return new File([buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function main() {
  const files = [];

  files.push(
    await makeRegisterFile("APP_PENDING_QUERY.xlsx", "pending", [
      [1, "APP/CR/1/2025", "CNR001", "Sharma VS Patel", "Adv. Mehta", "10-01-2025", "15-08-2026", "Arguments", "138 NI Act", "Criminal", "JMFC"],
      [2, "APP/CR/2/2025", "CNR002", "Rao VS Shah", "Adv. Joshi", "05-02-2025", "20-08-2026", "Evidence", "138 NI Act", "Criminal", "JMFC"],
      [3, "APP/CR/3/2026", "CNR003", "Desai VS Kumar", "Adv. Trivedi", "01-09-2026", "10-10-2026", "Framing", "138 NI Act", "Criminal", "JMFC"],
    ])
  );

  files.push(
    await makeRegisterFile("APP_DISPOSED_QUERY.xlsx", "disposed", [
      [1, "APP/CR/9/2024", "CNR009", "Bhatt VS Vora", "Adv. Mehta", "10-01-2024", "20-01-2026", "Convicted", "302 IPC", "Criminal", "Sessions"],
      [2, "APP/CR/10/2025", "CNR010", "Nair VS Iyer", "Adv. Joshi", "01-03-2025", "05-09-2026", "Acquitted", "420 IPC", "Criminal", "Sessions"],
    ])
  );

  files.push(
    await makeRegisterFile("RAN_PENDING_QUERY.xlsx", "pending", [
      [1, "RAN/CIV/1/2025", "CNRR01", "Vasavada VS Gohil", "Adv. Pandya", "01-01-2025", "01-08-2026", "Hearing", "Order 7", "Civil", "Civil Judge"],
      [2, "RAN/CIV/1/2025", "CNRR01", "Vasavada VS Gohil", "Adv. Pandya", "01-01-2025", "01-08-2026", "Hearing", "Order 7", "Civil", "Civil Judge"],
    ])
  );

  files.push(
    await makeRegisterFile("Misc_Court_Cases.xlsx", "pending", [
      [1, "MISC/1/2026", "CNRM01", "Trivedi VS Dave", "Adv. Rana", "01-06-2026", "01-09-2026", "Hearing", "Sec 138", "Criminal", "JMFC"],
    ])
  );

  const badWb = new ExcelJS.Workbook();
  const badSheet = badWb.addWorksheet("Sheet1");
  badSheet.getRow(1).values = ["Court", "Judge", "Total Cases"];
  badSheet.getRow(2).values = ["APP", "X", 42];
  const badBuffer = await badWb.xlsx.writeBuffer();
  files.push(new File([badBuffer], "APP_DASHBOARD_old.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

  const log = (msg) => console.log(msg);
  const targetDate = new Date(Date.UTC(2026, 6, 31)); // 31-07-2026

  const result = await runPipeline(files, targetDate, log);

  console.log("\n--- ASSERTIONS ---");
  let failed = false;
  const assert = (cond, msg) => {
    console.log(`${cond ? "PASS" : "FAIL"}: ${msg}`);
    if (!cond) failed = true;
  };

  assert(result.scan.allEstabs.includes("APP"), "APP establishment detected");
  assert(result.scan.allEstabs.includes("RAN"), "RAN establishment detected");
  assert(result.scan.allEstabs.includes("PBR"), "Misc file defaulted to PBR");
  assert(result.scan.skipped.includes("APP_DASHBOARD_old.xlsx"), "Dashboard-format file was skipped");
  assert(result.scan.pendingByEstab.RAN.length === 1, "RAN duplicate Case No. was deduped (1 remaining)");
  assert(result.scan.duplicateFiles.length === 1, "One duplicate-report file generated for RAN");
  assert(!!result.outputFiles.find((f) => f.path.endsWith("ALL_DATA.xlsx")), "ALL_DATA.xlsx present");
  assert(!!result.outputFiles.find((f) => f.path.includes("/MOVE/APP_MOVE")), "APP MOVE file generated");
  assert(!!result.outputFiles.find((f) => f.path.includes("/DELETE/APP_DELETED")), "APP DELETE file generated");
  assert(result.outputFiles.filter((f) => f.path.includes("MONTHWISE_DISPOSE")).length === 2, "2 monthwise dispose files generated");

  const zipBlob = await buildZip(result.outputFiles);
  const arrBuf = await zipBlob.arrayBuffer();
  assert(arrBuf.byteLength > 1000, "Zip archive built and non-trivial size");

  const pendingOut = result.outputFiles.find((f) => f.path.includes("/PENDING/APP_PENDING"));
  const verifyWb = new ExcelJS.Workbook();
  await verifyWb.xlsx.load(pendingOut.buffer);
  const title = verifyWb.worksheets[0].getCell(1, 1).value;
  assert(String(title).includes("PORBANDAR_DISTRICT_COURT_APP_PENDING"), "APP PENDING title formatted correctly");

  if (failed) {
    console.error("\nSELF TEST FAILED");
    process.exitCode = 1;
  } else {
    console.log("\nAll checks passed.");
  }
}

main().catch((e) => {
  console.error("SELF TEST CRASHED:", e);
  process.exitCode = 1;
});
