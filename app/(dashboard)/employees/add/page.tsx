// app/(dashboard)/employees/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";

interface Branch { id: string; code: string; name: string; }

const ALL_ROLES = [
  { value: "DRIVER", label: "Driver" },
  { value: "KENEK", label: "Kenek" },
  { value: "WAREHOUSE", label: "Gudang" },
  { value: "ADMIN", label: "Admin" },
  { value: "FINANCE", label: "Finance" },
  { value: "SALES", label: "Sales" },
  { value: "BRANCH_MANAGER", label: "Kepala Cabang" },
  { value: "MECHANIC", label: "Mekanik" },
  { value: "OTHER", label: "Lainnya" },
];

export default function EmployeeAddPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    branchId: "",
    fullName: "",
    displayName: "",
    joinDate: "",
    notes: "",
    isActive: true,
  });
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["DRIVER"]);

  // Load branches
  useEffect(() => {
    if (session?.user?.role === "SUPER_ADMIN") {
      fetch("/api/branches")
        .then((r) => r.json())
        .then((data: Branch[]) => setBranches(data))
        .catch(console.error);
    }
  }, [session?.user?.role]);

  // Auto-set branchId from context
  useEffect(() => {
    if (activeBranchId && !form.branchId) {
      setForm((f) => ({ ...f, branchId: activeBranchId }));
    }
  }, [activeBranchId, form.branchId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role)
        ? prev.length > 1 ? prev.filter((r) => r !== role) : prev // keep at least one
        : [...prev, role]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length === 0) {
      setError("Pilih minimal satu role");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          displayName: form.displayName || form.fullName,
          roles: selectedRoles,
          joinDate: form.joinDate || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/employees/${data.id}`);
      } else if (data.error?.fieldErrors) {
        const first = Object.values(data.error.fieldErrors as Record<string, string[]>)[0];
        setError(Array.isArray(first) ? first[0] : "Validasi gagal");
      } else {
        setError(data.error ?? "Gagal menyimpan");
      }
    } catch {
      setError("Terjadi kesalahan, coba lagi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/employees" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Tambah Karyawan</h1>
          <p className="text-sm text-[var(--text-muted)]">Kode karyawan di-generate otomatis</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
            text-[var(--error)] bg-[var(--error-bg)] border border-red-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Branch */}
        <div>
          <label className="form-label">Cabang *</label>
          {session?.user?.role === "SUPER_ADMIN" ? (
            <select
              name="branchId"
              className="form-select"
              value={form.branchId}
              onChange={handleChange}
              required
            >
              <option value="">Pilih Cabang</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
              ))}
            </select>
          ) : (
            <input
              className="form-input"
              value={branches.find((b) => b.id === form.branchId)?.code ?? activeBranchId ?? "—"}
              disabled
            />
          )}
        </div>

        {/* Full Name */}
        <div>
          <label className="form-label">Nama Lengkap *</label>
          <input
            name="fullName"
            className="form-input"
            placeholder="Contoh: Rudi Hartono"
            value={form.fullName}
            onChange={handleChange}
            required
          />
        </div>

        {/* Display Name */}
        <div>
          <label className="form-label">Display Name *</label>
          <input
            name="displayName"
            className="form-input uppercase"
            placeholder="Contoh: RUDI (dipakai di DO)"
            value={form.displayName}
            onChange={handleChange}
            required
          />
          <p className="form-hint">Nama pendek yang muncul di Delivery Order. Kosongkan = sama dengan nama lengkap.</p>
        </div>

        {/* Roles */}
        <div>
          <label className="form-label">Role * (pilih satu atau lebih)</label>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {ALL_ROLES.map(({ value, label }) => {
              const selected = selectedRoles.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleRole(value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium
                    transition-all duration-100 text-left
                    ${selected
                      ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                      : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    }`}
                >
                  <span className={`w-4 h-4 rounded flex items-center justify-center border-2 shrink-0
                    ${selected ? "border-[var(--accent)] bg-[var(--accent)]" : "border-current"}`}>
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
          <p className="form-hint">Role pertama yang dipilih menentukan prefix kode karyawan</p>
        </div>

        <div className="section-divider" />

        {/* Join Date */}
        <div>
          <label className="form-label">Tanggal Bergabung</label>
          <input
            name="joinDate"
            type="date"
            className="form-input"
            value={form.joinDate}
            onChange={handleChange}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Catatan</label>
          <textarea
            name="notes"
            className="form-textarea"
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            value={form.notes}
            onChange={handleChange}
          />
        </div>

        {/* Status */}
        <div className="flex items-center gap-3">
          <input
            id="isActive"
            name="isActive"
            type="checkbox"
            className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)]"
            checked={form.isActive}
            onChange={handleChange}
          />
          <label htmlFor="isActive" className="text-sm text-[var(--text-secondary)] cursor-pointer">
            Karyawan Aktif
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-pri" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan…
              </span>
            ) : "Simpan Karyawan"}
          </button>
          <Link href="/employees" className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}