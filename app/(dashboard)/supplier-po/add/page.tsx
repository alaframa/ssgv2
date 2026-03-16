// app/(dashboard)/supplier-po/add/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Supplier {
  id: string;
  code: string;
  name: string;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Auto-generate poNumber: PO-YYYY-MM-NNNN
// Fetches the last PO for this month and increments
async function generatePoNumber(branchId: string): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, "0");

  try {
    const res = await fetch(
      `/api/orders?branchId=${branchId}&limit=100&page=1`
    );
    if (!res.ok) throw new Error();
    const d = await res.json();
    const records: { poNumber: string }[] = d.records ?? [];

    // Filter POs for current year-month
    const prefix = `PO-${yyyy}-${mm}-`;
    const matching = records
      .map(r => r.poNumber)
      .filter(n => n.startsWith(prefix))
      .map(n => {
        const seq = parseInt(n.slice(prefix.length), 10);
        return isNaN(seq) ? 0 : seq;
      });

    const maxSeq = matching.length > 0 ? Math.max(...matching) : 0;
    const nextSeq = String(maxSeq + 1).padStart(4, "0");
    return `PO-${yyyy}-${mm}-${nextSeq}`;
  } catch {
    // Fallback
    const now2 = new Date();
    return `PO-${now2.getFullYear()}-${mm}-0001`;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SupplierPoAddPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { activeBranchId } = useBranch();

  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [branches,   setBranches]   = useState<Branch[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Form fields
  const [supplierId, setSupplierId] = useState("");
  const [branchId,   setBranchId]   = useState("");
  const [poNumber,   setPoNumber]   = useState("");
  const [kg12Qty,    setKg12Qty]    = useState(0);
  const [kg50Qty,    setKg50Qty]    = useState(0);
  const [notes,      setNotes]      = useState("");
  const [autoPoNum,  setAutoPoNum]  = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Load suppliers + branches
  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [suppRes, branchRes] = await Promise.all([
        fetch("/api/suppliers"),
        fetch("/api/branches"),
      ]);
      if (suppRes.ok)   setSuppliers(await suppRes.json());
      if (branchRes.ok) setBranches(await branchRes.json());
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);

  // Set default branchId from context
  useEffect(() => {
    if (activeBranchId) setBranchId(activeBranchId);
  }, [activeBranchId]);

  // Auto-generate poNumber when branchId changes
  useEffect(() => {
    if (!branchId || !autoPoNum) return;
    generatePoNumber(branchId).then(setPoNumber);
  }, [branchId, autoPoNum]);

  // Auto-select first supplier
  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers, supplierId]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!branchId)   { setError("Pilih branch terlebih dahulu");   return; }
    if (!supplierId) { setError("Pilih supplier terlebih dahulu"); return; }
    if (!poNumber.trim()) { setError("Nomor PO harus diisi");      return; }
    if (kg12Qty === 0 && kg50Qty === 0) {
      setError("Minimal satu jenis tabung harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branchId,
          supplierId,
          poNumber: poNumber.trim(),
          kg12Qty,
          kg50Qty,
          notes: notes.trim() || null,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menyimpan PO");
      }

      const created = await res.json();
      router.push(`/supplier-po/${created.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/supplier-po")}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--bg-hover)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-muted)]">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Buat Purchase Order</h1>
          <p className="text-xs text-[var(--text-muted)]">PO ke PT Arsygas untuk pengisian tabung</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* PO Number + Branch */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Identitas PO</h2>

          {/* Branch (SUPER_ADMIN only) */}
          {isSuperAdmin && (
            <div className="form-group">
              <label className="form-label">Branch <span className="text-red-400">*</span></label>
              <select
                className="form-input"
                value={branchId}
                onChange={e => setBranchId(e.target.value)}
                disabled={loadingMeta}
              >
                <option value="">— Pilih Branch —</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
          )}

          {/* Supplier */}
          <div className="form-group">
            <label className="form-label">Supplier <span className="text-red-400">*</span></label>
            {loadingMeta ? (
              <div className="form-input text-[var(--text-muted)] text-sm animate-pulse">Memuat...</div>
            ) : (
              <select
                className="form-input"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
                required
              >
                <option value="">— Pilih Supplier —</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            )}
          </div>

          {/* PO Number */}
          <div className="form-group">
            <div className="flex items-center justify-between mb-1">
              <label className="form-label mb-0">Nomor PO <span className="text-red-400">*</span></label>
              <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPoNum}
                  onChange={e => setAutoPoNum(e.target.checked)}
                  className="rounded"
                />
                Auto-generate
              </label>
            </div>
            <input
              type="text"
              className="form-input font-mono"
              placeholder="PO-2026-03-0001"
              value={poNumber}
              onChange={e => setPoNumber(e.target.value)}
              readOnly={autoPoNum}
              required
            />
            {autoPoNum && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Format: PO-YYYY-MM-NNNN. Unchecklist untuk input manual.
              </p>
            )}
          </div>
        </div>

        {/* Quantities */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Kuantitas Tabung</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="form-label">12 kg (tabung)</label>
              <input
                type="number"
                min="0"
                className="form-input text-center text-xl font-mono"
                value={kg12Qty}
                onChange={e => setKg12Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <label className="form-label">50 kg (tabung)</label>
              <input
                type="number"
                min="0"
                className="form-input text-center text-xl font-mono"
                value={kg50Qty}
                onChange={e => setKg50Qty(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>
          </div>

          {/* Total gas weight preview */}
          {(kg12Qty > 0 || kg50Qty > 0) && (
            <div className="rounded-lg bg-blue-500/5 border border-blue-500/20 px-4 py-3">
              <p className="text-xs font-semibold text-blue-400 mb-1">Estimasi Tonase</p>
              <p className="text-sm text-[var(--text-secondary)] font-mono">
                {((kg12Qty * 12) + (kg50Qty * 50)).toLocaleString("id-ID")} kg
                <span className="text-[var(--text-muted)] font-sans ml-1">
                  ({kg12Qty > 0 ? `${kg12Qty}×12kg` : ""}{kg12Qty > 0 && kg50Qty > 0 ? " + " : ""}{kg50Qty > 0 ? `${kg50Qty}×50kg` : ""})
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="card p-5 space-y-3">
          <label className="form-label" htmlFor="notes">Catatan</label>
          <textarea
            id="notes"
            className="form-input"
            rows={3}
            placeholder="Catatan tambahan (opsional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push("/supplier-po")}
            className="btn-gho"
          >
            Batal
          </button>
          <button type="submit" className="btn-pri" disabled={submitting || loadingMeta}>
            {submitting ? "Menyimpan..." : "Buat PO (DRAFT)"}
          </button>
        </div>
      </form>
    </div>
  );
}