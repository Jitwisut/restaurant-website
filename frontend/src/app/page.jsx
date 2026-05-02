"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth, resolveRoleHome } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const session = getStoredAuth();
    if (session?.token) {
      router.replace(resolveRoleHome(session));
    }
  }, [router]);

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,#fff8ef_0%,#f5efe5_45%,#efe0cf_100%)] text-stone-900">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-6 py-16 lg:px-10">
        <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-stone-300/70 bg-white/80 px-4 py-2 text-sm font-medium text-stone-700 shadow-sm">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Restaurant SaaS Dashboard
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.28em] text-amber-700">
              RestaurantOS
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-tight text-stone-900 md:text-6xl">
              เปิดร้านใหม่ จัดการโต๊ะ ออเดอร์ และทีมงานในที่เดียว
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
              หน้าแรกนี้เป็นจุดเริ่มต้นสำหรับร้านใหม่และผู้ดูแลระบบ
              ถ้ายังไม่มีร้าน ให้สมัครร้านก่อน ถ้ามีบัญชีอยู่แล้วให้เข้าสู่ระบบเพื่อเข้า dashboard
              ของร้านตามสิทธิ์ที่มี
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/restaurant/register"
                className="inline-flex items-center justify-center rounded-2xl bg-stone-900 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-stone-900/20 transition hover:-translate-y-0.5 hover:bg-stone-800"
              >
                สมัครร้านใหม่
              </Link>
              <Link
                href="/signin"
                className="inline-flex items-center justify-center rounded-2xl border border-stone-300 bg-white px-6 py-4 text-base font-semibold text-stone-900 transition hover:-translate-y-0.5 hover:border-stone-400 hover:bg-stone-50"
              >
                เข้าสู่ระบบ
              </Link>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/70 bg-white/85 p-6 shadow-2xl shadow-stone-300/30 backdrop-blur">
            <div className="rounded-[24px] bg-stone-950 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-stone-400">
                    Live Overview
                  </p>
                  <h2 className="mt-2 text-2xl font-bold">Your Next Store</h2>
                </div>
                <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
                  Ready
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm text-stone-400">Tables</p>
                  <p className="mt-2 text-3xl font-black">12</p>
                  <p className="mt-1 text-sm text-stone-400">พร้อมเปิดใช้งาน</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm text-stone-400">Menu</p>
                  <p className="mt-2 text-3xl font-black">48</p>
                  <p className="mt-1 text-sm text-stone-400">รายการอาหาร</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm text-stone-400">Staff</p>
                  <p className="mt-2 text-3xl font-black">6</p>
                  <p className="mt-1 text-sm text-stone-400">บัญชีพนักงาน</p>
                </div>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="text-sm text-stone-400">Orders</p>
                  <p className="mt-2 text-3xl font-black">Realtime</p>
                  <p className="mt-1 text-sm text-stone-400">เชื่อมครัวและโต๊ะ</p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 text-stone-600">
              ปัญหา CORS ที่คุณเห็นเกิดจากหน้าแรกเดิมพยายามโหลดข้อมูลโต๊ะของหลังบ้านทันที
              ทั้งที่ยังไม่มี token และยังไม่ควรเข้าหน้า admin ตั้งแต่ route `/`
              ตอนนี้หน้าแรกถูกแยกให้เป็น public entry page แล้ว
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
