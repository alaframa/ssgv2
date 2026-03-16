// app/(dashboard)/gasback/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CustomerRow {
  id: string;
  code: string;
  name: string;
  customerType: string;
  balance: number;
  balanceDate: string | null;
  unpaidClaims: number;
  canRedeem: boolean;
  progress: number;
}

interface BranchTotals {
  totalCredit: number;
  totalDebit: number;
  totalBalance: number;
}

interface Settings {
  gasback_rate_kg12: string;
  gasback_rate_kg50: string;
  redemption_threshold_kg: string;
  free_refill_size: string;
  return_ratio_denominator: string;
}

interface SummaryData {
  customers: CustomerRow[];
  total: number;
  pages: number;
  branchTotals: BranchTotals;
  settings: Settings;
  eligibleCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, string> = {
  RETAIL: "bg-blue-500/10 text-blue-400",
  AGEN: "bg-purple-500/10 text-purple-400",
  INDUSTRI: "bg-amber-500/10 text-amber-400",
};

function fmt(n: number) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function GasbackPage() {
  const { activeBranchId } = useBranch();

  const [data,    setData]    = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState<"all" | "eligible" | "has_balance">("all");

  const load = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        branchId: activeBranchId,
        page: String(page),
        limit: "30",
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/gasback/summary?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data gasback");
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, page, search]);

  useEffect(() => { setPage(1); }, [activeBranchId, search]);
  useEffect(() => { load(); }, [load]);

  const rows = data?.customers ?? [];
  const filteredRows = rows.filter((r) => {
    if (filter === "eligible")   return r.canRedeem;
    if (filter === "has_balance") return r.balance > 0;
    return true;
  });

  const threshold = data?.settings ? parseFloat(data.settings.redemption_threshold_kg) : 240;
  const freeSize  = data?.settings?.free_refill_size ?? "12";

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Gas Ledger — Gasback</h1>
          <p className="page-desc">
            Saldo gasback per pelanggan · klaim redemption · riwayat transaksi
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/gasback/claims" className="btn-gho text-sm">
            📋 Daftar Klaim
          </Link>
          <Link href="/gasback/claims/add" className="btn-pri text-sm">
            + Klaim Baru
          </Link>
        </div>
      </div>

      {/* Branch KPI Cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Total CREDIT</p>
            <p className="text-xl font-bold font-mono text-green-400">{fmt(data.branchTotals.totalCredit)} kg</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Akumulasi dari semua delivery</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Total DEBIT</p>
            <p className="text-xl font-bold font-mono text-red-400">{fmt(data.branchTotals.totalDebit)} kg</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Sudah diklaim / ditebus</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Saldo Bersih</p>
            <p className={`text-xl font-bold font-mono ${data.branchTotals.totalBalance >= 0 ? "text-[var(--text-primary)]" : "text-red-400"}`}>
              {fmt(data.branchTotals.totalBalance)} kg
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Outstanding di pelanggan</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Eligible Redeem</p>
            <p className="text-xl font-bold font-mono text-amber-400">{data.eligibleCount} pelanggan</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              ≥ {threshold} kg → 1 free {freeSize}kg
            </p>
          </div>
        </div>
      )}

      {/* Settings hint */}
      {data && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs text-[var(--text-muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--accent)]">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>
            Rasio: {data.settings.gasback_rate_kg12} kg gasback per tabung 12kg ·
            {" "}{data.settings.gasback_rate_kg50} kg per 50kg ·
            Threshold redeem: <strong className="text-[var(--text-primary)]">{threshold} kg</strong> →
            {" "}gratis isi tabung {freeSize} kg
          </span>
          <Link href="/settings/gasback" className="ml-auto shrink-0 text-[var(--accent)] hover:underline font-medium">
            ⚙ Ubah
          </Link>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input-field w-64"
          placeholder="Cari nama pelanggan..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1">
          {(["all", "eligible", "has_balance"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {f === "all" ? "Semua" : f === "eligible" ? "Bisa Redeem" : "Ada Saldo"}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)] ml-auto">
          {data?.total ?? 0} pelanggan
        </span>
      </div>

      {/* Error */}
      {error && <div className="form-error-banner">{error}</div>}

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="space-y-3 p-5">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-10 bg-[var(--surface-raised)] rounded animate-pulse" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="empty-state py-12">
            <p className="empty-state-title">Tidak ada data</p>
            <p className="empty-state-desc">Coba ubah filter atau kata kunci pencarian</p>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pelanggan</th>
                  <th>Tipe</th>
                  <th className="num">Saldo (kg)</th>
                  <th className="num">Progress Redeem</th>
                  <th className="num">Unpaid Claims</th>
                  <th>Per Tanggal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div>
                        <p className="font-semibold text-[var(--text-primary)] text-sm">{c.name}</p>
                        <p className="text-xs text-[var(--text-muted)] font-mono">{c.code}</p>
                      </div>
                    </td>
                    <td>
                      <span className={`chip text-xs ${TYPE_BADGE[c.customerType] ?? ""}`}>
                        {c.customerType}
                      </span>
                    </td>
                    <td className="num">
                      <span className={`font-mono font-semibold text-sm ${
                        c.balance > 0 ? "text-green-400" : c.balance < 0 ? "text-red-400" : "text-[var(--text-muted)]"
                      }`}>
                        {fmt(c.balance)}
                      </span>
                    </td>
                    <td className="num">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-24 h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              c.canRedeem ? "bg-amber-400" : "bg-[var(--accent)]"
                            }`}
                            style={{ width: `${Math.min(100, c.progress)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-[var(--text-muted)] w-10 text-right">
                          {c.progress.toFixed(0)}%
                        </span>
                        {c.canRedeem && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                            ✓ BISA
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="num">
                      {c.unpaidClaims > 0 ? (
                        <span className="font-mono text-sm text-red-400">
                          {fmt(c.unpaidClaims)}
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--text-muted)]">{fmtDate(c.balanceDate)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/gasback/ledger/${c.id}`}
                          className="text-xs text-[var(--accent)] hover:underline font-medium"
                        >
                          Riwayat
                        </Link>
                        {c.canRedeem && (
                          <Link
                            href={`/gasback/claims/add?customerId=${c.id}`}
                            className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded hover:bg-amber-500/25 transition-colors font-medium"
                          >
                            Redeem
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-gho text-sm"
          >
            ← Sebelumnya
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Hal {page} / {data.pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
            className="btn-gho text-sm"
          >
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  );
}