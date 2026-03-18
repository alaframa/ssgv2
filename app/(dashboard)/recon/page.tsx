// app/(dashboard)/recon/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useBranch } from "@/lib/branch-context";

interface ReconRow {
  customerId:      string;
  customerName:    string;
  customerCode:    string;
  customerType:    string;
  held12:          number;
  held50:          number;
  totalDelivered12:number;
  totalDelivered50:number;
  returned12:      number;
  returned50:      number;
  expected12:      number;
  expected50:      number;
  diff12:          number;
  diff50:          number;
  hasDiscrepancy:  boolean;
}

interface ReconData {
  rows:    ReconRow[];
  summary: {
    total:           number;
    discrepancies:   number;
    totalHeld12:     number;
    totalHeld50:     number;
    totalExpected12: number;
    totalExpected50: number;
  };
}

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return <span className="chip text-xs bg-green-500/10 text-green-400">✓ OK</span>;
  if (diff > 0)  return <span className="chip text-xs bg-amber-500/10 text-amber-400">+{diff} lebih</span>;
  return <span className="chip text-xs bg-red-500/10 text-red-400">{diff} kurang</span>;
}

export default function ReconPage() {
  const { activeBranchId } = useBranch();
  const [data,     setData]     = useState<ReconData | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [search,   setSearch]   = useState("");
  const [onlyDisc, setOnlyDisc] = useState(false);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ branchId: activeBranchId });
      if (search) qs.set("search", search);
      const res = await fetch(`/api/recon?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, search]);

  useEffect(() => { load(); }, [load]);

  const rows = onlyDisc
    ? (data?.rows.filter(r => r.hasDiscrepancy) ?? [])
    : (data?.rows ?? []);

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div>
        <h1 className="page-title">Rekonsiliasi Tabung Pelanggan</h1>
        <p className="page-desc">
          Bandingkan tabung yang tercatat dipegang pelanggan vs yang diperkirakan (kirim − return)
        </p>
      </div>

      {/* Info */}
      <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-4 py-3 text-xs text-blue-300/80 leading-relaxed space-y-1">
        <p className="font-semibold text-blue-400">📋 Cara rekonsiliasi</p>
        <p>
          <strong>Dipegang (Rekod)</strong> = angka dari CustomerCylinderHolding (diperbarui otomatis saat DO DELIVERED).
          <strong> Ekspektasi</strong> = Total terkirim (semua DO DELIVERED) − Total kembali (EmptyReturn CUSTOMER).
          Selisih menunjukkan perbedaan yang perlu diselesaikan.
        </p>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">{data.summary.total}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Pelanggan</p>
          </div>
          <div className={`card p-4 text-center ${data.summary.discrepancies > 0 ? "border-amber-500/40" : "border-green-500/30"}`}>
            <p className={`text-2xl font-bold font-mono ${data.summary.discrepancies > 0 ? "text-amber-400" : "text-green-400"}`}>
              {data.summary.discrepancies}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Ada Selisih</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-sm font-mono text-[var(--text-primary)]">
              <span className="text-green-400">{data.summary.totalHeld12}</span> / <span className="text-amber-400">{data.summary.totalHeld50}</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Total Dipegang (12kg/50kg)</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="form-label">Cari Pelanggan</label>
          <input
            className="input-field"
            placeholder="Nama atau kode pelanggan…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <input
            id="onlyDisc"
            type="checkbox"
            checked={onlyDisc}
            onChange={e => setOnlyDisc(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="onlyDisc" className="text-sm text-[var(--text-secondary)] cursor-pointer">
            Hanya yang ada selisih
          </label>
        </div>
        <button onClick={load} className="btn-gho text-sm">↻ Refresh</button>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="section-title">
            Detail per Pelanggan
            {rows.length > 0 && <span className="ml-2 text-[var(--text-muted)] font-normal normal-case">({rows.length} pelanggan)</span>}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Memuat data…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">
            {onlyDisc ? "Tidak ada selisih — semua data sudah sesuai ✓" : "Tidak ada data pelanggan"}
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th className="num">Dipegang 12kg</th>
                  <th className="num">Dipegang 50kg</th>
                  <th className="num">Ekspektasi 12kg</th>
                  <th className="num">Ekspektasi 50kg</th>
                  <th>Selisih 12kg</th>
                  <th>Selisih 50kg</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.customerId} className={r.hasDiscrepancy ? "bg-amber-500/3" : ""}>
                    <td>
                      <div className="font-medium text-[var(--text-primary)]">{r.customerName}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.customerCode} · {r.customerType}</div>
                    </td>
                    <td className="num font-mono">{r.held12}</td>
                    <td className="num font-mono">{r.held50}</td>
                    <td className="num font-mono text-[var(--text-muted)]">{r.expected12}</td>
                    <td className="num font-mono text-[var(--text-muted)]">{r.expected50}</td>
                    <td><DiffBadge diff={r.diff12} /></td>
                    <td><DiffBadge diff={r.diff50} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4 text-xs text-[var(--text-muted)] space-y-1">
        <p className="font-semibold text-[var(--text-secondary)]">Keterangan:</p>
        <p><span className="chip bg-green-500/10 text-green-400 text-[10px]">✓ OK</span> — angka rekod sama dengan ekspektasi</p>
        <p><span className="chip bg-amber-500/10 text-amber-400 text-[10px]">+N lebih</span> — rekod mencatat lebih banyak dari ekspektasi (mungkin ada return yang belum dicatat, atau DO yang tidak terupdate)</p>
        <p><span className="chip bg-red-500/10 text-red-400 text-[10px]">-N kurang</span> — rekod lebih sedikit dari ekspektasi (mungkin ada DO yang belum diupdate DELIVERED, atau holding belum diperbarui)</p>
      </div>
    </div>
  );
}