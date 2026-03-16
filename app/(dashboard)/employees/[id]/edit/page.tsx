// app/(dashboard)/employees/[id]/edit/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function EmployeeEditPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    displayName: "",
    joinDate: "",
    notes: "",
    isActive: true,
  });
  const [originalName, setOriginalName] = useState("");

  useEffect(() => {
    fetch(`/api/employees/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setForm({
          fullName: data.fullName ?? "",
          displayName: data.displayName ?? "",
          joinDate: data.joinDate
            ? new Date(data.joinDate).toISOString().slice(0, 10)
            : "",
          notes: data.notes ?? "",
          isActive: data.isActive,
        });
        setOriginalName(data.displayName ?? data.fullName ?? "");
      })
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          joinDate: form.joinDate || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        router.push(`/employees/${id}`);
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
          {[1, 2, 3, 4].map((i) => (
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
            <p className="empty-state-title">Karyawan tidak ditemukan</p>
            <Link href="/employees" className="btn-pri mt-4">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/employees/${id}`} className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Edit Karyawan</h1>
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
          <label className="form-label">Nama Lengkap *</label>
          <input
            name="fullName"
            className="form-input"
            value={form.fullName}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label className="form-label">Display Name *</label>
          <input
            name="displayName"
            className="form-input uppercase"
            value={form.displayName}
            onChange={handleChange}
            required
          />
          <p className="form-hint">Nama pendek yang dipakai di Delivery Order</p>
        </div>

        <div className="section-divider" />

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

        <div>
          <label className="form-label">Catatan</label>
          <textarea
            name="notes"
            className="form-textarea"
            rows={3}
            value={form.notes}
            onChange={handleChange}
          />
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
            Karyawan Aktif
          </label>
        </div>

        <div className="card-sm bg-[var(--info-bg)] border-blue-200">
          <p className="text-xs text-[var(--info)]">
            <strong>Catatan:</strong> Untuk mengelola role karyawan, gunakan halaman detail karyawan.
          </p>
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
          <Link href={`/employees/${id}`} className="btn-gho">Batal</Link>
        </div>
      </form>
    </div>
  );
}