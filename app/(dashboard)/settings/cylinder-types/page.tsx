// app/(dashboard)/settings/cylinder-types/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface CylinderType {
  id: string;
  size: string;
  label: string;
  nominalTareKg: string;
  nominalFullKg: string;
  _count: { cylinders: number };
}

const SIZE_DESCRIPTIONS: Record<string, string> = {
  KG12: 'Tabung "12 kg" — label kategori untuk tabung berukuran kecil. Nominal gas ~12 kg.',
  KG50: 'Tabung "50 kg" — label kategori untuk tabung berukuran besar. Nominal gas ~50 kg.',
};

export default function CylinderTypesSettingsPage() {
  const [types,    setTypes]    = useState<CylinderType[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState<string | null>(null); // "KG12" | "KG50" | null

  // Form state
  const [label,    setLabel]    = useState("");
  const [tare,     setTare]     = useState("");
  const [full,     setFull]     = useState("");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/cylinders/types");
      if (res.ok) setTypes(await res.json());
    } finally {
      setLoading(false);
    }
  }

  function startEdit(type: CylinderType) {
    setEditing(type.size);
    setLabel(type.label);
    setTare(Number(type.nominalTareKg).toFixed(3));
    setFull(Number(type.nominalFullKg).toFixed(3));
    setError(null);
    setSuccess(null);
  }

  function startNew(size: string) {
    setEditing(size);
    setLabel(size === "KG12" ? "Tabung 12 Kg" : "Tabung 50 Kg");
    setTare(size === "KG12" ? "14.500" : "33.500");
    setFull(size === "KG12" ? "26.500" : "83.500");
    setError(null);
    setSuccess(null);
  }

  async function handleSave() {
    setError(null);
    const tareNum = parseFloat(tare);
    const fullNum = parseFloat(full);
    if (!label.trim()) { setError("Label wajib diisi"); return; }
    if (isNaN(tareNum) || tareNum <= 0) { setError("Tare weight harus angka positif"); return; }
    if (isNaN(fullNum) || fullNum <= 0) { setError("Berat penuh harus angka positif"); return; }
    if (fullNum <= tareNum) { setError("Berat penuh harus lebih besar dari tare"); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/cylinders/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size:          editing,
          label:         label.trim(),
          nominalTareKg: tareNum,
          nominalFullKg: fullNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
      setSuccess(`✓ Konfigurasi ${editing} berhasil disimpan`);
      setEditing(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  const existingSizes = types.map(t => t.size);
  const missingSizes  = ["KG12", "KG50"].filter(s => !existingSizes.includes(s));

  return (
    <div className="page-container space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Konfigurasi Jenis Tabung</h1>
          <p className="page-desc">
            Atur label, berat tare nominal, dan berat penuh untuk setiap jenis tabung
          </p>
        </div>
      </div>

      {/* Explanation */}
      <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 p-4 text-xs text-blue-300/80 leading-relaxed space-y-1">
        <p className="font-semibold text-blue-400">📋 Tentang Konfigurasi Ini</p>
        <p>
          "12 kg" dan "50 kg" adalah <strong>kategori/label</strong>, bukan berat gas yang pasti.
          Setiap jenis tabung memiliki berat tare (berat kosong tanpa gas) dan berat penuh (berat + gas penuh).
        </p>
        <p>
          <strong>Gasback dihitung:</strong> Berat Kembali − Tare = Gas Sisa (gasback pelanggan)
        </p>
        <p>
          Untuk tabung yang sudah diukur tare-nya secara individual, nilai individual akan digunakan.
          Nilai nominal di sini adalah fallback untuk tabung yang belum diukur individual.
        </p>
      </div>

      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* Existing types */}
      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Memuat…</p>
      ) : (
        <div className="space-y-4">
          {types.map(type => (
            <div key={type.id} className="card p-5">
              {editing === type.size ? (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase">Edit {type.size}</h2>
                  <div>
                    <label className="form-label">Label *</label>
                    <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Tare Weight Nominal (kg) *</label>
                      <input className="input-field font-mono" type="number" step="0.001" value={tare} onChange={e => setTare(e.target.value)} />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">Berat tabung kosong tanpa gas</p>
                    </div>
                    <div>
                      <label className="form-label">Berat Penuh Nominal (kg) *</label>
                      <input className="input-field font-mono" type="number" step="0.001" value={full} onChange={e => setFull(e.target.value)} />
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">Tare + gas penuh</p>
                    </div>
                  </div>
                  {parseFloat(full) > parseFloat(tare) && (
                    <p className="text-xs text-green-400">
                      ✓ Gas nominal: {(parseFloat(full) - parseFloat(tare)).toFixed(3)} kg
                    </p>
                  )}
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button className="btn-pri text-sm" onClick={handleSave} disabled={saving}>
                      {saving ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button className="btn-gho text-sm" onClick={() => setEditing(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-[var(--text-primary)]">{type.label}</h2>
                      <span className="chip text-xs">{type.size}</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{SIZE_DESCRIPTIONS[type.size]}</p>
                    <div className="grid grid-cols-3 gap-4 mt-2">
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase">Tare Nominal</p>
                        <p className="font-mono text-sm font-semibold">{Number(type.nominalTareKg).toFixed(3)} kg</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase">Berat Penuh</p>
                        <p className="font-mono text-sm font-semibold">{Number(type.nominalFullKg).toFixed(3)} kg</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] uppercase">Gas Nominal</p>
                        <p className="font-mono text-sm font-bold text-green-400">
                          {(Number(type.nominalFullKg) - Number(type.nominalTareKg)).toFixed(3)} kg
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {type._count.cylinders} tabung terdaftar menggunakan jenis ini
                    </p>
                  </div>
                  <button className="btn-gho text-xs" onClick={() => startEdit(type)}>Edit</button>
                </div>
              )}
            </div>
          ))}

          {/* Missing types — show create button */}
          {missingSizes.map(size => (
            <div key={size} className="card p-5 border-dashed">
              {editing === size ? (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase">Buat {size}</h2>
                  <div>
                    <label className="form-label">Label *</label>
                    <input className="input-field" value={label} onChange={e => setLabel(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Tare Weight Nominal (kg) *</label>
                      <input className="input-field font-mono" type="number" step="0.001" value={tare} onChange={e => setTare(e.target.value)} />
                    </div>
                    <div>
                      <label className="form-label">Berat Penuh Nominal (kg) *</label>
                      <input className="input-field font-mono" type="number" step="0.001" value={full} onChange={e => setFull(e.target.value)} />
                    </div>
                  </div>
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <div className="flex gap-2">
                    <button className="btn-pri text-sm" onClick={handleSave} disabled={saving}>
                      {saving ? "Menyimpan…" : "Simpan"}
                    </button>
                    <button className="btn-gho text-sm" onClick={() => setEditing(null)}>Batal</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-muted)]">{size} — Belum dikonfigurasi</p>
                    <p className="text-xs text-[var(--text-muted)]">{SIZE_DESCRIPTIONS[size]}</p>
                  </div>
                  <button className="btn-pri text-sm" onClick={() => startNew(size)}>
                    + Konfigurasi {size}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}