// app/(dashboard)/warehouse/inbound/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import Link from "next/link";

interface SupplierPo {
  id: string;
  poNumber: string;
  status: string;
  kg12Qty: number;
  kg50Qty: number;
  supplier: { name: string };
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InboundAddPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [pos, setPos] = useState<SupplierPo[]>([]);
  const [posLoading, setPosLoading] = useState(true);

  const [supplierPoId, setSupplierPoId] = useState("");
  const [grNumber, setGrNumber] = useState("");
  const [receivedAt, setReceivedAt] = useState(today());
  const [kg12Received, setKg12Received] = useState("");
  const [kg12Good, setKg12Good] = useState("");
  const [kg12Reject, setKg12Reject] = useState("");
  const [kg50Received, setKg50Received] = useState("");
  const [kg50Good, setKg50Good] = useState("");
  const [kg50Reject, setKg50Reject] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Load confirmed POs for this branch
  useEffect(() => {
    if (!activeBranchId) return;
    setPosLoading(true);
    fetch(`/api/orders?branchId=${activeBranchId}&status=CONFIRMED,SUBMITTED,PARTIALLY_RECEIVED&limit=100`)
      .then((r) => r.json())
      .then((d) => setPos(d.records ?? []))
      .catch(() => setPos([]))
      .finally(() => setPosLoading(false));
  }, [activeBranchId]);

  // Auto-fill qty from selected PO
  useEffect(() => {
    if (!supplierPoId) return;
    const po = pos.find((p) => p.id === supplierPoId);
    if (po) {
      if (!kg12Received) setKg12Received(String(po.kg12Qty));
      if (!kg50Received) setKg50Received(String(po.kg50Qty));
    }
  }, [supplierPoId]); // eslint-disable-line

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        branchId: activeBranchId,
        grNumber: grNumber.trim(),
        receivedAt,
        kg12Received: Number(kg12Received) || 0,
        kg12Good: Number(kg12Good) || 0,
        kg12Reject: Number(kg12Reject) || 0,
        kg50Received: Number(kg50Received) || 0,
        kg50Good: Number(kg50Good) || 0,
        kg50Reject: Number(kg50Reject) || 0,
        notes: notes.trim() || null,
      };
      if (supplierPoId) body.supplierPoId = supplierPoId;

      const res = await fetch("/api/warehouse/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError(data.error);
        return;
      }
      if (res.status === 423) {
        setError("Periode ini sudah dikunci. Tidak bisa menambahkan GR.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Terjadi kesalahan");
        if (data.issues) setFieldErrors(data.issues);
        return;
      }

      router.push("/warehouse?tab=inbound");
    } catch {
      setError("Gagal terhubung ke server");
    } finally {
      setSaving(false);
    }
  };

  const fe = (field: string) =>
    fieldErrors[field]?.length ? (
      <p className="text-xs text-red-400 mt-1">{fieldErrors[field][0]}</p>
    ) : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/warehouse?tab=inbound"
          className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Catat Penerimaan Barang</h1>
          <p className="text-xs text-[var(--text-muted)]">Good Receipt (GR) dari Supplier</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Supplier PO */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            Referensi PO
          </h2>

          <div>
            <label className="form-label">Supplier PO (Opsional)</label>
            {posLoading ? (
              <div className="form-input flex items-center text-[var(--text-muted)] text-sm">
                Memuat daftar PO...
              </div>
            ) : pos.length === 0 ? (
              <div className="form-input flex items-center text-[var(--text-muted)] text-sm italic">
                Tidak ada PO aktif — GR tanpa PO
              </div>
            ) : (
              <select
                className="form-input"
                value={supplierPoId}
                onChange={(e) => setSupplierPoId(e.target.value)}
              >
                <option value="">— Tanpa referensi PO —</option>
                {pos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplier.name} ({po.status})
                  </option>
                ))}
              </select>
            )}
            {fe("supplierPoId")}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Nomor GR <span className="text-red-400">*</span>
              </label>
              <input
                className="form-input"
                placeholder="cth: GR-SBY-2026-001"
                value={grNumber}
                onChange={(e) => setGrNumber(e.target.value)}
                required
              />
              {fe("grNumber")}
            </div>
            <div>
              <label className="form-label">
                Tanggal Terima <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                className="form-input"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                required
              />
              {fe("receivedAt")}
            </div>
          </div>
        </div>

        {/* KG12 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-bold">12</span>
            Tabung 12 Kg
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Diterima</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg12Received}
                onChange={(e) => setKg12Received(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Baik (Good)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg12Good}
                onChange={(e) => setKg12Good(e.target.value)}
              />
              {fe("kg12Good")}
            </div>
            <div>
              <label className="form-label">Reject</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg12Reject}
                onChange={(e) => setKg12Reject(e.target.value)}
              />
            </div>
          </div>
          {kg12Good && (
            <p className="text-xs text-blue-400">
              ✓ Stock 12 kg akan bertambah <strong>{Number(kg12Good)} tabung</strong>
            </p>
          )}
        </div>

        {/* KG50 */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">50</span>
            Tabung 50 Kg
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Diterima</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg50Received}
                onChange={(e) => setKg50Received(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Baik (Good)</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg50Good}
                onChange={(e) => setKg50Good(e.target.value)}
              />
              {fe("kg50Good")}
            </div>
            <div>
              <label className="form-label">Reject</label>
              <input
                type="number"
                min="0"
                className="form-input"
                placeholder="0"
                value={kg50Reject}
                onChange={(e) => setKg50Reject(e.target.value)}
              />
            </div>
          </div>
          {kg50Good && (
            <p className="text-xs text-amber-400">
              ✓ Stock 50 kg akan bertambah <strong>{Number(kg50Good)} tabung</strong>
            </p>
          )}
        </div>

        {/* Notes */}
        <div className="card p-5">
          <label className="form-label">Catatan</label>
          <textarea
            className="form-input min-h-[72px] resize-none"
            placeholder="Catatan opsional..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="btn-pri px-6"
          >
            {saving ? "Menyimpan..." : "Simpan GR"}
          </button>
          <Link href="/warehouse?tab=inbound" className="btn-gho px-5">
            Batal
          </Link>
        </div>
      </form>
    </div>
  );
}