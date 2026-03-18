// app/(dashboard)/reports/rekap-kirim/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface Row {
  key:           string;
  label:         string;
  subLabel?:     string;
  doCount:       number;
  kg12Total:     number;
  kg50Total:     number;
  tonaseKg:      number;
  customerCount: number;
}

interface RekapData {
  rows:     Row[];
  totals:   { doCount: number; kg12Total: number; kg50Total: number; tonaseKg: number };
  dateFrom: string;
  dateTo:   string;
  groupBy:  string;
}

const now    = new Date();
const defFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const defTo   = now.toISOString().slice(0, 10);

export default function RekapKirimPage() {
  const { activeBranchId } = useBranch();
  const [data,    setData]    = useState<RekapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(defFrom);
  const [dateTo,   setDateTo]   = useState(defTo);
  const [groupBy,  setGroupBy]  = useState("day");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ dateFrom, dateTo, groupBy });
      if (activeBranchId) qs.set("branchId", activeBranchId);
      const res = await fetch(`/api/reports/rekap-kirim?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, dateFrom, dateTo, groupBy]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number) => n.toLocaleString("id-ID");

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/reports" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Rekap Kirim</h1>
          <p className="page-desc">Ringkasan DO terkirim per periode</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Dari Tanggal</label>
          <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Sampai Tanggal</label>
          <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Kelompokkan</label>
          <select className="input-field" value={groupBy} onChange={e => setGroupBy(e.target.value)}>
            <option value="day">Per Hari</option>
            <option value="customer">Per Pelanggan</option>
            <option value="driver">Per Driver</option>
          </select>
        </div>
        <button onClick={load} className="btn-pri text-sm">Tampilkan</button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total DO",      value: fmt(data.totals.doCount),   color: "text-blue-400"   },
            { label: "Tabung 12 kg",  value: fmt(data.totals.kg12Total), color: "text-green-400"  },
            { label: "Tabung 50 kg",  value: fmt(data.totals.kg50Total), color: "text-amber-400"  },
            { label: "Tonase (kg)",   value: fmt(data.totals.tonaseKg),  color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="section-title">
            {groupBy === "day" ? "Per Hari" : groupBy === "customer" ? "Per Pelanggan" : "Per Driver"}
            {data && <span className="ml-2 text-[var(--text-muted)] font-normal normal-case">{data.rows.length} baris</span>}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Memuat data…</div>
        ) : !data || data.rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Tidak ada data untuk periode ini</div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{groupBy === "day" ? "Tanggal" : groupBy === "customer" ? "Pelanggan" : "Driver"}</th>
                  {groupBy === "day" && <th className="num">DO</th>}
                  {groupBy !== "day" && <th className="num">DO</th>}
                  {groupBy === "day" && <th className="num">Pelanggan</th>}
                  <th className="num">12 kg</th>
                  <th className="num">50 kg</th>
                  <th className="num">Tonase (kg)</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(row => (
                  <tr key={row.key}>
                    <td>
                      <div className="font-medium text-[var(--text-primary)]">{row.label}</div>
                      {row.subLabel && <div className="text-xs text-[var(--text-muted)]">{row.subLabel}</div>}
                    </td>
                    <td className="num font-mono">{row.doCount}</td>
                    {groupBy === "day" && <td className="num font-mono text-[var(--text-muted)]">{row.customerCount}</td>}
                    <td className="num font-mono text-green-400">{fmt(row.kg12Total)}</td>
                    <td className="num font-mono text-amber-400">{fmt(row.kg50Total)}</td>
                    <td className="num font-mono font-semibold text-[var(--text-primary)]">{fmt(row.tonaseKg)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--border)]">
                  <td className="font-bold text-[var(--text-primary)]">TOTAL</td>
                  <td className="num font-bold font-mono">{data && fmt(data.totals.doCount)}</td>
                  {groupBy === "day" && <td />}
                  <td className="num font-bold font-mono text-green-400">{data && fmt(data.totals.kg12Total)}</td>
                  <td className="num font-bold font-mono text-amber-400">{data && fmt(data.totals.kg50Total)}</td>
                  <td className="num font-bold font-mono text-[var(--text-primary)]">{data && fmt(data.totals.tonaseKg)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}