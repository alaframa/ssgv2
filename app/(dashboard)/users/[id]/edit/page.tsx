// app/(dashboard)/users/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Branch { id: string; name: string; code: string; }

interface UserData {
  id: string; name: string; email: string; role: string; isActive: boolean;
  branch?: { id: string; name: string; code: string } | null;
}

const ROLES = [
  "SUPER_ADMIN", "BRANCH_MANAGER", "WAREHOUSE_STAFF", "SALES_STAFF", "FINANCE", "READONLY",
];
const ROLES_NEEDING_BRANCH = [
  "BRANCH_MANAGER", "WAREHOUSE_STAFF", "SALES_STAFF", "FINANCE", "READONLY",
];

export default function EditUserPage({ params }: { params: { id: string } }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [user,      setUser]      = useState<UserData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", role: "", isActive: true, branchId: "", newPassword: "",
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/users/${params.id}`).then(r => r.json()),
      fetch("/api/branches").then(r => r.json()),
    ]).then(([u, b]) => {
      setUser(u);
      setBranches(b);
      setForm({
        name:      u.name ?? "",
        role:      u.role ?? "READONLY",
        isActive:  u.isActive ?? true,
        branchId:  u.branch?.id ?? "",
        newPassword: "",
      });
    }).catch(() => setError("Gagal memuat data"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.newPassword && form.newPassword.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name:     form.name,
        role:     form.role,
        isActive: form.isActive,
        branchId: ROLES_NEEDING_BRANCH.includes(form.role) ? form.branchId : null,
      };
      if (form.newPassword) body.password = form.newPassword;

      const res = await fetch(`/api/users/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menyimpan");
      }
      router.push("/users");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || session?.user?.role !== "SUPER_ADMIN") return null;
  if (loading) return <div className="card p-6 text-sm text-[var(--text-muted)]">Memuat…</div>;
  if (!user)   return <div className="card p-6 text-sm text-[var(--error)]">{error ?? "User tidak ditemukan"}</div>;

  const needsBranch = ROLES_NEEDING_BRANCH.includes(form.role);

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/users" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Edit User</h1>
          <p className="page-desc font-mono text-xs">{user.email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {error && <div className="form-error-banner">{error}</div>}

        <div className="form-group">
          <label className="form-label">Nama Lengkap *</label>
          <input name="name" className="input-field" required
            value={form.name} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="input-field" value={user.email} disabled />
          <p className="text-[11px] text-[var(--text-muted)]">Email tidak dapat diubah</p>
        </div>

        <div className="form-group">
          <label className="form-label">Role *</label>
          <select name="role" className="input-field" value={form.role} onChange={handleChange}>
            {ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {needsBranch && (
          <div className="form-group">
            <label className="form-label">Cabang *</label>
            <select name="branchId" className="input-field" value={form.branchId} onChange={handleChange}>
              <option value="">-- Pilih Cabang --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Status Akun</label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-[var(--text-primary)]">Akun aktif</span>
          </label>
        </div>

        <div className="border-t border-[var(--border)] pt-4 form-group">
          <label className="form-label">Password Baru (opsional)</label>
          <input name="newPassword" type="password" className="input-field"
            value={form.newPassword} onChange={handleChange}
            placeholder="Kosongkan jika tidak ingin mengubah" />
          <p className="text-[11px] text-[var(--text-muted)]">Min. 8 karakter jika diisi</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/users" className="btn-gho flex-1 justify-center">Batal</Link>
          <button type="submit" className="btn-pri flex-1 justify-center" disabled={saving}>
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );
}