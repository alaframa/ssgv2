// app/(dashboard)/settings/page.tsx
"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

const ALLOWED_ROLES = ["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"];

interface SettingsCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  roles?: string[]; // if undefined = all allowed roles can see
}

const SETTINGS_CARDS: SettingsCard[] = [
  {
    href: "/settings/gasback",
    title: "Pengaturan Gasback",
    description:
      "Konfigurasi mode kalkulasi, tarif per tabung, threshold redemption, dan ukuran isi gratis.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    href: "/settings/cylinder-types",
    title: "Jenis Tabung",
    description:
      "Kelola jenis tabung gas — kapasitas, berat kosong (tare), dan konfigurasi untuk mode timbang.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "";
  const canAccess = ALLOWED_ROLES.includes(role);

  if (!canAccess) {
    return (
      <div className="page-container max-w-2xl">
        <h1 className="page-title">Pengaturan</h1>
        <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
          Anda tidak memiliki akses ke halaman pengaturan.
        </div>
      </div>
    );
  }

  const visibleCards = SETTINGS_CARDS.filter(
    (c) => !c.roles || c.roles.includes(role),
  );

  return (
    <div className="page-container space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="page-title">Pengaturan</h1>
        <p className="page-desc">Konfigurasi sistem distribusi gas</p>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="card p-5 flex gap-4 items-start hover:border-[var(--accent)]/50
              hover:bg-[var(--surface-raised)] transition-all group"
          >
            {/* Icon */}
            <div
              className="shrink-0 w-10 h-10 rounded-xl bg-[var(--accent-light)]
              flex items-center justify-center text-[var(--accent)]
              group-hover:bg-[var(--accent)] group-hover:text-white transition-colors"
            >
              {card.icon}
            </div>

            {/* Text */}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-1">
                {card.title}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5
                    transition-all shrink-0"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                {card.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
