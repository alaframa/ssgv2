// app/(dashboard)/cylinders/register/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface CylinderType {
  id: string;
  size: string;
  label: string;
  nominalTareKg: string;
  nominalFullKg: string;
}

export default function RegisterCylinderPage() {
  const router           = useRouter();
  const { activeBranchId } = useBranch();

  const [types,       setTypes]       = useState<CylinderType[]>([]);
  const [serialCode,  setSerialCode]  = useState("");
  const [size,        setSize]        = useState("KG12");
  const [tare,        setTare]        = useState("");
  const [condition,   setCondition]   = useState("GOOD");
  const [location,    setLocation]    = useState("");
  const [notes,       setNotes]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/cylinders/types")
      .then(r => r.json())
      .then(setTypes)
      .catch(console.error);
  }, []);

  const selectedType = types.find(t => t.size === size);

  async function handleSubmit() {
    setError(null);
    if (!serialCode.trim()) { setError("Nomor seri wajib diisi"); return; }
    if (!activeBranchId)    { setError("Pilih branch terlebih dahulu"); return; }
    if (types.length === 0) { setError("Konfigurasi CylinderType belum ada — buat di Settings → Jenis Tabung"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cylinders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId:     activeBranchId,
          serialCode:   serialCode.trim().toUpperCase(),
          size,
          tareWeightKg: tare ? parseFloat(tare) : undefined,
          condition,
          locationNote: location.trim() || undefined,
          notes:        notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal mendaftarkan tabung");
      setSuccess(`✓ Tabung ${data.serialCode} berhasil didaftarkan`);
      setSerialCode("");
      setTare("");
      setLocation("");
      setNotes("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-container space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/cylinders" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Daftar Tabung Baru</h1>
          <p className="page-desc">Registrasi tabung dengan nomor seri untuk tracking individual</p>
        </div>
      </div>

      {types.length === 0 && (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/25 p-4 text-sm text-amber-400">
          ⚠️ Belum ada konfigurasi jenis tabung. Buat dulu di{" "}
          <Link href="/settings/cylinder-types" className="underline font-semibold">Settings → Jenis Tabung</Link>.
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4 text-sm text-green-400">
          {success}
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div>
          <label className="form-label">Nomor Seri Tabung *</label>
          <input
            className="input-field font-mono uppercase"
            placeholder="Contoh: SBY-12-00143"
            value={serialCode}
            onChange={e => setSerialCode(e.target.value)}
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Sesuaikan dengan kode yang tertera pada tabung fisik
          </p>
        </div>

        <div>
          <label className="form-label">Jenis / Ukuran Tabung *</label>
          <select className="input-field" value={size} onChange={e => setSize(e.target.value)}>
            {types.length > 0
              ? types.map(t => <option key={t.id} value={t.size}>{t.label}</option>)
              : (
                <>
                  <option value="KG12">12 kg (nominal)</option>
                  <option value="KG50">50 kg (nominal)</option>
                </>
              )}
          </select>
          {selectedType && (
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Tare nominal: {Number(selectedType.nominalTareKg).toFixed(3)} kg ·
              Berat penuh nominal: {Number(selectedType.nominalFullKg).toFixed(3)} kg
            </p>
          )}
        </div>

        <div>
          <label className="form-label">Tare Weight Aktual (kg)</label>
          <input
            className="input-field font-mono"
            type="number"
            step="0.001"
            min="0"
            placeholder={selectedType ? `Nominal: ${Number(selectedType.nominalTareKg).toFixed(3)} kg` : "Opsional"}
            value={tare}
            onChange={e => setTare(e.target.value)}
          />
          <p className="text-[10px] text-[var(--text-muted)] mt-1">
            Jika dikosongkan, akan menggunakan tare nominal dari konfigurasi jenis tabung
          </p>
        </div>

        <div>
          <label className="form-label">Kondisi Awal</label>
          <select className="input-field" value={condition} onChange={e => setCondition(e.target.value)}>
            <option value="GOOD">GOOD — Baik</option>
            <option value="DAMAGED">DAMAGED — Rusak</option>
            <option value="NEEDS_INSPECTION">NEEDS_INSPECTION — Perlu Periksa</option>
          </select>
        </div>

        <div>
          <label className="form-label">Lokasi di Gudang</label>
          <input
            className="input-field"
            placeholder="Contoh: Rak A-3 (opsional)"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>

        <div>
          <label className="form-label">Catatan</label>
          <textarea
            className="input-field min-h-[70px]"
            placeholder="Catatan opsional..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          className="btn-pri w-full text-sm"
          onClick={handleSubmit}
          disabled={submitting || types.length === 0}
        >
          {submitting ? "Mendaftarkan…" : "Daftar Tabung"}
        </button>
      </div>
    </div>
  );
}