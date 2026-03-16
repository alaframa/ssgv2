// components/SessionWrapper.tsx
"use client";

import { BranchProvider } from "@/lib/branch-context";

// SessionProvider is now at root (app/layout.tsx).
// This wrapper only adds BranchProvider for dashboard routes.
export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return <BranchProvider>{children}</BranchProvider>;
}