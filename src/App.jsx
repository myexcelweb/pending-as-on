import { useMemo, useState } from "react";
import UploadZone from "./components/UploadZone.jsx";
import LogConsole from "./components/LogConsole.jsx";
import ResultsPanel from "./components/ResultsPanel.jsx";
import { runPipeline, buildZip } from "./lib/runner.js";

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToUtcDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [mainTab, setMainTab] = useState("setup");
  const [files, setFiles] = useState([]);
  const [dateIso, setDateIso] = useState(todayIso());
  const [running, setRunning] = useState(false);
  const [qbZipBusy, setQbZipBusy] = useState(false);
  const [dbZipBusy, setDbZipBusy] = useState(false);
  const [csZipBusy, setCsZipBusy] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const targetDate = useMemo(() => isoToUtcDate(dateIso), [dateIso]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setLogLines([]);
    const lines = [];
    const log = (msg) => {
      lines.push(msg);
      setLogLines([...lines]);
    };
    try {
      const outcome = await runPipeline(files, targetDate, log);
      setResult(outcome);
      setMainTab("dashboard");
    } catch (ex) {
      console.error(ex);
      setError(ex.message || String(ex));
      log(`[FATAL]    ${ex.message || ex}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadQueryBuilderZip = async () => {
    if (!result || result.queryBuilderFiles.length === 0) return;
    setQbZipBusy(true);
    try {
      const blob = await buildZip(result.queryBuilderFiles);
      download(blob, `QUERY_BUILDER_${dateIso}.zip`);
    } finally {
      setQbZipBusy(false);
    }
  };

  const handleDownloadDashboardZip = async () => {
    if (!result || result.dashboardFiles.length === 0) return;
    setDbZipBusy(true);
    try {
      const blob = await buildZip(result.dashboardFiles);
      download(blob, `DASHBOARD_${dateIso}.zip`);
    } finally {
      setDbZipBusy(false);
    }
  };

  const handleDownloadConsolidatedZip = async () => {
    if (!result || result.consolidatedFiles.length === 0) return;
    setCsZipBusy(true);
    try {
      const blob = await buildZip(result.consolidatedFiles);
      download(blob, `CONSOLIDATED_${dateIso}.zip`);
    } finally {
      setCsZipBusy(false);
    }
  };

  const handleDownloadAllData = () => {
    if (!result?.allDataBuffer) return;
    const blob = new Blob([result.allDataBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    download(blob, "ALL_DATA.xlsx");
  };

  return (
    <div className="grain-bg min-h-screen">
      {/* Compact header */}
      <header className="border-b border-ink-700 bg-ink-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">
              Docket
            </p>
            <h1 className="font-display text-xl text-parchment sm:text-2xl">
              Case Report Generator
            </h1>
          </div>
          <p className="hidden max-w-xs text-right font-mono text-[11px] leading-snug text-parchment-dim sm:block">
            Upload registers · pick a date · download ZIPs.
            <br />
            Everything stays in your browser.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-lg border border-ink-700 bg-ink-900 p-1">
          <button
            type="button"
            onClick={() => setMainTab("setup")}
            className={`flex-1 rounded-md px-4 py-2.5 font-mono text-sm font-medium transition ${
              mainTab === "setup"
                ? "bg-brass text-ink-950 shadow-sm"
                : "text-parchment-dim hover:bg-ink-800 hover:text-parchment"
            }`}
          >
            Setup
          </button>
          <button
            type="button"
            onClick={() => result && setMainTab("dashboard")}
            disabled={!result}
            title={result ? undefined : "Generate a report first"}
            className={`flex-1 rounded-md px-4 py-2.5 font-mono text-sm font-medium transition ${
              mainTab === "dashboard"
                ? "bg-brass text-ink-950 shadow-sm"
                : result
                  ? "text-parchment-dim hover:bg-ink-800 hover:text-parchment"
                  : "cursor-not-allowed text-parchment-dim/40"
            }`}
          >
            Dashboard
          </button>
        </div>

        {mainTab === "setup" && (
          <div className="space-y-8">
            {/* Upload */}
            <section className="rounded-lg border border-ink-700 bg-ink-900 p-5">
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="font-display text-lg text-parchment">
                  Case registers
                </h2>
                <span className="font-mono text-xs text-parchment-dim">
                  {files.length} file{files.length === 1 ? "" : "s"}
                </span>
              </div>
              <UploadZone files={files} onFilesChange={setFiles} />
            </section>

            {/* Date + Run */}
            <section className="rounded-lg border border-ink-700 bg-ink-900 p-5">
              <h2 className="mb-1 font-display text-lg text-parchment">
                Position as on date
              </h2>
              <p className="mb-4 font-mono text-xs text-parchment-dim">
                Cases registered after this date → DELETE. Disposed after this date → MOVE back to pending.
              </p>
              <div className="flex flex-wrap items-end gap-4">
                <input
                  type="date"
                  value={dateIso}
                  onChange={(e) => setDateIso(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2.5 font-mono text-sm text-parchment focus:border-brass"
                />
                <button
                  type="button"
                  onClick={handleRun}
                  disabled={files.length === 0 || running}
                  className="rounded-md bg-emerald px-6 py-2.5 font-mono text-sm font-medium text-white transition hover:bg-emerald-bright disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {running ? "Processing…" : "Generate reports"}
                </button>
              </div>
              {error && (
                <p className="mt-3 font-mono text-sm text-rust">
                  Error: {error}
                </p>
              )}
              {result && (
                <p className="mt-3 font-mono text-sm text-emerald">
                  Done — open the Dashboard tab.
                </p>
              )}
            </section>

            {logLines.length > 0 && (
              <section>
                <LogConsole lines={logLines} />
              </section>
            )}

            {/* Compact format guide */}
            <section className="rounded-lg border border-ink-700 bg-ink-900/60 p-5">
              <h2 className="mb-3 font-display text-base text-parchment">
                Expected columns
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-ink-700 bg-ink-950/50 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-brass">
                    QUERY_BUILDER · Pending
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed text-parchment-dim">
                    Sr. No. · Case No. · CNR · Party · Advocate · Reg. Date · Next Date · Purpose · Act · Nature · Designation
                  </p>
                </div>
                <div className="rounded-md border border-ink-700 bg-ink-950/50 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-brass">
                    QUERY_BUILDER · Disposed
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed text-parchment-dim">
                    Sr. No. · Case No. · CNR · Party · Advocate · Reg. Date · Decision Date · Disposal Nature · Act · Nature · Designation
                  </p>
                </div>
                <div className="rounded-md border border-ink-700 bg-ink-950/50 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-emerald">
                    DASHBOARD · Pending
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed text-parchment-dim">
                    Sr. No. · Cases · Party · Reg. Date · Age · Ready/Unready · Next Date · Purpose · Stage · Dormant · Nature · Delay
                  </p>
                </div>
                <div className="rounded-md border border-ink-700 bg-ink-950/50 p-3">
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-emerald">
                    DASHBOARD · Disposed
                  </p>
                  <p className="font-mono text-[11px] leading-relaxed text-parchment-dim">
                    Sr. No. · Cases · Party · Reg. Date · Decision Date · Contested · Disposal Nature · Nature
                  </p>
                </div>
              </div>
              <p className="mt-3 font-mono text-[11px] text-parchment-dim">
                Format and type are detected from headers. Establishment from file name (APP / SUB / RAN / KUT → else PBR). Duplicate Case No. within a file is dropped.
              </p>
            </section>
          </div>
        )}

        {mainTab === "dashboard" && (
          <section>
            {result ? (
              <ResultsPanel
                scan={result.scan}
                queryBuilderFiles={result.queryBuilderFiles}
                dashboardFiles={result.dashboardFiles}
                consolidatedFiles={result.consolidatedFiles}
                consolidatedStats={result.consolidatedStats}
                onDownloadQueryBuilderZip={handleDownloadQueryBuilderZip}
                onDownloadDashboardZip={handleDownloadDashboardZip}
                onDownloadConsolidatedZip={handleDownloadConsolidatedZip}
                onDownloadAllData={handleDownloadAllData}
                qbZipBusy={qbZipBusy}
                dbZipBusy={dbZipBusy}
                csZipBusy={csZipBusy}
              />
            ) : (
              <p className="rounded-lg border border-ink-700 bg-ink-900 p-6 font-mono text-sm text-parchment-dim">
                No report yet. Go to Setup and generate one first.
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-ink-700 px-5 py-6 text-center font-mono text-[11px] text-parchment-dim">
        <p>Runs fully in your browser — files never leave your machine.</p>
        <p className="mt-1">
          Designed &amp; Developed by Parimal Hodar · parimalhodar.dev@gmail.com
        </p>
      </footer>
    </div>
  );
}
