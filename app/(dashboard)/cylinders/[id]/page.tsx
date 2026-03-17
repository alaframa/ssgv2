// app/(dashboard)/cylinders/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type CylinderStatus   = "WAREHOUSE_FULL" | "WAREHOUSE_EMPTY" | "IN_TRANSIT" | "WITH_CUSTOMER" | "RETURNED_TO_SUPPLIER" | "WRITTEN_OFF";
type CylinderCondition = "GOOD" | "DAMAGED" | "NEEDS_INSPECTION" | "CONDEMNED";
type EventType = "RECEIVED_FROM_SUPPLIER" | "DISPATCHED_TO_CUSTOMER" | "RETURNED_FROM_CUSTOMER" | "TRANSFERRED_BETWEEN_BRANCH" | "WRITTEN_OFF" | "INSPECTION";

interface CylinderEvent {
  id: string;
  eventType: EventType;
  eventAt: string;
  condition: CylinderCondition;
  notes: string | null;
  recordedBy: string | null;
  weightDispatchedKg: string | null;
  weightReturnedKg: string | null;
  gasbackKg: string | null;
  customer: { id: string; name: string; code: string; phone?: string } | null;
  deliveryOrder: { id: string; doNumber: string; doDate: string; driver?: { displayName: string } } | null;
  emptyReturn: { id: string; returnNumber: string; returnedAt: string; source: string } | null;
  writeoff: { id: string; writeoffNumber: string; reason: string; writeoffAt: string } | null;
  gasbackLedgers: { id: string; txType: string; amount: string; runningBalance: string; txDate: string; customer?: { name: string } }[];
}

interface HistoryData {
  unit: {
    id: string;
    serialCode: string;
    status: CylinderStatus;
    condition: CylinderCondition;
    locationNote: string | null;
    tareWeightKg: string | null;
    notes: string | null;
    isActive: boolean;
    type: { size: string; label: string };
    branch: { code: string; name: string };
  };
  events: CylinderEvent[];
  summary: {
    totalEvents: number;
    uniqueCustomers: { id: string; name: string; code: string }[];
    totalGasbackKg: number;
    currentStatus: CylinderStatus;
    currentCondition: CylinderCondition;
  };
}

const STATUS_LABEL: Record<CylinderStatus, string> = {
  WAREHOUSE_FULL: "Gudang — Isi",
  WAREHOUSE_EMPTY: "Gudang — Kosong",
  IN_TRANSIT: "Dalam Perjalanan",
  WITH_CUSTOMER: "Di Pelanggan",
  RETURNED_TO_SUPPLIER: "Kembali ke Supplier",
  WRITTEN_OFF: "Dihapus",
};

const STATUS_COLOR: Record<CylinderStatus, string> = {
  WAREHOUSE_FULL: "bg-green-500/15 text-green-400",
  WAREHOUSE_EMPTY: "bg-gray-500/15 text-gray-400",
  IN_TRANSIT: "bg-yellow-500/15 text-yellow-400",
  WITH_CUSTOMER: "bg-blue-500/15 text-blue-400",
  RETURNED_TO_SUPPLIER: "bg-purple-500/15 text-purple-400",
  WRITTEN_OFF: "bg-red-500/15 text-red-400",
};

const CONDITION_COLOR: Record<CylinderCondition, string> = {
  GOOD: "bg-green-500/10 text-green-400",
  DAMAGED: "bg-red-500/10 text-red-400",
  NEEDS_INSPECTION: "bg-amber-500/10 text-amber-400",
  CONDEMNED: "bg-red-700/10 text-red-500",
};

const EVENT_CONFIG: Record<EventType, { icon: string; label: string; color: string }> = {
  RECEIVED_FROM_SUPPLIER:     { icon: "📦", label: "Terima dari Supplier",   color: "border-green-500/40" },
  DISPATCHED_TO_CUSTOMER:     { icon: "🚚", label: "Kirim ke Pelanggan",     color: "border-blue-500/40" },
  RETURNED_FROM_CUSTOMER:     { icon: "↩️", label: "Kembali dari Pelanggan", color: "border-amber-500/40" },
  TRANSFERRED_BETWEEN_BRANCH: { icon: "↔️", label: "Transfer Antar Cabang",  color: "border-purple-500/40" },
  WRITTEN_OFF:                { icon: "🗑️", label: "Dihapus / Write-off",    color: "border-red-500/40" },
  INSPECTION:                 { icon: "🔍", label: "Inspeksi",               color: "border-gray-500/40" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtKg(v: string | number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return `${Number(v).toFixed(3)} kg`;
}

// ─── Event Card ───────────────────────────────────────────────────────────────
function EventCard({ event }: { event: CylinderEvent }) {
  const cfg = EVENT_CONFIG[event.eventType] ?? { icon: "•", label: event.eventType, color: "border-gray-500/20" };
  const hasWeight = event.weightDispatchedKg || event.weightReturnedKg;

  return (
    <div className={`relative pl-8`}>
      {/* Timeline dot */}
      <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center text-xs">
        {cfg.icon}
      </div>

      <div className={`card border-l-2 ${cfg.color} p-4 space-y-2`}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{cfg.label}</p>
            <p className="text-xs text-[var(--text-muted)]">{fmtDate(event.eventAt)}</p>
          </div>
          <span className={`chip text-xs ${CONDITION_COLOR[event.condition]}`}>
            {event.condition}
          </span>
        </div>

        {/* Customer info */}
        {event.customer && (
          <div className="text-sm">
            <span className="text-[var(--text-muted)] text-xs">Pelanggan: </span>
            <Link href={`/customers/${event.customer.id}`} className="text-[var(--accent)] hover:underline font-medium">
              {event.customer.name}
            </Link>
            <span className="text-[var(--text-muted)] text-xs ml-1">({event.customer.code})</span>
          </div>
        )}

        {/* DO reference */}
        {event.deliveryOrder && (
          <div className="text-xs text-[var(--text-muted)]">
            DO: <Link href={`/delivery/${event.deliveryOrder.id}`} className="text-[var(--accent)] hover:underline">
              {event.deliveryOrder.doNumber}
            </Link>
            {event.deliveryOrder.driver && (
              <span className="ml-2">· Driver: {event.deliveryOrder.driver.displayName}</span>
            )}
          </div>
        )}

        {/* Return reference */}
        {event.emptyReturn && (
          <div className="text-xs text-[var(--text-muted)]">
            Return: <span className="font-mono text-[var(--text-secondary)]">{event.emptyReturn.returnNumber}</span>
            <span className="ml-2">· Sumber: {event.emptyReturn.source}</span>
          </div>
        )}

        {/* Weight measurements — the core gasback info */}
        {hasWeight && (
          <div className="rounded-lg bg-[var(--surface)] p-3 mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {event.weightDispatchedKg && (
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Berat Saat Kirim</p>
                <p className="font-mono font-semibold text-sm text-blue-400">{fmtKg(event.weightDispatchedKg)}</p>
              </div>
            )}
            {event.weightReturnedKg && (
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Berat Kembali</p>
                <p className="font-mono font-semibold text-sm text-amber-400">{fmtKg(event.weightReturnedKg)}</p>
              </div>
            )}
            {event.gasbackKg && (
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Gasback (sisa gas)</p>
                <p className="font-mono font-bold text-sm text-green-400">{fmtKg(event.gasbackKg)}</p>
              </div>
            )}
            {event.gasbackLedgers.length > 0 && (
              <div>
                <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Kredit ke Gasback</p>
                <p className="font-mono font-bold text-sm text-green-400">
                  +{fmtKg(event.gasbackLedgers[0].amount)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {event.notes && (
          <p className="text-xs text-[var(--text-muted)] italic">{event.notes}</p>
        )}

        {/* Recorded by */}
        {event.recordedBy && (
          <p className="text-[10px] text-[var(--text-muted)]">Dicatat oleh: {event.recordedBy}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CylinderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data,    setData]    = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cylinders/${id}/history`)
      .then(r => {
        if (!r.ok) throw new Error("Tidak dapat memuat data");
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="page-container">
      <div className="p-8 text-center text-[var(--text-muted)]">Memuat riwayat tabung…</div>
    </div>
  );

  if (error || !data) return (
    <div className="page-container">
      <div className="p-8 text-center text-red-400">{error ?? "Data tidak ditemukan"}</div>
    </div>
  );

  const { unit, events, summary } = data;

  return (
    <div className="page-container space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cylinders" className="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="page-title font-mono">{unit.serialCode}</h1>
          <p className="page-desc">{unit.type.label} · {unit.branch.name}</p>
        </div>
        <Link href={`/cylinders/${id}/edit`} className="btn-gho text-sm">Edit</Link>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Status</p>
          <span className={`chip text-xs ${STATUS_COLOR[unit.status]}`}>{STATUS_LABEL[unit.status]}</span>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Kondisi</p>
          <span className={`chip text-xs ${CONDITION_COLOR[unit.condition]}`}>{unit.condition}</span>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Tare Weight</p>
          <p className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            {unit.tareWeightKg ? `${Number(unit.tareWeightKg).toFixed(3)} kg` : "Nominal"}
          </p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Total Gasback</p>
          <p className="font-mono text-sm font-bold text-green-400">
            {summary.totalGasbackKg.toFixed(3)} kg
          </p>
        </div>
      </div>

      {/* Customers who held this cylinder */}
      {summary.uniqueCustomers.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
            Riwayat Pelanggan yang Pernah Pegang Tabung Ini
          </p>
          <div className="flex flex-wrap gap-2">
            {summary.uniqueCustomers.map(c => (
              <Link
                key={c.id}
                href={`/customers/${c.id}`}
                className="chip text-xs text-[var(--accent)] hover:bg-[var(--accent-light)] transition-colors"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <Link href={`/cylinders/weigh?cylinderId=${id}`} className="btn-pri text-sm">
          ⚖️ Timbang Sekarang
        </Link>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
          Riwayat Pergerakan ({summary.totalEvents} event)
        </h2>

        {events.length === 0 ? (
          <div className="empty-state py-8">
            <p className="empty-state-title">Belum ada event</p>
            <p className="empty-state-desc">Tabung ini baru terdaftar dan belum memiliki riwayat pergerakan</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Show newest first */}
            {[...events].reverse().map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}