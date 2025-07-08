// app/layout.jsx  (Server Component – ไม่มี "use client")
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import SidebarCard from "./components/sidebar";
import Sidebar from "./components/Sidebar2";
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Restaurant Ordering System",
  description: "Next.js + Bun/Elysia WebSocket demo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* ⭐️ โค้ดทุกหน้า (รวม OrderPage, Kitchen ฯลฯ) จะถูกห่อด้วย Provider ที่นี่ */}
        {children}
      </body>
    </html>
  );
}
