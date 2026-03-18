// app/(dashboard)/reports/do-vs-po/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface DoVsPoRow {
  cpoId:          string;
  poNumber:       string;
  status:         string;
  createdAt:      string;
  customer:       { id: string; name: string; code: string; customerType: string };
  ordered12:      number;
  ordered50:      number;
  delivered12:    number;
  delivered50:    number;
  totalOrdered:   number;
  totalDelivered: number;
  fulfillPct:     number;
  doCount:        number;
}

interface DoVsPoData {
  rows:    DoVsPoRow[];
  totals:  { cpoCount: number; totalOrdered: number; totalDelivered: number; fulfillPct: number };
  dateFrom:string;
  dateTo:  string;
}

const now       = new Date();
const defFrom   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
const defTo     = now.toISOString().slice(0, 10);

const STATUS_CHIP: Record<string, string> = {
  DRAFT:     "bg-[var(--bg-hover)] text-[var(--text-muted)]",
  CONFIRMED: "bg-green-500/10 text-green-400",
  COMPLETED: "bg-blue-500/10 text-blue-400",
};

function FulfillBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${pct >= 100 ? "text-green-400" : pct >= 50 ? "text-amber-400" : "text-red-400"}`}>
        {pct}%
      </span>
    </div>
  );
}

export default function DoVsPoPage() {
  const { activeBranchId } = useBranch();
  const [data,    setData]    = useState<DoVsPoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(defFrom);
  const [dateTo,   setDateTo]   = useState(defTo);
  const [filter,   setFilter]   = useState(""); // "" | "below" | "full"

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ dateFrom, dateTo });
      if (activeBranchId) qs.set("branchId", activeBranchId);
      const res = await fetch(`/api/reports/do-vs-po?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const rows = data?.rows.filter(r => {
    if (filter === "below") return r.fulfillPct < 100;
    if (filter === "full")  return r.fulfillPct >= 100;
    return true;
  }) ?? [];

  return (
    <div className="page-container space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">DO vs PO — Fulfilment</h1>
          <p className="page-desc">Perbandingan qty CPO (dipesan) vs DO (terkirim) per pelanggan</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Dari</label>
          <input type="date" className="input-field" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Sampai</label>
          <input type="date" className="input-field" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="form-label">Filter</label>
          <select className="input-field" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">Semua</option>
            <option value="below">Belum 100%</option>
            <option value="full">Sudah 100%</option>
          </select>
        </div>
        <button onClick={load} className="btn-pri text-sm">Tampilkan</button>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total CPO",      value: data.totals.cpoCount.toString(),                  color: "text-blue-400"   },
            { label: "Total Dipesan",  value: data.totals.totalOrdered.toLocaleString("id-ID"), color: "text-[var(--text-primary)]" },
            { label: "Total Terkirim", value: data.totals.totalDelivered.toLocaleString("id-ID"),color: "text-green-400" },
            { label: "Avg Fulfil",     value: `${data.totals.fulfillPct}%`,                     color: data.totals.fulfillPct >= 100 ? "text-green-400" : data.totals.fulfillPct >= 70 ? "text-amber-400" : "text-red-400" },
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
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="section-title">Detail per CPO {rows.length > 0 && <span className="text-[var(--text-muted)] font-normal normal-case ml-1">({rows.length} CPO)</span>}</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Tidak ada data</div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>No. CPO</th>
                  <th>Status</th>
                  <th className="num">Dipesan</th>
                  <th className="num">Terkirim</th>
                  <th>Fulfil %</th>
                  <th className="num">DO</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.cpoId}>
                    <td>
                      <div className="font-medium text-[var(--text-primary)]">{r.customer.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{r.customer.code}</div>
                    </td>
                    <td>
                      <Link href={`/customer-po/${r.cpoId}`} className="font-mono text-xs text-[var(--accent)] hover:underline">
                        {r.poNumber}
                      </Link>
                    </td>
                    <td>
                      <span className={`chip text-xs ${STATUS_CHIP[r.status] ?? "bg-[var(--bg-hover)] text-[var(--text-muted)]"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="num">
                      <div className="font-mono text-xs">
                        <span className="text-green-400">{r.ordered12}×12</span>{" "}
                        <span className="text-amber-400">{r.ordered50}×50</span>
                      </div>
                    </td>
                    <td className="num">
                      <div className="font-mono text-xs">
                        <span className="text-green-400">{r.delivered12}×12</span>{" "}
                        <span className="text-amber-400">{r.delivered50}×50</span>
                      </div>
                    </td>
                    <td><FulfillBar pct={r.fulfillPct} /></td>
                    <td className="num font-mono text-[var(--text-muted)]">{r.doCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}