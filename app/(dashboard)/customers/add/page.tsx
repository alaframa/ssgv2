// app/(dashboard)/customers/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";
import { useSession } from "next-auth/react";

interface Branch { id: string; code: string; name: string; }

export default function CustomerAddPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    branchId: "",
    name: "",
    customerType: "RETAIL",
    phone: "",
    email: "",
    address: "",
    npwp: "",
    creditLimitKg12: 0,
    creditLimitKg50: 0,
    isActive: true,
  });

  // Load branches (for SUPER_ADMIN)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox"
        ? (e.target as HTMLInputElement).checked
        : type === "number"
        ? parseInt(value) || 0
        : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          email: form.email || null,
          phone: form.phone || null,
          address: form.address || null,
          npwp: form.npwp || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/customers/${data.id}`);
      } else if (res.status === 409) {
        setError(data.error);
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
        <Link href="/customers" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Tambah Pelanggan</h1>
          <p className="text-sm text-[var(--text-muted)]">Isi semua field yang diperlukan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {/* Error banner */}
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

        {/* Branch — SUPER_ADMIN can pick, others locked */}
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

        {/* Name */}
        <div>
          <label className="form-label">Nama Pelanggan *</label>
          <input
            name="name"
            className="form-input"
            placeholder="Contoh: Waroeng Bamboe Batu"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className="form-label">Tipe Pelanggan *</label>
          <select
            name="customerType"
            className="form-select"
            value={form.customerType}
            onChange={handleChange}
            required
          >
            <option value="RETAIL">Retail</option>
            <option value="AGEN">Agen</option>
            <option value="INDUSTRI">Industri</option>
          </select>
          <p className="form-hint">Kode pelanggan akan di-generate otomatis berdasarkan tipe ini</p>
        </div>

        <div className="section-divider" />

        {/* Phone + Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Telepon</label>
            <input
              name="phone"
              className="form-input"
              placeholder="08xx-xxxx-xxxx"
              value={form.phone}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              name="email"
              type="email"
              className="form-input"
              placeholder="pelanggan@email.com"
              value={form.email}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="form-label">Alamat</label>
          <textarea
            name="address"
            className="form-textarea"
            rows={3}
            placeholder="Jl. ..."
            value={form.address}
            onChange={handleChange}
          />
        </div>

        {/* NPWP */}
        <div>
          <label className="form-label">NPWP</label>
          <input
            name="npwp"
            className="form-input"
            placeholder="XX.XXX.XXX.X-XXX.XXX"
            value={form.npwp}
            onChange={handleChange}
          />
        </div>

        <div className="section-divider" />

        {/* Credit limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Limit Kredit 12kg (tabung)</label>
            <input
              name="creditLimitKg12"
              type="number"
              min={0}
              className="form-input"
              value={form.creditLimitKg12}
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="form-label">Limit Kredit 50kg (tabung)</label>
            <input
              name="creditLimitKg50"
              type="number"
              min={0}
              className="form-input"
              value={form.creditLimitKg50}
              onChange={handleChange}
            />
          </div>
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
            Pelanggan Aktif
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
            ) : (
              "Simpan Pelanggan"
            )}
          </button>
          <Link href="/customers" className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}