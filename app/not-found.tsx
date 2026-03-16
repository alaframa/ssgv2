// app/not-found.tsx

/**
 * Global 404 handler.
 *
 * Logic:
 * - Authenticated users  → see this "Under Development" page
 * - Unauthenticated users → middleware already redirects to /login
 *   (but if they somehow reach here, the login link is shown)
 *
 * This is a Server Component — we use getServerSession to check auth.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function NotFound() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">

        {/* Big 404 number */}
        <div className="relative mb-6 select-none">
          <span
            className="text-[160px] font-black leading-none"
            style={{
              background: "linear-gradient(135deg, #2563eb22, #2563eb08)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              display: "block",
            }}
          >
            404
          </span>
          {/* Gas cylinder icon overlaid */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] flex items-center justify-center shadow-lg">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          Halaman Sedang Dikembangkan
        </h1>
        <p className="text-[var(--text-muted)] text-sm mb-1">
          Halaman ini belum tersedia atau sedang dalam proses pengembangan.
        </p>
        <p className="text-[var(--text-muted)] text-sm mb-8">
          Hubungi administrator jika Anda membutuhkan akses segera.
        </p>

        {/* Contact admin badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-[var(--surface)] border border-[var(--border)] mb-8 shadow-sm">
          <div className="w-7 h-7 rounded-full bg-[var(--accent)]/10 flex items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-[11px] text-[var(--text-muted)] leading-tight">Hubungi admin</p>
            <a
              href="mailto:admin@ssg.id"
              className="text-sm font-semibold text-[var(--accent)] hover:underline"
            >
              admin@ssg.id
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {session ? (
            <>
              <Link href="/customers" className="btn-pri justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Kembali ke Dashboard
              </Link>
              <Link href="javascript:history.back()" className="btn-gho justify-center">
                Halaman Sebelumnya
              </Link>
            </>
          ) : (
            <Link href="/login" className="btn-pri justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Masuk ke Sistem
            </Link>
          )}
        </div>

        {/* Footer note */}
        <p className="text-[11px] text-[var(--text-muted)] mt-10">
          SSG Gas Distribution V2 — PT. Arsygas Nix Indonesia
        </p>
      </div>
    </div>
  );
}