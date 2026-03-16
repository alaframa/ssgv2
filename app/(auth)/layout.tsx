// app/(auth)/layout.tsx

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center p-4">
      {children}
    </div>
  );
}