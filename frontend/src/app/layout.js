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
      <body className="flex h-screen overflow-hidden antialiased">
        {/* Sidebar */}
        <SidebarCard />

        {/* ⭐️ โค้ดทุกหน้า (รวม OrderPage, Kitchen ฯลฯ) จะถูกห่อด้วย Provider ที่นี่ */}

        {/* พื้นที่หลัก */}
        <main className="flex flex-1 items-center justify-center p-6">
          {children} {/* หน้าต่างๆ จะมาอยู่ตรงกลางจริง ๆ */}
        </main>
      </body>
    </html>
  );
}
