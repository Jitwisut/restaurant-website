"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import OrdersView from "./OrdersView";
import { createApiClient } from "@/lib/api";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

export default function OrdersPage() {
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "staff",
    "superadmin",
  ]);
  const api = useMemo(
    () => createApiClient(auth?.token),
    [auth?.token],
  );
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    if (!auth?.token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.post("/order/orderhistory", {});
      setOrders(response.data.order ?? []);
    } catch (requestError) {
      setError(
        requestError.normalizedMessage ||
          "ไม่สามารถดึงข้อมูลออเดอร์ได้ กรุณาลองใหม่อีกครั้ง",
      );
    } finally {
      setLoading(false);
    }
  }, [api, auth?.token]);

  useEffect(() => {
    if (ready && allowed) {
      fetchOrders();
    }
  }, [allowed, fetchOrders, ready]);

  if (!ready || (auth?.token && !allowed)) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-orange-50 via-amber-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-orange-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-slate-600 font-medium">กำลังโหลด...</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-orange-50 via-amber-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 border-4 border-orange-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-orange-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-slate-600 font-medium">
            กำลังโหลดข้อมูลออเดอร์...
          </p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-orange-50 via-amber-50 to-white flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-900">
            เกิดข้อผิดพลาด
          </h2>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={fetchOrders}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-orange-700 transition"
          >
            ลองใหม่อีกครั้ง
          </button>
        </div>
      </main>
    );
  }

  return <OrdersView orders={orders} />;
}
