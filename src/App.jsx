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
  const [files, setFiles] = useState([]);
  const [dateIso, setDateIso] = useState(todayIso());
  const [running, setRunning] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
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
    } catch (ex) {
      console.error(ex);
      setError(ex.message || String(ex));
      log(`[FATAL]    ${ex.message || ex}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!result) return;
    setZipBusy(true);
    try {
      const blob = await buildZip(result.outputFiles);
      download(blob, `CourtCaseReports_${dateIso}.zip`);
    } finally {
      setZipBusy(false);
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
      {/* Hero */}
      <header className="relative overflow-hidden border-b border-ink-700">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-16 sm:py-20 md:flex-row md:items-center">
          <div className="hidden shrink-0 select-none font-mono text-[11px] text-brass-dim md:block docket-strip">
            EST. APP · SUB · RAN · KUT · PBR
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-brass">
              Docket · Case Report Generator
            </p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-parchment sm:text-5xl">
              Turn scattered case registers into a{" "}
              <span className="italic text-brass">closed docket</span>.
            </h1>
            <p className="mt-5 max-w-xl font-body text-[15px] leading-relaxed text-parchment-dim">
              Upload every PENDING and DISPOSED register from the INPUT folder, pick a date,
              and Docket rebuilds the establishment-wise monthwise disposal report and the
              full case-position-as-on-date snapshot — pending, disposed, moved, duplicate
              and deleted — exactly as the original QUERY-format tool did. Everything runs
              in this browser tab; no file ever leaves your machine.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section aria-labelledby="upload-heading" className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 id="upload-heading" className="font-display text-xl text-parchment">
              1. Case registers
            </h2>
            <span className="font-mono text-xs text-parchment-dim">
              {files.length} file{files.length === 1 ? "" : "s"} loaded
            </span>
          </div>
          <UploadZone files={files} onFilesChange={setFiles} />
        </section>

        <section aria-labelledby="date-heading" className="mt-10 space-y-4">
          <h2 id="date-heading" className="font-display text-xl text-parchment">
            2. Position as on date
          </h2>
          <p className="max-w-xl font-body text-sm text-parchment-dim">
            Records registered after this date are set aside as DELETE; disposed cases
            decided after it are MOVEd back into pending.
          </p>
          <input
            type="date"
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
            className="rounded-sm border border-ink-600 bg-ink-900 px-4 py-2.5 font-mono text-sm text-parchment focus:border-brass"
          />
        </section>

        <section className="mt-10">
          <button
            type="button"
            onClick={handleRun}
            disabled={files.length === 0 || running}
            className="w-full rounded-sm bg-emerald px-6 py-3.5 font-display text-lg tracking-wide text-parchment transition hover:bg-emerald-bright disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            {running ? "Processing register…" : "Generate reports"}
          </button>
          {error && (
            <p className="mt-3 font-mono text-sm text-rust">
              Something went wrong: {error}
            </p>
          )}
        </section>

        {logLines.length > 0 && (
          <section className="mt-8">
            <LogConsole lines={logLines} />
          </section>
        )}

        {result && (
          <section className="mt-8">
            <ResultsPanel
              scan={result.scan}
              outputFiles={result.outputFiles}
              onDownloadZip={handleDownloadZip}
              onDownloadAllData={handleDownloadAllData}
              zipBusy={zipBusy}
            />
          </section>
        )}

        <section className="mt-16 border-t border-ink-700 pt-8">
          <h2 className="font-display text-lg text-parchment">Column formats expected</h2>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div className="rounded-sm border border-ink-700 p-4">
              <p className="font-mono text-xs uppercase tracking-widest text-emerald-bright">Pending</p>
              <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-parchment-dim">
                Sr. No. · Case No. · CNR · Petitioner Name VS Respondent Name · Advocate ·
                Date of Registration · Next Date · Purpose · Act Section · Nature · Designation
              </p>
            </div>
            <div className="rounded-sm border border-ink-700 p-4">
              <p className="font-mono text-xs uppercase tracking-widest text-parchment">Disposed</p>
              <p className="mt-2 font-mono text-[12.5px] leading-relaxed text-parchment-dim">
                Sr. No. · Case No. · CNR · Petitioner Name VS Respondent Name · Advocate ·
                Date of Registration · Date of Decision · Nature of Disposal · Act Section ·
                Nature · Designation
              </p>
            </div>
          </div>
          <p className="mt-4 font-mono text-xs text-parchment-dim">
            Type is detected from these column headers, not the file name. Establishment is
            read from the start of the file name (APP / SUB / RAN / KUT), otherwise PBR.
          </p>
        </section>
      </main>

      <footer className="border-t border-ink-700 px-6 py-8 text-center font-mono text-xs text-parchment-dim">
        <p>
          Docket runs entirely client-side — uploaded registers are processed in memory and
          never transmitted anywhere.
        </p>
        <p className="mt-2 whitespace-nowrap text-parchment-dim">
          Designed &amp; Developed by Parimal Hodar &nbsp;|&nbsp; Email Address: parimalhodar.dev@gmail.com
        </p>
      </footer>
    </div>
  );
}
