// app/(dashboard)/customer-po/add/page.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBranch } from "@/lib/branch-context";
import FormPageLayout from "@/components/FormPageLayout";

// ─── Types ────────────────────────────────────────────────────────────────────
type Customer = {
  id: string;
  name: string;
  code: string;
  customerType: string;
};

const CHANNEL_OPTIONS = [
  { value: "WHATSAPP",    label: "WhatsApp" },
  { value: "PHONE",       label: "Telepon" },
  { value: "WALK_IN",     label: "Walk-in" },
  { value: "SALES_VISIT", label: "Sales Visit" },
];

const TYPE_BADGE: Record<string, string> = {
  RETAIL:   "bg-blue-100 text-blue-700",
  AGEN:     "bg-purple-100 text-purple-700",
  INDUSTRI: "bg-amber-100 text-amber-700",
};

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return dv;
}

// ─── Customer Search — side-by-side layout ────────────────────────────────────
interface CustomerSearchProps {
  activeBranchId: string | null;
  value: Customer | null;
  onChange: (c: Customer | null) => void;
}

function CustomerSearch({ activeBranchId, value, onChange }: CustomerSearchProps) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [active,  setActive]  = useState(false);

  const debouncedQuery = useDebounce(query, 300);
  const wrapperRef     = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setActive(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const fetchResults = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", pageSize: "10" });
      if (activeBranchId) params.set("branchId", activeBranchId);
      if (search.trim())  params.set("search", search.trim());
      const res  = await fetch(`/api/customers?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const list: Customer[] =
        Array.isArray(json)         ? json :
        Array.isArray(json.data)    ? json.data :
        Array.isArray(json.records) ? json.records : [];
      setResults(list);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    if (active) fetchResults(debouncedQuery);
  }, [debouncedQuery, active, fetchResults]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    if (value) onChange(null);
    setActive(true);
  }

  function handleFocus() {
    setActive(true);
    if (results.length === 0) fetchResults(query);
  }

  function handleSelect(c: Customer) {
    onChange(c);
    setQuery("");
    setActive(false);
    inputRef.current?.blur();
  }

  function handleClear() {
    onChange(null);
    setQuery("");
    setResults([]);
    setActive(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const showPanel = active && !value;

  return (
    <div ref={wrapperRef}>
      {/*
        Side-by-side:
        LEFT  (40%) — search input
        RIGHT (60%) — results list OR selected badge
        When idle (nothing active, nothing selected): input takes full width.
      */}
      <div className={`flex gap-3 ${showPanel || value ? "items-start" : "items-center"}`}>

        {/* ── LEFT: Search Input ── */}
        <div className={`relative flex items-center ${showPanel || value ? "w-2/5 shrink-0" : "flex-1"}`}>
          

          <input
            ref={inputRef}
            type="text"
            className="input-field pl-10 pr-8 w-full"
            placeholder={value ? "" : "Cari nama / kode..."}
            value={value ? `${value.code} — ${value.name}` : query}
            onChange={handleInputChange}
            onFocus={handleFocus}
            readOnly={!!value}
            autoComplete="off"
          />

          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 text-[var(--text-muted)] hover:text-red-500 transition-colors"
              title="Ganti pelanggan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── RIGHT: Results panel — inline, pushes content down instead of floating ── */}
        {showPanel && (
          <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm overflow-hidden">
            {loading ? (
              <div className="px-4 py-3 text-sm text-[var(--text-muted)] flex items-center gap-2">
                <span className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full inline-block" />
                Mencari...
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-3 text-sm text-[var(--text-muted)]">
                {query.trim() ? `Tidak ada hasil untuk "${query}"` : "Tidak ada pelanggan ditemukan"}
              </div>
            ) : (
              <ul className="max-h-52 overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {results.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(c)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[var(--surface-raised)] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${TYPE_BADGE[c.customerType] ?? "bg-gray-100 text-gray-600"}`}>
                          {c.customerType}
                        </span>
                        <span className="font-mono text-xs text-[var(--text-muted)]">{c.code}</span>
                      </div>
                      <div className="text-sm font-medium truncate">{c.name}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {results.length > 0 && (
              <div className="px-3 py-1 bg-[var(--surface-raised)] border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
                {results.length} hasil — ketik lebih spesifik untuk mempersempit
              </div>
            )}
          </div>
        )}

        {/* ── RIGHT: Selected badge ── */}
        {value && (
          <div className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-xl border border-green-200 bg-green-50">
            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_BADGE[value.customerType] ?? "bg-gray-100 text-gray-600"}`}>
              {value.customerType}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-[var(--text-muted)]">{value.code}</div>
              <div className="text-sm font-semibold truncate">{value.name}</div>
            </div>
            <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </div>
        )}
      </div>

      {/* Idle hint */}
      {!value && !active && (
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Klik kolom lalu ketik nama atau kode pelanggan
        </p>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomerPoAddPage() {
  const router = useRouter();
  const { activeBranchId } = useBranch();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [submitting,        setSubmitting]        = useState(false);
  const [error,             setError]             = useState("");

  const [form, setForm] = useState({
    kg12Qty: 0,
    kg50Qty: 0,
    channel: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!selectedCustomer) {
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
          customerId: selectedCustomer.id,
          branchId:   activeBranchId,
          kg12Qty:    form.kg12Qty,
          kg50Qty:    form.kg50Qty,
          channel:    form.channel || null,
          notes:      form.notes   || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan PO");
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
      title="Buat Customer PO"
      backHref="/customer-po"
      backLabel="Kembali ke Daftar CPO"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Customer Search */}
        <div className="form-group">
          <label className="form-label">
            Pelanggan <span className="text-red-400">*</span>
          </label>
          <CustomerSearch
            activeBranchId={activeBranchId}
            value={selectedCustomer}
            onChange={setSelectedCustomer}
          />
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
            disabled={submitting || !selectedCustomer}
            className="btn-pri flex-1"
          >
            {submitting ? "Menyimpan..." : "Simpan Customer PO"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/customer-po")}
            className="btn-sec"
          >
            Batal
          </button>
        </div>
      </form>
    </FormPageLayout>
  );
}