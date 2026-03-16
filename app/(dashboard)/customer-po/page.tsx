// app/(dashboard)/customer-po/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import Link from "next/link";

type Cpo = {
  id: string;
  poNumber: string;
  status: string;
  channel: string | null;
  kg12Qty: number;
  kg50Qty: number;
  createdAt: string;
  customer: { id: string; name: string; code: string };
  branch: { code: string; name: string };
  _count: { deliveryOrders: number };
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-neutral",
  CONFIRMED: "badge-green",
  COMPLETED: "badge-blue",
  CANCELLED: "badge-red",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Telepon",
  WALK_IN: "Walk-in",
  SALES_VISIT: "Sales Visit",
};

export default function CustomerPoPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [cpos, setCpos] = useState<Cpo[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCpos = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (activeBranchId) params.set("branchId", activeBranchId);
      if (status) params.set("status", status);

      const res = await fetch(`/api/customer-po?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      setCpos(data.records);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page, status]);

  useEffect(() => {
    setPage(1);
  }, [activeBranchId, status]);

  useEffect(() => {
    fetchCpos();
  }, [fetchCpos]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Customer PO</h1>
          <p className="page-desc">Kelola pesanan dari pelanggan</p>
        </div>
        <Link href="/customer-po/add" className="btn-pri">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Buat CPO
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex flex-wrap gap-3 p-4">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field w-40"
          >
            <option value="">Semua Status</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="COMPLETED">Selesai</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
          <div className="ml-auto text-sm text-[var(--text-muted)] self-center">
            {total} CPO ditemukan
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. CPO</th>
                <th>Pelanggan</th>
                <th>12Kg</th>
                <th>50Kg</th>
                <th>Channel</th>
                <th>DO</th>
                <th>Status</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-[var(--surface-raised)] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : cpos.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state py-10">
                      <p className="empty-state-title">Belum ada Customer PO</p>
                      <p className="empty-state-desc">Buat CPO baru untuk memulai</p>
                    </div>
                  </td>
                </tr>
              ) : (
                cpos.map((cpo) => (
                  <tr
                    key={cpo.id}
                    className="cursor-pointer hover:bg-[var(--surface-hover)]"
                    onClick={() => router.push(`/customer-po/${cpo.id}`)}
                  >
                    <td>
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {cpo.poNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">{cpo.customer.name}</div>
                        <div className="text-xs text-[var(--text-muted)]">{cpo.customer.code}</div>
                      </div>
                    </td>
                    <td className="text-right font-mono">{cpo.kg12Qty > 0 ? cpo.kg12Qty : "—"}</td>
                    <td className="text-right font-mono">{cpo.kg50Qty > 0 ? cpo.kg50Qty : "—"}</td>
                    <td>
                      {cpo.channel ? (
                        <span className="badge-neutral text-xs">{CHANNEL_LABEL[cpo.channel] ?? cpo.channel}</span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className="font-mono text-sm">{cpo._count.deliveryOrders}</span>
                    </td>
                    <td>
                      <span className={STATUS_BADGE[cpo.status] ?? "badge-neutral"}>
                        {STATUS_LABEL[cpo.status] ?? cpo.status}
                      </span>
                    </td>
                    <td className="text-[var(--text-muted)] text-sm">
                      {new Date(cpo.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
            <span className="text-sm text-[var(--text-muted)]">Hal {page} dari {pages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-gho text-sm py-1 px-3 disabled:opacity-40"
              >
                ← Sebelumnya
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="btn-gho text-sm py-1 px-3 disabled:opacity-40"
              >
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}