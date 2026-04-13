// app/(dashboard)/delivery/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import Link from "next/link";

type Do = {
  id: string;
  doNumber: string;
  status: string;
  supplierPoRef: string | null;
  vehicleNo: string | null;
  kg12Released: number;
  kg50Released: number;
  kg12Delivered: number;
  kg50Delivered: number;
  doDate: string;
  deliveredAt: string | null;
  createdAt: string;
  customerPo: {
    poNumber: string;
    customer: { id: string; name: string; code: string };
  };
  branch: { code: string; name: string };
  driver: { id: string; displayName: string } | null;
  kenek: { id: string; displayName: string } | null;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-neutral",
  IN_TRANSIT: "badge-blue",
  DELIVERED: "badge-green",
  PARTIAL: "badge-amber",
  CANCELLED: "badge-red",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_TRANSIT: "Di Jalan",
  DELIVERED: "Terkirim",
  PARTIAL: "Sebagian",
  CANCELLED: "Dibatalkan",
};

export default function DeliveryPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [orders, setOrders] = useState<Do[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (activeBranchId) params.set("branchId", activeBranchId);
      if (status) params.set("status", status);
      if (date) params.set("date", date);

      const res = await fetch(`/api/delivery-orders?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const data = await res.json();
      setOrders(data.records);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page, status, date]);

  useEffect(() => {
    setPage(1);
  }, [activeBranchId, status, date]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const tonase = (kg12: number, kg50: number) => kg12 * 12 + kg50 * 50;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Delivery Orders</h1>
          <p className="page-desc">Kelola pengiriman gas LPG ke pelanggan</p>
        </div>


          <Link href="/delivery/bulk-upload" className="btn-gho">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
    Bulk Upload</Link>
        
        <Link href="/delivery/add" className="btn-pri">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Buat DO
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
            <option value="PENDING">Pending</option>
            <option value="IN_TRANSIT">Di Jalan</option>
            <option value="DELIVERED">Terkirim</option>
            <option value="PARTIAL">Sebagian</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input-field w-44"
          />
          {date && (
            <button onClick={() => setDate("")} className="btn-gho text-sm py-1">
              ✕ Reset Tanggal
            </button>
          )}
          <div className="ml-auto text-sm text-[var(--text-muted)] self-center">
            {total} DO ditemukan
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. DO</th>
                <th>Pelanggan</th>
                <th>Driver</th>
                <th>Rls 12kg</th>
                <th>Rls 50kg</th>
                <th>Tonase</th>
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
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state py-10">
                      <p className="empty-state-title">Belum ada Delivery Order</p>
                      <p className="empty-state-desc">Buat DO baru dari Customer PO yang sudah CONFIRMED</p>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((do_) => (
                  <tr
                    key={do_.id}
                    className="cursor-pointer hover:bg-[var(--surface-hover)]"
                    onClick={() => router.push(`/delivery/${do_.id}`)}
                  >
                    <td>
                      <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                        {do_.doNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div className="font-medium text-[var(--text-primary)]">
                          {do_.customerPo.customer.name}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {do_.customerPo.poNumber}
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">
                      {do_.driver
                        ? `${do_.driver.displayName}${do_.kenek ? `/${do_.kenek.displayName}` : ""}`
                        : <span className="text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="text-right font-mono">{do_.kg12Released || "—"}</td>
                    <td className="text-right font-mono">{do_.kg50Released || "—"}</td>
                    <td className="text-right font-mono text-sm">
                      {tonase(do_.kg12Released, do_.kg50Released).toLocaleString()} kg
                    </td>
                    <td>
                      <span className={STATUS_BADGE[do_.status] ?? "badge-neutral"}>
                        {STATUS_LABEL[do_.status] ?? do_.status}
                      </span>
                    </td>
                    <td className="text-[var(--text-muted)] text-sm">
                      {new Date(do_.doDate).toLocaleDateString("id-ID", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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