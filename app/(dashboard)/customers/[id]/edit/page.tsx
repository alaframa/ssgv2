// app/(dashboard)/customers/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function CustomerEditPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
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
  const [originalName, setOriginalName] = useState("");

  // Load existing customer
  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setForm({
          name: data.name,
          customerType: data.customerType,
          phone: data.phone ?? "",
          email: data.email ?? "",
          address: data.address ?? "",
          npwp: data.npwp ?? "",
          creditLimitKg12: data.creditLimitKg12,
          creditLimitKg50: data.creditLimitKg50,
          isActive: data.isActive,
        });
        setOriginalName(data.name);
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
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
        router.push(`/customers/${id}`);
      } else if (res.status === 409) {
        setError(data.error);
      } else {
        setError(data.error ?? "Gagal menyimpan perubahan");
      }
    } catch {
      setError("Terjadi kesalahan, coba lagi");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card animate-pulse space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 bg-[var(--surface-raised)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Pelanggan tidak ditemukan</p>
            <Link href="/customers" className="btn-pri mt-4">Kembali ke Daftar</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/customers/${id}`} className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Edit Pelanggan</h1>
          <p className="text-sm text-[var(--text-muted)]">{originalName}</p>
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

        <div>
          <label className="form-label">Nama Pelanggan *</label>
          <input
            name="name"
            className="form-input"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="form-label">Tipe Pelanggan *</label>
          <select
            name="customerType"
            className="form-select"
            value={form.customerType}
            onChange={handleChange}
          >
            <option value="RETAIL">Retail</option>
            <option value="AGEN">Agen</option>
            <option value="INDUSTRI">Industri</option>
          </select>
        </div>

        <div className="section-divider" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Telepon</label>
            <input name="phone" className="form-input" value={form.phone} onChange={handleChange} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input name="email" type="email" className="form-input" value={form.email} onChange={handleChange} />
          </div>
        </div>

        <div>
          <label className="form-label">Alamat</label>
          <textarea
            name="address"
            className="form-textarea"
            rows={3}
            value={form.address}
            onChange={handleChange}
          />
        </div>

        <div>
          <label className="form-label">NPWP</label>
          <input name="npwp" className="form-input" value={form.npwp} onChange={handleChange} />
        </div>

        <div className="section-divider" />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Limit Kredit 12kg</label>
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
            <label className="form-label">Limit Kredit 50kg</label>
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

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-pri" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan…
              </span>
            ) : (
              "Simpan Perubahan"
            )}
          </button>
          <Link href={`/customers/${id}`} className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}