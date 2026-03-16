// lib/branch-context.tsx
"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface BranchContextType {
  activeBranchId: string | null;
  activeBranchCode: string | null;
  setActiveBranchId: (id: string | null, code: string | null) => void;
}

const BranchContext = createContext<BranchContextType>({
  activeBranchId: null,
  activeBranchCode: null,
  setActiveBranchId: () => {},
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [activeBranchId, setId] = useState<string | null>(null);
  const [activeBranchCode, setCode] = useState<string | null>(null);

  useEffect(() => {
    // Non-SUPER_ADMIN: lock to their own branchId from session
    if (session?.user?.branchId) {
      setId(session.user.branchId);
    }
  }, [session?.user?.branchId]);

  const setActiveBranchId = (id: string | null, code: string | null) => {
    setId(id);
    setCode(code);
  };

  return (
    <BranchContext.Provider value={{ activeBranchId, activeBranchCode, setActiveBranchId }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}