// app/(dashboard)/cylinders/dispatch/page.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DoOption {
  id: string;
  doNumber: string;
  status: string;
  kg12Released: number;
  kg50Released: number;
  customerPo: { customer: { name: string; code: string } };
  doDate: string;
}

interface DispatchedCylinder {
  eventId: string;
  eventAt: string;
  serialCode: string;
  size: string;
  label: string;
  status: string;
  condition: string;
}

interface DispatchResult {
  dispatched: number;
  warnings: string[];
  doNumber: string;
  customer: string;
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────
function DispatchForm() {
  const router        = useRouter();
  const searchParams  = useSearchParams();
  const { activeBranchId } = useBranch();

  // Pre-select DO if passed via query string (?doId=xxx)
  const preselectedDoId = searchParams.get("doId") ?? "";

  const [dos,          setDos]          = useState<DoOption[]>([]);
  const [selectedDoId, setSelectedDoId] = useState(preselectedDoId);
  const [dispatched,   setDispatched]   = useState<DispatchedCylinder[]>([]);
  const [loadingDo,    setLoadingDo]    = useState(false);
  const [loadingList,  setLoadingList]  = useState(false);

  // Serial input state
  const [serialInput,  setSerialInput]  = useState("");
  const [scannedList,  setScannedList]  = useState<string[]>([]);
  const [submitting,   setSubmitting]   = useState(false);
  const [result,       setResult]       = useState<DispatchResult | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [warnings,     setWarnings]     = useState<string[]>([]);

  // ── Load available DOs (PENDING) ────────────────────────────────────────────
  const loadDos = useCallback(async () => {
    if (!activeBranchId) return;
    setLoadingDo(true);
    try {
      const qs = new URLSearchParams({
        branchId: activeBranchId,
        status: "PENDING",
        limit: "50",
      });
      const res = await fetch(`/api/delivery-orders?${qs}`);
      if (res.ok) {
        const d = await res.json();
        setDos(d.records ?? []);
      }
    } finally {
      setLoadingDo(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadDos(); }, [loadDos]);

  // ── Load already-dispatched cylinders for selected DO ───────────────────────
  const loadDispatched = useCallback(async () => {
    if (!selectedDoId) { setDispatched([]); return; }
    setLoadingList(true);
    try {
      const res = await fetch(`/api/cylinders/dispatch?deliveryOrderId=${selectedDoId}`);
      if (res.ok) {
        const d = await res.json();
        setDispatched(d.cylinders ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }, [selectedDoId]);

  useEffect(() => { loadDispatched(); }, [loadDispatched]);

  // ── Add serial to pending list ───────────────────────────────────────────────
  function addSerial() {
    const code = serialInput.trim().toUpperCase();
    if (!code) return;
    if (scannedList.includes(code)) {
      setError(`Serial ${code} sudah ada di daftar`);
      return;
    }
    setScannedList(prev => [...prev, code]);
    setSerialInput("");
    setError(null);
  }

  function removeSerial(code: string) {
    setScannedList(prev => prev.filter(s => s !== code));
  }

  // ── Submit dispatch ──────────────────────────────────────────────────────────
  async function handleDispatch() {
    setError(null);
    setWarnings([]);
    setResult(null);

    if (!selectedDoId) { setError("Pilih Delivery Order terlebih dahulu"); return; }
    if (scannedList.length === 0) { setError("Tambahkan minimal 1 nomor seri tabung"); return; }

    setSubmitting(true);
    try {
      const res = await fetch("/api/cylinders/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryOrderId: selectedDoId,
          serialCodes: scannedList,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Gagal melakukan dispatch");
        if (data.details) setWarnings(data.details);
        return;
      }

      setResult(data);
      setScannedList([]);
      setWarnings(data.warnings ?? []);
      await loadDispatched();
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDo = dos.find(d => d.id === selectedDoId);

  return (
    <div className="page-container space-y-5 max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cylinders" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div>
          <h1 className="page-title">Assign Tabung ke DO</h1>
          <p className="page-desc">Scan / input nomor seri tabung yang akan dikirim bersama Delivery Order</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg bg-blue-500/8 border border-blue-500/20 px-4 py-3 text-xs text-blue-300/80 leading-relaxed space-y-1">
        <p className="font-semibold text-blue-400">📋 Cara kerja</p>
        <p>
          Setiap tabung yang dikirim dicatat serial-nya. Saat kembali ke gudang, staf akan menimbang
          tabung individual di halaman <Link href="/cylinders/weigh" className="underline font-semibold">Timbang Return</Link> untuk menghitung gasback aktual.
        </p>
      </div>

      {/* ── Step 1: Pilih DO ────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <h2 className="section-title">1. Pilih Delivery Order</h2>

        {loadingDo ? (
          <p className="text-sm text-[var(--text-muted)]">Memuat daftar DO…</p>
        ) : dos.length === 0 ? (
          <div className="rounded-lg bg-amber-500/8 border border-amber-500/25 p-3 text-sm text-amber-400">
            Tidak ada DO berstatus PENDING saat ini.{" "}
            <Link href="/delivery" className="underline">Lihat semua DO</Link>
          </div>
        ) : (
          <select
            className="input-field"
            value={selectedDoId}
            onChange={e => { setSelectedDoId(e.target.value); setResult(null); setError(null); }}
          >
            <option value="">— Pilih DO —</option>
            {dos.map(d => (
              <option key={d.id} value={d.id}>
                {d.doNumber} — {d.customerPo.customer.name} ({d.kg12Released} × 12kg | {d.kg50Released} × 50kg)
              </option>
            ))}
          </select>
        )}

        {/* Selected DO summary */}
        {selectedDo && (
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">DO Number</p>
              <p className="font-mono font-bold text-sm text-[var(--text-primary)]">{selectedDo.doNumber}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Pelanggan</p>
              <p className="text-sm font-medium">{selectedDo.customerPo.customer.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-[var(--text-muted)] uppercase">Qty Rilis</p>
              <p className="font-mono text-sm">
                <span className="text-green-400">{selectedDo.kg12Released}×12kg</span>
                {" "}<span className="text-amber-400">{selectedDo.kg50Released}×50kg</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Scan / Input Serials ────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">2. Scan / Input Nomor Seri</h2>
          {scannedList.length > 0 && (
            <span className="chip bg-blue-500/10 text-blue-400 text-xs">{scannedList.length} tabung</span>
          )}
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            className="input-field flex-1 font-mono uppercase"
            placeholder="Scan atau ketik nomor seri tabung…"
            value={serialInput}
            onChange={e => setSerialInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); addSerial(); }
            }}
            disabled={!selectedDoId}
          />
          <button
            className="btn-pri px-4"
            onClick={addSerial}
            disabled={!selectedDoId || !serialInput.trim()}
          >
            + Tambah
          </button>
        </div>

        {/* Pending list */}
        {scannedList.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">Daftar tabung yang akan di-dispatch:</p>
            <div className="rounded-xl border border-[var(--border)] overflow-hidden">
              {scannedList.map((code, idx) => (
                <div
                  key={code}
                  className={`flex items-center justify-between px-4 py-2.5 ${
                    idx < scannedList.length - 1 ? "border-b border-[var(--border)]" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-[var(--text-muted)] w-5">{idx + 1}</span>
                    <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">{code}</span>
                  </div>
                  <button
                    className="text-[var(--text-muted)] hover:text-red-400 transition-colors text-xs"
                    onClick={() => removeSerial(code)}
                  >
                    ✕ hapus
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Error / Result ──────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/25 px-4 py-3 text-sm text-red-400">
          {error}
          {warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {warnings.map((w, i) => <li key={i}>• {w}</li>)}
            </ul>
          )}
        </div>
      )}

      {warnings.length > 0 && !error && (
        <div className="rounded-lg bg-amber-500/8 border border-amber-500/25 px-4 py-3 text-xs text-amber-400 space-y-1">
          <p className="font-semibold">Peringatan:</p>
          {warnings.map((w, i) => <p key={i}>• {w}</p>)}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-4 space-y-2">
          <p className="text-sm font-bold text-green-400">✓ Berhasil dispatch {result.dispatched} tabung</p>
          <p className="text-xs text-green-300/80">DO {result.doNumber} → {result.customer}</p>
          <div className="flex gap-2 pt-1">
            <button
              className="btn-gho text-xs"
              onClick={() => { setResult(null); loadDos(); }}
            >
              Dispatch Lagi
            </button>
            <Link href={`/delivery/${selectedDoId}`} className="btn-pri text-xs">
              Lihat DO →
            </Link>
          </div>
        </div>
      )}

      {/* ── Submit Button ───────────────────────────────────────────────────── */}
      {!result && (
        <div className="flex gap-3">
          <button
            className="btn-pri"
            onClick={handleDispatch}
            disabled={submitting || !selectedDoId || scannedList.length === 0}
          >
            {submitting ? "Memproses…" : `🚚 Dispatch ${scannedList.length > 0 ? scannedList.length + " Tabung" : ""}`}
          </button>
          <button className="btn-gho" onClick={() => router.push("/cylinders")}>
            Batal
          </button>
        </div>
      )}

      {/* ── Step 3: Already dispatched on this DO ────────────────────────────── */}
      {selectedDoId && (
        <div className="card p-0">
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="section-title">Tabung sudah di-assign ke DO ini</h2>
            <button onClick={loadDispatched} className="btn-gho text-xs">↻ Refresh</button>
          </div>

          {loadingList ? (
            <div className="p-6 text-center text-[var(--text-muted)] text-sm">Memuat…</div>
          ) : dispatched.length === 0 ? (
            <div className="p-6 text-center text-[var(--text-muted)] text-sm">
              Belum ada tabung yang di-assign ke DO ini
            </div>
          ) : (
            <div className="table-wrap rounded-none border-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>No. Seri</th>
                    <th>Ukuran</th>
                    <th>Status</th>
                    <th>Kondisi</th>
                    <th>Waktu Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {dispatched.map((cyl, idx) => (
                    <tr key={cyl.eventId}>
                      <td className="text-[var(--text-muted)] text-xs">{idx + 1}</td>
                      <td>
                        <Link
                          href={`/cylinders?search=${cyl.serialCode}`}
                          className="font-mono font-semibold text-[var(--accent)] hover:underline"
                        >
                          {cyl.serialCode}
                        </Link>
                      </td>
                      <td>
                        <span className="chip text-xs">{cyl.label}</span>
                      </td>
                      <td>
                        <span className={`chip text-xs ${
                          cyl.status === "IN_TRANSIT"    ? "bg-yellow-500/15 text-yellow-400" :
                          cyl.status === "WITH_CUSTOMER" ? "bg-blue-500/15 text-blue-400"     :
                          "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                        }`}>
                          {cyl.status === "IN_TRANSIT" ? "Dalam Perjalanan" :
                           cyl.status === "WITH_CUSTOMER" ? "Di Pelanggan" : cyl.status}
                        </span>
                      </td>
                      <td>
                        <span className={`chip text-xs ${
                          cyl.condition === "GOOD"            ? "bg-green-500/10 text-green-400" :
                          cyl.condition === "DAMAGED"         ? "bg-red-500/10 text-red-400"     :
                          cyl.condition === "NEEDS_INSPECTION"? "bg-amber-500/10 text-amber-400" :
                          "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                        }`}>
                          {cyl.condition}
                        </span>
                      </td>
                      <td className="text-xs text-[var(--text-muted)]">
                        {new Date(cyl.eventAt).toLocaleDateString("id-ID", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dispatched.length > 0 && (
            <div className="px-5 py-3 border-t border-[var(--border)] flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">
                Total: <strong>{dispatched.length}</strong> tabung
                {" · "}
                {dispatched.filter(c => c.size === "KG12").length} × 12kg
                {" · "}
                {dispatched.filter(c => c.size === "KG50").length} × 50kg
              </p>
              {selectedDo && (
                <p className={`text-xs font-medium ${
                  dispatched.length >= (selectedDo.kg12Released + selectedDo.kg50Released)
                    ? "text-green-400" : "text-amber-400"
                }`}>
                  {dispatched.length >= (selectedDo.kg12Released + selectedDo.kg50Released)
                    ? "✓ Semua tabung sudah di-assign"
                    : `⚠ ${(selectedDo.kg12Released + selectedDo.kg50Released) - dispatched.length} tabung belum di-assign`
                  }
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page wrapper (Suspense for useSearchParams) ───────────────────────────────
export default function CylinderDispatchPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Memuat…</div>}>
      <DispatchForm />
    </Suspense>
  );
}