import type { ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";

import { WarmingBar } from "@/components/WarmingBanner";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata = {
  title: "모아 — 내 돈이 보이는 가계부",
  description: "거래, 예산, 자산을 한눈에 관리하는 똑똑하고 편안한 가계부",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="ko" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <WarmingBar />
        {children}
      </body>
    </html>
  );
}
