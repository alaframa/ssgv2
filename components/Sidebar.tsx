// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role: string;
    branchId?: string | null;
  };
}

const NAV = [
  {
    href: "/customers",
    label: "Pelanggan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: "/suppliers",
    label: "Supplier",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
  },
  {
    href: "/employees",
    label: "Karyawan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    href: "/supplier-po",
    label: "PO Supplier",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    href: "/customer-po",
    label: "PO Pelanggan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    href: "/delivery",
    label: "Delivery Order",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13"/>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="18.5" cy="18.5" r="2.5"/>
      </svg>
    ),
  },
  {
    href: "/warehouse",
    label: "Gudang",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  // ── NEW: Individual Cylinder Tracking ──────────────────────────────────────
  {
    href: "/cylinders",
    label: "Tabung Serial",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Cylinder / container icon */}
        <ellipse cx="12" cy="5" rx="7" ry="2.5"/>
        <path d="M5 5v14c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V5"/>
        <path d="M5 12c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5"/>
      </svg>
    ),
  },
  {
    href: "/gasback",
    label: "Gasback",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Laporan",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
  {
    href: "/recon",
    label: "Rekonsiliasi",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/users",
    label: "Pengguna",
    adminOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Pengaturan",
    settingsOnly: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
  },
];

const SETTINGS_ROLES = ["SUPER_ADMIN", "BRANCH_MANAGER", "FINANCE"];

const ROLE_MAP: Record<string, { label: string; cls: string }> = {
  SUPER_ADMIN:     { label: "Super Admin",    cls: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  BRANCH_MANAGER:  { label: "Branch Manager", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  WAREHOUSE_STAFF: { label: "Warehouse",      cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  SALES_STAFF:     { label: "Sales",          cls: "bg-green-500/20 text-green-300 border-green-500/30" },
  FINANCE:         { label: "Finance",        cls: "bg-teal-500/20 text-teal-300 border-teal-500/30" },
  READONLY:        { label: "Read Only",      cls: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
};

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const role = ROLE_MAP[user.role] ?? { label: user.role, cls: "bg-gray-500/20 text-gray-300 border-gray-500/30" };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const items = NAV.filter((n) => {
    if ((n as { adminOnly?: boolean }).adminOnly && user.role !== "SUPER_ADMIN") return false;
    if ((n as { settingsOnly?: boolean }).settingsOnly && !SETTINGS_ROLES.includes(user.role)) return false;
    return true;
  });

  return (
    <aside
      style={{ width: 256, minWidth: 256 }}
      className="flex flex-col h-full bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[var(--sidebar-border)]">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--accent)] shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
            <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--sidebar-text)] leading-tight">SSG Distribusi</p>
          <p className="text-[11px] text-[var(--sidebar-muted)] leading-tight">Gas V2</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                transition-colors duration-100 ${
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--sidebar-text)]"
                }`}
            >
              <span className={active ? "text-white" : "text-[var(--sidebar-muted)]"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-[var(--sidebar-border)]">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px]
            font-semibold border mb-3 ${role.cls}`}
        >
          {role.label}
        </span>

        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/20 flex items-center
            justify-center shrink-0">
            <span className="text-xs font-bold text-[var(--accent)]">
              {(user.name ?? user.email ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[var(--sidebar-text)] truncate">{user.name}</p>
            <p className="text-[11px] text-[var(--sidebar-muted)] truncate">{user.email}</p>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs
            text-[var(--sidebar-muted)] hover:bg-[var(--sidebar-hover)]
            hover:text-[var(--error)] transition-colors duration-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Keluar
        </button>
      </div>
    </aside>
  );
}