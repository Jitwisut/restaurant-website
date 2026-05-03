"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildWsUrl } from "@/lib/api";
import { useRestaurantAccess } from "../components/useRestaurantAccess";

export default function KitchenDashboard() {
  const { auth, ready, allowed } = useRestaurantAccess([
    "kitchen",
    "superadmin",
  ]);
  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const retryRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [activeSince, setActiveSince] = useState(null);
  const [queue, setQueue] = useState([]);
  const [error, setError] = useState("");

  const connect = useCallback(() => {
    if (!auth?.username || !auth?.token) return;

    const socket = new WebSocket(
      buildWsUrl(`/ws/${encodeURIComponent(auth.username)}?role=kitchen`, auth.token),
    );
    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setActiveSince(new Date());
      setError("");
      pingRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "order") {
          setQueue((current) => {
            const exists = current.some((item) => item.orderId === data.order_id);
            if (exists) return current;
            return [
              ...current,
              {
                orderId: data.order_id,
                from: data.from,
                items: data.menu?.items || [],
                tableNumber: data.table_number,
                status: "pending",
                timestamp: new Date().toLocaleTimeString("th-TH"),
                elapsed: "00:00", // Would need a timer hook in a real app
              },
            ];
          });
        }
      } catch {
        // ignore malformed ws messages
      }
    };

    socket.onerror = () => setError("เชื่อมต่อครัวไม่สำเร็จ");
    socket.onclose = () => {
      setConnected(false);
      setActiveSince(null);
      if (pingRef.current) clearInterval(pingRef.current);
      retryRef.current = setTimeout(connect, 3000);
    };
  }, [auth?.token, auth?.username]);

  useEffect(() => {
    if (ready && allowed) {
      connect();
    }

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [allowed, connect, ready]);

  const sendStatus = useCallback((orderId, status) => {
    const socket = wsRef.current;
    const targetOrder = queue.find((item) => item.orderId === orderId);
    if (!socket || socket.readyState !== WebSocket.OPEN || !targetOrder?.from) {
      setError("ส่งสถานะไม่สำเร็จ");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "order_status",
        to: targetOrder.from,
        order_id: orderId,
        status,
      }),
    );

    setQueue((current) =>
      status === "ready" || status === "done"
        ? current.filter((item) => item.orderId !== orderId)
        : current.map((item) =>
            item.orderId === orderId ? { ...item, status } : item,
          ),
    );
  }, [queue]);

  const title = useMemo(
    () => auth?.restaurantName || auth?.restaurantSlug || "Kitchen",
    [auth?.restaurantName, auth?.restaurantSlug],
  );

  const pendingCount = queue.filter(o => o.status === "pending").length;
  const cookingCount = queue.filter(o => o.status === "preparing").length;
  const activeLabel = connected ? "Active" : "Offline";

  if (!ready || (auth?.token && !allowed)) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant font-body-lg">กำลังโหลดครัว...</p>
      </div>
    );
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col md:flex-row">
      {/* SideNavBar (Web Only) - Mocked for Kitchen role */}
      <nav className="hidden md:flex flex-col h-screen w-64 border-r fixed left-0 top-0 border-outline-variant shadow-sm bg-surface-container-lowest py-6 z-50">
        <div className="px-6 mb-8">
          <h1 className="text-lg font-black text-primary-container">{title}</h1>
          <p className="font-body-sm text-secondary">Kitchen Terminal</p>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${
              connected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            Kitchen {activeLabel}
          </div>
        </div>
        <ul className="flex-1 space-y-2 px-2 overflow-y-auto">
          <li>
            <a className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary-container text-on-secondary-container border-r-4 border-primary transition-all duration-200 ease-in-out font-label-md" href="#">
              <span className="material-symbols-outlined" style={{fontVariationSettings: "'FILL' 1"}}>local_dining</span>
              Kitchen Queue
            </a>
          </li>
          <li>
             <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md" href="#">
               <span className="material-symbols-outlined">inventory_2</span>
               Ingredients
             </a>
          </li>
        </ul>
        <div className="mt-auto px-2 space-y-2 pt-4 border-t border-outline-variant">
           <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-all duration-200 ease-in-out font-label-md" href="#">
               <span className="material-symbols-outlined">logout</span>
               Logout
           </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen w-full">
        {/* TopAppBar (Mobile & Web) */}
        <header className="flex justify-between items-center h-16 px-8 sticky top-0 z-40 bg-surface-container-lowest docked full-width top-0 border-b border-outline-variant shadow-[0_12px_12px_rgba(45,62,97,0.04)] font-sans text-sm antialiased text-on-surface">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-primary-container dark:text-inverse-primary">Kitchen Display</span>
              <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full items-center text-xs font-semibold ml-2 border ${
                  connected
                    ? "bg-emerald-100/50 text-emerald-700 border-emerald-200"
                    : "bg-error-container text-on-error-container border-error"
                }`}>
                {connected && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>}
                {connected ? "Active" : "Disconnected"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
             {error && <span className="text-error font-label-sm">{error}</span>}
            <button className="p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors active:scale-95 transition-transform relative">
              <span className="material-symbols-outlined">notifications</span>
              {queue.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-error"></span>}
            </button>
             <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant overflow-hidden flex-shrink-0 ml-2 flex items-center justify-center text-primary-container font-bold">
               K
             </div>
          </div>
        </header>

        {/* Dashboard Canvas */}
        <div className="flex-1 p-md lg:p-margin pb-24 md:pb-margin overflow-y-auto bg-surface-container-low">
          {/* Page Header */}
          <div className="mb-gutter flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h2 className="font-h1 text-on-surface mb-1">Kitchen Display System</h2>
              <p className="font-body-sm text-secondary">Real-time order fulfillment queue.</p>
              <p className="mt-2 font-label-sm text-secondary">
                Status:{" "}
                <span className={connected ? "text-emerald-700" : "text-error"}>
                  {connected ? "Active" : "Offline"}
                </span>
                {activeSince
                  ? ` since ${activeSince.toLocaleTimeString("th-TH")}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg bg-surface border border-outline-variant text-on-surface font-label-md hover:bg-surface-container transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filter
              </button>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-gutter">
            <div className="bg-surface rounded-xl p-md border border-outline-variant shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col">
              <span className="font-label-sm text-secondary uppercase tracking-wider mb-2">Pending</span>
              <span className="font-display text-on-surface">{pendingCount}</span>
            </div>
            <div className="bg-surface rounded-xl p-md border border-outline-variant shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col">
              <span className="font-label-sm text-secondary uppercase tracking-wider mb-2">Cooking</span>
              <span className="font-display text-primary-container">{cookingCount}</span>
            </div>
            <div className="bg-surface rounded-xl p-md border border-outline-variant shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col">
              <span className="font-label-sm text-secondary uppercase tracking-wider mb-2">Ready</span>
              <span className="font-display text-emerald-700">0</span>
            </div>
            <div className="bg-surface rounded-xl p-md border border-outline-variant shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col">
              <span className="font-label-sm text-secondary uppercase tracking-wider mb-2">Kitchen Status</span>
              <span className={`font-display ${connected ? "text-emerald-700" : "text-error"}`}>{activeLabel}</span>
            </div>
          </div>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-md">
            {queue.length === 0 ? (
               <div className="col-span-full py-12 text-center text-on-surface-variant font-body-lg">
                  ยังไม่มีออเดอร์ในคิว
               </div>
            ) : (
                queue.map((order) => {
                    const isPending = order.status === 'pending';
                    const isCooking = order.status === 'preparing';

                    return (
                      <div key={order.orderId} className={`bg-surface rounded-xl border border-outline-variant shadow-[0_4px_12px_rgba(45,62,97,0.04)] overflow-hidden flex flex-col relative ${isPending ? 'border-l-4 border-l-error border-y border-r' : ''}`}>
                        {isCooking && (
                             <div className="absolute top-0 left-0 h-1 bg-primary-fixed w-full">
                               <div className="h-full bg-primary-container w-2/3 animate-pulse"></div>
                             </div>
                        )}
                        <div className={`p-4 border-b border-outline-variant bg-surface-bright flex justify-between items-start ${isCooking ? 'mt-1' : ''}`}>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-h3 text-on-surface">Order #{order.orderId.slice(-4)}</span>
                               {/* Mocking a VIP tag for the first pending order for visual flair like the HTML */}
                               {isPending && queue.indexOf(order) === 0 && (
                                  <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-sm">NEW</span>
                               )}
                            </div>
                            <span className="font-body-sm text-secondary">Table {order.tableNumber}</span>
                          </div>
                          <div className="text-right">
                             <span className={`block font-h3 ${isPending ? 'text-error' : 'text-on-surface'}`}>{order.elapsed || order.timestamp}</span>
                             <span className="font-label-sm text-secondary">{order.elapsed ? 'Elapsed' : 'Time'}</span>
                          </div>
                        </div>

                        <div className="p-4 flex-1">
                          <ul className="space-y-3 font-body-md text-on-surface">
                            {order.items.map((item, index) => (
                              <li key={index} className="flex items-start gap-3">
                                <span className={`font-semibold w-6 shrink-0 ${isCooking ? 'text-primary-container' : ''}`}>{item.qty || 1}x</span>
                                <div>
                                  <span className="block font-medium">{item.name || item.menu_name || "Menu item"}</span>
                                  {item.note && <span className="block font-body-sm text-secondary mt-0.5">{item.note}</span>}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-4 bg-surface-container-lowest border-t border-outline-variant mt-auto">
                            {isPending ? (
                                <button
                                    onClick={() => sendStatus(order.orderId, "preparing")}
                                    className="w-full bg-primary-container text-on-primary font-label-md py-3 rounded-lg hover:bg-surface-tint transition-colors flex items-center justify-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-[20px]">local_fire_department</span>
                                  Start Cooking
                                </button>
                            ) : (
                                <div className="flex gap-2">
                                     <button className="flex-1 bg-surface border border-outline-variant text-on-surface font-label-md py-3 rounded-lg hover:bg-surface-container transition-colors flex items-center justify-center gap-2">
                                         <span className="material-symbols-outlined text-[20px]">print</span>
                                         Ticket
                                     </button>
                                     <button
                                         onClick={() => sendStatus(order.orderId, "ready")}
                                         className="flex-[2] bg-emerald-600 text-white font-label-md py-3 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                                     >
                                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                                        Mark as Ready
                                    </button>
                                </div>
                            )}
                        </div>
                      </div>
                    );
                })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
