// app/(dashboard)/reports/page.tsx
"use client";

import Link from "next/link";

const REPORTS = [
  {
    href:  "/reports/rekap-kirim",
    title: "Rekap Kirim",
    desc:  "Ringkasan pengiriman harian — DO terkirim, tonase, per pelanggan & driver",
    icon:  "🚚",
    color: "border-blue-500/30 hover:border-blue-500/60",
    tag:   "Harian",
  },
  {
    href:  "/reports/stock-tabung",
    title: "Stock Tabung",
    desc:  "Snapshot stok tabung per cabang — isi, kosong, on-transit, HMT, kuota WO",
    icon:  "📦",
    color: "border-green-500/30 hover:border-green-500/60",
    tag:   "Realtime",
  },
  {
    href:  "/reports/do-vs-po",
    title: "DO vs PO",
    desc:  "Perbandingan qty CPO (dipesan) vs DO (terkirim) — fulfilment rate per pelanggan",
    icon:  "⚖️",
    color: "border-amber-500/30 hover:border-amber-500/60",
    tag:   "Periode",
  },
  {
    href:  "/reports/pencapaian",
    title: "Pencapaian",
    desc:  "Realisasi kirim vs kuota HMT supplier — progress bulanan per cabang",
    icon:  "🎯",
    color: "border-purple-500/30 hover:border-purple-500/60",
    tag:   "Bulanan",
  },
];

export default function ReportsIndexPage() {
  return (
    <div className="page-container space-y-6">
      <div>
        <h1 className="page-title">Laporan</h1>
        <p className="page-desc">Ringkasan operasional SSG Gas Distribution</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORTS.map(r => (
          <Link
            key={r.href}
            href={r.href}
            className={`card p-6 space-y-3 border-2 transition-all duration-150 group ${r.color}`}
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{r.icon}</span>
              <span className="chip text-[10px] bg-[var(--bg-hover)] text-[var(--text-muted)]">{r.tag}</span>
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)] text-base group-hover:text-[var(--accent)] transition-colors">
                {r.title}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">{r.desc}</p>
            </div>
            <div className="text-xs text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
              Buka laporan →
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}