// app/(dashboard)/cylinders/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBranch } from "@/lib/branch-context";

type CylinderStatus =
  | "WAREHOUSE_FULL"
  | "WAREHOUSE_EMPTY"
  | "IN_TRANSIT"
  | "WITH_CUSTOMER"
  | "RETURNED_TO_SUPPLIER"
  | "WRITTEN_OFF";

type CylinderCondition = "GOOD" | "DAMAGED" | "NEEDS_INSPECTION" | "CONDEMNED";

interface CylinderUnit {
  id: string;
  serialCode: string;
  status: CylinderStatus;
  condition: CylinderCondition;
  locationNote: string | null;
  tareWeightKg: string | null;
  type: { size: string; label: string };
  events: {
    eventType: string;
    eventAt: string;
    customer: { id: string; name: string; code: string } | null;
    weightReturnedKg: string | null;
    gasbackKg: string | null;
  }[];
}

interface ListData {
  units: CylinderUnit[];
  total: number;
  pages: number;
}

const STATUS_LABEL: Record<CylinderStatus, string> = {
  WAREHOUSE_FULL:       "Gudang — Isi",
  WAREHOUSE_EMPTY:      "Gudang — Kosong",
  IN_TRANSIT:           "Dalam Perjalanan",
  WITH_CUSTOMER:        "Di Pelanggan",
  RETURNED_TO_SUPPLIER: "Kembali ke Supplier",
  WRITTEN_OFF:          "Dihapus",
};

const STATUS_COLOR: Record<CylinderStatus, string> = {
  WAREHOUSE_FULL:       "bg-green-500/15 text-green-400",
  WAREHOUSE_EMPTY:      "bg-gray-500/15 text-gray-400",
  IN_TRANSIT:           "bg-yellow-500/15 text-yellow-400",
  WITH_CUSTOMER:        "bg-blue-500/15 text-blue-400",
  RETURNED_TO_SUPPLIER: "bg-purple-500/15 text-purple-400",
  WRITTEN_OFF:          "bg-red-500/15 text-red-400",
};

const CONDITION_COLOR: Record<CylinderCondition, string> = {
  GOOD:             "bg-green-500/10 text-green-400",
  DAMAGED:          "bg-red-500/10 text-red-400",
  NEEDS_INSPECTION: "bg-amber-500/10 text-amber-400",
  CONDEMNED:        "bg-red-700/10 text-red-500",
};

const EVENT_ICON: Record<string, string> = {
  RECEIVED_FROM_SUPPLIER:   "📦",
  DISPATCHED_TO_CUSTOMER:   "🚚",
  RETURNED_FROM_CUSTOMER:   "↩️",
  TRANSFERRED_BETWEEN_BRANCH: "↔️",
  WRITTEN_OFF:              "🗑️",
  INSPECTION:               "🔍",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Cylinder Row ─────────────────────────────────────────────────────────────
function CylinderRow({ unit }: { unit: CylinderUnit }) {
  const lastEvent = unit.events[0];
  return (
    <tr className="table-row">
      <td>
        <Link href={`/cylinders/${unit.id}`} className="font-mono text-[var(--accent)] hover:underline font-semibold">
          {unit.serialCode}
        </Link>
      </td>
      <td>
        <span className={`chip text-xs ${STATUS_COLOR[unit.status]}`}>
          {STATUS_LABEL[unit.status]}
        </span>
      </td>
      <td>
        <span className="chip text-xs">
          {unit.type.label}
        </span>
      </td>
      <td>
        <span className={`chip text-xs ${CONDITION_COLOR[unit.condition]}`}>
          {unit.condition}
        </span>
      </td>
      <td className="text-[var(--text-muted)] text-xs">
        {lastEvent
          ? (
            <div>
              <span className="mr-1">{EVENT_ICON[lastEvent.eventType] ?? "•"}</span>
              {lastEvent.customer
                ? <span className="text-[var(--text-secondary)]">{lastEvent.customer.name}</span>
                : <span>—</span>}
              <br />
              <span className="text-[10px]">{fmtDate(lastEvent.eventAt)}</span>
            </div>
          )
          : <span>Baru didaftarkan</span>
        }
      </td>
      <td className="text-[var(--text-muted)] font-mono text-xs">
        {unit.tareWeightKg ? `${Number(unit.tareWeightKg).toFixed(2)} kg` : "—"}
      </td>
      <td>
        <Link href={`/cylinders/${unit.id}`} className="btn-gho text-xs py-1 px-2">
          Detail
        </Link>
      </td>
    </tr>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function CylindersPage() {
  const { activeBranchId } = useBranch();
  const [data,    setData]    = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState("");
  const [size,    setSize]    = useState("");
  const [page,    setPage]    = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (activeBranchId) qs.set("branchId", activeBranchId);
      if (search)  qs.set("search", search);
      if (status)  qs.set("status", status);
      if (size)    qs.set("size", size);
      qs.set("page",  String(page));
      qs.set("limit", "50");
      const res = await fetch(`/api/cylinders?${qs}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, search, status, size, page]);

  useEffect(() => { setPage(1); }, [activeBranchId, search, status, size]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="page-container space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Manajemen Tabung</h1>
          <p className="page-desc">
            Lacak tabung berdasarkan nomor seri · riwayat kepemilikan · timbang sisa gas
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cylinders/weigh" className="btn-gho text-sm">
            ⚖️ Timbang Return
          </Link>
          <Link href="/cylinders/register" className="btn-pri text-sm">
            + Daftar Tabung
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="form-label">Cari Serial</label>
          <input
            className="input-field"
            placeholder="Ketik nomor seri tabung..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="input-field" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Semua Status</option>
            <option value="WAREHOUSE_FULL">Gudang — Isi</option>
            <option value="WAREHOUSE_EMPTY">Gudang — Kosong</option>
            <option value="IN_TRANSIT">Dalam Perjalanan</option>
            <option value="WITH_CUSTOMER">Di Pelanggan</option>
            <option value="WRITTEN_OFF">Dihapus</option>
          </select>
        </div>
        <div>
          <label className="form-label">Ukuran</label>
          <select className="input-field" value={size} onChange={e => setSize(e.target.value)}>
            <option value="">Semua</option>
            <option value="KG12">12 kg</option>
            <option value="KG50">50 kg</option>
          </select>
        </div>
        <button onClick={load} className="btn-gho text-sm">↻ Refresh</button>
      </div>

      {/* Stats */}
      {data && (
        <p className="text-xs text-[var(--text-muted)]">
          Menampilkan {data.units.length} dari {data.total} tabung terdaftar
        </p>
      )}

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-sm">Memuat data tabung…</div>
        ) : !data || data.units.length === 0 ? (
          <div className="empty-state py-10">
            <p className="empty-state-title">Belum ada tabung terdaftar</p>
            <p className="empty-state-desc">
              Daftarkan tabung dengan nomor seri untuk mulai tracking
            </p>
            <Link href="/cylinders/register" className="btn-pri text-sm mt-3">+ Daftar Tabung Baru</Link>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Seri</th>
                  <th>Status</th>
                  <th>Ukuran</th>
                  <th>Kondisi</th>
                  <th>Terakhir</th>
                  <th>Tare (kg)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.units.map(u => <CylinderRow key={u.id} unit={u} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn-gho text-xs"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >← Prev</button>
          <span className="text-xs text-[var(--text-muted)]">
            Hal {page} / {data.pages}
          </span>
          <button
            className="btn-gho text-xs"
            disabled={page >= data.pages}
            onClick={() => setPage(p => p + 1)}
          >Next →</button>
        </div>
      )}
    </div>
  );
}