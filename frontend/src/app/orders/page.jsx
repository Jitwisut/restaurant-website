"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OrdersView from "./OrdersView";
import { buildWsUrl, createApiClient } from "@/lib/api";
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
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const retryRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [liveStatus, setLiveStatus] = useState("connecting");
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [actionError, setActionError] = useState("");

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

  const upsertOrder = useCallback((nextOrder) => {
    if (!nextOrder?.id) return;

    setOrders((current) => {
      const existingIndex = current.findIndex((order) => order.id === nextOrder.id);
      if (existingIndex === -1) return [nextOrder, ...current];

      const merged = current.map((order) =>
        order.id === nextOrder.id ? { ...order, ...nextOrder } : order,
      );
      return merged.sort(
        (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
      );
    });
  }, []);

  const updateOrderStatus = useCallback(async (orderId, status, reason = "") => {
    setActionError("");
    try {
      const response = await api.post(`/order/${encodeURIComponent(orderId)}/status`, {
        status,
        reason,
      });
      upsertOrder(response.data.order);
      return { ok: true };
    } catch (requestError) {
      const message =
        requestError.normalizedMessage || "Unable to update order status";
      setActionError(message);
      return { ok: false, message };
    }
  }, [api, upsertOrder]);

  const submitPaymentProof = useCallback(async (orderId, reference, note = "") => {
    setActionError("");
    try {
      const response = await api.post(
        `/payments/${encodeURIComponent(orderId)}/submit-proof`,
        { reference, note },
      );
      upsertOrder(response.data.order);
      return { ok: true };
    } catch (requestError) {
      const message =
        requestError.normalizedMessage || "Unable to submit payment proof";
      setActionError(message);
      return { ok: false, message };
    }
  }, [api, upsertOrder]);

  const reviewPayment = useCallback(async (orderId, action, note = "") => {
    setActionError("");
    try {
      const body = action === "reject" ? { reason: note } : { note };
      const response = await api.post(
        `/payments/${encodeURIComponent(orderId)}/${action}`,
        body,
      );
      upsertOrder(response.data.order);
      return { ok: true };
    } catch (requestError) {
      const message =
        requestError.normalizedMessage || "Unable to update payment";
      setActionError(message);
      return { ok: false, message };
    }
  }, [api, upsertOrder]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.username || !auth?.token) return undefined;

    let closedByEffect = false;

    const connect = () => {
      setLiveStatus("connecting");
      const socket = new WebSocket(
        buildWsUrl(
          `/ws/${encodeURIComponent(auth.username)}?role=admin`,
          auth.token,
        ),
      );
      wsRef.current = socket;

      socket.onopen = () => {
        setLiveStatus("connected");
        pingRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "order_created" || payload.type === "order_updated") {
            upsertOrder(payload.order);
            setLastLiveAt(payload.timestamp || new Date().toISOString());

            if (
              payload.type === "order_created" &&
              typeof window !== "undefined" &&
              "Notification" in window &&
              window.Notification.permission === "granted"
            ) {
              new window.Notification("New order", {
                body: `Table ${payload.order?.table_number || "-"}: ${payload.order?.id || ""}`,
              });
            }
          }
        } catch {
          // ignore malformed websocket payloads
        }
      };

      socket.onerror = () => {
        setLiveStatus("disconnected");
      };

      socket.onclose = () => {
        if (pingRef.current) clearInterval(pingRef.current);
        setLiveStatus("disconnected");
        if (!closedByEffect) {
          retryRef.current = setTimeout(connect, 3000);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [allowed, auth?.token, auth?.username, ready, upsertOrder]);

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

  return (
    <OrdersView
      orders={orders}
      liveStatus={liveStatus}
      lastLiveAt={lastLiveAt}
      actionError={actionError}
      onRefresh={fetchOrders}
      onUpdateStatus={updateOrderStatus}
      onSubmitPaymentProof={submitPaymentProof}
      onReviewPayment={reviewPayment}
    />
  );
}
