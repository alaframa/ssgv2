// components/Breadcrumb.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  customers:      "Pelanggan",
  suppliers:      "Supplier",
  employees:      "Karyawan",
  "supplier-po":  "PO Supplier",
  "customer-po":  "PO Pelanggan",
  delivery:       "Delivery Order",
  warehouse:      "Gudang",
  gasback:        "Gasback",
  reports:        "Laporan",
  recon:          "Rekonsiliasi",
  users:          "Pengguna",
  settings:       "Pengaturan",
  add:            "Tambah",
  edit:           "Edit",
  claims:         "Klaim",
  inbound:        "Penerimaan",
  returns:        "Return Kosong",
  writeoff:       "Hapus Buku",
  "rekap-kirim":  "Rekap Kirim",
  "stock-tabung": "Stock Tabung",
  "do-vs-po":     "DO vs PO",
  pencapaian:     "Pencapaian",
  "hmt-quota":    "HMT Quota",
  roles:          "Role",
};

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return <span className="text-sm text-[var(--text-muted)]">Dashboard</span>;
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const href = "/" + segments.slice(0, idx + 1).join("/");
        const isId = seg.length > 20 && !LABELS[seg];
        const label = isId ? "Detail" : (LABELS[seg] ?? seg);

        return (
          <span key={href} className="flex items-center gap-1.5">
            {idx > 0 && (
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                strokeLinejoin="round" className="text-[var(--text-muted)]"
              >
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
            {isLast ? (
              <span className="font-semibold text-[var(--text-primary)]">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}