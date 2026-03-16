// components/SessionWrapper.tsx
"use client";

import { SessionProvider } from "next-auth/react";
import { BranchProvider } from "@/lib/branch-context";

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BranchProvider>{children}</BranchProvider>
    </SessionProvider>
  );
}