// app/(dashboard)/suppliers/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function SupplierEditPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    npwp: "",
    address: "",
    phone: "",
    email: "",
  });
  const [originalName, setOriginalName] = useState("");

  useEffect(() => {
    fetch(`/api/suppliers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setForm({
          name: data.name ?? "",
          npwp: data.npwp ?? "",
          address: data.address ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
        });
        setOriginalName(data.name ?? "");
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/suppliers/${id}`, {
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
        router.push(`/suppliers/${id}`);
      } else {
        setError(data.error ?? "Gagal menyimpan");
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 bg-[var(--surface-raised)] rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/suppliers/${id}`} className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Edit Supplier</h1>
          <p className="text-sm text-[var(--text-muted)]">{originalName}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
            text-[var(--error)] bg-[var(--error-bg)] border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="form-label">Nama Supplier *</label>
          <input
            name="name"
            className="form-input"
            value={form.name}
            onChange={handleChange}
            required
          />
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

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-pri" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan…
              </span>
            ) : "Simpan Perubahan"}
          </button>
          <Link href={`/suppliers/${id}`} className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}