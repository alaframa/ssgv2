// app/(dashboard)/delivery/add/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import FormPageLayout from "@/components/FormPageLayout";

type Cpo = {
  id: string;
  poNumber: string;
  kg12Qty: number;
  kg50Qty: number;
  customer: { id: string; name: string; code: string };
};

type Employee = {
  id: string;
  displayName: string;
  fullName: string;
  roles: Array<{ role: string }>;
};

function DeliveryAddForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId } = useBranch();

  const preselectedCpoId = searchParams.get("cpoId") ?? "";

  const [cpos, setCpos] = useState<Cpo[]>([]);
  const [drivers, setDrivers] = useState<Employee[]>([]);
  const [keneks, setKeneks] = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerPoId: preselectedCpoId,
    doDate: new Date().toISOString().slice(0, 10),
    driverId: "",
    kenetId: "",
    supplierPoRef: "",
    vehicleNo: "",
    kg12Released: 0,
    kg50Released: 0,
    notes: "",
  });

  // Prefill qty when CPO selected
  const selectedCpo = cpos.find((c) => c.id === form.customerPoId);
  useEffect(() => {
    if (selectedCpo) {
      setForm((f) => ({
        ...f,
        kg12Released: selectedCpo.kg12Qty,
        kg50Released: selectedCpo.kg50Qty,
      }));
    }
  }, [form.customerPoId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingData(true);
      try {
        const cpoParams = new URLSearchParams({ status: "CONFIRMED", limit: "100" });
        if (activeBranchId) cpoParams.set("branchId", activeBranchId);

        const empParams = new URLSearchParams({ limit: "100" });
        if (activeBranchId) empParams.set("branchId", activeBranchId);

        const [cpoRes, empRes] = await Promise.all([
          fetch(`/api/customer-po?${cpoParams}`),
          fetch(`/api/employees?${empParams}`),
        ]);

        const [cpoJson, empJson] = await Promise.all([
          cpoRes.json(),
          empRes.json(),
        ]);

        // /api/customer-po returns { records: [...] }
        const cpoList: Cpo[] = Array.isArray(cpoJson)
          ? cpoJson
          : Array.isArray(cpoJson.records)
          ? cpoJson.records
          : [];

        // /api/employees returns { employees: [...] }
        const empList: Employee[] = Array.isArray(empJson)
          ? empJson
          : Array.isArray(empJson.employees)
          ? empJson.employees
          : Array.isArray(empJson.records)
          ? empJson.records
          : [];

        setCpos(cpoList);
        setDrivers(empList.filter((e) => e.roles.some((r) => r.role === "DRIVER")));
        setKeneks(empList.filter((e) => e.roles.some((r) => r.role === "KENEK")));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.customerPoId) {
      setError("Pilih Customer PO terlebih dahulu");
      return;
    }
    if (form.kg12Released === 0 && form.kg50Released === 0) {
      setError("Minimal salah satu qty pelepasan harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/delivery-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId:     activeBranchId,
          driverId:     form.driverId     || null,
          kenetId:      form.kenetId      || null,
          supplierPoRef: form.supplierPoRef || null,
          vehicleNo:    form.vehicleNo    || null,
          notes:        form.notes        || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat DO");
        return;
      }
      router.push(`/delivery/${data.id}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPageLayout
      backHref="/delivery"
      title="Buat Delivery Order"
      subtitle="Catat pengiriman gas ke pelanggan"
    >
      <form onSubmit={handleSubmit} className="form-card max-w-lg">
        {error && <div className="form-error-banner mb-4">{error}</div>}

        {/* Customer PO */}
        <div className="form-group">
          <label className="form-label">
            Customer PO <span className="text-red-500">*</span>
          </label>
          <select
            value={form.customerPoId}
            onChange={(e) => setForm({ ...form, customerPoId: e.target.value })}
            className="input-field"
            disabled={loadingData}
            required
          >
            <option value="">
              {loadingData ? "Memuat..." : "Pilih Customer PO (CONFIRMED)..."}
            </option>
            {cpos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.poNumber} — {c.customer.name} (12kg:{c.kg12Qty} 50kg:{c.kg50Qty})
              </option>
            ))}
          </select>
          {!loadingData && cpos.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">
              Tidak ada CPO berstatus CONFIRMED. Konfirmasi CPO dulu di menu PO Pelanggan.
            </p>
          )}
        </div>

        {/* Date */}
        <div className="form-group">
          <label className="form-label">
            Tanggal DO <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={form.doDate}
            onChange={(e) => setForm({ ...form, doDate: e.target.value })}
            className="input-field"
            required
          />
        </div>

        {/* Qty Released */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Pelepasan 12kg</label>
            <input
              type="number"
              min={0}
              value={form.kg12Released}
              onChange={(e) =>
                setForm({ ...form, kg12Released: parseInt(e.target.value) || 0 })
              }
              className="input-field"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Pelepasan 50kg</label>
            <input
              type="number"
              min={0}
              value={form.kg50Released}
              onChange={(e) =>
                setForm({ ...form, kg50Released: parseInt(e.target.value) || 0 })
              }
              className="input-field"
            />
          </div>
        </div>

        {/* Driver & Kenek */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Driver</label>
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="input-field"
              disabled={loadingData}
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
              disabled={loadingData}
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
              placeholder="PO-2026-03-0001"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field"
            rows={2}
            placeholder="Opsional"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={submitting} className="btn-pri flex-1">
            {submitting ? "Menyimpan..." : "Buat DO"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/delivery")}
            className="btn-gho"
          >
            Batal
          </button>
        </div>
      </form>
    </FormPageLayout>
  );
}

export default function DeliveryAddPage() {
  return (
    <Suspense
      fallback={
        <div className="page-container">
          <div className="card p-8 text-center text-[var(--text-muted)]">Memuat form...</div>
        </div>
      }
    >
      <DeliveryAddForm />
    </Suspense>
  );
}