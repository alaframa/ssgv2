// app/(dashboard)/employees/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface EmployeeRole {
  id: string;
  role: string;
  assignedAt: string;
  notes: string | null;
}

interface Employee {
  id: string;
  employeeCode: string;
  fullName: string;
  displayName: string;
  isActive: boolean;
  joinDate: string | null;
  notes: string | null;
  createdAt: string;
  branch: { id: string; code: string; name: string };
  roles: EmployeeRole[];
  user: { id: string; email: string; name: string; role: string } | null;
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

const ALL_ROLES = [
  "DRIVER", "KENEK", "WAREHOUSE", "ADMIN",
  "FINANCE", "SALES", "BRANCH_MANAGER", "MECHANIC", "OTHER",
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-32 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] flex-1">{value ?? "—"}</span>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [roleError, setRoleError] = useState("");

  const load = async () => {
    try {
      const res = await fetch(`/api/employees/${id}`);
      if (res.ok) setEmployee(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const addRole = async (role: string) => {
    setRoleError("");
    setRoleLoading(role);
    try {
      const res = await fetch(`/api/employees/${id}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        await load();
      } else {
        setRoleError(data.error ?? "Gagal menambah role");
      }
    } finally {
      setRoleLoading(null);
    }
  };

  const removeRole = async (role: string) => {
    setRoleError("");
    setRoleLoading(role);
    try {
      const res = await fetch(`/api/employees/${id}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok) {
        await load();
      } else {
        setRoleError(data.error ?? "Gagal menghapus role");
      }
    } finally {
      setRoleLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-4 bg-[var(--surface-raised)] rounded" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Karyawan tidak ditemukan</p>
            <Link href="/employees" className="btn-pri mt-4">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  const currentRoles = new Set(employee.roles.map((r) => r.role));
  const addableRoles = ALL_ROLES.filter((r) => !currentRoles.has(r));

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/employees" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="page-title">{employee.displayName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-[var(--text-muted)]">{employee.employeeCode}</span>
              <span className="badge-neutral">{employee.branch.code}</span>
              {employee.isActive
                ? <span className="badge-success">Aktif</span>
                : <span className="badge-error">Nonaktif</span>}
            </div>
          </div>
        </div>
        <Link href={`/employees/${id}/edit`} className="btn-gho">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </Link>
      </div>

      {/* Info Card */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Informasi Karyawan
        </h2>
        <div className="section-divider mt-2" />
        <InfoRow label="Nama Lengkap" value={employee.fullName} />
        <InfoRow label="Display Name" value={
          <span className="font-bold">{employee.displayName}</span>
        } />
        <InfoRow label="Cabang" value={
          <span className="badge-neutral">{employee.branch.code} — {employee.branch.name}</span>
        } />
        <InfoRow label="Bergabung" value={
          employee.joinDate
            ? new Date(employee.joinDate).toLocaleDateString("id-ID", {
                day: "numeric", month: "long", year: "numeric",
              })
            : null
        } />
        <InfoRow label="Catatan" value={employee.notes} />
        <InfoRow label="Terdaftar" value={
          new Date(employee.createdAt).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
          })
        } />
      </div>

      {/* Roles Card */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
          Role & Jabatan
        </h2>

        {roleError && (
          <div className="mb-3 px-3 py-2 rounded-lg text-sm text-[var(--error)]
            bg-[var(--error-bg)] border border-red-200">
            {roleError}
          </div>
        )}

        {/* Current roles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {employee.roles.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5">
              <span className={`${ROLE_BADGE[r.role] ?? "badge-neutral"} pr-1`}>
                {ROLE_LABELS[r.role] ?? r.role}
                <button
                  onClick={() => removeRole(r.role)}
                  disabled={roleLoading === r.role || employee.roles.length <= 1}
                  className="ml-1.5 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed
                    transition-colors"
                  title="Hapus role ini"
                >
                  {roleLoading === r.role ? (
                    <span className="w-2.5 h-2.5 border border-current border-t-transparent
                      rounded-full animate-spin inline-block" />
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                </button>
              </span>
            </div>
          ))}
        </div>

        {/* Add role */}
        {addableRoles.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Tambah Role
            </p>
            <div className="flex flex-wrap gap-2">
              {addableRoles.map((role) => (
                <button
                  key={role}
                  onClick={() => addRole(role)}
                  disabled={!!roleLoading}
                  className="btn-gho py-1 px-2.5 text-xs disabled:opacity-50"
                >
                  {roleLoading === role ? (
                    <span className="w-3 h-3 border border-current border-t-transparent
                      rounded-full animate-spin" />
                  ) : (
                    <>+ {ROLE_LABELS[role] ?? role}</>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Linked User Account */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
          Akun Sistem
        </h2>
        {employee.user ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/10 flex items-center
              justify-center shrink-0">
              <span className="text-sm font-bold text-[var(--accent)]">
                {employee.user.name[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{employee.user.name}</p>
              <p className="text-xs text-[var(--text-muted)]">{employee.user.email}</p>
            </div>
            <span className="badge-info ml-auto">{employee.user.role}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[var(--text-muted)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="text-sm">Belum terhubung ke akun sistem</span>
          </div>
        )}
      </div>
    </div>
  );
}