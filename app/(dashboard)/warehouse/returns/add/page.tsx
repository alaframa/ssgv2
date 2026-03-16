// app/(dashboard)/warehouse/returns/add/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string;
  code: string;
  name: string;
}

interface Driver {
  id: string;
  displayName: string;
  employeeCode: string;
  roles?: { role: string }[];
}

type ReturnSource = "CUSTOMER" | "DRIVER" | "DEPOT";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function sourceLabel(s: ReturnSource) {
  return s === "CUSTOMER" ? "Pelanggan" : s === "DRIVER" ? "Driver" : "Depo";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AddReturnPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  // Form state
  const [returnNumber, setReturnNumber] = useState("");
  const [returnedAt,   setReturnedAt]   = useState(todayISO());
  const [source,       setSource]       = useState<ReturnSource>("CUSTOMER");
  const [customerId,   setCustomerId]   = useState("");
  const [driverId,     setDriverId]     = useState("");
  const [kg12Qty,      setKg12Qty]      = useState(0);
  const [kg50Qty,      setKg50Qty]      = useState(0);
  const [notes,        setNotes]        = useState("");

  // Lookup data
  const [customers,   setCustomers]   = useState<Customer[]>([]);
  const [drivers,     setDrivers]     = useState<Driver[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Load customers + drivers ───────────────────────────────────────────────
  const loadLookups = useCallback(async () => {
    if (!activeBranchId) return;
    setLoadingData(true);
    try {
      const [custRes, drvRes] = await Promise.all([
        // /api/customers returns { data: [...], meta: {...} }
        // use pageSize param (not limit) and large page to get all
        fetch(`/api/customers?branchId=${activeBranchId}&pageSize=500&page=1`),
        fetch(`/api/employees?branchId=${activeBranchId}&limit=200`),
      ]);

      if (custRes.ok) {
        const json = await custRes.json();
        // Handle all possible response shapes
        const list: Customer[] =
          Array.isArray(json)         ? json :
          Array.isArray(json.data)    ? json.data :
          Array.isArray(json.records) ? json.records :
          Array.isArray(json.customers) ? json.customers :
          [];
        setCustomers(list);
      }

      if (drvRes.ok) {
        const json = await drvRes.json();
        const all: Driver[] =
          Array.isArray(json)            ? json :
          Array.isArray(json.employees)  ? json.employees :
          Array.isArray(json.records)    ? json.records :
          [];
        // Only DRIVER role employees
        setDrivers(all.filter((e) => e.roles?.some((r) => r.role === "DRIVER")));
      }
    } catch (e) {
      console.error("Failed to load lookups:", e);
    } finally {
      setLoadingData(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadLookups(); }, [loadLookups]);

  // Reset FK when source changes
  useEffect(() => {
    setCustomerId("");
    setDriverId("");
  }, [source]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!activeBranchId) { setError("Pilih branch terlebih dahulu"); return; }
    if (!returnNumber.trim()) { setError("Nomor return harus diisi"); return; }
    if (kg12Qty === 0 && kg50Qty === 0) { setError("Minimal satu jenis tabung harus diisi"); return; }

    setSubmitting(true);
    try {
      const payload = {
        branchId:     activeBranchId,
        returnNumber: returnNumber.trim(),
        returnedAt,
        source,
        customerId: source === "CUSTOMER" && customerId ? customerId : null,
        driverId:   source === "DRIVER"   && driverId   ? driverId   : null,
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* ── Info box: gasback flow ─────────────────────────────────────────── */}
      <div className="rounded-lg bg-amber-500/8 border border-amber-500/20 px-4 py-3 space-y-1.5">
        <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide">
          💡 Cara Kerja Gasback dari Return
        </p>
        <p className="text-xs text-amber-300/80 leading-relaxed">
          <strong>Gasback dikreditkan otomatis saat DO DELIVERED</strong> — bukan dari return tabung kosong.
          Setiap tabung yang terkirim = +0.5 kg gasback ke saldo pelanggan.
        </p>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Form ini hanya mencatat <strong>tabung fisik</strong> yang kembali ke gudang (stok kosong naik).
          Untuk melihat saldo gasback pelanggan → buka halaman{" "}
          <a href="/gasback" className="text-[var(--accent)] hover:underline font-medium">Gasback</a>{" "}
          lalu klik nama pelanggan.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Return Number + Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label" htmlFor="returnNumber">
              Nomor Return <span className="text-red-400">*</span>
            </label>
            <input
              id="returnNumber"
              type="text"
              className="form-input"
              placeholder="mis. RET-SBY-001"
              value={returnNumber}
              onChange={(e) => setReturnNumber(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="returnedAt">
              Tanggal Return <span className="text-red-400">*</span>
            </label>
            <input
              id="returnedAt"
              type="date"
              className="form-input"
              value={returnedAt}
              onChange={(e) => setReturnedAt(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Source */}
        <div className="form-group">
          <label className="form-label">Sumber Return <span className="text-red-400">*</span></label>
          <div className="flex gap-3 flex-wrap">
            {(["CUSTOMER", "DRIVER", "DEPOT"] as ReturnSource[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                  source === s
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                {sourceLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional FK: Customer */}
        {source === "CUSTOMER" && (
          <div className="form-group">
            <label className="form-label" htmlFor="customerId">Pelanggan</label>
            {loadingData ? (
              <div className="input-field flex items-center gap-2 text-[var(--text-muted)] text-sm">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                Memuat daftar pelanggan...
              </div>
            ) : customers.length === 0 ? (
              <div className="input-field text-[var(--text-muted)] text-sm">
                Tidak ada pelanggan ditemukan untuk branch ini
              </div>
            ) : (
              <select
                id="customerId"
                className="input-field"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">— Pilih Pelanggan (opsional) —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-[var(--text-muted)]">
              {customers.length > 0 ? `${customers.length} pelanggan tersedia` : ""}
            </p>
          </div>
        )}

        {/* Conditional FK: Driver */}
        {source === "DRIVER" && (
          <div className="form-group">
            <label className="form-label" htmlFor="driverId">Driver</label>
            {loadingData ? (
              <div className="input-field flex items-center gap-2 text-[var(--text-muted)] text-sm">
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                Memuat...
              </div>
            ) : (
              <select
                id="driverId"
                className="input-field"
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">— Pilih Driver (opsional) —</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.displayName} ({d.employeeCode})
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Quantities */}
        <div>
          <p className="form-label mb-2">
            Jumlah Tabung Kosong <span className="text-red-400">*</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 border border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">12 kg</p>
              <input
                type="number"
                min="0"
                className="input-field text-center text-xl font-mono"
                value={kg12Qty}
                onChange={(e) => setKg12Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-xs text-[var(--text-muted)] text-center">tabung</p>
            </div>
            <div className="card p-4 border border-[var(--border)] space-y-2">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">50 kg</p>
              <input
                type="number"
                min="0"
                className="input-field text-center text-xl font-mono"
                value={kg50Qty}
                onChange={(e) => setKg50Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
              <p className="text-xs text-[var(--text-muted)] text-center">tabung</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label" htmlFor="notes">Catatan</label>
          <textarea
            id="notes"
            className="input-field"
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Stock impact preview */}
        {(kg12Qty > 0 || kg50Qty > 0) && (
          <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Dampak ke Stock</p>
            <div className="flex gap-6 text-sm text-[var(--text-secondary)]">
              {kg12Qty > 0 && (
                <span>KG12 Kosong <span className="text-green-400 font-mono">+{kg12Qty}</span></span>
              )}
              {kg50Qty > 0 && (
                <span>KG50 Kosong <span className="text-green-400 font-mono">+{kg50Qty}</span></span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/warehouse?tab=returns")}
            className="btn-gho"
          >
            Batal
          </button>
          <button type="submit" className="btn-pri" disabled={submitting || loadingData}>
            {submitting ? "Menyimpan..." : "Simpan Return"}
          </button>
        </div>
      </form>
    </div>
  );
}

