// app/(dashboard)/warehouse/writeoff/add/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
type WriteoffReason = "RUSAK_BERAT" | "HILANG" | "KADALUARSA_UJI" | "BOCOR_PARAH";

const REASON_LABELS: Record<WriteoffReason, { label: string; desc: string }> = {
  RUSAK_BERAT:    { label: "Rusak Berat",       desc: "Tabung penyok/kerusakan fisik serius" },
  HILANG:         { label: "Hilang",             desc: "Tabung tidak ditemukan / dicuri" },
  KADALUARSA_UJI: { label: "Kadaluarsa Uji",    desc: "Masa uji hidrostatik habis" },
  BOCOR_PARAH:    { label: "Bocor Parah",        desc: "Kebocoran tidak dapat diperbaiki" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AddWriteoffPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  // Form state
  const [writeoffNumber, setWriteoffNumber] = useState("");
  const [writeoffAt,     setWriteoffAt]     = useState(todayISO());
  const [reason,         setReason]         = useState<WriteoffReason>("RUSAK_BERAT");
  const [kg12Qty,        setKg12Qty]        = useState(0);
  const [kg50Qty,        setKg50Qty]        = useState(0);
  const [notes,          setNotes]          = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!activeBranchId) {
      setError("Pilih branch terlebih dahulu");
      return;
    }
    if (!writeoffNumber.trim()) {
      setError("Nomor write-off harus diisi");
      return;
    }
    if (kg12Qty === 0 && kg50Qty === 0) {
      setError("Minimal satu jenis tabung harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        branchId:       activeBranchId,
        writeoffNumber: writeoffNumber.trim(),
        writeoffAt,
        reason,
        kg12Qty,
        kg50Qty,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/warehouse/writeoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menyimpan write-off");
      }

      router.push("/warehouse?tab=writeoff");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/warehouse?tab=writeoff")}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Hapus Buku (Write-off)</h1>
          <p className="text-xs text-[var(--text-muted)]">Keluarkan tabung rusak/hilang dari sistem secara resmi</p>
        </div>
      </div>

      {/* Warning banner */}
      <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-amber-400 flex-shrink-0 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <p className="text-sm text-amber-300">
          Write-off mengurangi stok tabung penuh secara permanen. Pastikan data sudah diverifikasi sebelum menyimpan.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Write-off Number + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="writeoffNumber">
              Nomor Write-off <span className="text-red-400">*</span>
            </label>
            <input
              id="writeoffNumber"
              type="text"
              className="form-input"
              placeholder="mis. WO-SBY-2026-001"
              value={writeoffNumber}
              onChange={e => setWriteoffNumber(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="writeoffAt">
              Tanggal <span className="text-red-400">*</span>
            </label>
            <input
              id="writeoffAt"
              type="date"
              className="form-input"
              value={writeoffAt}
              onChange={e => setWriteoffAt(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Reason */}
        <div className="form-group">
          <label className="form-label">Alasan Write-off <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(REASON_LABELS) as WriteoffReason[]).map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                  reason === r
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-[var(--border)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors ${
                  reason === r ? "border-blue-500 bg-blue-500" : "border-[var(--border)]"
                }`}/>
                <div>
                  <p className={`text-sm font-medium ${reason === r ? "text-blue-400" : "text-[var(--text-primary)]"}`}>
                    {REASON_LABELS[r].label}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">{REASON_LABELS[r].desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quantities */}
        <div>
          <p className="form-label mb-2">Jumlah Tabung <span className="text-red-400">*</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 border border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">12 kg</p>
              <input
                type="number"
                min="0"
                className="form-input text-center text-xl font-mono"
                value={kg12Qty}
                onChange={e => setKg12Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-xs text-[var(--text-muted)] text-center">tabung</p>
            </div>
            <div className="card p-4 border border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">50 kg</p>
              <input
                type="number"
                min="0"
                className="form-input text-center text-xl font-mono"
                value={kg50Qty}
                onChange={e => setKg50Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-xs text-[var(--text-muted)] text-center">tabung</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label" htmlFor="notes">Catatan / Keterangan</label>
          <textarea
            id="notes"
            className="form-input"
            rows={3}
            placeholder="Nomor seri tabung, lokasi kejadian, dll. (opsional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Stock impact preview */}
        {(kg12Qty > 0 || kg50Qty > 0) && (
          <div className="rounded-lg bg-red-500/5 border border-red-500/20 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide">Dampak ke Stock</p>
            <div className="flex gap-6 text-sm text-[var(--text-secondary)]">
              {kg12Qty > 0 && <span>KG12 Penuh <span className="text-red-400 font-mono">−{kg12Qty}</span></span>}
              {kg50Qty > 0 && <span>KG50 Penuh <span className="text-red-400 font-mono">−{kg50Qty}</span></span>}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/warehouse?tab=writeoff")}
            className="btn-gho"
          >
            Batal
          </button>
          <button type="submit" className="btn-pri" disabled={submitting}>
            {submitting ? "Menyimpan..." : "Simpan Write-off"}
          </button>
        </div>
      </form>
    </div>
  );
}