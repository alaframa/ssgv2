// app/(dashboard)/delivery/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FormPageLayout from "@/components/FormPageLayout";

type Do = {
  id: string;
  doNumber: string;
  status: string;
  supplierPoRef: string | null;
  vehicleNo: string | null;
  kg12Released: number;
  kg50Released: number;
  kg12Delivered: number;
  kg50Delivered: number;
  doDate: string;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  customerPo: {
    id: string;
    poNumber: string;
    customer: { id: string; name: string; code: string; customerType: string };
  };
  branch: { id: string; code: string; name: string };
  driver: { id: string; displayName: string; fullName: string } | null;
  kenek: { id: string; displayName: string; fullName: string } | null;
  gasbackLedgers: Array<{
    id: string;
    txType: string;
    qty: number;
    amount: number;
    runningBalance: number;
    txDate: string;
  }>;
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-neutral",
  IN_TRANSIT: "badge-blue",
  DELIVERED: "badge-green",
  PARTIAL: "badge-amber",
  CANCELLED: "badge-red",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  IN_TRANSIT: "Di Jalan",
  DELIVERED: "Terkirim",
  PARTIAL: "Sebagian",
  CANCELLED: "Dibatalkan",
};

export default function DeliveryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<Do | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDo = async () => {
      try {
        const res = await fetch(`/api/delivery-orders/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setOrder(data);
      } catch {
        setError("Gagal memuat data DO");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchDo();
  }, [id]);

  const tonase = (kg12: number, kg50: number) =>
    (kg12 * 12 + kg50 * 50).toLocaleString("id-ID");

  if (loading) {
    return (
      <FormPageLayout backHref="/delivery" title="Detail DO">
        <div className="card p-8 text-center text-[var(--text-muted)]">Memuat...</div>
      </FormPageLayout>
    );
  }

  if (!order) {
    return (
      <FormPageLayout backHref="/delivery" title="Detail DO">
        <div className="card p-8 text-center text-red-500">{error || "DO tidak ditemukan"}</div>
      </FormPageLayout>
    );
  }

  const driverDisplay = order.driver
    ? `${order.driver.displayName}${order.kenek ? `/${order.kenek.displayName}` : ""}`
    : "—";

  return (
    <FormPageLayout backHref="/delivery" title={`DO ${order.doNumber}`}>
      {error && <div className="form-error-banner mb-4">{error}</div>}

      {/* Info Card */}
      <div className="card p-5 mb-5 max-w-2xl">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-mono text-xl font-bold text-[var(--text-primary)]">{order.doNumber}</div>
            <div className="text-sm text-[var(--text-muted)] mt-1">
              {new Date(order.doDate).toLocaleDateString("id-ID", {
                weekday: "long", day: "numeric", month: "long", year: "numeric",
              })}
            </div>
          </div>
          <span className={`${STATUS_BADGE[order.status] ?? "badge-neutral"} text-sm`}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Pelanggan</div>
            <div className="font-semibold text-[var(--text-primary)]">
              {order.customerPo.customer.name}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{order.customerPo.customer.code}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Customer PO</div>
            <Link
              href={`/customer-po/${order.customerPo.id}`}
              className="text-[var(--accent)] hover:underline font-mono"
            >
              {order.customerPo.poNumber}
            </Link>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Driver / Kenek</div>
            <div className="font-semibold">{driverDisplay}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Kendaraan</div>
            <div className="font-mono">{order.vehicleNo ?? "—"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Ref. PO Supplier</div>
            <div className="font-mono text-xs">{order.supplierPoRef ?? "—"}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-0.5">Cabang</div>
            <div>{order.branch.name} ({order.branch.code})</div>
          </div>
        </div>

        {/* Qty summary */}
        <div className="mt-5 pt-4 border-t border-[var(--border)]">
          <div className="grid grid-cols-3 gap-4">
            {/* Released */}
            <div className="bg-[var(--surface-raised)] rounded-lg p-3 text-center">
              <div className="text-xs text-[var(--text-muted)] mb-1">Pelepasan</div>
              <div className="font-mono font-bold text-lg text-[var(--text-primary)]">
                {order.kg12Released}
                <span className="text-xs text-[var(--text-muted)] ml-1">12kg</span>
              </div>
              <div className="font-mono text-sm text-[var(--text-secondary)]">
                {order.kg50Released}
                <span className="text-xs text-[var(--text-muted)] ml-1">50kg</span>
              </div>
            </div>
            {/* Delivered */}
            <div className="bg-[var(--surface-raised)] rounded-lg p-3 text-center">
              <div className="text-xs text-[var(--text-muted)] mb-1">Penerimaan</div>
              <div className="font-mono font-bold text-lg text-[var(--text-primary)]">
                {order.kg12Delivered}
                <span className="text-xs text-[var(--text-muted)] ml-1">12kg</span>
              </div>
              <div className="font-mono text-sm text-[var(--text-secondary)]">
                {order.kg50Delivered}
                <span className="text-xs text-[var(--text-muted)] ml-1">50kg</span>
              </div>
            </div>
            {/* Tonase */}
            <div className="bg-[var(--surface-raised)] rounded-lg p-3 text-center">
              <div className="text-xs text-[var(--text-muted)] mb-1">Tonase</div>
              <div className="font-mono font-bold text-lg text-[var(--text-primary)]">
                {tonase(order.kg12Released, order.kg50Released)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">kg</div>
            </div>
          </div>
        </div>

        {order.notes && (
          <div className="mt-4 pt-3 border-t border-[var(--border)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">Catatan</div>
            <div className="text-sm text-[var(--text-secondary)]">{order.notes}</div>
          </div>
        )}
      </div>

      {/* Action Button */}
      {(order.status === "PENDING" || order.status === "IN_TRANSIT" || order.status === "PARTIAL") && (
        <div className="mb-6">
          <Link href={`/delivery/${order.id}/edit`} className="btn-pri">
            ✏️ Update Status / Penerimaan
          </Link>
        </div>
      )}

      {/* Gasback earned */}
      {order.gasbackLedgers && order.gasbackLedgers.length > 0 && (
        <div className="max-w-2xl">
          <h2 className="section-title mb-3">Gasback dari DO ini</h2>
          <div className="card p-4">
            {order.gasbackLedgers.map((gl) => (
              <div key={gl.id} className="flex justify-between text-sm">
                <span className="text-[var(--text-secondary)]">
                  {new Date(gl.txDate).toLocaleDateString("id-ID")} — {gl.txType}
                </span>
                <span className="font-mono font-semibold text-green-600">
                  +{Number(gl.amount).toLocaleString("id-ID", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </FormPageLayout>
  );
}