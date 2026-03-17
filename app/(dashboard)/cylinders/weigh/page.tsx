// app/(dashboard)/cylinders/weigh/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface CylinderUnit {
  id: string;
  serialCode: string;
  status: string;
  condition: string;
  tareWeightKg: string | null;
  type: { size: string; label: string; nominalTareKg: string; nominalFullKg: string };
  events: {
    eventType: string;
    eventAt: string;
    customer: { id: string; name: string; code: string } | null;
    weightDispatchedKg: string | null;
  }[];
}

interface WeighResult {
  serialCode: string;
  tare: number;
  weightReturnedKg: number;
  gasbackKg: number;
  newGasbackBalance: number;
  message: string;
}

function WeighPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [serialInput,       setSerialInput]       = useState("");
  const [cylinderId,        setCylinderId]         = useState(searchParams.get("cylinderId") ?? "");
  const [unit,              setUnit]               = useState<CylinderUnit | null>(null);
  const [loadingUnit,       setLoadingUnit]         = useState(false);
  const [unitError,         setUnitError]           = useState<string | null>(null);

  const [emptyReturnId,     setEmptyReturnId]       = useState("");
  const [customerId,        setCustomerId]           = useState("");
  const [weightReturnedKg,  setWeightReturnedKg]     = useState("");
  const [condition,         setCondition]            = useState("GOOD");
  const [notes,             setNotes]               = useState("");

  const [submitting,        setSubmitting]           = useState(false);
  const [result,            setResult]               = useState<WeighResult | null>(null);
  const [formError,         setFormError]             = useState<string | null>(null);

  // Load unit by serial or id when cylinderId preset
  useEffect(() => {
    if (cylinderId) {
      fetchUnit(`/api/cylinders/${cylinderId}`);
    }
  }, [cylinderId]);

  async function searchBySerial() {
    if (!serialInput.trim()) return;
    fetchUnit(`/api/cylinders/_?serial=${encodeURIComponent(serialInput.trim())}`);
  }

  async function fetchUnit(url: string) {
    setLoadingUnit(true);
    setUnitError(null);
    setUnit(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Tabung tidak ditemukan");
      }
      const data: CylinderUnit = await res.json();
      setUnit(data);
      setCylinderId(data.id);

      // Pre-fill customer from last dispatch event
      const lastDispatch = data.events.find(e => e.eventType === "DISPATCHED_TO_CUSTOMER");
      if (lastDispatch?.customer) {
        setCustomerId(lastDispatch.customer.id);
      }
    } catch (e: unknown) {
      setUnitError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingUnit(false);
    }
  }

  async function handleSubmit() {
    setFormError(null);
    if (!cylinderId) { setFormError("Pilih tabung terlebih dahulu"); return; }
    if (!emptyReturnId.trim()) { setFormError("Nomor Return harus diisi"); return; }
    if (!customerId.trim()) { setFormError("Pilih pelanggan"); return; }
    const wt = parseFloat(weightReturnedKg);
    if (isNaN(wt) || wt <= 0) { setFormError("Berat kembali harus angka positif"); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/cylinders/${cylinderId}/weigh-return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emptyReturnId: emptyReturnId.trim(),
          customerId:    customerId.trim(),
          weightReturnedKg: wt,
          condition,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal menyimpan");
      setResult(data as WeighResult);
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // Tare reference
  const tare = unit
    ? unit.tareWeightKg
      ? Number(unit.tareWeightKg)
      : Number(unit.type.nominalTareKg)
    : null;

  const wt       = parseFloat(weightReturnedKg);
  const preview  = tare !== null && !isNaN(wt) && wt > 0
    ? Math.max(0, wt - tare)
    : null;

  return (
    <div className="page-container space-y-5 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cylinders" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Timbang Tabung Kembali</h1>
          <p className="page-desc">Catat berat tabung yang dikembalikan · hitung gasback otomatis</p>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-4 py-3 space-y-1">
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">💡 Cara Kerja Gasback</p>
        <p className="text-xs text-blue-300/80 leading-relaxed">
          Ketika tabung dikembalikan, staf gudang menimbang beratnya.
          <br />
          <strong>Gasback = Berat Kembali − Tare (berat kosong tabung)</strong>
          <br />
          Gas yang masih ada di tabung saat dikembalikan = kredit gasback untuk pelanggan.
        </p>
      </div>

      {/* Result after successful submit */}
      {result && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-5 space-y-3">
          <p className="text-sm font-bold text-green-400">✓ Berhasil dicatat!</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">No. Seri</p>
              <p className="font-mono font-bold text-[var(--text-primary)]">{result.serialCode}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Tare</p>
              <p className="font-mono font-bold">{result.tare.toFixed(3)} kg</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Berat Kembali</p>
              <p className="font-mono font-bold text-amber-400">{result.weightReturnedKg.toFixed(3)} kg</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Gasback</p>
              <p className="font-mono font-bold text-green-400">{result.gasbackKg.toFixed(3)} kg</p>
            </div>
          </div>
          <p className="text-sm text-green-300">{result.message}</p>
          <div className="flex gap-2 pt-1">
            <button
              className="btn-gho text-sm"
              onClick={() => {
                setResult(null);
                setUnit(null);
                setCylinderId("");
                setSerialInput("");
                setEmptyReturnId("");
                setCustomerId("");
                setWeightReturnedKg("");
                setNotes("");
                setCondition("GOOD");
              }}
            >
              Timbang Tabung Lain
            </button>
            <Link href="/cylinders" className="btn-pri text-sm">Kembali ke Daftar Tabung</Link>
          </div>
        </div>
      )}

      {!result && (
        <div className="card p-5 space-y-5">
          {/* Step 1: Find Cylinder */}
          <div>
            <h2 className="section-title mb-3">1. Cari Tabung</h2>
            <div className="flex gap-2">
              <input
                className="input-field flex-1"
                placeholder="Ketik nomor seri tabung..."
                value={serialInput}
                onChange={e => setSerialInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && searchBySerial()}
              />
              <button
                className="btn-gho text-sm"
                onClick={searchBySerial}
                disabled={loadingUnit}
              >
                {loadingUnit ? "…" : "Cari"}
              </button>
            </div>

            {unitError && (
              <p className="text-xs text-red-400 mt-2">{unitError}</p>
            )}

            {unit && (
              <div className="mt-3 rounded-lg bg-[var(--surface)] p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase">No. Seri</p>
                  <p className="font-mono font-bold text-[var(--accent)]">{unit.serialCode}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase">Ukuran</p>
                  <p className="text-sm font-semibold">{unit.type.label}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase">Status</p>
                  <p className="text-sm">{unit.status}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase">Tare Berat</p>
                  <p className="font-mono text-sm font-semibold">
                    {unit.tareWeightKg
                      ? `${Number(unit.tareWeightKg).toFixed(3)} kg (aktual)`
                      : `${Number(unit.type.nominalTareKg).toFixed(3)} kg (nominal)`}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Fill return info */}
          {unit && (
            <div className="space-y-4">
              <h2 className="section-title">2. Data Return</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">ID EmptyReturn Record *</label>
                  <input
                    className="input-field"
                    placeholder="ID dari record return tabung kosong"
                    value={emptyReturnId}
                    onChange={e => setEmptyReturnId(e.target.value)}
                  />
                  <p className="text-[10px] text-[var(--text-muted)] mt-1">
                    Ambil dari halaman <Link href="/warehouse?tab=returns" className="text-[var(--accent)] hover:underline">Warehouse → Returns</Link>
                  </p>
                </div>
                <div>
                  <label className="form-label">ID Pelanggan *</label>
                  <input
                    className="input-field"
                    placeholder="ID pelanggan yang mengembalikan"
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                  />
                </div>
              </div>

              {/* Weight input - the critical field */}
              <div>
                <label className="form-label">
                  Berat Tabung Saat Kembali (kg) *
                </label>
                <input
                  className="input-field font-mono text-lg"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder={tare !== null ? `Tare = ${tare.toFixed(3)} kg, isi berat total` : "0.000"}
                  value={weightReturnedKg}
                  onChange={e => setWeightReturnedKg(e.target.value)}
                />
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Timbang tabung fisik pada timbangan gudang, masukkan hasilnya di sini.
                </p>
              </div>

              {/* Live gasback preview */}
              {preview !== null && (
                <div className={`rounded-lg p-4 border ${preview > 0 ? "bg-green-500/8 border-green-500/25" : "bg-gray-500/8 border-gray-500/25"}`}>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Berat Kembali</p>
                      <p className="font-mono font-bold text-amber-400">{wt.toFixed(3)} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Tare</p>
                      <p className="font-mono font-bold text-[var(--text-muted)]">−{tare!.toFixed(3)} kg</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-muted)] uppercase">Gasback</p>
                      <p className={`font-mono font-bold text-lg ${preview > 0 ? "text-green-400" : "text-[var(--text-muted)]"}`}>
                        {preview.toFixed(3)} kg
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-center mt-2 text-[var(--text-muted)]">
                    {preview > 0
                      ? `Sisa ${preview.toFixed(3)} kg gas akan dikreditkan ke gasback pelanggan`
                      : "Tidak ada sisa gas — tabung dikembalikan kosong"}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Kondisi Tabung</label>
                  <select
                    className="input-field"
                    value={condition}
                    onChange={e => setCondition(e.target.value)}
                  >
                    <option value="GOOD">GOOD — Baik</option>
                    <option value="DAMAGED">DAMAGED — Rusak</option>
                    <option value="NEEDS_INSPECTION">NEEDS_INSPECTION — Perlu Periksa</option>
                    <option value="CONDEMNED">CONDEMNED — Tidak Layak</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Catatan</label>
                  <input
                    className="input-field"
                    placeholder="Opsional..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {formError && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
                  {formError}
                </div>
              )}

              <button
                className="btn-pri w-full text-sm"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Menyimpan…" : "⚖️ Simpan Timbangan & Hitung Gasback"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function WeighPageWrapper() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--text-muted)]">Memuat…</div>}>
      <WeighPage />
    </Suspense>
  );
}