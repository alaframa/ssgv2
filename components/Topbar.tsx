// components/Topbar.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumb";
import BranchSwitcher from "@/components/BranchSwitcher";
import { toggleMobileSidebar } from "@/components/Sidebar";

export default function Topbar() {
  return (
    <header className="h-14 shrink-0 flex items-center gap-3 px-4 md:px-6
      bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-30">

      {/* Hamburger — only visible on mobile */}
      <button
        className="md:hidden flex items-center justify-center w-8 h-8 rounded-lg
          text-[var(--text-muted)] hover:bg-[var(--bg-hover)] transition-colors"
        onClick={() => toggleMobileSidebar?.()}
        aria-label="Toggle menu"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6"  x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <Breadcrumb />
      </div>

      <BranchSwitcher />
    </header>
  );
}