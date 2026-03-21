// app/(dashboard)/recon/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReconPeriod {
  id:       string;
  branchId: string;
  month:    number;
  year:     number;
  status:   "OPEN" | "LOCKED";
  openedAt: string;
  lockedAt: string | null;
  notes:    string | null;
  branch:   { code: string; name: string };
}

interface Figures {
  // 12 kg
  openingFull12:         number;
  openingEmpty12:        number;
  inboundFull12:         number;
  outboundFull12:        number;
  returnedEmpty12:       number;
  writeoffQty12:         number;
  computedClosingFull12: number;
  computedClosingEmpty12:number;
  actualClosingFull12:   number;
  actualClosingEmpty12:  number;
  varianceFull12:        number;
  varianceEmpty12:       number;
  // 50 kg
  openingFull50:         number;
  openingEmpty50:        number;
  inboundFull50:         number;
  outboundFull50:        number;
  returnedEmpty50:       number;
  writeoffQty50:         number;
  computedClosingFull50: number;
  computedClosingEmpty50:number;
  actualClosingFull50:   number;
  actualClosingEmpty50:  number;
  varianceFull50:        number;
  varianceEmpty50:       number;
}

interface ReconDetail {
  period:  ReconPeriod;
  figures: Figures;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtNum(n: number) {
  return n.toLocaleString("id-ID");
}

/** Returns Tailwind class for variance value */
function varianceColor(v: number): string {
  if (v === 0)         return "text-green-400";
  if (Math.abs(v) <= 5) return "text-amber-400";
  return "text-red-400";
}

function varianceBg(v: number): string {
  if (v === 0)         return "bg-green-500/8";
  if (Math.abs(v) <= 5) return "bg-amber-500/8";
  return "bg-red-500/8";
}

// ─── Sub-component: Figure Table ──────────────────────────────────────────────
function FigureTable({ label, figs }: {
  label: string;
  figs: {
    openingFull:          number;
    openingEmpty:         number;
    inboundFull:          number;
    outboundFull:         number;
    returnedEmpty:        number;
    writeoffQty:          number;
    computedClosingFull:  number;
    computedClosingEmpty: number;
    actualClosingFull:    number;
    actualClosingEmpty:   number;
    varianceFull:         number;
    varianceEmpty:        number;
  };
}) {
  const rows = [
    { label: "Opening Full",          full: figs.openingFull,         empty: figs.openingEmpty },
    { label: "+ Inbound (GR)",         full: figs.inboundFull,         empty: null, positive: true },
    { label: "− Outbound (DO)",        full: -figs.outboundFull,       empty: null, negative: true },
    { label: "+ Empty Return",         full: null,                     empty: figs.returnedEmpty, positive: true },
    { label: "− Write-off",            full: -figs.writeoffQty,        empty: null, negative: true },
    { label: "Closing Computed",       full: figs.computedClosingFull, empty: figs.computedClosingEmpty, dividerAbove: true },
    { label: "Closing Actual (Stock)", full: figs.actualClosingFull,   empty: figs.actualClosingEmpty },
    { label: "Selisih (Variance)",     full: figs.varianceFull,        empty: figs.varianceEmpty, isVariance: true, dividerAbove: true },
  ];

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[var(--accent)]" />
        <h3 className="font-semibold text-[var(--text-primary)] text-sm">{label}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th className="text-left">Keterangan</th>
              <th className="num">Full (tabung)</th>
              <th className="num">Kosong (tabung)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isVar = row.isVariance;
              const fullClass  = isVar ? varianceColor(row.full  ?? 0) : "";
              const emptyClass = isVar ? varianceColor(row.empty ?? 0) : "";
              const rowBg      = isVar ? varianceBg(Math.max(Math.abs(row.full ?? 0), Math.abs(row.empty ?? 0))) : "";

              return (
                <tr key={row.label} className={`${rowBg} ${row.dividerAbove ? "border-t border-[var(--border)]" : ""}`}>
                  <td className={`${isVar ? "font-bold" : ""} ${row.dividerAbove ? "font-semibold" : ""}`}>
                    {row.label}
                  </td>
                  <td className={`num font-mono ${fullClass} ${isVar ? "font-bold" : ""}`}>
                    {row.full !== null
                      ? (row.full >= 0 ? "" : "−") + fmtNum(Math.abs(row.full))
                      : "—"}
                  </td>
                  <td className={`num font-mono ${emptyClass} ${isVar ? "font-bold" : ""}`}>
                    {row.empty !== null
                      ? (row.empty >= 0 ? "" : "−") + fmtNum(Math.abs(row.empty))
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ReconDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const [detail,    setDetail]    = useState<ReconDetail | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [locking,   setLocking]   = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockDone,  setLockDone]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/recon/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal memuat detail rekonsiliasi");
      }
      setDetail(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleLock() {
    if (!detail) return;
    setLockError(null);
    const confirmed = window.confirm(
      `Kunci periode ${MONTH_NAMES[detail.period.month]} ${detail.period.year} untuk ${detail.period.branch.name}?\n\nSetelah dikunci, TIDAK ada transaksi baru yang bisa dibuat untuk periode ini.`
    );
    if (!confirmed) return;

    setLocking(true);
    try {
      const res = await fetch(`/api/recon/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "LOCK" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLockError(data.error ?? "Gagal mengunci periode");
        return;
      }
      setLockDone(true);
      load(); // reload to get updated status
    } catch {
      setLockError("Terjadi kesalahan jaringan");
    } finally {
      setLocking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-12 justify-center text-[var(--text-muted)]">
        <div className="spinner" />
        <span>Memuat rekonsiliasi...</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="page-container space-y-4">
        <Link href="/recon" className="btn-gho text-sm">← Kembali</Link>
        <div className="form-error-banner">{error ?? "Data tidak ditemukan"}</div>
      </div>
    );
  }

  const { period, figures } = detail;
  const isLocked = period.status === "LOCKED";

  // Overall variance: absolute max across all 4 values
  const maxVariance = Math.max(
    Math.abs(figures.varianceFull12),
    Math.abs(figures.varianceEmpty12),
    Math.abs(figures.varianceFull50),
    Math.abs(figures.varianceEmpty50),
  );

  return (
    <div className="page-container space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/recon" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <h1 className="page-title">
              {MONTH_NAMES[period.month]} {period.year}
            </h1>
            <p className="page-desc">{period.branch.name} — Rekonsiliasi Bulanan</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLocked ? (
            <span className="chip bg-red-500/10 text-red-400 flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              LOCKED
            </span>
          ) : (
            <>
              <span className="chip bg-green-500/10 text-green-400">OPEN</span>
              <button
                className="btn-pri text-sm"
                onClick={handleLock}
                disabled={locking}
              >
                {locking ? (
                  <><div className="spinner spinner-sm" /> Mengunci...</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Kunci Periode
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {lockError && <div className="form-error-banner">{lockError}</div>}
      {lockDone  && <div className="alert alert-success">Periode berhasil dikunci.</div>}

      {/* Meta info */}
      <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Cabang</p>
          <span className="chip text-xs bg-blue-500/10 text-blue-400">{period.branch.code}</span>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Dibuka</p>
          <p className="text-[var(--text-secondary)]">
            {new Date(period.openedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        {isLocked && (
          <div>
            <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Dikunci</p>
            <p className="text-[var(--text-secondary)]">
              {new Date(period.lockedAt!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] mb-0.5">Variance Status</p>
          <span className={`font-semibold text-sm ${varianceColor(maxVariance)}`}>
            {maxVariance === 0 ? "✓ Seimbang" : maxVariance <= 5 ? "⚠ Selisih Kecil" : "✗ Selisih Besar"}
          </span>
        </div>
      </div>

      {/* Variance alert banner */}
      {maxVariance > 0 && (
        <div className={`alert ${maxVariance <= 5 ? "alert-warning" : "alert-error"}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <p className="font-semibold">Ditemukan Selisih</p>
            <p className="text-sm mt-0.5">
              Selisih terbesar: {fmtNum(maxVariance)} tabung. Periksa data transaksi sebelum mengunci.
            </p>
          </div>
        </div>
      )}

      {maxVariance === 0 && (
        <div className="alert alert-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <p>Tidak ada selisih — data rekonsiliasi seimbang.</p>
        </div>
      )}

      {/* Figure Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FigureTable
          label="Tabung 12 kg"
          figs={{
            openingFull:          figures.openingFull12,
            openingEmpty:         figures.openingEmpty12,
            inboundFull:          figures.inboundFull12,
            outboundFull:         figures.outboundFull12,
            returnedEmpty:        figures.returnedEmpty12,
            writeoffQty:          figures.writeoffQty12,
            computedClosingFull:  figures.computedClosingFull12,
            computedClosingEmpty: figures.computedClosingEmpty12,
            actualClosingFull:    figures.actualClosingFull12,
            actualClosingEmpty:   figures.actualClosingEmpty12,
            varianceFull:         figures.varianceFull12,
            varianceEmpty:        figures.varianceEmpty12,
          }}
        />
        <FigureTable
          label="Tabung 50 kg"
          figs={{
            openingFull:          figures.openingFull50,
            openingEmpty:         figures.openingEmpty50,
            inboundFull:          figures.inboundFull50,
            outboundFull:         figures.outboundFull50,
            returnedEmpty:        figures.returnedEmpty50,
            writeoffQty:          figures.writeoffQty50,
            computedClosingFull:  figures.computedClosingFull50,
            computedClosingEmpty: figures.computedClosingEmpty50,
            actualClosingFull:    figures.actualClosingFull50,
            actualClosingEmpty:   figures.actualClosingEmpty50,
            varianceFull:         figures.varianceFull50,
            varianceEmpty:        figures.varianceEmpty50,
          }}
        />
      </div>

      {/* Notes */}
      {period.notes && (
        <div className="card p-4">
          <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Catatan</p>
          <p className="text-sm text-[var(--text-secondary)]">{period.notes}</p>
        </div>
      )}

      {/* LOCKED notice */}
      {isLocked && (
        <div className="card p-4 flex items-center gap-3 border-red-500/20 bg-red-500/5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 flex-shrink-0">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div>
            <p className="font-semibold text-red-400 text-sm">Periode Terkunci</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Tidak ada DO, GR, Return, atau Write-off baru yang dapat dibuat untuk periode ini.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}