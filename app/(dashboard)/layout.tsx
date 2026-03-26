// app/(dashboard)/layout.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SessionWrapper from "@/components/SessionWrapper";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <SessionWrapper>
      <div className="flex h-screen bg-[var(--bg-base)] overflow-hidden">
        {/* Sidebar: fixed on mobile (handles its own positioning), flex item on desktop */}
        <Sidebar user={session.user} />

        {/* Main content area */}
        <div className="flex flex-col flex-1 min-w-0 w-full">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SessionWrapper>
  );
}