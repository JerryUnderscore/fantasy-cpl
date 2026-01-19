import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Fantasy CPL",
  description: "Fantasy CPL beta",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
