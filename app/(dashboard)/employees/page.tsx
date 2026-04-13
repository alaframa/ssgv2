// app/(dashboard)/employees/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";

interface EmployeeRole {
  id: string;
  role: string;
}

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  displayName: string;
  isActive: boolean;
  branch: { code: string; name: string };
  roles: EmployeeRole[];
}

const ROLE_LABELS: Record<string, string> = {
  DRIVER: "Driver",
  KENEK: "Kenek",
  WAREHOUSE: "Gudang",
  ADMIN: "Admin",
  FINANCE: "Finance",
  SALES: "Sales",
  BRANCH_MANAGER: "Kepala Cabang",
  MECHANIC: "Mekanik",
  OTHER: "Lainnya",
};

const ROLE_BADGE: Record<string, string> = {
  DRIVER: "badge-info",
  KENEK: "badge-success",
  WAREHOUSE: "badge-warning",
  ADMIN: "badge-purple",
  FINANCE: "badge-neutral",
  SALES: "badge-info",
  BRANCH_MANAGER: "badge-error",
  MECHANIC: "badge-neutral",
  OTHER: "badge-neutral",
};

function useDebounce<T>(value: T, ms: number): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return d;
}

export default function EmployeesPage() {
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const debouncedSearch = useDebounce(search, 300);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (filterRole) params.set("role", filterRole);
    if (filterStatus) params.set("status", filterStatus);
    if (activeBranchId && session?.user?.role === "SUPER_ADMIN") {
      params.set("branchId", activeBranchId);
    }
    params.set("page", String(page));

    try {
      const res = await fetch(`/api/employees?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees);
        setTotal(data.total);
        setPages(data.pages);
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterRole, filterStatus, activeBranchId, page, session?.user?.role]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterRole, filterStatus, activeBranchId]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Karyawan</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            {total > 0 ? `${total} karyawan terdaftar` : "Memuat data…"}
          </p>
        </div>
          <Link href="/employees/bulk-upload" className="btn-gho">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
            Bulk Upload
          </Link>

        <Link href="/employees/add" className="btn-pri">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Karyawan
        </Link>
      </div>

      {/* Filters */}
      <div className="card mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="form-input pl-9"
              placeholder="Cari nama atau kode…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="form-select w-auto min-w-[140px]"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="">Semua Role</option>
            {Object.entries(ROLE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
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
                <th>Display Name</th>
                <th>Nama Lengkap</th>
                <th>Cabang</th>
                <th>Role</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j}>
                        <div className="h-4 bg-[var(--surface-raised)] rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state py-10">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <p className="empty-state-title">Tidak ada karyawan ditemukan</p>
                      <p className="empty-state-desc">
                        {search ? `Tidak ada hasil untuk "${search}"` : "Belum ada data karyawan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                employees.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        {e.employeeCode}
                      </span>
                    </td>
                    <td>
                      <span className="font-bold text-[var(--text-primary)]">{e.displayName}</span>
                    </td>
                    <td className="text-[var(--text-secondary)]">{e.fullName}</td>
                    <td><span className="badge-neutral">{e.branch.code}</span></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {e.roles.map((r) => (
                          <span key={r.id} className={ROLE_BADGE[r.role] ?? "badge-neutral"}>
                            {ROLE_LABELS[r.role] ?? r.role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {e.isActive
                        ? <span className="badge-success">Aktif</span>
                        : <span className="badge-error">Nonaktif</span>}
                    </td>
                    <td>
                      <Link href={`/employees/${e.id}`} className="btn-icon" title="Lihat detail">
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
              <button className="btn-gho py-1.5 px-3 text-xs" disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}>
                ← Sebelumnya
              </button>
              <button className="btn-gho py-1.5 px-3 text-xs" disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}>
                Berikutnya →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}