import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "綠伴 Elder Tree｜讓每一步長成城市的森林",
  description:
    "結合城市探索、高齡陪伴、AI 任務驗證與實體互動樹的開放參與平台。",
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
