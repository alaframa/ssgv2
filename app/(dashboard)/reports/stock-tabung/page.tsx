// app/(dashboard)/reports/stock-tabung/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface StockRow {
  branchId:    string;
  branchCode:  string;
  branchName:  string;
  stockDate:   string | null;
  kg12Full:    number;
  kg12Empty:   number;
  kg12Transit: number;
  kg12Hmt:     number;
  kg12WO:      number;
  kg50Full:    number;
  kg50Empty:   number;
  kg50Transit: number;
  kg50Hmt:     number;
  kg50WO:      number;
  hmtQuota:    number;
  hmtUsed:     number;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function Num({ v, color = "" }: { v: number; color?: string }) {
  return <span className={`font-mono ${color}`}>{v.toLocaleString("id-ID")}</span>;
}

export default function StockTabungPage() {
  const { activeBranchId } = useBranch();
  const [rows,    setRows]    = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [date,    setDate]    = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (activeBranchId) qs.set("branchId", activeBranchId);
      if (date) qs.set("date", date);
      const res = await fetch(`/api/reports/stock-tabung?${qs}`);
      if (res.ok) {
        const d = await res.json();
        setRows(d.rows ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, date]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((acc, r) => ({
    kg12Full:    acc.kg12Full    + r.kg12Full,
    kg12Empty:   acc.kg12Empty   + r.kg12Empty,
    kg12Transit: acc.kg12Transit + r.kg12Transit,
    kg50Full:    acc.kg50Full    + r.kg50Full,
    kg50Empty:   acc.kg50Empty   + r.kg50Empty,
    kg50Transit: acc.kg50Transit + r.kg50Transit,
  }), { kg12Full: 0, kg12Empty: 0, kg12Transit: 0, kg50Full: 0, kg50Empty: 0, kg50Transit: 0 });

  return (
    <div className="page-container space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/reports" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Stock Tabung</h1>
          <p className="page-desc">Snapshot stok per cabang — tabung isi, kosong, on-transit</p>
        </div>
      </div>

      {/* Filter */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="form-label">Tanggal Snapshot</label>
          <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} placeholder="Terbaru" />
        </div>
        <button onClick={load} className="btn-pri text-sm">Tampilkan</button>
        {date && <button className="btn-gho text-sm" onClick={() => setDate("")}>Gunakan Data Terbaru</button>}
      </div>

      {/* Summary totals (all branches combined) */}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: "12kg Isi",     value: totals.kg12Full,    color: "text-green-400" },
            { label: "12kg Kosong",  value: totals.kg12Empty,   color: "text-gray-400"  },
            { label: "12kg Transit", value: totals.kg12Transit, color: "text-yellow-400"},
            { label: "50kg Isi",     value: totals.kg50Full,    color: "text-green-400" },
            { label: "50kg Kosong",  value: totals.kg50Empty,   color: "text-gray-400"  },
            { label: "50kg Transit", value: totals.kg50Transit, color: "text-yellow-400"},
          ].map(s => (
            <div key={s.label} className="card p-3 text-center">
              <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value.toLocaleString("id-ID")}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Per-branch table */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="section-title">Stok per Cabang</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Memuat…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Tidak ada data stok</div>
        ) : (
          rows.map(r => (
            <div key={r.branchId} className="border-b border-[var(--border)] last:border-0">
              <div className="px-5 py-3 flex items-center justify-between bg-[var(--surface-raised)]">
                <div>
                  <span className="font-bold text-[var(--text-primary)] text-sm">{r.branchName}</span>
                  <span className="ml-2 chip text-xs">{r.branchCode}</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">Per {fmtDate(r.stockDate)}</span>
              </div>

              <div className="px-5 py-4">
                {/* 12kg */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Tabung 12 kg</p>
                  <div className="grid grid-cols-5 gap-3 text-center">
                    {[
                      { label: "Isi",      val: r.kg12Full,    color: "text-green-400" },
                      { label: "Kosong",   val: r.kg12Empty,   color: "text-gray-400"  },
                      { label: "Transit",  val: r.kg12Transit, color: "text-yellow-400"},
                      { label: "HMT",      val: r.kg12Hmt,     color: "text-blue-400"  },
                      { label: "Kuota WO", val: r.kg12WO,      color: "text-red-400"   },
                    ].map(c => (
                      <div key={c.label} className="bg-[var(--bg-hover)] rounded-lg p-2">
                        <p className={`font-mono font-bold text-base ${c.color}`}>{c.val.toLocaleString("id-ID")}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{c.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 50kg */}
                <div>
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Tabung 50 kg</p>
                  <div className="grid grid-cols-5 gap-3 text-center">
                    {[
                      { label: "Isi",      val: r.kg50Full,    color: "text-green-400" },
                      { label: "Kosong",   val: r.kg50Empty,   color: "text-gray-400"  },
                      { label: "Transit",  val: r.kg50Transit, color: "text-yellow-400"},
                      { label: "HMT",      val: r.kg50Hmt,     color: "text-blue-400"  },
                      { label: "Kuota WO", val: r.kg50WO,      color: "text-red-400"   },
                    ].map(c => (
                      <div key={c.label} className="bg-[var(--bg-hover)] rounded-lg p-2">
                        <p className={`font-mono font-bold text-base ${c.color}`}>{c.val.toLocaleString("id-ID")}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{c.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}