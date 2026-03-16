// app/(dashboard)/gasback/claims/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface ClaimRecord {
  id: string;
  claimNumber: string;
  qty: number;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentRef: string | null;
  createdAt: string;
  customer: { id: string; code: string; name: string };
  branch: { code: string };
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function GasbackClaimsPage() {
  const { activeBranchId } = useBranch();

  const [records, setRecords] = useState<ClaimRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [pages,   setPages]   = useState(1);
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        branchId: activeBranchId,
        page: String(page),
        limit: "30",
      });
      if (filter !== "") params.set("isPaid", filter);

      const res = await fetch(`/api/gasback/claims?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data klaim");
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page, filter]);

  useEffect(() => { setPage(1); }, [activeBranchId, filter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/gasback" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <h1 className="page-title">Klaim Gasback</h1>
            <p className="page-desc">{total} total klaim</p>
          </div>
        </div>
        <Link href="/gasback/claims/add" className="btn-pri">
          + Klaim Baru
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {([["", "Semua"], ["false", "Belum Dibayar"], ["true", "Sudah Dibayar"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === val
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="form-error-banner">{error}</div>}

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-10 bg-[var(--surface-raised)] rounded animate-pulse"/>
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state py-12">
            <p className="empty-state-title">Tidak ada klaim</p>
            <p className="empty-state-desc">Buat klaim baru untuk pelanggan yang saldo gasbacknya cukup</p>
            <Link href="/gasback/claims/add" className="btn-pri mt-4">
              + Klaim Baru
            </Link>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Klaim</th>
                  <th>Pelanggan</th>
                  <th className="num">Qty (kg)</th>
                  <th className="num">Jumlah</th>
                  <th>Status</th>
                  <th>Dibuat</th>
                  <th>Dibayar</th>
                  <th>Ref Bayar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono font-semibold text-[var(--text-primary)]">
                      {r.claimNumber}
                    </td>
                    <td>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{r.customer.name}</p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">{r.customer.code}</p>
                      </div>
                    </td>
                    <td className="num font-mono text-sm">{fmt(Number(r.qty))}</td>
                    <td className="num font-mono text-sm font-semibold">{fmt(Number(r.amount))}</td>
                    <td>
                      {r.isPaid ? (
                        <span className="chip text-xs bg-green-500/10 text-green-400">✓ Lunas</span>
                      ) : (
                        <span className="chip text-xs bg-amber-500/10 text-amber-400">⏳ Pending</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{fmtDate(r.createdAt)}</td>
                    <td className="text-xs text-[var(--text-muted)]">{fmtDate(r.paidAt)}</td>
                    <td className="text-xs text-[var(--text-muted)] max-w-[100px] truncate">
                      {r.paymentRef ?? "—"}
                    </td>
                    <td>
                      <Link
                        href={`/gasback/claims/${r.id}`}
                        className="text-xs text-[var(--accent)] hover:underline"
                      >
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1} className="btn-gho text-sm">
            ← Sebelumnya
          </button>
          <span className="text-sm text-[var(--text-muted)]">Hal {page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages} className="btn-gho text-sm">
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  );
}