// app/(dashboard)/recon/add/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import FormPageLayout from "@/components/FormPageLayout";

const MONTH_NAMES = [
  "", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function ReconAddPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const now = new Date();
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [year,   setYear]   = useState(now.getFullYear());
  const [notes,  setNotes]  = useState("");
  const [error,  setError]  = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!activeBranchId) {
      setError("Pilih cabang terlebih dahulu");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/recon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId: activeBranchId,
          month,
          year,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuka periode");
        return;
      }
      router.push(`/recon/${data.id}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPageLayout backHref="/recon" title="Buka Periode Rekonsiliasi">
      <form onSubmit={handleSubmit} className="form-card max-w-md">
        {error && <div className="form-error-banner">{error}</div>}

        <div className="form-group">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">Bulan</label>
          <select
            className="input-field"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            required
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">Tahun</label>
          <select
            className="input-field"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            required
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="text-sm font-semibold text-[var(--text-secondary)]">Catatan (opsional)</label>
          <textarea
            className="input-field"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Catatan rekonsiliasi..."
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" className="btn-pri" disabled={saving}>
            {saving ? (
              <><div className="spinner spinner-sm" /> Menyimpan...</>
            ) : (
              "Buka Periode"
            )}
          </button>
          <button type="button" className="btn-gho" onClick={() => router.back()}>
            Batal
          </button>
        </div>
      </form>
    </FormPageLayout>
  );
}