import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { Providers } from "@/providers/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Swasth Seva — AI-Powered Smart Hospital Queue & Patient Flow",
  description:
    "Book OP visits, get AI triage, digital tokens, real-time queue tracking, and AI wait-time predictions at your nearest hospital.",
  keywords: ["hospital", "queue management", "OP booking", "AI triage", "healthcare", "Swasth Seva"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <Providers>{children}</Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
