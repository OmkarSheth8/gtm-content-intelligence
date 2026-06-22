import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
        <header className="border-b border-zinc-200 dark:border-zinc-800 px-8 py-3 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight">GTM Content Intelligence</span>
          <nav className="flex gap-6 text-sm">
            <Link href="/dashboard" className="hover:text-blue-600 transition-colors">Dashboard</Link>
            <Link href="/recommendations" className="hover:text-blue-600 transition-colors">Recommendations</Link>
            <Link href="/roi" className="hover:text-blue-600 transition-colors">ROI</Link>
          </nav>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}