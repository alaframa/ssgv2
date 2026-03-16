// app/page.tsx
import { redirect } from "next/navigation";

// Root "/" → redirect into the dashboard.
// The dashboard layout (app/(dashboard)/layout.tsx) handles auth guard.
export default function RootPage() {
  redirect("/customers");
}