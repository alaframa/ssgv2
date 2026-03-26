// app/(dashboard)/users/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SkeletonTable } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  branch?: { id: string; name: string; code: string } | null;
  employee?: { id: string; displayName: string; employeeCode: string } | null;
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN:     "bg-red-500/15 text-red-400",
  BRANCH_MANAGER:  "bg-blue-500/15 text-blue-400",
  WAREHOUSE_STAFF: "bg-green-500/15 text-green-400",
  SALES_STAFF:     "bg-amber-500/15 text-amber-400",
  FINANCE:         "bg-purple-500/15 text-purple-400",
  READONLY:        "bg-gray-500/15 text-gray-400",
};

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [users,   setUsers]   = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Guard: redirect if not SUPER_ADMIN
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [status, session, router]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    try {
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "SUPER_ADMIN") {
      fetchUsers();
    }
  }, [fetchUsers, status, session]);

  if (status === "loading") return <SkeletonTable rows={6} cols={5} />;
  if (session?.user?.role !== "SUPER_ADMIN") return null;

  return (
    <div className="space-y-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">Manajemen User</h1>
          <p className="page-desc">
            {!loading && `${users.length} akun terdaftar`}
          </p>
        </div>
        <Link href="/users/add" className="btn-pri">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Tambah User
        </Link>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="input-field pl-9"
            placeholder="Cari nama atau email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : users.length === 0 ? (
        <div className="card">
          <EmptyState
            title={search ? `Tidak ada hasil untuk "${search}"` : "Belum ada user"}
            description={search ? "Coba kata kunci lain." : "Tambah user pertama untuk memberi akses sistem."}
            actionLabel={search ? undefined : "Tambah User"}
            actionHref={search ? undefined : "/users/add"}
          />
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Email</th>
                <th>Role</th>
                <th>Cabang</th>
                <th>Status</th>
                <th>Karyawan</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="table-row">
                  <td className="font-semibold text-[var(--text-primary)]">{u.name}</td>
                  <td className="text-[var(--text-secondary)] font-mono text-xs">{u.email}</td>
                  <td>
                    <span className={`chip text-xs ${ROLE_COLORS[u.role] ?? "chip-default"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="text-[var(--text-secondary)]">
                    {u.branch ? (
                      <span className="chip chip-info text-xs">{u.branch.code}</span>
                    ) : (
                      <span className="text-[var(--text-muted)] text-xs">Semua</span>
                    )}
                  </td>
                  <td>
                    <span className={`chip text-xs ${u.isActive ? "chip-success" : "bg-red-500/10 text-red-400"}`}>
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td className="text-[var(--text-muted)] text-xs">
                    {u.employee?.displayName ?? "—"}
                  </td>
                  <td className="text-right">
                    <Link
                      href={`/users/${u.id}/edit`}
                      className="btn-gho py-1 px-3 text-xs"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}