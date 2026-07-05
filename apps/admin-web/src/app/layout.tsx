import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "綠伴營運台",
  description: "陪伴互動樹、日常任務與模擬 ESG 成果管理",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
