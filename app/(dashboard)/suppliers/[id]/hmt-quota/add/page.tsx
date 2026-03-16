// app/(dashboard)/suppliers/[id]/hmt-quota/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Branch { id: string; code: string; name: string; }

const MONTH_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function HmtQuotaAddPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const now = new Date();
  const [form, setForm] = useState({
    branchId: "",
    cylinderSize: "KG12",
    periodMonth: now.getMonth() + 1,
    periodYear: now.getFullYear(),
    quotaQty: 0,
    pricePerUnit: 0,
  });

  useEffect(() => {
    // Load branches
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => {
        setBranches(data);
        // Pre-select: SUPER_ADMIN defaults to first, others to their own
        if (session?.user?.role !== "SUPER_ADMIN" && session?.user?.branchId) {
          const match = data.find((b) => b.id === session.user.branchId);
          if (match) setForm((f) => ({ ...f, branchId: match.id }));
        } else if (data.length > 0) {
          setForm((f) => ({ ...f, branchId: data[0].id }));
        }
      })
      .catch(console.error);

    // Load supplier name
    fetch(`/api/suppliers/${id}`)
      .then((r) => r.json())
      .then((data) => setSupplierName(data.name ?? ""))
      .catch(console.error);
  }, [id, session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === "number" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch(`/api/suppliers/${id}/hmt-quota`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(
          `Quota berhasil disimpan: ${form.quotaQty} tabung ${form.cylinderSize} ` +
          `untuk ${MONTH_NAMES[form.periodMonth]} ${form.periodYear}`
        );
        // Reset qty/price for next entry
        setForm((f) => ({ ...f, quotaQty: 0, pricePerUnit: 0 }));
      } else {
        setError(data.error ?? "Gagal menyimpan quota");
      }
    } catch {
      setError("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const currentYear = now.getFullYear();
  const years = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/suppliers/${id}`} className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Set HMT Quota</h1>
          <p className="text-sm text-[var(--text-muted)]">{supplierName}</p>
        </div>
      </div>

      <div className="card mb-4 bg-[var(--info-bg)] border-blue-200">
        <div className="flex items-start gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--info)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="text-sm text-[var(--info)]">
            Jika quota untuk periode + cabang + ukuran yang sama sudah ada, nilainya akan diperbarui (upsert).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
            text-[var(--error)] bg-[var(--error-bg)] border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm
            text-[var(--success)] bg-[var(--success-bg)] border border-green-200">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {success}
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
              value={branches.find((b) => b.id === form.branchId)?.code ?? "—"}
              disabled
            />
          )}
        </div>

        {/* Period: Month + Year */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Bulan *</label>
            <select
              name="periodMonth"
              className="form-select"
              value={form.periodMonth}
              onChange={handleChange}
              required
            >
              {MONTH_NAMES.slice(1).map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Tahun *</label>
            <select
              name="periodYear"
              className="form-select"
              value={form.periodYear}
              onChange={handleChange}
              required
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Cylinder Size */}
        <div>
          <label className="form-label">Ukuran Tabung *</label>
          <div className="flex gap-3">
            {(["KG12", "KG50"] as const).map((size) => (
              <label
                key={size}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-semibold transition-all
                  ${form.cylinderSize === size
                    ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)]"
                  }`}
              >
                <input
                  type="radio"
                  name="cylinderSize"
                  value={size}
                  className="hidden"
                  checked={form.cylinderSize === size}
                  onChange={handleChange}
                />
                {size === "KG12" ? "12 kg" : "50 kg"}
              </label>
            ))}
          </div>
        </div>

        <div className="section-divider" />

        {/* Qty */}
        <div>
          <label className="form-label">Jumlah Quota (tabung) *</label>
          <input
            name="quotaQty"
            type="number"
            min={0}
            className="form-input"
            value={form.quotaQty}
            onChange={handleChange}
            required
          />
        </div>

        {/* Price */}
        <div>
          <label className="form-label">Harga per Tabung (Rp) *</label>
          <input
            name="pricePerUnit"
            type="number"
            min={0}
            step={0.01}
            className="form-input"
            value={form.pricePerUnit}
            onChange={handleChange}
            required
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-pri" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Menyimpan…
              </span>
            ) : "Simpan Quota"}
          </button>
          <Link href={`/suppliers/${id}`} className="btn-gho">Kembali</Link>
        </div>
      </form>
    </div>
  );
}