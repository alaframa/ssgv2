// app/(dashboard)/reports/pencapaian/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DailyRow {
  date: string;
  kg12: number;
  kg50: number;
  tonase: number;
  trips: number;
}

interface BranchStat {
  branchId: string;
  branchCode: string;
  branchName: string;
  kg12: number;
  kg50: number;
  tonase: number;
  workingDays: number;
  avgPerDay: number;
  sharePct: number;
  daily: DailyRow[];
}

interface PencapaianData {
  month: number;
  year: number;
  branches: BranchStat[];
  grandTonase: number;
}

function fmtNum(n: number) {
  return n.toLocaleString("id-ID");
}

const MONTH_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BRANCH_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  SBY: { bg: "bg-blue-500/10",   text: "text-blue-400",   bar: "bg-blue-500" },
  YOG: { bg: "bg-purple-500/10", text: "text-purple-400", bar: "bg-purple-500" },
};

function ShareBar({ pct, code }: { pct: number; code: string }) {
  const color = BRANCH_COLORS[code] ?? { bar: "bg-gray-500" };
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-[var(--text-primary)] w-10 text-right">{pct}%</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PencapaianPage() {
  const now = new Date();
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [year,  setYear]  = useState<number>(now.getFullYear());
  const [data,  setData]  = useState<PencapaianData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/pencapaian?month=${month}&year=${year}`);
      if (!res.ok) throw new Error("Gagal memuat data pencapaian");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  async function handleExport() {
    const url = `/api/reports/pencapaian?month=${month}&year=${year}&export=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pencapaian_${year}_${String(month).padStart(2, "0")}.xlsx`;
    a.click();
  }

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Pencapaian</h1>
          <p className="page-desc">Rekapitulasi distribusi per cabang bulanan</p>
        </div>
        <button
          className="btn-gho text-sm"
          onClick={handleExport}
          disabled={!data}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Excel
        </button>
      </div>

      {/* Period Selector */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <select
          className="input-field"
          style={{ maxWidth: 140 }}
          value={month}
          onChange={(e) => setMonth(parseInt(e.target.value, 10))}
        >
          {MONTH_NAMES.slice(1).map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select
          className="input-field"
          style={{ maxWidth: 100 }}
          value={year}
          onChange={(e) => setYear(parseInt(e.target.value, 10))}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="btn-pri text-sm" onClick={load}>
          Tampilkan
        </button>
      </div>

      {error   && <div className="form-error-banner">{error}</div>}
      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center text-[var(--text-muted)]">
          <div className="spinner" />
          <span>Memuat data...</span>
        </div>
      )}

      {/* Grand Total Banner */}
      {!loading && data && (
        <div className="card p-4 flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Total Tonase</p>
            <p className="font-mono text-2xl font-bold text-[var(--text-primary)]">
              {fmtNum(data.grandTonase)} <span className="text-sm font-normal text-[var(--text-muted)]">kg</span>
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Periode</p>
            <p className="font-semibold text-[var(--text-primary)]">
              {MONTH_NAMES[data.month]} {data.year}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Total 12 kg</p>
            <p className="font-mono font-bold text-[var(--text-primary)]">
              {fmtNum(data.branches.reduce((s, b) => s + b.kg12, 0))} tabung
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Total 50 kg</p>
            <p className="font-mono font-bold text-[var(--text-primary)]">
              {fmtNum(data.branches.reduce((s, b) => s + b.kg50, 0))} tabung
            </p>
          </div>
        </div>
      )}

      {/* Branch Cards */}
      {!loading && data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.branches.map((b) => {
            const colors  = BRANCH_COLORS[b.branchCode] ?? { bg: "bg-gray-500/10", text: "text-gray-400", bar: "bg-gray-500" };
            const isExpanded = expandedBranch === b.branchId;

            return (
              <div key={b.branchId} className="card overflow-hidden">
                {/* Branch header */}
                <div className={`px-4 py-3 flex items-center justify-between ${colors.bg}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${colors.text}`}>{b.branchCode}</span>
                    <span className="text-[var(--text-secondary)] text-sm">{b.branchName}</span>
                  </div>
                  <span className={`chip text-xs ${colors.bg} ${colors.text}`}>
                    {b.sharePct}% share
                  </span>
                </div>

                <div className="p-4 space-y-4">
                  {/* KPI grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "12 kg", value: fmtNum(b.kg12), unit: "tbg" },
                      { label: "50 kg", value: fmtNum(b.kg50), unit: "tbg" },
                      { label: "Tonase", value: fmtNum(b.tonase), unit: "kg" },
                      { label: "Avg/Hari", value: fmtNum(b.avgPerDay), unit: "kg" },
                    ].map((stat) => (
                      <div key={stat.label} className="text-center">
                        <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">{stat.label}</p>
                        <p className="font-mono font-bold text-[var(--text-primary)]">{stat.value}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{stat.unit}</p>
                      </div>
                    ))}
                  </div>

                  {/* Share bar */}
                  <div>
                    <p className="text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wide">% Distribusi</p>
                    <ShareBar pct={b.sharePct} code={b.branchCode} />
                  </div>

                  {/* Working days */}
                  <p className="text-xs text-[var(--text-muted)]">
                    Hari kerja aktif: <span className="font-semibold text-[var(--text-secondary)]">{b.workingDays} hari</span>
                  </p>

                  {/* Toggle detail */}
                  <button
                    className="btn-gho text-xs w-full"
                    onClick={() => setExpandedBranch(isExpanded ? null : b.branchId)}
                  >
                    {isExpanded ? "Sembunyikan Rincian Harian" : `Lihat Rincian Harian (${b.daily.length} hari)`}
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"
                      className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {/* Daily detail table */}
                  {isExpanded && (
                    <div className="overflow-x-auto mt-1">
                      <table className="data-table text-xs">
                        <thead>
                          <tr>
                            <th>Tanggal</th>
                            <th className="num">12 kg</th>
                            <th className="num">50 kg</th>
                            <th className="num">Tonase</th>
                            <th className="num">Trips</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.daily.map((d) => {
                            const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("id-ID", {
                              weekday: "short", day: "numeric", month: "short",
                            });
                            return (
                              <tr key={d.date}>
                                <td className="text-[var(--text-secondary)]">{dayLabel}</td>
                                <td className="num font-mono">{fmtNum(d.kg12)}</td>
                                <td className="num font-mono">{fmtNum(d.kg50)}</td>
                                <td className="num font-mono font-semibold">{fmtNum(d.tonase)} kg</td>
                                <td className="num text-[var(--text-muted)]">{d.trips}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="font-bold">
                            <td className="text-xs text-[var(--text-muted)] px-3 py-2">Total</td>
                            <td className="num font-mono px-3 py-2">{fmtNum(b.kg12)}</td>
                            <td className="num font-mono px-3 py-2">{fmtNum(b.kg50)}</td>
                            <td className="num font-mono px-3 py-2">{fmtNum(b.tonase)} kg</td>
                            <td className="num px-3 py-2">{fmtNum(b.daily.reduce((s, d) => s + d.trips, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Table — both branches side by side */}
      {!loading && data && data.branches.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="section-title">Ringkasan Perbandingan</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cabang</th>
                  <th className="num">12 kg</th>
                  <th className="num">50 kg</th>
                  <th className="num">Tonase (kg)</th>
                  <th className="num">Hari Kerja</th>
                  <th className="num">Avg/Hari</th>
                  <th className="num">% Share</th>
                </tr>
              </thead>
              <tbody>
                {data.branches.map((b) => {
                  const colors = BRANCH_COLORS[b.branchCode] ?? { text: "text-gray-400" };
                  return (
                    <tr key={b.branchId}>
                      <td>
                        <span className={`font-bold ${colors.text}`}>{b.branchCode}</span>
                        <span className="text-[var(--text-muted)] text-xs ml-1.5">{b.branchName}</span>
                      </td>
                      <td className="num font-mono">{fmtNum(b.kg12)}</td>
                      <td className="num font-mono">{fmtNum(b.kg50)}</td>
                      <td className="num font-mono font-semibold text-[var(--text-primary)]">{fmtNum(b.tonase)}</td>
                      <td className="num">{b.workingDays}</td>
                      <td className="num font-mono">{fmtNum(b.avgPerDay)}</td>
                      <td className="num">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${BRANCH_COLORS[b.branchCode]?.bar ?? "bg-gray-500"}`}
                              style={{ width: `${b.sharePct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-[var(--text-primary)]">{b.sharePct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td className="px-3 py-2 text-[var(--text-muted)] text-xs uppercase tracking-wide">Total</td>
                  <td className="num font-mono px-3 py-2">
                    {fmtNum(data.branches.reduce((s, b) => s + b.kg12, 0))}
                  </td>
                  <td className="num font-mono px-3 py-2">
                    {fmtNum(data.branches.reduce((s, b) => s + b.kg50, 0))}
                  </td>
                  <td className="num font-mono px-3 py-2 text-[var(--text-primary)]">
                    {fmtNum(data.grandTonase)}
                  </td>
                  <td colSpan={2}></td>
                  <td className="num px-3 py-2 text-[var(--text-primary)]">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}