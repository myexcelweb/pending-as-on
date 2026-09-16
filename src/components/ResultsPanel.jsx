import { useState } from "react";
import { getCourtType } from "../lib/establishmentResolver.js";
import { computeFileStats, computeDashboardStats, computeDesignationSummary } from "../lib/inputScanner.js";

/** Always show a number (including 0). Never show dash/cross for zero. */
function num(v) {
  if (v == null || Number.isNaN(v)) return "0";
  return String(v);
}

function StatCard({ value, label, tone = "text-parchment" }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/40 px-4 py-3">
      <div className={`font-display text-2xl tabular-nums ${tone}`}>
        {num(value)}
      </div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-parchment-dim">
        {label}
      </div>
    </div>
  );
}

function EstabRow({ estab, pendingCount, disposedCount }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700 py-2.5 last:border-0">
      <div className="flex items-center gap-2">
        <span className="rounded border border-brass-dim/50 px-2 py-0.5 font-mono text-[11px] text-brass">
          {estab}
        </span>
        <span className="font-mono text-xs text-parchment-dim">{getCourtType(estab)}</span>
      </div>
      <div className="flex gap-4 font-mono text-sm tabular-nums">
        <span className="text-emerald">{num(pendingCount)} pend</span>
        <span className="text-parchment-dim">{num(disposedCount)} disp</span>
        <span className="font-medium text-brass">{num(pendingCount + disposedCount)}</span>
      </div>
    </div>
  );
}

function FileStatsTable({ rows, totals }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full min-w-[480px] text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-800/50 text-[10px] uppercase tracking-wider text-parchment-dim">
            <th className="px-3 py-2.5 font-medium">File</th>
            <th className="px-3 py-2.5 font-medium">Estab</th>
            <th className="px-3 py-2.5 text-right font-medium">Pending</th>
            <th className="px-3 py-2.5 text-right font-medium">Disposed</th>
            <th className="px-3 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fileName} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/30">
              <td className="max-w-[200px] truncate px-3 py-2 text-parchment" title={r.fileName}>
                {r.fileName}
              </td>
              <td className="px-3 py-2">
                <span className="rounded border border-brass-dim/50 px-1.5 py-0.5 text-[10px] text-brass">
                  {r.estab}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald">{num(r.pending)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-parchment-dim">{num(r.disposed)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-brass">
                {num((r.pending || 0) + (r.disposed || 0))}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brass-dim/40 bg-ink-800/40 font-medium">
            <td className="px-3 py-2.5 text-parchment" colSpan={2}>
              Total ({rows.length})
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald">{num(totals.pending)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-parchment-dim">{num(totals.disposed)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-brass">{num(totals.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DashboardStatsTable({ rows, totals }) {
  if (!rows || rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full min-w-[480px] text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-800/50 text-[10px] uppercase tracking-wider text-parchment-dim">
            <th className="px-3 py-2.5 font-medium">File</th>
            <th className="px-3 py-2.5 font-medium">Type</th>
            <th className="px-3 py-2.5 text-right font-medium">Records</th>
            <th className="px-3 py-2.5 text-right font-medium">Duplicates removed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fileName} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/30">
              <td className="max-w-[200px] truncate px-3 py-2 text-parchment" title={r.fileName}>
                {r.fileName}
              </td>
              <td className="px-3 py-2">
                <span className="rounded border border-emerald/40 px-1.5 py-0.5 text-[10px] text-emerald">
                  {r.type}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-parchment">{num(r.records)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-rust">{num(r.removed)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brass-dim/40 bg-ink-800/40 font-medium">
            <td className="px-3 py-2.5 text-parchment" colSpan={2}>
              Total ({rows.length})
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-parchment">{num(totals.records)}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-rust">{num(totals.removed)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DesignationSummaryTable({ rows, totals, mode }) {
  if (!rows || rows.length === 0) return null;

  const civilKey = mode === "pending" ? "pendingCivil" : "disposeCivil";
  const criminalKey = mode === "pending" ? "pendingCriminal" : "disposeCriminal";
  const totalKey = mode === "pending" ? "pendingTotal" : "disposeTotal";
  const civilLabel = mode === "pending" ? "Civil" : "Civil";
  const criminalLabel = mode === "pending" ? "Criminal" : "Criminal";
  const totalLabel = "Total";

  return (
    <div className="overflow-x-auto rounded-lg border border-ink-700">
      <table className="w-full min-w-[420px] text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-800/50 text-[10px] uppercase tracking-wider text-parchment-dim">
            <th className="px-3 py-2.5 font-medium">Designation (ESTA)</th>
            <th className="px-3 py-2.5 text-right font-medium">{civilLabel}</th>
            <th className="px-3 py-2.5 text-right font-medium">{criminalLabel}</th>
            <th className="px-3 py-2.5 text-right font-medium">{totalLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.designation} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/30">
              <td className="max-w-[280px] truncate px-3 py-2 text-parchment" title={r.designation}>
                {r.designation}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald">{num(r[civilKey])}</td>
              <td className="px-3 py-2 text-right tabular-nums text-rust">{num(r[criminalKey])}</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-brass">{num(r[totalKey])}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brass-dim/40 bg-ink-800/40 font-medium">
            <td className="px-3 py-2.5 text-parchment">Total ({rows.length})</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald">{num(totals[civilKey])}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-rust">{num(totals[criminalKey])}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-brass">{num(totals[totalKey])}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ResultsPanel({
  scan,
  queryBuilderFiles,
  dashboardFiles,
  consolidatedFiles = [],
  consolidatedStats = {},
  onDownloadQueryBuilderZip,
  onDownloadDashboardZip,
  onDownloadConsolidatedZip,
  onDownloadAllData,
  qbZipBusy,
  dbZipBusy,
  csZipBusy,
}) {
  if (!scan) return null;

  const estabs = scan.allEstabs || [];
  const totalPending = estabs.reduce((sum, e) => sum + (scan.pendingByEstab[e]?.length ?? 0), 0);
  const totalDisposed = estabs.reduce((sum, e) => sum + (scan.disposedByEstab[e]?.length ?? 0), 0);
  const fileStats = computeFileStats(scan);
  const dashboardStats = computeDashboardStats(scan);
  const designationSummary = computeDesignationSummary(scan);
  const totalOutputFiles =
    (queryBuilderFiles?.length ?? 0) +
    (dashboardFiles?.length ?? 0) +
    (consolidatedFiles?.length ?? 0);
  const consolidatedTotal =
    (consolidatedStats?.pending?.total ?? 0) + (consolidatedStats?.disposed?.total ?? 0);

  const tabs = [
    { key: "overview", label: "Overview", visible: true },
    { key: "query_builder", label: "QUERY_BUILDER", visible: fileStats.rows.length > 0 },
    { key: "dashboard_files", label: "DASHBOARD", visible: dashboardStats.rows.length > 0 },
    { key: "consolidated", label: "CONSOLIDATED", visible: consolidatedFiles.length > 0 },
    { key: "designation", label: "Designation (ESTA)", visible: designationSummary.rows.length > 0 },
    { key: "court_wise", label: "Court-wise", visible: estabs.length > 0 },
  ].filter((t) => t.visible);

  return (
    <ResultsPanelBody
      scan={scan}
      queryBuilderFiles={queryBuilderFiles}
      dashboardFiles={dashboardFiles}
      consolidatedFiles={consolidatedFiles}
      consolidatedStats={consolidatedStats}
      onDownloadQueryBuilderZip={onDownloadQueryBuilderZip}
      onDownloadDashboardZip={onDownloadDashboardZip}
      onDownloadConsolidatedZip={onDownloadConsolidatedZip}
      onDownloadAllData={onDownloadAllData}
      qbZipBusy={qbZipBusy}
      dbZipBusy={dbZipBusy}
      csZipBusy={csZipBusy}
      estabs={estabs}
      totalPending={totalPending}
      totalDisposed={totalDisposed}
      fileStats={fileStats}
      dashboardStats={dashboardStats}
      designationSummary={designationSummary}
      totalOutputFiles={totalOutputFiles}
      consolidatedTotal={consolidatedTotal}
      tabs={tabs}
    />
  );
}

function ResultsPanelBody({
  scan,
  queryBuilderFiles,
  dashboardFiles,
  consolidatedFiles,
  consolidatedStats,
  onDownloadQueryBuilderZip,
  onDownloadDashboardZip,
  onDownloadConsolidatedZip,
  onDownloadAllData,
  qbZipBusy,
  dbZipBusy,
  csZipBusy,
  estabs,
  totalPending,
  totalDisposed,
  fileStats,
  dashboardStats,
  designationSummary,
  totalOutputFiles,
  consolidatedTotal,
  tabs,
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.key ?? "overview");
  const currentTab = tabs.some((t) => t.key === activeTab) ? activeTab : tabs[0]?.key;

  return (
    <div className="fade-in space-y-5 rounded-lg border border-ink-700 bg-ink-900 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl text-parchment">Results</h3>
        <span className="font-mono text-xs text-parchment-dim">
          {num(totalOutputFiles)} output file{totalOutputFiles === 1 ? "" : "s"}
        </span>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 border-b border-ink-700 pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`rounded-md px-3 py-1.5 font-mono text-xs font-medium transition ${
              currentTab === t.key
                ? "bg-brass text-ink-950"
                : "text-parchment-dim hover:bg-ink-800 hover:text-parchment"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {currentTab === "overview" && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard
            value={(fileStats.rows?.length ?? 0) + (dashboardStats.rows?.length ?? 0)}
            label="Files"
          />
          <StatCard value={estabs.length} label="Establishments" />
          <StatCard value={totalPending} label="QB Pending" tone="text-emerald" />
          <StatCard value={totalDisposed} label="QB Disposed" />
          {(scan.dashboardFiles?.length ?? 0) > 0 && (
            <StatCard value={dashboardStats.totals?.records ?? 0} label="DASHBOARD records" tone="text-brass" />
          )}
          {(scan.dashboardFiles?.length ?? 0) > 0 && (
            <StatCard value={consolidatedTotal} label="Consolidated" tone="text-emerald" />
          )}
        </div>
      )}

      {/* QUERY_BUILDER */}
      {currentTab === "query_builder" && fileStats.rows.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
            File-wise pending &amp; disposed
          </h4>
          <FileStatsTable rows={fileStats.rows} totals={fileStats.totals} />
        </div>
      )}

      {/* DASHBOARD files */}
      {currentTab === "dashboard_files" && dashboardStats.rows.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
            Records kept &amp; duplicates removed
          </h4>
          <DashboardStatsTable rows={dashboardStats.rows} totals={dashboardStats.totals} />
        </div>
      )}

      {/* CONSOLIDATED */}
      {currentTab === "consolidated" && consolidatedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
            Full outer join on Case No. / Cases
          </h4>
          <div className="overflow-x-auto rounded-lg border border-ink-700">
            <table className="w-full min-w-[440px] text-left font-mono text-sm">
              <thead>
                <tr className="border-b border-ink-700 bg-ink-800/50 text-[10px] uppercase tracking-wider text-parchment-dim">
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Both</th>
                  <th className="px-3 py-2.5 text-right font-medium">QB only</th>
                  <th className="px-3 py-2.5 text-right font-medium">DB only</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {["pending", "disposed"].map((k) =>
                  consolidatedStats?.[k] ? (
                    <tr key={k} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/30">
                      <td className="px-3 py-2 capitalize text-parchment">{k}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald">
                        {num(consolidatedStats[k].both)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-brass">
                        {num(consolidatedStats[k].qbOnly)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-parchment-dim">
                        {num(consolidatedStats[k].dbOnly)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-parchment">
                        {num(consolidatedStats[k].total)}
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Designation */}
      {currentTab === "designation" && designationSummary.rows.length > 0 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
              Pending by designation (ESTA)
            </h4>
            <DesignationSummaryTable
              rows={designationSummary.rows}
              totals={designationSummary.totals}
              mode="pending"
            />
          </div>
          <div className="space-y-2">
            <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
              Disposed by designation (ESTA)
            </h4>
            <DesignationSummaryTable
              rows={designationSummary.rows}
              totals={designationSummary.totals}
              mode="dispose"
            />
          </div>
        </div>
      )}

      {/* Court-wise */}
      {currentTab === "court_wise" && estabs.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-mono text-xs uppercase tracking-wider text-parchment-dim">
            By establishment
          </h4>
          <div className="rounded-lg border border-ink-700 px-3">
            {estabs.map((e) => (
              <EstabRow
                key={e}
                estab={e}
                pendingCount={scan.pendingByEstab[e]?.length ?? 0}
                disposedCount={scan.disposedByEstab[e]?.length ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {((scan.skipped?.length ?? 0) > 0 || (scan.errors?.length ?? 0) > 0) && (
        <p className="font-mono text-xs text-rust">
          {num((scan.skipped?.length ?? 0) + (scan.errors?.length ?? 0))} file(s) skipped or errored — see processing log.
        </p>
      )}

      {/* Downloads */}
      <div className="flex flex-wrap gap-2 border-t border-ink-700 pt-5">
        <button
          type="button"
          onClick={onDownloadQueryBuilderZip}
          disabled={qbZipBusy || (queryBuilderFiles?.length ?? 0) === 0}
          className="rounded-md bg-brass px-4 py-2 font-mono text-xs font-medium text-ink-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {qbZipBusy ? "Packing…" : "QUERY_BUILDER.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadDashboardZip}
          disabled={dbZipBusy || (dashboardFiles?.length ?? 0) === 0}
          className="rounded-md bg-emerald px-4 py-2 font-mono text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dbZipBusy ? "Packing…" : "DASHBOARD.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadConsolidatedZip}
          disabled={csZipBusy || (consolidatedFiles?.length ?? 0) === 0}
          className="rounded-md border border-ink-600 bg-ink-800 px-4 py-2 font-mono text-xs font-medium text-parchment transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {csZipBusy ? "Packing…" : "CONSOLIDATED.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadAllData}
          className="rounded-md border border-brass-dim/60 px-4 py-2 font-mono text-xs font-medium text-brass transition hover:bg-ink-800"
        >
          ALL_DATA.xlsx
        </button>
      </div>
    </div>
  );
}
