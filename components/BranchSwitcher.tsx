// components/BranchSwitcher.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useBranch } from "@/lib/branch-context";

interface Branch { id: string; code: string; name: string; }

export default function BranchSwitcher() {
  const { data: session } = useSession();
  const { activeBranchId, activeBranchCode, setActiveBranchId } = useBranch();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data: Branch[]) => {
        setBranches(data);
        if (!activeBranchId && data.length > 0) {
          setActiveBranchId(data[0].id, data[0].code);
        }
      })
      .catch(console.error);
  }, [isSuperAdmin]); // eslint-disable-line

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Branch Manager — read-only chip
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg
        bg-[var(--surface-raised)] border border-[var(--border)]">
        <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          {activeBranchCode ?? "—"}
        </span>
      </div>
    );
  }

  const active = branches.find((b) => b.id === activeBranchId);
  const displayCode = active?.code ?? activeBranchCode ?? "—";

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg
          bg-[var(--surface-raised)] border border-[var(--border)]
          hover:border-[var(--accent)] transition-colors text-sm cursor-pointer">
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
        <span className="font-medium text-[var(--text-primary)]">{displayCode}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 z-50
          bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border)]">
            <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              Pilih Cabang
            </p>
          </div>
          {branches.map((b) => (
            <button key={b.id}
              onClick={() => { setActiveBranchId(b.id, b.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left
                hover:bg-[var(--surface-raised)] transition-colors
                ${activeBranchId === b.id ? "text-[var(--accent)] font-semibold" : "text-[var(--text-primary)]"}`}>
              <span className={`w-2 h-2 rounded-full shrink-0
                ${activeBranchId === b.id ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]"}`} />
              <span>{b.code}</span>
              <span className="text-[var(--text-muted)] text-xs ml-auto">{b.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}