// components/FormPageLayout.tsx
"use client";

import { useRouter } from "next/navigation";

interface Props {
  title: string;
  backHref?: string;
  backLabel: string; 
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function FormPageLayout({ title, backHref, backLabel, actions, children }: Props) {
  const router = useRouter();

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => backHref ? router.push(backHref) : router.back()}
            className="btn-icon" aria-label={backLabel}  // Use backLabel here
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6">
        {children}
      </div>
    </div>
  );
}