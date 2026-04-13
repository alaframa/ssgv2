// app/(dashboard)/customers/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";

interface Branch { code: string; name: string; }
interface Customer {
  id: string;
  code: string;
  name: string;
  customerType: string;
  phone: string | null;
  isActive: boolean;
  branch: Branch;
}

const TYPE_LABELS: Record<string, string> = {
  RETAIL: "Retail",
  AGEN: "Agen",
  INDUSTRI: "Industri",
};

const TYPE_BADGE: Record<string, string> = {
  RETAIL: "badge-info",
  AGEN: "badge-purple",
  INDUSTRI: "badge-warning",
};

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function CustomersPage() {
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterType) params.set("type", filterType);
    if (filterStatus) params.set("isActive", filterStatus === "active" ? "true" : filterStatus === "inactive" ? "false" : "");
    if (activeBranchId && session?.user?.role === "SUPER_ADMIN") {
      params.set("branchId", activeBranchId);
    }
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.data ?? []);
        setTotal(data.meta?.total ?? 0);
        setPages(data.meta?.totalPages ?? 1);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterType, filterStatus, activeBranchId, page, session?.user?.role]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterType, filterStatus, activeBranchId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Pelanggan</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {total > 0 ? `${total} pelanggan terdaftar` : "Memuat data…"}
          </p>
        </div>
        <div className="flex gap-2">
  <Link href="/customers/bulk-upload" className="btn-gho">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
    Bulk Upload
  </Link>
  <Link href="/customers/add" className="btn-pri">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
    Tambah Pelanggan
  </Link>
</div>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="form-input pl-9"
              placeholder="Cari nama atau kode pelanggan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Type filter */}
          <select
            className="form-select w-auto min-w-[140px]"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Semua Tipe</option>
            <option value="RETAIL">Retail</option>
            <option value="AGEN">Agen</option>
            <option value="INDUSTRI">Industri</option>
          </select>

          {/* Status filter */}
          <select
            className="form-select w-auto min-w-[140px]"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Pelanggan</th>
                <th>Tipe</th>
                <th>Cabang</th>
                <th>Telepon</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-[var(--surface-raised)] rounded animate-pulse w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state py-10">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      <p className="empty-state-title">Tidak ada pelanggan ditemukan</p>
                      <p className="empty-state-desc">
                        {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data pelanggan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="font-mono text-xs text-[var(--text-muted)]">{c.code}</span>
                    </td>
                    <td className="font-medium text-[var(--text-primary)]">{c.name}</td>
                    <td>
                      <span className={TYPE_BADGE[c.customerType] ?? "badge-neutral"}>
                        {TYPE_LABELS[c.customerType] ?? c.customerType}
                      </span>
                    </td>
                    <td>
                      <span className="badge-neutral">{c.branch.code}</span>
                    </td>
                    <td className="text-[var(--text-muted)]">{c.phone ?? "—"}</td>
                    <td>
                      {c.isActive
                        ? <span className="badge-success">Aktif</span>
                        : <span className="badge-error">Nonaktif</span>}
                    </td>
                    <td>
                      <Link
                        href={`/customers/${c.id}`}
                        className="btn-icon"
                        title="Lihat detail"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </Link>
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
            <p className="text-sm text-[var(--text-muted)]">
              Halaman {page} dari {pages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                className="btn-gho py-1.5 px-3 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Sebelumnya
              </button>
              <button
                className="btn-gho py-1.5 px-3 text-xs"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
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