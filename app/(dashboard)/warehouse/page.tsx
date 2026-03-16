// app/(dashboard)/warehouse/page.tsx
"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

// ── Types ──────────────────────────────────────────────────────────────────────
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
  supplierPo: {
    poNumber: string;
    status: string;
    supplier: { name: string };
  } | null;
}

// ── Helper: HMT Progress Bar ───────────────────────────────────────────────────
function HmtBar({ used, quota, label }: { used: number; quota: number; label: string }) {
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  const color =
    pct >= 80 ? "bg-red-500" : pct >= 60 ? "bg-amber-400" : "bg-emerald-500";
  const textColor =
    pct >= 80 ? "text-red-400" : pct >= 60 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--text-muted)]">{label}</span>
        <span className={`text-xs font-bold font-mono ${textColor}`}>
          {used.toLocaleString("id-ID")} / {quota.toLocaleString("id-ID")}
          <span className="text-[var(--text-muted)] font-normal ml-1">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Stock Card component ──────────────────────────────────────────────────────
function StockCard({
  size,
  full,
  empty,
  onTransit,
  hmtUsed,
  kuotaWo,
  hmtQuota,
}: {
  size: "12" | "50";
  full: number;
  empty: number;
  onTransit: number;
  hmtUsed: number;
  kuotaWo: number;
  hmtQuota: number;
}) {
  const accent = size === "12" ? "blue" : "amber";
  const accentClass = size === "12" ? "text-blue-400 bg-blue-500/10" : "text-amber-400 bg-amber-500/10";
  const borderClass = size === "12" ? "border-blue-500/20" : "border-amber-500/20";
  const total = full + empty + onTransit;

  return (
    <div className={`card p-5 border ${borderClass}`}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg ${accentClass} flex items-center justify-center`}>
          <span className={`text-sm font-bold ${size === "12" ? "text-blue-400" : "text-amber-400"}`}>
            {size}
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-[var(--text-primary)]">Tabung {size} kg</p>
          <p className="text-xs text-[var(--text-muted)]">Total: {total.toLocaleString("id-ID")} tabung</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <p className="text-lg font-bold font-mono text-emerald-400">{full.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Isi (Full)</p>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border)]">
          <p className="text-lg font-bold font-mono text-[var(--text-secondary)]">{empty.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Kosong</p>
        </div>
        <div className="text-center p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20">
          <p className="text-lg font-bold font-mono text-purple-400">{onTransit.toLocaleString("id-ID")}</p>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mt-0.5">Transit</p>
        </div>
      </div>

      {/* HMT + Kuota WO */}
      <div className="pt-3 border-t border-[var(--border)] space-y-3">
        <HmtBar
          used={hmtUsed}
          quota={hmtQuota}
          label={`HMT ${size}kg Quota`}
        />
        <div className="flex justify-between items-center text-xs">
          <span className="text-[var(--text-muted)]">Kuota WO</span>
          <span className="font-mono font-semibold text-[var(--text-secondary)]">
            {kuotaWo.toLocaleString("id-ID")} tbg
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Stock ────────────────────────────────────────────────────────────────
function StockTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [stock, setStock] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStock = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/warehouse/stock?branchId=${activeBranchId}`);
      if (!res.ok) throw new Error("Gagal memuat data stock");
      setStock(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
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
        {[0, 1].map((i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-[var(--bg-hover)] rounded w-32 mb-4" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="h-16 bg-[var(--bg-hover)] rounded-lg" />
              ))}
            </div>
            <div className="mt-4 h-2 bg-[var(--bg-hover)] rounded-full" />
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

  return (
    <div className="space-y-4">
      {/* Branch + date info */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            {stock.branch?.name ?? stock.branchId}
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {stock.stockDate
              ? `Data per ${new Date(stock.stockDate).toLocaleDateString("id-ID", {
                  day: "numeric", month: "long", year: "numeric",
                })} (carry-forward)`
              : "Belum ada data stock"}
          </p>
        </div>
        <button
          onClick={loadStock}
          className="p-2 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          title="Refresh"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      {/* Stock cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StockCard
          size="12"
          full={stock.kg12FullQty}
          empty={stock.kg12EmptyQty}
          onTransit={stock.kg12OnTransitQty}
          hmtUsed={stock.kg12HmtQty}
          kuotaWo={stock.kg12KuotaWo}
          hmtQuota={stock.hmtQuota12}
        />
        <StockCard
          size="50"
          full={stock.kg50FullQty}
          empty={stock.kg50EmptyQty}
          onTransit={stock.kg50OnTransitQty}
          hmtUsed={stock.kg50HmtQty}
          kuotaWo={stock.kg50KuotaWo}
          hmtQuota={stock.hmtQuota50}
        />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-1">
        {[
          { color: "bg-emerald-500", label: "Isi — siap dikirim" },
          { color: "bg-[var(--bg-hover)] border border-[var(--border)]", label: "Kosong — menunggu isi" },
          { color: "bg-purple-500", label: "On-transit — dalam pengiriman" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-xs text-[var(--text-muted)]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Inbound ──────────────────────────────────────────────────────────────
function InboundTab({ activeBranchId }: { activeBranchId: string | null }) {
  const [records, setRecords] = useState<InboundRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/warehouse/inbound?branchId=${activeBranchId}&page=${page}`
      );
      if (!res.ok) throw new Error();
      const d = await res.json();
      setRecords(d.records ?? []);
      setTotal(d.total ?? 0);
      setPages(d.pages ?? 1);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const STATUS_BADGE: Record<string, string> = {
    DRAFT: "badge-neutral",
    SUBMITTED: "badge-info",
    CONFIRMED: "badge-success",
    PARTIALLY_RECEIVED: "badge-warning",
    COMPLETED: "badge-purple",
    CANCELLED: "badge-error",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--text-muted)]">
          {total} record penerimaan
        </p>
        <Link href="/warehouse/inbound/add" className="btn-pri text-sm px-4 py-1.5 flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Catat GR
        </Link>
      </div>

      {loading ? (
        <div className="card p-0 animate-pulse">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 px-4 py-3 border-b border-[var(--border)]">
              <div className="h-4 bg-[var(--bg-hover)] rounded flex-1" />
              <div className="h-4 bg-[var(--bg-hover)] rounded w-24" />
              <div className="h-4 bg-[var(--bg-hover)] rounded w-16" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state py-14">
          <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <p className="empty-state-title">Belum ada penerimaan</p>
          <p className="empty-state-desc">Klik "Catat GR" untuk merekam penerimaan tabung dari supplier.</p>
          <Link href="/warehouse/inbound/add" className="btn-pri mt-4 text-sm px-5">
            Catat GR Pertama
          </Link>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nomor GR</th>
                  <th>Tanggal</th>
                  <th>Supplier PO</th>
                  <th className="num">12kg Good</th>
                  <th className="num">12kg Reject</th>
                  <th className="num">50kg Good</th>
                  <th className="num">50kg Reject</th>
                  <th>Status PO</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                      {r.grNumber}
                    </td>
                    <td className="text-sm text-[var(--text-secondary)]">{fmtDate(r.receivedAt)}</td>
                    <td className="text-sm">
                      {r.supplierPo ? (
                        <div>
                          <p className="font-mono text-xs text-[var(--text-primary)]">{r.supplierPo.poNumber}</p>
                          <p className="text-[var(--text-muted)] text-xs">{r.supplierPo.supplier.name}</p>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs italic">Tanpa PO</span>
                      )}
                    </td>
                    <td className="num font-mono text-emerald-400 font-semibold">{r.kg12Good}</td>
                    <td className="num font-mono text-red-400">{r.kg12Reject}</td>
                    <td className="num font-mono text-emerald-400 font-semibold">{r.kg50Good}</td>
                    <td className="num font-mono text-red-400">{r.kg50Reject}</td>
                    <td>
                      {r.supplierPo ? (
                        <span className={`badge ${STATUS_BADGE[r.supplierPo.status] ?? "badge-neutral"}`}>
                          {r.supplierPo.status}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-[var(--text-muted)]">
                Halaman {page} dari {pages} ({total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-gho text-sm px-3 py-1 disabled:opacity-40"
                >
                  ← Sebelumnya
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="btn-gho text-sm px-3 py-1 disabled:opacity-40"
                >
                  Selanjutnya →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Returns (Sprint 5 placeholder) ───────────────────────────────────────
function ReturnsTab() {
  return (
    <div className="empty-state py-16">
      <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
      </svg>
      <p className="empty-state-title">Return Tabung Kosong</p>
      <p className="empty-state-desc">Fitur ini akan tersedia di Sprint 5.</p>
    </div>
  );
}

// ── Tab: Write-offs (Sprint 5 placeholder) ────────────────────────────────────
function WriteoffTab() {
  return (
    <div className="empty-state py-16">
      <svg className="mx-auto mb-3 text-[var(--text-muted)] opacity-40" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
      <p className="empty-state-title">Hapus Buku (Write-off)</p>
      <p className="empty-state-desc">Fitur ini akan tersedia di Sprint 5.</p>
    </div>
  );
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { key: "stock",    label: "Stock",          icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
  { key: "inbound",  label: "Penerimaan (GR)", icon: "M5 12h14M12 5l7 7-7 7" },
  { key: "returns",  label: "Return Kosong",   icon: "M1 4 1 10 7 10M3.51 15a9 9 0 1 0 .49-4.5" },
  { key: "writeoff", label: "Hapus Buku",      icon: "M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" },
];

// ── Main Page ─────────────────────────────────────────────────────────────────
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Gudang</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Manajemen stock, penerimaan, dan pengelolaan tabung
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-blue-600 text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {activeTab === "stock" && <StockTab activeBranchId={activeBranchId} />}
        {activeTab === "inbound" && <InboundTab activeBranchId={activeBranchId} />}
        {activeTab === "returns" && <ReturnsTab />}
        {activeTab === "writeoff" && <WriteoffTab />}
      </div>
    </div>
  );
}

export default function WarehousePage() {
  return (
    <Suspense fallback={
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[var(--bg-card)] rounded-lg w-40" />
          <div className="h-10 bg-[var(--bg-card)] rounded-xl w-96" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-48 bg-[var(--bg-card)] rounded-xl" />
            <div className="h-48 bg-[var(--bg-card)] rounded-xl" />
          </div>
        </div>
      </div>
    }>
      <WarehouseContent />
    </Suspense>
  );
}