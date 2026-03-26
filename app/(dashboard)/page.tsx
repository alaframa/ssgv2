// app/(dashboard)/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useBranch } from "@/lib/branch-context";
import { SkeletonDashboard } from "@/components/Skeleton";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Kpi {
  deliveriesToday: number;
  fullCylinders: number;
  hmt12Pct: number;
  hmt50Pct: number;
  hmt12Used: number;
  hmt12Quota: number;
  hmt50Used: number;
  hmt50Quota: number;
  totalGasbackKg: number;
  emptiesThisMonth: number;
  activeCustomers: number;
  inTransitCylinders: number;
  stock12Full: number;
  stock50Full: number;
}

interface ActivityItem {
  id: string;
  type: string;
  label: string;
  sub: string;
  createdAt: string;
}

interface PendingAction {
  type: string;
  message: string;
  count?: number;
  href: string;
}

interface DashboardData {
  kpi: Kpi;
  recentActivity: ActivityItem[];
  pendingActions: PendingAction[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtNum(n: number) {
  return n.toLocaleString("id-ID");
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  accent,
  progress,
  progressPct,
  progressWarn,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  accent?: string;
  progress?: boolean;
  progressPct?: number;
  progressWarn?: boolean;
  href?: string;
}) {
  const inner = (
    <div className={`card p-5 flex flex-col gap-3 transition-all ${href ? "cursor-pointer hover:border-[var(--border-focus)]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] leading-tight">
          {label}
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: accent ? `${accent}18` : "var(--surface-raised)", color: accent ?? "var(--text-muted)" }}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-mono text-[var(--text-primary)] leading-none">
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-muted)]">{sub}</p>}
      {progress && progressPct !== undefined && (
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-[var(--surface-raised)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressWarn ? "bg-red-400" : "bg-blue-500"}`}
              style={{ width: `${Math.min(progressPct, 100)}%` }}
            />
          </div>
          <p className={`text-[10px] font-mono ${progressWarn ? "text-red-400" : "text-[var(--text-muted)]"}`}>
            {progressPct}% terpakai{progressWarn ? " ⚠ mendekati batas" : ""}
          </p>
        </div>
      )}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Activity icon ─────────────────────────────────────────────────────────────
function ActivityIcon({ type }: { type: string }) {
  const map: Record<string, { icon: string; color: string }> = {
    DO:     { icon: "🚛", color: "#3b82f6" },
    GR:     { icon: "📦", color: "#10b981" },
    RETURN: { icon: "↩️",  color: "#f59e0b" },
    GASBACK:{ icon: "⛽",  color: "#8b5cf6" },
  };
  const { icon, color } = map[type] ?? { icon: "•", color: "#6b7280" };
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
      style={{ background: `${color}18` }}
    >
      {icon}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { activeBranchId } = useBranch();
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!activeBranchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?branchId=${activeBranchId}`);
      if (!res.ok) throw new Error("Gagal memuat dashboard");
      const d: DashboardData = await res.json();
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return <SkeletonDashboard />;
  if (error)   return (
    <div className="card p-6 text-center space-y-3">
      <p className="text-[var(--error)]">{error}</p>
      <button className="btn-gho text-sm" onClick={loadDashboard}>Coba lagi</button>
    </div>
  );
  if (!data) return null;

  const { kpi, recentActivity, pendingActions } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-desc">Ringkasan operasional harian SSG</p>
      </div>

      {/* Pending Actions */}
      {pendingActions.length > 0 && (
        <div className="space-y-2">
          {pendingActions.map((a, i) => (
            <Link key={i} href={a.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border
                border-amber-400/30 bg-amber-400/8 hover:bg-amber-400/12
                transition-colors text-sm text-amber-300"
            >
              <span className="text-amber-400">⚠</span>
              <span className="flex-1">{a.message}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </Link>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Pengiriman Hari Ini"
          value={fmtNum(kpi.deliveriesToday)}
          sub="DO dibuat hari ini"
          accent="#3b82f6"
          href="/delivery-orders"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          }
        />
        <KpiCard
          label="Tabung Full Gudang"
          value={fmtNum(kpi.fullCylinders)}
          sub={`12kg: ${fmtNum(kpi.stock12Full)} · 50kg: ${fmtNum(kpi.stock50Full)}`}
          accent="#10b981"
          href="/warehouse"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
            </svg>
          }
        />
        <KpiCard
          label="HMT 12kg"
          value={`${kpi.hmt12Pct}%`}
          sub={`${fmtNum(kpi.hmt12Used)} / ${fmtNum(kpi.hmt12Quota)} tabung`}
          accent={kpi.hmt12Pct >= 80 ? "#ef4444" : "#f59e0b"}
          progress
          progressPct={kpi.hmt12Pct}
          progressWarn={kpi.hmt12Pct >= 80}
          href="/supplier-po"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          }
        />
        <KpiCard
          label="HMT 50kg"
          value={`${kpi.hmt50Pct}%`}
          sub={`${fmtNum(kpi.hmt50Used)} / ${fmtNum(kpi.hmt50Quota)} tabung`}
          accent={kpi.hmt50Pct >= 80 ? "#ef4444" : "#8b5cf6"}
          progress
          progressPct={kpi.hmt50Pct}
          progressWarn={kpi.hmt50Pct >= 80}
          href="/supplier-po"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6"  y1="20" x2="6"  y2="14"/>
            </svg>
          }
        />
        <KpiCard
          label="Saldo Gasback"
          value={`${fmtNum(kpi.totalGasbackKg)} kg`}
          sub="Total akumulasi semua pelanggan"
          accent="#8b5cf6"
          href="/customers"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          }
        />
        <KpiCard
          label="Tabung Kosong Kembali"
          value={fmtNum(kpi.emptiesThisMonth)}
          sub="Bulan ini (12kg + 50kg)"
          accent="#f59e0b"
          href="/warehouse"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
            </svg>
          }
        />
        <KpiCard
          label="Pelanggan Aktif"
          value={fmtNum(kpi.activeCustomers)}
          sub="Terdaftar dan aktif"
          accent="#06b6d4"
          href="/customers"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
            </svg>
          }
        />
        <KpiCard
          label="Tabung di Jalan"
          value={fmtNum(kpi.inTransitCylinders)}
          sub="Sedang dalam pengiriman"
          accent="#ec4899"
          href="/delivery-orders?status=IN_TRANSIT"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          }
        />
      </div>

      {/* Bottom: Activity + Pending */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <div className="card p-0">
          <div className="px-5 py-4 border-b border-[var(--border)]">
            <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
              Aktivitas Terbaru
            </h2>
          </div>
          {recentActivity.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--text-muted)]">
              Belum ada aktivitas
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {recentActivity.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <ActivityIcon type={a.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{a.label}</p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{a.sub}</p>
                  </div>
                  <span className="text-[11px] text-[var(--text-muted)] shrink-0">
                    {relTime(a.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="card p-5 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Ringkasan Stok Gudang
          </h2>

          <div className="space-y-3">
            {[
              {
                label: "12kg Full",
                value: kpi.stock12Full,
                total: kpi.stock12Full + kpi.inTransitCylinders,
                color: "#3b82f6",
              },
              {
                label: "50kg Full",
                value: kpi.stock50Full,
                total: kpi.stock50Full + kpi.inTransitCylinders,
                color: "#10b981",
              },
            ].map(({ label, value, color }) => (
              <div key={label} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{label}</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">
                    {fmtNum(value)} tabung
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-raised)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: color,
                      width: value > 0 ? "100%" : "0%",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border)] pt-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-[var(--surface-raised)] p-3">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">In Transit</p>
              <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {fmtNum(kpi.inTransitCylinders)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-raised)] p-3">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide mb-1">Kosong Balik</p>
              <p className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {fmtNum(kpi.emptiesThisMonth)}
              </p>
            </div>
          </div>

          <div className="pt-1">
            <Link href="/warehouse" className="btn-gho w-full justify-center text-sm">
              Lihat Detail Gudang →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}