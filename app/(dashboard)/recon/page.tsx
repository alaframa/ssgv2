// app/(dashboard)/recon/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

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

const MONTH_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReconPage() {
  const { activeBranchId } = useBranch();
  const [periods, setPeriods] = useState<ReconPeriod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = activeBranchId ? `?branchId=${activeBranchId}` : "";
      const res = await fetch(`/api/recon${q}`);
      if (!res.ok) throw new Error("Gagal memuat data rekonsiliasi");
      const d = await res.json();
      setPeriods(d.periods ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Rekonsiliasi Bulanan</h1>
          <p className="page-desc">Tutup buku dan kunci periode per cabang</p>
        </div>
        <Link href="/recon/add" className="btn-pri text-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5"  y1="12" x2="19" y2="12"/>
          </svg>
          Buka Periode Baru
        </Link>
      </div>

      {error   && <div className="form-error-banner">{error}</div>}
      {loading && (
        <div className="flex items-center gap-3 py-10 justify-center text-[var(--text-muted)]">
          <div className="spinner" />
          <span>Memuat...</span>
        </div>
      )}

      {!loading && periods.length === 0 && (
        <div className="empty-state card">
          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
          <p className="empty-state-title">Belum ada periode</p>
          <p className="empty-state-desc">Buka periode rekonsiliasi pertama untuk cabang ini</p>
          <Link href="/recon/add" className="btn-pri text-sm mt-4">Buka Periode</Link>
        </div>
      )}

      {!loading && periods.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Cabang</th>
                  <th>Status</th>
                  <th>Dibuka</th>
                  <th>Dikunci</th>
                  <th>Catatan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold text-[var(--text-primary)]">
                      {MONTH_NAMES[p.month]} {p.year}
                    </td>
                    <td>
                      <span className="chip text-xs bg-blue-500/10 text-blue-400">{p.branch.code}</span>
                    </td>
                    <td>
                      {p.status === "LOCKED" ? (
                        <span className="chip text-xs bg-red-500/10 text-red-400 flex items-center gap-1 w-fit">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                          LOCKED
                        </span>
                      ) : (
                        <span className="chip text-xs bg-green-500/10 text-green-400 flex items-center gap-1 w-fit">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <polyline points="12 6 12 12 16 14"/>
                          </svg>
                          OPEN
                        </span>
                      )}
                    </td>
                    <td className="text-sm text-[var(--text-muted)]">
                      {new Date(p.openedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="text-sm text-[var(--text-muted)]">
                      {p.lockedAt
                        ? new Date(p.lockedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="text-xs text-[var(--text-muted)] max-w-[160px] truncate">
                      {p.notes ?? "—"}
                    </td>
                    <td>
                      <Link href={`/recon/${p.id}`} className="btn-gho text-xs px-3 py-1.5">
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}