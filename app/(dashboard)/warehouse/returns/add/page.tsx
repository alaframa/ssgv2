// app/(dashboard)/warehouse/returns/add/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import Link from "next/link";

interface Customer {
  id: string;
  code: string;
  name: string;
}
interface Employee {
  id: string;
  displayName: string;
  roles: { role: string }[];
}

export default function AddReturnPage() {
  const router             = useRouter();
  const { activeBranchId } = useBranch();

  const [source,      setSource]      = useState("CUSTOMER");
  const [customerId,  setCustomerId]  = useState("");
  const [driverId,    setDriverId]    = useState("");
  const [kg12Qty,     setKg12Qty]     = useState(0);
  const [kg50Qty,     setKg50Qty]     = useState(0);
  const [returnedAt,  setReturnedAt]  = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [notes,       setNotes]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [drivers,     setDrivers]     = useState<Employee[]>([]);
  const [gasbackMode, setGasbackMode] = useState<string>("LEGACY");

  // Load customers, employees, and gasback mode setting
  const loadOptions = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const [custRes, empRes, settingRes] = await Promise.all([
        fetch(`/api/customers?branchId=${activeBranchId}&limit=500&status=active`),
        fetch(`/api/employees?branchId=${activeBranchId}&limit=100`),
        fetch(`/api/settings?key=gasback_mode`).catch(() => null),
      ]);

      if (custRes.ok) {
        const d = await custRes.json();
        setCustomers(d.customers ?? d.data ?? []);
      }
      if (empRes.ok) {
        const d = await empRes.json();
        const list: Employee[] = d.employees ?? d.records ?? (Array.isArray(d) ? d : []);
        setDrivers(list.filter((e) => e.roles.some((r) => r.role === "DRIVER")));
      }
      if (settingRes && settingRes.ok) {
        const d = await settingRes.json();
        setGasbackMode(d.value ?? "LEGACY");
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeBranchId]);

  useEffect(() => { loadOptions(); }, [loadOptions]);

  async function handleSubmit() {
    setError(null);

    if (!activeBranchId) { setError("Branch belum dipilih"); return; }
    if (kg12Qty === 0 && kg50Qty === 0) { setError("Masukkan minimal satu jumlah tabung"); return; }
    if (source === "CUSTOMER" && !customerId) { setError("Pilih pelanggan untuk source CUSTOMER"); return; }
    if (source === "DRIVER" && !driverId) { setError("Pilih driver untuk source DRIVER"); return; }

    setSubmitting(true);
    try {
      const payload = {
        branchId:   activeBranchId,
        source,
        returnedAt: new Date(returnedAt).toISOString(),
        customerId: source === "CUSTOMER" ? customerId : null,
        driverId:   source === "DRIVER"   ? driverId   : null,
        kg12Qty,
        kg50Qty,
        notes: notes.trim() || null,
      };

      const res = await fetch("/api/warehouse/empty-return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menyimpan return");
      }

      router.push("/warehouse?tab=returns");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/warehouse?tab=returns")}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Return Tabung Kosong</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Catat penerimaan tabung kosong dari pelanggan / driver / depo
          </p>
        </div>
      </div>

      {/* ── Info box: gasback flow — changes based on current mode ─────────── */}
      {gasbackMode === "WEIGHT" ? (
        <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
            ⚖️ Mode Gasback: WEIGHT (Timbang per Tabung)
          </p>
          <p className="text-xs text-blue-300/80 leading-relaxed">
            Sistem sedang dalam mode <strong>timbang per tabung</strong>.
            Setelah mencatat return ini, lanjutkan ke{" "}
            <Link href="/cylinders/weigh" className="underline font-semibold">Tabung Serial → Timbang Return</Link>
            {" "}untuk menimbang setiap tabung secara individual.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Gasback dihitung dari <strong>sisa gas aktual</strong> (berat kembali − tare) saat ditimbang,
            bukan otomatis saat DO dikirim.
          </p>
        </div>
      ) : (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
            💡 Cara Kerja Gasback (Mode Legacy)
          </p>
          <p className="text-xs text-amber-300/80 leading-relaxed">
            <strong>Gasback dikreditkan otomatis saat DO DELIVERED</strong> — menggunakan tarif flat per tabung.
            Form ini hanya mencatat <strong>tabung fisik</strong> yang kembali ke gudang (stok kosong naik).
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Untuk timbang tabung individual dan gasback berbasis berat aktual, aktifkan mode WEIGHT di{" "}
            <Link href="/settings/gasback" className="text-[var(--accent)] hover:underline font-medium">
              Settings → Gasback
            </Link>.
          </p>
        </div>
      )}

      {/* ── Form ─────────────────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">

        {/* Source */}
        <div>
          <label className="form-label">Sumber Return *</label>
          <select
            className="input-field"
            value={source}
            onChange={(e) => { setSource(e.target.value); setCustomerId(""); setDriverId(""); }}
          >
            <option value="CUSTOMER">Pelanggan</option>
            <option value="DRIVER">Driver</option>
            <option value="DEPOT">Depo</option>
          </select>
        </div>

        {/* Customer / Driver selector */}
        {source === "CUSTOMER" && (
          <div>
            <label className="form-label">Pelanggan *</label>
            <select
              className="input-field"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— Pilih Pelanggan —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        )}

        {source === "DRIVER" && (
          <div>
            <label className="form-label">Driver *</label>
            <select
              className="input-field"
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
            >
              <option value="">— Pilih Driver —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.displayName}</option>
              ))}
            </select>
          </div>
        )}

        {/* Quantities */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Tabung 12 kg</label>
            <input
              className="input-field font-mono"
              type="number"
              min="0"
              value={kg12Qty}
              onChange={(e) => setKg12Qty(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="form-label">Tabung 50 kg</label>
            <input
              className="input-field font-mono"
              type="number"
              min="0"
              value={kg50Qty}
              onChange={(e) => setKg50Qty(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="form-label">Tanggal & Waktu Return *</label>
          <input
            className="input-field"
            type="datetime-local"
            value={returnedAt}
            onChange={(e) => setReturnedAt(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label">Catatan</label>
          <textarea
            className="input-field min-h-[70px]"
            placeholder="Opsional..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            className="btn-pri flex-1 text-sm"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Menyimpan…" : "Simpan Return"}
          </button>
          <button
            className="btn-gho text-sm"
            onClick={() => router.push("/warehouse?tab=returns")}
            disabled={submitting}
          >
            Batal
          </button>
        </div>
      </div>

      {/* Quick link to weigh in WEIGHT mode */}
      {gasbackMode === "WEIGHT" && (
        <div className="text-center">
          <Link
            href="/cylinders/weigh"
            className="btn-pri text-sm"
          >
            ⚖️ Lanjut Timbang Tabung →
          </Link>
        </div>
      )}
    </div>
  );
}