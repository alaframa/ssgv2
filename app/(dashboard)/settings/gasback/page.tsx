// app/(dashboard)/settings/gasback/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface Settings {
  gasback_rate_kg12: string;
  gasback_rate_kg50: string;
  redemption_threshold_kg: string;
  free_refill_size: string;
  return_ratio_denominator: string;
}

const ALLOWED_ROLES = ["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"];

export default function GasbackSettingsPage() {
  const { data: session } = useSession();
  const [settings, setSettings] = useState<Settings>({
    gasback_rate_kg12: "0.5",
    gasback_rate_kg50: "0.5",
    redemption_threshold_kg: "240",
    free_refill_size: "12",
    return_ratio_denominator: "20",
  });
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const canEdit = session?.user?.role && ALLOWED_ROLES.includes(session.user.role);

  useEffect(() => {
    fetch("/api/settings/gasback")
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/gasback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menyimpan");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  function Field({
    label,
    fieldKey,
    type = "number",
    step = "0.01",
    min = "0",
    hint,
    options,
  }: {
    label: string;
    fieldKey: keyof Settings;
    type?: string;
    step?: string;
    min?: string;
    hint?: string;
    options?: { value: string; label: string }[];
  }) {
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        {options ? (
          <select
            className="input-field"
            value={settings[fieldKey]}
            onChange={(e) => setSettings((s) => ({ ...s, [fieldKey]: e.target.value }))}
            disabled={!canEdit || loading}
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ) : (
          <input
            type={type}
            step={step}
            min={min}
            className="input-field"
            value={settings[fieldKey]}
            onChange={(e) => setSettings((s) => ({ ...s, [fieldKey]: e.target.value }))}
            disabled={!canEdit || loading}
          />
        )}
        {hint && <p className="text-xs text-[var(--text-muted)]">{hint}</p>}
      </div>
    );
  }

  // Preview calculation
  const rateKg12   = parseFloat(settings.gasback_rate_kg12) || 0;
  const rateKg50   = parseFloat(settings.gasback_rate_kg50) || 0;
  const threshold  = parseFloat(settings.redemption_threshold_kg) || 0;
  const freeSize   = settings.free_refill_size;
  const ratio      = parseFloat(settings.return_ratio_denominator) || 20;

  const cylindersNeeded12 = rateKg12 > 0 ? Math.ceil(threshold / rateKg12) : "∞";
  const cylindersNeeded50 = rateKg50 > 0 ? Math.ceil(threshold / rateKg50) : "∞";

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/gasback" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Pengaturan Gasback</h1>
          <p className="page-desc">Konfigurasi rasio kredit dan threshold redemption</p>
        </div>
      </div>

      {/* Access warning */}
      {!canEdit && session && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          ⚠️ Role Anda ({session.user.role}) tidak memiliki akses untuk mengubah pengaturan ini.
          Hanya <strong>Super Admin, Branch Manager, dan Finance</strong> yang dapat mengedit.
        </div>
      )}

      {/* Preview card */}
      <div className="card bg-[var(--surface-raised)]">
        <h2 className="section-title mb-3">📊 Preview Kalkulasi Saat Ini</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Setiap tabung 12kg dikirim</p>
            <p className="font-mono font-bold text-green-400">+{rateKg12} kg gasback</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Setiap tabung 50kg dikirim</p>
            <p className="font-mono font-bold text-green-400">+{rateKg50} kg gasback</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Untuk dapat gratis isi {freeSize}kg, perlu kirim:</p>
            <p className="font-mono font-bold text-amber-400">
              ~{cylindersNeeded12} tabung 12kg <span className="text-[var(--text-muted)] font-normal">atau</span> ~{cylindersNeeded50} tabung 50kg
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Threshold saldo minimum</p>
            <p className="font-mono font-bold text-[var(--text-primary)]">{threshold} kg gasback</p>
          </div>
        </div>

        {/* Visual progress bar example */}
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-xs text-[var(--text-muted)] mb-2">Contoh progress seorang pelanggan dengan 150 kg saldo:</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[var(--surface)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: threshold > 0 ? `${Math.min(100, (150 / threshold) * 100)}%` : "0%" }}
              />
            </div>
            <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">
              {threshold > 0 ? ((150 / threshold) * 100).toFixed(0) : 0}% ({threshold - 150 > 0 ? `kurang ${threshold - 150} kg` : "ELIGIBLE"})
            </span>
          </div>
        </div>

        {/* Catatan manual ratio */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]">
          <p>
            <strong className="text-[var(--text-secondary)]">Catatan Manual:</strong>{" "}
            Rasio return gas yang dikonfigurasi: setiap <strong>{ratio} kg gas sisa</strong> yang dikembalikan
            dihitung sebagai <strong>1 kg gasback</strong> (ini hanya catatan untuk penghitungan manual,
            bukan otomatis di sistem).
          </p>
        </div>
      </div>

      {/* Settings form */}
      <form onSubmit={handleSave} className="form-card space-y-5">
        <div>
          <h2 className="section-title">Konfigurasi Rate Kredit</h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Berapa kg gasback yang dikreditkan ke pelanggan untuk setiap tabung yang dikirim
          </p>
        </div>

        {error  && <div className="form-error-banner">{error}</div>}
        {saved  && (
          <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-300 text-sm">
            ✓ Pengaturan berhasil disimpan
          </div>
        )}

        <Field
          label="Rate Gasback — Tabung 12 kg"
          fieldKey="gasback_rate_kg12"
          hint="Satuan: kg gasback per tabung 12kg yang dikirim. Default: 0.5 kg"
        />
        <Field
          label="Rate Gasback — Tabung 50 kg"
          fieldKey="gasback_rate_kg50"
          hint="Satuan: kg gasback per tabung 50kg yang dikirim. Default: 0.5 kg"
        />

        <div className="border-t border-[var(--border)] pt-4">
          <h2 className="section-title mb-1">Konfigurasi Redemption</h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Kapan pelanggan bisa menukarkan gasback dan apa hadiahnya
          </p>
        </div>

        <Field
          label="Threshold Saldo untuk Redemption (kg)"
          fieldKey="redemption_threshold_kg"
          hint="Pelanggan harus memiliki minimal sejumlah ini (dalam kg gasback) untuk bisa klaim. Default: 240 kg"
        />
        <Field
          label="Ukuran Tabung Gratis"
          fieldKey="free_refill_size"
          type="text"
          options={[
            { value: "12",  label: "Tabung 12 kg" },
            { value: "50",  label: "Tabung 50 kg" },
          ]}
          hint="Jenis tabung yang diberikan gratis saat pelanggan melakukan redemption"
        />

        <div className="border-t border-[var(--border)] pt-4">
          <h2 className="section-title mb-1">Catatan Rasio Return Gas (Manual)</h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Ini hanya catatan untuk referensi perhitungan manual — tidak otomatis digunakan di sistem
          </p>
        </div>

        <Field
          label="Penyebut Rasio Return Gas"
          fieldKey="return_ratio_denominator"
          step="1"
          hint="Setiap N kg gas sisa yang dikembalikan = 1 kg gasback. Default: 20 (artinya 20 kg return = 1 kg gasback). Untuk dapat 1 free 12kg, pelanggan perlu return 240×20 = 4.800 kg gas."
        />

        {canEdit && (
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving || loading} className="btn-pri">
              {saving ? "Menyimpan..." : "💾 Simpan Pengaturan"}
            </button>
            <Link href="/gasback" className="btn-gho">
              Batal
            </Link>
          </div>
        )}
      </form>

      {/* History note */}
      <div className="card text-xs text-[var(--text-muted)] space-y-1">
        <p className="font-semibold text-[var(--text-secondary)]">⚠️ Perhatian</p>
        <p>
          Mengubah rate gasback <strong>tidak</strong> mengubah entri ledger yang sudah ada.
          Perubahan hanya berlaku untuk transaksi delivery baru setelah disimpan.
        </p>
        <p>
          Jika perlu koreksi saldo lama, gunakan fitur <strong>Manual Adjustment</strong> di halaman
          riwayat pelanggan (tambahkan entri ADJUSTMENT).
        </p>
      </div>
    </div>
  );
}