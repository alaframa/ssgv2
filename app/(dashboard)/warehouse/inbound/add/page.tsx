// app/(dashboard)/warehouse/inbound/add/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
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

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InboundAddPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  // PO list
  const [pos,        setPos]        = useState<SupplierPo[]>([]);
  const [posLoading, setPosLoading] = useState(true);
  const [supplierPoId, setSupplierPoId] = useState("");

  // Auto-generated GR number
  const [grNumber,    setGrNumber]    = useState("");
  const [grLoading,   setGrLoading]   = useState(true);
  const [grOverridden, setGrOverridden] = useState(false); // true once user edits

  // Date
  const [receivedAt, setReceivedAt] = useState(todayStr());

  // ── 12kg ────────────────────────────────────────────
  const [kg12Received, setKg12Received] = useState(0);
  const [kg12Reject,   setKg12Reject]   = useState(0);
  // kg12Good = received - reject (computed, shown read-only unless user edits reject)

  // ── 50kg ────────────────────────────────────────────
  const [kg50Received, setKg50Received] = useState(0);
  const [kg50Reject,   setKg50Reject]   = useState(0);

  const [notes, setNotes] = useState("");

  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Derived: good = received - reject (floor 0)
  const kg12Good = Math.max(0, kg12Received - kg12Reject);
  const kg50Good = Math.max(0, kg50Received - kg50Reject);

  // ── Fetch auto GR number ──────────────────────────────────────────────────
  const fetchNextGr = useCallback(async () => {
    if (!activeBranchId || grOverridden) return;
    setGrLoading(true);
    try {
      const res  = await fetch(`/api/warehouse/inbound/next-number?branchId=${activeBranchId}`);
      const data = await res.json();
      if (res.ok) setGrNumber(data.grNumber);
    } catch {
      // fail silently — user can type manually
    } finally {
      setGrLoading(false);
    }
  }, [activeBranchId, grOverridden]);

  useEffect(() => { fetchNextGr(); }, [fetchNextGr]);

  // ── Fetch supplier POs ────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeBranchId) return;
    setPosLoading(true);
    fetch(`/api/orders?branchId=${activeBranchId}&status=CONFIRMED,SUBMITTED,PARTIALLY_RECEIVED&limit=100`)
      .then((r) => r.json())
      .then((d) => setPos(d.records ?? []))
      .catch(() => setPos([]))
      .finally(() => setPosLoading(false));
  }, [activeBranchId]);

  // ── When PO is selected, prefill received qty from PO ────────────────────
  useEffect(() => {
    if (!supplierPoId) return;
    const po = pos.find((p) => p.id === supplierPoId);
    if (!po) return;
    if (po.kg12Qty > 0) { setKg12Received(po.kg12Qty); setKg12Reject(0); }
    if (po.kg50Qty > 0) { setKg50Received(po.kg50Qty); setKg50Reject(0); }
  }, [supplierPoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (!grNumber.trim()) { setError("Nomor GR wajib diisi"); return; }
    if (!receivedAt)       { setError("Tanggal wajib diisi");  return; }
    if (kg12Received === 0 && kg50Received === 0) {
      setError("Minimal salah satu qty (12kg atau 50kg) harus lebih dari 0");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        branchId:    activeBranchId,
        grNumber:    grNumber.trim(),
        receivedAt,
        kg12Received,
        kg12Good,
        kg12Reject,
        kg50Received,
        kg50Good,
        kg50Reject,
        notes: notes.trim() || null,
      };
      if (supplierPoId) body.supplierPoId = supplierPoId;

      const res  = await fetch("/api/warehouse/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (res.status === 409) {
        // Duplicate GR — regenerate a new one
        setError(`${json.error}. Nomor GR telah diperbarui — coba simpan lagi.`);
        setGrOverridden(false);
        fetchNextGr();
        return;
      }
      if (res.status === 423) { setError("Periode dikunci — tidak bisa menambahkan GR."); return; }
      if (res.status === 422) {
        const issues = json.issues as Record<string, string[]> | undefined;
        if (issues) setFieldErrors(issues);
        setError(json.error ?? "Validasi gagal");
        return;
      }
      if (!res.ok) { setError(json.error ?? "Terjadi kesalahan"); return; }

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
        <Link href="/warehouse?tab=inbound"
          className="p-2 rounded-lg hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Catat Penerimaan Barang</h1>
          <p className="text-xs text-[var(--text-muted)]">Good Receipt (GR) dari Supplier</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 break-words">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Section 1: Referensi ─────────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            Referensi
          </h2>

          {/* Supplier PO */}
          <div>
            <label className="form-label">Supplier PO (Opsional)</label>
            {posLoading ? (
              <div className="form-input text-[var(--text-muted)] text-sm">Memuat daftar PO...</div>
            ) : pos.length === 0 ? (
              <div className="form-input text-[var(--text-muted)] text-sm italic">
                Tidak ada PO aktif — GR tanpa PO
              </div>
            ) : (
              <select className="form-input" value={supplierPoId}
                onChange={(e) => setSupplierPoId(e.target.value)}>
                <option value="">— Tanpa referensi PO —</option>
                {pos.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplier.name}
                    {" "}(12kg:{po.kg12Qty} / 50kg:{po.kg50Qty})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* GR Number + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                Nomor GR <span className="text-red-400">*</span>
                {!grOverridden && (
                  <span className="ml-1 text-[var(--accent)] font-normal text-[10px] normal-case tracking-normal">
                    ● auto
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  className="form-input pr-16"
                  placeholder={grLoading ? "Memuat..." : "GR-SBY-202603-0001"}
                  value={grNumber}
                  onChange={(e) => {
                    setGrNumber(e.target.value);
                    setGrOverridden(true);
                  }}
                />
                {grOverridden && (
                  <button
                    type="button"
                    onClick={() => { setGrOverridden(false); fetchNextGr(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--accent)]
                      hover:underline px-1"
                    title="Reset ke nomor otomatis"
                  >
                    Reset
                  </button>
                )}
              </div>
              {fe("grNumber")}
            </div>
            <div>
              <label className="form-label">
                Tanggal Terima <span className="text-red-400">*</span>
              </label>
              <input type="date" className="form-input" value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}/>
              {fe("receivedAt")}
            </div>
          </div>
        </div>

        {/* ── Section 2: Tabung 12 Kg ──────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 font-bold">12</span>
            Tabung 12 Kg
          </h2>

          <div className="grid grid-cols-3 gap-4">
            {/* Received */}
            <div>
              <label className="form-label">Diterima <span className="text-red-400">*</span></label>
              <input type="number" min="0" className="form-input font-mono"
                value={kg12Received}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value) || 0);
                  setKg12Received(v);
                  // Keep reject capped at received
                  if (kg12Reject > v) setKg12Reject(v);
                }}
              />
            </div>

            {/* Reject — user fills this, good is derived */}
            <div>
              <label className="form-label">Reject / Rusak</label>
              <input type="number" min="0" max={kg12Received} className="form-input font-mono"
                value={kg12Reject}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(kg12Received, parseInt(e.target.value) || 0));
                  setKg12Reject(v);
                }}
              />
            </div>

            {/* Good — read-only derived */}
            <div>
              <label className="form-label text-green-600">Baik (Good)</label>
              <div className={`form-input font-mono font-bold select-none cursor-default
                ${kg12Good > 0 ? "text-green-600 bg-green-50 border-green-200" : "text-[var(--text-muted)]"}`}>
                {kg12Good}
              </div>
              {fe("kg12Good")}
            </div>
          </div>

          {kg12Good > 0 && (
            <p className="text-xs text-green-600">
              ✓ Stock 12kg akan bertambah <strong>{kg12Good} tabung</strong>
              {kg12Reject > 0 && ` (${kg12Reject} ditolak)`}
            </p>
          )}
        </div>

        {/* ── Section 3: Tabung 50 Kg ──────────────────────────────────── */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">50</span>
            Tabung 50 Kg
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="form-label">Diterima</label>
              <input type="number" min="0" className="form-input font-mono"
                value={kg50Received}
                onChange={(e) => {
                  const v = Math.max(0, parseInt(e.target.value) || 0);
                  setKg50Received(v);
                  if (kg50Reject > v) setKg50Reject(v);
                }}
              />
            </div>
            <div>
              <label className="form-label">Reject / Rusak</label>
              <input type="number" min="0" max={kg50Received} className="form-input font-mono"
                value={kg50Reject}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(kg50Received, parseInt(e.target.value) || 0));
                  setKg50Reject(v);
                }}
              />
            </div>
            <div>
              <label className="form-label text-green-600">Baik (Good)</label>
              <div className={`form-input font-mono font-bold select-none cursor-default
                ${kg50Good > 0 ? "text-green-600 bg-green-50 border-green-200" : "text-[var(--text-muted)]"}`}>
                {kg50Good}
              </div>
              {fe("kg50Good")}
            </div>
          </div>

          {kg50Good > 0 && (
            <p className="text-xs text-green-600">
              ✓ Stock 50kg akan bertambah <strong>{kg50Good} tabung</strong>
              {kg50Reject > 0 && ` (${kg50Reject} ditolak)`}
            </p>
          )}
        </div>

        {/* ── Summary bar ─────────────────────────────────────────────── */}
        {(kg12Received > 0 || kg50Received > 0) && (
          <div className="card p-4 bg-[var(--accent-light)] border-[var(--accent)]/30">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-[var(--text-muted)] mr-1">Total diterima:</span>
                <strong>{kg12Received + kg50Received} tabung</strong>
              </div>
              <div className="text-green-600">
                <span className="mr-1">Stock masuk:</span>
                <strong>{kg12Good + kg50Good} tabung</strong>
              </div>
              {(kg12Reject + kg50Reject) > 0 && (
                <div className="text-red-500">
                  <span className="mr-1">Reject:</span>
                  <strong>{kg12Reject + kg50Reject} tabung</strong>
                </div>
              )}
              <div className="text-[var(--text-muted)]">
                Tonase masuk: <strong>
                  {((kg12Good * 12) + (kg50Good * 50)).toLocaleString("id-ID")} kg
                </strong>
              </div>
            </div>
          </div>
        )}

        {/* ── Catatan ─────────────────────────────────────────────────── */}
        <div className="card p-5">
          <label className="form-label">Catatan</label>
          <textarea className="form-input min-h-[72px] resize-none"
            placeholder="Catatan opsional..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={saving} className="btn-pri px-6">
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