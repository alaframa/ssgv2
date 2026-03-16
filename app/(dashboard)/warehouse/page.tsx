// app/(dashboard)/warehouse/page.tsx
"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────
interface StockData {
  branchId: string;
  branch: { code: string; name: string } | null;
  stockDate: string | null;
  kg12FullQty: number;
  kg12EmptyQty: number;
  kg12OnTransitQty: number;
  kg12HmtQty: number;
  kg12KuotaWo: number;
  kg50FullQty: number;
  kg50EmptyQty: number;
  kg50OnTransitQty: number;
  kg50HmtQty: number;
  kg50KuotaWo: number;
  hmtQuota12: number;
  hmtQuota50: number;
}

interface InboundRecord {
  id: string;
  grNumber: string;
  receivedAt: string;
  kg12Received: number;
  kg12Good: number;
  kg12Reject: number;
  kg50Received: number;
  kg50Good: number;
  kg50Reject: number;
  notes: string | null;
  supplierPo?: { poNumber: string } | null;
}

interface ReturnRecord {
  id: string;
  returnNumber: string;
  returnedAt: string;
  source: "CUSTOMER" | "DRIVER" | "DEPOT";
  kg12Qty: number;
  kg50Qty: number;
  notes: string | null;
  customer?: { id: string; name: string } | null;
  driver?:   { id: string; displayName: string } | null;
}

interface WriteoffRecord {
  id: string;
  writeoffNumber: string;
  writeoffAt: string;
  reason: "RUSAK_BERAT" | "HILANG" | "KADALUARSA_UJI" | "BOCOR_PARAH";
  kg12Qty: number;
  kg50Qty: number;
  notes: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const SOURCE_LABEL: Record<string, string> = { CUSTOMER: "Pelanggan", DRIVER: "Driver", DEPOT: "Depo" };
const REASON_LABEL: Record<string, string> = {
  RUSAK_BERAT:    "Rusak Berat",
  HILANG:         "Hilang",
  KADALUARSA_UJI: "Kadaluarsa Uji",
  BOCOR_PARAH:    "Bocor Parah",
};

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Stock
// ──────────────────────────────────────────────────────────────────────────────
function StockTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [stock,   setStock]   = useState<StockData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const loadStock = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouse/stock?branchId=${activeBranchId}`);
      if (!res.ok) throw new Error("Gagal memuat data stock");
      setStock(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadStock(); }, [loadStock]);

  if (!activeBranchId) {
    return (
      <div className="empty-state py-16">
        <p className="empty-state-title">Pilih Branch</p>
        <p className="empty-state-desc">Gunakan branch switcher di atas untuk memilih cabang.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-[var(--bg-hover)] rounded w-32 mb-4"/>
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map(j => <div key={j} className="h-16 bg-[var(--bg-hover)] rounded-lg"/>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state py-12">
        <p className="empty-state-title text-red-400">{error}</p>
        <button onClick={loadStock} className="btn-gho mt-3 text-sm px-4">Coba Lagi</button>
      </div>
    );
  }

  if (!stock) return null;

  const pct12 = stock.hmtQuota12 > 0 ? Math.round((stock.kg12HmtQty / stock.hmtQuota12) * 100) : 0;
  const pct50 = stock.hmtQuota50 > 0 ? Math.round((stock.kg50HmtQty / stock.hmtQuota50) * 100) : 0;

  function StockCard({ label, fullQty, emptyQty, transitQty, hmtQty, kuotaWo, hmtQuota, pct }:
    { label: string; fullQty: number; emptyQty: number; transitQty: number; hmtQty: number; kuotaWo: number; hmtQuota: number; pct: number }) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">{label}</h3>
          {stock?.stockDate && (
            <span className="text-xs text-[var(--text-muted)]">{fmtDate(stock.stockDate)}</span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Penuh", value: fullQty,  color: "text-green-400" },
            { label: "Kosong", value: emptyQty, color: "text-amber-400" },
            { label: "On Transit", value: transitQty, color: "text-blue-400" },
          ].map(item => (
            <div key={item.label} className="bg-[var(--bg-hover)] rounded-xl p-3 text-center">
              <p className={`text-xl font-bold font-mono ${item.color}`}>{item.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{item.label}</p>
            </div>
          ))}
        </div>

        {/* HMT Progress */}
        {hmtQuota > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--text-muted)]">HMT Terpakai</span>
              <span className={`font-semibold ${pct >= 80 ? "text-red-400" : "text-[var(--text-secondary)]"}`}>
                {hmtQty} / {hmtQuota} ({pct}%)
              </span>
            </div>
            <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-red-500" : "bg-blue-500"}`}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
            </div>
          </div>
        )}

        {/* Kuota WO */}
        <div className="flex items-center justify-between pt-1 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-muted)]">Kuota WO</span>
          <span className="text-xs font-semibold text-[var(--text-secondary)] font-mono">{kuotaWo}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {stock.branch?.name ?? stock.branchId}
        </p>
        <button onClick={loadStock} className="btn-gho text-xs px-3 py-1.5 gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.18-4.97"/>
          </svg>
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StockCard label="Tabung 12 kg" fullQty={stock.kg12FullQty} emptyQty={stock.kg12EmptyQty}
          transitQty={stock.kg12OnTransitQty} hmtQty={stock.kg12HmtQty} kuotaWo={stock.kg12KuotaWo}
          hmtQuota={stock.hmtQuota12} pct={pct12}/>
        <StockCard label="Tabung 50 kg" fullQty={stock.kg50FullQty} emptyQty={stock.kg50EmptyQty}
          transitQty={stock.kg50OnTransitQty} hmtQty={stock.kg50HmtQty} kuotaWo={stock.kg50KuotaWo}
          hmtQuota={stock.hmtQuota50} pct={pct50}/>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Inbound GR
// ──────────────────────────────────────────────────────────────────────────────
function InboundTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [records, setRecords] = useState<InboundRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const loadInbound = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouse/inbound?branchId=${activeBranchId}&limit=20`);
      if (!res.ok) throw new Error("Gagal memuat data penerimaan");
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadInbound(); }, [loadInbound]);

  if (!activeBranchId) {
    return (
      <div className="empty-state py-16">
        <p className="empty-state-title">Pilih Branch</p>
        <p className="empty-state-desc">Gunakan branch switcher di atas untuk memilih cabang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">{total} penerimaan tercatat</p>
        <Link href="/warehouse/inbound/add" className="btn-pri text-sm gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Catat Penerimaan
        </Link>
      </div>

      {loading && (
        <div className="card p-5 animate-pulse space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-12 bg-[var(--bg-hover)] rounded-lg"/>)}
        </div>
      )}

      {error && (
        <div className="empty-state py-12">
          <p className="empty-state-title text-red-400">{error}</p>
          <button onClick={loadInbound} className="btn-gho mt-3 text-sm">Coba Lagi</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="empty-state py-16">
          <p className="empty-state-title">Belum Ada Penerimaan</p>
          <p className="empty-state-desc">Catat penerimaan tabung dari supplier.</p>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. GR</th>
                <th>Tanggal</th>
                <th>PO Ref</th>
                <th className="num">12 kg Baik</th>
                <th className="num">12 kg Reject</th>
                <th className="num">50 kg Baik</th>
                <th className="num">50 kg Reject</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold text-[var(--text-primary)]">{r.grNumber}</td>
                  <td>{fmtDate(r.receivedAt)}</td>
                  <td className="text-[var(--text-muted)]">{r.supplierPo?.poNumber ?? "—"}</td>
                  <td className="num text-green-400 font-mono">{r.kg12Good}</td>
                  <td className="num text-red-400 font-mono">{r.kg12Reject}</td>
                  <td className="num text-green-400 font-mono">{r.kg50Good}</td>
                  <td className="num text-red-400 font-mono">{r.kg50Reject}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Returns (Sprint 5 — real implementation)
// ──────────────────────────────────────────────────────────────────────────────
function ReturnsTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const loadReturns = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouse/empty-return?branchId=${activeBranchId}&limit=20`);
      if (!res.ok) throw new Error("Gagal memuat data return");
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadReturns(); }, [loadReturns]);

  if (!activeBranchId) {
    return (
      <div className="empty-state py-16">
        <p className="empty-state-title">Pilih Branch</p>
        <p className="empty-state-desc">Gunakan branch switcher di atas untuk memilih cabang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">{total} return tercatat</p>
        <Link href="/warehouse/returns/add" className="btn-pri text-sm gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Catat Return
        </Link>
      </div>

      {loading && (
        <div className="card p-5 animate-pulse space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-12 bg-[var(--bg-hover)] rounded-lg"/>)}
        </div>
      )}

      {error && (
        <div className="empty-state py-12">
          <p className="empty-state-title text-red-400">{error}</p>
          <button onClick={loadReturns} className="btn-gho mt-3 text-sm">Coba Lagi</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="empty-state py-16">
          <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
          </svg>
          <p className="empty-state-title">Belum Ada Return</p>
          <p className="empty-state-desc">Catat penerimaan tabung kosong dari pelanggan, driver, atau depo.</p>
          <Link href="/warehouse/returns/add" className="btn-pri mt-4 text-sm">Catat Return</Link>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Return</th>
                <th>Tanggal</th>
                <th>Sumber</th>
                <th>Dari</th>
                <th className="num">12 kg</th>
                <th className="num">50 kg</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold text-[var(--text-primary)]">{r.returnNumber}</td>
                  <td>{fmtDate(r.returnedAt)}</td>
                  <td>
                    <span className={`chip text-xs ${
                      r.source === "CUSTOMER" ? "bg-blue-500/10 text-blue-400" :
                      r.source === "DRIVER"   ? "bg-purple-500/10 text-purple-400" :
                                                "bg-amber-500/10 text-amber-400"
                    }`}>
                      {SOURCE_LABEL[r.source]}
                    </span>
                  </td>
                  <td className="text-[var(--text-secondary)]">
                    {r.customer?.name ?? r.driver?.displayName ?? "—"}
                  </td>
                  <td className="num font-mono text-[var(--text-primary)]">{r.kg12Qty}</td>
                  <td className="num font-mono text-[var(--text-primary)]">{r.kg50Qty}</td>
                  <td className="text-[var(--text-muted)] text-xs max-w-[140px] truncate">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab: Write-offs (Sprint 5 — real implementation)
// ──────────────────────────────────────────────────────────────────────────────
function WriteoffTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [records, setRecords] = useState<WriteoffRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const loadWriteoffs = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/warehouse/writeoff?branchId=${activeBranchId}&limit=20`);
      if (!res.ok) throw new Error("Gagal memuat data write-off");
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadWriteoffs(); }, [loadWriteoffs]);

  if (!activeBranchId) {
    return (
      <div className="empty-state py-16">
        <p className="empty-state-title">Pilih Branch</p>
        <p className="empty-state-desc">Gunakan branch switcher di atas untuk memilih cabang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">{total} write-off tercatat</p>
        <Link href="/warehouse/writeoff/add" className="btn-pri text-sm gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Catat Write-off
        </Link>
      </div>

      {loading && (
        <div className="card p-5 animate-pulse space-y-3">
          {[0,1,2].map(i => <div key={i} className="h-12 bg-[var(--bg-hover)] rounded-lg"/>)}
        </div>
      )}

      {error && (
        <div className="empty-state py-12">
          <p className="empty-state-title text-red-400">{error}</p>
          <button onClick={loadWriteoffs} className="btn-gho mt-3 text-sm">Coba Lagi</button>
        </div>
      )}

      {!loading && !error && records.length === 0 && (
        <div className="empty-state py-16">
          <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          <p className="empty-state-title">Belum Ada Write-off</p>
          <p className="empty-state-desc">Catat tabung yang rusak, hilang, atau kadaluarsa uji.</p>
          <Link href="/warehouse/writeoff/add" className="btn-pri mt-4 text-sm">Catat Write-off</Link>
        </div>
      )}

      {!loading && !error && records.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Write-off</th>
                <th>Tanggal</th>
                <th>Alasan</th>
                <th className="num">12 kg</th>
                <th className="num">50 kg</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="font-mono font-semibold text-[var(--text-primary)]">{r.writeoffNumber}</td>
                  <td>{fmtDate(r.writeoffAt)}</td>
                  <td>
                    <span className={`chip text-xs ${
                      r.reason === "HILANG"         ? "bg-red-500/10 text-red-400"    :
                      r.reason === "RUSAK_BERAT"    ? "bg-amber-500/10 text-amber-400" :
                      r.reason === "BOCOR_PARAH"    ? "bg-orange-500/10 text-orange-400" :
                                                      "bg-purple-500/10 text-purple-400"
                    }`}>
                      {REASON_LABEL[r.reason]}
                    </span>
                  </td>
                  <td className="num font-mono text-red-400">{r.kg12Qty > 0 ? `−${r.kg12Qty}` : "—"}</td>
                  <td className="num font-mono text-red-400">{r.kg50Qty > 0 ? `−${r.kg50Qty}` : "—"}</td>
                  <td className="text-[var(--text-muted)] text-xs max-w-[140px] truncate">{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tab config
// ──────────────────────────────────────────────────────────────────────────────
const TABS = [
  { key: "stock",    label: "Stock",          icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "inbound",  label: "Penerimaan (GR)", icon: "M5 12h14M12 5l7 7-7 7" },
  { key: "returns",  label: "Return Kosong",   icon: "M1 4 1 10 7 10" },
  { key: "writeoff", label: "Hapus Buku",      icon: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" },
];

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────
function WarehouseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const activeTab = searchParams.get("tab") ?? "stock";

  const setTab = (tab: string) => {
    router.push(`/warehouse?tab=${tab}`, { scroll: false });
  };

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Gudang</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manajemen stock, penerimaan, return kosong, dan hapus buku
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] w-fit overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon}/>
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "stock"    && <StockTab    activeBranchId={activeBranchId}/>}
        {activeTab === "inbound"  && <InboundTab  activeBranchId={activeBranchId}/>}
        {activeTab === "returns"  && <ReturnsTab  activeBranchId={activeBranchId}/>}
        {activeTab === "writeoff" && <WriteoffTab activeBranchId={activeBranchId}/>}
      </div>
    </div>
  );
}

export default function WarehousePage() {
  return (
    <Suspense fallback={
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-card)] rounded-lg w-40"/>
          <div className="h-10 bg-[var(--bg-card)] rounded-xl w-96"/>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-[var(--bg-card)] rounded-xl"/>
            <div className="h-48 bg-[var(--bg-card)] rounded-xl"/>
          </div>
        </div>
      </div>
    }>
      <WarehouseContent/>
    </Suspense>
  );
}