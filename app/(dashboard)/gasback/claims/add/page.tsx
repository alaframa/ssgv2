// app/(dashboard)/gasback/claims/add/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

interface CustomerOption {
  id: string;
  code: string;
  name: string;
  balance: number;
  canRedeem: boolean;
  progress: number;
}

interface Settings {
  redemption_threshold_kg: string;
  free_refill_size: string;
  gasback_rate_kg12: string;
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function AddGasbackClaimPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCustomerId = searchParams.get("customerId");
  const { activeBranchId } = useBranch();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [settings,  setSettings]  = useState<Settings | null>(null);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  // Form state
  const [customerId,    setCustomerId]    = useState(preselectedCustomerId ?? "");
  const [qty,           setQty]           = useState("");
  const [amountPerUnit, setAmountPerUnit] = useState("");
  const [notes,         setNotes]         = useState("");

  // Load settings
  useEffect(() => {
    fetch("/api/settings/gasback")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, []);

  // Load eligible customers
  const loadCustomers = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        branchId: activeBranchId,
        limit: "50",
      });
      if (search) params.set("search", search);
      const res = await fetch(`/api/gasback/summary?${params}`);
      if (!res.ok) throw new Error("Gagal memuat pelanggan");
      const d = await res.json();
      setCustomers(d.customers ?? []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;
  const qtyNum    = parseFloat(qty) || 0;
  const rateNum   = parseFloat(amountPerUnit) || 0;
  const totalCalc = qtyNum * rateNum;

  const threshold = settings ? parseFloat(settings.redemption_threshold_kg) : 240;
  const freeSize  = settings?.free_refill_size ?? "12";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) { setError("Pilih pelanggan terlebih dahulu"); return; }
    if (qtyNum <= 0)  { setError("Qty harus lebih dari 0"); return; }
    if (!activeBranchId) { setError("Branch tidak aktif"); return; }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/gasback/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          branchId: activeBranchId,
          qty: qtyNum,
          amountPerUnit: rateNum,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal membuat klaim");
      }
      const claim = await res.json();
      router.push(`/gasback/claims/${claim.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/gasback/claims" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Klaim Gasback Baru</h1>
          <p className="page-desc">Buat redemption untuk pelanggan yang saldo gasbacknya cukup</p>
        </div>
      </div>

      {/* Info box: how it works */}
      {settings && (
        <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
          <p className="font-semibold">📋 Mekanisme Gasback Saat Ini</p>
          <p>
            Threshold redeem: <strong>{threshold} kg</strong> gasback → gratis isi {freeSize} kg
          </p>
          <p className="text-amber-300/70">
            Rate kredit: {settings.gasback_rate_kg12} kg per tabung 12kg yang dikirim.
            Pelanggan dengan saldo ≥ {threshold} kg bisa melakukan redemption.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-card space-y-5">
        {error && <div className="form-error-banner">{error}</div>}

        {/* Customer selection */}
        <div className="form-group">
          <label className="form-label">Pelanggan <span className="text-red-400">*</span></label>
          <input
            className="input-field mb-2"
            placeholder="Cari nama pelanggan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="input-field"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">-- Pilih Pelanggan --</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code}) — Saldo: {fmt(c.balance)} kg
                {c.canRedeem ? " ✓ ELIGIBLE" : ""}
              </option>
            ))}
          </select>
          {loading && <p className="text-xs text-[var(--text-muted)]">Memuat...</p>}
        </div>

        {/* Selected customer balance preview */}
        {selectedCustomer && (
          <div className={`px-4 py-3 rounded-lg border text-sm ${
            selectedCustomer.canRedeem
              ? "bg-green-500/10 border-green-500/20 text-green-300"
              : "bg-[var(--surface-raised)] border-[var(--border)] text-[var(--text-secondary)]"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold">{selectedCustomer.name}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                selectedCustomer.canRedeem
                  ? "bg-green-500/20 text-green-300"
                  : "bg-red-500/10 text-red-400"
              }`}>
                {selectedCustomer.canRedeem ? "✓ ELIGIBLE" : "✗ Belum Cukup"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[var(--text-muted)]">Saldo:</span>
              <span className="font-mono font-bold">{fmt(selectedCustomer.balance)} kg</span>
              <div className="flex-1 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
                <div
                  className={`h-full rounded-full ${selectedCustomer.canRedeem ? "bg-green-400" : "bg-[var(--accent)]"}`}
                  style={{ width: `${Math.min(100, selectedCustomer.progress)}%` }}
                />
              </div>
              <span className="text-xs font-mono">{selectedCustomer.progress.toFixed(0)}%</span>
            </div>
          </div>
        )}

        {/* Qty */}
        <div className="form-group">
          <label className="form-label">
            Qty Gasback Diklaim (kg) <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="input-field"
            placeholder="cth: 240"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
          <p className="text-xs text-[var(--text-muted)]">
            Ini adalah jumlah kg gasback yang akan dikurangi dari saldo pelanggan
          </p>
        </div>

        {/* Rate per unit */}
        <div className="form-group">
          <label className="form-label">Nilai per kg (opsional)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="input-field"
            placeholder="cth: 1000 (Rp per kg, opsional)"
            value={amountPerUnit}
            onChange={(e) => setAmountPerUnit(e.target.value)}
          />
          <p className="text-xs text-[var(--text-muted)]">
            Bisa dikosongkan jika klaim berupa 1 tabung gratis tanpa konversi uang
          </p>
        </div>

        {/* Total preview */}
        {qtyNum > 0 && (
          <div className="px-4 py-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-muted)]">Total klaim:</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">
                {fmt(qtyNum)} kg × {rateNum > 0 ? fmt(rateNum) : "—"} = {rateNum > 0 ? fmt(totalCalc) : "—"}
              </span>
            </div>
            {selectedCustomer && (
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-[var(--text-muted)]">Saldo setelah klaim:</span>
                <span className={`font-mono font-bold ${
                  selectedCustomer.balance - totalCalc >= 0 ? "text-green-400" : "text-red-400"
                }`}>
                  {fmt(selectedCustomer.balance - (rateNum > 0 ? totalCalc : qtyNum))} kg
                </span>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Keterangan tambahan..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-pri">
            {submitting ? "Menyimpan..." : "Buat Klaim"}
          </button>
          <Link href="/gasback/claims" className="btn-gho">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}