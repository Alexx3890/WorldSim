import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "WorldSim AI — Test Decisions Before Reality",
  description:
    "A simulation engine that lets you model real-world decisions, compare strategies, and understand outcomes before committing to action.",
  keywords: ["simulation", "decision making", "AI", "Monte Carlo", "what-if analysis"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} font-sans antialiased bg-[var(--bg)] text-[var(--text)] min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
