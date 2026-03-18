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
  alreadyReleased12?: number;
  alreadyReleased50?: number;
};

type Employee = {
  id: string;
  displayName: string;
  fullName: string;
  roles: Array<{ role: string }>;
};

// ── Safe remaining: never goes below 0 ────────────────────────────────────────
function safeRem(qty: number, released: number): number {
  return Math.max(0, qty - released);
}

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

        // For each CPO, fetch its existing DO totals to compute remaining qty
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

        // Prefill qty from preselected CPO — always clamped to ≥ 0
        if (preselectedCpoId) {
          const matched = cposWithRemaining.find((c) => c.id === preselectedCpoId);
          if (matched) {
            setForm((prev) => ({
              ...prev,
              kg12Released: safeRem(matched.kg12Qty, matched.alreadyReleased12 ?? 0),
              kg50Released: safeRem(matched.kg50Qty, matched.alreadyReleased50 ?? 0),
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

  // When user picks a CPO from dropdown, prefill remaining qty (clamped ≥ 0)
  const handleCpoChange = (cpoId: string) => {
    const matched = cpos.find((c) => c.id === cpoId);
    if (matched) {
      const r12 = safeRem(matched.kg12Qty, matched.alreadyReleased12 ?? 0);
      const r50 = safeRem(matched.kg50Qty, matched.alreadyReleased50 ?? 0);
      setForm((prev) => ({
        ...prev,
        customerPoId: cpoId,
        kg12Released: r12,
        kg50Released: r50,
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

    // Client-side overage guard — uses clamped rem so it can never be negative
    const selected = cpos.find((c) => c.id === form.customerPoId);
    if (selected) {
      const rem12 = safeRem(selected.kg12Qty, selected.alreadyReleased12 ?? 0);
      const rem50 = safeRem(selected.kg50Qty, selected.alreadyReleased50 ?? 0);

      // Block if CPO is fully consumed
      if (rem12 === 0 && rem50 === 0) {
        setError(
          `CPO ${selected.poNumber} sudah tidak memiliki sisa qty. ` +
          `Semua qty telah dirilis ke DO sebelumnya.`
        );
        return;
      }
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

  // ── Always use clamped rem — never show negative to user ──────────────────
  const rem12 = selectedCpo
    ? safeRem(selectedCpo.kg12Qty, selectedCpo.alreadyReleased12 ?? 0)
    : 0;
  const rem50 = selectedCpo
    ? safeRem(selectedCpo.kg50Qty, selectedCpo.alreadyReleased50 ?? 0)
    : 0;

  // Raw (before clamping) — used to detect over-released state
  const rawRem12 = selectedCpo
    ? selectedCpo.kg12Qty - (selectedCpo.alreadyReleased12 ?? 0)
    : 0;
  const rawRem50 = selectedCpo
    ? selectedCpo.kg50Qty - (selectedCpo.alreadyReleased50 ?? 0)
    : 0;

  const isOverReleased12 = rawRem12 < 0;
  const isOverReleased50 = rawRem50 < 0;
  const isFullyConsumed  = rem12 === 0 && rem50 === 0 && !!selectedCpo;

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
              const r12 = safeRem(c.kg12Qty, c.alreadyReleased12 ?? 0);
              const r50 = safeRem(c.kg50Qty, c.alreadyReleased50 ?? 0);
              const fullyUsed = r12 === 0 && r50 === 0;
              return (
                <option key={c.id} value={c.id}>
                  {fullyUsed ? "⚠️ " : ""}
                  {c.poNumber} — {c.customer.name}
                  {" "}
                  {fullyUsed
                    ? "(HABIS)"
                    : `(sisa: ${r12}×12kg / ${r50}×50kg)`}
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
          <div className={`p-3 rounded-lg border text-sm ${
            isFullyConsumed
              ? "bg-red-50 border-red-300"
              : isOverReleased12 || isOverReleased50
              ? "bg-amber-50 border-amber-300"
              : "bg-[var(--surface-raised)] border-[var(--border)]"
          }`}>
            <div className="font-medium text-[var(--text-primary)] mb-1.5">
              {selectedCpo.customer.name} — {selectedCpo.poNumber}
            </div>

            {isFullyConsumed && (
              <div className="text-red-600 font-semibold text-xs mb-2 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
                Semua qty sudah terpakai — tidak bisa membuat DO baru untuk CPO ini
              </div>
            )}

            <div className="flex gap-6 text-[var(--text-secondary)]">
              {/* 12kg */}
              <div>
                <span className="text-xs text-[var(--text-muted)]">12kg</span>
                <div className="flex items-baseline gap-1.5">
                  <strong className={`text-base ${rem12 === 0 ? "text-red-500" : "text-[var(--text-primary)]"}`}>
                    {rem12} sisa
                  </strong>
                  {isOverReleased12 && (
                    <span className="text-xs text-red-500 font-semibold">(over-released!)</span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  total {selectedCpo.kg12Qty} · terpakai {selectedCpo.alreadyReleased12 ?? 0}
                </div>
              </div>

              {/* 50kg */}
              <div>
                <span className="text-xs text-[var(--text-muted)]">50kg</span>
                <div className="flex items-baseline gap-1.5">
                  <strong className={`text-base ${rem50 === 0 ? "text-red-500" : "text-[var(--text-primary)]"}`}>
                    {rem50} sisa
                  </strong>
                  {isOverReleased50 && (
                    <span className="text-xs text-red-500 font-semibold">(over-released!)</span>
                  )}
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  total {selectedCpo.kg50Qty} · terpakai {selectedCpo.alreadyReleased50 ?? 0}
                </div>
              </div>
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

        {/* Qty Released — capped at safe remaining (never negative max) */}
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
              max={rem12}                           // ← always ≥ 0, never negative
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
              max={rem50}                           // ← always ≥ 0, never negative
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

        {/* Driver */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Driver</label>
            <select
              value={form.driverId}
              onChange={(e) => setForm({ ...form, driverId: e.target.value })}
              className="input-field"
            >
              <option value="">— Pilih Driver —</option>
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
              <option value="">— Pilih Kenek —</option>
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
              placeholder="Opsional"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ref. PO Supplier</label>
            <input
              type="text"
              value={form.supplierPoRef}
              onChange={(e) => setForm({ ...form, supplierPoRef: e.target.value })}
              className="input-field"
              placeholder="Opsional"
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

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || loadingData || isFullyConsumed}
            className="btn-pri flex-1"
          >
            {submitting ? "Menyimpan..." : "Buat Delivery Order"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/delivery")}
            className="btn-sec"
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
    <Suspense fallback={<div className="p-8 text-[var(--text-muted)]">Memuat...</div>}>
      <DeliveryAddForm />
    </Suspense>
  );
}