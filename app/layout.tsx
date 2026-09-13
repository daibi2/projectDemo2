import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "泊位管家 | 停车场管理",
  description: "安全、简洁的停车场运营管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
