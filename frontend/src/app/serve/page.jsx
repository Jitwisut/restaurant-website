"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWsUrl, createApiClient } from "@/lib/api";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

function formatOrderTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  });
}

function normalizeItems(items = []) {
  return items.map((item) => ({
    name: item.menu_item_name || item.name || "Menu item",
    qty: Number(item.quantity || item.qty || 1),
    notes: item.notes || item.note || "",
  }));
}

export default function ServePage() {
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "staff",
    "superadmin",
  ]);
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const wsRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadReadyOrders = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/order/ready-to-serve");
      setOrders(response.data.order || []);
    } catch (requestError) {
      setError(requestError.normalizedMessage || "Unable to load ready orders");
    } finally {
      setLoading(false);
    }
  }, [api, auth?.token]);

  useEffect(() => {
    if (ready && allowed) loadReadyOrders();
  }, [allowed, loadReadyOrders, ready]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.username || !auth?.token) return;
    const socket = new WebSocket(
      buildWsUrl(`/ws/${encodeURIComponent(auth.username)}?role=admin`, auth.token),
    );
    wsRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type !== "order_updated" || !payload.order) return;
        if (payload.order.status === "ready") {
          setOrders((current) => {
            const exists = current.some((order) => order.id === payload.order.id);
            const next = exists
              ? current.map((order) =>
                  order.id === payload.order.id ? payload.order : order,
                )
              : [payload.order, ...current];
            return next.sort(
              (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0),
            );
          });
        } else {
          setOrders((current) =>
            current.filter((order) => order.id !== payload.order.id),
          );
        }
      } catch {
        // ignore malformed realtime messages
      }
    };

    return () => socket.close();
  }, [allowed, auth?.token, auth?.username, ready]);

  const markServed = async (orderId) => {
    setBusyId(orderId);
    setError("");
    try {
      await api.post(`/order/${orderId}/served`, {});
      setOrders((current) => current.filter((order) => order.id !== orderId));
    } catch (requestError) {
      setError(requestError.normalizedMessage || "Unable to mark order served");
    } finally {
      setBusyId(null);
    }
  };

  if (!ready || (auth?.token && !allowed)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-secondary">กำลังโหลดคิวเสิร์ฟ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-on-surface font-body-md">
      <header className="sticky top-0 z-40 border-b border-outline-variant bg-surface-container-lowest px-6 py-4 shadow-sm md:px-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Staff Queue
            </p>
            <h1 className="mt-1 text-2xl font-bold text-primary">
              Ready to Serve
            </h1>
          </div>
          <button
            type="button"
            onClick={loadReadyOrders}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${
                loading ? "animate-spin" : ""
              }`}
            >
              refresh
            </span>
            Refresh
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </header>

      <main className="px-6 py-6 md:px-10">
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ready Orders
            </p>
            <p className="mt-2 text-3xl font-bold text-primary">
              {orders.length}
            </p>
          </div>
          <div className="rounded-xl border border-outline-variant bg-white p-4 shadow-sm sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workflow
            </p>
            <p className="mt-2 text-sm text-slate-600">
              Orders disappear from kitchen when ready and stay here until staff
              confirms served.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-white px-4 py-12 text-center text-sm text-slate-500">
            Loading ready orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant bg-white px-4 py-12 text-center text-sm text-slate-500">
            No ready orders.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {orders.map((order) => {
              const items = normalizeItems(order.items || []);
              return (
                <article
                  key={order.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-outline-variant bg-white shadow-sm"
                >
                  <div className="border-b border-outline-variant bg-emerald-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-950">
                          Order #{String(order.id || "").slice(-6)}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          Table {order.table_number} · Ready at{" "}
                          {formatOrderTime(order.created_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold uppercase text-white">
                        Ready
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 divide-y divide-slate-100 p-4">
                    {items.map((item, index) => (
                      <div
                        key={`${order.id}-${item.name}-${index}`}
                        className="flex items-start gap-3 py-2 first:pt-0 last:pb-0"
                      >
                        <span className="w-8 shrink-0 font-bold text-primary">
                          {item.qty}x
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">
                            {item.name}
                          </p>
                          {item.notes ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {item.notes}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-outline-variant bg-slate-50 p-4">
                    <button
                      type="button"
                      onClick={() => markServed(order.id)}
                      disabled={busyId === order.id}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-on-primary text-sm font-semibold transition hover:bg-primary-container disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        room_service
                      </span>
                      {busyId === order.id ? "Saving..." : "Mark served"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
