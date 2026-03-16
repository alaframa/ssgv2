// app/(dashboard)/customers/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Holding {
  id: string;
  date: string;
  kg12HeldQty: number;
  kg50HeldQty: number;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  customerType: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  npwp: string | null;
  creditLimitKg12: number;
  creditLimitKg50: number;
  isActive: boolean;
  gasbackBalance: number;
  gasbackDate: string | null;
  holdings: Holding[];
  branch: { code: string; name: string };
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  RETAIL: "Retail",
  AGEN: "Agen",
  INDUSTRI: "Industri",
};
const TYPE_BADGE: Record<string, string> = {
  RETAIL: "badge-info",
  AGEN: "badge-purple",
  INDUSTRI: "badge-warning",
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-32 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] flex-1">{value ?? "—"}</span>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => {
        if (data) setCustomer(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card animate-pulse">
            <div className="h-4 bg-[var(--surface-raised)] rounded w-1/3 mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 bg-[var(--surface-raised)] rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notFound || !customer) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Pelanggan tidak ditemukan</p>
            <Link href="/customers" className="btn-pri mt-4">Kembali ke Daftar</Link>
          </div>
        </div>
      </div>
    );
  }

  const gasbackNum = typeof customer.gasbackBalance === "string"
    ? parseFloat(customer.gasbackBalance)
    : customer.gasbackBalance;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Back + Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="page-title">{customer.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs text-[var(--text-muted)]">{customer.code}</span>
              <span className={TYPE_BADGE[customer.customerType] ?? "badge-neutral"}>
                {TYPE_LABELS[customer.customerType] ?? customer.customerType}
              </span>
              {customer.isActive
                ? <span className="badge-success">Aktif</span>
                : <span className="badge-error">Nonaktif</span>}
            </div>
          </div>
        </div>
        <Link href={`/customers/${id}/edit`} className="btn-gho">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit
        </Link>
      </div>

      {/* Info Card */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Informasi Pelanggan
        </h2>
        <div className="section-divider mt-2" />
        <InfoRow label="Cabang" value={<span className="badge-neutral">{customer.branch.code}</span>} />
        <InfoRow label="Nama" value={customer.name} />
        <InfoRow label="Telepon" value={customer.phone} />
        <InfoRow label="Email" value={customer.email} />
        <InfoRow label="Alamat" value={customer.address} />
        <InfoRow label="NPWP" value={customer.npwp} />
        <InfoRow
          label="Limit Kredit"
          value={
            <span className="font-mono">
              12kg: {customer.creditLimitKg12} tbg &nbsp;|&nbsp; 50kg: {customer.creditLimitKg50} tbg
            </span>
          }
        />
        <InfoRow
          label="Terdaftar"
          value={new Date(customer.createdAt).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
          })}
        />
      </div>

      {/* Gasback Balance Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
            Saldo Gasback
          </h2>
          {customer.gasbackDate && (
            <span className="text-xs text-[var(--text-muted)]">
              Per {new Date(customer.gasbackDate).toLocaleDateString("id-ID")}
            </span>
          )}
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-3xl font-bold font-mono ${gasbackNum >= 0 ? "text-green-600" : "text-red-600"}`}>
            {gasbackNum.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-sm text-[var(--text-muted)] mb-1">kg</span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Saldo gasback adalah akumulasi kelebihan gas yang belum diklaim
        </p>
      </div>

      {/* Cylinder Holdings */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
            Riwayat Tabung di Pelanggan
          </h2>
        </div>
        {customer.holdings.length === 0 ? (
          <div className="empty-state py-8">
            <p className="empty-state-title">Belum ada data tabung</p>
            <p className="empty-state-desc">Akan diisi setelah ada transaksi delivery</p>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th className="num">12 kg (tbg)</th>
                  <th className="num">50 kg (tbg)</th>
                </tr>
              </thead>
              <tbody>
                {customer.holdings.map((h) => (
                  <tr key={h.id}>
                    <td>
                      {new Date(h.date).toLocaleDateString("id-ID", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </td>
                    <td className="num font-mono">{h.kg12HeldQty}</td>
                    <td className="num font-mono">{h.kg50HeldQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}