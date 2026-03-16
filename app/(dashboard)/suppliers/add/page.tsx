// app/(dashboard)/suppliers/add/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SupplierAddPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    code: "",
    name: "",
    npwp: "",
    address: "",
    phone: "",
    email: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/suppliers", {
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
        router.push(`/suppliers/${data.id}`);
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
      <div className="flex items-center gap-3 mb-6">
        <Link href="/suppliers" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Tambah Supplier</h1>
          <p className="text-sm text-[var(--text-muted)]">Daftarkan supplier baru</p>
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
          <label className="form-label">Kode Supplier *</label>
          <input
            name="code"
            className="form-input uppercase"
            placeholder="Contoh: ARSYGAS"
            value={form.code}
            onChange={handleChange}
            required
            maxLength={20}
          />
          <p className="form-hint">Kode unik, akan diuppercase otomatis</p>
        </div>

        <div>
          <label className="form-label">Nama Supplier *</label>
          <input
            name="name"
            className="form-input"
            placeholder="PT. Arsygas Nix Indonesia"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="section-divider" />

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
              value={form.email}
              onChange={handleChange}
            />
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
          <input
            name="npwp"
            className="form-input"
            placeholder="XX.XXX.XXX.X-XXX.XXX"
            value={form.npwp}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-pri" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan…
              </span>
            ) : (
              "Simpan Supplier"
            )}
          </button>
          <Link href="/suppliers" className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}