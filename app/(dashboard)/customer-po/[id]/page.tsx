// app/(dashboard)/customer-po/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import FormPageLayout from "@/components/FormPageLayout";

type Cpo = {
  id: string;
  poNumber: string;
  status: string;
  channel: string | null;
  kg12Qty: number;
  kg50Qty: number;
  notes: string | null;
  createdAt: string;
  customer: { id: string; name: string; code: string; customerType: string };
  branch: { id: string; code: string; name: string };
  deliveryOrders: Array<{
    id: string;
    doNumber: string;
    status: string;
    kg12Released: number;
    kg50Released: number;
    kg12Delivered: number;
    kg50Delivered: number;
    doDate: string;
    driver: { displayName: string } | null;
    kenek: { displayName: string } | null;
  }>;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "badge-neutral",
  CONFIRMED: "badge-green",
  COMPLETED: "badge-blue",
  CANCELLED: "badge-red",
};

const DO_STATUS_BADGE: Record<string, string> = {
  PENDING: "badge-neutral",
  IN_TRANSIT: "badge-blue",
  DELIVERED: "badge-green",
  PARTIAL: "badge-amber",
  CANCELLED: "badge-red",
};

const CHANNEL_LABEL: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  PHONE: "Telepon",
  WALK_IN: "Walk-in",
  SALES_VISIT: "Sales Visit",
};

export default function CustomerPoDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [cpo, setCpo] = useState<Cpo | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCpo = async () => {
      try {
        const res = await fetch(`/api/customer-po/${id}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setCpo(data);
      } catch {
        setError("Gagal memuat data CPO");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchCpo();
  }, [id]);

  const updateStatus = async (newStatus: string) => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/customer-po/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengubah status");
        return;
      }
      setCpo((prev) => prev ? { ...prev, status: data.status } : null);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <FormPageLayout backHref="/customer-po" title="Detail CPO" backLabel="Kembali ke Customer PO"
>
        <div className="card p-8 text-center text-[var(--text-muted)]">Memuat...</div>
      </FormPageLayout>
    );
  }

  if (!cpo) {
    return (
      <FormPageLayout backHref="/customer-po" title="Detail CPO" backLabel="Kembali ke Customer PO">
        <div className="card p-8 text-center text-red-500">{error || "CPO tidak ditemukan"}</div>
      </FormPageLayout>
    );
  }

  return (
    <FormPageLayout backHref="/customer-po" title={`CPO ${cpo.poNumber}`} backLabel="Kembali ke Customer PO">
      {error && <div className="form-error-banner mb-4">{error}</div>}

      {/* Info Card */}
      <div className="card p-5 mb-5 max-w-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="font-mono text-lg font-bold text-[var(--text-primary)]">{cpo.poNumber}</div>
            <div className="text-sm text-[var(--text-muted)]">
              {new Date(cpo.createdAt).toLocaleDateString("id-ID", {
                day: "2-digit", month: "long", year: "numeric",
              })}
            </div>
          </div>
          <span className={STATUS_BADGE[cpo.status] ?? "badge-neutral"}>
            {cpo.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-[var(--text-muted)] mb-1">Pelanggan</div>
            <div className="font-semibold text-[var(--text-primary)]">{cpo.customer.name}</div>
            <div className="text-xs text-[var(--text-muted)]">{cpo.customer.code}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-1">Cabang</div>
            <div className="font-semibold">{cpo.branch.name}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-1">Qty 12kg</div>
            <div className="font-mono font-bold text-lg">{cpo.kg12Qty}</div>
          </div>
          <div>
            <div className="text-[var(--text-muted)] mb-1">Qty 50kg</div>
            <div className="font-mono font-bold text-lg">{cpo.kg50Qty}</div>
          </div>
          {cpo.channel && (
            <div>
              <div className="text-[var(--text-muted)] mb-1">Channel</div>
              <div>{CHANNEL_LABEL[cpo.channel] ?? cpo.channel}</div>
            </div>
          )}
          {cpo.notes && (
            <div className="col-span-2">
              <div className="text-[var(--text-muted)] mb-1">Catatan</div>
              <div className="text-[var(--text-secondary)]">{cpo.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Status Actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {cpo.status === "DRAFT" && (
          <>
            <button
              onClick={() => updateStatus("CONFIRMED")}
              disabled={actionLoading}
              className="btn-pri"
            >
              {actionLoading ? "Memproses..." : "✓ Confirm CPO"}
            </button>
            <button
              onClick={() => updateStatus("CANCELLED")}
              disabled={actionLoading}
              className="btn-gho text-red-500 border-red-300"
            >
              Batalkan
            </button>
          </>
        )}
        {cpo.status === "CONFIRMED" && (
          <>
            <Link href={`/delivery/add?cpoId=${cpo.id}`} className="btn-pri">
              + Buat DO
            </Link>
            <button
              onClick={() => updateStatus("CANCELLED")}
              disabled={actionLoading}
              className="btn-gho text-red-500 border-red-300"
            >
              Batalkan
            </button>
          </>
        )}
      </div>

      {/* Delivery Orders */}
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Delivery Orders ({cpo.deliveryOrders.length})</h2>
        </div>
        {cpo.deliveryOrders.length === 0 ? (
          <div className="card p-6 text-center text-[var(--text-muted)] text-sm">
            Belum ada DO untuk CPO ini
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. DO</th>
                  <th>Driver</th>
                  <th>Rls 12kg</th>
                  <th>Rls 50kg</th>
                  <th>Status</th>
                  <th>Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {cpo.deliveryOrders.map((do_) => (
                  <tr
                    key={do_.id}
                    className="cursor-pointer hover:bg-[var(--surface-hover)]"
                    onClick={() => router.push(`/delivery/${do_.id}`)}
                  >
                    <td className="font-mono font-semibold">{do_.doNumber}</td>
                    <td className="text-sm">
                      {do_.driver
                        ? `${do_.driver.displayName}${do_.kenek ? `/${do_.kenek.displayName}` : ""}`
                        : "—"}
                    </td>
                    <td className="text-right font-mono">{do_.kg12Released}</td>
                    <td className="text-right font-mono">{do_.kg50Released}</td>
                    <td>
                      <span className={DO_STATUS_BADGE[do_.status] ?? "badge-neutral"}>
                        {do_.status}
                      </span>
                    </td>
                    <td className="text-sm text-[var(--text-muted)]">
                      {new Date(do_.doDate).toLocaleDateString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FormPageLayout>
  );
}