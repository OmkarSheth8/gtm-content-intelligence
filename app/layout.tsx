import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { AccountNav } from "@/components/AccountNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GTM Content Intelligence",
  description: "Self-updating GTM content analytics and recommendation engine",
};

// Static fallback shown while AccountNav resolves useSearchParams
function NavFallback() {
  return (
    <nav className="flex gap-6 text-sm">
      <span className="text-zinc-400">Sources</span>
      <span className="text-zinc-400">Dashboard</span>
      <span className="text-zinc-400">Recommendations</span>
      <span className="text-zinc-400">ROI</span>
    </nav>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-3 flex items-center justify-between">
          <Link
            href="/sources"
            className="font-semibold text-sm tracking-tight hover:text-blue-600 transition-colors"
          >
            GTM Content Intelligence
          </Link>
          <Suspense fallback={<NavFallback />}>
            <AccountNav />
          </Suspense>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}