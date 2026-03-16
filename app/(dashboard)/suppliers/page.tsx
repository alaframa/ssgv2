// app/(dashboard)/suppliers/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email: string | null;
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    try {
      const res = await fetch(`/api/suppliers?${params.toString()}`);
      if (res.ok) setSuppliers(await res.json());
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Supplier</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {!loading && `${suppliers.length} supplier terdaftar`}
          </p>
        </div>
        <Link href="/suppliers/add" className="btn-pri">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Supplier
        </Link>
      </div>

      {/* Search */}
      <div className="card mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="form-input pl-9 max-w-sm"
            placeholder="Cari nama atau kode supplier…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama Supplier</th>
                <th>Telepon</th>
                <th>Email</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-[var(--surface-raised)] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state py-10">
                      <p className="empty-state-title">Tidak ada supplier ditemukan</p>
                    </div>
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="font-mono text-xs text-[var(--text-muted)]">{s.code}</span>
                    </td>
                    <td className="font-medium">{s.name}</td>
                    <td className="text-[var(--text-muted)]">{s.phone ?? "—"}</td>
                    <td className="text-[var(--text-muted)]">{s.email ?? "—"}</td>
                    <td>
                      <Link href={`/suppliers/${s.id}`} className="btn-icon" title="Lihat detail">
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
      </div>
    </div>
  );
}