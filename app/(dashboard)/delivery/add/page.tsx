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
  // total already-released from existing DOs (computed below after fetch)
  alreadyReleased12?: number;
  alreadyReleased50?: number;
};

type Employee = {
  id: string;
  displayName: string;
  fullName: string;
  roles: Array<{ role: string }>;
};

function DeliveryAddForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { activeBranchId } = useBranch();

  const preselectedCpoId = searchParams.get("cpoId") ?? "";

  const [cpos,        setCpos]        = useState<Cpo[]>([]);
  const [drivers,     setDrivers]     = useState<Employee[]>([]);
  const [keneks,      setKeneks]      = useState<Employee[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState("");

  const [form, setForm] = useState({
    customerPoId:  preselectedCpoId,
    doDate:        new Date().toISOString().slice(0, 10),
    driverId:      "",
    kenetId:       "",
    supplierPoRef: "",
    vehicleNo:     "",
    kg12Released:  0,
    kg50Released:  0,
    notes:         "",
  });

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

        const rawCpos: Cpo[] = Array.isArray(cpoJson)
          ? cpoJson
          : Array.isArray(cpoJson.records)
          ? cpoJson.records
          : [];

        const empList: Employee[] = Array.isArray(empJson)
          ? empJson
          : Array.isArray(empJson.employees)
          ? empJson.employees
          : Array.isArray(empJson.records)
          ? empJson.records
          : [];

        // For each CPO, fetch its existing DO totals so we can show remaining qty
        const cposWithRemaining = await Promise.all(
          rawCpos.map(async (cpo) => {
            try {
              const doRes  = await fetch(
                `/api/delivery-orders?customerPoId=${cpo.id}&limit=100`
              );
              const doJson = await doRes.json();
              const dos: Array<{ kg12Released: number; kg50Released: number; status: string }> =
                Array.isArray(doJson.records) ? doJson.records : [];

              const active = dos.filter((d) => d.status !== "CANCELLED");
              return {
                ...cpo,
                alreadyReleased12: active.reduce((s, d) => s + d.kg12Released, 0),
                alreadyReleased50: active.reduce((s, d) => s + d.kg50Released, 0),
              };
            } catch {
              return { ...cpo, alreadyReleased12: 0, alreadyReleased50: 0 };
            }
          })
        );

        setCpos(cposWithRemaining);
        setDrivers(empList.filter((e) => e.roles.some((r) => r.role === "DRIVER")));
        setKeneks(empList.filter((e)  => e.roles.some((r) => r.role === "KENEK")));

        // Prefill qty from preselected CPO
        if (preselectedCpoId) {
          const matched = cposWithRemaining.find((c) => c.id === preselectedCpoId);
          if (matched) {
            const rem12 = matched.kg12Qty - (matched.alreadyReleased12 ?? 0);
            const rem50 = matched.kg50Qty - (matched.alreadyReleased50 ?? 0);
            setForm((prev) => ({
              ...prev,
              kg12Released: Math.max(0, rem12),
              kg50Released: Math.max(0, rem50),
            }));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data");
      } finally {
        setLoadingData(false);
      }
    };
    fetchAll();
  }, [activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When user picks a different CPO from dropdown, prefill remaining qty
  const handleCpoChange = (cpoId: string) => {
    const matched = cpos.find((c) => c.id === cpoId);
    if (matched) {
      const rem12 = matched.kg12Qty - (matched.alreadyReleased12 ?? 0);
      const rem50 = matched.kg50Qty - (matched.alreadyReleased50 ?? 0);
      setForm((prev) => ({
        ...prev,
        customerPoId: cpoId,
        kg12Released: Math.max(0, rem12),
        kg50Released: Math.max(0, rem50),
      }));
    } else {
      setForm((prev) => ({ ...prev, customerPoId: cpoId }));
    }
  };

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

    // Client-side overage guard (server also checks, this is just UX feedback)
    const selected = cpos.find((c) => c.id === form.customerPoId);
    if (selected) {
      const rem12 = selected.kg12Qty - (selected.alreadyReleased12 ?? 0);
      const rem50 = selected.kg50Qty - (selected.alreadyReleased50 ?? 0);
      if (form.kg12Released > rem12) {
        setError(
          `Qty 12kg (${form.kg12Released}) melebihi sisa CPO (${rem12}). ` +
          `CPO total: ${selected.kg12Qty}, sudah dirilis: ${selected.alreadyReleased12 ?? 0}.`
        );
        return;
      }
      if (form.kg50Released > rem50) {
        setError(
          `Qty 50kg (${form.kg50Released}) melebihi sisa CPO (${rem50}). ` +
          `CPO total: ${selected.kg50Qty}, sudah dirilis: ${selected.alreadyReleased50 ?? 0}.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/delivery-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId:      activeBranchId,
          driverId:      form.driverId      || null,
          kenetId:       form.kenetId       || null,
          supplierPoRef: form.supplierPoRef || null,
          vehicleNo:     form.vehicleNo     || null,
          notes:         form.notes         || null,
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

  const selectedCpo = cpos.find((c) => c.id === form.customerPoId);
  const rem12 = selectedCpo
    ? selectedCpo.kg12Qty - (selectedCpo.alreadyReleased12 ?? 0)
    : 0;
  const rem50 = selectedCpo
    ? selectedCpo.kg50Qty - (selectedCpo.alreadyReleased50 ?? 0)
    : 0;

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
            onChange={(e) => handleCpoChange(e.target.value)}
            className="input-field"
            disabled={loadingData}
            required
          >
            <option value="">
              {loadingData ? "Memuat..." : "Pilih Customer PO (CONFIRMED)..."}
            </option>
            {cpos.map((c) => {
              const r12 = c.kg12Qty - (c.alreadyReleased12 ?? 0);
              const r50 = c.kg50Qty - (c.alreadyReleased50 ?? 0);
              return (
                <option key={c.id} value={c.id}>
                  {c.poNumber} — {c.customer.name}
                  {" "}(sisa: {r12}×12kg / {r50}×50kg)
                </option>
              );
            })}
          </select>
          {!loadingData && cpos.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">
              Tidak ada CPO berstatus CONFIRMED. Konfirmasi CPO dulu di menu PO Pelanggan.
            </p>
          )}
        </div>

        {/* Remaining qty info banner */}
        {selectedCpo && (
          <div className="p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-sm">
            <div className="font-medium text-[var(--text-primary)] mb-1">
              {selectedCpo.customer.name} — {selectedCpo.poNumber}
            </div>
            <div className="flex gap-6 text-[var(--text-secondary)]">
              <span>
                12kg: <strong>{rem12}</strong> sisa
                <span className="text-[var(--text-muted)] ml-1">
                  (total {selectedCpo.kg12Qty}, terpakai {selectedCpo.alreadyReleased12 ?? 0})
                </span>
              </span>
              <span>
                50kg: <strong>{rem50}</strong> sisa
                <span className="text-[var(--text-muted)] ml-1">
                  (total {selectedCpo.kg50Qty}, terpakai {selectedCpo.alreadyReleased50 ?? 0})
                </span>
              </span>
            </div>
          </div>
        )}

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

        {/* Qty Released — capped at remaining */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">
              Pelepasan 12kg
              {selectedCpo && (
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  (max {rem12})
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={selectedCpo ? rem12 : undefined}
              value={form.kg12Released}
              onChange={(e) =>
                setForm({ ...form, kg12Released: parseInt(e.target.value) || 0 })
              }
              className={`input-field ${
                selectedCpo && form.kg12Released > rem12
                  ? "border-red-400 bg-red-50"
                  : ""
              }`}
            />
            {selectedCpo && form.kg12Released > rem12 && (
              <p className="text-xs text-red-500 mt-1">
                Melebihi sisa CPO ({rem12})
              </p>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">
              Pelepasan 50kg
              {selectedCpo && (
                <span className="ml-1 font-normal text-[var(--text-muted)]">
                  (max {rem50})
                </span>
              )}
            </label>
            <input
              type="number"
              min={0}
              max={selectedCpo ? rem50 : undefined}
              value={form.kg50Released}
              onChange={(e) =>
                setForm({ ...form, kg50Released: parseInt(e.target.value) || 0 })
              }
              className={`input-field ${
                selectedCpo && form.kg50Released > rem50
                  ? "border-red-400 bg-red-50"
                  : ""
              }`}
            />
            {selectedCpo && form.kg50Released > rem50 && (
              <p className="text-xs text-red-500 mt-1">
                Melebihi sisa CPO ({rem50})
              </p>
            )}
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

        <div className="flex gap-3 mt-2">
          <button
            type="submit"
            disabled={
              submitting ||
              !form.customerPoId ||
              (selectedCpo !== undefined &&
                (form.kg12Released > rem12 || form.kg50Released > rem50))
            }
            className="btn-pri flex-1"
          >
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