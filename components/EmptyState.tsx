// components/EmptyState.tsx
"use client";

import React from "react";
import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

const DefaultIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-raised)] flex items-center
        justify-center text-[var(--text-muted)] mb-4">
        {icon ?? <DefaultIcon />}
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-[var(--text-muted)] max-w-xs mb-5">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-pri text-xs py-2 px-4">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-pri text-xs py-2 px-4">
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Preset empties for common pages
export function EmptyCustomers() {
  return (
    <EmptyState
      title="Belum ada pelanggan"
      description="Tambah pelanggan pertama untuk mulai membuat PO dan DO."
      actionLabel="Tambah Pelanggan"
      actionHref="/customers/add"
    />
  );
}

export function EmptyDeliveryOrders() {
  return (
    <EmptyState
      title="Belum ada Delivery Order"
      description="DO dibuat dari Customer PO yang sudah dikonfirmasi."
      actionLabel="Lihat Customer PO"
      actionHref="/customer-po"
    />
  );
}

export function EmptySearch({ query }: { query: string }) {
  return (
    <EmptyState
      title={`Tidak ada hasil untuk "${query}"`}
      description="Coba kata kunci lain atau hapus filter."
    />
  );
}