// app/(dashboard)/gasback/claims/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface LedgerEntry {
  id: string;
  txType: string;
  qty: number;
  amount: number;
  runningBalance: number;
  txDate: string;
  notes: string | null;
}

interface Claim {
  id: string;
  claimNumber: string;
  qty: number;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentRef: string | null;
  createdAt: string;
  notes: string | null;
  customer: { id: string; code: string; name: string; customerType: string };
  branch: { code: string; name: string };
  gasbackLedgers: LedgerEntry[];
}

function fmt(n: number) {
  return n.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-36 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] flex-1">{value ?? "—"}</span>
    </div>
  );
}

export default function ClaimDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [claim,      setClaim]      = useState<Claim | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [payRef,     setPayRef]     = useState("");
  const [marking,    setMarking]    = useState(false);
  const [markError,  setMarkError]  = useState<string | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);

  useEffect(() => {
    fetch(`/api/gasback/claims/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((d) => { if (d) setClaim(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleMarkPaid() {
    setMarking(true);
    setMarkError(null);
    try {
      const res = await fetch(`/api/gasback/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_paid", paymentRef: payRef || null }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal menandai lunas");
      }
      const updated = await res.json();
      setClaim((prev) => prev ? { ...prev, ...updated } : null);
      setShowPayForm(false);
      setPayRef("");
    } catch (e: unknown) {
      setMarkError(e instanceof Error ? e.message : "Error");
    } finally {
      setMarking(false);
    }
  }

  async function handleMarkUnpaid() {
    if (!confirm("Batalkan status lunas klaim ini?")) return;
    setMarking(true);
    try {
      const res = await fetch(`/api/gasback/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_unpaid" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setClaim((prev) => prev ? { ...prev, ...updated } : null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setMarking(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-[var(--surface-raised)] rounded w-1/3 mb-4"/>
            <div className="space-y-3">
              {[1,2,3].map(j => <div key={j} className="h-3 bg-[var(--surface-raised)] rounded w-full"/>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notFound || !claim) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Klaim tidak ditemukan</p>
            <Link href="/gasback/claims" className="btn-pri mt-4">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/gasback/claims" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <h1 className="page-title">{claim.claimNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              {claim.isPaid ? (
                <span className="chip text-xs bg-green-500/10 text-green-400">✓ Lunas</span>
              ) : (
                <span className="chip text-xs bg-amber-500/10 text-amber-400">⏳ Belum Dibayar</span>
              )}
              <span className="text-xs text-[var(--text-muted)]">{fmtDate(claim.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!claim.isPaid && !showPayForm && (
          <button
            onClick={() => setShowPayForm(true)}
            className="btn-pri"
          >
            ✓ Tandai Lunas
          </button>
        )}
        {claim.isPaid && (
          <button
            onClick={handleMarkUnpaid}
            disabled={marking}
            className="btn-gho text-xs text-amber-400 hover:border-amber-500/40"
          >
            Batalkan Lunas
          </button>
        )}
      </div>

      {/* Mark paid form */}
      {showPayForm && !claim.isPaid && (
        <div className="card border-amber-500/30 bg-amber-500/5 space-y-3">
          <h3 className="text-sm font-semibold text-amber-300">Konfirmasi Pembayaran</h3>
          {markError && <div className="form-error-banner">{markError}</div>}
          <div className="form-group">
            <label className="form-label text-xs">Referensi Pembayaran (opsional)</label>
            <input
              className="input-field"
              placeholder="No. transfer / kuitansi / dll"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleMarkPaid} disabled={marking} className="btn-pri">
              {marking ? "Menyimpan..." : "✓ Konfirmasi Lunas"}
            </button>
            <button onClick={() => { setShowPayForm(false); setMarkError(null); }} className="btn-gho">
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Claim info */}
      <div className="card">
        <h2 className="section-title mb-2">Detail Klaim</h2>
        <div className="section-divider mb-0"/>
        <InfoRow label="No. Klaim"   value={<span className="font-mono font-semibold">{claim.claimNumber}</span>} />
        <InfoRow label="Pelanggan"   value={
          <Link href={`/customers/${claim.customer.id}`} className="text-[var(--accent)] hover:underline">
            {claim.customer.name} <span className="font-mono text-xs text-[var(--text-muted)]">({claim.customer.code})</span>
          </Link>
        } />
        <InfoRow label="Cabang"      value={<span className="badge-neutral">{claim.branch.code}</span>} />
        <InfoRow label="Qty Klaim"   value={<span className="font-mono font-bold text-red-400">-{fmt(Number(claim.qty))} kg</span>} />
        <InfoRow label="Total Nilai" value={<span className="font-mono">{fmt(Number(claim.amount))}</span>} />
        <InfoRow label="Status"      value={
          claim.isPaid
            ? <span className="badge-success">✓ Lunas</span>
            : <span className="chip text-xs bg-amber-500/10 text-amber-400">Belum Dibayar</span>
        } />
        {claim.isPaid && (
          <>
            <InfoRow label="Tanggal Bayar" value={fmtDate(claim.paidAt)} />
            <InfoRow label="Ref. Bayar"    value={claim.paymentRef ?? "—"} />
          </>
        )}
        {claim.notes && <InfoRow label="Catatan" value={claim.notes} />}
        <InfoRow label="Dibuat"      value={fmtDate(claim.createdAt)} />
      </div>

      {/* Linked ledger entries */}
      {claim.gasbackLedgers.length > 0 && (
        <div className="card p-0">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="section-title">Entri Ledger Terkait</h2>
          </div>
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Tipe</th>
                  <th className="num">Amount</th>
                  <th className="num">Saldo</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {claim.gasbackLedgers.map((e) => (
                  <tr key={e.id}>
                    <td className="text-xs">{fmtDate(e.txDate)}</td>
                    <td>
                      <span className={`chip text-[11px] ${
                        e.txType === "DEBIT" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
                      }`}>
                        {e.txType}
                      </span>
                    </td>
                    <td className="num font-mono text-red-400">-{fmt(Number(e.amount))}</td>
                    <td className="num font-mono font-semibold text-[var(--text-primary)]">
                      {fmt(Number(e.runningBalance))}
                    </td>
                    <td className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{e.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quick nav */}
      <div className="flex items-center gap-3 text-sm">
        <Link href={`/gasback/ledger/${claim.customer.id}`} className="text-[var(--accent)] hover:underline">
          📒 Lihat semua riwayat gasback {claim.customer.name}
        </Link>
      </div>
    </div>
  );
}