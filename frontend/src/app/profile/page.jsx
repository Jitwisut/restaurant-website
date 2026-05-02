"use client";

import Link from "next/link";
import { useRestaurantAccess } from "../components/useRestaurantAccess";
import { buildRestaurantPath } from "@/lib/auth";

export default function ProfilePage() {
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "staff",
    "user",
    "kitchen",
    "superadmin",
  ]);

  if (!ready || (auth?.token && !allowed)) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">กำลังโหลดข้อมูลโปรไฟล์...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Restaurant Profile
          </p>
          <h1 className="mt-3 text-3xl font-semibold">
            {auth?.restaurantName || auth?.restaurantSlug || "Restaurant"}
          </h1>
          <p className="mt-2 text-slate-600">
            หน้านี้ผูกกับร้านใน token โดยตรง เพื่อให้พนักงานและเจ้าของร้านเห็น
            ข้อมูลเฉพาะร้านของตัวเองเท่านั้น
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold">ข้อมูลผู้ใช้</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Username</dt>
                <dd className="font-medium">{auth?.username || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Role</dt>
                <dd className="font-medium">{auth?.role || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Restaurant Slug</dt>
                <dd className="font-medium">{auth?.restaurantSlug || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Restaurant Status</dt>
                <dd className="font-medium">{auth?.restaurantStatus || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Subscription Status</dt>
                <dd className="font-medium">{auth?.subscriptionStatus || "-"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Current Period End</dt>
                <dd className="font-medium">
                  {auth?.currentPeriodEnd
                    ? new Date(auth.currentPeriodEnd).toLocaleDateString("en-US")
                    : "-"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 p-6">
            <h2 className="text-lg font-semibold">ไปยังส่วนอื่น</h2>
            <div className="mt-4 grid gap-3">
              <Link
                href={buildRestaurantPath(auth, "admin")}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-white text-sm font-medium hover:bg-slate-800 transition"
              >
                Dashboard
              </Link>
              <Link
                href={buildRestaurantPath(auth, "orders")}
                className="rounded-2xl bg-orange-100 px-4 py-3 text-orange-900 text-sm font-medium hover:bg-orange-200 transition"
              >
                Orders
              </Link>
              <Link
                href={buildRestaurantPath(auth, "tables")}
                className="rounded-2xl bg-emerald-100 px-4 py-3 text-emerald-900 text-sm font-medium hover:bg-emerald-200 transition"
              >
                Tables
              </Link>
              {(auth?.role === "owner" || auth?.role === "admin") && (
                <Link
                  href="/restaurant/billing"
                  className="rounded-2xl bg-violet-100 px-4 py-3 text-violet-900 text-sm font-medium hover:bg-violet-200 transition"
                >
                  Billing
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
