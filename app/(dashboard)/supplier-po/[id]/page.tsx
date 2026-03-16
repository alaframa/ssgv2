// app/(dashboard)/supplier-po/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GrRecord {
  id: string;
  grNumber: string;
  receivedAt: string;
  kg12Good: number;
  kg12Reject: number;
  kg50Good: number;
  kg50Reject: number;
  notes: string | null;
}

interface PoDetail {
  id: string;
  poNumber: string;
  status: string;
  kg12Qty: number;
  kg50Qty: number;
  confirmedAt: string | null;
  createdAt: string;
  notes: string | null;
  receivedKg12: number;
  receivedKg50: number;
  supplier: { id: string; name: string; code: string };
  branch: { code: string; name: string };
  inbounds: GrRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  DRAFT:               "bg-[var(--bg-hover)] text-[var(--text-muted)]",
  SUBMITTED:           "bg-blue-500/10 text-blue-400",
  CONFIRMED:           "bg-green-500/10 text-green-400",
  PARTIALLY_RECEIVED:  "bg-amber-500/10 text-amber-400",
  COMPLETED:           "bg-purple-500/10 text-purple-400",
  CANCELLED:           "bg-red-500/10 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT:               "Draft",
  SUBMITTED:           "Submitted",
  CONFIRMED:           "Confirmed",
  PARTIALLY_RECEIVED:  "Partial Received",
  COMPLETED:           "Completed",
  CANCELLED:           "Dibatalkan",
};

// Which actions are available per status
const STATUS_ACTIONS: Record<string, { to: string; label: string; style: string }[]> = {
  DRAFT: [
    { to: "SUBMITTED",  label: "Submit ke Supplier",  style: "btn-pri"  },
    { to: "CANCELLED",  label: "Batalkan PO",         style: "btn-gho text-red-400 hover:border-red-500/40" },
  ],
  SUBMITTED: [
    { to: "CONFIRMED",  label: "Konfirmasi (Approve)", style: "btn-pri" },
    { to: "CANCELLED",  label: "Batalkan PO",          style: "btn-gho text-red-400 hover:border-red-500/40" },
  ],
  CONFIRMED: [
    { to: "CANCELLED",  label: "Batalkan PO",          style: "btn-gho text-red-400 hover:border-red-500/40" },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function fmtShort(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function ProgressBar({ received, total, label, color }: {
  received: number; total: number; label: string; color: string
}) {
  const pct = total > 0 ? Math.min(100, Math.round((received / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--text-muted)]">{label}</span>
        <span className={`font-semibold font-mono ${pct >= 100 ? "text-green-400" : "text-[var(--text-secondary)]"}`}>
          {received.toLocaleString("id-ID")} / {total.toLocaleString("id-ID")} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] flex-1">{value ?? "—"}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SupplierPoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [po,      setPo]      = useState<PoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error("PO tidak ditemukan");
      setPo(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Status action ──────────────────────────────────────────────────────────
  async function handleAction(toStatus: string) {
    setActionError(null);
    setActioning(true);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Gagal mengubah status");
      }
      await load(); // Reload detail
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActioning(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-[var(--bg-card)] rounded-lg w-64"/>
        <div className="card p-5 space-y-3">
          {[0,1,2,3].map(i => <div key={i} className="h-4 bg-[var(--bg-hover)] rounded"/>)}
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <div className="empty-state py-16">
          <p className="empty-state-title text-red-400">{error ?? "PO tidak ditemukan"}</p>
          <button onClick={() => router.push("/supplier-po")} className="btn-gho mt-4">
            Kembali ke List
          </button>
        </div>
      </div>
    );
  }

  const actions = STATUS_ACTIONS[po.status] ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
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
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-mono text-[var(--text-primary)]">{po.poNumber}</h1>
              <span className={`chip text-xs font-medium ${STATUS_BADGE[po.status] ?? ""}`}>
                {STATUS_LABEL[po.status] ?? po.status}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {po.supplier.name} · {po.branch.name}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {actions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {actions.map(action => (
              <button
                key={action.to}
                onClick={() => handleAction(action.to)}
                disabled={actioning}
                className={`${action.style} text-sm disabled:opacity-50`}
              >
                {actioning ? "..." : action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {actionError}
        </div>
      )}

      {/* Status flow indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          {["DRAFT", "SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED", "COMPLETED"].map((s, idx, arr) => {
            const statuses = ["DRAFT", "SUBMITTED", "CONFIRMED", "PARTIALLY_RECEIVED", "COMPLETED"];
            const curIdx   = statuses.indexOf(po.status);
            const thisIdx  = statuses.indexOf(s);
            const isPast    = thisIdx < curIdx;
            const isCurrent = s === po.status;

            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  po.status === "CANCELLED"
                    ? "bg-[var(--bg-hover)] text-[var(--text-muted)]"
                    : isCurrent
                    ? "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30"
                    : isPast
                    ? "bg-green-500/10 text-green-400"
                    : "bg-[var(--bg-hover)] text-[var(--text-muted)] opacity-50"
                }`}>
                  {isPast && po.status !== "CANCELLED" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {STATUS_LABEL[s]}
                </div>
                {idx < arr.length - 1 && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" className="text-[var(--text-muted)] opacity-40">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                )}
              </div>
            );
          })}
          {po.status === "CANCELLED" && (
            <span className="ml-2 chip bg-red-500/10 text-red-400 text-xs">Dibatalkan</span>
          )}
        </div>
      </div>

      {/* PO Info */}
      <div className="card p-5">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide mb-3">Informasi PO</h2>
        <InfoRow label="Supplier"  value={<span>{po.supplier.name} <span className="text-[var(--text-muted)]">({po.supplier.code})</span></span>} />
        <InfoRow label="Branch"    value={po.branch.name} />
        <InfoRow label="Tgl Buat"  value={fmtDate(po.createdAt)} />
        <InfoRow label="Tgl Konfirm" value={po.confirmedAt ? fmtDate(po.confirmedAt) : "—"} />
        <InfoRow label="Catatan"   value={po.notes ?? "—"} />
      </div>

      {/* Quantities + Progress */}
      <div className="card p-5 space-y-4">
        <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Kuantitas & Penerimaan</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-[var(--bg-hover)] p-4 text-center space-y-1">
            <p className="text-xs text-[var(--text-muted)]">12 kg — Dipesan</p>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {po.kg12Qty.toLocaleString("id-ID")}
            </p>
            <p className="text-xs text-[var(--text-muted)]">tabung</p>
          </div>
          <div className="rounded-xl bg-[var(--bg-hover)] p-4 text-center space-y-1">
            <p className="text-xs text-[var(--text-muted)]">50 kg — Dipesan</p>
            <p className="text-2xl font-bold font-mono text-[var(--text-primary)]">
              {po.kg50Qty.toLocaleString("id-ID")}
            </p>
            <p className="text-xs text-[var(--text-muted)]">tabung</p>
          </div>
        </div>

        {/* Received progress bars */}
        {(po.kg12Qty > 0 || po.kg50Qty > 0) && (
          <div className="space-y-3 pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)]">Progress Penerimaan</p>
            {po.kg12Qty > 0 && (
              <ProgressBar
                received={po.receivedKg12}
                total={po.kg12Qty}
                label="12 kg diterima"
                color={po.receivedKg12 >= po.kg12Qty ? "bg-green-500" : "bg-blue-500"}
              />
            )}
            {po.kg50Qty > 0 && (
              <ProgressBar
                received={po.receivedKg50}
                total={po.kg50Qty}
                label="50 kg diterima"
                color={po.receivedKg50 >= po.kg50Qty ? "bg-green-500" : "bg-amber-500"}
              />
            )}
          </div>
        )}
      </div>

      {/* Inbound GR Records */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">
            Penerimaan Barang (GR) terkait PO ini
          </h2>
          {["CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status) && (
            <Link href="/warehouse/inbound/add" className="btn-pri py-1.5 px-3 text-xs gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Catat GR
            </Link>
          )}
        </div>

        {po.inbounds.length === 0 ? (
          <div className="empty-state py-10">
            <p className="empty-state-title">Belum ada GR</p>
            <p className="empty-state-desc">
              {["CONFIRMED", "PARTIALLY_RECEIVED"].includes(po.status)
                ? "Catat penerimaan barang setelah supplier mengirim."
                : "PO belum dalam status Confirmed."}
            </p>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. GR</th>
                  <th>Tanggal</th>
                  <th className="num">12kg Baik</th>
                  <th className="num">12kg Reject</th>
                  <th className="num">50kg Baik</th>
                  <th className="num">50kg Reject</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {po.inbounds.map(gr => (
                  <tr key={gr.id}>
                    <td className="font-mono font-semibold text-[var(--text-primary)]">{gr.grNumber}</td>
                    <td>{fmtShort(gr.receivedAt)}</td>
                    <td className="num text-green-400 font-mono">{gr.kg12Good}</td>
                    <td className="num text-red-400 font-mono">{gr.kg12Reject}</td>
                    <td className="num text-green-400 font-mono">{gr.kg50Good}</td>
                    <td className="num text-red-400 font-mono">{gr.kg50Reject}</td>
                    <td className="text-[var(--text-muted)] text-xs max-w-[120px] truncate">{gr.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--border)]">
                  <td colSpan={2} className="text-xs font-semibold text-[var(--text-muted)] px-4 py-2">Total Diterima</td>
                  <td className="num font-bold text-green-400 font-mono">{po.receivedKg12}</td>
                  <td className="num"/>
                  <td className="num font-bold text-green-400 font-mono">{po.receivedKg50}</td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}