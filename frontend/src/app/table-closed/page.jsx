"use client";
import { XCircle, Home } from "lucide-react";
import Link from "next/link";

export default function TableClosedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-50 p-4">
      <div className="max-w-md w-full bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 text-center border border-white/50">
        <div className="mb-6">
          <div className="bg-gradient-to-r from-red-500 to-pink-500 p-4 rounded-full inline-block mb-4">
            <XCircle className="w-16 h-16 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          โต๊ะถูกปิดแล้ว
        </h1>

        <p className="text-xl text-gray-600 mb-2">
          ขออภัย โต๊ะนี้ได้ถูกปิดการใช้งานแล้ว
        </p>

        <p className="text-gray-500 mb-8">
          กรุณาติดต่อพนักงานเพื่อเปิดโต๊ะใหม่
        </p>

        <div className="space-y-3">
          <Link
            href="/"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold py-3 px-6 rounded-full hover:shadow-lg transition-all"
          >
            <Home className="w-5 h-5" />
            กลับหน้าหลัก
          </Link>
        </div>

        <div className="mt-6 text-sm text-gray-400">
          <p>หากคุณคิดว่านี่เป็นข้อผิดพลาด</p>
          <p>กรุณาติดต่อพนักงานประจำโต๊ะ</p>
        </div>
      </div>
    </div>
  );
}
