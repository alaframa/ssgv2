// app/(dashboard)/users/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Branch { id: string; name: string; code: string; }

const ROLES = [
  "SUPER_ADMIN",
  "BRANCH_MANAGER",
  "WAREHOUSE_STAFF",
  "SALES_STAFF",
  "FINANCE",
  "READONLY",
];

const ROLES_NEEDING_BRANCH = [
  "BRANCH_MANAGER", "WAREHOUSE_STAFF", "SALES_STAFF", "FINANCE", "READONLY",
];

export default function AddUserPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "",
    role: "WAREHOUSE_STAFF", branchId: "",
  });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/");
    }
  }, [status, session, router]);

  useEffect(() => {
    fetch("/api/branches")
      .then(r => r.json())
      .then(setBranches)
      .catch(() => {});
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Password dan konfirmasi password tidak cocok");
      return;
    }
    if (form.password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (ROLES_NEEDING_BRANCH.includes(form.role) && !form.branchId) {
      setError("Pilih cabang untuk role ini");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:     form.name,
          email:    form.email,
          password: form.password,
          role:     form.role,
          branchId: ROLES_NEEDING_BRANCH.includes(form.role) ? form.branchId : null,
        }),
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

  const needsBranch = ROLES_NEEDING_BRANCH.includes(form.role);

  return (
    <div className="max-w-lg space-y-5">
      {/* Back */}
      <div className="flex items-center gap-3">
        <Link href="/users" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Tambah User</h1>
          <p className="page-desc">Buat akun sistem baru</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        {error && (
          <div className="form-error-banner">{error}</div>
        )}

        <div className="form-group">
          <label className="form-label">Nama Lengkap *</label>
          <input name="name" className="input-field" required
            value={form.name} onChange={handleChange} placeholder="Nama lengkap" />
        </div>

        <div className="form-group">
          <label className="form-label">Email *</label>
          <input name="email" type="email" className="input-field" required
            value={form.email} onChange={handleChange} placeholder="user@ssg.id" />
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
            <select name="branchId" className="input-field" value={form.branchId} onChange={handleChange} required>
              <option value="">-- Pilih Cabang --</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Password *</label>
          <input name="password" type="password" className="input-field" required
            value={form.password} onChange={handleChange} placeholder="Min. 8 karakter" />
        </div>

        <div className="form-group">
          <label className="form-label">Konfirmasi Password *</label>
          <input name="confirmPassword" type="password" className="input-field" required
            value={form.confirmPassword} onChange={handleChange} placeholder="Ulangi password" />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/users" className="btn-gho flex-1 justify-center">Batal</Link>
          <button type="submit" className="btn-pri flex-1 justify-center" disabled={saving}>
            {saving ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Simpan User"}
          </button>
        </div>
      </form>
    </div>
  );
}