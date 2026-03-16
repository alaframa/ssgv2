// app/(auth)/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Loop prevention: already authenticated → skip straight to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/customers");
    }
  }, [status, router]);

  // Show spinner while session resolves or redirecting
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--bg-base)]">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email atau password salah.");
    } else if (result?.ok) {
      router.replace("/customers");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl p-8">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
            bg-[var(--accent)] mb-4 shadow-md">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">SSG Gas Distribution</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Masuk ke dashboard internal</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="admin@ssg.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password + eye toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="form-label mb-0">Password</label>
              <Link
                href="/forgot-password"
                className="text-xs text-[var(--accent)] hover:underline"
                tabIndex={-1}
              >
                Lupa password?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="form-input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              {/* Eye toggle button */}
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2
                  text-[var(--text-muted)] hover:text-[var(--text-primary)]
                  transition-colors p-0.5"
                tabIndex={-1}
                aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              >
                {showPassword ? (
                  /* Eye-off icon */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  /* Eye icon */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--error)]
              bg-[var(--error-bg)] border border-red-200 rounded-lg px-3 py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} className="btn-pri w-full justify-center mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent
                  rounded-full animate-spin" />
                Memproses...
              </span>
            ) : (
              "Masuk"
            )}
          </button>
        </form>

        {/* Register link */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-5">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="text-[var(--accent)] font-semibold hover:underline"
          >
            Daftar di sini
          </Link>
        </p>
      </div>

      <p className="text-center text-xs text-[var(--text-muted)] mt-5">
        PT. Arsygas Nix Indonesia © 2026
      </p>
    </div>
  );
}