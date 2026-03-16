// app/(dashboard)/delivery/[id]/edit/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import FormPageLayout from "@/components/FormPageLayout";

type Do = {
  id: string;
  doNumber: string;
  status: string;
  kg12Released: number;
  kg50Released: number;
  kg12Delivered: number;
  kg50Delivered: number;
  driverId: string | null;
  kenetId: string | null;
  vehicleNo: string | null;
  supplierPoRef: string | null;
  notes: string | null;
  customerPo: {
    customer: { name: string; code: string };
  };
  driver: { id: string; displayName: string } | null;
  kenek:  { id: string; displayName: string } | null;
};

type Employee = {
  id: string;
  displayName: string;
  roles: Array<{ role: string }>;
};

const STATUS_TRANSITIONS: Record<
  string,
  Array<{ value: string; label: string; color: string }>
> = {
  PENDING: [
    { value: "IN_TRANSIT", label: "🚛 Berangkat (IN_TRANSIT)", color: "btn-pri" },
    { value: "CANCELLED",  label: "✕ Batalkan", color: "btn-gho text-red-500 border-red-300" },
  ],
  IN_TRANSIT: [
    { value: "DELIVERED", label: "✓ Tandai DELIVERED", color: "btn-pri" },
    { value: "PARTIAL",   label: "~ Sebagian PARTIAL",  color: "btn-gho" },
    { value: "CANCELLED", label: "✕ Batalkan",          color: "btn-gho text-red-500 border-red-300" },
  ],
  PARTIAL: [
    { value: "DELIVERED", label: "✓ Selesaikan DELIVERED", color: "btn-pri" },
    { value: "CANCELLED", label: "✕ Batalkan",             color: "btn-gho text-red-500 border-red-300" },
  ],
};

export default function DeliveryEditPage() {
  const { id } = useParams();
  const router = useRouter();

  const [order,     setOrder]     = useState<Do | null>(null);
  const [drivers,   setDrivers]   = useState<Employee[]>([]);
  const [keneks,    setKeneks]    = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState("");
  const [successMsg,setSuccessMsg]= useState("");

  const [form, setForm] = useState({
    kg12Delivered: 0,
    kg50Delivered: 0,
    driverId:      "",
    kenetId:       "",
    vehicleNo:     "",
    supplierPoRef: "",
    notes:         "",
  });

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [doRes, empRes] = await Promise.all([
          fetch(`/api/delivery-orders/${id}`),
          fetch(`/api/employees?limit=100`),
        ]);

        const [doData, empJson] = await Promise.all([
          doRes.json(),
          empRes.json(),
        ]);

        setOrder(doData);
        setForm({
          kg12Delivered: doData.kg12Delivered ?? doData.kg12Released,
          kg50Delivered: doData.kg50Delivered ?? doData.kg50Released,
          driverId:      doData.driverId      ?? "",
          kenetId:       doData.kenetId       ?? "",
          vehicleNo:     doData.vehicleNo     ?? "",
          supplierPoRef: doData.supplierPoRef ?? "",
          notes:         doData.notes         ?? "",
        });

        // /api/employees returns { employees: [...] }
        const empList: Employee[] = Array.isArray(empJson)
          ? empJson
          : Array.isArray(empJson.employees)
          ? empJson.employees
          : Array.isArray(empJson.records)
          ? empJson.records
          : [];

        setDrivers(empList.filter((e) => e.roles.some((r) => r.role === "DRIVER")));
        setKeneks(empList.filter((e)  => e.roles.some((r) => r.role === "KENEK")));
      } catch {
        setError("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchAll();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setError("");
    setSuccessMsg("");
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        status:       newStatus,
        driverId:     form.driverId     || null,
        kenetId:      form.kenetId      || null,
        vehicleNo:    form.vehicleNo    || null,
        supplierPoRef:form.supplierPoRef|| null,
        notes:        form.notes        || null,
      };

      if (newStatus === "DELIVERED" || newStatus === "PARTIAL") {
        payload.kg12Delivered = form.kg12Delivered;
        payload.kg50Delivered = form.kg50Delivered;
      }

      const res = await fetch(`/api/delivery-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengubah status");
        return;
      }
      setSuccessMsg(`Status berhasil diubah ke ${newStatus}`);
      setTimeout(() => router.push(`/delivery/${id}`), 1000);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <FormPageLayout backHref={`/delivery/${id}`} title="Edit DO">
        <div className="card p-8 text-center text-[var(--text-muted)]">Memuat...</div>
      </FormPageLayout>
    );
  }

  if (!order) {
    return (
      <FormPageLayout backHref="/delivery" title="Edit DO">
        <div className="card p-8 text-center text-red-500">{error || "DO tidak ditemukan"}</div>
      </FormPageLayout>
    );
  }

  const transitions = STATUS_TRANSITIONS[order.status] ?? [];

  return (
    <FormPageLayout
      backHref={`/delivery/${order.id}`}
      title={`Edit DO ${order.doNumber}`}
      subtitle={`Status saat ini: ${order.status} — ${order.customerPo.customer.name}`}
    >
      {error      && <div className="form-error-banner mb-4">{error}</div>}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {successMsg}
        </div>
      )}

      <div className="form-card max-w-lg">
        {/* Driver & Kenek */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Driver</label>
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="input-field"
            >
              <option value="">Pilih driver...</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.displayName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kenek</label>
            <select
              value={form.kenetId}
              onChange={(e) => setForm({ ...form, kenetId: e.target.value })}
              className="input-field"
            >
              <option value="">Pilih kenek...</option>
              {keneks.map((k) => (
                <option key={k.id} value={k.id}>{k.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Vehicle & Supplier PO Ref */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">No. Kendaraan</label>
            <input
              type="text"
              value={form.vehicleNo}
              onChange={(e) => setForm({ ...form, vehicleNo: e.target.value })}
              className="input-field"
              placeholder="L 1234 AB"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ref. PO Supplier</label>
            <input
              type="text"
              value={form.supplierPoRef}
              onChange={(e) => setForm({ ...form, supplierPoRef: e.target.value })}
              className="input-field"
            />
          </div>
        </div>

        {/* Delivered qty — only when IN_TRANSIT or PARTIAL */}
        {(order.status === "IN_TRANSIT" || order.status === "PARTIAL") && (
          <div className="pt-3 border-t border-[var(--border)]">
            <p className="text-sm font-medium text-[var(--text-secondary)] mb-3">
              Penerimaan (qty yang diterima pelanggan)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">
                  Penerimaan 12kg
                  <span className="text-[var(--text-muted)] font-normal ml-1">
                    (max {order.kg12Released})
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={order.kg12Released}
                  value={form.kg12Delivered}
                  onChange={(e) =>
                    setForm({ ...form, kg12Delivered: parseInt(e.target.value) || 0 })
                  }
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label className="form-label">
                  Penerimaan 50kg
                  <span className="text-[var(--text-muted)] font-normal ml-1">
                    (max {order.kg50Released})
                  </span>
                </label>
                <input
                  type="number"
                  min={0}
                  max={order.kg50Released}
                  value={form.kg50Delivered}
                  onChange={(e) =>
                    setForm({ ...form, kg50Delivered: parseInt(e.target.value) || 0 })
                  }
                  className="input-field"
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field"
            rows={2}
          />
        </div>

        {/* Status Buttons */}
        <div className="pt-4 border-t border-[var(--border)]">
          <p className="text-sm text-[var(--text-muted)] mb-3">Ubah Status DO:</p>
          {transitions.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] italic">
              Status {order.status} sudah final, tidak bisa diubah.
            </p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {transitions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => handleStatusChange(t.value)}
                  disabled={submitting}
                  className={`${t.color} disabled:opacity-50`}
                >
                  {submitting ? "Memproses..." : t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </FormPageLayout>
  );
}