import { getCourtType } from "../lib/establishmentResolver.js";
import { computeFileStats, computeDashboardStats } from "../lib/inputScanner.js";

function StatCard({ value, label, tone = "text-parchment" }) {
  return (
    <div className="rounded-sm border border-ink-700 bg-ink-900/60 px-4 py-3">
      <div className={`font-display text-3xl ${tone}`}>{value}</div>
      <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-parchment-dim">
        {label}
      </div>
    </div>
  );
}

function EstabRow({ estab, pendingCount, disposedCount }) {
  return (
    <div className="flex items-center justify-between border-b border-ink-700 py-2 last:border-0">
      <div className="flex items-center gap-3">
        <span className="rounded-sm border border-brass-dim/60 px-2 py-0.5 font-mono text-[11px] text-brass">
          {estab}
        </span>
        <span className="font-mono text-xs text-parchment-dim">{getCourtType(estab)} court</span>
      </div>
      <div className="flex gap-4 font-mono text-sm">
        <span className="text-emerald-bright">{pendingCount} pending</span>
        <span className="text-parchment-dim">{disposedCount} disposed</span>
        <span className="text-brass">{pendingCount + disposedCount} total</span>
      </div>
    </div>
  );
}

function FileStatsTable({ rows, totals }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-sm border border-ink-700">
      <table className="w-full min-w-[560px] border-collapse text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-800/60 text-[11px] uppercase tracking-widest text-parchment-dim">
            <th className="px-4 py-2.5 font-medium">File</th>
            <th className="px-4 py-2.5 font-medium">Establishment</th>
            <th className="px-4 py-2.5 text-right font-medium">Pending</th>
            <th className="px-4 py-2.5 text-right font-medium">Disposed</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fileName} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/40">
              <td className="max-w-[240px] truncate px-4 py-2 text-parchment" title={r.fileName}>
                {r.fileName}
              </td>
              <td className="px-4 py-2">
                <span className="rounded-sm border border-brass-dim/60 px-2 py-0.5 text-[11px] text-brass">
                  {r.estab}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-emerald-bright">{r.pending || "—"}</td>
              <td className="px-4 py-2 text-right text-parchment-dim">{r.disposed || "—"}</td>
              <td className="px-4 py-2 text-right font-medium text-brass">{r.pending + r.disposed}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brass-dim/60 bg-ink-800/60 font-medium">
            <td className="px-4 py-2.5 text-parchment" colSpan={2}>
              Total ({rows.length} file{rows.length === 1 ? "" : "s"})
            </td>
            <td className="px-4 py-2.5 text-right text-emerald-bright">{totals.pending}</td>
            <td className="px-4 py-2.5 text-right text-parchment-dim">{totals.disposed}</td>
            <td className="px-4 py-2.5 text-right text-brass">{totals.total}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function DashboardStatsTable({ rows, totals }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-sm border border-ink-700">
      <table className="w-full min-w-[560px] border-collapse text-left font-mono text-sm">
        <thead>
          <tr className="border-b border-ink-700 bg-ink-800/60 text-[11px] uppercase tracking-widest text-parchment-dim">
            <th className="px-4 py-2.5 font-medium">File</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 text-right font-medium">Records kept</th>
            <th className="px-4 py-2.5 text-right font-medium">Duplicates removed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.fileName} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/40">
              <td className="max-w-[240px] truncate px-4 py-2 text-parchment" title={r.fileName}>
                {r.fileName}
              </td>
              <td className="px-4 py-2">
                <span className="rounded-sm border border-emerald-bright/60 px-2 py-0.5 text-[11px] text-emerald-bright">
                  {r.type}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-parchment">{r.records}</td>
              <td className="px-4 py-2 text-right text-rust">{r.removed || "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-brass-dim/60 bg-ink-800/60 font-medium">
            <td className="px-4 py-2.5 text-parchment" colSpan={2}>
              Total ({rows.length} file{rows.length === 1 ? "" : "s"})
            </td>
            <td className="px-4 py-2.5 text-right text-parchment">{totals.records}</td>
            <td className="px-4 py-2.5 text-right text-rust">{totals.removed || "—"}</td>
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

  const estabs = scan.allEstabs;
  const totalPending = estabs.reduce((sum, e) => sum + (scan.pendingByEstab[e]?.length ?? 0), 0);
  const totalDisposed = estabs.reduce((sum, e) => sum + (scan.disposedByEstab[e]?.length ?? 0), 0);
  const fileStats = computeFileStats(scan);
  const dashboardStats = computeDashboardStats(scan);
  const totalOutputFiles = queryBuilderFiles.length + dashboardFiles.length + consolidatedFiles.length;
  const consolidatedTotal =
    (consolidatedStats?.pending?.total ?? 0) + (consolidatedStats?.disposed?.total ?? 0);

  return (
    <div className="stamp-anim space-y-8 rounded-sm border border-brass-dim/50 bg-ink-900/60 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-2xl text-brass">Dashboard</h3>
        <span className="font-mono text-xs text-parchment-dim">
          {totalOutputFiles} output file{totalOutputFiles === 1 ? "" : "s"} generated
        </span>
      </div>

      {/* Top-level totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard value={fileStats.rows.length + dashboardStats.rows.length} label="Files uploaded" />
        <StatCard value={estabs.length} label="Establishments" />
        <StatCard value={totalPending} label="QUERY_BUILDER pending" tone="text-emerald-bright" />
        <StatCard value={totalDisposed} label="QUERY_BUILDER disposed" tone="text-parchment" />
        <StatCard value={dashboardStats.totals.records} label="DASHBOARD records" tone="text-brass" />
        <StatCard value={consolidatedTotal} label="CONSOLIDATED case no.s" tone="text-emerald-bright" />
      </div>

      {/* File-wise QUERY_BUILDER dashboard */}
      {fileStats.rows.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display text-lg text-parchment">QUERY_BUILDER — file-wise pending &amp; dispose entries</h4>
          <FileStatsTable rows={fileStats.rows} totals={fileStats.totals} />
        </div>
      )}

      {/* File-wise DASHBOARD stats */}
      {dashboardStats.rows.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display text-lg text-parchment">DASHBOARD — file-wise records &amp; duplicates removed</h4>
          <DashboardStatsTable rows={dashboardStats.rows} totals={dashboardStats.totals} />
        </div>
      )}

      {/* CONSOLIDATED (DASHBOARD + QUERY_BUILDER) full outer join breakdown */}
      {consolidatedFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display text-lg text-parchment">
            CONSOLIDATED — DASHBOARD + QUERY_BUILDER full outer join (Case No. / Cases)
          </h4>
          <div className="overflow-x-auto rounded-sm border border-ink-700">
            <table className="w-full min-w-[520px] border-collapse text-left font-mono text-sm">
              <thead>
                <tr className="border-b border-ink-700 bg-ink-800/60 text-[11px] uppercase tracking-widest text-parchment-dim">
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 text-right font-medium">Both sides</th>
                  <th className="px-4 py-2.5 text-right font-medium">QUERY_BUILDER only</th>
                  <th className="px-4 py-2.5 text-right font-medium">DASHBOARD only</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total rows</th>
                </tr>
              </thead>
              <tbody>
                {["pending", "disposed"].map((k) =>
                  consolidatedStats?.[k] ? (
                    <tr key={k} className="border-b border-ink-700 last:border-0 hover:bg-ink-800/40">
                      <td className="px-4 py-2 capitalize text-parchment">{k}</td>
                      <td className="px-4 py-2 text-right text-emerald-bright">{consolidatedStats[k].both}</td>
                      <td className="px-4 py-2 text-right text-brass">{consolidatedStats[k].qbOnly}</td>
                      <td className="px-4 py-2 text-right text-parchment-dim">{consolidatedStats[k].dbOnly}</td>
                      <td className="px-4 py-2 text-right font-medium text-parchment">{consolidatedStats[k].total}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Establishment-wise (court-wise) summary */}
      {estabs.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-display text-lg text-parchment">Court-wise summary</h4>
          <div className="rounded-sm border border-ink-700 px-4">
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

      {(scan.skipped.length > 0 || scan.errors.length > 0) && (
        <div className="font-mono text-xs text-rust">
          {scan.skipped.length + scan.errors.length} file{scan.skipped.length + scan.errors.length === 1 ? "" : "s"} skipped or errored — see the processing log above.
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={onDownloadQueryBuilderZip}
          disabled={qbZipBusy || queryBuilderFiles.length === 0}
          className="rounded-sm bg-brass px-5 py-2.5 font-mono text-sm font-medium text-ink-950 transition hover:bg-brass/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {qbZipBusy ? "Packing archive…" : "Download QUERY_BUILDER.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadDashboardZip}
          disabled={dbZipBusy || dashboardFiles.length === 0}
          className="rounded-sm bg-emerald px-5 py-2.5 font-mono text-sm font-medium text-parchment transition hover:bg-emerald-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          {dbZipBusy ? "Packing archive…" : "Download DASHBOARD.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadConsolidatedZip}
          disabled={csZipBusy || consolidatedFiles.length === 0}
          className="rounded-sm bg-ink-700 px-5 py-2.5 font-mono text-sm font-medium text-parchment transition hover:bg-ink-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {csZipBusy ? "Packing archive…" : "Download CONSOLIDATED.zip"}
        </button>
        <button
          type="button"
          onClick={onDownloadAllData}
          className="rounded-sm border border-brass-dim px-5 py-2.5 font-mono text-sm font-medium text-brass transition hover:bg-ink-800"
        >
          Download ALL_DATA.xlsx
        </button>
      </div>
    </div>
  );
}
