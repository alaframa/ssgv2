// app/(dashboard)/suppliers/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface HmtQuota {
  id: string;
  cylinderSize: string;
  periodMonth: number;
  periodYear: number;
  quotaQty: number;
  pricePerUnit: string | number;
  branch: { code: string; name: string };
}

interface Supplier {
  id: string;
  code: string;
  name: string;
  npwp: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  hmtQuotas: HmtQuota[];
}

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide w-28 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-[var(--text-primary)] flex-1">{value ?? "—"}</span>
    </div>
  );
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/suppliers/${id}`)
      .then((r) => r.json())
      .then(setSupplier)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="card animate-pulse space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-4 bg-[var(--surface-raised)] rounded" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="card">
          <div className="empty-state">
            <p className="empty-state-title">Supplier tidak ditemukan</p>
            <Link href="/suppliers" className="btn-pri mt-4">Kembali</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/suppliers" className="btn-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <h1 className="page-title">{supplier.name}</h1>
            <span className="font-mono text-xs text-[var(--text-muted)]">{supplier.code}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/suppliers/${id}/hmt-quota/add`} className="btn-pri">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Set HMT Quota
          </Link>
          <Link href={`/suppliers/${id}/edit`} className="btn-gho">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </Link>
        </div>
      </div>

      {/* Info */}
      <div className="card">
        <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Informasi Supplier
        </h2>
        <div className="section-divider mt-2" />
        <InfoRow label="Kode" value={<span className="font-mono">{supplier.code}</span>} />
        <InfoRow label="Nama" value={supplier.name} />
        <InfoRow label="NPWP" value={supplier.npwp} />
        <InfoRow label="Telepon" value={supplier.phone} />
        <InfoRow label="Email" value={supplier.email} />
        <InfoRow label="Alamat" value={supplier.address} />
        <InfoRow
          label="Terdaftar"
          value={new Date(supplier.createdAt).toLocaleDateString("id-ID", {
            day: "numeric", month: "long", year: "numeric",
          })}
        />
      </div>

      {/* HMT Quota table */}
      <div className="card p-0">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wide">
            HMT Quota
          </h2>
          <Link href={`/suppliers/${id}/hmt-quota/add`} className="btn-pri py-1.5 px-3 text-xs">
            + Set Quota
          </Link>
        </div>
        {supplier.hmtQuotas.length === 0 ? (
          <div className="empty-state py-8">
            <p className="empty-state-title">Belum ada quota HMT</p>
            <p className="empty-state-desc">Klik "Set HMT Quota" untuk menambah</p>
          </div>
        ) : (
          <div className="table-wrap rounded-none border-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cabang</th>
                  <th>Periode</th>
                  <th>Ukuran</th>
                  <th className="num">Quota (tbg)</th>
                  <th className="num">Harga/tbg (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {supplier.hmtQuotas.map((q) => (
                  <tr key={q.id}>
                    <td><span className="badge-neutral">{q.branch.code}</span></td>
                    <td className="text-[var(--text-muted)]">
                      {MONTH_NAMES[q.periodMonth]} {q.periodYear}
                    </td>
                    <td>
                      <span className={q.cylinderSize === "KG12" ? "badge-info" : "badge-warning"}>
                        {q.cylinderSize === "KG12" ? "12 kg" : "50 kg"}
                      </span>
                    </td>
                    <td className="num font-mono">{q.quotaQty.toLocaleString("id-ID")}</td>
                    <td className="num font-mono">
                      {parseFloat(String(q.pricePerUnit)).toLocaleString("id-ID")}
                    </td>
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