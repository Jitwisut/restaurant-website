"use client";

import { DoorClosed, Home, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function TableClosedPage() {
  return (
    <main
      className="min-h-screen bg-[#fff7f7] text-slate-900"
      style={{
        display: "grid",
        placeItems: "center",
        padding: "24px",
        width: "100%",
        minWidth: 0,
      }}
    >
      <section
        className="border border-rose-100 bg-white shadow-xl"
        style={{
          width: "min(460px, calc(100vw - 48px))",
          minWidth: "min(320px, calc(100vw - 48px))",
          maxWidth: "calc(100vw - 48px)",
          borderRadius: 8,
          padding: "32px",
          boxSizing: "border-box",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <div
          className="mx-auto mb-6 flex items-center justify-center bg-rose-600 text-white"
          style={{
            width: 72,
            height: 72,
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          <DoorClosed aria-hidden="true" className="h-9 w-9" />
        </div>

        <h1
          className="font-bold text-slate-950"
          style={{
            fontSize: "clamp(28px, 8vw, 40px)",
            lineHeight: 1.1,
            letterSpacing: 0,
            marginBottom: 16,
            whiteSpace: "normal",
            overflowWrap: "normal",
            wordBreak: "normal",
          }}
        >
          โต๊ะถูกปิดแล้ว
        </h1>

        <p
          className="mx-auto text-slate-600"
          style={{
            maxWidth: 360,
            fontSize: 16,
            lineHeight: 1.7,
            marginBottom: 8,
            whiteSpace: "normal",
            overflowWrap: "normal",
            wordBreak: "normal",
          }}
        >
          ขออภัย โต๊ะนี้ถูกปิดการใช้งานแล้ว
        </p>

        <p
          className="mx-auto text-slate-500"
          style={{
            maxWidth: 360,
            fontSize: 14,
            lineHeight: 1.7,
            marginBottom: 28,
            whiteSpace: "normal",
            overflowWrap: "normal",
            wordBreak: "normal",
          }}
        >
          กรุณาติดต่อพนักงานเพื่อเปิดโต๊ะใหม่
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            style={{ borderRadius: 8, minHeight: 48 }}
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            กลับหน้าหลัก
          </Link>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
            style={{ borderRadius: 8, minHeight: 48 }}
            onClick={() => window.history.back()}
          >
            <MessageCircle aria-hidden="true" className="h-4 w-4" />
            กลับไปก่อนหน้า
          </button>
        </div>
      </section>
    </main>
  );
}
