// app/(dashboard)/customer-po/add/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import FormPageLayout from "@/components/FormPageLayout";

type Customer = {
  id: string;
  name: string;
  code: string;
  customerType: string;
};

const CHANNEL_OPTIONS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE",    label: "Telepon" },
  { value: "WALK_IN",  label: "Walk-in" },
  { value: "SALES_VISIT", label: "Sales Visit" },
];

export default function CustomerPoAddPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    customerId: "",
    kg12Qty: 0,
    kg50Qty: 0,
    channel: "",
    notes: "",
  });

  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const params = new URLSearchParams({ page: "1", pageSize: "200" });
        if (activeBranchId) params.set("branchId", activeBranchId);
        const res = await fetch(`/api/customers?${params}`);
        if (!res.ok) throw new Error("Gagal memuat pelanggan");
        const json = await res.json();

        // /api/customers returns { data: [...], meta: {...} }
        let list: Customer[] = [];
        if (Array.isArray(json)) {
          list = json;
        } else if (Array.isArray(json.data)) {
          list = json.data;
        } else if (Array.isArray(json.records)) {
          list = json.records;
        }

        setCustomers(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data pelanggan");
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchCustomers();
  }, [activeBranchId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.customerId) {
      setError("Pilih pelanggan terlebih dahulu");
      return;
    }
    if (form.kg12Qty === 0 && form.kg50Qty === 0) {
      setError("Minimal salah satu qty (12kg atau 50kg) harus diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer-po", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId: activeBranchId,
          channel: form.channel || null,
          notes:   form.notes   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal membuat CPO");
        return;
      }
      router.push(`/customer-po/${data.id}`);
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPageLayout
      backHref="/customer-po"
      title="Buat Customer PO"
      subtitle="Order baru dari pelanggan"
    >
      <form onSubmit={handleSubmit} className="form-card max-w-lg">
        {error && (
          <div className="form-error-banner mb-4">{error}</div>
        )}

        {/* Customer */}
        <div className="form-group">
          <label className="form-label">
            Pelanggan <span className="text-red-500">*</span>
          </label>
          {loadingCustomers ? (
            <div className="input-field text-[var(--text-muted)] text-sm bg-[var(--surface-raised)]">
              Memuat data pelanggan...
            </div>
          ) : customers.length === 0 ? (
            <div className="input-field text-amber-600 text-sm bg-amber-50 border-amber-200">
              Tidak ada pelanggan ditemukan untuk cabang ini
            </div>
          ) : (
            <select
              value={form.customerId}
              onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              className="input-field"
              required
            >
              <option value="">Pilih pelanggan...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Qty */}
        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label className="form-label">Qty 12kg</label>
            <input
              type="number"
              min={0}
              value={form.kg12Qty}
              onChange={(e) => setForm({ ...form, kg12Qty: parseInt(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Qty 50kg</label>
            <input
              type="number"
              min={0}
              value={form.kg50Qty}
              onChange={(e) => setForm({ ...form, kg50Qty: parseInt(e.target.value) || 0 })}
              className="input-field"
            />
          </div>
        </div>

        {/* Channel */}
        <div className="form-group">
          <label className="form-label">Channel Order</label>
          <select
            value={form.channel}
            onChange={(e) => setForm({ ...form, channel: e.target.value })}
            className="input-field"
          >
            <option value="">Tidak dipilih</option>
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Catatan</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input-field"
            rows={3}
            placeholder="Opsional"
          />
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting || loadingCustomers || customers.length === 0}
            className="btn-pri flex-1"
          >
            {submitting ? "Menyimpan..." : "Buat CPO"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/customer-po")}
            className="btn-gho"
          >
            Batal
          </button>
        </div>
      </form>
    </FormPageLayout>
  );
}