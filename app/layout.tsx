// app/layout.tsx

import type { Metadata } from "next";
import "./globals.css";
import RootProviders from "@/components/RootProviders";

export const metadata: Metadata = {
  title: "SSG Gas Distribution V2",
  description: "Internal admin platform — PT. Arsygas Nix Indonesia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <RootProviders>{children}</RootProviders>
      </body>
    </html>
  );
}