"use client";

import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { buildWsUrl } from "@/lib/api";
import { useAuth } from "@/app/components/AuthProvider";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;
const guestTokenKey = (sessionHash) => `restaurantos.guest.${sessionHash}`;

function formatMoney(amount) {
  return Number(amount || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatOrderDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Bangkok",
  });
}

const getCategoryIcon = (category) => {
  const lower = category.toLowerCase();
  if (lower.includes("appetizer") || lower.includes("ทานเล่น")) return "tapas";
  if (lower.includes("dessert") || lower.includes("ของหวาน")) return "icecream";
  if (lower.includes("drink") || lower.includes("เครื่องดื่ม") || lower.includes("น้ำ")) return "local_bar";
  return "restaurant";
};

export default function OrderPage() {
  const { session: sessionHash } = useParams();
  const router = useRouter();
  const { auth } = useAuth();
  const wsRef = useRef(null);

  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [settings, setSettings] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const [wsError, setWsError] = useState("");
  const [guestToken, setGuestToken] = useState(null);
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const wsToken = guestToken || auth?.token || null;

  const closeTableSession = useCallback(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(guestTokenKey(sessionHash));
      window.localStorage.removeItem(`cart_${sessionHash}`);
    }

    setCart([]);
    setGuestToken(null);
    setWsReady(false);
    setSending(false);

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    router.replace(`/table-closed?session=${encodeURIComponent(String(sessionHash))}`);
  }, [router, sessionHash]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const tableResponse = await axios.get(
          `${API_BASE}/tables/checktable/${sessionHash}`,
        );
        const existingGuestToken =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem(guestTokenKey(sessionHash))
            : null;
        const tokenResponse = existingGuestToken
          ? { data: { token: existingGuestToken } }
          : await axios.post(
              `${API_BASE}/tables/session/${sessionHash}/guest-token`,
            );
        const nextGuestToken = tokenResponse.data?.token || null;

        if (!nextGuestToken) {
          throw new Error("Guest token is required for this table session");
        }

        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            guestTokenKey(sessionHash),
            nextGuestToken,
          );
        }

        setGuestToken(nextGuestToken);

        const menuResponse = await axios.get(
          `${API_BASE}/tables/session/${sessionHash}/menu`,
        );

        setTable(tableResponse.data.table);
        setSettings(menuResponse.data.settings || null);
        setMenu(
          Array.isArray(menuResponse.data)
            ? menuResponse.data
            : menuResponse.data.menu || [],
        );
      } catch (error) {
        toast.error(
          error.response?.data?.message || "โหลดข้อมูลโต๊ะหรือเมนูไม่สำเร็จ",
        );
        setTimeout(() => router.replace("/table-closed"), 1200);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [router, sessionHash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`cart_${sessionHash}`);
    if (raw) {
      try {
        setCart(JSON.parse(raw));
      } catch {
        window.localStorage.removeItem(`cart_${sessionHash}`);
      }
    }
  }, [sessionHash]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (cart.length > 0) {
      window.localStorage.setItem(`cart_${sessionHash}`, JSON.stringify(cart));
    } else {
      window.localStorage.removeItem(`cart_${sessionHash}`);
    }
  }, [cart, sessionHash]);

  const loadOrderHistory = useCallback(async () => {
    if (!guestToken) {
      toast.error("ยังโหลดประวัติคำสั่งซื้อไม่ได้");
      return;
    }

    setOrderHistoryLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE}/tables/session/${encodeURIComponent(String(sessionHash))}/orders`,
        {
          headers: {
            Authorization: `Bearer ${guestToken}`,
          },
        },
      );
      setOrderHistory(response.data.orders || []);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "โหลดประวัติคำสั่งซื้อไม่สำเร็จ",
      );
    } finally {
      setOrderHistoryLoading(false);
    }
  }, [guestToken, sessionHash]);

  useEffect(() => {
    if (!sessionHash || !wsToken) {
      setWsReady(false);
      setWsError("ยังไม่มี guest token สำหรับโต๊ะนี้");
      return;
    }

    const socket = new WebSocket(
      buildWsUrl(`/ws/${encodeURIComponent(String(sessionHash))}?role=user`, wsToken),
    );
    wsRef.current = socket;

    socket.onopen = () => {
      setWsReady(true);
      setWsError("");
    };
    socket.onerror = () => {
      setWsReady(false);
      setWsError("เชื่อมต่อระบบสั่งอาหารไม่สำเร็จ");
    };
    socket.onclose = (event) => {
      setWsReady(false);
      if (event.code === 4001 || event.reason === "table_closed") {
        closeTableSession();
      }
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "system" && payload.message) {
          toast.success(payload.message);
          if (payload.message.includes("สั่ง")) {
            setCart([]);
            setSending(false);
          }
        }
        if (payload.type === "error") {
          setSending(false);
          toast.error(payload.message || "สั่งอาหารไม่สำเร็จ");
        }
        if (payload.type === "order_status") {
          if (settings?.notification_settings?.orderAlertSound) {
            try {
              const audio = new Audio(
                "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
              );
              audio.play().catch(() => undefined);
            } catch {
              // ignore blocked browser audio
            }
          }
          toast(payload.status || "อัปเดตสถานะออเดอร์");
        }
        if (payload.type === "menu_availability_updated" && payload.menu) {
          setMenu((current) =>
            current.map((item) =>
              Number(item.id) === Number(payload.menu.id)
                ? { ...item, isAvailable: payload.menu.isAvailable }
                : item,
            ),
          );
          if (payload.menu.isAvailable === false) {
            setCart((current) => {
              const removed = current.some(
                (item) => Number(item.id) === Number(payload.menu.id),
              );
              if (removed) {
                toast.error(`${payload.menu.name || "Menu item"} is unavailable`);
              }
              return current.filter(
                (item) => Number(item.id) !== Number(payload.menu.id),
              );
            });
          }
        }
        if (payload.type === "table_closed") {
          toast.error("โต๊ะนี้ถูกปิดแล้ว");
          setTimeout(closeTableSession, 300);
        }
      } catch {
        // ignore malformed payload
      }
    };

    return () => socket.close();
  }, [
    closeTableSession,
    sessionHash,
    settings?.notification_settings?.orderAlertSound,
    wsToken,
  ]);

  const categories = useMemo(() => {
    const cats = [...new Set(menu.map((item) => item.category || "General"))];
    return ["All", ...cats];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    return menu.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description &&
          item.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === "All" || (item.category || "General") === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menu, searchQuery, selectedCategory]);

  const totalPrice = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty * Number(item.price), 0),
    [cart],
  );
  const orderSettings = useMemo(
    () => settings?.order_settings || {},
    [settings?.order_settings],
  );
  const tableQrSettings = settings?.table_qr_settings || {};
  const profileSettings = settings?.profile || {};

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  const serviceChargeAmount = useMemo(
    () =>
      (
        totalPrice *
        (Number(orderSettings.serviceChargePercent || 0) / 100)
      ).toFixed(2),
    [orderSettings.serviceChargePercent, totalPrice],
  );
  const taxAmount = useMemo(
    () =>
      (
        (totalPrice + Number(serviceChargeAmount)) *
        (Number(orderSettings.taxPercent || 0) / 100)
      ).toFixed(2),
    [orderSettings.taxPercent, serviceChargeAmount, totalPrice],
  );
  const finalTotal = useMemo(
    () =>
      (
        totalPrice +
        Number(serviceChargeAmount) +
        Number(taxAmount)
      ).toFixed(2),
    [serviceChargeAmount, taxAmount, totalPrice],
  );
  const placeholderImageUrl = settings?.menu_settings?.placeholderImageUrl || "";

  const addToCart = (item) => {
    if (item.isAvailable === false) {
      toast.error(`${item.name} is unavailable`);
      return;
    }

    setCart((current) => {
      const existing = current.find((entry) => entry.id === item.id);
      if (existing) {
        return current.map((entry) =>
          entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry,
        );
      }
      return [...current, { ...item, qty: 1 }];
    });
    toast.success(`Added ${item.name} to cart`);
  };

  const changeQty = (itemId, delta) => {
    setCart((current) =>
      current
        .map((entry) =>
          entry.id === itemId ? { ...entry, qty: entry.qty + delta } : entry,
        )
        .filter((entry) => entry.qty > 0),
    );
  };

  const submitOrder = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("ยังไม่พร้อมเชื่อมต่อสำหรับสั่งอาหาร");
      return;
    }
    if (!table?.table_number || cart.length === 0) {
      toast.error("กรุณาเลือกเมนูก่อน");
      return;
    }

    const unavailableItem = cart.find((cartItem) => {
      const menuItem = menu.find((item) => Number(item.id) === Number(cartItem.id));
      return menuItem?.isAvailable === false;
    });
    if (unavailableItem) {
      setCart((current) =>
        current.filter((item) => Number(item.id) !== Number(unavailableItem.id)),
      );
      toast.error(`${unavailableItem.name} is unavailable`);
      return;
    }

    setSending(true);
    wsRef.current.send(
      JSON.stringify({
        type: "order",
        table_number: table.table_number,
        session: sessionHash,
        menu: {
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: Number(item.price),
            qty: item.qty,
          })),
        },
      }),
    );
  };

  const openOrderHistory = async () => {
    setOrderHistoryOpen(true);
    await loadOrderHistory();
  };

  const callStaff = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error("ยังไม่พร้อมเรียกพนักงาน");
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "call_staff",
        table_number: table?.table_number,
      }),
    );
    toast.success("เรียกพนักงานแล้ว");
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-on-surface-variant">กำลังโหลดเมนู...</p>
      </main>
    );
  }

  return (
    <div className="bg-background text-on-background h-screen font-body-md flex flex-col overflow-hidden">
      <Toaster position="top-center" />
      {/* TopNavBar */}
      <header className="bg-white dark:bg-slate-900 font-sans tracking-tight docked full-width top-0 border-b border-slate-200 dark:border-slate-800 shadow-sm flex justify-between items-center w-full px-8 h-16 sticky z-50">
        <div className="text-xl font-bold text-indigo-900 dark:text-white">
          {profileSettings.name || "Lumière Dining"}
        </div>
        <div className="flex-1 flex justify-center px-8">
          <div className="relative w-full max-w-md hidden md:block">
            <span
              className="material-symbols-outlined absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              style={{ fontSize: "20px" }}
            >
              search
            </span>
            <input
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-900 text-sm bg-slate-50"
              placeholder="Search menu..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 text-indigo-900 dark:text-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 duration-150 rounded-full">
            <span className="material-symbols-outlined">shopping_cart</span>
            {totalItems > 0 && (
              <span className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white">
                {totalItems}
              </span>
            )}
          </button>
          <button className="p-2 text-indigo-900 dark:text-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 duration-150 rounded-full">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            onClick={submitOrder}
            disabled={!wsReady || cart.length === 0 || sending}
            className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 active:scale-95 duration-150 ml-2 hidden md:block disabled:opacity-60"
          >
            {sending ? "Sending..." : "Check Out"}
          </button>
          <div className="w-8 h-8 rounded-full border-2 border-slate-200 ml-2 bg-slate-300 overflow-hidden flex items-center justify-center">
             <span className="material-symbols-outlined text-white text-xl">person</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <nav className="bg-slate-50 dark:bg-slate-950 font-sans text-sm font-medium h-full w-64 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col p-4 gap-2 flex-shrink-0">
          <div className="mb-6 px-4">
            <h2 className="font-bold text-lg text-indigo-900 dark:text-white">
              Gourmet Menu
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Table {table?.table_number || "-"} • Active Session
            </p>
          </div>
          <div className="flex-1 flex flex-col gap-1 overflow-y-auto">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`transition-all duration-200 ease-in-out flex items-center gap-3 px-4 py-3 rounded-lg text-left ${
                    isSelected
                      ? "bg-white dark:bg-slate-900 text-indigo-900 dark:text-indigo-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontVariationSettings: isSelected ? "'FILL' 1" : "'FILL' 0",
                    }}
                  >
                    {cat === "All" ? "restaurant_menu" : getCategoryIcon(cat)}
                  </span>
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto border-t border-slate-200 pt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={openOrderHistory}
              className="text-slate-600 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ease-in-out flex items-center gap-3 px-4 py-2 rounded-lg text-left w-full"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              <span className="text-xs">Order History</span>
            </button>
            <button className="text-slate-600 dark:text-slate-400 hover:text-indigo-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ease-in-out flex items-center gap-3 px-4 py-2 rounded-lg text-left w-full">
              <span className="material-symbols-outlined text-sm">
                contact_support
              </span>
              <span className="text-xs">Assistance</span>
            </button>
            <button
              onClick={callStaff}
              className="mt-2 w-full border border-slate-300 text-slate-700 py-2 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
            >
              Call Server
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-surface-bright flex flex-col xl:flex-row gap-6">
          {wsError && (
             <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 xl:col-span-full w-full mb-4">
               {wsError}
               <div className="mt-2">
                 หน้า QR นี้จะสั่งอาหารได้เต็มรูปแบบเมื่อ backend ออก guest
                 token ให้ session โต๊ะนี้
               </div>
             </div>
          )}
          
          {/* Menu Grid */}
          <div className="flex-1 flex flex-col gap-6">
            <div className="mb-2">
              <h1 className="font-h1 text-h1 text-on-surface mb-2">
                {selectedCategory === "All" ? "All Menu" : selectedCategory}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {tableQrSettings.customerWelcomeMessage ||
                  "Exceptional cuts and refined flavors, expertly prepared."}
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenu.map((item) => {
                const cartItem = cart.find((entry) => entry.id === item.id);
                const isUnavailable = item.isAvailable === false;
                return (
                  <div
                    key={item.id}
                    className={`bg-surface-container-lowest border border-outline-variant rounded-lg overflow-hidden shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col hover:shadow-[0_8px_20px_rgba(45,62,97,0.08)] transition-shadow duration-200 ${
                      isUnavailable ? "opacity-70" : ""
                    }`}
                  >
                    <div className="h-48 overflow-hidden relative">
                      {item.image || placeholderImageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.image || placeholderImageUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        </>
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400">
                           No Image
                        </div>
                      )}
                      <div className="absolute top-2 right-2 bg-surface-container-lowest px-2 py-1 rounded-md text-sm font-bold text-primary-container shadow-sm border border-outline-variant">
                        ฿{item.price}
                      </div>
                      {item.category && (
                        <div className="absolute top-2 left-2 bg-surface-container px-2 py-0.5 rounded-full text-xs font-medium text-on-surface-variant shadow-sm border border-outline-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">
                            {getCategoryIcon(item.category)}
                          </span>{" "}
                          {item.category}
                        </div>
                      )}
                      {isUnavailable ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold uppercase text-white">
                            Sold out
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-h3 text-h3 text-on-surface line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                      <p className="font-body-sm text-body-sm text-on-surface-variant mb-4 line-clamp-2 flex-1">
                        {item.description || "No description provided."}
                      </p>
                      
                      {cartItem ? (
                         <div className="flex items-center justify-between bg-surface-container rounded-DEFAULT p-1 mt-auto">
                            <button
                              onClick={() => changeQty(item.id, -1)}
                              className="w-8 h-8 rounded-md bg-surface-container-lowest text-on-surface flex items-center justify-center hover:bg-slate-100 shadow-sm"
                            >
                              <span className="material-symbols-outlined text-sm">remove</span>
                            </button>
                            <span className="font-label-md text-on-surface">{cartItem.qty}</span>
                            <button
                              onClick={() => changeQty(item.id, 1)}
                              disabled={isUnavailable}
                              className="w-8 h-8 rounded-md bg-primary-container text-white flex items-center justify-center hover:bg-primary shadow-sm disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                         </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          disabled={isUnavailable}
                          className="w-full mt-auto bg-primary-container text-white py-2 rounded-DEFAULT font-label-md text-label-md hover:bg-primary transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            add_circle
                          </span>
                          {isUnavailable ? "Sold out" : "Add to Order"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              
              {filteredMenu.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                   <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
                   <p>No menu items found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Sidebar */}
          <aside className="w-full xl:w-80 2xl:w-96 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-[0_4px_12px_rgba(45,62,97,0.04)] flex flex-col h-fit sticky top-6 flex-shrink-0">
            <div className="p-4 border-b border-outline-variant bg-surface-container-low rounded-t-lg flex items-center justify-between">
              <h2 className="font-h2 text-h2 text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined">receipt_long</span>
                Your Order
              </h2>
              <span className="bg-surface-container px-2 py-1 rounded-md text-xs font-bold text-on-surface border border-outline-variant">
                Table {table?.table_number || "-"}
              </span>
            </div>
            
            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[400px]">
              {cart.length === 0 ? (
                <div className="text-center text-sm text-slate-500 py-4">
                  Your cart is empty.
                </div>
              ) : (
                cart.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-3">
                        <div className="w-8 h-8 bg-surface-container rounded-md flex items-center justify-center text-sm font-bold text-on-surface border border-outline-variant">
                          {item.qty}
                        </div>
                        <div>
                          <h4 className="font-label-md text-label-md text-on-surface line-clamp-1 max-w-[150px]">
                            {item.name}
                          </h4>
                          <button
                            onClick={() => changeQty(item.id, -item.qty)}
                            className="text-xs text-error mt-1 hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              delete
                            </span>{" "}
                            Remove
                          </button>
                        </div>
                      </div>
                      <span className="font-label-md text-label-md text-on-surface whitespace-nowrap">
                        ฿{item.qty * Number(item.price)}
                      </span>
                    </div>
                    {index < cart.length - 1 && (
                      <hr className="border-outline-variant mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-outline-variant bg-surface-container-low rounded-b-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Subtotal
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  ฿{totalPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Service charge ({Number(orderSettings.serviceChargePercent || 0)}%)
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  ฿{serviceChargeAmount}
                </span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Tax ({Number(orderSettings.taxPercent || 0)}%)
                </span>
                <span className="font-body-md text-body-md text-on-surface">
                  ฿{taxAmount}
                </span>
              </div>
              <div className="flex justify-between items-center mb-6 pt-2 border-t border-outline-variant">
                <span className="font-h3 text-h3 text-on-surface">Total</span>
                <span className="font-h3 text-h3 text-primary-container">
                  ฿{finalTotal}
                </span>
              </div>
              <button
                onClick={submitOrder}
                disabled={!wsReady || cart.length === 0 || sending}
                className="w-full bg-primary text-on-primary h-12 rounded-lg font-label-md text-label-md hover:bg-opacity-90 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Place Order"}
                <span className="material-symbols-outlined text-[18px]">
                  arrow_forward
                </span>
              </button>
            </div>
          </aside>
        </main>
      </div>

      {orderHistoryOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setOrderHistoryOpen(false);
            }
          }}
        >
          <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Order History
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  Table {table?.table_number || "-"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOrderHistoryOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200"
                aria-label="Close order history"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {orderHistoryLoading ? (
                <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Loading order history...
                </div>
              ) : orderHistory.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  ยังไม่มีประวัติการสั่งอาหารสำหรับโต๊ะนี้
                </div>
              ) : (
                <div className="space-y-4">
                  {orderHistory.map((order) => {
                    const items = Array.isArray(order.items) ? order.items : [];
                    return (
                      <article
                        key={order.id}
                        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <p className="text-sm font-bold text-slate-950">
                              Order #{String(order.id || "").slice(-8)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatOrderDate(order.created_at)}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                              {order.status || "pending"}
                            </span>
                            <p className="mt-2 text-sm font-bold text-slate-950">
                              ฿{formatMoney(order.total)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 divide-y divide-slate-100">
                          {items.map((item, index) => (
                            <div
                              key={`${order.id}-${item.menu_item_name || "item"}-${index}`}
                              className="flex items-start justify-between gap-3 py-2 text-sm"
                            >
                              <div>
                                <p className="font-medium text-slate-800">
                                  {item.quantity || 0}x{" "}
                                  {item.menu_item_name || "Menu item"}
                                </p>
                                {item.notes ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {item.notes}
                                  </p>
                                ) : null}
                              </div>
                              <span className="shrink-0 font-semibold text-slate-900">
                                ฿{formatMoney(item.subtotal)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
