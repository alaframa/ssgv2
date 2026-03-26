// components/Skeleton.tsx
"use client";

import React from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: "sm" | "md" | "lg" | "full";
}

export function Skeleton({ className = "", width, height, rounded = "md" }: SkeletonProps) {
  const radiusMap = {
    sm: "var(--radius-sm)",
    md: "var(--radius-md)",
    lg: "var(--radius-lg)",
    full: "9999px",
  };

  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width:        width  ?? undefined,
        height:       height ?? undefined,
        borderRadius: radiusMap[rounded],
      }}
    />
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton height={16} width="40%" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} height={13} width={`${70 + (i % 3) * 10}%`} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 px-5 py-3 border-b border-[var(--border)]">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} width={`${60 + (i % 3) * 20}px`} />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, ri) => (
        <div
          key={ri}
          className="flex gap-4 px-5 py-3 border-b border-[var(--border)] last:border-0"
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <Skeleton
              key={ci}
              height={13}
              width={`${50 + ((ri + ci) % 4) * 15}px`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpiCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton height={11} width="55%" />
        <Skeleton height={32} width={32} rounded="lg" />
      </div>
      <Skeleton height={32} width="45%" />
      <Skeleton height={10} width="35%" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>
      {/* Two column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard rows={6} />
        <SkeletonCard rows={5} />
      </div>
    </div>
  );
}