import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "同行成林｜讓每一次真實行動長成共同的森林",
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
