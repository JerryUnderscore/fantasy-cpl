import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/app-shell";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Fantasy CPL",
  description: "Fantasy CPL beta",
  icons: {
    icon: "/brand/favicon.png",
    shortcut: "/brand/favicon.png",
    apple: "/brand/favicon.png",
  },
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
