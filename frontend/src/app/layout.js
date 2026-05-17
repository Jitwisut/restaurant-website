/* eslint-disable @next/next/no-page-custom-font */
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AuthProvider } from "./components/AuthProvider";
import "./globals.css";

const appSans = Noto_Sans_Thai({
  variable: "--font-app-sans",
  subsets: ["thai"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});
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
    <html lang="th" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${appSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AuthProvider>{children}</AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
