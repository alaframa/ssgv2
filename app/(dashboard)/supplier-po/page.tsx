// app/(dashboard)/supplier-po/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PoRecord {
  id: string;
  poNumber: string;
  status: string;
  kg12Qty: number;
  kg50Qty: number;
  confirmedAt: string | null;
  createdAt: string;
  supplier: { id: string; name: string; code: string };
  branch: { code: string; name: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: "", label: "Semua Status" },
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PARTIALLY_RECEIVED", label: "Partial" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, string> = {
  DRAFT:               "bg-[var(--bg-hover)] text-[var(--text-muted)]",
  SUBMITTED:           "bg-blue-500/10 text-blue-400",
  CONFIRMED:           "bg-green-500/10 text-green-400",
  PARTIALLY_RECEIVED:  "bg-amber-500/10 text-amber-400",
  COMPLETED:           "bg-purple-500/10 text-purple-400",
  CANCELLED:           "bg-red-500/10 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:               "Draft",
  SUBMITTED:           "Submitted",
  CONFIRMED:           "Confirmed",
  PARTIALLY_RECEIVED:  "Partial",
  COMPLETED:           "Selesai",
  CANCELLED:           "Dibatalkan",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SupplierPoPage() {
  const { activeBranchId } = useBranch();

  const [records,    setRecords]    = useState<PoRecord[]>([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [page,       setPage]       = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

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
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data PO");
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page, statusFilter]);

  useEffect(() => { setPage(1); }, [activeBranchId, statusFilter]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[var(--text-primary)]">Purchase Order Supplier</h1>
            <p className="text-xs text-[var(--text-muted)]">{total} PO tercatat</p>
          </div>
        </div>
        <Link href="/supplier-po/add" className="btn-pri gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Buat PO Baru
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {!activeBranchId ? (
        <div className="empty-state py-16">
          <p className="empty-state-title">Pilih Branch</p>
          <p className="empty-state-desc">Gunakan branch switcher di atas.</p>
        </div>
      ) : loading ? (
        <div className="card p-0 animate-pulse">
          {[0,1,2,3,4].map(i => (
            <div key={i} className="flex gap-4 px-5 py-3 border-b border-[var(--border)]">
              <div className="h-4 bg-[var(--bg-hover)] rounded w-32"/>
              <div className="h-4 bg-[var(--bg-hover)] rounded w-24"/>
              <div className="h-4 bg-[var(--bg-hover)] rounded flex-1"/>
              <div className="h-4 bg-[var(--bg-hover)] rounded w-20"/>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="empty-state py-12">
          <p className="empty-state-title text-red-400">{error}</p>
          <button onClick={load} className="btn-gho mt-3 text-sm">Coba Lagi</button>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state py-16">
          <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="44" height="44"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="empty-state-title">Belum Ada PO</p>
          <p className="empty-state-desc">Buat Purchase Order pertama untuk memulai.</p>
          <Link href="/supplier-po/add" className="btn-pri mt-4 text-sm">Buat PO Pertama</Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>Supplier</th>
                  <th>Branch</th>
                  <th className="num">12 kg</th>
                  <th className="num">50 kg</th>
                  <th>Status</th>
                  <th>Tgl Dibuat</th>
                  <th>Tgl Confirm</th>
                </tr>
              </thead>
              <tbody>
                {records.map(po => (
                  <tr
                    key={po.id}
                    className="cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
                    onClick={() => window.location.href = `/supplier-po/${po.id}`}
                  >
                    <td className="font-mono font-semibold text-[var(--text-primary)]">
                      {po.poNumber}
                    </td>
                    <td>
                      <div className="text-sm text-[var(--text-primary)]">{po.supplier.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{po.supplier.code}</div>
                    </td>
                    <td>
                      <span className="chip text-xs">{po.branch.code}</span>
                    </td>
                    <td className="num font-mono">{po.kg12Qty.toLocaleString("id-ID")}</td>
                    <td className="num font-mono">{po.kg50Qty.toLocaleString("id-ID")}</td>
                    <td>
                      <span className={`chip text-xs font-medium ${STATUS_BADGE[po.status] ?? ""}`}>
                        {STATUS_LABEL[po.status] ?? po.status}
                      </span>
                    </td>
                    <td className="text-[var(--text-muted)]">{fmtDate(po.createdAt)}</td>
                    <td className="text-[var(--text-muted)]">
                      {po.confirmedAt ? fmtDate(po.confirmedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-[var(--text-muted)]">Halaman {page} dari {pages}</p>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  className="btn-gho px-3 py-1.5 disabled:opacity-40"
                >← Prev</button>
                <button
                  disabled={page === pages}
                  onClick={() => setPage(p => p + 1)}
                  className="btn-gho px-3 py-1.5 disabled:opacity-40"
                >Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}