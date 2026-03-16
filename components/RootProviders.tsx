// components/RootProviders.tsx
"use client";

import { SessionProvider } from "next-auth/react";

export default function RootProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}