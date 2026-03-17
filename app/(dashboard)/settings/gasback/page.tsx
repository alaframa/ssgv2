// app/(dashboard)/settings/gasback/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface GasbackSettings {
  gasback_mode:             string;
  gasback_rate_kg12:        string;
  gasback_rate_kg50:        string;
  redemption_threshold_kg:  string;
  free_refill_size:         string;
  return_ratio_denominator: string;
}

const DEFAULTS: GasbackSettings = {
  gasback_mode:             "LEGACY",
  gasback_rate_kg12:        "0.5",
  gasback_rate_kg50:        "0.5",
  redemption_threshold_kg:  "240",
  free_refill_size:         "12",
  return_ratio_denominator: "20",
};

const ALLOWED_ROLES = ["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"];

export default function GasbackSettingsPage() {
  const { data: session } = useSession();
  const canEdit = ALLOWED_ROLES.includes(session?.user?.role ?? "");

  const [settings,  setSettings]  = useState<GasbackSettings>(DEFAULTS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) { setSettings(DEFAULTS); return; }
        const rows: { key: string; value: string }[] = await res.json();
        const merged = { ...DEFAULTS };
        for (const row of rows) {
          if (row.key in merged) (merged as Record<string, string>)[row.key] = row.value;
        }
        setSettings(merged);
      } catch {
        setSettings(DEFAULTS);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function saveSetting(key: string, value: string, label?: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, label }),
    });
    if (!res.ok) {
      const d = await res.json();
      throw new Error(d.error ?? "Gagal menyimpan");
    }
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await Promise.all([
        saveSetting("gasback_mode",             settings.gasback_mode,             "Mode Gasback"),
        saveSetting("gasback_rate_kg12",        settings.gasback_rate_kg12,        "Gasback Rate 12kg (legacy)"),
        saveSetting("gasback_rate_kg50",        settings.gasback_rate_kg50,        "Gasback Rate 50kg (legacy)"),
        saveSetting("redemption_threshold_kg",  settings.redemption_threshold_kg,  "Threshold Redeem (kg)"),
        saveSetting("free_refill_size",         settings.free_refill_size,         "Ukuran Isi Gratis"),
        saveSetting("return_ratio_denominator", settings.return_ratio_denominator, "Rasio Return (manual)"),
      ]);
      setSuccess("✓ Pengaturan gasback berhasil disimpan");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  }

  const rateKg12       = parseFloat(settings.gasback_rate_kg12) || 0.5;
  const rateKg50       = parseFloat(settings.gasback_rate_kg50) || 0.5;
  const threshold      = parseFloat(settings.redemption_threshold_kg) || 240;
  const freeSize       = settings.free_refill_size;
  const ratio          = parseFloat(settings.return_ratio_denominator) || 20;
  const cylindersNeeded12 = rateKg12 > 0 ? Math.ceil(threshold / rateKg12) : "∞";
  const cylindersNeeded50 = rateKg50 > 0 ? Math.ceil(threshold / rateKg50) : "∞";

  if (loading) return <div className="page-container p-8 text-center text-[var(--text-muted)]">Memuat…</div>;

  return (
    <div className="page-container space-y-5 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Pengaturan Gasback</h1>
          <p className="page-desc">Konfigurasi mode, tarif, dan threshold gasback</p>
        </div>
      </div>

      {!canEdit && (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3 text-xs text-amber-400">
          Hanya <strong>Super Admin, Branch Manager, dan Finance</strong> yang dapat mengedit.
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          {success}
        </div>
      )}

      {/* ── Mode Selector ─────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title">Mode Kalkulasi Gasback</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* LEGACY mode card */}
          <button
            disabled={!canEdit}
            onClick={() => setSettings(s => ({ ...s, gasback_mode: "LEGACY" }))}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              settings.gasback_mode === "LEGACY"
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] hover:border-[var(--accent)]/40"
            }`}
          >
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
              {settings.gasback_mode === "LEGACY" && "✓ "} LEGACY — Flat Rate
            </p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Gasback otomatis saat DO DELIVERED. Tarif tetap per tabung (misal: 0.5 kg per tabung 12 kg).
              Tidak membutuhkan timbangan individual.
            </p>
          </button>

          {/* WEIGHT mode card */}
          <button
            disabled={!canEdit}
            onClick={() => setSettings(s => ({ ...s, gasback_mode: "WEIGHT" }))}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              settings.gasback_mode === "WEIGHT"
                ? "border-[var(--accent)] bg-[var(--accent-light)]"
                : "border-[var(--border)] hover:border-[var(--accent)]/40"
            }`}
          >
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">
              {settings.gasback_mode === "WEIGHT" && "✓ "} WEIGHT — Timbang per Tabung
            </p>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Gasback dihitung saat tabung ditimbang saat kembali ke gudang.
              Gasback = berat kembali − tare. Membutuhkan serial tracking tabung.
            </p>
            <Link
              href="/settings/cylinder-types"
              onClick={e => e.stopPropagation()}
              className="text-[10px] text-[var(--accent)] hover:underline mt-1 block"
            >
              → Konfigurasi Jenis Tabung
            </Link>
          </button>
        </div>

        {settings.gasback_mode === "WEIGHT" && (
          <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-3 py-2 text-xs text-blue-300/80">
            ⚠️ Dalam mode WEIGHT, gasback <strong>tidak</strong> otomatis saat DO dikirim.
            Staf gudang harus menimbang setiap tabung yang kembali di halaman{" "}
            <Link href="/cylinders/weigh" className="underline font-semibold">Tabung Serial → Timbang Return</Link>.
          </div>
        )}
      </div>

      {/* ── Legacy Rate Settings ──────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title">Tarif Gasback (Mode Legacy)</h2>
        {settings.gasback_mode === "WEIGHT" && (
          <p className="text-xs text-[var(--text-muted)] italic">
            Nilai ini tidak digunakan saat mode WEIGHT aktif, tetapi disimpan sebagai fallback.
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Rate Tabung 12 kg (kg gasback per tabung)</label>
            <input
              className="input-field font-mono"
              type="number" step="0.01" min="0" max="50"
              disabled={!canEdit}
              value={settings.gasback_rate_kg12}
              onChange={e => setSettings(s => ({ ...s, gasback_rate_kg12: e.target.value }))}
            />
          </div>
          <div>
            <label className="form-label">Rate Tabung 50 kg (kg gasback per tabung)</label>
            <input
              className="input-field font-mono"
              type="number" step="0.01" min="0" max="50"
              disabled={!canEdit}
              value={settings.gasback_rate_kg50}
              onChange={e => setSettings(s => ({ ...s, gasback_rate_kg50: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* ── Redemption Settings ───────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title">Pengaturan Redemption</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Threshold Saldo Minimum (kg)</label>
            <input
              className="input-field font-mono"
              type="number" step="1" min="1"
              disabled={!canEdit}
              value={settings.redemption_threshold_kg}
              onChange={e => setSettings(s => ({ ...s, redemption_threshold_kg: e.target.value }))}
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">
              Saldo gasback minimum untuk bisa klaim isi gratis
            </p>
          </div>
          <div>
            <label className="form-label">Ukuran Isi Gratis (kg)</label>
            <select
              className="input-field"
              disabled={!canEdit}
              value={settings.free_refill_size}
              onChange={e => setSettings(s => ({ ...s, free_refill_size: e.target.value }))}
            >
              <option value="12">12 kg</option>
              <option value="50">50 kg</option>
            </select>
          </div>
          <div>
            <label className="form-label">Rasio Return Manual (per kg gasback)</label>
            <input
              className="input-field font-mono"
              type="number" step="1" min="1"
              disabled={!canEdit}
              value={settings.return_ratio_denominator}
              onChange={e => setSettings(s => ({ ...s, return_ratio_denominator: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* ── Preview ───────────────────────────────────────────────────────── */}
      <div className="card bg-[var(--surface-raised)] p-5">
        <h2 className="section-title mb-3">📊 Preview Kalkulasi Saat Ini</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Mode aktif</p>
            <p className={`font-mono font-bold ${settings.gasback_mode === "WEIGHT" ? "text-blue-400" : "text-amber-400"}`}>
              {settings.gasback_mode}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-[var(--text-muted)]">Threshold redeem</p>
            <p className="font-mono font-bold text-[var(--text-primary)]">{threshold} kg</p>
          </div>
          {settings.gasback_mode === "LEGACY" && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">Setiap tabung 12kg dikirim</p>
                <p className="font-mono font-bold text-green-400">+{rateKg12} kg gasback</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-[var(--text-muted)]">Setiap tabung 50kg dikirim</p>
                <p className="font-mono font-bold text-green-400">+{rateKg50} kg gasback</p>
              </div>
              <div className="space-y-1 col-span-2">
                <p className="text-xs text-[var(--text-muted)]">Untuk dapat gratis isi {freeSize}kg, perlu kirim:</p>
                <p className="font-mono font-bold text-amber-400">
                  ~{cylindersNeeded12} tabung 12kg <span className="text-[var(--text-muted)] font-normal">atau</span> ~{cylindersNeeded50} tabung 50kg
                </p>
              </div>
            </>
          )}
          {settings.gasback_mode === "WEIGHT" && (
            <div className="space-y-1 col-span-2">
              <p className="text-xs text-[var(--text-muted)]">Gasback per tabung</p>
              <p className="font-mono font-bold text-blue-400">
                = berat kembali − tare (diukur saat ditimbang)
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {canEdit && (
        <button className="btn-pri text-sm w-full" onClick={handleSave} disabled={saving}>
          {saving ? "Menyimpan…" : "Simpan Pengaturan"}
        </button>
      )}
    </div>
  );
}