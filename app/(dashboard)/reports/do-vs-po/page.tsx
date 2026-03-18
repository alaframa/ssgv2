// app/(dashboard)/reports/do-vs-po/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DoRow {
  id: string;
  doNumber: string;
  doDate: string;
  supplierPoRef: string;
  driver: string;
  vehicleNo: string;
  customer: string;
  customerCode: string;
  cpoNumber: string;
  status: string;
  kg12Released: number;
  kg50Released: number;
  kg12Delivered: number;
  kg50Delivered: number;
  tonase: number;
}

interface Totals {
  kg12Released: number;
  kg50Released: number;
  kg12Delivered: number;
  kg50Delivered: number;
  tonase: number;
}

interface ReportData {
  rows: DoRow[];
  totals: Totals;
  date: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  PENDING:       "bg-gray-500/10 text-gray-400",
  IN_TRANSIT:    "bg-yellow-500/10 text-yellow-400",
  DELIVERED:     "bg-green-500/10 text-green-400",
  PARTIALLY_DELIVERED: "bg-blue-500/10 text-blue-400",
  CANCELLED:     "bg-red-500/10 text-red-400",
};
const STATUS_LABEL: Record<string, string> = {
  PENDING:       "Pending",
  IN_TRANSIT:    "Dalam Perjalanan",
  DELIVERED:     "Terkirim",
  PARTIALLY_DELIVERED: "Sebagian",
  CANCELLED:     "Batal",
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtNum(n: number) {
  return n.toLocaleString("id-ID");
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DoVsPoPage() {
  const { activeBranchId } = useBranch();
  const [date,    setDate]    = useState<string>(todayStr());
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/reports/do-vs-po?branchId=${activeBranchId}&date=${date}`
      );
      if (!res.ok) throw new Error("Gagal memuat data");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error tidak diketahui");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, date]);

  useEffect(() => { load(); }, [load]);

  function prevDay() {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  }

  function nextDay() {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    const today = todayStr();
    if (d.toISOString().slice(0, 10) <= today) setDate(d.toISOString().slice(0, 10));
  }

  async function handleExport() {
    if (!activeBranchId) return;
    const url = `/api/reports/do-vs-po?branchId=${activeBranchId}&date=${date}&export=1`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `DO_vs_PO_${date}.xlsx`;
    a.click();
  }

  const displayDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">DO vs PO</h1>
          <p className="page-desc">Manifest pengiriman harian per tanggal</p>
        </div>
        <button
          className="btn-gho text-sm"
          onClick={handleExport}
          disabled={!data || data.rows.length === 0}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export Excel
        </button>
      </div>

      {/* Date Nav */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <button className="btn-icon" onClick={prevDay} title="Hari sebelumnya">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <input
          type="date"
          className="input-field"
          style={{ maxWidth: 180 }}
          value={date}
          max={todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />

        <button
          className="btn-icon"
          onClick={nextDay}
          disabled={date >= todayStr()}
          title="Hari berikutnya"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>

        <span className="text-sm font-semibold text-[var(--text-primary)] ml-1">{displayDate}</span>

        <button className="btn-gho text-sm ml-auto" onClick={load}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "12 kg Released",  value: fmtNum(data.totals.kg12Released)  },
            { label: "50 kg Released",  value: fmtNum(data.totals.kg50Released)  },
            { label: "12 kg Delivered", value: fmtNum(data.totals.kg12Delivered) },
            { label: "50 kg Delivered", value: fmtNum(data.totals.kg50Delivered) },
            { label: "Tonase",          value: `${fmtNum(data.totals.tonase)} kg` },
          ].map((card) => (
            <div key={card.label} className="card p-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-1">{card.label}</p>
              <p className="font-mono text-xl font-bold text-[var(--text-primary)]">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && <div className="form-error-banner">{error}</div>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-3 py-8 justify-center text-[var(--text-muted)]">
          <div className="spinner" />
          <span>Memuat data...</span>
        </div>
      )}

      {/* Table */}
      {!loading && data && (
        data.rows.length === 0 ? (
          <div className="empty-state card">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="9" y1="21" x2="9" y2="9"/>
            </svg>
            <p className="empty-state-title">Tidak ada DO</p>
            <p className="empty-state-desc">Tidak ada Delivery Order untuk tanggal ini</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>No DO</th>
                    <th>Ref SPO</th>
                    <th>Driver / Kenek</th>
                    <th>Kendaraan</th>
                    <th>Pelanggan</th>
                    <th className="num">12kg Rel</th>
                    <th className="num">50kg Rel</th>
                    <th className="num">12kg Del</th>
                    <th className="num">50kg Del</th>
                    <th className="num">Tonase</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (
                    <tr key={r.id}>
                      <td className="text-[var(--text-muted)] text-xs">{i + 1}</td>
                      <td className="font-mono font-semibold text-[var(--text-primary)]">{r.doNumber}</td>
                      <td className="font-mono text-xs text-[var(--text-muted)]">{r.supplierPoRef}</td>
                      <td className="text-sm">{r.driver}</td>
                      <td className="font-mono text-xs">{r.vehicleNo}</td>
                      <td>
                        <div className="font-semibold text-sm text-[var(--text-primary)] truncate max-w-[200px]">{r.customer}</div>
                        <div className="text-xs text-[var(--text-muted)]">{r.customerCode}</div>
                      </td>
                      <td className="num font-mono">{fmtNum(r.kg12Released)}</td>
                      <td className="num font-mono">{fmtNum(r.kg50Released)}</td>
                      <td className="num font-mono text-green-400">{fmtNum(r.kg12Delivered)}</td>
                      <td className="num font-mono text-green-400">{fmtNum(r.kg50Delivered)}</td>
                      <td className="num font-mono font-semibold text-[var(--text-primary)]">{fmtNum(r.tonase)} kg</td>
                      <td>
                        <span className={`chip text-xs ${STATUS_BADGE[r.status] ?? "bg-gray-500/10 text-gray-400"}`}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-[var(--text-primary)] bg-[var(--bg-hover)]">
                    <td colSpan={6} className="px-3 py-2 text-right text-xs uppercase tracking-wide text-[var(--text-muted)]">
                      Total ({data.rows.length} DO)
                    </td>
                    <td className="num font-mono px-3 py-2">{fmtNum(data.totals.kg12Released)}</td>
                    <td className="num font-mono px-3 py-2">{fmtNum(data.totals.kg50Released)}</td>
                    <td className="num font-mono px-3 py-2 text-green-400">{fmtNum(data.totals.kg12Delivered)}</td>
                    <td className="num font-mono px-3 py-2 text-green-400">{fmtNum(data.totals.kg50Delivered)}</td>
                    <td className="num font-mono px-3 py-2">{fmtNum(data.totals.tonase)} kg</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}