// app/(dashboard)/gasback/ledger/[customerId]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface LedgerEntry {
  id: string;
  txType: "CREDIT" | "DEBIT" | "ADJUSTMENT";
  qty: number;
  amount: number;
  runningBalance: number;
  txDate: string;
  notes: string | null;
  deliveryOrder: { doNumber: string } | null;
  claim: { claimNumber: string } | null;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  customerType: string;
}

interface LedgerData {
  entries: LedgerEntry[];
  total: number;
  pages: number;
  currentBalance: number;
  balanceDate: string | null;
}

const TX_BADGE: Record<string, string> = {
  CREDIT:     "bg-green-500/10 text-green-400",
  DEBIT:      "bg-red-500/10 text-red-400",
  ADJUSTMENT: "bg-blue-500/10 text-blue-400",
};

const TX_LABEL: Record<string, string> = {
  CREDIT:     "CREDIT",
  DEBIT:      "DEBIT",
  ADJUSTMENT: "ADJUST",
};

function fmt(n: number) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function CustomerGasbackLedgerPage() {
  const { customerId } = useParams<{ customerId: string }>();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [ledger,   setLedger]   = useState<LedgerData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [page,     setPage]     = useState(1);

  // Load customer info
  useEffect(() => {
    fetch(`/api/customers/${customerId}`)
      .then((r) => r.json())
      .then((d) => setCustomer({
        id: d.id, code: d.code, name: d.name, customerType: d.customerType,
      }))
      .catch(console.error);
  }, [customerId]);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/gasback/ledger?customerId=${customerId}&page=${page}&limit=50`
      );
      if (!res.ok) throw new Error("Gagal memuat ledger");
      setLedger(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [customerId, page]);

  useEffect(() => { loadLedger(); }, [loadLedger]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/gasback" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="page-title">
            Riwayat Gasback — {customer?.name ?? "..."}
          </h1>
          <p className="page-desc font-mono text-xs">{customer?.code}</p>
        </div>
        {customer && (
          <Link
            href={`/gasback/claims/add?customerId=${customer.id}`}
            className="btn-pri text-sm"
          >
            + Buat Klaim
          </Link>
        )}
      </div>

      {/* Balance card */}
      {ledger && (
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide mb-1">Saldo Gasback Saat Ini</p>
              <p className={`text-3xl font-bold font-mono ${
                ledger.currentBalance >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {fmt(ledger.currentBalance)} kg
              </p>
              {ledger.balanceDate && (
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Per {fmtDate(ledger.balanceDate)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--text-muted)] mb-1">Total entri</p>
              <p className="text-2xl font-bold text-[var(--text-primary)]">{ledger.total}</p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger table */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="section-title">Riwayat Transaksi</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {ledger?.total ?? 0} entri · Hal {page}/{ledger?.pages ?? 1}
          </span>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-10 bg-[var(--surface-raised)] rounded animate-pulse"/>
            ))}
          </div>
        ) : !ledger || ledger.entries.length === 0 ? (
          <div className="empty-state py-12">
            <p className="empty-state-title">Belum ada transaksi</p>
            <p className="empty-state-desc">Gasback akan muncul setelah ada delivery yang diselesaikan</p>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th>Referensi</th>
                  <th className="num">Qty (kg)</th>
                  <th className="num">Amount</th>
                  <th className="num">Saldo</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {ledger.entries.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs text-[var(--text-muted)]">{fmtDate(e.txDate)}</td>
                    <td>
                      <span className={`chip text-[11px] font-bold ${TX_BADGE[e.txType]}`}>
                        {TX_LABEL[e.txType]}
                      </span>
                    </td>
                    <td className="font-mono text-xs">
                      {e.deliveryOrder?.doNumber
                        ? <span className="text-[var(--accent)]">DO {e.deliveryOrder.doNumber}</span>
                        : e.claim?.claimNumber
                        ? <span className="text-red-400">{e.claim.claimNumber}</span>
                        : <span className="text-[var(--text-muted)]">—</span>
                      }
                    </td>
                    <td className={`num font-mono text-sm ${
                      e.txType === "CREDIT" ? "text-green-400" :
                      e.txType === "DEBIT"  ? "text-red-400"   : "text-blue-400"
                    }`}>
                      {e.txType === "DEBIT" ? "-" : "+"}{fmt(Number(e.qty))}
                    </td>
                    <td className={`num font-mono text-sm ${
                      e.txType === "CREDIT" ? "text-green-400" :
                      e.txType === "DEBIT"  ? "text-red-400"   : "text-blue-400"
                    }`}>
                      {e.txType === "DEBIT" ? "-" : "+"}{fmt(Number(e.amount))}
                    </td>
                    <td className="num font-mono font-semibold text-[var(--text-primary)]">
                      {fmt(Number(e.runningBalance))}
                    </td>
                    <td className="text-xs text-[var(--text-muted)] max-w-[180px] truncate">
                      {e.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {ledger && ledger.pages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-gho text-sm"
          >
            ← Sebelumnya
          </button>
          <span className="text-sm text-[var(--text-muted)]">Hal {page} / {ledger.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(ledger.pages, p + 1))}
            disabled={page === ledger.pages}
            className="btn-gho text-sm"
          >
            Berikutnya →
          </button>
        </div>
      )}
    </div>
  );
}