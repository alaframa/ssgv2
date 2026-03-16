// components/Topbar.tsx

import Breadcrumb from "@/components/Breadcrumb";
import BranchSwitcher from "@/components/BranchSwitcher";

export default function Topbar() {
  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-6
      bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-30">
      <Breadcrumb />
      <BranchSwitcher />
    </header>
  );
}