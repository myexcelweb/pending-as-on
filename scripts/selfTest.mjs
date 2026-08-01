// Regression test: builds a handful of synthetic PENDING/DISPOSED registers
// (mirroring the shape of the original C# tool's sample INPUT files, plus
// DASHBOARD-proforma files), runs them through the ported pipeline, and
// asserts the output matches expected behaviour (proforma auto-detection,
// same-file dedup, establishment-level dedup, MOVE, DELETE, monthwise
// split, PBR default, unknown-layout skip, two proforma-wise zips).
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

async function makeDashboardFile(fileName, kind, rows) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  const headers =
    kind === "pending"
      ? ["Sr. No.", "Cases", "Party Name", "Date of Registration", "Age",
         "Ready / Unready / Stayed", "Next Date", "Next Purpose", "On same Stage since",
         "DORMANT CASE/SINE Die CASE", "Nature", "Delay Reason"]
      : ["Sr. No.", "Cases", "Party Name", "Registration date", "Date of Decision",
         "Contested/Uncontested", "Disposal Nature", "Nature"];

  sheet.getCell(1, 1).value = `DASHBOARD_SAMPLE_${kind.toUpperCase()}`;
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

  // Same-file duplicate (dropped during per-file dedupe, before it ever
  // reaches the establishment-level pass).
  files.push(
    await makeRegisterFile("RAN_PENDING_QUERY.xlsx", "pending", [
      [1, "RAN/CIV/1/2025", "CNRR01", "Vasavada VS Gohil", "Adv. Pandya", "01-01-2025", "01-08-2026", "Hearing", "Order 7", "Civil", "Civil Judge"],
      [2, "RAN/CIV/1/2025", "CNRR01", "Vasavada VS Gohil", "Adv. Pandya", "01-01-2025", "01-08-2026", "Hearing", "Order 7", "Civil", "Civil Judge"],
    ])
  );

  // Cross-file duplicate for the same establishment (KUT), split across two
  // separately-uploaded files — only the establishment-level pass catches this.
  files.push(
    await makeRegisterFile("KUT_PENDING_QUERY_A.xlsx", "pending", [
      [1, "KUT/CR/1/2025", "CNRK01", "Barot VS Chauhan", "Adv. Modi", "01-01-2025", "01-08-2026", "Hearing", "Sec 138", "Criminal", "JMFC"],
    ])
  );
  files.push(
    await makeRegisterFile("KUT_PENDING_QUERY_B.xlsx", "pending", [
      [1, "KUT/CR/1/2025", "CNRK01", "Barot VS Chauhan", "Adv. Modi", "01-01-2025", "01-08-2026", "Hearing", "Sec 138", "Criminal", "JMFC"],
    ])
  );

  files.push(
    await makeRegisterFile("Misc_Court_Cases.xlsx", "pending", [
      [1, "MISC/1/2026", "CNRM01", "Trivedi VS Dave", "Adv. Rana", "01-06-2026", "01-09-2026", "Hearing", "Sec 138", "Criminal", "JMFC"],
    ])
  );

  // Genuine DASHBOARD-proforma files, including a same-file duplicate "Cases" entry.
  files.push(
    await makeDashboardFile("SUB_DASHBOARD_PENDING.xlsx", "pending", [
      [1, "SC/18/2008", "State VS Odedra", "14-10-2008", "17 yrs", "R", "27-08-2026", "WARRANT", "N/A", "N", "", "Counsel unavailable"],
      [2, "CR A/114/2026", "Mehta VS State", "07-09-2012", "13 yrs", "R", "01-08-2026", "FINAL HEARING", "N/A", "N", "", "Counsel unavailable"],
      [3, "CR A/114/2026", "Mehta VS State", "07-09-2012", "13 yrs", "R", "01-08-2026", "FINAL HEARING", "N/A", "N", "", "Counsel unavailable"],
    ])
  );
  files.push(
    await makeDashboardFile("SUB_DASHBOARD_DISPOSE.xlsx", "disposed", [
      [1, "CMA DC/52/2025", "Keshavala VS X", "29-07-2025", "01-07-2026", "Uncontested", "JUDGEMENT", "G&W Act"],
    ])
  );

  // Genuinely unrecognizable layout (neither QUERY_BUILDER nor DASHBOARD columns) — still skipped.
  const badWb = new ExcelJS.Workbook();
  const badSheet = badWb.addWorksheet("Sheet1");
  badSheet.getRow(1).values = ["Court", "Judge", "Total Cases"];
  badSheet.getRow(2).values = ["APP", "X", 42];
  const badBuffer = await badWb.xlsx.writeBuffer();
  files.push(new File([badBuffer], "APP_UNKNOWN_LAYOUT.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));

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
  assert(result.scan.skipped.includes("APP_UNKNOWN_LAYOUT.xlsx"), "Unrecognized-layout file was skipped");
  assert(result.scan.pendingByEstab.RAN.length === 1, "RAN same-file duplicate Case No. was deduped (1 remaining)");
  assert(result.scan.pendingByEstab.KUT.length === 1, "KUT cross-file duplicate Case No. was deduped (1 remaining)");
  assert(result.scan.duplicateFiles.length === 1, "One duplicate-report file generated (KUT, cross-file)");
  assert(!!result.scan.duplicateFiles.find((f) => f.path.includes("KUT_DUPLICATE")), "KUT_DUPLICATE.xlsx present, not RAN");

  // DASHBOARD proforma
  assert(result.scan.dashboardFiles.length === 2, "2 DASHBOARD-proforma files detected");
  const dbPending = result.scan.dashboardFiles.find((f) => f.fileName === "SUB_DASHBOARD_PENDING.xlsx");
  assert(!!dbPending && dbPending.recordCount === 2 && dbPending.removedCount === 1,
    "DASHBOARD same-file duplicate Cases entry was deduped (2 remaining, 1 removed)");

  // QUERY_BUILDER outputs
  assert(!!result.queryBuilderFiles.find((f) => f.path.endsWith("ALL_DATA.xlsx")), "ALL_DATA.xlsx present");
  assert(!!result.queryBuilderFiles.find((f) => f.path.includes("/MOVE/APP_MOVE")), "APP MOVE file generated");
  assert(!!result.queryBuilderFiles.find((f) => f.path.includes("/DELETE/APP_DELETED")), "APP DELETE file generated");
  assert(result.queryBuilderFiles.filter((f) => f.path.includes("MONTHWISE_DISPOSE")).length === 2, "2 monthwise dispose files generated");

  const qbZipBlob = await buildZip(result.queryBuilderFiles);
  const qbArrBuf = await qbZipBlob.arrayBuffer();
  assert(qbArrBuf.byteLength > 1000, "QUERY_BUILDER zip archive built and non-trivial size");

  const dbZipBlob = await buildZip(result.dashboardFiles);
  const dbArrBuf = await dbZipBlob.arrayBuffer();
  assert(dbArrBuf.byteLength > 500, "DASHBOARD zip archive built and non-trivial size");
  assert(result.dashboardFiles.every((f) => f.path.startsWith("DASHBOARD/")), "DASHBOARD zip entries live under DASHBOARD/");
  assert(result.queryBuilderFiles.every((f) => !f.path.startsWith("DASHBOARD/")), "QUERY_BUILDER zip has no DASHBOARD entries");

  const pendingOut = result.queryBuilderFiles.find((f) => f.path.includes("/PENDING/APP_PENDING"));
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
