// app/(auth)/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Loop prevention: already authenticated → skip login form ──
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/customers");
    }
  }, [status, router]);

  // Show spinner while session status resolves
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
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent)] mb-4 shadow-md">
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

        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-[var(--error)] bg-[var(--error-bg)] border border-red-200
                            rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-pri w-full justify-center mt-2">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Memproses...
              </span>
            ) : "Masuk"}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-[var(--text-muted)] mt-5">
        PT. Arsygas Nix Indonesia © 2026
      </p>
    </div>
  );
}